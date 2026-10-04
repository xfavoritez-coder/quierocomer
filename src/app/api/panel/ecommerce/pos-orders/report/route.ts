import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chileTodayYmd, chileDayRangeUtc } from "@/lib/driver/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertOwnership(req: NextRequest, restaurantId: string): Promise<boolean> {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return false;
  if (panelId === "demo") return true;
  if (panelId.startsWith("tm_")) {
    const m = await prisma.teamMember.findUnique({ where: { id: panelId.slice(3) }, select: { restaurantId: true } });
    return m?.restaurantId === restaurantId;
  }
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

/** Hora local (0–23) de Chile para una fecha. */
function chileHour(d: Date): number {
  const h = new Intl.DateTimeFormat("en-US", { timeZone: "America/Santiago", hour: "2-digit", hour12: false }).format(d);
  const n = parseInt(h, 10);
  return n === 24 ? 0 : n;
}

/** Fecha local de Chile en formato YYYY-MM-DD. */
function chileYmd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** GET /api/panel/ecommerce/pos-orders/report?restaurantId=X&from=YYYY-MM-DD&to=YYYY-MM-DD
 *  Reporte de ventas: venta de productos (con IVA, sin delivery ni propinas),
 *  monto de delivery y venta por hora. Excluye cancelados. */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const today = chileTodayYmd();
  const fromYmd = req.nextUrl.searchParams.get("from") || today;
  const toYmd = req.nextUrl.searchParams.get("to") || fromYmd;
  const start = chileDayRangeUtc(fromYmd).start;
  const end = chileDayRangeUtc(toYmd).end;

  const orders = await prisma.posOrder.findMany({
    where: { restaurantId, posStatus: { not: "canceled" }, createdAt: { gte: start, lte: end } },
    select: { totalAmount: true, deliveryFee: true, tipAmount: true, createdAt: true, vendorName: true, items: true, isDelivery: true, saleType: true, tableLabel: true },
  });

  let productSales = 0; // total con IVA, sin delivery ni propinas
  let deliveryTotal = 0;
  let tipsTotal = 0;
  let grossTotal = 0; // lo que pagó el cliente (referencia)
  const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, sales: 0, orders: 0 }));
  const channelMap = new Map<string, { name: string; sales: number; orders: number }>();
  const productMap = new Map<string, { name: string; qty: number; revenue: number }>();
  const typeMap: Record<"delivery" | "pickup" | "dine-in", { sales: number; orders: number }> = {
    delivery: { sales: 0, orders: 0 }, pickup: { sales: 0, orders: 0 }, "dine-in": { sales: 0, orders: 0 },
  };

  const isDeliveryLine = (name: string, code: string) => {
    const n = name.toLowerCase();
    return n.includes("delivery") || n.includes("reparto") || n.includes("envio") || n.includes("envío") || code.toUpperCase() === "TOTEATDVYCOST";
  };

  for (const o of orders) {
    const net = Math.max(0, (o.totalAmount || 0) - (o.deliveryFee || 0) - (o.tipAmount || 0));
    productSales += net;
    deliveryTotal += o.deliveryFee || 0;
    tipsTotal += o.tipAmount || 0;
    grossTotal += o.totalAmount || 0;
    const h = chileHour(o.createdAt);
    hourly[h].sales += net;
    hourly[h].orders += 1;

    // Venta por canal según vendorName.
    const name = (o.vendorName || "").trim() || "Sin canal";
    const ch = channelMap.get(name) || { name, sales: 0, orders: 0 };
    ch.sales += net;
    ch.orders += 1;
    channelMap.set(name, ch);

    // Tipo de pedido: delivery / mesa (dine-in) / retiro (pickup).
    const type: "delivery" | "pickup" | "dine-in" = o.isDelivery
      ? "delivery"
      : ((o.tableLabel && o.tableLabel.trim()) || o.saleType === "dine-in") ? "dine-in" : "pickup";
    typeMap[type].sales += net;
    typeMap[type].orders += 1;

    // Ranking de productos vendidos.
    const items = Array.isArray(o.items) ? (o.items as unknown[]) : [];
    for (const raw of items) {
      if (!raw || typeof raw !== "object") continue;
      const ln = raw as Record<string, any>;
      // Excluir modificadores/extras: en Toteat vienen como líneas con
      // isExtra=true y referenceLine apuntando al producto padre.
      if (ln.isExtra === true || ln.referenceLine != null) continue;
      const pname = String(ln.productName ?? ln.name ?? ln.dishName ?? ln.title ?? "").trim();
      if (!pname) continue;
      const code = String(ln.productCode ?? "");
      if (isDeliveryLine(pname, code)) continue;
      let qty = Number(ln.quantity ?? ln.qty ?? 1);
      if (!(qty > 0)) qty = 1;
      let rev = 0;
      if (ln.amountAfterTax != null) rev = Number(ln.amountAfterTax);
      else if (ln.unitPriceAfterTax != null) rev = Number(ln.unitPriceAfterTax) * qty;
      else if (ln.unitPrice != null) rev = Number(ln.unitPrice) * qty;
      else if (ln.price != null) rev = Number(ln.price) * qty;
      const p = productMap.get(pname) || { name: pname, qty: 0, revenue: 0 };
      p.qty += qty;
      p.revenue += Number.isFinite(rev) ? rev : 0;
      productMap.set(pname, p);
    }
  }

  const channels = [...channelMap.values()].sort((a, b) => b.sales - a.sales);
  const products = [...productMap.values()].sort((a, b) => b.qty - a.qty);

  const byType = [
    { type: "delivery", label: "Delivery", sales: typeMap.delivery.sales, orders: typeMap.delivery.orders },
    { type: "pickup", label: "Retiro", sales: typeMap.pickup.sales, orders: typeMap.pickup.orders },
    { type: "dine-in", label: "Mesa", sales: typeMap["dine-in"].sales, orders: typeMap["dine-in"].orders },
  ];

  // Venta por día del MES en curso (independiente del rango from/to del reporte).
  const monthYm = today.slice(0, 7); // YYYY-MM
  const todayDay = parseInt(today.slice(8, 10), 10);
  const monthStart = chileDayRangeUtc(`${monthYm}-01`).start;
  const monthEnd = chileDayRangeUtc(today).end;
  const monthOrders = await prisma.posOrder.findMany({
    where: { restaurantId, posStatus: { not: "canceled" }, createdAt: { gte: monthStart, lte: monthEnd } },
    select: { totalAmount: true, deliveryFee: true, tipAmount: true, createdAt: true },
  });
  const dayMap = new Map<number, { sales: number; orders: number }>();
  for (const o of monthOrders) {
    const net = Math.max(0, (o.totalAmount || 0) - (o.deliveryFee || 0) - (o.tipAmount || 0));
    const day = parseInt(chileYmd(o.createdAt).slice(8, 10), 10);
    const e = dayMap.get(day) || { sales: 0, orders: 0 };
    e.sales += net;
    e.orders += 1;
    dayMap.set(day, e);
  }
  const monthlyDays = Array.from({ length: todayDay }, (_, i) => {
    const e = dayMap.get(i + 1);
    return { day: i + 1, sales: e?.sales || 0, orders: e?.orders || 0 };
  });

  return NextResponse.json({
    from: fromYmd,
    to: toYmd,
    today,
    ordersCount: orders.length,
    productSales,
    deliveryTotal,
    tipsTotal,
    grossTotal,
    hourly,
    channels,
    products,
    byType,
    monthly: { month: monthYm, days: monthlyDays },
  });
}
