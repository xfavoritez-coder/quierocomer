import { prisma } from "@/lib/prisma";
import { sendAdminEmail, orderAcceptedEmailHtml, orderInDeliveryEmailHtml } from "@/lib/email/sendAdminEmail";

export type OrderEmailStatus = "ACCEPTED" | "IN_DELIVERY" | "READY";

/**
 * Envía al cliente el correo de estado del pedido (con el nombre del restaurante
 * en el asunto y el cuerpo, y el link de seguimiento en vivo). Best-effort:
 * nunca lanza. Se usa tanto al confirmarse el pedido (ACCEPTED) como en los
 * cambios de estado desde el panel.
 */
export async function sendOrderStatusEmail(orderId: string, status: OrderEmailStatus): Promise<void> {
  try {
    const order = await prisma.onlineOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true, customerName: true, customerEmail: true, total: true, orderType: true,
        restaurant: { select: { name: true, orderingWaitTime: true } },
      },
    });
    if (!order?.customerEmail) return;

    const restaurantName = order.restaurant?.name ?? "";
    const rn = restaurantName || "el local";
    const trackingUrl = `https://quierocomer.com/pedido/${order.id}`;
    const estimatedTime = order.restaurant?.orderingWaitTime ?? null;

    const opts =
      status === "ACCEPTED"
        ? {
            subject: `${rn} · recibimos tu pedido ✅`,
            html: orderAcceptedEmailHtml({
              customerName: order.customerName,
              restaurantName,
              total: order.total,
              orderType: order.orderType,
              estimatedTime,
              trackingUrl,
            }),
          }
        : {
            subject:
              status === "IN_DELIVERY"
                ? `${rn} · ¡tu pedido está en camino! 🛵`
                : `${rn} · ¡tu pedido está listo! ✅`,
            html: orderInDeliveryEmailHtml({
              customerName: order.customerName,
              restaurantName,
              total: order.total,
              orderType: order.orderType,
              estimatedTime,
            }),
          };

    await sendAdminEmail({ to: order.customerEmail, ...opts, purpose: "order" });
  } catch (err) {
    console.error(`[orderEmails] envío falló para ${orderId}:`, err instanceof Error ? err.message : err);
  }
}
