// Sync de Custom Audiences de un local: arma los segmentos desde OnlineOrder y los
// sube (hasheados) a Meta. Crea las audiencias la primera vez y guarda sus IDs en la
// config. SERVER-ONLY. Reusa el token por-local (cifrado) o el env META_ADS_TOKEN.
import { prisma } from "@/lib/prisma";
import { parseEcommerceConfig } from "@/lib/ecommerce/config";
import { decryptEcommerceSecrets } from "@/lib/ecommerce/configSecrets";
import { phoneKey } from "@/lib/ecommerce/phoneCL";
import { createCustomAudience, replaceAudienceUsers, type AudienceMember } from "@/lib/meta/audiences";

const DAY = 86400000;

interface Cust { phone: string; email: string | null; total: number; count: number; last: number }

/** Agrupa los pedidos del local por cliente (clave = últimos 9 díg. del teléfono). */
async function loadCustomers(restaurantId: string): Promise<Cust[]> {
  const orders = await prisma.onlineOrder.findMany({
    where: { restaurantId, NOT: { paymentStatus: "failed" }, status: { not: "CANCELLED" } },
    select: { customerPhone: true, customerEmail: true, total: true, createdAt: true },
    take: 100000,
  });
  const map = new Map<string, Cust>();
  for (const o of orders) {
    const key = phoneKey(o.customerPhone);
    if (!key) continue;
    const prev = map.get(key);
    const ts = o.createdAt.getTime();
    if (prev) {
      prev.total += o.total || 0; prev.count += 1;
      if (ts > prev.last) { prev.last = ts; if (o.customerEmail) prev.email = o.customerEmail; }
    } else {
      map.set(key, { phone: o.customerPhone, email: o.customerEmail || null, total: o.total || 0, count: 1, last: ts });
    }
  }
  return [...map.values()];
}

export interface AudienceSyncResult {
  ok: boolean;
  error?: string;
  segments?: { buyers: number; lapsed: number; top: number };
  uploaded?: { buyers?: number; lapsed?: number; top?: number };
  created?: string[];
}

export async function syncRestaurantAudiences(restaurantId: string): Promise<AudienceSyncResult> {
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ecommerceConfig: true, name: true } });
  if (!r) return { ok: false, error: "local no encontrado" };

  const rawCfg = parseEcommerceConfig(r.ecommerceConfig); // meta.adsToken aún cifrado
  const meta = rawCfg.meta || {};
  if (!meta.audiencesEnabled) return { ok: false, error: "sync de audiencias no habilitado" };
  if (!meta.adAccountId) return { ok: false, error: "falta adAccountId (cuenta publicitaria)" };

  const token = decryptEcommerceSecrets(rawCfg).meta?.adsToken || process.env.META_ADS_TOKEN || "";
  if (!token) return { ok: false, error: "falta token de ads (meta.adsToken o env META_ADS_TOKEN)" };

  const custs = await loadCustomers(restaurantId);
  const now = Date.now();
  const buyers = custs;
  const lapsed = custs.filter((c) => now - c.last >= 30 * DAY && now - c.last <= 120 * DAY);
  // "Mejores" = top 20% por gasto total (mín. 100 para que sirva de semilla Lookalike).
  const bySpend = [...custs].sort((a, b) => b.total - a.total);
  const topN = Math.max(Math.min(bySpend.length, 100), Math.ceil(bySpend.length * 0.2));
  const top = bySpend.slice(0, topN);

  const toMembers = (list: Cust[]): AudienceMember[] => list.map((c) => ({ email: c.email, phone: c.phone }));

  const defs: { key: "buyers" | "lapsed" | "top"; name: string; desc: string; list: Cust[] }[] = [
    { key: "buyers", name: `${r.name} · Compradores`, desc: "Clientes que han comprado (sync automático ecommerce)", list: buyers },
    { key: "lapsed", name: `${r.name} · Inactivos 30-120d`, desc: "Clientes sin comprar hace 30-120 días (win-back)", list: lapsed },
    { key: "top", name: `${r.name} · Mejores clientes`, desc: "Top 20% por gasto (semilla para Lookalike)", list: top },
  ];

  const audiences = { ...(meta.audiences || {}) } as Record<string, string | undefined>;
  const created: string[] = [];
  const uploaded: Record<string, number> = {};

  for (const d of defs) {
    let id = audiences[d.key];
    if (!id) {
      const c = await createCustomAudience(meta.adAccountId, token, d.name, d.desc);
      if (!c.ok || !c.id) return { ok: false, error: `crear audiencia ${d.key}: ${c.error}`, segments: { buyers: buyers.length, lapsed: lapsed.length, top: top.length } };
      id = c.id; audiences[d.key] = id; created.push(d.key);
    }
    const up = await replaceAudienceUsers(id, token, toMembers(d.list));
    if (!up.ok) return { ok: false, error: `subir ${d.key}: ${up.error}`, created, segments: { buyers: buyers.length, lapsed: lapsed.length, top: top.length } };
    uploaded[d.key] = up.count;
  }

  // Guardar los IDs de audiencias en la config SIN tocar el token (sigue cifrado en rawCfg).
  if (created.length) {
    const nextCfg = { ...rawCfg, meta: { ...meta, audiences } };
    await prisma.restaurant.update({ where: { id: restaurantId }, data: { ecommerceConfig: nextCfg as object } }).catch(() => {});
  }

  return { ok: true, segments: { buyers: buyers.length, lapsed: lapsed.length, top: top.length }, uploaded, created };
}
