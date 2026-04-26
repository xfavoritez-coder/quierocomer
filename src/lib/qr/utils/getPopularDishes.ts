import { prisma } from "@/lib/prisma";

export interface PopularDish {
  dishId: string;
  score: number;
}

export async function getPopularDishes(restaurantId: string): Promise<PopularDish[]> {
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const sessions = await prisma.session.findMany({
    where: { restaurantId, startedAt: { gte: since } },
    orderBy: { startedAt: "desc" },
    select: { dishesViewed: true },
  });

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

  return [...sessionCounts.entries()]
    .filter(([, count]) => count >= 3)
    .map(([dishId, count]) => ({ dishId, score: count + (dwellBonus.get(dishId) ?? 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
