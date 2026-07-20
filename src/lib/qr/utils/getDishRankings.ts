import { prisma } from "@/lib/prisma";
import { chileDayBoundsUTC, chileTodayISODate } from "@/lib/toteat/timezone";

const VIEW_DETAIL_MS_MIN = 3000;
const VIEWS_WINDOW_DAYS = 7;
// Adaptive thresholds for "Lo más pedido" sort. Below these, the data is
// noisy enough that we just don't offer the option.
const SALES_TODAY_MIN = 5;
const SALES_WEEK_MIN = 20;

export type SalesMode = "today" | "week" | null;

export interface DishRankings {
  /** detail-modal opens per dishId in the last N days (3s+ to count). */
  views: Record<string, number>;
  /** Adaptive sales window: today if there are enough sales, else last 7
   * days if those have enough, else null (option not offered to the user). */
  sales: {
    mode: SalesMode;
    byDish: Record<string, number>;
    total: number;
  };
}

async function getDishSalesInRange(restaurantId: string, from: Date, to: Date): Promise<Record<string, number>> {
  const sales = await prisma.toteatSale.findMany({
    where: { restaurantId, dateClosed: { gte: from, lte: to } },
    select: { products: { select: { toteatProductId: true, quantity: true } } },
  });
  const toteatByCode = new Map<string, number>();
  for (const s of sales) for (const p of s.products) {
    toteatByCode.set(p.toteatProductId, (toteatByCode.get(p.toteatProductId) || 0) + (p.quantity || 0));
  }
  if (toteatByCode.size === 0) return {};

  // Map Toteat codes back to QC dishes (direct + via modifier options)
  const dishes = await prisma.dish.findMany({
    where: { restaurantId, isActive: true, deletedAt: null },
    select: {
      id: true, toteatProductId: true,
      modifierTemplates: {
        select: {
          groups: {
            select: {
              options: {
                where: { toteatProductId: { not: null } },
                select: { toteatProductId: true },
              },
            },
          },
        },
      },
    },
  });
  const byDish: Record<string, number> = {};
  for (const d of dishes) {
    let qty = 0;
    if (d.toteatProductId) qty += toteatByCode.get(d.toteatProductId) || 0;
    for (const tpl of d.modifierTemplates) {
      for (const grp of tpl.groups) {
        for (const opt of grp.options) {
          if (opt.toteatProductId) qty += toteatByCode.get(opt.toteatProductId) || 0;
        }
      }
    }
    if (qty > 0) byDish[d.id] = qty;
  }
  return byDish;
}

export async function getDishRankings(restaurantId: string): Promise<DishRankings> {
  // 1. Views: count distinct sessions per dish that opened the modal in last N days.
  // Aggregated in DB via JSONB to avoid transferring thousands of session rows.
  const viewsSince = new Date(Date.now() - VIEWS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const viewRows = await prisma.$queryRaw<{ dishId: string; count: number }[]>`
    SELECT elem->>'dishId' AS "dishId", COUNT(DISTINCT s.id)::int AS count
    FROM "Session" s,
         jsonb_array_elements(s."dishesViewed") AS elem
    WHERE s."restaurantId" = ${restaurantId}
      AND s."startedAt" >= ${viewsSince}
      AND elem->>'dishId' IS NOT NULL
      AND (elem->>'detailMs')::int >= ${VIEW_DETAIL_MS_MIN}
    GROUP BY elem->>'dishId'
  `;
  const views: Record<string, number> = {};
  for (const row of viewRows) {
    views[row.dishId] = Number(row.count);
  }

  // 2. Sales: adaptive — today if ≥5, else 7d if ≥20, else not offered.
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { toteatApiToken: true },
  });
  let salesMode: SalesMode = null;
  let salesByDish: Record<string, number> = {};
  let salesTotal = 0;

  if (restaurant?.toteatApiToken) {
    const { from: todayFrom, to: todayTo } = chileDayBoundsUTC(chileTodayISODate());
    const todaySales = await getDishSalesInRange(restaurantId, todayFrom, todayTo);
    const todayTotal = Object.values(todaySales).reduce((s, q) => s + q, 0);
    if (todayTotal >= SALES_TODAY_MIN) {
      salesMode = "today";
      salesByDish = todaySales;
      salesTotal = todayTotal;
    } else {
      const weekFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const weekSales = await getDishSalesInRange(restaurantId, weekFrom, new Date());
      const weekTotal = Object.values(weekSales).reduce((s, q) => s + q, 0);
      if (weekTotal >= SALES_WEEK_MIN) {
        salesMode = "week";
        salesByDish = weekSales;
        salesTotal = weekTotal;
      }
    }
  }

  return { views, sales: { mode: salesMode, byDish: salesByDish, total: salesTotal } };
}
