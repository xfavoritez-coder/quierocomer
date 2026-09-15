import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPopularDishes } from "@/lib/qr/utils/getPopularDishes";
import { fetchToteatSales } from "@/lib/toteat/fetchSales";

const HORUS_SLUG = "horusvegan";

const STOPWORDS = ["roll", "rolls", "sushi", "extra", "porcion", "porción", "salsa", "jugos", "natural", "fresco", "fresca", "del", "de", "la", "el", "los", "las", "y", "con"];
function normalize(s: string): string {
  if (!s) return "";
  let v = s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  for (const sw of STOPWORDS) v = v.replace(new RegExp(`\\b${sw}\\b`, "g"), " ");
  return v.replace(/\s+/g, " ").trim();
}
function score(a: string, b: string): number {
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

export async function GET() {
  const restaurant = await prisma.restaurant.findUnique({ where: { slug: HORUS_SLUG }, select: { id: true, name: true } });
  if (!restaurant) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });

  // 1. Get current popular list (rolling 48h algo)
  const popular = await getPopularDishes(restaurant.id);
  const popularIds = new Set([...(popular.global || []), ...(popular.byCategory || [])].map((p) => p.dishId));

  // 2. Get all active dishes + which are RECOMMENDED
  const dishes = await prisma.dish.findMany({
    where: { restaurantId: restaurant.id, isActive: true, deletedAt: null },
    select: { id: true, name: true, photos: true, tags: true, toteatProductId: true, category: { select: { name: true } } },
  });
  const recommendedIds = new Set(dishes.filter((d) => d.tags.includes("RECOMMENDED")).map((d) => d.id));

  // 3. Fetch Toteat sales today (cached, shared with other routes)
  const toteat = await fetchToteatSales();
  const sales = toteat.data || [];

  // 4. Aggregate sales per Toteat product
  const byCode = new Map<string, { id: string; name: string; quantity: number; revenue: number }>();
  for (const s of sales) for (const p of s.products || []) {
    const ex = byCode.get(p.id);
    if (ex) { ex.quantity += p.quantity || 0; ex.revenue += p.payed || 0; }
    else byCode.set(p.id, { id: p.id, name: p.name, quantity: p.quantity || 0, revenue: p.payed || 0 });
  }
  const toteatNorm = Array.from(byCode.values()).map((e) => ({ norm: normalize(e.name), entry: e }));

  // 5. Match each QC dish to Toteat: prefer explicit toteatProductId,
  // fall back to fuzzy name match for unmapped dishes.
  const enriched = dishes.map((dish) => {
    let matched: { id: string; name: string; quantity: number; revenue: number } | null = null;
    if (dish.toteatProductId) {
      const explicit = byCode.get(dish.toteatProductId);
      if (explicit) matched = explicit;
    }
    if (!matched) {
      const dnorm = normalize(dish.name);
      let best: { norm: string; entry: any } | null = null;
      let bestScore = 0;
      for (const t of toteatNorm) {
        const s = score(dnorm, t.norm);
        if (s > bestScore) { bestScore = s; best = t; }
      }
      if (best && bestScore >= 60) matched = best.entry;
    }
    return {
      qcDishId: dish.id,
      name: dish.name,
      photo: dish.photos?.[0] || null,
      category: dish.category?.name || null,
      isPopular: popularIds.has(dish.id),
      isRecommended: recommendedIds.has(dish.id),
      sales: matched?.quantity || 0,
      revenue: matched?.revenue || 0,
      matched: !!matched,
    };
  });

  // 6. Compute stats for both badges
  const totalSales = enriched.reduce((s, d) => s + d.sales, 0);
  const sortedBySales = [...enriched].sort((a, b) => b.sales - a.sales);
  const topSellerIds = new Set(sortedBySales.slice(0, 10).filter((d) => d.sales > 0).map((d) => d.qcDishId));

  const computeStats = (predicate: (d: typeof enriched[0]) => boolean) => {
    const inGroup = enriched.filter(predicate);
    const outGroup = enriched.filter((d) => !predicate(d) && d.matched);
    const inSold = inGroup.filter((d) => d.sales > 0).length;
    const inAlsoTop = inGroup.filter((d) => topSellerIds.has(d.qcDishId)).length;
    const avgIn = inGroup.length > 0 ? inGroup.reduce((s, d) => s + d.sales, 0) / inGroup.length : 0;
    const avgOut = outGroup.length > 0 ? outGroup.reduce((s, d) => s + d.sales, 0) / outGroup.length : 0;
    const lift = avgOut > 0 ? Math.round(((avgIn - avgOut) / avgOut) * 100) : null;
    const totalIn = inGroup.reduce((s, d) => s + d.sales, 0);
    const sharePct = totalSales > 0 ? Math.round((totalIn / totalSales) * 100) : 0;
    return {
      count: inGroup.length,
      sold: inSold,
      alsoTopSeller: inAlsoTop,
      hitRate: inGroup.length > 0 ? Math.round((inAlsoTop / inGroup.length) * 100) : 0,
      avgSalesIn: Math.round(avgIn * 10) / 10,
      avgSalesOut: Math.round(avgOut * 10) / 10,
      lift,
      sharePct,
      items: inGroup
        .map((d) => ({ qcDishId: d.qcDishId, name: d.name, category: d.category, photo: d.photo, sales: d.sales, revenue: d.revenue, matched: d.matched }))
        .sort((a, b) => b.sales - a.sales),
    };
  };

  return NextResponse.json({
    date: new Date().toISOString().slice(0, 10),
    restaurant: restaurant.name,
    totalSales,
    topSellerIds: Array.from(topSellerIds),
    popular: computeStats((d) => d.isPopular),
    recommended: computeStats((d) => d.isRecommended),
  });
}
