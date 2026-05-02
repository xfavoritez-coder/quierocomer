import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin, getOwnedRestaurantIds } from "@/lib/adminAuth";

/**
 * Cross-system analysis: how QC-side interest (views + detail dwells)
 * relates to Toteat-side reality (units actually sold).
 *
 * Per dish: views, detail opens, sold, conversionPct (sold / views).
 * Insights: 👻 fantasma (highly viewed, never sold), 🎯 estrella (high conv),
 * 📦 huérfanos (sold in Toteat but not in QC menu).
 *
 * Query params: ?restaurantId=...&from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const restaurantIdParam = req.nextUrl.searchParams.get("restaurantId");
  const fromStr = req.nextUrl.searchParams.get("from");
  const toStr = req.nextUrl.searchParams.get("to");

  let restaurantId = restaurantIdParam;
  if (!isSuperAdmin(req)) {
    const ownedIds = await getOwnedRestaurantIds(req);
    if (!ownedIds || ownedIds.length === 0) {
      return NextResponse.json({ error: "No tienes restaurantes asignados" }, { status: 403 });
    }
    if (restaurantIdParam && !ownedIds.includes(restaurantIdParam)) {
      return NextResponse.json({ error: "No tienes acceso a este local" }, { status: 403 });
    }
    if (!restaurantIdParam) restaurantId = ownedIds[0];
  }

  if (!restaurantId) {
    return NextResponse.json({ error: "restaurantId requerido (modo super-admin)" }, { status: 400 });
  }

  const to = toStr ? new Date(toStr + "T23:59:59.999Z") : new Date();
  const from = fromStr ? new Date(fromStr + "T00:00:00.000Z") : new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);

  // 1. Cached Toteat sales for the window
  const sales = await prisma.toteatSale.findMany({
    where: { restaurantId, dateClosed: { gte: from, lte: to } },
    select: { products: { select: { toteatProductId: true, productName: true, hierarchyName: true, quantity: true, payed: true } } },
  });

  const toteatByCode = new Map<string, { id: string; name: string; quantity: number; revenue: number; category: string | null }>();
  for (const s of sales) for (const p of s.products) {
    const ex = toteatByCode.get(p.toteatProductId);
    if (ex) { ex.quantity += p.quantity || 0; ex.revenue += p.payed || 0; }
    else toteatByCode.set(p.toteatProductId, { id: p.toteatProductId, name: p.productName, quantity: p.quantity || 0, revenue: p.payed || 0, category: p.hierarchyName });
  }

  // 2. QC dishes with mapping
  const dishes = await prisma.dish.findMany({
    where: { restaurantId, isActive: true, deletedAt: null },
    select: { id: true, name: true, photos: true, toteatProductId: true, category: { select: { name: true } } },
  });

  // 3. QC views in window
  const sessions = await prisma.session.findMany({
    where: { restaurantId, startedAt: { gte: from, lte: to } },
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

  // 4. Cross via toteatProductId
  const matchedToteatIds = new Set<string>();
  const rows = dishes.map((dish) => {
    const matched = dish.toteatProductId ? toteatByCode.get(dish.toteatProductId) : null;
    if (matched) matchedToteatIds.add(matched.id);
    const qc = qcByDishId.get(dish.id) || { views: 0, details: 0, totalDetailMs: 0 };
    return {
      dishId: dish.id,
      name: dish.name,
      category: dish.category?.name || null,
      photo: dish.photos?.[0] || null,
      mapped: !!dish.toteatProductId,
      qcViews: qc.views,
      qcDetails: qc.details,
      avgDetailMs: qc.details > 0 ? Math.round(qc.totalDetailMs / qc.details) : 0,
      sales: matched?.quantity || 0,
      revenue: matched?.revenue || 0,
      conversionPct: qc.views > 0 ? Math.round(((matched?.quantity || 0) / qc.views) * 100) : null,
    };
  });

  // 5. Orphans: sold in Toteat, not mapped to any dish
  const orphans = Array.from(toteatByCode.values())
    .filter((p) => !matchedToteatIds.has(p.id) && p.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity)
    .map((p) => ({ toteatId: p.id, name: p.name, category: p.category, sales: p.quantity, revenue: p.revenue }));

  // 6. Insights
  const fantasmas = rows
    .filter((r) => r.qcViews >= 5 && r.sales === 0 && r.mapped) // mapped but never sold
    .sort((a, b) => b.qcViews - a.qcViews)
    .slice(0, 8);
  const estrellas = rows
    .filter((r) => r.qcViews >= 5 && r.sales > 0 && (r.conversionPct ?? 0) >= 25)
    .sort((a, b) => (b.conversionPct ?? 0) - (a.conversionPct ?? 0))
    .slice(0, 5);
  const totalQcViews = rows.reduce((s, r) => s + r.qcViews, 0);
  const totalSales = rows.reduce((s, r) => s + r.sales, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const matchedCount = rows.filter((r) => r.mapped).length;

  rows.sort((a, b) => b.sales - a.sales);

  return NextResponse.json({
    range: { from: from.toISOString(), to: to.toISOString() },
    summary: {
      totalDishes: rows.length,
      mappedDishes: matchedCount,
      mappedPct: rows.length > 0 ? Math.round((matchedCount / rows.length) * 100) : 0,
      totalQcViews,
      totalSales,
      totalRevenue,
      orphanCount: orphans.length,
    },
    insights: { fantasmas, estrellas },
    rows,
    orphans,
  });
}
