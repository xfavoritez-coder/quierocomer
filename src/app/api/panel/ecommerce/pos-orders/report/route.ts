import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { teamMemberCanAccess } from "@/lib/ecommerce/panelAuth";
import { isSuperAdmin } from "@/lib/adminAuth";
import { chileTodayYmd, chileDayRangeUtc } from "@/lib/driver/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Filtro de "venta" para OnlineOrder (native ecommerce, sin espejo al POS):
// no cancelado, y pagado online O método offline (efectivo/transferencia).
const ONLINE_PAY_METHODS = ["webpay", "flow", "mercadopago"];

async function assertOwnership(req: NextRequest, restaurantId: string): Promise<boolean> {
  if (isSuperAdmin(req)) return true;
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return false;
  if (panelId === "demo") return true;
  if (panelId.startsWith("tm_")) {
    return teamMemberCanAccess(panelId.slice(3), restaurantId);
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
    select: { id: true, externalId: true, totalAmount: true, paidAmount: true, deliveryFee: true, tipAmount: true, createdAt: true, vendorName: true, items: true, isDelivery: true, saleType: true, tableLabel: true, opsReadyForDeliveryAt: true, opsDispatchedAt: true, opsDeliveredAt: true, orderReference: true, customerName: true, customerPhone: true, addressLine: true, delifastVentaId: true },
  });

  // OnlineOrder (ecommerce nativo) que NO están espejados al POS. Para locales SIN
  // Centro de pedidos/POS (ej. Hand Roll) todas sus ventas viven aquí; el espejo usa
  // externalId "oo-<id>", así que excluimos los ya espejados para no duplicar.
  const mirroredOnlineIds = new Set<string>();
  for (const o of orders) {
    if (o.externalId && o.externalId.startsWith("oo-")) mirroredOnlineIds.add(o.externalId.slice(3));
  }
  const onlineOrders = await prisma.onlineOrder.findMany({
    where: {
      restaurantId, source: "ecommerce", createdAt: { gte: start, lte: end },
      status: { not: "CANCELLED" },
      OR: [{ paymentStatus: "paid" }, { paymentMethod: { notIn: ONLINE_PAY_METHODS } }],
    },
    select: { id: true, total: true, deliveryFee: true, createdAt: true, items: true, orderType: true, fromApp: true, statusHistory: true, customerName: true, customerPhone: true, deliveryAddress: true, orderNumber: true, courier: true },
  });
  const unmirroredOnline = onlineOrders.filter((o) => !mirroredOnlineIds.has(o.id));
  // Mapa de items de OnlineOrder para recuperar precios en PosOrders espejados
  // que fueron creados antes de que centroMirror propagara el unit_price.
  const onlineItemsFallback = new Map<string, unknown[]>();
  for (const o of onlineOrders) {
    if (Array.isArray(o.items)) onlineItemsFallback.set(o.id, o.items as unknown[]);
  }

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
    // Para PosOrders espejados desde ecommerce (externalId "oo-*") que no tienen
    // precio en sus ítems (creados antes del fix de centroMirror), usar los ítems
    // de la OnlineOrder original como fuente de precio.
    const ooId = o.externalId?.startsWith("oo-") ? o.externalId.slice(3) : null;
    const fallbackItems = ooId ? (onlineItemsFallback.get(ooId) ?? []) : [];
    const fallbackPriceMap = new Map<string, number>();
    for (const fi of fallbackItems) {
      if (!fi || typeof fi !== "object") continue;
      const fln = fi as Record<string, any>;
      const fname = String(fln.name ?? fln.dishName ?? "").trim();
      const fprice = Number(fln.unit_price ?? fln.unitTotal ?? fln.price ?? 0);
      if (fname && fprice > 0) fallbackPriceMap.set(fname, fprice);
    }

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
      if (ln.amountAfterTax != null && Number(ln.amountAfterTax) > 0) rev = Number(ln.amountAfterTax);
      else if (ln.netPrice != null && Number(ln.netPrice) > 0) rev = Number(ln.netPrice);
      else if (ln.unitPriceAfterTax != null && Number(ln.unitPriceAfterTax) > 0) rev = Number(ln.unitPriceAfterTax) * qty;
      else if (ln.unitTotal != null && Number(ln.unitTotal) > 0) rev = Number(ln.unitTotal) * qty;
      else if (ln.unit_price != null && Number(ln.unit_price) > 0) rev = Number(ln.unit_price) * qty;
      else if (ln.unitPrice != null && Number(ln.unitPrice) > 0) rev = Number(ln.unitPrice) * qty;
      else if (ln.price != null && Number(ln.price) > 0) rev = Number(ln.price) * qty;
      else if (ln.amount != null && Number(ln.amount) > 0) rev = Number(ln.amount);
      else if (ln.total != null && Number(ln.total) > 0) rev = Number(ln.total);
      // Fallback: buscar precio en la OnlineOrder original (pedidos espejados sin precio)
      else if (fallbackPriceMap.has(pname)) rev = fallbackPriceMap.get(pname)! * qty;
      const p = productMap.get(pname) || { name: pname, qty: 0, revenue: 0 };
      p.qty += qty;
      p.revenue += Number.isFinite(rev) ? rev : 0;
      productMap.set(pname, p);
    }
  }

  // ── Agregación de OnlineOrder no-espejados (locales sin Centro/POS) ──
  // total = subtotal + deliveryFee - discount (checkout) → neto = total - deliveryFee.
  for (const o of unmirroredOnline) {
    const fee = o.deliveryFee || 0;
    const net = Math.max(0, (o.total || 0) - fee);
    productSales += net;
    deliveryTotal += fee;
    grossTotal += o.total || 0;
    const h = chileHour(o.createdAt);
    hourly[h].sales += net;
    hourly[h].orders += 1;

    // Canal: App (desde la app) o Web.
    const chName = o.fromApp ? "App" : "Web";
    const ch = channelMap.get(chName) || { name: chName, sales: 0, orders: 0 };
    ch.sales += net;
    ch.orders += 1;
    channelMap.set(chName, ch);

    // Tipo: delivery / retiro (OnlineOrder no tiene mesas).
    const type: "delivery" | "pickup" = o.orderType === "DELIVERY" ? "delivery" : "pickup";
    typeMap[type].sales += net;
    typeMap[type].orders += 1;

    const items = Array.isArray(o.items) ? (o.items as unknown[]) : [];
    for (const raw of items) {
      if (!raw || typeof raw !== "object") continue;
      const ln = raw as Record<string, any>;
      const pname = String(ln.name ?? ln.dishName ?? ln.productName ?? ln.title ?? "").trim();
      if (!pname) continue;
      let qty = Number(ln.quantity ?? ln.qty ?? 1);
      if (!(qty > 0)) qty = 1;
      const unit = Number(ln.unitTotal ?? ln.unit_price ?? ln.unitPrice ?? ln.price ?? 0) || 0;
      const p = productMap.get(pname) || { name: pname, qty: 0, revenue: 0 };
      p.qty += qty;
      p.revenue += unit * qty;
      productMap.set(pname, p);
    }
  }

  const channels = [...channelMap.values()].sort((a, b) => b.sales - a.sales);
  const products = [...productMap.values()].sort((a, b) => b.qty - a.qty);

  // ── Tiempos de entrega (todos los pedidos delivery, completados o en curso) ─
  interface DeliveryTimeRow {
    orderId: string; ref: string; name: string; phone: string; addressLine: string;
    totalAmount: number; paidAmount: number; deliveryFee: number; tipAmount: number;
    vendorName: string;
    createdAt: string; readyAt: string | null; dispatchedAt: string | null; deliveredAt: string | null;
    prepMin: number | null; transitMin: number | null; totalMin: number | null;
    items: unknown; delifastVentaId: string | null;
  }
  const deliveryTimeRows: DeliveryTimeRow[] = [];
  for (const o of orders) {
    if (!o.isDelivery) continue;
    const created = o.createdAt.getTime();
    let totalMin: number | null = null;
    let transitMin: number | null = null;
    if (o.opsDeliveredAt && o.opsDeliveredAt.getTime() > created) {
      const delivered = o.opsDeliveredAt.getTime();
      totalMin = Math.round((delivered - created) / 60000);
      if (o.opsDispatchedAt) transitMin = Math.round((delivered - o.opsDispatchedAt.getTime()) / 60000);
    }
    const prepMin = o.opsDispatchedAt ? Math.round((o.opsDispatchedAt.getTime() - created) / 60000) : null;
    deliveryTimeRows.push({
      orderId: o.id,
      ref: o.orderReference || "",
      name: o.customerName || "",
      phone: o.customerPhone || "",
      addressLine: o.addressLine || "",
      totalAmount: o.totalAmount || 0,
      paidAmount: o.paidAmount || 0,
      deliveryFee: o.deliveryFee || 0,
      tipAmount: o.tipAmount || 0,
      vendorName: o.vendorName || "",
      createdAt: o.createdAt.toISOString(),
      readyAt: o.opsReadyForDeliveryAt?.toISOString() ?? null,
      dispatchedAt: o.opsDispatchedAt?.toISOString() ?? null,
      deliveredAt: o.opsDeliveredAt?.toISOString() ?? null,
      prepMin, transitMin, totalMin,
      items: o.items,
      delifastVentaId: o.delifastVentaId ?? null,
    });
  }
  // Tiempos de entrega para OnlineOrder no-espejados (deliveryhandroll/Uber): se
  // derivan de statusHistory — IN_DELIVERY = despacho (en reparto), DONE = entregado.
  const shTs = (sh: unknown, status: string): number | null => {
    if (!Array.isArray(sh)) return null;
    for (const e of sh) {
      if (e && typeof e === "object" && (e as any).status === status && (e as any).ts) {
        const t = new Date((e as any).ts).getTime();
        if (Number.isFinite(t)) return t;
      }
    }
    return null;
  };
  for (const o of unmirroredOnline) {
    if (o.orderType !== "DELIVERY") continue;
    const created = o.createdAt.getTime();
    const dispatchedMs = shTs(o.statusHistory, "IN_DELIVERY");
    const deliveredMs = shTs(o.statusHistory, "DONE");
    const readyMs = shTs(o.statusHistory, "READY");
    let totalMin: number | null = null;
    let transitMin: number | null = null;
    if (deliveredMs && deliveredMs > created) {
      totalMin = Math.round((deliveredMs - created) / 60000);
      if (dispatchedMs) transitMin = Math.round((deliveredMs - dispatchedMs) / 60000);
    }
    const prepMin = dispatchedMs ? Math.round((dispatchedMs - created) / 60000) : null;
    const courierName = (o.courier && typeof o.courier === "object"
      ? String((o.courier as any).courierName ?? (o.courier as any).name ?? "")
      : "").trim();
    deliveryTimeRows.push({
      orderId: o.id,
      ref: o.orderNumber != null ? String(o.orderNumber) : "",
      name: o.customerName || "",
      phone: o.customerPhone || "",
      addressLine: o.deliveryAddress || "",
      totalAmount: o.total || 0,
      paidAmount: o.total || 0,
      deliveryFee: o.deliveryFee || 0,
      tipAmount: 0,
      vendorName: courierName || (o.fromApp ? "App" : "Web"),
      createdAt: o.createdAt.toISOString(),
      readyAt: readyMs ? new Date(readyMs).toISOString() : null,
      dispatchedAt: dispatchedMs ? new Date(dispatchedMs).toISOString() : null,
      deliveredAt: deliveredMs ? new Date(deliveredMs).toISOString() : null,
      prepMin, transitMin, totalMin,
      items: o.items,
      delifastVentaId: null,
    });
  }

  // Ordenar: completados primero (por totalMin asc), luego en curso al final
  deliveryTimeRows.sort((a, b) => {
    if (a.totalMin == null && b.totalMin == null) return 0;
    if (a.totalMin == null) return 1;
    if (b.totalMin == null) return -1;
    return a.totalMin - b.totalMin;
  });
  const dtCount = deliveryTimeRows.length;
  // Promedios y % solo sobre pedidos ya entregados (con totalMin)
  const completed = deliveryTimeRows.filter(r => r.totalMin != null);
  const cCount = completed.length;
  const avgTotal = cCount > 0 ? Math.round(completed.reduce((s, r) => s + r.totalMin!, 0) / cCount) : null;
  const avgPrep = cCount > 0 && completed.some(r => r.prepMin != null)
    ? Math.round(completed.filter(r => r.prepMin != null).reduce((s, r) => s + r.prepMin!, 0) / completed.filter(r => r.prepMin != null).length)
    : null;
  const avgTransit = cCount > 0 && completed.some(r => r.transitMin != null)
    ? Math.round(completed.filter(r => r.transitMin != null).reduce((s, r) => s + r.transitMin!, 0) / completed.filter(r => r.transitMin != null).length)
    : null;
  const pctUnder30 = cCount > 0 ? Math.round((completed.filter(r => r.totalMin! <= 30).length / cCount) * 100) : null;
  const pctUnder45 = cCount > 0 ? Math.round((completed.filter(r => r.totalMin! <= 45).length / cCount) * 100) : null;
  const pctUnder60 = cCount > 0 ? Math.round((completed.filter(r => r.totalMin! <= 60).length / cCount) * 100) : null;
  const deliveryTimes = {
    count: dtCount,
    avgTotal, avgPrep, avgTransit,
    pctUnder30, pctUnder45, pctUnder60,
    orders: deliveryTimeRows,
  };

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
    select: { externalId: true, totalAmount: true, deliveryFee: true, tipAmount: true, createdAt: true },
  });
  // Set de OnlineOrder ya espejados DENTRO del mes (para no duplicar en el gráfico mensual).
  const mirroredMonthIds = new Set<string>();
  for (const o of monthOrders) {
    if (o.externalId && o.externalId.startsWith("oo-")) mirroredMonthIds.add(o.externalId.slice(3));
  }
  const dayMap = new Map<number, { sales: number; orders: number }>();
  for (const o of monthOrders) {
    const net = Math.max(0, (o.totalAmount || 0) - (o.deliveryFee || 0) - (o.tipAmount || 0));
    const day = parseInt(chileYmd(o.createdAt).slice(8, 10), 10);
    const e = dayMap.get(day) || { sales: 0, orders: 0 };
    e.sales += net;
    e.orders += 1;
    dayMap.set(day, e);
  }
  // OnlineOrder no-espejados del mes en curso (mismo criterio de "venta").
  const monthOnline = await prisma.onlineOrder.findMany({
    where: {
      restaurantId, source: "ecommerce", createdAt: { gte: monthStart, lte: monthEnd },
      status: { not: "CANCELLED" },
      OR: [{ paymentStatus: "paid" }, { paymentMethod: { notIn: ONLINE_PAY_METHODS } }],
    },
    select: { id: true, total: true, deliveryFee: true, createdAt: true },
  });
  for (const o of monthOnline) {
    if (mirroredMonthIds.has(o.id)) continue;
    const net = Math.max(0, (o.total || 0) - (o.deliveryFee || 0));
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
    ordersCount: orders.length + unmirroredOnline.length,
    productSales,
    deliveryTotal,
    tipsTotal,
    grossTotal,
    hourly,
    channels,
    products,
    byType,
    monthly: { month: monthYm, days: monthlyDays },
    deliveryTimes,
  });
}
