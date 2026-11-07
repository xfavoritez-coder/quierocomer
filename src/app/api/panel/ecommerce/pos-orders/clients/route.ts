import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { teamMemberCanAccess } from "@/lib/ecommerce/panelAuth";
import { isSuperAdmin } from "@/lib/adminAuth";

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

export interface ClientRow {
  email: string;
  name: string;
  phone: string;
  orders: number;
  totalSpent: number;
  avgTicket: number;
  lastOrderAt: string; // ISO
  daysSinceLastOrder: number;
  avgFrequencyDays: number | null; // null si solo tiene 1 pedido
  status: "active" | "at_risk" | "churned" | "new";
  riskScore: number; // 0–100; mayor = más en riesgo
}

function computeStatus(daysSince: number, freq: number | null): ClientRow["status"] {
  if (freq === null) return "new"; // solo 1 pedido
  const ratio = daysSince / freq;
  if (ratio < 1.5) return "active";
  if (ratio < 3) return "at_risk";
  return "churned";
}

function computeRisk(daysSince: number, freq: number | null, orders: number): number {
  if (freq === null) return 0;
  const overdueDays = Math.max(0, daysSince - freq);
  // Normalizar a 0-100: más riesgo si lleva más tiempo que su frecuencia usual
  const rawRatio = overdueDays / Math.max(1, freq);
  const base = Math.min(100, Math.round(rawRatio * 60));
  // Bonus riesgo para clientes valiosos (más pedidos = más duele perderlos)
  const valuableBonus = Math.min(15, Math.round(Math.log(orders) * 4));
  return Math.min(100, base + valuableBonus);
}

/** GET /api/panel/ecommerce/pos-orders/clients?restaurantId=X&limit=200 */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const limit = Math.min(500, parseInt(req.nextUrl.searchParams.get("limit") ?? "200", 10) || 200);

  // Traer todos los pedidos no cancelados con email o teléfono, del restaurantId
  const posOrders = await prisma.posOrder.findMany({
    where: {
      restaurantId,
      posStatus: { not: "canceled" },
      OR: [
        { customerEmail: { not: "" } },
        { customerPhone: { not: "" } },
      ],
    },
    select: {
      externalId: true,
      customerEmail: true,
      customerName: true,
      customerPhone: true,
      totalAmount: true,
      deliveryFee: true,
      tipAmount: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Pedido normalizado para agrupar clientes desde ambas fuentes.
  interface NormOrder { email: string; name: string; phone: string; net: number; createdAt: Date }
  const orders: NormOrder[] = posOrders.map((o) => ({
    email: o.customerEmail || "",
    name: o.customerName || "",
    phone: o.customerPhone || "",
    net: Math.max(0, (o.totalAmount || 0) - (o.deliveryFee || 0) - (o.tipAmount || 0)),
    createdAt: o.createdAt,
  }));

  // OnlineOrder (ecommerce nativo) NO espejados al POS — para locales sin Centro/POS
  // (ej. Hand Roll) todos sus clientes viven aquí. Dedup por externalId "oo-<id>".
  const mirroredOnlineIds = new Set<string>();
  for (const o of posOrders) {
    if (o.externalId && o.externalId.startsWith("oo-")) mirroredOnlineIds.add(o.externalId.slice(3));
  }
  const onlineOrders = await prisma.onlineOrder.findMany({
    where: {
      restaurantId, source: "ecommerce",
      status: { not: "CANCELLED" },
      OR: [{ paymentStatus: "paid" }, { paymentMethod: { notIn: ["webpay", "flow", "mercadopago"] } }],
    },
    select: { id: true, customerEmail: true, customerName: true, customerPhone: true, total: true, deliveryFee: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  for (const o of onlineOrders) {
    if (mirroredOnlineIds.has(o.id)) continue;
    if (!(o.customerEmail?.trim() || o.customerPhone?.trim())) continue;
    orders.push({
      email: o.customerEmail || "",
      name: o.customerName || "",
      phone: o.customerPhone || "",
      net: Math.max(0, (o.total || 0) - (o.deliveryFee || 0)),
      createdAt: o.createdAt,
    });
  }
  orders.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  // Agrupar por email (si no hay email, agrupar por teléfono)
  const clientMap = new Map<string, {
    email: string; name: string; phone: string;
    orders: number; totalSpent: number;
    firstAt: Date; lastAt: Date;
    dates: Date[];
  }>();

  for (const o of orders) {
    const key = o.email.trim().toLowerCase() || o.phone.trim() || "";
    if (!key) continue;

    const net = o.net;
    const existing = clientMap.get(key);
    if (existing) {
      existing.orders++;
      existing.totalSpent += net;
      if (o.createdAt > existing.lastAt) {
        existing.lastAt = o.createdAt;
        if (o.name) existing.name = o.name;
        if (o.phone) existing.phone = o.phone;
      }
      existing.dates.push(o.createdAt);
    } else {
      clientMap.set(key, {
        email: o.email.trim().toLowerCase() || "",
        name: o.name || "",
        phone: o.phone || "",
        orders: 1,
        totalSpent: net,
        firstAt: o.createdAt,
        lastAt: o.createdAt,
        dates: [o.createdAt],
      });
    }
  }

  const now = new Date();

  const clients: ClientRow[] = Array.from(clientMap.values()).map((c) => {
    // Frecuencia media: promedio de intervalos entre pedidos consecutivos
    let avgFreq: number | null = null;
    if (c.dates.length >= 2) {
      const sorted = c.dates.slice().sort((a, b) => a.getTime() - b.getTime());
      let totalGap = 0;
      for (let i = 1; i < sorted.length; i++) {
        totalGap += (sorted[i].getTime() - sorted[i - 1].getTime()) / 86400000;
      }
      // Math.max(1, ...) evita 0 cuando dos pedidos son el mismo día
      avgFreq = Math.max(1, Math.round(totalGap / (sorted.length - 1)));
    }

    // Comparar fechas de calendario en zona Santiago para evitar que pedidos
    // de "ayer a las 23h" aparezcan como "Hoy" por diferencia UTC < 24h
    const fmt = (d: Date) =>
      new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(d)
    const nowCalendar  = new Date(`${fmt(now)}T12:00:00Z`)
    const lastCalendar = new Date(`${fmt(c.lastAt)}T12:00:00Z`)
    const daysSince = Math.round((nowCalendar.getTime() - lastCalendar.getTime()) / 86400000);
    const status = computeStatus(daysSince, avgFreq);
    const riskScore = computeRisk(daysSince, avgFreq, c.orders);

    return {
      email: c.email,
      name: c.name,
      phone: c.phone,
      orders: c.orders,
      totalSpent: c.totalSpent,
      avgTicket: c.orders > 0 ? Math.round(c.totalSpent / c.orders) : 0,
      lastOrderAt: c.lastAt.toISOString(),
      daysSinceLastOrder: daysSince,
      avgFrequencyDays: avgFreq,
      status,
      riskScore,
    };
  });

  // Ordenar por riesgo desc, luego por totalSpent desc
  clients.sort((a, b) => {
    if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
    return b.totalSpent - a.totalSpent;
  });

  const total = clients.length;
  const sliced = clients.slice(0, limit);

  // Resumen
  const byStatus = {
    active:   clients.filter(c => c.status === "active").length,
    at_risk:  clients.filter(c => c.status === "at_risk").length,
    churned:  clients.filter(c => c.status === "churned").length,
    new:      clients.filter(c => c.status === "new").length,
  };

  return NextResponse.json({ total, byStatus, clients: sliced });
}
