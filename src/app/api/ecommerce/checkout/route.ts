import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { webpayInit, webpaySettingsFor } from "@/lib/payments/webpay";
import { dispatchOrderToPos } from "@/lib/ecommerce/pos";
import { parseDeliveryZones, parseDeliveryConfig, computeDistanceFee } from "@/lib/ecommerce/delivery";

export const runtime = "nodejs";

const ONLINE_METHODS = ["webpay"];

interface CartItemIn {
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  image_url?: string | null;
  toteat_code?: string | null;
  options?: { group_id: string; group_name: string; value_id: string; value: string; price_delta: number; toteat_modifier_code?: string | null }[];
}

/**
 * POST /api/ecommerce/checkout
 * Crea la OnlineOrder del ecommerce con sus items (incluidas las opciones).
 * - Pago online (webpay): inicia la transacción y devuelve { url, token } para
 *   redirigir al formulario de Transbank. El envío al POS ocurre al confirmarse
 *   el pago (en /api/ecommerce/webpay/return).
 * - Pago offline (efectivo/transferencia/tarjeta): confirma el pedido y lo envía
 *   al POS de inmediato; devuelve { orderId } para ir al seguimiento.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { restaurantSlug, restaurantId, customerName, customerPhone, customerEmail, orderType, deliveryAddress, deliveryZone, deliveryLat, deliveryLng, items, notes, paymentMethod } = body as {
      restaurantSlug?: string; restaurantId?: string; customerName?: string; customerPhone?: string; customerEmail?: string;
      orderType?: string; deliveryAddress?: string; deliveryZone?: string; deliveryLat?: number; deliveryLng?: number; items?: CartItemIn[]; notes?: string; paymentMethod?: string;
    };

    if (!restaurantId && !restaurantSlug) return NextResponse.json({ error: "restaurante requerido" }, { status: 400 });
    if (!customerName || !customerPhone || !orderType || !Array.isArray(items) || !items.length || !paymentMethod) {
      return NextResponse.json({ error: "Faltan datos del pedido" }, { status: 400 });
    }

    // Resolver restaurante + validar que el pilar esté activo y el método permitido.
    const sel = { id: true, ecommerceEnabled: true, ecommerceConfig: true, orderingPaymentMethods: true, ecommerceDeliveryZones: true, ecommerceDeliveryConfig: true } as const;
    const restaurant = await (restaurantId
      ? prisma.restaurant.findUnique({ where: { id: restaurantId }, select: sel })
      : prisma.restaurant.findUnique({ where: { slug: restaurantSlug! }, select: sel }));
    if (!restaurant || !restaurant.ecommerceEnabled) return NextResponse.json({ error: "Tienda no disponible" }, { status: 404 });

    const allowed = (restaurant.orderingPaymentMethods || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!allowed.includes(paymentMethod)) return NextResponse.json({ error: "Método de pago no disponible" }, { status: 400 });

    const isDelivery = orderType === "DELIVERY";

    // Subtotal + fee de delivery, todo calculado en el servidor (nunca confiar en el cliente).
    const subtotal = Math.round(items.reduce((s, it) => s + Number(it.unit_price) * Number(it.quantity), 0));
    if (!Number.isFinite(subtotal) || subtotal < 50) return NextResponse.json({ error: "Monto inválido" }, { status: 400 });

    let deliveryFee = 0;
    if (isDelivery) {
      const dcfg = parseDeliveryConfig(restaurant.ecommerceDeliveryConfig);
      if (dcfg.mode === "distance") {
        // Recalcular el fee desde la ubicación (no confiar en el cliente).
        if (!Number.isFinite(Number(deliveryLat)) || !Number.isFinite(Number(deliveryLng))) {
          return NextResponse.json({ error: "Falta la ubicación de entrega" }, { status: 400 });
        }
        const res = computeDistanceFee(dcfg, { lat: Number(deliveryLat), lng: Number(deliveryLng) });
        if (!res.available) return NextResponse.json({ error: res.reason || "Fuera de la zona de reparto" }, { status: 400 });
        deliveryFee = res.fee;
      } else {
        const zones = parseDeliveryZones(restaurant.ecommerceDeliveryZones).filter((z) => z.active);
        const zone = zones.find((z) => z.name === deliveryZone);
        if (!zone) return NextResponse.json({ error: "Zona de delivery no válida" }, { status: 400 });
        if (zone.minOrder && subtotal < zone.minOrder) return NextResponse.json({ error: `Pedido mínimo en ${zone.name}: ${zone.minOrder}` }, { status: 400 });
        deliveryFee = zone.fee;
      }
    }
    const total = subtotal + deliveryFee;

    // Correlativo por restaurante.
    const prevCount = await prisma.onlineOrder.count({ where: { restaurantId: restaurant.id } });
    const orderNumber = prevCount + 1;

    const isOnline = ONLINE_METHODS.includes(paymentMethod);

    // Guardar cada item como superset: campos del visor/panel (dishName, unitTotal,
    // selectedOptions) + campos que necesita el POS (name, unit_price, toteat_code, options).
    const storedItems = items.map((it) => ({
      dishName: it.name,
      quantity: it.quantity,
      unitTotal: it.unit_price,
      selectedOptions: (it.options ?? []).map((o) => ({ optionName: o.value })),
      // datos para el POS (Toteat)
      name: it.name,
      product_id: it.product_id,
      unit_price: it.unit_price,
      toteat_code: it.toteat_code ?? null,
      options: it.options ?? [],
    }));

    const order = await prisma.onlineOrder.create({
      data: {
        restaurantId: restaurant.id,
        customerName: String(customerName).trim(),
        customerPhone: String(customerPhone).trim(),
        customerEmail: customerEmail?.trim() || null,
        orderType: orderType === "DELIVERY" ? "DELIVERY" : "PICKUP",
        deliveryAddress: deliveryAddress?.trim() || null,
        paymentMethod,
        paymentStatus: isOnline ? "pending" : "unpaid",
        paymentGateway: isOnline ? "webpay" : null,
        items: storedItems as unknown as object,
        total,
        deliveryFee,
        notes: notes?.trim() || null,
        orderNumber,
        status: isOnline ? "PENDING" : "ACCEPTED",
        statusHistory: [{ status: isOnline ? "PENDING" : "ACCEPTED", ts: new Date().toISOString() }],
      },
    });

    // ── Pago offline: confirmar y enviar al POS de inmediato ──
    if (!isOnline) {
      const pos = await dispatchOrderToPos(order.id).catch((e) => ({ ok: false, message: String(e) }));
      return NextResponse.json({ ok: true, orderId: order.id, paid: false, pos });
    }

    // ── Pago online (Webpay) ──
    const buyOrder = `qc${order.id.slice(-22)}`; // máx 26 chars
    const returnUrl = `${req.nextUrl.origin}/api/ecommerce/webpay/return`;
    const init = await webpayInit(buyOrder, order.id, total, returnUrl, webpaySettingsFor(restaurant));
    if (!init.ok || !init.url || !init.token) {
      await prisma.onlineOrder.update({ where: { id: order.id }, data: { paymentStatus: "failed" } });
      return NextResponse.json({ error: init.error || "No se pudo iniciar el pago" }, { status: 502 });
    }
    await prisma.onlineOrder.update({ where: { id: order.id }, data: { webpayToken: init.token, webpayBuyOrder: buyOrder } });

    return NextResponse.json({ ok: true, orderId: order.id, url: init.url, token: init.token });
  } catch (e) {
    console.error("[ecommerce/checkout]", e);
    return NextResponse.json({ error: "Error al procesar el pedido" }, { status: 500 });
  }
}
