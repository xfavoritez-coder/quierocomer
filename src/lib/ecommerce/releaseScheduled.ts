// Libera un pedido programado: lo convierte en un pedido normal (envía al POS,
// lo espeja al Centro de pedidos, lo marca para imprimir y avisa al local).
import { prisma } from "@/lib/prisma";
import { dispatchOrderToPos } from "@/lib/ecommerce/pos";
import { mirrorOnlineOrderToCentro } from "@/lib/ecommerce/centroMirror";
import { notifyNewEcommerceOrder } from "@/lib/ecommerce/notifyOrder";

export async function releaseScheduledOrder(orderId: string): Promise<{ ok: boolean; skipped?: boolean; pos?: unknown }> {
  const order = await prisma.onlineOrder.findUnique({
    where: { id: orderId },
    select: { id: true, restaurantId: true, customerName: true, total: true, orderType: true, source: true, scheduledReleasedAt: true, status: true },
  });
  if (!order) return { ok: false, skipped: true };
  if (order.scheduledReleasedAt || order.status === "CANCELLED") return { ok: false, skipped: true };

  // Marca liberado primero (evita doble liberación si el cron se solapa). NO se
  // fuerza la impresión: al liberarse, el pedido sigue la MISMA lógica de impresión
  // que los demás (auto imprime en su ventana; manual/off no imprimen solos, solo
  // cuando el staff toca "Imprimir comanda"). El despacho al POS/Toteat sí ocurre.
  await prisma.onlineOrder.update({
    where: { id: order.id },
    data: { scheduledReleasedAt: new Date() },
  });

  const pos = await dispatchOrderToPos(order.id, { channel: "web" }).catch((e) => ({ ok: false, message: String(e) }));
  await mirrorOnlineOrderToCentro(order.id, "web").catch(() => {});
  if (order.source === "ecommerce") {
    notifyNewEcommerceOrder({ id: order.id, restaurantId: order.restaurantId, customerName: order.customerName, total: order.total, orderType: order.orderType }).catch(() => {});
  }
  return { ok: true, pos };
}
