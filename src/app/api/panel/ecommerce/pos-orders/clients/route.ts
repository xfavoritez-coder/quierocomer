import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { teamMemberCanAccess } from "@/lib/ecommerce/panelAuth";
import { isSuperAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 60-second server-side cache: avoid re-scanning all orders on every page navigation
const _cache = new Map<string, { ts: number; data: unknown }>();
const CACHE_TTL = 60_000;

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
  avgFrequencyDays: number | null;
  status: "active" | "at_risk" | "churned" | "new";
  riskScore: number;
  topProduct: string | null;
}

function computeStatus(daysSince: number, freq: number | null): ClientRow["status"] {
  if (freq === null) return "new";
  const ratio = daysSince / freq;
  if (ratio < 1.5) return "active";
  if (ratio < 3) return "at_risk";
  return "churned";
}

function computeRisk(daysSince: number, freq: number | null, orders: number): number {
  if (freq === null) return 0;
  const overdueDays = Math.max(0, daysSince - freq);
  const rawRatio = overdueDays / Math.max(1, freq);
  const base = Math.min(100, Math.round(rawRatio * 60));
  const valuableBonus = Math.min(15, Math.round(Math.log(orders) * 4));
  return Math.min(100, base + valuableBonus);
}

/** GET /api/panel/ecommerce/pos-orders/clients
 *  Params: restaurantId (required)
 *          search    (optional, busca por nombre/email/teléfono)
 *          page      (default 0)
 *          pageSize  (default 10, max 50)
 *          sortKey   (riskScore|totalSpent|orders|lastOrderAt|avgFrequencyDays|avgTicket)
 *          sortAsc   (0|1, default 0)
 */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const rawSearch  = (req.nextUrl.searchParams.get("search") ?? "").trim();
  const pageSize   = Math.min(50, Math.max(1, parseInt(req.nextUrl.searchParams.get("pageSize") ?? "10", 10) || 10));
  const page       = Math.max(0, parseInt(req.nextUrl.searchParams.get("page") ?? "0", 10) || 0);
  const sortKey    = req.nextUrl.searchParams.get("sortKey") ?? "riskScore";
  const sortAsc    = req.nextUrl.searchParams.get("sortAsc") === "1";

  // ── Cache key: per restaurant, sort-independent (filtering/sort happens in-memory) ──
  const cacheKey = restaurantId;
  const cached = _cache.get(cacheKey);
  const nowMs = Date.now();

  interface NormOrder { email: string; name: string; phone: string; net: number; createdAt: Date }
  let orders: NormOrder[];

  if (cached && nowMs - cached.ts < CACHE_TTL) {
    orders = cached.data as NormOrder[];
  } else {
    // ── Cargar pedidos (en paralelo) ──────────────────────────────────────
    const [posOrders, onlineOrders] = await Promise.all([
      prisma.posOrder.findMany({
        where: {
          restaurantId,
          posStatus: { not: "canceled" },
          OR: [{ customerEmail: { not: "" } }, { customerPhone: { not: "" } }],
        },
        select: {
          externalId: true, customerEmail: true, customerName: true,
          customerPhone: true, totalAmount: true, deliveryFee: true,
          tipAmount: true, createdAt: true, items: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.onlineOrder.findMany({
        where: {
          restaurantId, source: "ecommerce",
          status: { not: "CANCELLED" },
          OR: [{ paymentStatus: "paid" }, { paymentMethod: { notIn: ["webpay", "flow", "mercadopago"] } }],
        },
        select: { id: true, customerEmail: true, customerName: true, customerPhone: true, total: true, deliveryFee: true, createdAt: true, items: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const mirroredOnlineIds = new Set<string>();
    for (const o of posOrders) {
      if (o.externalId?.startsWith("oo-")) mirroredOnlineIds.add(o.externalId.slice(3));
    }

    orders = posOrders.map((o) => ({
      email: o.customerEmail || "",
      name:  o.customerName  || "",
      phone: o.customerPhone || "",
      net:   Math.max(0, (o.totalAmount || 0) - (o.deliveryFee || 0) - (o.tipAmount || 0)),
      createdAt: o.createdAt,
      items: o.items,
    }));

    for (const o of onlineOrders) {
      if (mirroredOnlineIds.has(o.id)) continue;
      if (!(o.customerEmail?.trim() || o.customerPhone?.trim())) continue;
      orders.push({
        email: o.customerEmail || "",
        name:  o.customerName  || "",
        phone: o.customerPhone || "",
        net:   Math.max(0, (o.total || 0) - (o.deliveryFee || 0)),
        createdAt: o.createdAt,
        items: o.items,
      });
    }
    orders.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    _cache.set(cacheKey, { ts: nowMs, data: orders });
  }

  // ── Agrupar por cliente ─────────────────────────────────────────────
  function extractItemNames(items: unknown): string[] {
    if (!Array.isArray(items)) return [];
    return items.map((it) => {
      const o = (it || {}) as Record<string, unknown>;
      const qty = Number(o.quantity ?? o.qty ?? 1) || 1;
      const name = String(o.name ?? o.productName ?? o.title ?? o.description ?? '');
      return name ? Array(qty).fill(name) : [];
    }).flat();
  }

  const clientMap = new Map<string, {
    email: string; name: string; phone: string;
    orders: number; totalSpent: number;
    firstAt: Date; lastAt: Date; dates: Date[];
    productCounts: Map<string, number>;
  }>();

  for (const o of orders) {
    const key = o.email.trim().toLowerCase() || o.phone.trim() || "";
    if (!key) continue;
    const itemNames = extractItemNames(o.items);
    const existing = clientMap.get(key);
    if (existing) {
      existing.orders++;
      existing.totalSpent += o.net;
      if (o.createdAt > existing.lastAt) {
        existing.lastAt = o.createdAt;
        if (o.name)  existing.name  = o.name;
        if (o.phone) existing.phone = o.phone;
      }
      existing.dates.push(o.createdAt);
      for (const n of itemNames) existing.productCounts.set(n, (existing.productCounts.get(n) ?? 0) + 1);
    } else {
      const productCounts = new Map<string, number>();
      for (const n of itemNames) productCounts.set(n, (productCounts.get(n) ?? 0) + 1);
      clientMap.set(key, {
        email: o.email.trim().toLowerCase() || "",
        name:  o.name  || "",
        phone: o.phone || "",
        orders: 1, totalSpent: o.net,
        firstAt: o.createdAt, lastAt: o.createdAt,
        dates: [o.createdAt],
        productCounts,
      });
    }
  }

  const now = new Date();
  const fmtDate = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(d);
  const nowCalendar = new Date(`${fmtDate(now)}T12:00:00Z`);

  const allClients: ClientRow[] = Array.from(clientMap.values()).map((c) => {
    let avgFreq: number | null = null;
    if (c.dates.length >= 2) {
      const sorted = c.dates.slice().sort((a, b) => a.getTime() - b.getTime());
      let totalGap = 0;
      for (let i = 1; i < sorted.length; i++)
        totalGap += (sorted[i].getTime() - sorted[i - 1].getTime()) / 86400000;
      avgFreq = Math.max(1, Math.round(totalGap / (sorted.length - 1)));
    }
    const lastCalendar = new Date(`${fmtDate(c.lastAt)}T12:00:00Z`);
    const daysSince = Math.round((nowCalendar.getTime() - lastCalendar.getTime()) / 86400000);
    return {
      email: c.email, name: c.name, phone: c.phone,
      orders: c.orders, totalSpent: c.totalSpent,
      avgTicket: c.orders > 0 ? Math.round(c.totalSpent / c.orders) : 0,
      lastOrderAt: c.lastAt.toISOString(),
      daysSinceLastOrder: Math.max(0, daysSince),
      avgFrequencyDays: avgFreq,
      status: computeStatus(daysSince, avgFreq),
      riskScore: computeRisk(daysSince, avgFreq, c.orders),
      topProduct: c.productCounts.size > 0
        ? [...c.productCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
        : null,
    };
  });

  // ── Summary stats (siempre desde todos los clientes) ────────────────
  const total = allClients.length;
  const byStatus = {
    active:  allClients.filter(c => c.status === "active").length,
    at_risk: allClients.filter(c => c.status === "at_risk").length,
    churned: allClients.filter(c => c.status === "churned").length,
    new:     allClients.filter(c => c.status === "new").length,
  };
  const avgTicketGlobal = total > 0
    ? Math.round(allClients.reduce((s, c) => s + c.avgTicket, 0) / total)
    : 0;

  // Top 5 VIP
  const bySpend = allClients.slice().sort((a, b) => b.totalSpent - a.totalSpent);
  const top3 = bySpend.slice(0, 5);

  // 80/20
  const totalSpentAll = allClients.reduce((s, c) => s + c.totalSpent, 0);
  const target80 = totalSpentAll * 0.8;
  let acc80 = 0, count80 = 0;
  for (const c of bySpend) { acc80 += c.totalSpent; count80++; if (acc80 >= target80) break; }
  const pct80clients = total > 0 ? Math.round((count80 / total) * 100) : 0;

  // Los más fieles
  const fieles = allClients
    .filter(c => c.avgFrequencyDays !== null && c.orders >= 3)
    .sort((a, b) => (a.avgFrequencyDays ?? 999) - (b.avgFrequencyDays ?? 999))
    .slice(0, 5);

  // A recuperar
  const aRecuperar = allClients
    .filter(c => (c.status === "at_risk" || c.status === "churned") && c.orders >= 3)
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 5);

  // ── Filtro + orden + paginación del directorio ──────────────────────
  const searchLower = rawSearch.toLowerCase();
  const searchFiltered = rawSearch
    ? allClients.filter(c =>
        c.name.toLowerCase().includes(searchLower) ||
        c.email.toLowerCase().includes(searchLower) ||
        c.phone.toLowerCase().includes(searchLower)
      )
    : allClients;

  // Orden del directorio (default: riskScore desc)
  const sortFn = (a: ClientRow, b: ClientRow): number => {
    let av: number, bv: number;
    if (sortKey === "lastOrderAt") {
      av = new Date(a.lastOrderAt).getTime();
      bv = new Date(b.lastOrderAt).getTime();
    } else {
      av = (a as any)[sortKey] ?? 0;
      bv = (b as any)[sortKey] ?? 0;
    }
    return sortAsc ? av - bv : bv - av;
  };
  const dirSorted = searchFiltered.slice().sort(sortFn);
  const filtered  = dirSorted.length;
  const clients   = dirSorted.slice(page * pageSize, (page + 1) * pageSize);

  return NextResponse.json({
    total, filtered, byStatus, avgTicketGlobal,
    top3, fieles, aRecuperar, count80, pct80clients,
    clients,
  });
}
