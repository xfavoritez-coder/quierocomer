import { prisma } from "@/lib/prisma";
import { dispatchOrderToPos } from "@/lib/ecommerce/pos";
import { parseStoreConfig } from "@/lib/ecommerce/store-config";

// Reintenta enviar al POS (Toteat) los pedidos del ecommerce que fallaron
// (p. ej. la caja estaba cerrada). Se detiene solo cuando el pedido entra
// (toteatOrderId) o se agota el tope de intentos.
const MAX_RETRIES = 60;   // ≈ 1 h con cron de 1 min (evita martillar fallas permanentes, p. ej. falta de código)
const WINDOW_HOURS = 6;   // solo reintenta pedidos recientes (no manda pedidos viejos al POS)

export async function retryFailedPosOrders(): Promise<{ attempted: number; sent: number }> {
  const since = new Date(Date.now() - WINDOW_HOURS * 3600_000);
  const orders = await prisma.onlineOrder.findMany({
    where: {
      source: "ecommerce",
      toteatOrderId: null,          // aún no entró al POS
      posError: { not: null },      // falló al menos una vez
      status: { notIn: ["CANCELLED"] },
      createdAt: { gte: since },
      posRetryCount: { lt: MAX_RETRIES },
    },
    select: { id: true, restaurant: { select: { ecommerceStoreConfig: true } } },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  let attempted = 0;
  let sent = 0;
  for (const o of orders) {
    const cfg = parseStoreConfig(o.restaurant?.ecommerceStoreConfig);
    if (!cfg.posRetryEnabled) continue; // solo locales con el reintento activado
    attempted++;
    await prisma.onlineOrder.update({ where: { id: o.id }, data: { posRetryCount: { increment: 1 } } }).catch(() => {});
    const r = await dispatchOrderToPos(o.id, { channel: "web" }).catch((e) => ({ ok: false, message: String(e) }));
    if (r.ok) sent++;
  }
  return { attempted, sent };
}
