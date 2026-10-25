import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

// Estados que representan un pedido real (no intentos de pago fallidos ni cancelados).
const REAL_STATUSES = ["ACCEPTED", "PREPARING", "READY", "IN_DELIVERY", "DONE"];

interface Cust {
  key: string; name: string; phone: string; email: string | null;
  orders: number; totalSpent: number; firstOrder: string; lastOrder: string; channels: Set<string>;
}

/** GET /api/panel/ecommerce/customers-report?restaurantId= → clientes agregados por teléfono. */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const orders = await prisma.onlineOrder.findMany({
    where: { restaurantId, source: "ecommerce", status: { in: REAL_STATUSES } },
    orderBy: { createdAt: "desc" },
    select: { customerName: true, customerPhone: true, customerEmail: true, total: true, createdAt: true, channel: true },
    take: 10000,
  });

  const map = new Map<string, Cust>();
  for (const o of orders) {
    const digits = (o.customerPhone || "").replace(/\D/g, "");
    const key = digits || (o.customerEmail || "").trim().toLowerCase() || (o.customerName || "").trim().toLowerCase();
    if (!key) continue;
    const iso = o.createdAt.toISOString();
    const ex = map.get(key);
    if (ex) {
      ex.orders++;
      ex.totalSpent += o.total || 0;
      if (iso < ex.firstOrder) ex.firstOrder = iso;
      if (iso > ex.lastOrder) ex.lastOrder = iso;
      ex.channels.add(o.channel || "online");
      if (!ex.name && o.customerName) ex.name = o.customerName;
    } else {
      map.set(key, {
        key, name: (o.customerName || "").trim() || "Sin nombre", phone: o.customerPhone || "", email: o.customerEmail || null,
        orders: 1, totalSpent: o.total || 0, firstOrder: iso, lastOrder: iso, channels: new Set([o.channel || "online"]),
      });
    }
  }

  const customers = Array.from(map.values())
    .map((c) => ({
      name: c.name, phone: c.phone, email: c.email,
      orders: c.orders, totalSpent: Math.round(c.totalSpent),
      avgTicket: Math.round(c.totalSpent / c.orders),
      firstOrder: c.firstOrder, lastOrder: c.lastOrder,
      manualOnly: c.channels.size === 1 && c.channels.has("manual"),
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent);

  const totalCustomers = customers.length;
  const recurring = customers.filter((c) => c.orders >= 2).length;
  const totalRevenue = customers.reduce((s, c) => s + c.totalSpent, 0);
  const totalOrders = customers.reduce((s, c) => s + c.orders, 0);

  return NextResponse.json({
    summary: {
      totalCustomers,
      recurring,
      recurringPct: totalCustomers ? Math.round((recurring / totalCustomers) * 100) : 0,
      avgOrdersPerCustomer: totalCustomers ? Math.round((totalOrders / totalCustomers) * 10) / 10 : 0,
      avgSpentPerCustomer: totalCustomers ? Math.round(totalRevenue / totalCustomers) : 0,
      totalRevenue, totalOrders,
    },
    customers,
  });
}
