import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin, getOwnedRestaurantIds } from "@/lib/adminAuth";
import { chileDayBoundsUTC } from "@/lib/toteat/timezone";

/**
 * Cross-system analysis: how QC-side interest (modal opens + detail time)
 * relates to Toteat-side reality (units actually sold).
 *
 * Per dish: opens (modal opened), avgDetailMs, sold, conversionPct (sold / opens).
 * Insights: 👻 fantasma (opened but never bought), 🎯 estrella (high conv),
 * 📦 huérfanos (sold in Toteat but not in QC menu).
 *
 * "Opens" replaces the legacy "views" metric, which counted any time a dish
 * appeared in a session — including scroll-throughs that didn't reflect real
 * intent. We now only count entries with detailMs > 0 (user opened the modal).
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

  // Interpret the YYYY-MM-DD strings as Chile-local days so "Hoy" means
  // today in Chile (not UTC). Without this, UTC midnight to UTC midnight
  // includes last night's sales as "today".
  const from = fromStr ? chileDayBoundsUTC(fromStr).from : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const to = toStr ? chileDayBoundsUTC(toStr).to : new Date();

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

  // 2. QC dishes with mapping (+ modifier mappings — when a parent like
  // "Limonada Artesanal" doesn't have its own Toteat code but each flavor
  // does, we sum the modifier sales into the parent.)
  const dishes = await prisma.dish.findMany({
    where: { restaurantId, isActive: true, deletedAt: null },
    select: {
      id: true, name: true, photos: true, toteatProductId: true,
      category: { select: { name: true } },
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

  // 3. QC opens in window — only count modal opens that lasted long enough
  // to reflect real interest. Entries under 3s are taps that closed almost
  // immediately and don't represent intent.
  const MIN_DETAIL_MS = 3000;
  const sessions = await prisma.session.findMany({
    where: { restaurantId, startedAt: { gte: from, lte: to } },
    select: { dishesViewed: true },
  });
  const qcByDishId = new Map<string, { opens: number; totalDetailMs: number }>();
  for (const s of sessions) {
    const viewed = s.dishesViewed as any[];
    if (!Array.isArray(viewed)) continue;
    for (const d of viewed) {
      if (!d.dishId) continue;
      if (!d.detailMs || d.detailMs < MIN_DETAIL_MS) continue;
      const ex = qcByDishId.get(d.dishId) || { opens: 0, totalDetailMs: 0 };
      ex.opens++;
      ex.totalDetailMs += d.detailMs;
      qcByDishId.set(d.dishId, ex);
    }
  }

  // 4. Cross via toteatProductId — direct match on the dish + summed sales
  // from any modifier options that have their own Toteat codes.
  const matchedToteatIds = new Set<string>();
  const rows = dishes.map((dish) => {
    let totalQty = 0;
    let totalRevenue = 0;
    if (dish.toteatProductId) {
      const direct = toteatByCode.get(dish.toteatProductId);
      if (direct) {
        totalQty += direct.quantity;
        totalRevenue += direct.revenue;
        matchedToteatIds.add(direct.id);
      }
    }
    let modifierMatchCount = 0;
    for (const tpl of dish.modifierTemplates) {
      for (const grp of tpl.groups) {
        for (const opt of grp.options) {
          if (!opt.toteatProductId) continue;
          const modSale = toteatByCode.get(opt.toteatProductId);
          if (modSale) {
            totalQty += modSale.quantity;
            totalRevenue += modSale.revenue;
            matchedToteatIds.add(modSale.id);
            modifierMatchCount++;
          }
        }
      }
    }
    const qc = qcByDishId.get(dish.id) || { opens: 0, totalDetailMs: 0 };
    // A dish counts as "mapped" if it has either a direct Toteat code or at
    // least one mapped modifier option contributing sales.
    const mapped = !!dish.toteatProductId || modifierMatchCount > 0;
    return {
      dishId: dish.id,
      name: dish.name,
      category: dish.category?.name || null,
      photo: dish.photos?.[0] || null,
      mapped,
      opens: qc.opens,
      avgDetailMs: qc.opens > 0 ? Math.round(qc.totalDetailMs / qc.opens) : 0,
      sales: totalQty,
      revenue: totalRevenue,
      conversionPct: qc.opens > 0 ? Math.round((totalQty / qc.opens) * 100) : null,
    };
  });

  // 5. Orphans: sold in Toteat, not mapped to any dish
  const orphans = Array.from(toteatByCode.values())
    .filter((p) => !matchedToteatIds.has(p.id) && p.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity)
    .map((p) => ({ toteatId: p.id, name: p.name, category: p.category, sales: p.quantity, revenue: p.revenue }));

  // 6. Insights
  // Fantasmas: dishes opened with real intent (≥3 long opens) but rarely (or
  // never) bought. Conversion on opens is the honest metric — "of those who
  // actually looked at the detail, how many ordered". 15% is the threshold
  // because below that, the dish is clearly losing the close: people see it,
  // get interested enough to read it, and then choose something else.
  const fantasmas = rows
    .filter((r) => r.mapped && r.opens >= 3 && (r.sales === 0 || (r.conversionPct ?? 0) <= 15))
    .sort((a, b) => {
      if (a.sales === 0 && b.sales > 0) return -1;
      if (b.sales === 0 && a.sales > 0) return 1;
      return b.opens - a.opens;
    })
    .slice(0, 5);
  // Sospechosos: unmapped dishes with real interest. We can't tell if they
  // sold (no Toteat link), so we surface them as "map to confirm".
  const sospechosos = rows
    .filter((r) => !r.mapped && r.opens >= 3)
    .sort((a, b) => b.opens - a.opens)
    .slice(0, 5);
  // Top 5 best converters: opened ≥ 3 times and at least 2 sales, ranked by
  // conv on opens. Relative ranking so longer windows still surface stars.
  // Capping at 5 keeps the block visually balanced next to Fantasmas.
  const estrellas = rows
    .filter((r) => r.opens >= 3 && r.sales >= 2)
    .sort((a, b) => (b.conversionPct ?? 0) - (a.conversionPct ?? 0))
    .slice(0, 5);
  const totalOpens = rows.reduce((s, r) => s + r.opens, 0);
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
      totalOpens,
      totalSales,
      totalRevenue,
      orphanCount: orphans.length,
    },
    insights: { fantasmas, sospechosos, estrellas },
    rows,
    orphans,
  });
}
