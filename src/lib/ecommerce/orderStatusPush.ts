// Push al cliente del ecommerce cuando cambia el estado de su pedido.
// La suscripción se guarda en OnlineOrder.pushSubscription (el cliente la activa
// desde la página de seguimiento). Reutiliza el VAPID del proyecto.
import { prisma } from "@/lib/prisma";

// Mensajes por estado (los que vale la pena avisar; ACCEPTED se omite porque el
// cliente acaba de pedir).
const MSG: Record<string, { title: string; body: string }> = {
  PREPARING: { title: "👨‍🍳 ¡Manos a la obra!", body: "Tu pedido ya se está preparando." },
  READY: { title: "✅ Pedido listo", body: "Tu pedido está listo." },
  IN_DELIVERY: { title: "🛵 En camino", body: "Tu pedido salió a reparto." },
  DONE: { title: "🎉 Entregado", body: "Tu pedido fue entregado. ¡Buen provecho!" },
  CANCELLED: { title: "Pedido cancelado", body: "Tu pedido fue cancelado." },
};

type Sub = { endpoint: string; keys?: { p256dh?: string; auth?: string } };

function isSub(v: unknown): v is Sub {
  return !!v && typeof v === "object" && typeof (v as Sub).endpoint === "string";
}

/** Envía la notificación de cambio de estado al cliente, si tiene suscripción. */
export async function sendOrderStatusPush(orderId: string, status: string): Promise<void> {
  const msg = MSG[status];
  if (!msg) return; // estado sin aviso

  const order = await prisma.onlineOrder.findUnique({
    where: { id: orderId },
    select: { pushSubscription: true, orderNumber: true, source: true },
  });
  if (!order || order.source !== "ecommerce" || !isSub(order.pushSubscription)) return;

  const url = `/pedido/${orderId}`;

  try {
    const { webpush } = await import("@/lib/qr/utils/webpush");
    const subject = process.env.VAPID_SUBJECT;
    const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    if (!subject || !pub || !priv) return;
    webpush.setVapidDetails(subject, pub, priv);
    const payload = JSON.stringify({
      title: msg.title,
      body: order.orderNumber ? `${msg.body} (Pedido #${order.orderNumber})` : msg.body,
      tag: `order-${orderId}`,
      url,
    });
    await webpush.sendNotification(order.pushSubscription as unknown as { endpoint: string; keys: { p256dh: string; auth: string } }, payload);
  } catch (e: unknown) {
    // Suscripción expirada/invalida → la limpiamos para no reintentar.
    const code = (e as { statusCode?: number })?.statusCode;
    if (code === 404 || code === 410) {
      await prisma.onlineOrder.update({ where: { id: orderId }, data: { pushSubscription: undefined } }).catch(() => {});
    }
  }
}
