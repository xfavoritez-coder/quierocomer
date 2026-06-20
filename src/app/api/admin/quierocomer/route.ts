import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/adminAuth";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");

    // Chile timezone = UTC-4
    let dayStart: Date;
    let dayEnd: Date;

    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      // Parse as Chile date (UTC-4): add 4 hours to get UTC midnight
      dayStart = new Date(`${dateParam}T04:00:00.000Z`);
      dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    } else {
      // Today in Chile time
      const now = new Date();
      const chileNow = new Date(now.getTime() - 4 * 60 * 60 * 1000);
      const chileDate = chileNow.toISOString().slice(0, 10);
      dayStart = new Date(`${chileDate}T04:00:00.000Z`);
      dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    }

    // ─── Stats ────────────────────────────────────────────────────────────────
    const [uniqueUsersResult, viewsResult, likesResult, dislikesResult, savesResult] =
      await Promise.all([
        prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
          SELECT COUNT(DISTINCT "feedUserId") as count
          FROM "FeedInteraction"
          WHERE "createdAt" >= ${dayStart} AND "createdAt" < ${dayEnd}
        `),
        prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
          SELECT COUNT(*) as count
          FROM "FeedInteraction"
          WHERE "action" IN ('VIEW','TAP')
            AND "createdAt" >= ${dayStart} AND "createdAt" < ${dayEnd}
        `),
        prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
          SELECT COUNT(*) as count
          FROM "FeedInteraction"
          WHERE "action" IN ('LIKE','ANTOJO','FAVORITE')
            AND "createdAt" >= ${dayStart} AND "createdAt" < ${dayEnd}
        `),
        prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
          SELECT COUNT(*) as count
          FROM "FeedInteraction"
          WHERE "action" IN ('PASS','DISLIKE')
            AND "createdAt" >= ${dayStart} AND "createdAt" < ${dayEnd}
        `),
        prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
          SELECT COUNT(*) as count
          FROM "FeedInteraction"
          WHERE "action" IN ('SAVE','ANTOJO')
            AND "createdAt" >= ${dayStart} AND "createdAt" < ${dayEnd}
        `),
      ]);

    const stats = {
      uniqueUsers: Number(uniqueUsersResult[0]?.count ?? 0),
      totalViews: Number(viewsResult[0]?.count ?? 0),
      totalLikes: Number(likesResult[0]?.count ?? 0),
      totalDislikes: Number(dislikesResult[0]?.count ?? 0),
      totalSaves: Number(savesResult[0]?.count ?? 0),
    };

    // ─── Top Viewed ───────────────────────────────────────────────────────────
    const topViewedRaw = await prisma.$queryRaw<{ dishId: string; count: bigint }[]>(Prisma.sql`
      SELECT "dishId", COUNT(*) as count
      FROM "FeedInteraction"
      WHERE "action" IN ('VIEW','TAP')
        AND "createdAt" >= ${dayStart} AND "createdAt" < ${dayEnd}
      GROUP BY "dishId"
      ORDER BY count DESC
      LIMIT 10
    `);

    // ─── Top Liked ────────────────────────────────────────────────────────────
    const topLikedRaw = await prisma.$queryRaw<{ dishId: string; count: bigint }[]>(Prisma.sql`
      SELECT "dishId", COUNT(*) as count
      FROM "FeedInteraction"
      WHERE "action" IN ('LIKE','ANTOJO')
        AND "createdAt" >= ${dayStart} AND "createdAt" < ${dayEnd}
      GROUP BY "dishId"
      ORDER BY count DESC
      LIMIT 10
    `);

    // ─── Top Chosen (ANTOJO only) ─────────────────────────────────────────────
    const topChosenRaw = await prisma.$queryRaw<{ dishId: string; count: bigint }[]>(Prisma.sql`
      SELECT "dishId", COUNT(*) as count
      FROM "FeedInteraction"
      WHERE "action" = 'ANTOJO'
        AND "createdAt" >= ${dayStart} AND "createdAt" < ${dayEnd}
      GROUP BY "dishId"
      ORDER BY count DESC
      LIMIT 10
    `);

    // ─── Top Saved ────────────────────────────────────────────────────────────
    const topSavedRaw = await prisma.$queryRaw<{ dishId: string; count: bigint }[]>(Prisma.sql`
      SELECT "dishId", COUNT(*) as count
      FROM "FeedInteraction"
      WHERE "action" IN ('SAVE','ANTOJO')
        AND "createdAt" >= ${dayStart} AND "createdAt" < ${dayEnd}
      GROUP BY "dishId"
      ORDER BY count DESC
      LIMIT 10
    `);

    // Collect all unique dishIds
    const allDishIds = Array.from(
      new Set([
        ...topViewedRaw.map((r) => r.dishId),
        ...topLikedRaw.map((r) => r.dishId),
        ...topChosenRaw.map((r) => r.dishId),
        ...topSavedRaw.map((r) => r.dishId),
      ]),
    );

    // Fetch dish details for all of them
    const dishes =
      allDishIds.length > 0
        ? await prisma.dish.findMany({
            where: { id: { in: allDishIds } },
            select: {
              id: true,
              name: true,
              photos: true,
              restaurant: { select: { name: true } },
            },
          })
        : [];

    const dishMap = new Map(dishes.map((d) => [d.id, d]));

    function buildTopList(raw: { dishId: string; count: bigint }[]) {
      return raw.map((r) => {
        const d = dishMap.get(r.dishId);
        return {
          dishId: r.dishId,
          dishName: d?.name ?? "—",
          restaurantName: d?.restaurant?.name ?? "—",
          count: Number(r.count),
          photoUrl: d?.photos?.[0] ?? null,
        };
      });
    }

    const topViewed = buildTopList(topViewedRaw);
    const topLiked = buildTopList(topLikedRaw);
    const topChosen = buildTopList(topChosenRaw);
    const topSaved = buildTopList(topSavedRaw);

    // ─── Searches ─────────────────────────────────────────────────────────────
    let searches: { query: string; count: number }[] = [];
    try {
      const searchRaw = await prisma.$queryRaw<{ query: string; count: bigint }[]>(Prisma.sql`
        SELECT "query", COUNT(*) as count
        FROM "FeedSearchLog"
        WHERE "createdAt" >= ${dayStart} AND "createdAt" < ${dayEnd}
        GROUP BY "query"
        ORDER BY count DESC
        LIMIT 30
      `);
      searches = searchRaw.map((r) => ({ query: r.query, count: Number(r.count) }));
    } catch {
      // Table might not exist yet
    }

    // ─── Hourly ───────────────────────────────────────────────────────────────
    // Extract hour in Chile time (UTC-4)
    const hourlyRaw = await prisma.$queryRaw<{ hour: number; count: bigint }[]>(Prisma.sql`
      SELECT EXTRACT(HOUR FROM ("createdAt" AT TIME ZONE 'America/Santiago'))::int as hour,
             COUNT(*) as count
      FROM "FeedInteraction"
      WHERE "createdAt" >= ${dayStart} AND "createdAt" < ${dayEnd}
      GROUP BY hour
      ORDER BY hour ASC
    `);

    const hourly = Array.from({ length: 24 }, (_, h) => {
      const found = hourlyRaw.find((r) => Number(r.hour) === h);
      return { hour: h, count: Number(found?.count ?? 0) };
    });

    return NextResponse.json({
      stats,
      topViewed,
      topLiked,
      topChosen,
      topSaved,
      searches,
      hourly,
    });
  } catch (error) {
    console.error("[Admin quierocomer]", error);
    return NextResponse.json({ error: "Error al cargar datos" }, { status: 500 });
  }
}
