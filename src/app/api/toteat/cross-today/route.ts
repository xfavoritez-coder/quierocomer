import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchToteatSales } from "@/lib/toteat/fetchSales";

const HORUS_SLUG = "horusvegan";

const STOPWORDS = ["roll", "rolls", "sushi", "extra", "porcion", "porción", "salsa", "jugos", "natural", "fresco", "fresca", "del", "de", "la", "el", "los", "las", "y", "con"];

function normalize(s: string): string {
  if (!s) return "";
  let v = s.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (const sw of STOPWORDS) {
    v = v.replace(new RegExp(`\\b${sw}\\b`, "g"), " ");
  }
  return v.replace(/\s+/g, " ").trim();
}

function score(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 80;
  // Token overlap
  const sa = new Set(a.split(" ").filter(Boolean));
  const sb = new Set(b.split(" ").filter(Boolean));
  if (sa.size === 0 || sb.size === 0) return 0;
  let common = 0;
  for (const t of sa) if (sb.has(t)) common++;
  return Math.round((common / Math.max(sa.size, sb.size)) * 70);
}

export async function GET() {
  const toteat = await fetchToteatSales();
  const sales = toteat.data || [];

  // Aggregate Toteat by product code
  const toteatByCode = new Map<string, { id: string; name: string; quantity: number; revenue: number; category: string | null }>();
  for (const sale of sales) {
    for (const p of sale.products || []) {
      const ex = toteatByCode.get(p.id);
      if (ex) {
        ex.quantity += p.quantity || 0;
        ex.revenue += p.payed || 0;
      } else {
        toteatByCode.set(p.id, { id: p.id, name: p.name, quantity: p.quantity || 0, revenue: p.payed || 0, category: p.hierarchyName || null });
      }
    }
  }

  // Get Horus restaurant + active dishes
  const restaurant = await prisma.restaurant.findUnique({ where: { slug: HORUS_SLUG }, select: { id: true, name: true } });
  if (!restaurant) {
    return NextResponse.json({ error: `Restaurant '${HORUS_SLUG}' not found in QC DB` }, { status: 404 });
  }
  const dishes = await prisma.dish.findMany({
    where: { restaurantId: restaurant.id, isActive: true, deletedAt: null },
    select: { id: true, name: true, price: true, photos: true, category: { select: { name: true } } },
  });

  // Aggregate QC views from today's sessions
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const sessions = await prisma.session.findMany({
    where: { restaurantId: restaurant.id, startedAt: { gte: startOfDay } },
    select: { dishesViewed: true },
  });
  const qcByDishId = new Map<string, { views: number; details: number; totalDetailMs: number }>();
  for (const s of sessions) {
    const viewed = s.dishesViewed as any[];
    if (!Array.isArray(viewed)) continue;
    for (const d of viewed) {
      if (!d.dishId) continue;
      const ex = qcByDishId.get(d.dishId) || { views: 0, details: 0, totalDetailMs: 0 };
      ex.views++;
      if (d.detailMs && d.detailMs > 0) {
        ex.details++;
        ex.totalDetailMs += d.detailMs;
      }
      qcByDishId.set(d.dishId, ex);
    }
  }

  // Pre-normalize Toteat product names
  const toteatByNorm: { norm: string; entry: { id: string; name: string; quantity: number; revenue: number; category: string | null } }[] = [];
  for (const entry of toteatByCode.values()) {
    toteatByNorm.push({ norm: normalize(entry.name), entry });
  }

  // Match each QC dish to best Toteat product
  const matchedToteatIds = new Set<string>();
  const rows = dishes.map((dish) => {
    const dishNorm = normalize(dish.name);
    let best: { norm: string; entry: any } | null = null;
    let bestScore = 0;
    for (const t of toteatByNorm) {
      const s = score(dishNorm, t.norm);
      if (s > bestScore) {
        bestScore = s;
        best = t;
      }
    }
    const matched = bestScore >= 60 ? best!.entry : null;
    if (matched) matchedToteatIds.add(matched.id);
    const qc = qcByDishId.get(dish.id) || { views: 0, details: 0, totalDetailMs: 0 };
    return {
      qcDishId: dish.id,
      name: dish.name,
      category: dish.category?.name || null,
      photo: dish.photos?.[0] || null,
      qcViews: qc.views,
      qcDetails: qc.details,
      avgDetailMs: qc.details > 0 ? Math.round(qc.totalDetailMs / qc.details) : 0,
      toteatId: matched?.id || null,
      toteatName: matched?.name || null,
      matchScore: bestScore,
      sales: matched?.quantity || 0,
      revenue: matched?.revenue || 0,
      conversionPct: qc.views > 0 && matched ? Math.round(((matched.quantity || 0) / qc.views) * 100) : null,
    };
  });

  // Toteat products that never matched a QC dish (sold but not on QC menu / different name)
  const orphans = Array.from(toteatByCode.values())
    .filter((p) => !matchedToteatIds.has(p.id) && p.quantity > 0)
    .map((p) => ({ toteatId: p.id, name: p.name, category: p.category, sales: p.quantity, revenue: p.revenue }));

  // Standout categories
  const totalQcViews = rows.reduce((s, r) => s + r.qcViews, 0);
  const totalSales = rows.reduce((s, r) => s + r.sales, 0);
  const seenNotSold = rows.filter((r) => r.qcViews >= 3 && r.sales === 0).sort((a, b) => b.qcViews - a.qcViews).slice(0, 8);
  const soldNotSeen = rows.filter((r) => r.sales > 0 && r.qcViews === 0).sort((a, b) => b.sales - a.sales).slice(0, 8);
  const bestConverters = rows
    .filter((r) => r.qcViews >= 3 && r.sales > 0)
    .sort((a, b) => (b.conversionPct || 0) - (a.conversionPct || 0))
    .slice(0, 5);

  rows.sort((a, b) => b.sales - a.sales);

  return NextResponse.json({
    date: new Date().toISOString().slice(0, 10),
    restaurant: restaurant.name,
    summary: {
      qcSessions: sessions.length,
      totalQcViews,
      totalSales,
      matched: rows.filter((r) => r.toteatId).length,
      qcDishesNotMatched: rows.filter((r) => !r.toteatId).length,
      orphanToteatProducts: orphans.length,
    },
    insights: { seenNotSold, soldNotSeen, bestConverters },
    rows,
    orphans,
  });
}
