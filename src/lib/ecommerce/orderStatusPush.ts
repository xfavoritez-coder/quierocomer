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

// Etiqueta corta para la Live Activity (debe calzar con la app iOS).
function liveActivityLabel(status: string, orderType: string): string {
  switch (status) {
    case "ACCEPTED": return "Pedido recibido";
    case "PREPARING": return "En preparación";
    case "READY": return orderType === "DELIVERY" ? "Listo, esperando repartidor" : "Listo para retirar";
    case "IN_DELIVERY": return "En camino";
    case "DONE": return "Entregado";
    case "CANCELLED": return "Pedido cancelado";
    default: return "";
  }
}

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
    select: {
      pushSubscription: true, nativePush: true, liveActivityToken: true,
      orderType: true, orderNumber: true, source: true,
      restaurant: { select: { name: true } },
    },
  });
  if (!order || order.source !== "ecommerce") return;

  const url = `/pedido/${orderId}`;
  const body = order.orderNumber ? `${msg.body} (Pedido #${order.orderNumber})` : msg.body;

  // Pasos del progreso (para la notificación persistente de Android).
  const stepsList = order.orderType === "DELIVERY"
    ? ["ACCEPTED", "PREPARING", "READY", "IN_DELIVERY", "DONE"]
    : ["ACCEPTED", "PREPARING", "READY", "DONE"];
  const step = Math.max(0, stepsList.indexOf(status));

  // ── Push web (PWA) ──
  if (isSub(order.pushSubscription)) {
    try {
      const { webpush } = await import("@/lib/qr/utils/webpush");
      const subject = process.env.VAPID_SUBJECT;
      const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      const priv = process.env.VAPID_PRIVATE_KEY;
      if (subject && pub && priv) {
        webpush.setVapidDetails(subject, pub, priv);
        await webpush.sendNotification(
          order.pushSubscription as unknown as { endpoint: string; keys: { p256dh: string; auth: string } },
          JSON.stringify({ title: msg.title, body, tag: `order-${orderId}`, url }),
        );
      }
    } catch (e: unknown) {
      const code = (e as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) {
        await prisma.onlineOrder.update({ where: { id: orderId }, data: { pushSubscription: undefined } }).catch(() => {});
      }
    }
  }

  // ── Push nativo (app Capacitor) ──
  //  iOS: push de alerta normal (APNs).
  //  Android: mensaje data-only que arma la notificación PERSISTENTE de estado
  //  (equivalente de la Live Activity) en OrderMessagingService.
  const native = order.nativePush as { platform?: string; token?: string } | null;
  if (native?.token && (native.platform === "ios" || native.platform === "android")) {
    try {
      const nativePush = await import("@/lib/ecommerce/nativePush");
      let r;
      if (native.platform === "ios") {
        r = await nativePush.sendApns(native.token, { title: msg.title, body, url, tag: `order-${orderId}` });
      } else {
        r = await nativePush.sendFcmOrderStatus(native.token, {
          orderId,
          status,
          statusLabel: liveActivityLabel(status, order.orderType),
          orderNumber: order.orderNumber != null ? String(order.orderNumber) : "",
          storeName: order.restaurant?.name ?? "",
          step,
          totalSteps: stepsList.length,
          url,
        });
      }
      if (r.invalid) {
        await prisma.onlineOrder.update({ where: { id: orderId }, data: { nativePush: undefined } }).catch(() => {});
      }
    } catch { /* best-effort */ }
  }

  // ── Live Activity / Isla Dinámica (iOS): actualiza aunque la app esté cerrada ──
  if (order.liveActivityToken) {
    try {
      const { sendApnsLiveActivity } = await import("@/lib/ecommerce/nativePush");
      const isFinal = status === "DONE" || status === "CANCELLED";
      const contentState = {
        status,
        statusLabel: liveActivityLabel(status, order.orderType),
        updatedAt: Math.floor(Date.now() / 1000),
      };
      const r = await sendApnsLiveActivity(order.liveActivityToken, {
        event: isFinal ? "end" : "update",
        contentState,
      });
      if (r.invalid || isFinal) {
        // token inválido, o la actividad terminó → ya no sirve guardarlo
        await prisma.onlineOrder.update({ where: { id: orderId }, data: { liveActivityToken: null } }).catch(() => {});
      }
    } catch { /* best-effort */ }
  }
}
