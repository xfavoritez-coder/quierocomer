import { prisma } from "@/lib/prisma";
import { mpGetPayment, mercadopagoSettingsFor } from "@/lib/payments/mercadopago";
import { dispatchOrderToPos } from "@/lib/ecommerce/pos";

/**
 * Confirma un pago de MercadoPago: consulta el pago con el access token del
 * restaurante y, si está aprobado y corresponde a la orden, la marca pagada y
 * la envía al POS. Idempotente.
 */
export async function confirmMercadoPagoPayment(orderId: string | null, paymentId: string | null): Promise<boolean> {
  if (!orderId || !paymentId) return false;
  const order = await prisma.onlineOrder.findUnique({
    where: { id: orderId },
    include: { restaurant: { select: { ecommerceConfig: true } } },
  });
  if (!order) return false;
  if (order.paymentStatus === "paid") return true;

  const pay = await mpGetPayment(paymentId, mercadopagoSettingsFor(order.restaurant));
  if (pay.ok && pay.paid && (!pay.externalReference || pay.externalReference === order.id)) {
    await prisma.onlineOrder.update({ where: { id: order.id }, data: { paymentStatus: "paid", paidAt: new Date(), status: "ACCEPTED" } });
    await dispatchOrderToPos(order.id).catch((e) => console.error("[mpConfirm] POS:", e));
    return true;
  }
  return false;
}
