import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 120;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (key !== process.env.SEED_SECRET && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  try {
    const [statEvents, impressions, sessions, cronLogs, magicTokens] = await Promise.all([
      // Delete StatEvents older than 90 days
      prisma.statEvent.deleteMany({ where: { createdAt: { lt: ninetyDaysAgo } } }),
      // Delete DishImpressions older than 90 days
      prisma.dishImpression.deleteMany({ where: { createdAt: { lt: ninetyDaysAgo } } }),
      // Delete abandoned sessions older than 1 year
      prisma.session.deleteMany({ where: { startedAt: { lt: oneYearAgo }, isAbandoned: true } }),
      // Delete CronLogs older than 90 days
      prisma.cronLog.deleteMany({ where: { createdAt: { lt: ninetyDaysAgo } } }),
      // Delete expired/used magic tokens older than 7 days
      prisma.qRMagicToken.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null }, createdAt: { lt: sevenDaysAgo } }] } }),
    ]);

    return NextResponse.json({
      ok: true,
      cleaned: {
        statEvents: statEvents.count,
        impressions: impressions.count,
        sessions: sessions.count,
        cronLogs: cronLogs.count,
        magicTokens: magicTokens.count,
      },
    });
  } catch (error) {
    console.error("[Cleanup cron]", error);
    return NextResponse.json({ error: "Error en limpieza" }, { status: 500 });
  }
}
