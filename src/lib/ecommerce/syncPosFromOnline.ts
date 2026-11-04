// ═══════════════════════════════════════════════════════════
//  Sincroniza el espejo del Centro de pedidos / POS (PosOrder)
//  cuando el estado del OnlineOrder cambia desde /panel/ecommerce/pedidos.
//  Es el INVERSO de syncOnlineOrderFromPos: así, gestione quien gestione el
//  pedido (panel de pedidos O board del POS), el estado queda igual en todas
//  las pantallas.
//
//  Vínculo OnlineOrder → PosOrder:
//   - Espejo (local sin POS externo): PosOrder.externalId = "oo-<onlineOrderId>".
//   - POS Toteat: OnlineOrder.toteatOrderId === PosOrder.externalId.
//
//  No hay bucle con syncOnlineOrderFromPos: esta función escribe el PosOrder
//  con prisma directo (no pasa por el route del POS que dispara el sync inverso),
//  y guarda contra no-ops comparando el estado actual.
// ═══════════════════════════════════════════════════════════
import { prisma } from "@/lib/prisma";

const STATUS_TO_STAGE: Record<string, string> = {
  PENDING: "preparing",
  ACCEPTED: "preparing",
  PREPARING: "preparing",
  READY: "ready",
  IN_DELIVERY: "out_for_delivery",
  DONE: "delivered",
};

export async function syncPosOrderFromOnline(onlineOrderId: string, status: string): Promise<void> {
  try {
    // Ubicar el PosOrder espejo: primero por "oo-<id>", luego por toteatOrderId.
    let posOrder = await prisma.posOrder.findFirst({
      where: { externalId: `oo-${onlineOrderId}` },
      select: { id: true, opsStage: true, posStatus: true, opsReadyForDeliveryAt: true, opsDispatchedAt: true },
    });
    if (!posOrder) {
      const oo = await prisma.onlineOrder.findUnique({ where: { id: onlineOrderId }, select: { toteatOrderId: true, restaurantId: true } });
      if (oo?.toteatOrderId) {
        posOrder = await prisma.posOrder.findFirst({
          where: { restaurantId: oo.restaurantId, externalId: oo.toteatOrderId },
          select: { id: true, opsStage: true, posStatus: true, opsReadyForDeliveryAt: true, opsDispatchedAt: true },
        });
      }
    }
    if (!posOrder) return;

    const now = new Date();

    if (status === "CANCELLED") {
      if (posOrder.posStatus === "canceled") return; // sin cambios
      await prisma.posOrder.update({ where: { id: posOrder.id }, data: { posStatus: "canceled" } });
      return;
    }

    const stage = STATUS_TO_STAGE[status];
    if (!stage) return;
    if (posOrder.opsStage === stage && posOrder.posStatus !== "canceled") return; // sin cambios

    const data: Record<string, unknown> = { opsStage: stage };
    // Si venía cancelado y se reactiva, se le quita la cancelación.
    if (posOrder.posStatus === "canceled") data.posStatus = "new";
    // Marcas de tiempo de etapa (para los timers/seguimiento del POS), sin pisar
    // las que ya existan.
    if (stage === "ready") data.opsReadyForDeliveryAt = posOrder.opsReadyForDeliveryAt ?? now;
    if (stage === "out_for_delivery") data.opsDispatchedAt = posOrder.opsDispatchedAt ?? now;
    if (stage === "delivered") {
      data.opsDeliveredAt = now;
      data.opsReadyForDeliveryAt = posOrder.opsReadyForDeliveryAt ?? now;
    }
    // Al volver a preparación se libera la asignación de repartidor.
    if (stage === "preparing") {
      data.assignedDriverId = null; data.assignedTo = null; data.isAssigned = false; data.opsReadyForDeliveryAt = null;
    }

    await prisma.posOrder.update({ where: { id: posOrder.id }, data });
  } catch { /* best-effort */ }
}
