import { prisma } from "@/lib/prisma";

export interface PopularDish {
  dishId: string;
  score: number;
}

export interface PopularResult {
  global: PopularDish[];
  byCategory: PopularDish[]; // top 1 per category, min 2 sessions
}

export async function getPopularDishes(restaurantId: string): Promise<PopularResult> {
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const [sessions, dishes] = await Promise.all([
    prisma.session.findMany({
      where: { restaurantId, startedAt: { gte: since } },
      orderBy: { startedAt: "desc" },
      select: { dishesViewed: true },
    }),
    prisma.dish.findMany({
      where: { restaurantId, isActive: true },
      select: { id: true, price: true, categoryId: true },
    }),
  ]);

  const priceMap = new Map(dishes.map(d => [d.id, d.price]));
  const categoryMap = new Map(dishes.map(d => [d.id, d.categoryId]));

  const sessionCounts = new Map<string, number>();
  const dwellBonus = new Map<string, number>();

  for (const session of sessions) {
    const viewed = session.dishesViewed as any[] | null;
    if (!Array.isArray(viewed)) continue;

    const seen = new Set<string>();
    for (const entry of viewed) {
      if (!entry?.dishId) continue;
      const detailMs = entry.detailMs ?? 0;
      if (detailMs <= 0) continue;
      if (seen.has(entry.dishId)) continue;
      seen.add(entry.dishId);
      sessionCounts.set(entry.dishId, (sessionCounts.get(entry.dishId) ?? 0) + 1);
      if (detailMs >= 5000) {
        dwellBonus.set(entry.dishId, (dwellBonus.get(entry.dishId) ?? 0) + 1);
      }
    }
  }

  // Score = sessions + dwell bonus. At equal scores, higher price wins.
  const scored = [...sessionCounts.entries()]
    .map(([dishId, count]) => ({
      dishId,
      score: count + (dwellBonus.get(dishId) ?? 0),
      sessions: count,
      price: priceMap.get(dishId) ?? 0,
      categoryId: categoryMap.get(dishId) ?? "",
    }))
    .sort((a, b) => b.score - a.score || b.price - a.price);

  // Top 5 popular dishes (min 3 sessions)
  const global = scored
    .filter(d => d.sessions >= 3)
    .slice(0, 5)
    .map(d => ({ dishId: d.dishId, score: d.score }));

  return { global, byCategory: [] };
}
