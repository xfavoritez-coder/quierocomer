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
