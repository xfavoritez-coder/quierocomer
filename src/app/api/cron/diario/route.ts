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
        slug: true,
        trialEndsAt: true,
        owner: { select: { email: true, name: true } },
      },
    });

    let trialRemindersSent = 0;
    if (trialsEndingSoon.length > 0) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.com";
      const { sendAdminEmail, trialEndingSoonEmailHtml } = await import("@/lib/email/sendAdminEmail");
      for (const r of trialsEndingSoon) {
        if (!r.owner?.email) continue;
        const daysLeft = Math.max(1, Math.ceil(((r.trialEndsAt?.getTime() || now.getTime()) - now.getTime()) / (24 * 60 * 60 * 1000)));
        const firstName = (r.owner.name || "").split(" ")[0] || "Hola";
        try {
          await sendAdminEmail({
            to: r.owner.email,
            subject: `🎁 Tu regalo termina ${daysLeft === 1 ? "mañana" : `en ${daysLeft} días`}`,
            html: trialEndingSoonEmailHtml(firstName, r.name, daysLeft, `${baseUrl}/panel`, `${baseUrl}/panel/suscripcion`, r.slug),
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
        },
      });
      trialsExpired = expiredTrials.length;

      // Email notificacion al dueno (best effort, no falla el cron si falla)
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.com";
      for (const r of expiredTrials) {
        if (!r.owner?.email) continue;
        try {
          const { sendAdminEmail, trialExpiredEmailHtml } = await import("@/lib/email/sendAdminEmail");
          const firstName = (r.owner.name || "").split(" ")[0] || "Hola";
          await sendAdminEmail({
            to: r.owner.email,
            subject: `Tu carta QR volvió al plan gratis`,
            html: trialExpiredEmailHtml(firstName, r.name, `${baseUrl}/panel/suscripcion`, `${baseUrl}/${r.slug}`),
            purpose: "trial_expired",
          });
        } catch (e) {
          console.error("[diario] email trial expired error:", e);
        }

        // WhatsApp de Camila solo si realmente usó el trial y no recibió nurturing antes
        try {
          // Skip if already received any nurturing WA (ya lo contactó Camila por inactividad)
          const hadNurturing = await prisma.panelActivity.findFirst({
            where: { restaurantId: r.id, action: { startsWith: "nurturing_" } },
            select: { action: true },
          });
          if (hadNurturing) {
            console.log(`[diario] skip trial_usado WA for ${r.name} — already received ${hadNurturing.action}`);
          } else {
            // Only send if they actually used the trial (had real owner activity)
            const { OWNER_ACTIONS } = await import("@/lib/admin/lifecycle");
            const ownerActivity = await prisma.panelActivity.findFirst({
              where: { restaurantId: r.id, action: { in: [...OWNER_ACTIONS] } },
              select: { id: true },
            });
            if (!ownerActivity) {
              console.log(`[diario] skip trial_usado WA for ${r.name} — never used the trial`);
            } else {
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

    // 4.6b Correo "vence en 2 días" — aviso anticipado para planes sin auto-renovación
    // Equivalente al trialEndingSoon pero para clientes de pago (transfer u online sin Flow/MP).
    let expiringIn2EmailsSent = 0;
    const twoDaysFromNowStart = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); twoDaysFromNowStart.setHours(0, 0, 0, 0);
    const twoDaysFromNowEnd = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); twoDaysFromNowEnd.setHours(23, 59, 59, 999);
    const expiringIn2 = await prisma.restaurant.findMany({
      where: {
        subscriptionStatus: "ACTIVE",
        currentPeriodEnd: { gte: twoDaysFromNowStart, lte: twoDaysFromNowEnd },
        billingExempt: false,
        mpSubscriptionId: null,
        plan: { not: "FREE" },
      },
      select: {
        id: true, name: true, plan: true,
        owner: { select: { id: true, email: true, name: true } },
      },
    });
    if (expiringIn2.length > 0) {
      const { sendAdminEmail, planExpiringSoonEmailHtml } = await import("@/lib/email/sendAdminEmail");
      const { buildAutoLoginUrl } = await import("@/lib/email/autoLoginUrl");
      const { PLAN_LABELS } = await import("@/lib/billing/plans-config");
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.com";
      const paymentMethods = await detectPaymentMethods(expiringIn2.map(r => r.id));
      const expiryDate = twoDaysFromNowStart.toLocaleDateString("es-CL", { day: "numeric", month: "long" });

      for (const r of expiringIn2) {
        if (!r.owner?.email) continue;
        const alreadySent = await prisma.emailLog.findFirst({
          where: { to: r.owner.email, purpose: "expiry_in_2_days", createdAt: { gte: twoDaysFromNowStart } },
        });
        if (alreadySent) continue;

        const paymentMethod = paymentMethods.get(r.id) ?? "online";
        const planLabel = PLAN_LABELS[r.plan as "GOLD" | "SILVER" | "PREMIUM"] || r.plan;
        const panelLink = buildAutoLoginUrl(baseUrl, r.owner.id) + `&redirect=/panel/mi-restaurante%3Frenew%3D1%26plan%3D${r.plan}`;
        try {
          await sendAdminEmail({
            to: r.owner.email,
            subject: `${r.name} · Tu plan ${planLabel} vence en 2 días`,
            html: planExpiringSoonEmailHtml({ restaurantName: r.name, planLabel, expiryDate, panelLink, paymentMethod }),
            purpose: "expiry_in_2_days",
          });
          expiringIn2EmailsSent++;
        } catch (e) { console.error("[diario] expiry_in_2_days email error:", e); }
      }
    }

    // Helper: detect payment method for a set of restaurant IDs
    async function detectPaymentMethods(restaurantIds: string[]): Promise<Map<string, "transfer" | "online">> {
      const manualLogs = await prisma.panelActivity.findMany({
        where: { restaurantId: { in: restaurantIds }, action: "manual_payment" },
        select: { restaurantId: true },
        distinct: ["restaurantId"],
      });
      const hasManual = new Set(manualLogs.map((l: any) => l.restaurantId));
      const map = new Map<string, "transfer" | "online">();
      for (const id of restaurantIds) map.set(id, hasManual.has(id) ? "transfer" : "online");
      return map;
    }

    // 4.7 Correo + WhatsApp "vence hoy" — enviado el mismo día que expira el período
    let expiryTodayEmailsSent = 0;
    let expiryTodayWaSent = 0;
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);
    const expiringToday = await prisma.restaurant.findMany({
      where: {
        subscriptionStatus: "ACTIVE",
        currentPeriodEnd: { gte: startOfToday, lte: endOfToday },
        billingExempt: false,
        mpSubscriptionId: null,
        plan: { not: "FREE" },
      },
      select: {
        id: true, name: true, plan: true,
        owner: { select: { id: true, email: true, name: true, whatsapp: true } },
      },
    });
    if (expiringToday.length > 0) {
      const { sendAdminEmail, planExpiryTodayEmailHtml } = await import("@/lib/email/sendAdminEmail");
      const { buildAutoLoginUrl } = await import("@/lib/email/autoLoginUrl");
      const { PLAN_LABELS } = await import("@/lib/billing/plans-config");
      const { sendWhatsApp, BILLING_EXPIRY_TODAY_WA_TEMPLATE } = await import("@/lib/whatsapp");
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.com";
      const paymentMethods = await detectPaymentMethods(expiringToday.map(r => r.id));
      const expiryDate = now.toLocaleDateString("es-CL", { day: "numeric", month: "long" });

      for (const r of expiringToday) {
        if (!r.owner?.email) continue;
        const alreadySentEmail = await prisma.emailLog.findFirst({
          where: { to: r.owner.email, purpose: "expiry_today", createdAt: { gte: startOfToday } },
        });

        const paymentMethod = paymentMethods.get(r.id) ?? "online";
        const planLabel = PLAN_LABELS[r.plan as "GOLD" | "SILVER" | "PREMIUM"] || r.plan;
        const panelLink = buildAutoLoginUrl(baseUrl, r.owner.id) + `&redirect=/panel/mi-restaurante%3Frenew%3D1%26plan%3D${r.plan}`;

        // Email
        if (!alreadySentEmail) {
          try {
            await sendAdminEmail({
              to: r.owner.email,
              subject: `${r.name} · Tu plan ${planLabel} vence hoy, ${expiryDate}`,
              html: planExpiryTodayEmailHtml({ restaurantName: r.name, planLabel, expiryDate, panelLink, paymentMethod }),
              purpose: "expiry_today",
            });
            expiryTodayEmailsSent++;
          } catch (e) { console.error("[diario] expiry_today email error:", e); }
        }

        // WhatsApp — solo si el dueño tiene número y el template está aprobado
        if (r.owner.whatsapp && BILLING_EXPIRY_TODAY_WA_TEMPLATE !== "PENDING_APPROVAL") {
          try {
            const alreadySentWa = await prisma.panelActivity.findFirst({
              where: { restaurantId: r.id, action: "wa_expiry_today", createdAt: { gte: startOfToday } },
            });
            if (!alreadySentWa) {
              const ownerName = (r.owner.name || "").split(" ")[0] || "Hola";
              const sid = await sendWhatsApp({
                to: r.owner.whatsapp,
                body: "",
                contentSid: BILLING_EXPIRY_TODAY_WA_TEMPLATE,
                contentVariables: { "1": ownerName, "2": r.name, "3": panelLink },
              });
              if (sid) {
                await prisma.panelActivity.create({
                  data: { restaurantId: r.id, action: "wa_expiry_today", details: { sid } as any },
                });
                expiryTodayWaSent++;
                console.log(`[diario] WA expiry_today sent to ${r.owner.whatsapp} (${r.name})`);
              }
            }
          } catch (waErr) { console.error("[diario] WA expiry_today error:", waErr); }
        }
      }
    }

    // 4.8 Downgrade planes ACTIVE cuyo período ya venció (sin gracia — se corta al día siguiente)
    let activeExpiredDowngraded = 0;
    const expiredActive = await prisma.restaurant.findMany({
      where: {
        subscriptionStatus: "ACTIVE",
        currentPeriodEnd: { lt: startOfToday },
        billingExempt: false,
        mpSubscriptionId: null,
        plan: { not: "FREE" },
      },
      select: { id: true, name: true, slug: true },
    });
    if (expiredActive.length > 0) {
      await prisma.restaurant.updateMany({
        where: { id: { in: expiredActive.map(r => r.id) } },
        data: { subscriptionStatus: "NONE", plan: "FREE", currentPeriodEnd: null },
      });
      activeExpiredDowngraded = expiredActive.length;
      for (const r of expiredActive) {
        console.log(`[diario] Downgraded expired plan (next day cutoff): ${r.name} (${r.slug})`);
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
                const cartaUrl = `https://quierocomer.com/qr/${r.slug}`;
                const { sendAdminEmail } = await import("@/lib/email/sendAdminEmail");
                const ownerName = lead.ownerName || "Hola";
                await sendAdminEmail({
                  to: lead.email,
                  subject: `Tu nueva carta ${r.name} está lista`,
                  purpose: "funnel_carta_ready",
                  html: `
                    <div style="font-family: system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 20px;">
                      ${r.logoUrl ? `<img src="${r.logoUrl}" alt="${r.name}" style="height: 48px; margin-bottom: 20px; border-radius: 50%;" />` : `<img src="https://quierocomer.com/logo.png" alt="QuieroComer" style="width:24px;height:24px;margin-bottom:24px;" />`}
                      <h1 style="font-size: 24px; font-weight: 700; color: #1a1a1a; margin: 0 0 12px;">
                        ${ownerName}, tu carta está lista
                      </h1>
                      <p style="font-size: 15px; color: #555; line-height: 1.5; margin: 0 0 24px;">
                        Transformamos la carta de <strong>${r.name}</strong> en una experiencia digital.
                        Tiene ${dishCount} platos organizados y listos para que tus clientes los vean.
                      </p>
                      <a href="${`https://quierocomer.com/api/funnel/track/click?lid=${lead.id}&url=${encodeURIComponent(cartaUrl)}`}" style="display: inline-block; padding: 14px 32px; background: #E8A33D; color: #0e0e0e; font-size: 16px; font-weight: 800; text-decoration: none; border-radius: 12px;">
                        Ver mi carta →
                      </a>
                      <p style="font-size: 13px; color: #999; margin: 24px 0 0; line-height: 1.5;">
                        Este link es tu carta viva. Compártelo con tus clientes o imprímelo en un QR.
                      </p>
                      <img src="https://quierocomer.com/api/funnel/track/open?lid=${lead.id}" alt="" width="1" height="1" style="display:none" />
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

    // 5b. Auto-detect restaurants with untranslated dishes and mark them for backfill
    try {
      const untranslated = await prisma.$queryRaw<{ restaurantId: string }[]>`
        SELECT DISTINCT d."restaurantId"
        FROM "Dish" d
        WHERE d."isActive" = true
          AND d."deletedAt" IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM "DishTranslation" dt WHERE dt."dishId" = d.id AND dt.lang = 'en'
          )
        LIMIT 20
      `;
      if (untranslated.length > 0) {
        const ids = untranslated.map(r => r.restaurantId);
        await prisma.restaurant.updateMany({
          where: { id: { in: ids }, needsTranslation: false },
          data: { needsTranslation: true },
        });
        if (ids.length > 0) console.log(`[diario] Marked ${ids.length} restaurants for translation sweep`);
      }
    } catch (e) {
      console.error("[diario] Translation sweep error:", e);
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
          expiringIn2EmailsSent,
          expiryTodayEmailsSent,
          expiryTodayWaSent,
          activeExpiredDowngraded,
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
      expiringIn2EmailsSent,
      expiryTodayEmailsSent,
      expiryTodayWaSent,
      activeExpiredDowngraded,
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
