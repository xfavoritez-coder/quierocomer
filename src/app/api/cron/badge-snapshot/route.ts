import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPopularDishes } from "@/lib/qr/utils/getPopularDishes";

/**
 * Periodic snapshot of which dishes have which badges (POPULAR + RECOMMENDED).
 * Runs every 30 min (cron). Allows retroactive analysis of whether a badge
 * present at hour X correlated with sales at hour X+ε.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const restaurants = await prisma.restaurant.findMany({
    where: { isActive: true },
    select: { id: true, slug: true },
  });

  const results: any[] = [];
  for (const r of restaurants) {
    let saved = 0;
    try {
      // POPULAR: run the same algorithm the carta uses, snapshot result
      const popular = await getPopularDishes(r.id);
      const popularList = [...(popular.global || []), ...(popular.byCategory || [])];
      for (let i = 0; i < popularList.length; i++) {
        const p = popularList[i];
        await prisma.badgeSnapshot.create({
          data: {
            restaurantId: r.id,
            dishId: p.dishId,
            badgeType: "POPULAR",
            score: p.score,
            position: i + 1,
          },
        });
        saved++;
      }

      // RECOMMENDED: dishes currently tagged by the owner
      const recommended = await prisma.dish.findMany({
        where: { restaurantId: r.id, isActive: true, deletedAt: null, tags: { has: "RECOMMENDED" } },
        select: { id: true },
      });
      for (const d of recommended) {
        await prisma.badgeSnapshot.create({
          data: { restaurantId: r.id, dishId: d.id, badgeType: "RECOMMENDED" },
        });
        saved++;
      }

      results.push({ slug: r.slug, ok: true, saved });
    } catch (e: any) {
      results.push({ slug: r.slug, ok: false, error: e?.message || "unknown" });
    }
  }

  return NextResponse.json({ ok: true, capturedAt: new Date().toISOString(), restaurants: results });
}
