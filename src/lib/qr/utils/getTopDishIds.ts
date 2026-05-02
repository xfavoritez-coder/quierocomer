/**
 * Returns the dish IDs that should carry the "🔥 Top hoy" badge.
 *
 * Logic (single badge, smart underlying source):
 *  1. If the restaurant has Toteat data with at least MIN_SALES units sold
 *     today → use real sales data (most ordered dishes).
 *  2. Otherwise → fall back to the QC popularity algorithm (most viewed).
 *
 * Customers see one badge regardless of source. Owners can see the
 * underlying breakdown in /panel/analytics.
 */

import { prisma } from "@/lib/prisma";
import { chileStartOfTodayUTC } from "@/lib/toteat/timezone";
import { getPopularDishes } from "./getPopularDishes";

const MIN_SALES_FOR_TOTEAT = 5;       // need at least 5 units sold today to use Toteat
const MAX_TOP = 10;                   // max badges global
const MAX_PER_CATEGORY = 2;           // spread badges across menu

export interface TopDishesResult {
  dishIds: Set<string>;
  source: "toteat" | "qc-views" | "none";
  totalSalesToday: number;
}

export async function getTopDishIds(restaurantId: string): Promise<TopDishesResult> {
  // 1. Try Toteat sales for today
  const todayStart = chileStartOfTodayUTC();
  const sales = await prisma.toteatSale.findMany({
    where: { restaurantId, dateClosed: { gte: todayStart } },
    select: {
      products: {
        select: { toteatProductId: true, quantity: true },
      },
    },
  });

  let totalUnits = 0;
  const byCode = new Map<string, number>();
  for (const sale of sales) {
    for (const p of sale.products) {
      const q = p.quantity || 0;
      totalUnits += q;
      byCode.set(p.toteatProductId, (byCode.get(p.toteatProductId) || 0) + q);
    }
  }

  if (totalUnits >= MIN_SALES_FOR_TOTEAT && byCode.size > 0) {
    // Map Toteat codes back to QC dish IDs via Dish.toteatProductId
    const codes = Array.from(byCode.keys());
    const dishes = await prisma.dish.findMany({
      where: {
        restaurantId,
        isActive: true,
        deletedAt: null,
        toteatProductId: { in: codes },
      },
      select: { id: true, toteatProductId: true, categoryId: true },
    });

    // Score and rank
    const scored = dishes
      .map((d) => ({
        dishId: d.id,
        categoryId: d.categoryId,
        qty: byCode.get(d.toteatProductId!) || 0,
      }))
      .filter((d) => d.qty > 0)
      .sort((a, b) => b.qty - a.qty);

    // Take top with category cap
    const catCounts = new Map<string, number>();
    const result = new Set<string>();
    for (const d of scored) {
      if (result.size >= MAX_TOP) break;
      const cc = catCounts.get(d.categoryId) ?? 0;
      if (cc >= MAX_PER_CATEGORY) continue;
      catCounts.set(d.categoryId, cc + 1);
      result.add(d.dishId);
    }

    if (result.size > 0) {
      return { dishIds: result, source: "toteat", totalSalesToday: totalUnits };
    }
  }

  // 2. Fallback: QC views-based popularity
  const popular = await getPopularDishes(restaurantId);
  const fallbackIds = new Set<string>([
    ...(popular.global || []).map((p) => p.dishId),
    ...(popular.byCategory || []).map((p) => p.dishId),
  ]);
  return {
    dishIds: fallbackIds,
    source: fallbackIds.size > 0 ? "qc-views" : "none",
    totalSalesToday: totalUnits,
  };
}
