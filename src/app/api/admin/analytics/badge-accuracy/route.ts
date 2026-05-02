import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin, getOwnedRestaurantIds } from "@/lib/adminAuth";
import { chileDayBoundsUTC } from "@/lib/toteat/timezone";

/**
 * Did our badges actually drive sales?
 *
 * For each badge type (POPULAR = algorithm, RECOMMENDED = owner-picked),
 * compare the dishes that wore the badge in the period against:
 *  - Hit rate: of those badged, how many were also among the top sellers?
 *  - Sales lift: avg sales per badged dish vs avg sales per unbadged dish
 *  - Top items: which dishes wore the badge most often and what they sold
 *
 * Sales come from Toteat (with modifier sales summed back to the parent
 * dish, same logic as carta-vs-caja). Snapshots come from the cron-fed
 * BadgeSnapshot table.
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
    if (!ownedIds || ownedIds.length === 0) return NextResponse.json({ error: "Sin locales" }, { status: 403 });
    if (restaurantIdParam && !ownedIds.includes(restaurantIdParam)) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
    if (!restaurantIdParam) restaurantId = ownedIds[0];
  }
  if (!restaurantId) return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });

  // Interpret the YYYY-MM-DD strings as Chile-local days so "Hoy" means
  // today in Chile (not in UTC, which leaks last night's sales in).
  const from = fromStr ? chileDayBoundsUTC(fromStr).from : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const to = toStr ? chileDayBoundsUTC(toStr).to : new Date();

  // 1. Snapshots in window — count per (dish, badgeType)
  const snapshots = await prisma.badgeSnapshot.findMany({
    where: { restaurantId, capturedAt: { gte: from, lte: to } },
    select: { dishId: true, badgeType: true, capturedAt: true },
  });

  if (snapshots.length === 0) {
    return NextResponse.json({
      range: { from: from.toISOString(), to: to.toISOString() },
      hasData: false,
      message: "Sin snapshots de badges en el rango. Los datos se capturan cada 30 minutos.",
    });
  }

  const popularByDish = new Map<string, number>();
  const recommendedByDish = new Map<string, number>();
  // Distinct snapshot runs (timestamps rounded to nearest minute) — used as
  // total denominator so a dish that was badged in every run gets 100%.
  const popularRuns = new Set<number>();
  const recommendedRuns = new Set<number>();

  for (const s of snapshots) {
    const runKey = Math.floor(s.capturedAt.getTime() / 60000) * 60000;
    if (s.badgeType === "POPULAR") {
      popularByDish.set(s.dishId, (popularByDish.get(s.dishId) || 0) + 1);
      popularRuns.add(runKey);
    } else if (s.badgeType === "RECOMMENDED") {
      recommendedByDish.set(s.dishId, (recommendedByDish.get(s.dishId) || 0) + 1);
      recommendedRuns.add(runKey);
    }
  }

  // 2. Toteat sales in window (with modifier sales summed back to parent)
  const sales = await prisma.toteatSale.findMany({
    where: { restaurantId, dateClosed: { gte: from, lte: to } },
    select: { products: { select: { toteatProductId: true, quantity: true } } },
  });
  const toteatByCode = new Map<string, number>();
  for (const s of sales) for (const p of s.products) {
    toteatByCode.set(p.toteatProductId, (toteatByCode.get(p.toteatProductId) || 0) + (p.quantity || 0));
  }

  const dishes = await prisma.dish.findMany({
    where: { restaurantId, isActive: true, deletedAt: null },
    select: {
      id: true, name: true, photos: true,
      toteatProductId: true,
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

  const salesByDish = new Map<string, number>();
  const dishMap = new Map<string, { name: string; photo: string | null }>();
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
    salesByDish.set(d.id, qty);
    dishMap.set(d.id, { name: d.name, photo: d.photos?.[0] || null });
  }

  // 3. Top sellers — top N by units sold (used for hit rate)
  const sortedBySales = [...salesByDish.entries()].sort((a, b) => b[1] - a[1]);
  const topSellerCount = Math.min(10, Math.max(3, Math.round(dishes.length * 0.3)));
  const topSellerIds = new Set(sortedBySales.slice(0, topSellerCount).filter(([, q]) => q > 0).map(([id]) => id));

  // 4. Build stats per badge type
  const computeStats = (badgedByDish: Map<string, number>, totalRuns: number) => {
    const badgedDishIds = new Set(badgedByDish.keys());
    if (badgedDishIds.size === 0) {
      return { distinctDishes: 0, totalRuns, hitRate: null, salesLift: null, avgSalesBadged: 0, avgSalesUnbadged: 0, sharePct: 0, topItems: [] };
    }

    const inAlsoTop = [...badgedDishIds].filter((id) => topSellerIds.has(id)).length;
    const hitRate = Math.round((inAlsoTop / badgedDishIds.size) * 100);

    let salesIn = 0;
    let countIn = 0;
    let salesOut = 0;
    let countOut = 0;
    for (const d of dishes) {
      const qty = salesByDish.get(d.id) || 0;
      if (badgedDishIds.has(d.id)) { salesIn += qty; countIn++; }
      else { salesOut += qty; countOut++; }
    }
    const avgIn = countIn > 0 ? salesIn / countIn : 0;
    const avgOut = countOut > 0 ? salesOut / countOut : 0;
    const lift = avgOut > 0 ? Math.round(((avgIn - avgOut) / avgOut) * 100) : null;
    const totalSales = salesIn + salesOut;
    const sharePct = totalSales > 0 ? Math.round((salesIn / totalSales) * 100) : 0;

    const topItems = [...badgedByDish.entries()]
      .map(([dishId, snapshotCount]) => ({
        dishId,
        name: dishMap.get(dishId)?.name || dishId,
        photo: dishMap.get(dishId)?.photo || null,
        snapshotCount,
        totalRuns,
        coveragePct: totalRuns > 0 ? Math.round((snapshotCount / totalRuns) * 100) : 0,
        sales: salesByDish.get(dishId) || 0,
        wasTopSeller: topSellerIds.has(dishId),
      }))
      .sort((a, b) => b.snapshotCount - a.snapshotCount || b.sales - a.sales)
      .slice(0, 8);

    return {
      distinctDishes: badgedDishIds.size,
      totalRuns,
      hitRate,
      salesLift: lift,
      avgSalesBadged: Math.round(avgIn * 10) / 10,
      avgSalesUnbadged: Math.round(avgOut * 10) / 10,
      sharePct,
      topItems,
    };
  };

  return NextResponse.json({
    range: { from: from.toISOString(), to: to.toISOString() },
    hasData: true,
    summary: {
      totalSnapshotRuns: popularRuns.size + recommendedRuns.size,
      popularRuns: popularRuns.size,
      recommendedRuns: recommendedRuns.size,
      topSellerCount,
    },
    popular: computeStats(popularByDish, popularRuns.size),
    recommended: computeStats(recommendedByDish, recommendedRuns.size),
  });
}
