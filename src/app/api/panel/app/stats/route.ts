// KPIs de la APP para el panel: dispositivos, pedidos desde la app vs web,
// productos exclusivos y últimas notificaciones. GET ?restaurantId=&days=30
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/adminAuth";
import { teamMemberCanAccess } from "@/lib/ecommerce/panelAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertOwnership(req: NextRequest, restaurantId: string): Promise<boolean> {
  if (isSuperAdmin(req)) return true;
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return false;
  if (panelId === "demo") return true;
  if (panelId.startsWith("tm_")) return teamMemberCanAccess(panelId.slice(3), restaurantId);
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

const CANCELLED = ["CANCELED", "CANCELLED", "REJECTED", "canceled", "cancelled", "rejected"];
const ymd = (d: Date) => new Date(d.toLocaleString("en-US", { timeZone: "America/Santiago" })).toISOString().slice(0, 10);

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  const days = Math.min(365, Math.max(1, parseInt(req.nextUrl.searchParams.get("days") || "30", 10) || 30));
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [totalDev, iosDev, androidDev, optedIn, newDev, activeDev, exclusives, orders, notifs] = await Promise.all([
    prisma.appDevice.count({ where: { restaurantId } }),
    prisma.appDevice.count({ where: { restaurantId, platform: "ios" } }),
    prisma.appDevice.count({ where: { restaurantId, platform: "android" } }),
    prisma.appDevice.count({ where: { restaurantId, optedIn: true } }),
    prisma.appDevice.count({ where: { restaurantId, createdAt: { gte: from } } }),
    prisma.appDevice.count({ where: { restaurantId, lastSeenAt: { gte: from } } }),
    prisma.dish.count({ where: { restaurantId, deletedAt: null, OR: [{ appOnly: true }, { appPrice: { gt: 0 } }] } }),
    prisma.onlineOrder.findMany({
      where: { restaurantId, source: "ecommerce", createdAt: { gte: from }, status: { notIn: CANCELLED } },
      orderBy: { createdAt: "desc" },
      select: { id: true, fromApp: true, total: true, createdAt: true, items: true, customerName: true, customerPhone: true, status: true, orderType: true },
    }),
    prisma.appPushLog.findMany({ where: { restaurantId }, orderBy: { createdAt: "desc" }, take: 10, select: { title: true, sent: true, total: true, createdAt: true } }),
  ]);

  // Pedidos: app vs web (tienda ecommerce), ingresos, ticket promedio, serie diaria.
  let appOrders = 0, appRevenue = 0, webOrders = 0, webRevenue = 0;
  const byDay = new Map<string, { app: number; web: number }>();
  for (let i = days - 1; i >= 0; i--) byDay.set(ymd(new Date(Date.now() - i * 864e5)), { app: 0, web: 0 });
  // Top productos + compradores únicos + listado (solo pedidos de la app).
  const prodMap = new Map<string, { name: string; qty: number; revenue: number }>();
  const appBuyers = new Set<string>();
  const appList: { id: string; customer: string; phone: string; total: number; status: string; orderType: string; createdAt: Date }[] = [];
  for (const o of orders) {
    const k = ymd(o.createdAt);
    const slot = byDay.get(k);
    if (o.fromApp) {
      appOrders++; appRevenue += o.total || 0; if (slot) slot.app++;
      if (o.customerPhone) appBuyers.add(o.customerPhone);
      if (appList.length < 50) appList.push({ id: o.id, customer: o.customerName || "—", phone: o.customerPhone || "", total: o.total || 0, status: o.status, orderType: o.orderType, createdAt: o.createdAt });
      const items = Array.isArray(o.items) ? (o.items as any[]) : [];
      for (const it of items) {
        const name = String(it?.dishName || it?.name || "Ítem").trim() || "Ítem";
        const key = String(it?.product_id || name);
        const qty = Math.max(1, Math.round(Number(it?.quantity) || 1));
        const rev = (Number(it?.unitTotal ?? it?.unit_price) || 0) * qty;
        const cur = prodMap.get(key) || { name, qty: 0, revenue: 0 };
        cur.qty += qty; cur.revenue += rev; cur.name = name;
        prodMap.set(key, cur);
      }
    } else { webOrders++; webRevenue += o.total || 0; if (slot) slot.web++; }
  }
  const totalOrders = appOrders + webOrders;
  const topProducts = Array.from(prodMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 5);
  const conversionPct = totalDev ? Math.round((appBuyers.size / totalDev) * 100) : 0;

  return NextResponse.json({
    days,
    devices: { total: totalDev, ios: iosDev, android: androidDev, optedIn, new: newDev, active: activeDev },
    orders: {
      app: appOrders, appRevenue, appAov: appOrders ? Math.round(appRevenue / appOrders) : 0,
      web: webOrders, webRevenue, webAov: webOrders ? Math.round(webRevenue / webOrders) : 0,
      total: totalOrders, appSharePct: totalOrders ? Math.round((appOrders / totalOrders) * 100) : 0,
      series: Array.from(byDay.entries()).map(([date, v]) => ({ date, ...v })),
    },
    conversion: { buyers: appBuyers.size, devices: totalDev, pct: conversionPct },
    topProducts,
    appOrdersList: appList,
    exclusiveProducts: exclusives,
    notifications: notifs,
  });
}
