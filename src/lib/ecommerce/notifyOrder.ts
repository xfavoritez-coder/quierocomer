import { prisma } from "@/lib/prisma";

/**
 * Envía push a los dispositivos del local suscritos (OrderPushSubscription),
 * para avisar de un pedido nuevo del ecommerce. No bloquea el flujo principal.
 * Reutiliza la misma infraestructura de push de pedir-online (sw-orders.js).
 */
export async function notifyNewEcommerceOrder(order: { id: string; restaurantId: string; customerName: string; total: number; orderType: string }): Promise<void> {
  try {
    const subs = await prisma.orderPushSubscription.findMany({ where: { restaurantId: order.restaurantId, isActive: true } });
    if (!subs.length) return;
    const { sendOrderNotification } = await import("@/lib/qr/utils/orderPush");
    for (const sub of subs) {
      try {
        await sendOrderNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          order.id,
          order.customerName,
          Math.round(order.total),
          order.orderType,
        );
      } catch (e) {
        if ((e as { statusCode?: number })?.statusCode === 410) {
          await prisma.orderPushSubscription.update({ where: { id: sub.id }, data: { isActive: false } }).catch(() => {});
        }
      }
    }
  } catch {
    /* best-effort */
  }
}
