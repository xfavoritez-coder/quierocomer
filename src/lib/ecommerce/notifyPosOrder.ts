import { prisma } from "@/lib/prisma";

/** Avisa por push (a los dispositivos suscritos del local) que llegó un pedido
 *  nuevo al Centro de pedidos. La pantalla abierta se refresca por Supabase
 *  Realtime; esto cubre el caso del panel cerrado. */
export async function notifyNewPosOrder(order: { restaurantId: string; id: string; customerName: string; total: number; isDelivery: boolean }) {
  const subs = await prisma.orderPushSubscription.findMany({ where: { restaurantId: order.restaurantId, isActive: true } });
  if (!subs.length) return;

  const { sendPanelPush } = await import("@/lib/qr/utils/orderPush");
  const body = `${order.customerName || "Pedido"} · $${Math.round(order.total).toLocaleString("es-CL")} · ${order.isDelivery ? "Delivery" : "Local/Retiro"}`;

  for (const s of subs) {
    try {
      await sendPanelPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, {
        title: "🧾 Nuevo pedido (POS)",
        body,
        url: "/panel/ecommerce/centro-pedidos",
        tag: "pos-order-" + order.id,
      });
    } catch (e: any) {
      if (e?.statusCode === 410 || e?.statusCode === 404) {
        await prisma.orderPushSubscription.update({ where: { endpoint: s.endpoint }, data: { isActive: false } }).catch(() => {});
      }
    }
  }
}
