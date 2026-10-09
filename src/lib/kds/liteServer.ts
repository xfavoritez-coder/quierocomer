// Soporte de servidor para la "KDS liviana" (tablets Android 4/5 sin React).
// Resuelve el local por token de KDS y arma el JSON de pedidos ya formateado.
import { prisma } from "@/lib/prisma";
import { chileTodayYmd, chileDayRangeUtc } from "@/lib/driver/serialize";

export interface KdsRestaurant { id: string; name: string; posEnabled: boolean }

// Busca el local cuyo ecommerceStoreConfig.kdsToken coincide con el token.
export async function resolveKdsRestaurant(token: string): Promise<KdsRestaurant | null> {
  const t = (token || "").trim();
  if (!t) return null;
  const r = await prisma.restaurant.findFirst({
    where: { ecommerceStoreConfig: { path: ["kdsToken"], equals: t } },
    select: { id: true, name: true, posEnabled: true },
  });
  return r ? { id: r.id, name: r.name, posEnabled: !!r.posEnabled } : null;
}

const BAN = ["delivery", "envío", "envio", "costo", "fee", "cargo", "tarifa", "propina", "tip", "vuelto", "cambio", "descuento", "discount", "cupón", "cupon", "servicio", "service", "impuesto", "tax", "total"];
const nameOf = (it: any): string => String(it?.productName ?? it?.name ?? it?.dishName ?? it?.description ?? it?.title ?? "").trim();

// Devuelve las líneas de cocina (producto + modificadores), uniendo los extras de
// Toteat (isExtra + referenceLine) y los modificadores anidados.
export function kitchenLines(items: any): string[] {
  const arr = Array.isArray(items) ? items : [];
  const extrasByRef = new Map<number, string[]>();
  for (const it of arr) {
    if (it && typeof it === "object" && it.isExtra) {
      const ref = Number(it.referenceLine);
      const nm = nameOf(it);
      if (!Number.isNaN(ref) && nm) { if (!extrasByRef.has(ref)) extrasByRef.set(ref, []); extrasByRef.get(ref)!.push(nm); }
    }
  }
  const out: string[] = [];
  for (const it of arr) {
    if (!it || typeof it !== "object" || it.isExtra) continue;
    const name = nameOf(it);
    if (!name || BAN.some((w) => name.toLowerCase().includes(w))) continue;
    const qtyRaw = Number(it.quantity ?? it.qty ?? it.count ?? 1) || 1;
    const qty = qtyRaw <= 0 ? 1 : qtyRaw;
    const mods: string[] = [];
    const ln = Number(it.lineNumber);
    if (!Number.isNaN(ln) && extrasByRef.has(ln)) mods.push(...extrasByRef.get(ln)!);
    for (const k of ["modifiers", "selectedOptions", "extras", "options", "additions"]) {
      if (Array.isArray(it[k])) for (const m of it[k]) {
        const mn = String(m?.optionName ?? m?.name ?? m?.title ?? m?.label ?? m?.value ?? "").trim();
        if (mn) mods.push(mn);
      }
    }
    out.push(`${qty} × ${name}${mods.length ? ` (${mods.join(", ")})` : ""}`);
  }
  return out;
}

function tipo(o: any): { cls: string; text: string } {
  const isDel = o.isDelivery && (o.deliveryFee ?? 0) > 0;
  if (isDel) return { cls: "t-delivery", text: "Delivery" };
  if (o.tableLabel || o.saleType === "dine-in") return { cls: "t-mesa", text: o.tableLabel ? `Mesa ${o.tableLabel}` : "Mesa" };
  return { cls: "t-retiro", text: "Retiro" };
}
const SEC = (v: any): number => (v ? Math.floor(new Date(v).getTime() / 1000) : 0);

export interface KdsOrderLite {
  id: string; typeCls: string; typeText: string; customer: string;
  lines: string[]; created: number; done: number; completed: boolean; doneHM: string;
}

// Pedidos "activos" de hoy, separados y formateados para la vista liviana.
export async function kdsOrders(restaurantId: string): Promise<{ pend: KdsOrderLite[]; comp: KdsOrderLite[] }> {
  const today = chileTodayYmd();
  const { start } = chileDayRangeUtc(today);
  const { end } = chileDayRangeUtc(today);
  const orders = await prisma.posOrder.findMany({
    where: {
      restaurantId,
      posStatus: { not: "canceled" },
      OR: [{ opsStage: { not: "delivered" } }, { opsStage: "delivered", createdAt: { gte: start, lte: end } }],
    },
    orderBy: { createdAt: "desc" },
    take: 400,
  });

  const toLite = (o: any): KdsOrderLite => {
    const completed = o.opsStage !== "preparing";
    const done = completed ? SEC(o.opsReadyForDeliveryAt || o.opsDispatchedAt || o.opsDeliveredAt || o.completedAt || o.updatedAt) : 0;
    const t = tipo(o);
    const doneHM = completed && done > 0 ? new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit" }).format(new Date(done * 1000)) : "";
    return {
      id: o.id, typeCls: t.cls, typeText: t.text,
      customer: o.customerName || (o.orderReference ? `#${o.orderReference}` : "—"),
      lines: kitchenLines(o.items), created: SEC(o.createdAt), done, completed, doneHM,
    };
  };

  const active = orders.filter((o: any) => o.posStatus !== "canceled").map(toLite);
  const pend = active.filter((o) => !o.completed).sort((a, b) => a.created - b.created);
  const comp = active.filter((o) => o.completed).sort((a, b) => b.done - a.done);
  return { pend, comp };
}
