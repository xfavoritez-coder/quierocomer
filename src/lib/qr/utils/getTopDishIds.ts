/**
 * Returns the dish IDs that should carry the "🔥 Top hoy" badge.
 *
 * Uses the QC popularity algorithm (most viewed).
 */

import { unstable_cache } from "next/cache";
import { getPopularDishes } from "./getPopularDishes";

export interface TopDishesResult {
  dishIds: Set<string>;
  source: "qc-views" | "none";
  totalSalesToday: number;
}

export async function getTopDishIds(restaurantId: string): Promise<TopDishesResult> {
  const popular = await getPopularDishes(restaurantId);
  const dishIds = new Set<string>([
    ...(popular.global || []).map((p) => p.dishId),
    ...(popular.byCategory || []).map((p) => p.dishId),
  ]);
  return {
    dishIds,
    source: dishIds.size > 0 ? "qc-views" : "none",
    totalSalesToday: 0,
  };
}

/**
 * Cached version — 5 min TTL, invalidated when restaurant changes.
 * Returns dishIds as string[] (Set can't be JSON-serialized).
 * Reconstruct Set at call site: new Set(result.dishIds)
 */
export const getCachedTopDishIds = unstable_cache(
  async (restaurantId: string): Promise<{ dishIds: string[]; source: "qc-views" | "none"; totalSalesToday: number }> => {
    const result = await getTopDishIds(restaurantId);
    return { dishIds: Array.from(result.dishIds), source: result.source, totalSalesToday: result.totalSalesToday };
  },
  ["qr-top-dishes"],
  { revalidate: 300 }
);
