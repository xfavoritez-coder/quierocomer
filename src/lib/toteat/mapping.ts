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
import { fetchToteatProducts } from "./fetchProducts";
import { ToteatCredentials } from "./fetchSales";

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

async function loadCredentialsFromRestaurant(restaurantId: string): Promise<ToteatCredentials | null> {
  const r = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { toteatRestaurantId: true, toteatLocalId: true, toteatUserId: true, toteatApiToken: true },
  });
  if (r?.toteatRestaurantId && r.toteatLocalId !== null && r.toteatUserId !== null && r.toteatApiToken) {
    return {
      base: process.env.TOTEAT_API_BASE || "https://api.toteat.com/mw/or/1.0",
      xir: r.toteatRestaurantId,
      xil: r.toteatLocalId!,
      xiu: r.toteatUserId!,
      token: r.toteatApiToken,
    };
  }
  // Dev fallback to env vars
  const base = process.env.TOTEAT_API_BASE;
  const xir = process.env.TOTEAT_RESTAURANT_ID;
  const xil = process.env.TOTEAT_LOCAL_ID;
  const xiu = process.env.TOTEAT_USER_ID;
  const token = process.env.TOTEAT_API_TOKEN;
  if (base && xir && xil && xiu && token) return { base, xir, xil, xiu, token };
  return null;
}

/**
 * Returns the FULL Toteat product catalog (all active products in the POS)
 * by hitting /products live, with the cached ToteatSaleProduct rows used
 * as a fallback if the live call fails. This is the complete universe of
 * dishes the restaurant has set up — not just those that have sold recently.
 *
 * Modifiers are excluded by default so we don't pollute the dropdown with
 * "Envuelto en palta" style options that the QC dish-level UI doesn't expose.
 */
export async function getToteatProductCatalog(
  restaurantId: string,
  opts: { includeModifiers?: boolean; windowDaysFallback?: number } = {}
): Promise<ToteatProductCandidate[]> {
  const credentials = await loadCredentialsFromRestaurant(restaurantId);
  if (credentials) {
    // activeOnly: false → returns the full catalog including products that
    // Toteat has flagged inactive but that the restaurant still has on its
    // carta. Owner reported HV0230 ("Brownie con helado") missing because
    // the activeOnly=true endpoint omitted it.
    const live = await fetchToteatProducts({ credentials, activeOnly: false });
    if (live.data && live.data.length > 0) {
      return live.data
        .filter((p) => opts.includeModifiers || !p.isModifier)
        .map((p) => ({
          toteatProductId: p.id,
          name: p.name,
          hierarchyName: p.category || null,
        }));
    }
  }

  // Fallback: derive catalog from sales we've cached locally
  const windowDays = opts.windowDaysFallback ?? 90;
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const grouped = await prisma.toteatSaleProduct.groupBy({
    by: ["toteatProductId", "productName", "hierarchyName"],
    where: { sale: { restaurantId, dateClosed: { gte: since } } },
    _count: { _all: true },
  });
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
