// Mapea un pedido de Uber Eats (Orders API) a un PosOrder del Centro de pedidos,
// para que aparezca en el POS igual que el resto (provider "ubereats", vendorName
// "Uber Eats" → la caja lo etiqueta como plataforma). El pago lo cobra Uber, así
// que llega PAGADO (paidAmount = total).
//
// ⚠️ Los nombres de campos del JSON de Uber se confirman con el sandbox del
// partner al activar; la extracción es defensiva (varios fallbacks) y está
// centralizada aquí para ajustarla en un solo lugar.
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { notifyNewPosOrder } from "@/lib/ecommerce/notifyPosOrder";
import { STAGE_ORDER } from "@/lib/delifast/status";
import { syncOnlineOrderFromPos } from "@/lib/ecommerce/syncOnlineFromPos";

type J = Record<string, unknown>;
const obj = (v: unknown): J => (v && typeof v === "object" && !Array.isArray(v) ? (v as J) : {});
const str = (v: unknown): string => (v == null ? "" : String(v)).trim();

// Monto de Uber: viene como { amount, currency_code } en la unidad MENOR (1/100).
// VERIFICADO en sandbox 2026-11-10: amount 100 → formatted "CLP 1". Se divide por
// 100 para obtener el valor en CLP (p. ej. CLP 1000 llega como amount 100000).
function money(v: unknown): number {
  const o = obj(v);
  const n = Number(o.amount ?? v);
  return Number.isFinite(n) ? Math.round(n / 100) : 0;
}

export interface UberIngestResult { posOrderId: string; isNew: boolean }

export async function createPosOrderFromUberOrder(restaurantId: string, order: J): Promise<UberIngestResult | null> {
  const uberId = str(order.id || order.uuid || order.order_id);
  if (!uberId) return null;
  const externalId = `ue-${uberId}`;

  // Idempotencia: si ya existe, no duplicar.
  const existing = await prisma.posOrder.findUnique({
    where: { restaurantId_externalId: { restaurantId, externalId } },
    select: { id: true },
  });
  if (existing) return { posOrderId: existing.id, isNew: false };

  const eater = obj(order.eater || order.customer);
  const customerName = str(`${str(eater.first_name)} ${str(eater.last_name)}`.trim() || eater.name || "Cliente Uber Eats");
  const customerPhone = str((obj(eater.phone).number) || eater.phone || "");

  const typeRaw = str(order.type || order.fulfillment_type).toUpperCase();
  const isDelivery = typeRaw.includes("DELIVERY");

  const delivery = obj(order.delivery || (Array.isArray(order.deliveries) ? (order.deliveries as unknown[])[0] : undefined));
  const addr = obj(delivery.location || delivery.address);
  const addressLine = str(addr.address || addr.street_address || addr.formatted_address);

  const cart = obj(order.cart);
  const rawItems = Array.isArray(cart.items) ? (cart.items as J[]) : Array.isArray(order.items) ? (order.items as J[]) : [];
  const items = rawItems.map((it) => {
    const groups = Array.isArray(it.selected_modifier_groups) ? (it.selected_modifier_groups as J[]) : [];
    const options = groups.flatMap((g) => (Array.isArray(g.selected_items) ? (g.selected_items as J[]) : []).map((s) => str(s.title || s.name))).filter(Boolean);
    const price = obj(it.price);
    const unitTotal = money(price.total_price || price.unit_price) || undefined;
    return { productName: str(it.title || it.name || "Ítem"), quantity: Number(it.quantity) || 1, options, unitTotal, note: str(it.special_instructions) || undefined };
  });

  const payment = obj(order.payment);
  const charges = obj(payment.charges);
  const total = money(charges.total || payment.total || order.total);

  const created = await prisma.posOrder.create({
    data: {
      restaurantId,
      externalId,
      provider: "ubereats",
      posStatus: "new",
      opsStage: "preparing",
      saleType: isDelivery ? "delivery" : "pickup",
      isDelivery,
      customerName,
      customerPhone,
      addressLine: isDelivery ? addressLine : "",
      totalAmount: total,
      paidAmount: total, // Uber cobra el pago → llega pagado.
      currency: "CLP",
      vendorName: "Uber Eats",
      orderReference: str(order.display_id || order.id) || null,
      items: items as unknown as object,
      trackingToken: crypto.randomBytes(20).toString("hex"),
    },
    select: { id: true },
  });
  void notifyNewPosOrder({ restaurantId, id: created.id, customerName, total, isDelivery }).catch(() => {});
  return { posOrderId: created.id, isNew: true };
}

