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
    select: { totalAmount: true, deliveryFee: true, tipAmount: true, createdAt: true, vendorName: true, items: true },
  });

  let productSales = 0; // total con IVA, sin delivery ni propinas
  let deliveryTotal = 0;
  let tipsTotal = 0;
  let grossTotal = 0; // lo que pagó el cliente (referencia)
  const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, sales: 0, orders: 0 }));
  const channelMap = new Map<string, { name: string; sales: number; orders: number }>();
  const productMap = new Map<string, { name: string; qty: number; revenue: number }>();

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

    // Ranking de productos vendidos.
    const items = Array.isArray(o.items) ? (o.items as unknown[]) : [];
    for (const raw of items) {
      if (!raw || typeof raw !== "object") continue;
      const ln = raw as Record<string, any>;
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
  const products = [...productMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 30);

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
  });
}
