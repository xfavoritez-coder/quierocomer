import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chileTodayYmd, chileDayRangeUtc } from "@/lib/driver/serialize";

// Verifica que el panel_id (owner / team member / demo) sea dueño del local.
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

const ONLINE_METHODS = ["webpay", "flow", "mercadopago"];
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const chileYmd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

interface OrderItemLike { dishName?: string; name?: string; quantity?: number; unitTotal?: number; unit_price?: number }

/**
 * GET /api/panel/ecommerce/reports?restaurantId=X&month=YYYY-MM
 * Reporte mensual del ecommerce: venta total, venta por día y ranking de
 * productos vendidos. "Venta" = pedidos no cancelados y pagados (online) o de
 * método offline (efectivo/transferencia). Excluye intentos de pago fallidos.
 */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const today = chileTodayYmd();
  const month = (req.nextUrl.searchParams.get("month") || today.slice(0, 7)).slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return NextResponse.json({ error: "Mes inválido" }, { status: 400 });

  const daysInMonth = new Date(y, m, 0).getDate();
  const start = chileDayRangeUtc(`${month}-01`).start;
  const end = chileDayRangeUtc(`${month}-${String(daysInMonth).padStart(2, "0")}`).end;

  const orders = await prisma.onlineOrder.findMany({
    where: {
      restaurantId,
      source: "ecommerce",
      createdAt: { gte: start, lte: end },
      status: { not: "CANCELLED" },
      OR: [{ paymentStatus: "paid" }, { paymentMethod: { notIn: ONLINE_METHODS } }],
    },
    select: { total: true, createdAt: true, items: true },
    orderBy: { createdAt: "asc" },
  });

  // Venta por día (hora de Chile), con todos los días del mes en cero.
  const byDayMap = new Map<string, { total: number; count: number }>();
  for (let d = 1; d <= daysInMonth; d++) byDayMap.set(`${month}-${String(d).padStart(2, "0")}`, { total: 0, count: 0 });

  // Ranking de productos vendidos.
  const prodMap = new Map<string, { name: string; qty: number; revenue: number }>();

  let totalSales = 0;
  for (const o of orders) {
    totalSales += o.total || 0;
    const ymd = chileYmd(o.createdAt);
    const day = byDayMap.get(ymd);
    if (day) { day.total += o.total || 0; day.count += 1; }

    const items = Array.isArray(o.items) ? (o.items as unknown as OrderItemLike[]) : [];
    for (const it of items) {
      const name = (it.dishName || it.name || "Ítem").trim();
      if (!name) continue;
      const qty = Number(it.quantity) || 0;
      if (qty <= 0) continue;
      const unit = Number(it.unitTotal ?? it.unit_price ?? 0) || 0;
      const g = prodMap.get(name) || { name, qty: 0, revenue: 0 };
      g.qty += qty;
      g.revenue += unit * qty;
      prodMap.set(name, g);
    }
  }

  const byDay = Array.from(byDayMap.entries()).map(([ymd, v]) => ({ ymd, day: Number(ymd.slice(-2)), total: v.total, count: v.count }));
  const products = Array.from(prodMap.values()).sort((a, b) => b.qty - a.qty || b.revenue - a.revenue).slice(0, 30);
  const orderCount = orders.length;
  const avgTicket = orderCount > 0 ? Math.round(totalSales / orderCount) : 0;

  // ── Comparativo vs. mes anterior (solo totales, sin ítems) ──
  const prevMonth = (() => { const d = new Date(Date.UTC(y, m - 2, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; })();
  const [py, pm] = prevMonth.split("-").map(Number);
  const prevDays = new Date(py, pm, 0).getDate();
  const prevAgg = await prisma.onlineOrder.aggregate({
    where: {
      restaurantId, source: "ecommerce",
      createdAt: { gte: chileDayRangeUtc(`${prevMonth}-01`).start, lte: chileDayRangeUtc(`${prevMonth}-${String(prevDays).padStart(2, "0")}`).end },
      status: { not: "CANCELLED" },
      OR: [{ paymentStatus: "paid" }, { paymentMethod: { notIn: ONLINE_METHODS } }],
    },
    _sum: { total: true },
    _count: { _all: true },
  });
  const prevSales = prevAgg._sum.total || 0;
  const prevCount = prevAgg._count._all || 0;
  const prevTicket = prevCount > 0 ? Math.round(prevSales / prevCount) : 0;
  // % de variación (null si el mes anterior fue 0, para no dividir por cero).
  const pct = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);

  return NextResponse.json({
    month,
    monthLabel: `${MESES[m - 1]} ${y}`,
    today,
    totalSales,
    orderCount,
    avgTicket,
    byDay,
    products,
    prev: { month: prevMonth, monthLabel: `${MESES[pm - 1]} ${py}`, totalSales: prevSales, orderCount: prevCount, avgTicket: prevTicket },
    deltas: { sales: pct(totalSales, prevSales), orders: pct(orderCount, prevCount), ticket: pct(avgTicket, prevTicket) },
  });
}
