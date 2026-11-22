import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { teamMemberCanAccess } from "@/lib/ecommerce/panelAuth";
import { isSuperAdmin } from "@/lib/adminAuth";
import { phoneKey } from "@/lib/ecommerce/phoneCL";

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
  firstOrderAt: string; // ISO
  daysSinceLastOrder: number;
  avgFrequencyDays: number | null;
  status: "active" | "at_risk" | "churned" | "new";
  riskScore: number;
  score: number;
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

  const rawBranchIds = req.nextUrl.searchParams.get("branchIds") || "";
  const extraIds = rawBranchIds ? rawBranchIds.split(",").map(s => s.trim()).filter(Boolean) : [];

  // ── Sucursales hermanas: si no vienen branchIds, buscar por ownerId ───
  // Esto permite que al ver Providencia se crucen datos de Recoleta para
  // calcular status (recurrente vs nuevo) correctamente a nivel de marca.
  let allIds: string[];
  if (extraIds.length > 0) {
    allIds = Array.from(new Set([restaurantId, ...extraIds]));
  } else {
    const thisR = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
    if (thisR?.ownerId) {
      const siblings = await prisma.restaurant.findMany({ where: { ownerId: thisR.ownerId, orderingEnabled: true }, select: { id: true } });
      allIds = siblings.length > 1 ? siblings.map(s => s.id) : [restaurantId];
    } else {
      allIds = [restaurantId];
    }
  }
  // viewIds: las sucursales que el usuario está viendo (para filtrar clientes mostrados)
  const viewIds = new Set(extraIds.length > 0 ? allIds : [restaurantId]);

  // ── Cache key: per restaurant + branches, sort-independent (filtering/sort happens in-memory) ──
  const cacheKey = allIds.slice().sort().join(',');
  const cached = _cache.get(cacheKey);
  const nowMs = Date.now();

  interface NormOrder { email: string; name: string; phone: string; net: number; createdAt: Date; items?: unknown; rid: string }
  let orders: NormOrder[];

  if (cached && nowMs - cached.ts < CACHE_TTL) {
    orders = cached.data as NormOrder[];
  } else {
    // ── Cargar pedidos (en paralelo) ──────────────────────────────────────
    const [posOrders, onlineOrders] = await Promise.all([
      prisma.posOrder.findMany({
        where: {
          restaurantId: { in: allIds },
          posStatus: { not: "canceled" },
          OR: [{ customerEmail: { not: "" } }, { customerPhone: { not: "" } }],
        },
        select: {
          restaurantId: true, externalId: true, customerEmail: true, customerName: true,
          customerPhone: true, totalAmount: true, deliveryFee: true,
          tipAmount: true, createdAt: true, items: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.onlineOrder.findMany({
        where: {
          restaurantId: { in: allIds }, source: "ecommerce",
          status: { not: "CANCELLED" },
          OR: [{ paymentStatus: "paid" }, { paymentMethod: { notIn: ["webpay", "flow", "mercadopago"] } }],
        },
        select: { id: true, restaurantId: true, customerEmail: true, customerName: true, customerPhone: true, total: true, deliveryFee: true, createdAt: true, items: true },
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
      rid: o.restaurantId,
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
        rid: o.restaurantId,
      });
    }
    orders.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    _cache.set(cacheKey, { ts: nowMs, data: orders });
  }

  // ── Agrupar por cliente (Union-Find transitivo) ────────────────────
  // Dos pedidos pertenecen al mismo cliente si comparten:
  //   • mismo email (normalizado), O
  //   • mismo teléfono (normalizado a 9 dígitos)
  // La relación es transitiva: si A comparte email con B y B comparte
  // teléfono con C, los tres se fusionan en un único perfil.

  function extractItemNames(items: unknown): string[] {
    if (!Array.isArray(items)) return [];
    return items.map((it) => {
      const o = (it || {}) as Record<string, unknown>;
      const qty = Number(o.quantity ?? o.qty ?? 1) || 1;
      const name = String(o.name ?? o.productName ?? o.title ?? o.description ?? '');
      return name ? Array(qty).fill(name) : [];
    }).flat();
  }

  // Union-Find
  const parent: number[] = [];
  const rank: number[] = [];
  function makeSet() { const i = parent.length; parent.push(i); rank.push(0); return i; }
  function find(x: number): number { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
  function union(a: number, b: number) {
    const ra = find(a), rb = find(b);
    if (ra === rb) return;
    if (rank[ra] < rank[rb]) parent[ra] = rb;
    else if (rank[ra] > rank[rb]) parent[rb] = ra;
    else { parent[rb] = ra; rank[ra]++; }
  }

  // Asignar un índice UF a cada pedido y construir mapas de lookup
  const emailToIdx = new Map<string, number>();  // email → primer índice
  const phoneToIdx = new Map<string, number>();  // phoneKey → primer índice

  for (let i = 0; i < orders.length; i++) {
    makeSet();
    const o = orders[i];
    const em = o.email.trim().toLowerCase();
    const pk = phoneKey(o.phone);

    // Fusionar por email compartido
    if (em) {
      const prev = emailToIdx.get(em);
      if (prev !== undefined) union(i, prev);
      else emailToIdx.set(em, i);
    }
    // Fusionar por teléfono compartido
    if (pk) {
      const prev = phoneToIdx.get(pk);
      if (prev !== undefined) union(i, prev);
      else phoneToIdx.set(pk, i);
    }
  }

  // Agrupar pedidos por raíz UF → un cliente por cluster
  type ClientAcc = {
    email: string; name: string; phone: string;
    orders: number; totalSpent: number;
    firstAt: Date; lastAt: Date; dates: Date[];
    productCounts: Map<string, number>;
    inView: boolean; // tiene al menos 1 pedido en las sucursales que se están viendo
  };
  const clientMap = new Map<number, ClientAcc>();

  for (let i = 0; i < orders.length; i++) {
    const o = orders[i];
    const em = o.email.trim().toLowerCase();
    const pk = phoneKey(o.phone);
    if (!em && !pk) continue; // sin identificador → skip
    const root = find(i);
    const itemNames = extractItemNames(o.items);
    const isInView = viewIds.has(o.rid);
    const existing = clientMap.get(root);
    if (existing) {
      existing.orders++;
      existing.totalSpent += o.net;
      if (isInView) existing.inView = true;
      if (o.createdAt > existing.lastAt) {
        existing.lastAt = o.createdAt;
        if (o.name)  existing.name  = o.name;
        if (o.phone) existing.phone = o.phone;
      }
      // Preferir email si no tenía uno
      if (em && !existing.email) existing.email = em;
      existing.dates.push(o.createdAt);
      for (const n of itemNames) existing.productCounts.set(n, (existing.productCounts.get(n) ?? 0) + 1);
    } else {
      const productCounts = new Map<string, number>();
      for (const n of itemNames) productCounts.set(n, (productCounts.get(n) ?? 0) + 1);
      clientMap.set(root, {
        email: em,
        name:  o.name  || "",
        phone: o.phone || "",
        orders: 1, totalSpent: o.net,
        firstAt: o.createdAt, lastAt: o.createdAt,
        dates: [o.createdAt],
        productCounts,
        inView: isInView,
      });
    }
  }

  // Filtrar: solo clientes que pidieron en las sucursales vistas
  for (const [root, c] of clientMap) {
    if (!c.inView) clientMap.delete(root);
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
    const totalSpent = c.totalSpent;
    const orders = c.orders;
    return {
      email: c.email, name: c.name, phone: c.phone,
      orders, totalSpent,
      avgTicket: orders > 0 ? Math.round(totalSpent / orders) : 0,
      lastOrderAt: c.lastAt.toISOString(),
      firstOrderAt: c.firstAt.toISOString(),
      daysSinceLastOrder: Math.max(0, daysSince),
      avgFrequencyDays: avgFreq,
      status: computeStatus(daysSince, avgFreq),
      riskScore: computeRisk(daysSince, avgFreq, orders),
      score: Math.round(totalSpent * Math.log(orders + 1)),
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
  const top5 = allClients.slice().sort((a, b) => b.score - a.score).slice(0, 5);

  // 80/20
  const bySpendFor80 = allClients.slice().sort((a, b) => b.totalSpent - a.totalSpent);
  const totalSpentAll = allClients.reduce((s, c) => s + c.totalSpent, 0);
  const target80 = totalSpentAll * 0.8;
  let acc80 = 0, count80 = 0;
  for (const c of bySpendFor80) { acc80 += c.totalSpent; count80++; if (acc80 >= target80) break; }
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
    top5, fieles, aRecuperar, count80, pct80clients,
    clients,
  });
}
