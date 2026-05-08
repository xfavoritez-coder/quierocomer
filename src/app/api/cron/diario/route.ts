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

    // 4.5 Auto-downgrade trials expirados sin tarjeta inscrita.
    // Si un local entro en TRIALING (via /admin/locales/[id]/handoff) y no
    // inscribio tarjeta antes del trialEndsAt, baja a FREE y manda email.
    const now = new Date();
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

    // 5. Compute daily stats snapshot for monitoring
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
          trialsExpired,
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
      trialsExpired,
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
