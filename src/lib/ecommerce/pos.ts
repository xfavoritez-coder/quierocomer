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

export async function dispatchOrderToPos(orderId: string): Promise<{ ok: boolean; message: string; skipped?: boolean }> {
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

  const posOrder: PosOrder = {
    orderNumber: String(order.orderNumber ?? order.id.slice(-6)),
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    orderType: order.orderType === "DELIVERY" ? "DELIVERY" : "PICKUP",
    deliveryAddress: order.deliveryAddress,
    deliveryFee: order.deliveryFee ?? 0,
    notes: order.notes,
    total: order.total,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    vendorName: `QC-${order.restaurant.name}`, // distintivo de origen en Toteat
  };

  const res = await sendOrderToToteat(posOrder, items, cfg.pos.toteat ?? {});

  if (res.ok) {
    await prisma.onlineOrder.update({ where: { id: order.id }, data: { toteatOrderId: res.toteat_id, posError: null } });
  } else {
    await prisma.onlineOrder.update({ where: { id: order.id }, data: { posError: res.message.slice(0, 300) } });
  }
  return { ok: res.ok, message: res.message };
}
