import webpush from "web-push";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    throw new Error("VAPID keys not configured");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export async function sendWaiterNotification(
  subscription: webpush.PushSubscription,
  tableId: string,
  tableName: string,
  restaurantId: string,
  slug?: string | null
) {
  ensureConfigured();
  const payload = JSON.stringify({
    title: `Mesa ${tableName}`,
    body: "El cliente está llamando al garzón",
    tableId,
    tableName,
    restaurantId,
    slug,
    calledAt: new Date().toISOString(),
  });
  // urgency "high" → el push service (FCM/APNs) lo entrega de inmediato y despierta
  // el teléfono aunque esté en reposo, disparando sonido y vibración. Sin esto queda
  // en prioridad normal y Android/iOS pueden mostrarlo en silencio o diferido.
  // TTL corto: una llamada vieja no sirve si el teléfono estuvo apagado un rato.
  await webpush.sendNotification(subscription, payload, { urgency: "high", TTL: 120 });
}

export { webpush };
