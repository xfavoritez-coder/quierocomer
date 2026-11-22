// ═══════════════════════════════════════════════════════════
//  Segmentación de clientes — módulo compartido.
//  Reutiliza la lógica de Union-Find, cálculo de frecuencia,
//  status y risk. Usado por el cron de recuperación y el
//  endpoint de clientes del panel.
// ═══════════════════════════════════════════════════════════
import { prisma } from "@/lib/prisma";
import { phoneKey } from "@/lib/ecommerce/phoneCL";

export interface ClientRow {
  email: string;
  name: string;
  phone: string;
  orders: number;
  totalSpent: number;
  avgTicket: number;
  lastOrderAt: string;
  firstOrderAt: string;
  daysSinceLastOrder: number;
  avgFrequencyDays: number | null;
  status: "active" | "at_risk" | "churned" | "new";
  riskScore: number;
  score: number;
  topProduct: string | null;
}

export function computeStatus(daysSince: number, freq: number | null): ClientRow["status"] {
  if (freq === null) return "new";
  const ratio = daysSince / freq;
  if (ratio < 1.5) return "active";
  if (ratio < 3) return "at_risk";
  return "churned";
}

export function computeRisk(daysSince: number, freq: number | null, orders: number): number {
  if (freq === null) return 0;
  const overdueDays = Math.max(0, daysSince - freq);
  const rawRatio = overdueDays / Math.max(1, freq);
  const base = Math.min(100, Math.round(rawRatio * 60));
  const valuableBonus = Math.min(15, Math.round(Math.log(orders) * 4));
  return Math.min(100, base + valuableBonus);
}

// ── Helpers ──

interface NormOrder { email: string; name: string; phone: string; net: number; createdAt: Date; items?: unknown; rid: string }

function extractItemNames(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items.map((it) => {
    const o = (it || {}) as Record<string, unknown>;
    const qty = Number(o.quantity ?? o.qty ?? 1) || 1;
    const name = String(o.name ?? o.productName ?? o.title ?? o.description ?? "");
    return name ? Array(qty).fill(name) : [];
  }).flat();
}

/** Resuelve IDs de todas las sucursales de la misma marca (por ownerId). */
export async function resolveBrandIds(restaurantId: string): Promise<string[]> {
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  if (!r?.ownerId) return [restaurantId];
  const siblings = await prisma.restaurant.findMany({ where: { ownerId: r.ownerId }, select: { id: true } });
  return siblings.length > 1 ? siblings.map(s => s.id) : [restaurantId];
}

/**
 * Obtiene todos los clientes segmentados de un restaurante (y sus sucursales hermanas).
 * Devuelve un ClientRow[] con status, riskScore, avgFrequencyDays, etc.
 * Parámetro `filterBranchIds`: si se pasa, solo devuelve clientes que hayan
 * pedido en al menos una de esas sucursales (pero stats son globales de marca).
 */
export async function getClientSegmentation(restaurantId: string, filterBranchIds?: string[]): Promise<ClientRow[]> {
  const allIds = await resolveBrandIds(restaurantId);
  const viewIds = filterBranchIds ? new Set(filterBranchIds) : null;

  // Cargar pedidos
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

  const orders: NormOrder[] = posOrders.map((o) => ({
    email: o.customerEmail || "", name: o.customerName || "", phone: o.customerPhone || "",
    net: Math.max(0, (o.totalAmount || 0) - (o.deliveryFee || 0) - (o.tipAmount || 0)),
    createdAt: o.createdAt, items: o.items, rid: o.restaurantId,
  }));

  for (const o of onlineOrders) {
    if (mirroredOnlineIds.has(o.id)) continue;
    if (!(o.customerEmail?.trim() || o.customerPhone?.trim())) continue;
    orders.push({
      email: o.customerEmail || "", name: o.customerName || "", phone: o.customerPhone || "",
      net: Math.max(0, (o.total || 0) - (o.deliveryFee || 0)),
      createdAt: o.createdAt, items: o.items, rid: o.restaurantId,
    });
  }
  orders.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

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

  const emailToIdx = new Map<string, number>();
  const phoneToIdx = new Map<string, number>();

  for (let i = 0; i < orders.length; i++) {
    makeSet();
    const o = orders[i];
    const em = o.email.trim().toLowerCase();
    const pk = phoneKey(o.phone);
    if (em) { const prev = emailToIdx.get(em); if (prev !== undefined) union(i, prev); else emailToIdx.set(em, i); }
    if (pk) { const prev = phoneToIdx.get(pk); if (prev !== undefined) union(i, prev); else phoneToIdx.set(pk, i); }
  }

  // Agrupar
  type ClientAcc = {
    email: string; name: string; phone: string;
    orders: number; totalSpent: number;
    firstAt: Date; lastAt: Date; dates: Date[];
    productCounts: Map<string, number>;
    inView: boolean;
  };
  const clientMap = new Map<number, ClientAcc>();

  for (let i = 0; i < orders.length; i++) {
    const o = orders[i];
    const em = o.email.trim().toLowerCase();
    const pk = phoneKey(o.phone);
    if (!em && !pk) continue;
    const root = find(i);
    const itemNames = extractItemNames(o.items);
    const isInView = viewIds ? viewIds.has(o.rid) : true;
    const existing = clientMap.get(root);
    if (existing) {
      existing.orders++;
      existing.totalSpent += o.net;
      if (isInView) existing.inView = true;
      if (o.createdAt > existing.lastAt) {
        existing.lastAt = o.createdAt;
        if (o.name) existing.name = o.name;
        if (o.phone) existing.phone = o.phone;
      }
      if (em && !existing.email) existing.email = em;
      existing.dates.push(o.createdAt);
      for (const n of itemNames) existing.productCounts.set(n, (existing.productCounts.get(n) ?? 0) + 1);
    } else {
      const productCounts = new Map<string, number>();
      for (const n of itemNames) productCounts.set(n, (productCounts.get(n) ?? 0) + 1);
      clientMap.set(root, {
        email: em, name: o.name || "", phone: o.phone || "",
        orders: 1, totalSpent: o.net,
        firstAt: o.createdAt, lastAt: o.createdAt, dates: [o.createdAt],
        productCounts, inView: isInView,
      });
    }
  }

  // Filtrar por branch si se pidió
  if (viewIds) {
    for (const [root, c] of clientMap) {
      if (!c.inView) clientMap.delete(root);
    }
  }

  // Calcular métricas
  const now = new Date();
  const fmtDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(d);
  const nowCalendar = new Date(`${fmtDate(now)}T12:00:00Z`);

  return Array.from(clientMap.values()).map((c) => {
    let avgFreq: number | null = null;
    if (c.dates.length >= 2) {
      const sorted = c.dates.slice().sort((a, b) => a.getTime() - b.getTime());
      let totalGap = 0;
      for (let i = 1; i < sorted.length; i++) totalGap += (sorted[i].getTime() - sorted[i - 1].getTime()) / 86400000;
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
}
