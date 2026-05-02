/**
 * Maps QC dishes to Toteat product codes (e.g. "HV0010") so we can
 * attribute Toteat sales back to QC dishes accurately.
 *
 * Strategy:
 * 1. Auto-match by normalized name (lowercase, no accents, stopwords removed)
 * 2. Score = exact match 100, contains 80, token overlap up to 70
 * 3. score >= 70 → save as match (auto)
 * 4. score 50-69 → "candidate" (suggest in UI, owner confirms)
 * 5. score < 50 → unmapped
 */

import { prisma } from "@/lib/prisma";

const STOPWORDS = [
  "roll", "rolls", "sushi", "extra", "porcion", "porción",
  "salsa", "jugos", "natural", "fresco", "fresca",
  "del", "de", "la", "el", "los", "las", "y", "con",
];

export function normalizeName(s: string | null | undefined): string {
  if (!s) return "";
  let v = s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (const sw of STOPWORDS) {
    v = v.replace(new RegExp(`\\b${sw}\\b`, "g"), " ");
  }
  return v.replace(/\s+/g, " ").trim();
}

export function nameSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 80;
  const sa = new Set(a.split(" ").filter(Boolean));
  const sb = new Set(b.split(" ").filter(Boolean));
  if (sa.size === 0 || sb.size === 0) return 0;
  let common = 0;
  for (const t of sa) if (sb.has(t)) common++;
  return Math.round((common / Math.max(sa.size, sb.size)) * 70);
}

export interface ToteatProductCandidate {
  toteatProductId: string;
  name: string;
  hierarchyName: string | null;
  lastSold?: Date;
  totalSold?: number;
}

/**
 * Returns the universe of Toteat products we can map to, derived from
 * cached ToteatSaleProduct rows. Limited to products sold within the last
 * 30 days unless `windowDays` overridden.
 */
export async function getToteatProductCatalog(
  restaurantId: string,
  windowDays: number = 30
): Promise<ToteatProductCandidate[]> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const grouped = await prisma.toteatSaleProduct.groupBy({
    by: ["toteatProductId", "productName", "hierarchyName"],
    where: {
      sale: { restaurantId, dateClosed: { gte: since } },
    },
    _count: { _all: true },
    _max: { id: true },
  });

  // For "lastSold", a separate findMany would be needed; skip for v1 (we use _count as proxy).
  return grouped.map((g) => ({
    toteatProductId: g.toteatProductId,
    name: g.productName,
    hierarchyName: g.hierarchyName,
    totalSold: g._count?._all ?? 0,
  }));
}

export interface MappingResult {
  dishId: string;
  dishName: string;
  toteatProductId: string | null;
  toteatName: string | null;
  score: number;
  status: "matched" | "candidate" | "unmapped";
}

/**
 * Auto-maps every UNMAPPED dish for a restaurant.
 * Already-mapped dishes are skipped (idempotent — won't overwrite manual mappings).
 * Returns the list of decisions taken.
 */
export async function autoMapRestaurantDishes(
  restaurantId: string,
  opts: { confidenceFloor?: number; force?: boolean } = {}
): Promise<MappingResult[]> {
  const floor = opts.confidenceFloor ?? 70;
  const dishes = await prisma.dish.findMany({
    where: {
      restaurantId,
      isActive: true,
      deletedAt: null,
      ...(opts.force ? {} : { toteatProductId: null }),
    },
    select: { id: true, name: true },
  });
  const catalog = await getToteatProductCatalog(restaurantId);

  // Pre-normalize once
  const normalizedCatalog = catalog.map((c) => ({ ...c, norm: normalizeName(c.name) }));

  const results: MappingResult[] = [];

  for (const dish of dishes) {
    const dishNorm = normalizeName(dish.name);
    let best: { entry: typeof normalizedCatalog[0]; score: number } | null = null;
    for (const c of normalizedCatalog) {
      const s = nameSimilarity(dishNorm, c.norm);
      if (!best || s > best.score) best = { entry: c, score: s };
    }

    if (best && best.score >= floor) {
      await prisma.dish.update({
        where: { id: dish.id },
        data: {
          toteatProductId: best.entry.toteatProductId,
          toteatMappedAt: new Date(),
          toteatMappedBy: "auto",
        },
      });
      results.push({
        dishId: dish.id,
        dishName: dish.name,
        toteatProductId: best.entry.toteatProductId,
        toteatName: best.entry.name,
        score: best.score,
        status: "matched",
      });
    } else if (best && best.score >= 50) {
      results.push({
        dishId: dish.id,
        dishName: dish.name,
        toteatProductId: best.entry.toteatProductId,
        toteatName: best.entry.name,
        score: best.score,
        status: "candidate",
      });
    } else {
      results.push({
        dishId: dish.id,
        dishName: dish.name,
        toteatProductId: null,
        toteatName: null,
        score: best?.score ?? 0,
        status: "unmapped",
      });
    }
  }

  return results;
}

/**
 * Loads "best candidate" suggestions for a list of unmapped dishes.
 * Used by the admin UI to pre-populate the dropdown with the smartest guess.
 */
export async function suggestCandidatesForDishes(
  restaurantId: string,
  dishIds: string[]
): Promise<Record<string, { score: number; toteatProductId: string; name: string } | null>> {
  if (dishIds.length === 0) return {};
  const dishes = await prisma.dish.findMany({
    where: { id: { in: dishIds }, restaurantId },
    select: { id: true, name: true },
  });
  const catalog = await getToteatProductCatalog(restaurantId);
  const normalizedCatalog = catalog.map((c) => ({ ...c, norm: normalizeName(c.name) }));

  const out: Record<string, { score: number; toteatProductId: string; name: string } | null> = {};
  for (const dish of dishes) {
    const dishNorm = normalizeName(dish.name);
    let best: { entry: typeof normalizedCatalog[0]; score: number } | null = null;
    for (const c of normalizedCatalog) {
      const s = nameSimilarity(dishNorm, c.norm);
      if (!best || s > best.score) best = { entry: c, score: s };
    }
    out[dish.id] = best
      ? { score: best.score, toteatProductId: best.entry.toteatProductId, name: best.entry.name }
      : null;
  }
  return out;
}
