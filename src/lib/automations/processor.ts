/**
 * Automation processor — evaluates triggers and sends emails.
 * Called by the daily cron job.
 *
 * Triggers:
 * - birthday: send on user's birthday
 * - inactivity: send after N days without visit
 * - welcome: send after registration (1 hour delay)
 * - milestone: send on Nth visit (5th, 10th, etc)
 */
import { prisma } from "@/lib/prisma";

const FREQUENCY_CAP_DAYS = 7;
const TRIGGER_COOLDOWN_DAYS = 30;

interface ProcessResult {
  trigger: string;
  restaurantName: string;
  queued: number;
  skipped: number;
}

export async function processAutomations(): Promise<ProcessResult[]> {
  const results: ProcessResult[] = [];
  const rules = await prisma.automationRule.findMany({
    where: { isActive: true },
    include: { restaurant: { select: { name: true, slug: true } } },
  });

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return results;

  const now = new Date();
  const today = new Date(now.toLocaleString("en-US", { timeZone: "America/Santiago" }));
  const cutoff = new Date(Date.now() - FREQUENCY_CAP_DAYS * 24 * 60 * 60 * 1000);

  for (const rule of rules) {
    let queued = 0;
    let skipped = 0;

    try {
      const rawRecipients = await findRecipients(rule, today, cutoff);

      // Filter by trigger cooldown (30 days per trigger type)
      const triggerCooloff = new Date(Date.now() - TRIGGER_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
      const recipients = rawRecipients.filter(u => {
        const history = (u as any).triggerHistory as Record<string, string> | null;
        if (!history || !history[rule.trigger]) return true;
        return new Date(history[rule.trigger]) < triggerCooloff;
      });
      skipped += rawRecipients.length - recipients.length;

      for (const user of recipients) {
        try {
          const subject = (rule.subject || "")
            .replace(/\{\{name\}\}/g, user.name || "")
            .replace(/\{\{restaurant\}\}/g, rule.restaurant.name);
          const html = (rule.bodyHtml || "")
            .replace(/\{\{name\}\}/g, user.name || "")
            .replace(/\{\{restaurant\}\}/g, rule.restaurant.name)
            .replace(/\{\{slug\}\}/g, rule.restaurant.slug || "");

          const unsubUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://quierocomer.cl"}/api/qr/user/unsubscribe?userId=${user.id}`;
          const fullHtml = html + `<p style="text-align:center;margin-top:32px;font-size:11px;color:#999"><a href="${unsubUrl}" style="color:#999">Desuscribirse</a></p>`;

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
            body: JSON.stringify({
              from: process.env.FROM_EMAIL || "QuieroComer <noreply@quierocomer.cl>",
              to: user.email,
              subject,
              html: fullHtml,
            }),
            signal: AbortSignal.timeout(10000),
          });

          // Update lastEmailAt + trigger history
          const existingHistory = ((user as any).triggerHistory as Record<string, string>) || {};
          await prisma.qRUser.update({
            where: { id: user.id },
            data: {
              lastEmailAt: now,
              triggerHistory: { ...existingHistory, [rule.trigger]: now.toISOString() },
            },
          });
          queued++;

          await new Promise(r => setTimeout(r, 500)); // Rate limit protection
        } catch {
          skipped++;
        }
      }
    } catch (e) {
      console.error(`Automation ${rule.trigger} error:`, e);
    }

    results.push({ trigger: rule.trigger, restaurantName: rule.restaurant.name, queued, skipped });
  }

  return results;
}

async function findRecipients(
  rule: any,
  today: Date,
  emailCutoff: Date
): Promise<{ id: string; email: string; name: string | null }[]> {
  const config = (rule.triggerConfig as any) || {};
  const baseWhere = {
    unsubscribedAt: null,
    OR: [{ lastEmailAt: null }, { lastEmailAt: { lt: emailCutoff } }],
  };

  switch (rule.trigger) {
    case "birthday": {
      const month = today.getMonth() + 1;
      const day = today.getDate();
      // Find users with birthday today who visited this restaurant
      const users = await prisma.qRUser.findMany({
        where: {
          ...baseWhere,
          birthDate: { not: null },
          guestProfiles: { some: { sessions: { some: { restaurantId: rule.restaurantId } } } },
        },
        select: { id: true, email: true, name: true, birthDate: true, triggerHistory: true },
      });
      return users.filter(u => {
        if (!u.birthDate) return false;
        const bd = new Date(u.birthDate);
        return bd.getMonth() + 1 === month && bd.getDate() === day;
      });
    }

    case "inactivity": {
      const daysInactive = config.daysInactive || 14;
      const inactiveSince = new Date(Date.now() - daysInactive * 24 * 60 * 60 * 1000);
      return prisma.qRUser.findMany({
        where: {
          ...baseWhere,
          guestProfiles: {
            some: {
              lastSeenAt: { lt: inactiveSince },
              sessions: { some: { restaurantId: rule.restaurantId } },
            },
          },
        },
        select: { id: true, email: true, name: true, triggerHistory: true },
      });
    }

    case "welcome": {
      // Users registered in the last 24 hours (but at least 1 hour ago for delay)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return prisma.qRUser.findMany({
        where: {
          ...baseWhere,
          createdAt: { gte: oneDayAgo, lte: oneHourAgo },
          guestProfiles: { some: { sessions: { some: { restaurantId: rule.restaurantId } } } },
        },
        select: { id: true, email: true, name: true, triggerHistory: true },
      });
    }

    case "milestone": {
      const visitTarget = config.milestoneVisit || 5;
      const guests = await prisma.guestProfile.findMany({
        where: {
          linkedQrUserId: { not: null },
          visitCount: visitTarget,
          sessions: { some: { restaurantId: rule.restaurantId } },
        },
        select: { linkedQrUserId: true },
      });
      const userIds = guests.map(g => g.linkedQrUserId!).filter(Boolean);
      if (!userIds.length) return [];
      return prisma.qRUser.findMany({
        where: { id: { in: userIds }, ...baseWhere },
        select: { id: true, email: true, name: true, triggerHistory: true },
      });
    }

    default:
      return [];
  }
}
