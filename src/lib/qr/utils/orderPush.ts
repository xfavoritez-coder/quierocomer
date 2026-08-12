import webpush from "web-push";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) throw new Error("VAPID keys not configured");
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export async function sendOrderNotification(
  subscription: webpush.PushSubscription,
  orderId: string,
  customerName: string,
  total: number,
  orderType: string
) {
  ensureConfigured();
  const payload = JSON.stringify({
    title: "¡Nuevo pedido!",
    body: `${customerName} · $${Math.round(total).toLocaleString("es-CL")} · ${orderType === "DELIVERY" ? "Delivery" : "Retiro"}`,
    orderId,
    customerName,
    total,
    orderType,
  });
  await webpush.sendNotification(subscription, payload);
}
