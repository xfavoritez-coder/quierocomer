// ═══════════════════════════════════════════════════════════
//  Espejo de pedidos del Ecommerce / Tomar pedidos hacia el
//  Centro de pedidos (PosOrder), cuando el local NO gestiona por
//  POS (Toteat). Así el board, repartidores y tracking (que ya
//  trabajan sobre PosOrder) funcionan igual para locales sin POS.
//  Si el local SÍ usa POS, no se espeja: los pedidos llegan por el
//  webhook de Toteat (evita duplicados).
// ═══════════════════════════════════════════════════════════
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { parseEcommerceConfig, parseCentroPedidosConfig, effectivePosMode } from "@/lib/ecommerce/config";
import { notifyNewPosOrder } from "@/lib/ecommerce/notifyPosOrder";

interface StoredItem { name?: string; dishName?: string; quantity?: number }

/** Espeja un OnlineOrder (ecommerce/manual) al Centro de pedidos como PosOrder,
 *  solo si el local NO está en modo POS. Idempotente por externalId "oo-<id>". */
export async function mirrorOnlineOrderToCentro(orderId: string, channel: "web" | "manual"): Promise<void> {
  const order = await prisma.onlineOrder.findUnique({
    where: { id: orderId },
    include: { restaurant: { select: { name: true, centroPedidosConfig: true, ecommerceConfig: true } } },
  });
  if (!order) return;

  const posMode = effectivePosMode(
    parseCentroPedidosConfig(order.restaurant.centroPedidosConfig),
    parseEcommerceConfig(order.restaurant.ecommerceConfig),
  );
  if (posMode) return; // el POS gestiona estos pedidos; no espejar

  const restaurantId = order.restaurantId;
  const externalId = `oo-${order.id}`;

  const existing = await prisma.posOrder.findUnique({
    where: { restaurantId_externalId: { restaurantId, externalId } },
    select: { id: true },
  });
  if (existing) return; // ya espejado

  const isDelivery = order.orderType === "DELIVERY";
  const base = `QC-${(order.restaurant.name || "").trim() || "QuieroComer"}`;
  const vendorName = channel === "web" ? `${base}-Web` : base;

  const items = Array.isArray(order.items)
    ? (order.items as unknown as StoredItem[]).map((it) => ({ productName: it.name || it.dishName || "Ítem", quantity: Number(it.quantity) || 1 }))
    : [];

  try {
    const created = await prisma.posOrder.create({
      data: {
        restaurantId,
        externalId,
        provider: "ecommerce",
        posStatus: "new",
        opsStage: "preparing",
        saleType: isDelivery ? "delivery" : "pickup",
        isDelivery,
        customerName: order.customerName || "",
        customerPhone: order.customerPhone || "",
        addressLine: isDelivery ? (order.deliveryAddress || "") : "",
        totalAmount: order.total || 0,
        deliveryFee: order.deliveryFee || 0,
        discountAmount: order.discount || 0,
        currency: "CLP",
        vendorName,
        orderReference: order.orderNumber != null ? String(order.orderNumber) : null,
        items: items as unknown as object,
        customerLat: isDelivery ? order.deliveryLat : null,
        customerLng: isDelivery ? order.deliveryLng : null,
        trackingToken: crypto.randomBytes(20).toString("hex"),
      },
      select: { id: true },
    });
    void notifyNewPosOrder({ restaurantId, id: created.id, customerName: order.customerName || "", total: order.total || 0, isDelivery }).catch(() => {});
  } catch { /* noop (carrera de duplicado, etc.) */ }
}
