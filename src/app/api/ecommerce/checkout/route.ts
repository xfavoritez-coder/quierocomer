import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { webpayInit, webpaySettingsFor } from "@/lib/payments/webpay";

export const runtime = "nodejs";

/**
 * POST /api/ecommerce/checkout
 * Crea la OnlineOrder en estado "pendiente de pago" e inicia la transacción
 * Webpay. Devuelve { url, token, orderId } para que el cliente redirija al
 * formulario de pago de Transbank (POST token_ws a url).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { restaurantId, restaurantSlug, customerName, customerPhone, customerEmail, orderType, deliveryAddress, items, total, notes } = body;

    if (!restaurantId && !restaurantSlug) return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });
    if (!customerName || !customerPhone || !orderType || !items || total == null) {
      return NextResponse.json({ error: "Faltan datos del pedido" }, { status: 400 });
    }

    let resId = restaurantId as string | undefined;
    if (!resId && restaurantSlug) {
      const r = await prisma.restaurant.findUnique({ where: { slug: restaurantSlug }, select: { id: true } });
      if (!r) return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });
      resId = r.id;
    }

    const amount = Math.round(Number(total));
    if (!Number.isFinite(amount) || amount < 50) {
      return NextResponse.json({ error: "Monto inválido para pago online" }, { status: 400 });
    }

    const order = await prisma.onlineOrder.create({
      data: {
        restaurantId: resId!,
        customerName: String(customerName).trim(),
        customerPhone: String(customerPhone).trim(),
        customerEmail: customerEmail?.trim() || null,
        orderType,
        deliveryAddress: deliveryAddress?.trim() || null,
        paymentMethod: "webpay",
        paymentStatus: "pending",
        paymentGateway: "webpay",
        items,
        total: amount,
        notes: notes?.trim() || null,
        status: "PENDING",
        statusHistory: [{ status: "PENDING", ts: new Date().toISOString() }],
      },
    });

    // buy_order: máx 26 caracteres para Webpay.
    const buyOrder = `qc${order.id.slice(-22)}`;
    // Origen del request (funciona en local y prod) para que Webpay redirija de vuelta.
    const baseUrl = req.nextUrl.origin;
    const returnUrl = `${baseUrl}/api/ecommerce/webpay/return`;

    // Credenciales Webpay del restaurante (producción o integración).
    const settingsRest = await prisma.restaurant.findUnique({ where: { id: resId! }, select: { ecommerceConfig: true } });
    const init = await webpayInit(buyOrder, order.id, amount, returnUrl, webpaySettingsFor(settingsRest));
    if (!init.ok || !init.url || !init.token) {
      await prisma.onlineOrder.update({ where: { id: order.id }, data: { paymentStatus: "failed" } });
      return NextResponse.json({ error: init.error || "No se pudo iniciar el pago" }, { status: 502 });
    }

    await prisma.onlineOrder.update({ where: { id: order.id }, data: { webpayToken: init.token, webpayBuyOrder: buyOrder } });

    return NextResponse.json({ ok: true, orderId: order.id, url: init.url, token: init.token });
  } catch (e: any) {
    console.error("[ecommerce/checkout]", e);
    return NextResponse.json({ error: "Error al procesar el pago" }, { status: 500 });
  }
}
