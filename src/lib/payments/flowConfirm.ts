import { prisma } from "@/lib/prisma";
import { flowGetStatus, flowSettingsFor } from "@/lib/payments/flow";
import { dispatchOrderToPos } from "@/lib/ecommerce/pos";

/**
 * Confirma un pago de Flow por su token: consulta el estado y, si está pagado,
 * marca la orden como pagada y la envía al POS. Idempotente.
 */
export async function confirmFlowPayment(token: string | null): Promise<boolean> {
  if (!token) return false;
  const order = await prisma.onlineOrder.findFirst({ where: { flowToken: token }, include: { restaurant: { select: { ecommerceConfig: true } } } });
  if (!order) return false;
  if (order.paymentStatus === "paid") return true;

  const status = await flowGetStatus(token, flowSettingsFor(order.restaurant));
  if (status.ok && status.paid) {
    await prisma.onlineOrder.update({ where: { id: order.id }, data: { paymentStatus: "paid", paidAt: new Date(), status: "ACCEPTED" } });
    await dispatchOrderToPos(order.id).catch((e) => console.error("[flowConfirm] POS:", e));
    return true;
  }
  return false;
}