// Mapeo de estado de reparto de Uber → opsStage del POS. Uber-específico (no toca el
// mapeo compartido de Delifast); cae a `toOpsStage` para lo común. OJO: en "Delivery
// by Uber" el `current_state` del pedido suele quedarse en ACCEPTED mientras el
// avance real vive en `deliveries[].status` (en_route/picked_up/delivered).
function uberToOpsStage(s: string): string | null {
  const e = (s || "").toLowerCase();
  if (!e) return null;
  // Entregado: "delivered" (con -ed, para NO matchear "out_for_delivery"), o completado.
  if (/deliver(ed|y[_ ]?complete)|dropoff[_ ]?complete|completed|fulfilled|succeeded/.test(e)) return "delivered";
  // En camino = el repartidor YA tiene la comida y va al cliente. OJO: "picked" (ya
  // recogió) sí, pero "en_route_to_pickup"/"arrived_at_pickup" (va AL local) NO.
  if (/picked|en[_ ]?route[_ ]?to[_ ]?drop|arrived[_ ]?at[_ ]?drop|dropoff|out[_ ]?for[_ ]?deliver|on[_ ]?the[_ ]?way|in[_ ]?transit|reparto/.test(e)) return "out_for_delivery";
  // Sin fallback al mapeo de Delifast (su `en.?route` marcaría "en camino" aunque el
  // repartidor aún vaya AL local). Lo no reconocido no cambia el stage.
  return null;
}

/** Lee el estado de reparto del pedido de Uber (current_state + deliveries[]) y, si
 *  corresponde, AVANZA el opsStage del PosOrder (solo hacia adelante: out_for_delivery,
 *  delivered), guarda el repartidor/ETA en `courier`, y sincroniza el OnlineOrder
 *  (estado + push al cliente). Idempotente y tolerante al payload — los webhooks de
 *  delivery status se activan en PRODUCCIÓN (hoy están off en pos_data). No crea nada:
 *  si el PosOrder no existe, no hace nada. */
export async function applyUberDeliveryState(restaurantId: string, order: J): Promise<{ changed: boolean; opsStage?: string }> {
  const uberId = str(order.id || order.uuid || order.order_id);
  if (!uberId) return { changed: false };
  const po = await prisma.posOrder.findUnique({
    where: { restaurantId_externalId: { restaurantId, externalId: `ue-${uberId}` } },
    select: { id: true, opsStage: true },
  });
  if (!po) return { changed: false };

  const delivery = obj(order.delivery || (Array.isArray(order.deliveries) ? (order.deliveries as unknown[])[0] : undefined));
  // Estado: lo más específico primero (el viaje), luego el estado del pedido.
  const stateStr = str(
    delivery.status || delivery.state || delivery.delivery_state ||
    order.delivery_state || order.fulfillment_state || order.current_state,
  );
  const nextStage = uberToOpsStage(stateStr);

  // Repartidor + ETA (cuando Uber asigna el courier). Se guarda aunque no cambie el stage.
  const courierRaw = obj(delivery.courier || delivery.driver);
  const courierName = str(courierRaw.first_name || courierRaw.name);
  const courierPhone = str(obj(courierRaw.phone).number || courierRaw.phone);
  const courierPhoto = str(courierRaw.image_url || courierRaw.photo_url || courierRaw.picture);
  const eta = str(delivery.estimated_dropoff_at || delivery.dropoff_eta || delivery.estimated_time_of_arrival || delivery.eta);
  const location = obj(courierRaw.location || delivery.courier_location);
  const lat = Number(location.latitude ?? location.lat);
  const lng = Number(location.longitude ?? location.lng);
  const hasCourier = courierName || courierPhone || courierPhoto || eta || Number.isFinite(lat);
  const courier = hasCourier ? {
    source: "ubereats" as const,
    name: courierName || null,
    phone: courierPhone || null,
    photo: courierPhoto || null,
    status: stateStr || null,
    eta: eta || null,
    location: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null,
  } : null;

  const patch: Record<string, unknown> = {};
  let stageChanged = false;
  if (nextStage) {
    const cur = STAGE_ORDER[po.opsStage] ?? 0;
    const nxt = STAGE_ORDER[nextStage] ?? 0;
    if (nxt > cur) {
      patch.opsStage = nextStage;
      stageChanged = true;
      const now = new Date();
      if (nextStage === "out_for_delivery") patch.opsDispatchedAt = now;
      if (nextStage === "delivered") patch.opsDeliveredAt = now;
    }
  }
  if (courier) patch.courier = courier as object;
  if (Object.keys(patch).length === 0) return { changed: false, opsStage: po.opsStage };

  const updated = await prisma.posOrder.update({
    where: { id: po.id },
    data: patch,
    select: { restaurantId: true, externalId: true, opsStage: true, posStatus: true },
  });
  // Solo sincroniza OnlineOrder + push si avanzó el estado (no cuando solo guarda el courier).
  if (stageChanged) void syncOnlineOrderFromPos(updated).catch(() => {});
  return { changed: true, opsStage: updated.opsStage };
}
