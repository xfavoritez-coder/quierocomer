import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processAutomations } from "@/lib/automations/processor";

/**
 * Daily cron job — runs at 8 AM Chile time (configured in vercel.json)
 *
 * Tasks:
 * 1. Mark sessions without endedAt as abandoned (older than 1 hour)
 * 2. Update lastSeenAt on GuestProfiles based on recent activity
 * 3. Clean up expired magic tokens (older than 7 days)
 * 4. Log execution in CronLog
 */
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const start = Date.now();

  // Verify cron secret in production (Vercel sends this header)
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // 1. Mark stale sessions as abandoned
    const abandonedSessions = await prisma.session.updateMany({
      where: {
        endedAt: null,
        startedAt: { lt: oneHourAgo },
        isAbandoned: false,
      },
      data: {
        isAbandoned: true,
        endedAt: new Date(),
      },
    });

    // 2. Update lastSeenAt on GuestProfiles with recent StatEvents
    // Find guests with activity in the last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentGuests = await prisma.statEvent.findMany({
      where: {
        guestId: { not: null },
        createdAt: { gte: yesterday },
      },
      select: { guestId: true },
      distinct: ["guestId"],
    });

    let guestsUpdated = 0;
    if (recentGuests.length > 0) {
      const guestIds = recentGuests.map((g) => g.guestId!).filter(Boolean);
      const result = await prisma.guestProfile.updateMany({
        where: { id: { in: guestIds } },
        data: { lastSeenAt: new Date() },
      });
      guestsUpdated = result.count;
    }

    // 3. Clean up expired and used magic tokens
    const expiredTokens = await prisma.qRMagicToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: sevenDaysAgo } },
          { usedAt: { not: null }, createdAt: { lt: sevenDaysAgo } },
        ],
      },
    });

    // 4. Process automation triggers (birthday, inactivity, welcome, milestone)
    let automationResults: any[] = [];
    try {
      automationResults = await processAutomations();
    } catch (e) {
      console.error("Automation processing error:", e);
    }

    // 4.5a Recordatorio: trials con <= 2 dias restantes que aun no inscriben tarjeta.
    // Mandamos email solo una vez (trialReminderSentAt previene duplicados).
    const now = new Date();
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const trialsEndingSoon = await prisma.restaurant.findMany({
      where: {
        subscriptionStatus: "TRIALING",
        trialEndsAt: { gt: now, lte: twoDaysFromNow },
        flowSubscriptionId: null,
        billingExempt: false,
        trialReminderSentAt: null,
      },
      select: {
        id: true,
        name: true,
        trialEndsAt: true,
        owner: { select: { email: true, name: true } },
      },
    });

    let trialRemindersSent = 0;
    if (trialsEndingSoon.length > 0) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";
      const { sendAdminEmail, trialEndingSoonEmailHtml } = await import("@/lib/email/sendAdminEmail");
      for (const r of trialsEndingSoon) {
        if (!r.owner?.email) continue;
        const daysLeft = Math.max(1, Math.ceil(((r.trialEndsAt?.getTime() || now.getTime()) - now.getTime()) / (24 * 60 * 60 * 1000)));
        const firstName = (r.owner.name || "").split(" ")[0] || "Hola";
        try {
          await sendAdminEmail({
            to: r.owner.email,
            subject: `🎁 Tu regalo Premium en ${r.name} termina ${daysLeft === 1 ? "mañana" : `en ${daysLeft} días`}`,
            html: trialEndingSoonEmailHtml(firstName, r.name, daysLeft, `${baseUrl}/panel`, `${baseUrl}/panel/suscripcion`),
            purpose: "trial_reminder",
          });
          await prisma.restaurant.update({
            where: { id: r.id },
            data: { trialReminderSentAt: now },
          });
          trialRemindersSent++;
        } catch (e) {
          console.error("[diario] trial reminder error:", e);
        }
      }
    }

    // 4.5b Auto-downgrade trials expirados sin tarjeta inscrita.
    // Si un local entro en TRIALING (via /admin/locales/[id]/handoff) y no
    // inscribio tarjeta antes del trialEndsAt, baja a FREE y manda email.
    const expiredTrials = await prisma.restaurant.findMany({
      where: {
        subscriptionStatus: "TRIALING",
        trialEndsAt: { lt: now },
        flowSubscriptionId: null,
        billingExempt: false,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        owner: { select: { email: true, name: true } },
      },
    });

    let trialsExpired = 0;
    if (expiredTrials.length > 0) {
      await prisma.restaurant.updateMany({
        where: { id: { in: expiredTrials.map((r) => r.id) } },
        data: {
          subscriptionStatus: "NONE",
          plan: "FREE",
          trialEndsAt: null,
        },
      });
      trialsExpired = expiredTrials.length;

      // Email notificacion al dueno (best effort, no falla el cron si falla)
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";
      for (const r of expiredTrials) {
        if (!r.owner?.email) continue;
        try {
          const { sendAdminEmail, trialExpiredEmailHtml } = await import("@/lib/email/sendAdminEmail");
          const firstName = (r.owner.name || "").split(" ")[0] || "Hola";
          await sendAdminEmail({
            to: r.owner.email,
            subject: `${firstName}, tu regalo Premium en ${r.name} terminó`,
            html: trialExpiredEmailHtml(firstName, r.name, `${baseUrl}/panel/suscripcion`),
            purpose: "trial_expired",
          });
        } catch (e) {
          console.error("[diario] email trial expired error:", e);
        }

        // WhatsApp de Camila para los que usaron el trial
        try {
          const lead = await prisma.lead.findFirst({
            where: { generatedSlug: r.slug },
            select: { id: true, whatsapp: true, ownerName: true, events: true },
          });
          if (lead?.whatsapp) {
            const events = Array.isArray(lead.events) ? (lead.events as any[]) : [];
            if (!events.some((e: any) => e.action === "nurturing_trial_usado")) {
              const { sendWhatsApp } = await import("@/lib/whatsapp");
              const ownerName = (lead.ownerName || r.owner?.name || "Hola").split(" ")[0];
              const sid = await sendWhatsApp({
                to: lead.whatsapp,
                body: "",
                contentSid: "HX553107603c0366a63214d4f52afc8e38",
                contentVariables: { "1": ownerName, "2": r.name },
              });
              if (sid) {
                events.push({ ts: now.toISOString(), action: "nurturing_trial_usado", sid });
                await prisma.lead.update({ where: { id: lead.id }, data: { events: events as any } });
                console.log(`[diario] Camila WA sent to ${lead.whatsapp} (trial usado: ${r.name})`);
              }
            }
          }
        } catch (waErr) {
          console.error("[diario] WA trial usado error:", waErr);
        }
      }
    }

    // 4.6 Downgrade suscripciones CANCELED cuyo período ya venció
    let canceledDowngraded = 0;
    const expiredCanceled = await prisma.restaurant.findMany({
      where: {
        subscriptionStatus: "CANCELED",
        currentPeriodEnd: { lt: now },
        billingExempt: false,
      },
      select: { id: true, name: true, slug: true },
    });
    if (expiredCanceled.length > 0) {
      await prisma.restaurant.updateMany({
        where: { id: { in: expiredCanceled.map(r => r.id) } },
        data: { subscriptionStatus: "NONE", plan: "FREE", currentPeriodEnd: null, mpSubscriptionId: null },
      });
      canceledDowngraded = expiredCanceled.length;
      for (const r of expiredCanceled) {
        console.log(`[diario] Downgraded canceled subscription: ${r.name} (${r.slug})`);
      }
    }

    // 5. Backfill translations for restaurants that failed during pipeline
    let translationsBackfilled = 0;
    try {
      const pending = await prisma.restaurant.findMany({
        where: { needsTranslation: true },
        select: { id: true, slug: true, name: true, logoUrl: true, qrToken: true,
          dishes: { where: { isActive: true, deletedAt: null }, select: { id: true }, take: 1 },
        },
        take: 5, // limit to 5 per cron to avoid timeouts
      });
      if (pending.length > 0) {
        const { translateAllForRestaurant } = await import("@/lib/ai/translateContent");
        for (const r of pending) {
          try {
            await translateAllForRestaurant(r.id);
            await prisma.restaurant.update({ where: { id: r.id }, data: { needsTranslation: false } });
            translationsBackfilled++;
            console.log(`[diario] Backfilled translations for ${r.slug}`);

            // Send pending "carta ready" email if lead exists and email wasn't sent
            const lead = await prisma.lead.findFirst({
              where: { generatedSlug: r.slug, cartaStatus: "READY" },
              select: { id: true, email: true, ownerName: true },
            });
            if (lead?.email) {
              try {
                const dishCount = await prisma.dish.count({ where: { restaurantId: r.id, isActive: true, deletedAt: null } });
                const cartaUrl = `https://quierocomer.cl/qr/${r.slug}${r.qrToken ? `?t=${r.qrToken}` : ""}`;
                const { sendAdminEmail } = await import("@/lib/email/sendAdminEmail");
                const ownerName = lead.ownerName || "Hola";
                await sendAdminEmail({
                  to: lead.email,
                  subject: `Tu nueva carta ${r.name} está lista`,
                  purpose: "funnel_carta_ready",
                  html: `
                    <div style="font-family: system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 20px;">
                      ${r.logoUrl ? `<img src="${r.logoUrl}" alt="${r.name}" style="height: 48px; margin-bottom: 20px; border-radius: 50%;" />` : `<img src="https://quierocomer.cl/landing/logo.png" alt="QuieroComer" style="height: 22px; margin-bottom: 24px;" />`}
                      <h1 style="font-size: 24px; font-weight: 700; color: #1a1a1a; margin: 0 0 12px;">
                        ${ownerName}, tu carta está lista
                      </h1>
                      <p style="font-size: 15px; color: #555; line-height: 1.5; margin: 0 0 24px;">
                        Transformamos la carta de <strong>${r.name}</strong> en una experiencia digital.
                        Tiene ${dishCount} platos organizados y listos para que tus clientes los vean.
                      </p>
                      <a href="${`https://quierocomer.cl/api/funnel/track/click?lid=${lead.id}&url=${encodeURIComponent(cartaUrl)}`}" style="display: inline-block; padding: 14px 32px; background: #E8A33D; color: #0e0e0e; font-size: 16px; font-weight: 800; text-decoration: none; border-radius: 12px;">
                        Ver mi carta →
                      </a>
                      <p style="font-size: 13px; color: #999; margin: 24px 0 0; line-height: 1.5;">
                        Este link es tu carta viva. Compártelo con tus clientes o imprímelo en un QR.
                      </p>
                      <img src="https://quierocomer.cl/api/funnel/track/open?lid=${lead.id}" alt="" width="1" height="1" style="display:none" />
                    </div>
                  `,
                });
                await prisma.lead.update({ where: { id: lead.id }, data: { cartaStatus: "DELIVERED", deliveredAt: new Date() } });
                console.log(`[diario] Sent pending carta-ready email to ${lead.email} for ${r.slug}`);
              } catch (emailErr) {
                console.error(`[diario] Failed to send backfill email for ${r.slug}:`, emailErr);
              }
            }
          } catch (e) {
            console.error(`[diario] Translation backfill failed for ${r.slug}:`, e);
          }
        }
      }
    } catch (e) {
      console.error("[diario] Translation backfill error:", e);
    }

    // 6. Safety net: if it's Monday and weekly-email didn't run, trigger it
    let weeklyFallback = false;
    const dayOfWeek = new Date().getUTCDay(); // 0=Sun, 1=Mon
    if (dayOfWeek === 1) {
      const todayMidnight = new Date();
      todayMidnight.setUTCHours(0, 0, 0, 0);
      const weeklyRan = await prisma.cronLog.findFirst({
        where: { jobName: "weekly-email", createdAt: { gte: todayMidnight } },
      });
      if (!weeklyRan) {
        console.log("[diario] Monday safety net: weekly-email didn't run today, triggering...");
        try {
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";
          const secret = process.env.CRON_SECRET;
          const headers: Record<string, string> = {};
          if (secret) headers["Authorization"] = `Bearer ${secret}`;
          const weeklyRes = await fetch(`${baseUrl}/api/cron/weekly-email`, {
            headers,
            signal: AbortSignal.timeout(110000),
          });
          const weeklyData = await weeklyRes.json();
          console.log("[diario] Weekly email fallback result:", JSON.stringify(weeklyData));
          weeklyFallback = true;
        } catch (e: any) {
          console.error("[diario] Weekly email fallback failed:", e.message);
        }
      }
    }

    // 7. Compute daily stats snapshot for monitoring
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const [totalSessions, totalGuests, totalRegistered] = await Promise.all([
      prisma.session.count({ where: { startedAt: { gte: yesterday } } }),
      prisma.guestProfile.count(),
      prisma.guestProfile.count({ where: { linkedQrUserId: { not: null } } }),
    ]);

    const durationMs = Date.now() - start;

    // Log execution
    await prisma.cronLog.create({
      data: {
        jobName: "diario",
        status: "success",
        durationMs,
        details: {
          sessionsAbandoned: abandonedSessions.count,
          guestsUpdated,
          expiredTokensCleaned: expiredTokens.count,
          trialRemindersSent,
          trialsExpired,
          canceledDowngraded,
          translationsBackfilled,
          weeklyFallback,
          automations: automationResults,
          dailySnapshot: {
            sessions24h: totalSessions,
            totalGuests,
            totalRegistered,
            conversionRate: totalGuests > 0 ? Math.round((totalRegistered / totalGuests) * 100) : 0,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      durationMs,
      sessionsAbandoned: abandonedSessions.count,
      guestsUpdated,
      expiredTokensCleaned: expiredTokens.count,
      trialRemindersSent,
      trialsExpired,
      translationsBackfilled,
    });
  } catch (error) {
    const durationMs = Date.now() - start;
    const errorMsg = error instanceof Error ? error.message : "Unknown error";

    // Log error
    await prisma.cronLog.create({
      data: {
        jobName: "diario",
        status: "error",
        durationMs,
        error: errorMsg,
      },
    }).catch(() => {});

    console.error("Cron diario error:", error);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
