/**
 * Campaign email sender — resolves segment, queues recipients, sends via Resend.
 * Respects: unsubscribe, frequency cap (1 email per 7 days per user), max batch.
 */
import { prisma } from "@/lib/prisma";
import { evaluateSegment } from "@/lib/segments/evaluator";

const FREQUENCY_CAP_DAYS = 7;
const BATCH_SIZE = 50; // Resend batch limit

interface SendResult {
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export async function sendCampaign(campaignId: string): Promise<SendResult> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { segment: true, restaurant: { select: { name: true } } },
  });

  if (!campaign || !campaign.segmentId || !campaign.subject || !campaign.bodyHtml) {
    throw new Error("Campaign incomplete");
  }

  // Update status to SENDING
  await prisma.campaign.update({ where: { id: campaignId }, data: { status: "SENDING" } });

  // Evaluate segment to get user IDs
  const segmentResult = await evaluateSegment(campaign.restaurantId, campaign.segment!.rules as any[]);
  const userIds = segmentResult.userIds;

  if (!userIds.length) {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: "SENT", sentAt: new Date(), stats: { sent: 0, skipped: 0, failed: 0 } } });
    return { sent: 0, skipped: 0, failed: 0, errors: [] };
  }

  // Get users, filter out unsubscribed and recently emailed
  const cutoff = new Date(Date.now() - FREQUENCY_CAP_DAYS * 24 * 60 * 60 * 1000);
  const users = await prisma.qRUser.findMany({
    where: {
      id: { in: userIds },
      unsubscribedAt: null,
      OR: [{ lastEmailAt: null }, { lastEmailAt: { lt: cutoff } }],
    },
    select: { id: true, email: true, name: true },
  });

  const skipped = userIds.length - users.length;

  // Create recipient records
  await prisma.campaignRecipient.createMany({
    data: users.map(u => ({ campaignId, qrUserId: u.id })),
    skipDuplicates: true,
  });

  // Send emails in batches via Resend
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) throw new Error("RESEND_API_KEY not set");

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);
    const successUserIds: string[] = [];
    const failedUserIds: string[] = [];

    for (const user of batch) {
      try {
        // Add click tracking, unsubscribe link, and open pixel
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://quierocomer.cl";
        const unsubUrl = `${baseUrl}/api/qr/user/unsubscribe?userId=${user.id}`;
        const pixelUrl = `${baseUrl}/api/campaigns/track/open?cid=${campaignId}&uid=${user.id}`;

        // Wrap all <a href="..."> links with click tracker
        let personalizedHtml = campaign.bodyHtml
          .replace(/\{\{name\}\}/g, user.name || "")
          .replace(/\{\{restaurant\}\}/g, campaign.restaurant.name);

        // Replace href links (except unsubscribe and mailto) with click tracker
        personalizedHtml = personalizedHtml.replace(
          /href="(https?:\/\/[^"]+)"/g,
          (match, url) => {
            if (url.includes("unsubscribe")) return match;
            const trackUrl = `${baseUrl}/api/campaigns/track/click?cid=${campaignId}&uid=${user.id}&url=${encodeURIComponent(url)}`;
            return `href="${trackUrl}"`;
          }
        );

        personalizedHtml += `<img src="${pixelUrl}" width="1" height="1" style="display:none" />`
          + `<p style="text-align:center;margin-top:32px;font-size:11px;color:#999"><a href="${unsubUrl}" style="color:#999">Desuscribirse</a></p>`;

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
          body: JSON.stringify({
            from: process.env.FROM_EMAIL || "QuieroComer <noreply@quierocomer.cl>",
            to: user.email,
            subject: campaign.subject.replace(/\{\{name\}\}/g, user.name || "").replace(/\{\{restaurant\}\}/g, campaign.restaurant.name),
            html: personalizedHtml,
          }),
          signal: AbortSignal.timeout(10000),
        });

        successUserIds.push(user.id);
        sent++;
      } catch (e: any) {
        errors.push(`${user.email}: ${e.message}`);
        failedUserIds.push(user.id);
        failed++;
      }
    }

    // Batch update successful recipients and users
    const batchTime = new Date();
    if (successUserIds.length > 0) {
      await Promise.all([
        prisma.campaignRecipient.updateMany({
          where: { campaignId, qrUserId: { in: successUserIds } },
          data: { status: "sent", sentAt: batchTime },
        }),
        prisma.qRUser.updateMany({
          where: { id: { in: successUserIds } },
          data: { lastEmailAt: batchTime },
        }),
      ]);
    }

    // Batch update failed recipients
    if (failedUserIds.length > 0) {
      await prisma.campaignRecipient.updateMany({
        where: { campaignId, qrUserId: { in: failedUserIds } },
        data: { status: "failed" },
      });
    }

    await new Promise(r => setTimeout(r, 1000)); // Rate limit protection
  }

  // Update campaign
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: "SENT",
      sentAt: new Date(),
      stats: { sent, skipped, failed, total: userIds.length },
    },
  });

  return { sent, skipped, failed, errors };
}
