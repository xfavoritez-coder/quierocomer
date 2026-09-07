import { prisma } from "@/lib/prisma";

/**
 * Registra el uso de un cupón para una orden, de forma idempotente (a lo sumo un
 * registro por orderId). Se llama al CONFIRMARSE el pago (online) o al crear el
 * pedido (offline) — nunca en pagos online pendientes, para no "quemar" el cupón
 * si el cliente abandona el pago.
 */
export async function registerCouponUse(order: {
  id: string;
  restaurantId: string;
  couponCode: string | null;
  customerPhone: string | null;
}): Promise<void> {
  if (!order.couponCode) return;
  try {
    const exists = await prisma.ecommerceCouponUse.findFirst({ where: { orderId: order.id }, select: { id: true } });
    if (exists) return;
    await prisma.ecommerceCouponUse.create({
      data: {
        restaurantId: order.restaurantId,
        couponCode: order.couponCode,
        orderId: order.id,
        customerPhone: (order.customerPhone ?? "").trim(),
      },
    });
  } catch {
    /* best-effort: los límites de uso no deben bloquear la confirmación del pago */
  }
}
