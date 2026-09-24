// ═══════════════════════════════════════════════════════════
//  Sincroniza el estado del OnlineOrder (ecommerce/manual) según
//  cómo se mueva su pedido en el Centro de pedidos (PosOrder).
//  Así la página /panel/ecommerce/pedidos refleja el avance real:
//  Activos = no entregados; Historial = todos.
//
//  Vínculo PosOrder → OnlineOrder:
//   - Espejo (local sin POS): PosOrder.externalId = "oo-<onlineOrderId>".
//   - POS Toteat: OnlineOrder.toteatOrderId === PosOrder.externalId (best-effort).
// ═══════════════════════════════════════════════════════════
import { prisma } from "@/lib/prisma";

const STAGE_TO_STATUS: Record<string, string> = {
  preparing: "PREPARING",
  ready: "READY",
  out_for_delivery: "IN_DELIVERY",
  delivered: "DONE",
};

export async function syncOnlineOrderFromPos(posOrder: { restaurantId: string; externalId: string; opsStage: string; posStatus?: string | null }): Promise<void> {
  try {
    let onlineId: string | null = null;
    if (posOrder.externalId.startsWith("oo-")) {
      onlineId = posOrder.externalId.slice(3);
    } else {
      const oo = await prisma.onlineOrder.findFirst({
        where: { restaurantId: posOrder.restaurantId, toteatOrderId: posOrder.externalId },
        select: { id: true },
      });
      onlineId = oo?.id ?? null;
    }
    if (!onlineId) return;

    const status = posOrder.posStatus === "canceled" ? "CANCELLED" : STAGE_TO_STATUS[posOrder.opsStage];
    if (!status) return;

    const current = await prisma.onlineOrder.findUnique({ where: { id: onlineId }, select: { status: true, statusHistory: true } });
    if (!current || current.status === status) return; // sin cambios

    const history = Array.isArray(current.statusHistory) ? (current.statusHistory as any[]) : [];
    await prisma.onlineOrder.update({
      where: { id: onlineId },
      data: { status, statusHistory: [...history, { status, ts: new Date().toISOString() }] as unknown as object },
    });
  } catch { /* best-effort */ }
}
