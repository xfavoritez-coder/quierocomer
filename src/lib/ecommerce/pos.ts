// ═══════════════════════════════════════════════════════════
//  Despacho de pedidos del Ecommerce al POS del restaurante.
//  Por ahora: Toteat. Lee el proveedor y credenciales de
//  Restaurant.ecommerceConfig.pos. Idempotente (no reenvía).
// ═══════════════════════════════════════════════════════════
import { prisma } from "@/lib/prisma";
import { parseEcommerceConfig } from "@/lib/ecommerce/config";
import { sendOrderToToteat, type PosOrder, type PosOrderItem } from "@/lib/ecommerce/toteat";

interface StoredCartItem {
  name: string;
  quantity: number;
  unit_price: number;
  toteat_code?: string | null;
  options?: { value: string; price_delta: number; toteat_modifier_code?: string | null }[];
}

/** Canal de origen del pedido, para distinguir el vendorName en Toteat:
 *  - "manual": lo tomó el staff en "Tomar pedidos" → QC-<Local>
 *  - "web":    lo hizo el cliente en el ecommerce   → QC-<Local>-Web  */
export type PosOrderChannel = "manual" | "web";

export async function dispatchOrderToPos(
  orderId: string,
  opts?: { channel?: PosOrderChannel },
): Promise<{ ok: boolean; message: string; skipped?: boolean }> {
  const order = await prisma.onlineOrder.findUnique({
    where: { id: orderId },
    include: { restaurant: { select: { ecommerceConfig: true, name: true } } },
  });
  if (!order) return { ok: false, message: "orden no encontrada" };
  if (order.toteatOrderId) return { ok: true, message: "ya enviada al POS", skipped: true };

  const cfg = parseEcommerceConfig(order.restaurant.ecommerceConfig);
  if (cfg.pos?.provider !== "toteat") return { ok: false, message: "POS no configurado", skipped: true };

  const items: PosOrderItem[] = ((order.items as unknown as StoredCartItem[]) ?? []).map((it) => ({
    product_name: it.name,
    quantity: it.quantity,
    unit_price: it.unit_price,
    toteat_code: it.toteat_code ?? null,
    options: (it.options ?? []).map((o) => ({ value: o.value, price_delta: o.price_delta, toteat_modifier_code: o.toteat_modifier_code ?? null })),
  }));

  // Toteat exige código de producto en cada línea: si algún plato no lo tiene,
  // NO se comanda (hay que mapear el código en la carta). Falla con detalle.
  const missing = Array.from(new Set(items.filter((it) => !it.toteat_code || !String(it.toteat_code).trim()).map((it) => it.product_name)));
  if (missing.length) {
    const msg = `Sin código Toteat: ${missing.join(", ")}`;
    await prisma.onlineOrder.update({ where: { id: order.id }, data: { posError: msg.slice(0, 300) } });
    return { ok: false, message: msg };
  }

  const posOrder: PosOrder = {
    orderNumber: String(order.orderNumber ?? order.id.slice(-6)),
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    orderType: order.orderType === "DELIVERY" ? "DELIVERY" : "PICKUP",
    deliveryAddress: order.deliveryAddress,
    deliveryFee: order.deliveryFee ?? 0,
    notes: order.notes,
    total: order.total,
    discount: order.discount ?? 0,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    // Distintivo de origen en Toteat: "QC-<nombre del local>" para pedidos
    // tomados por el staff, y "QC-<nombre del local>-Web" para los que hace el
    // cliente en el ecommerce. Nunca vacío.
    vendorName: (() => {
      const base = `QC-${(order.restaurant.name || "").trim() || "QuieroComer"}`;
      return opts?.channel === "web" ? `${base}-Web` : base;
    })(),
  };

  const res = await sendOrderToToteat(posOrder, items, cfg.pos.toteat ?? {});

  if (res.ok) {
    await prisma.onlineOrder.update({ where: { id: order.id }, data: { toteatOrderId: res.toteat_id, posError: null } });
  } else {
    await prisma.onlineOrder.update({ where: { id: order.id }, data: { posError: res.message.slice(0, 300) } });
  }
  return { ok: res.ok, message: res.message };
}
