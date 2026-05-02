import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin, getOwnedRestaurantIds } from "@/lib/adminAuth";
import { chileStartOfTodayUTC, chileHourOf } from "@/lib/toteat/timezone";

/**
 * Live dashboard data for /panel/live.
 * Returns: today's totals, comparisons against yesterday and same-day-last-week
 * (clipped to current hour for fair comparison), hourly breakdown for today,
 * top products in the last 60 minutes, and top products today.
 */

interface SaleAgg {
  orderCount: number;
  unitsSold: number;
  revenue: number;
}

interface ProductAgg {
  toteatProductId: string;
  name: string;
  qty: number;
}

function aggregate(sales: { products: { quantity: number; netPrice: number }[] }[]): SaleAgg {
  let units = 0, revenue = 0;
  for (const s of sales) for (const p of s.products) {
    units += p.quantity || 0;
    revenue += p.netPrice || 0;
  }
  return { orderCount: sales.length, unitsSold: units, revenue };
}

function topProducts(sales: { products: { toteatProductId: string; productName: string; quantity: number }[] }[], limit: number): ProductAgg[] {
  const byCode = new Map<string, ProductAgg>();
  for (const s of sales) for (const p of s.products) {
    const ex = byCode.get(p.toteatProductId);
    if (ex) ex.qty += p.quantity || 0;
    else byCode.set(p.toteatProductId, { toteatProductId: p.toteatProductId, name: p.productName, qty: p.quantity || 0 });
  }
  return Array.from(byCode.values())
    .filter((p) => p.qty > 0)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit);
}

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const restaurantIdParam = req.nextUrl.searchParams.get("restaurantId");
  let restaurantId = restaurantIdParam;
  if (!isSuperAdmin(req)) {
    const ownedIds = await getOwnedRestaurantIds(req);
    if (!ownedIds || ownedIds.length === 0) return NextResponse.json({ error: "Sin locales" }, { status: 403 });
    if (restaurantIdParam && !ownedIds.includes(restaurantIdParam)) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
    if (!restaurantIdParam) restaurantId = ownedIds[0];
  }
  if (!restaurantId) return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });

  const todayStart = chileStartOfTodayUTC();
  const now = new Date();
  const elapsedMs = now.getTime() - todayStart.getTime();

  // Yesterday: same window 00:00 to (now - 24h)
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayCurrent = new Date(yesterdayStart.getTime() + elapsedMs);

  // Last week same day
  const lastWeekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const lastWeekCurrent = new Date(lastWeekStart.getTime() + elapsedMs);

  // Last 60 min for "ahora"
  const sixtyMinAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const productSelect = { select: { toteatProductId: true, productName: true, quantity: true, netPrice: true } };

  const [todaySales, yesterdaySales, lastWeekSales, last60Sales] = await Promise.all([
    prisma.toteatSale.findMany({
      where: { restaurantId, dateClosed: { gte: todayStart, lte: now } },
      select: { dateClosed: true, total: true, products: productSelect },
    }),
    prisma.toteatSale.findMany({
      where: { restaurantId, dateClosed: { gte: yesterdayStart, lte: yesterdayCurrent } },
      select: { products: productSelect },
    }),
    prisma.toteatSale.findMany({
      where: { restaurantId, dateClosed: { gte: lastWeekStart, lte: lastWeekCurrent } },
      select: { products: productSelect },
    }),
    prisma.toteatSale.findMany({
      where: { restaurantId, dateClosed: { gte: sixtyMinAgo, lte: now } },
      select: { products: productSelect },
    }),
  ]);

  // Hourly breakdown for today
  const byHour = new Array(24).fill(0).map((_, h) => ({ hour: h, units: 0, revenue: 0 }));
  for (const s of todaySales) {
    const h = chileHourOf(s.dateClosed);
    const slot = byHour[h];
    if (!slot) continue;
    slot.revenue += s.total || 0;
    for (const p of s.products) slot.units += p.quantity || 0;
  }

  const today = aggregate(todaySales);
  const yesterday = aggregate(yesterdaySales);
  const lastWeek = aggregate(lastWeekSales);

  const pctChange = (a: number, b: number): number | null => {
    if (b === 0) return a > 0 ? null : 0;
    return Math.round(((a - b) / b) * 100);
  };

  return NextResponse.json({
    now: now.toISOString(),
    elapsedMs,
    today,
    yesterday,
    lastWeek,
    deltas: {
      revenueVsYesterday: pctChange(today.revenue, yesterday.revenue),
      revenueVsLastWeek: pctChange(today.revenue, lastWeek.revenue),
      ordersVsYesterday: pctChange(today.orderCount, yesterday.orderCount),
      ordersVsLastWeek: pctChange(today.orderCount, lastWeek.orderCount),
    },
    byHour,
    topNow: topProducts(last60Sales, 5),
    topToday: topProducts(todaySales, 8),
  });
}
