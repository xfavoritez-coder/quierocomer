import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseStoreConfig } from "@/lib/ecommerce/store-config";
import { parseWaitMinutes, releaseTime } from "@/lib/ecommerce/scheduling";
import { releaseScheduledOrder } from "@/lib/ecommerce/releaseScheduled";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Cron frecuente (cada minuto): libera los pedidos programados cuando llega su
 * momento (hora objetivo − tiempo estimado de entrega/retiro). Al liberar, el
 * pedido se envía al POS, se espeja al Centro de pedidos, se imprime y avisa al
 * local (deja de ser "programado" y pasa a ser un pedido normal).
 * Protegido con CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // Candidatos: programados aún no liberados, no cancelados, cuya hora objetivo
  // ya está dentro de la próxima hora (margen amplio para cubrir estimados largos).
  const horizon = new Date(now.getTime() + 6 * 60 * 60 * 1000); // hasta 6h de estimado
  const candidates = await prisma.onlineOrder.findMany({
    where: {
      scheduledFor: { not: null, lte: horizon },
      scheduledReleasedAt: null,
      status: { not: "CANCELLED" },
    },
    select: {
      id: true, orderType: true, scheduledFor: true, paymentGateway: true, paymentStatus: true,
      restaurant: { select: { ecommerceStoreConfig: true } },
    },
    take: 200,
  });

  let released = 0;
  const errors: string[] = [];
  for (const o of candidates) {
    if (!o.scheduledFor) continue;
    // Pagos online no confirmados: no liberar (evita despachar pedidos sin pagar).
    if (o.paymentGateway && o.paymentStatus !== "paid") continue;
    const store = parseStoreConfig(o.restaurant?.ecommerceStoreConfig);
    const est = parseWaitMinutes(o.orderType === "DELIVERY" ? store.waitTimeDelivery : store.waitTimePickup);
    const release = releaseTime(o.scheduledFor, est);
    if (release.getTime() > now.getTime()) continue; // todavía no es momento
    try {
      const r = await releaseScheduledOrder(o.id);
      if (r.ok) released++;
    } catch (e) {
      errors.push(`${o.id}: ${String(e)}`);
    }
  }

  return NextResponse.json({ ok: true, checked: candidates.length, released, errors });
}
