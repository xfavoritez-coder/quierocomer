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
