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
            subject: `⏰ ${daysLeft === 1 ? "Te queda 1 día" : `Quedan ${daysLeft} días`} de tu prueba en ${r.name}`,
            html: trialEndingSoonEmailHtml(firstName, r.name, daysLeft, `${baseUrl}/panel`, `${baseUrl}/panel/facturacion`),
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
          const { sendAdminEmail, adminEmailTemplate } = await import("@/lib/email/sendAdminEmail");
          const firstName = (r.owner.name || "").split(" ")[0] || "Hola";
          await sendAdminEmail({
            to: r.owner.email,
            subject: `Tu plan de ${r.name} bajo a Gratis`,
            html: adminEmailTemplate(`
<h2 style="color:#FFD600;font-size:20px;margin:0 0 16px">${firstName}, tu prueba gratis termino</h2>
<p style="color:#c0a060;font-size:15px;line-height:1.6;margin:0 0 16px">
  Tu local <strong>${r.name}</strong> volvio al plan <strong>Gratis</strong> porque no inscribiste tu tarjeta.
</p>
<p style="color:#c0a060;font-size:15px;line-height:1.6;margin:0 0 24px">
  Tu carta digital sigue funcionando — solo perdiste las funciones avanzadas (estadisticas, multilenguaje, etc.). Cuando quieras volver, entra al panel y reactiva tu plan.
</p>
<div style="text-align:center">
  <a href="${baseUrl}/panel/suscripcion" style="display:inline-block;background:#F4A623;color:#0D0D0D;font-size:15px;font-weight:bold;padding:12px 28px;border-radius:10px;text-decoration:none">
    Reactivar mi plan
  </a>
</div>`),
            purpose: "trial_expired",
          });
        } catch (e) {
          console.error("[diario] email trial expired error:", e);
        }
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
                      <a href="${cartaUrl}" style="display: inline-block; padding: 14px 32px; background: #E8A33D; color: #0e0e0e; font-size: 16px; font-weight: 800; text-decoration: none; border-radius: 12px;">
                        Ver mi carta →
                      </a>
                      <p style="font-size: 13px; color: #999; margin: 24px 0 0; line-height: 1.5;">
                        Este link es tu carta viva. Compártelo con tus clientes o imprímelo en un QR.
                      </p>
                    </div>
                  `,
                });
                await prisma.lead.update({ where: { id: lead.id }, data: { cartaStatus: "DELIVERED" } });
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

    // 6. Compute daily stats snapshot for monitoring
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
          translationsBackfilled,
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
