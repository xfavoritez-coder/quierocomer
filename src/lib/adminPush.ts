import { prisma } from "@/lib/prisma";
import { webpush } from "@/lib/qr/utils/webpush";

/**
 * Send push notification to all admin subscribers.
 * Used for funnel alerts (failed extraction, new lead, etc.)
 */
export async function sendAdminPush(title: string, body: string, url?: string) {
  try {
    const subject = process.env.VAPID_SUBJECT;
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!subject || !publicKey || !privateKey) return;

    webpush.setVapidDetails(subject, publicKey, privateKey);

    const subs = await prisma.adminPushSubscription.findMany({
      where: { isActive: true },
    });

    const payload = JSON.stringify({ title, body, url: url || "/admin/funnel" });

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await prisma.adminPushSubscription.update({
              where: { id: sub.id },
              data: { isActive: false },
            });
          }
        }
      }),
    );
  } catch (e) {
    console.error("[AdminPush]", e);
  }
}
