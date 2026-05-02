import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchToteatSales } from "@/lib/toteat/fetchSales";
import { chileHourOf, chileTodayISODate, parseToteatDate } from "@/lib/toteat/timezone";

const HORUS_SLUG = "horusvegan";

interface HourBucket {
  hour: number;
  totalSales: number;
  totalRevenue: number;
  orderCount: number;
  products: { id: string; name: string; quantity: number; revenue: number; category: string | null }[];
}

interface NormalizedSale {
  dateClosed: Date;
  total: number;
  products: { id: string; name: string; quantity: number; netPrice: number; hierarchyName: string | null }[];
}

function bucketByHour(sales: NormalizedSale[]) {
  const hours = new Map<number, HourBucket>();
  for (let h = 0; h < 24; h++) {
    hours.set(h, { hour: h, totalSales: 0, totalRevenue: 0, orderCount: 0, products: [] });
  }

  for (const sale of sales) {
    const hour = chileHourOf(sale.dateClosed);
    const bucket = hours.get(hour)!;
    bucket.orderCount += 1;
    bucket.totalRevenue += sale.total;

    const productMap = new Map(bucket.products.map((p) => [p.id, p]));
    for (const p of sale.products) {
      const existing = productMap.get(p.id);
      if (existing) {
        existing.quantity += p.quantity;
        existing.revenue += p.netPrice;
      } else {
        const newP = { id: p.id, name: p.name, quantity: p.quantity, revenue: p.netPrice, category: p.hierarchyName };
        productMap.set(p.id, newP);
        bucket.products.push(newP);
      }
      bucket.totalSales += p.quantity;
    }
    bucket.products = Array.from(productMap.values());
  }

  return Array.from(hours.values())
    .filter((b) => b.orderCount > 0)
    .map((b) => ({ ...b, products: b.products.sort((a, b) => b.quantity - a.quantity) }))
    .sort((a, b) => a.hour - b.hour);
}

function topOfDay(sales: NormalizedSale[]) {
  const acc = new Map<string, { id: string; name: string; quantity: number; revenue: number; category: string | null }>();
  for (const sale of sales) {
    for (const p of sale.products) {
      const ex = acc.get(p.id);
      if (ex) { ex.quantity += p.quantity; ex.revenue += p.netPrice; }
      else acc.set(p.id, { id: p.id, name: p.name, quantity: p.quantity, revenue: p.netPrice, category: p.hierarchyName });
    }
  }
  return Array.from(acc.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 10);
}

export async function GET() {
  // 1. Try to read from local cache (ToteatSale rows for today)
  const restaurant = await prisma.restaurant.findUnique({ where: { slug: HORUS_SLUG }, select: { id: true } });
  let normalized: NormalizedSale[] = [];
  let source: "cache" | "live" = "cache";

  if (restaurant) {
    const todayISO = chileTodayISODate();
    const startOfDay = new Date(`${todayISO}T00:00:00-04:00`); // Chile UTC-4 (no DST in May)
    const endOfDay = new Date(`${todayISO}T23:59:59.999-04:00`);
    const cached = await prisma.toteatSale.findMany({
      where: { restaurantId: restaurant.id, dateClosed: { gte: startOfDay, lte: endOfDay } },
      include: { products: true },
      orderBy: { dateClosed: "asc" },
    });
    if (cached.length > 0) {
      normalized = cached.map((s) => ({
        dateClosed: s.dateClosed,
        total: s.total,
        products: s.products.map((p) => ({
          id: p.toteatProductId,
          name: p.productName,
          quantity: p.quantity,
          netPrice: p.netPrice,
          hierarchyName: p.hierarchyName,
        })),
      }));
    }
  }

  // 2. Fallback to live fetch if cache is empty
  if (normalized.length === 0) {
    source = "live";
    const live = await fetchToteatSales();
    if (!live.data && live.ok === false) {
      const msgText = typeof live.msg === "string" ? live.msg : live.msg?.texto || "Toteat returned non-ok";
      return NextResponse.json({ error: msgText }, { status: 502 });
    }
    normalized = (live.data || []).map((s) => {
      const dateClosed = parseToteatDate(s.dateClosed) || parseToteatDate(s.dateOpen) || new Date();
      return {
        dateClosed,
        total: s.total ?? 0,
        products: (s.products || []).map((p) => ({
          id: p.id,
          name: p.name,
          quantity: p.quantity ?? 0,
          netPrice: p.netPrice ?? 0,
          hierarchyName: p.hierarchyName || null,
        })),
      };
    });
  }

  return NextResponse.json({
    date: chileTodayISODate(),
    source,
    totalOrders: normalized.length,
    totalRevenue: normalized.reduce((s, x) => s + x.total, 0),
    hours: bucketByHour(normalized),
    top: topOfDay(normalized),
  });
}
