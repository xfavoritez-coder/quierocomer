import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateInsights } from "@/lib/genio/generateInsights";

export const maxDuration = 300;

/**
 * Cron: Pre-generate Genio insights — runs every Sunday at 23:00 UTC (19:00 Chile).
 * Ensures insights are ready before the weekly-email cron fires Monday at 15:11 UTC.
 */
export async function GET(req: NextRequest) {
  const start = Date.now();

  const authHeader = req.headers.get("authorization");
  const queryKey = req.nextUrl.searchParams.get("key");
  const seedSecret = process.env.SEED_SECRET;
  const isAuthorized =
    !process.env.CRON_SECRET ||
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    (seedSecret && queryKey === seedSecret);
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const candidates = await prisma.restaurant.findMany({
    where: {
      isActive: true,
      isDemo: false,
      OR: [
        { weeklyInsightsEnabled: true },
        { weeklyEmailEnabled: true },
      ],
    },
    select: { id: true, slug: true },
  });

  let generated = 0;
  let errors = 0;

  for (const r of candidates) {
    try {
      await prisma.genioInsight.updateMany({
        where: { restaurantId: r.id, status: "active" },
        data: { status: "dismissed" },
      });
      const newInsights = await generateInsights(r.id);
      for (const ins of newInsights) {
        await prisma.genioInsight.create({
          data: {
            restaurantId: r.id,
            type: ins.type, title: ins.title, body: ins.body,
            priority: ins.priority, data: ins.data,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
      }
      generated += newInsights.length;
    } catch (e) {
      console.error(`[generate-insights] Failed for ${r.slug}:`, e);
      errors++;
    }
  }

  const durationMs = Date.now() - start;

  await prisma.cronLog.create({
    data: {
      jobName: "generate-insights",
      status: errors > 0 && generated === 0 ? "error" : "success",
      durationMs,
      details: { candidates: candidates.length, generated, errors },
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true, candidates: candidates.length, generated, errors, durationMs });
}
