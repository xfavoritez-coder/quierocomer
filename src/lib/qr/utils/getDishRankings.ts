import { prisma } from "@/lib/prisma";

const VIEW_DETAIL_MS_MIN = 3000;
const VIEWS_WINDOW_DAYS = 7;

export type SalesMode = null;

export interface DishRankings {
  /** detail-modal opens per dishId in the last N days (3s+ to count). */
  views: Record<string, number>;
  /** Sales always null — Toteat integration removed. */
  sales: {
    mode: SalesMode;
    byDish: Record<string, number>;
    total: number;
  };
}

export async function getDishRankings(restaurantId: string): Promise<DishRankings> {
  // Views: count distinct sessions per dish that opened the modal in last N days.
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

  return { views, sales: { mode: null, byDish: {}, total: 0 } };
}
