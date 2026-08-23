import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { webpayConfirm, webpaySettingsFor } from "@/lib/payments/webpay";
import { dispatchOrderToPos } from "@/lib/ecommerce/pos";
import { notifyNewEcommerceOrder } from "@/lib/ecommerce/notifyOrder";

export const runtime = "nodejs";

/**
 * Retorno de Webpay (Transbank redirige aquí por POST tras el pago).
 *  - token_ws presente → confirmamos (commit) y marcamos la orden pagada/fallida.
 *  - TBK_TOKEN sin token_ws → el usuario canceló/abandonó el pago.
 */
async function handle(req: NextRequest) {
  const baseUrl = req.nextUrl.origin;

  let tokenWs: string | null = null;
  let tbkToken: string | null = null;
  if (req.method === "POST") {
    const form = await req.formData().catch(() => null);
    tokenWs = (form?.get("token_ws") as string) || null;
    tbkToken = (form?.get("TBK_TOKEN") as string) || null;
  } else {
    tokenWs = req.nextUrl.searchParams.get("token_ws");
    tbkToken = req.nextUrl.searchParams.get("TBK_TOKEN");
  }

  const checkoutFor = (slug: string, q: string) => `${baseUrl}/ecommerce/${slug}/checkout?${q}`;

  // Pago cancelado/abortado por el usuario → fallido, volver al checkout a reintentar.
  if (tbkToken && !tokenWs) {
    const order = await prisma.onlineOrder.findFirst({ where: { webpayToken: tbkToken }, select: { id: true, restaurant: { select: { slug: true } } } });
    if (order) await prisma.onlineOrder.update({ where: { id: order.id }, data: { paymentStatus: "failed" } });
    return NextResponse.redirect(order ? checkoutFor(order.restaurant.slug, "pago=fallido") : `${baseUrl}/?pago=cancelado`, 303);
  }

  if (!tokenWs) return NextResponse.redirect(`${baseUrl}/?pago=error`, 303);

  const order = await prisma.onlineOrder.findFirst({ where: { webpayToken: tokenWs }, include: { restaurant: { select: { slug: true, ecommerceConfig: true } } } });
  if (!order) return NextResponse.redirect(`${baseUrl}/?pago=error`, 303);
  const slug = order.restaurant.slug;

  // Si ya se confirmó antes, redirigir según su estado (idempotente)
  if (order.paymentStatus === "paid") {
    return NextResponse.redirect(checkoutFor(slug, `pago=exito&order=${order.id}`), 303);
  }

  const result = await webpayConfirm(tokenWs, webpaySettingsFor({ ecommerceConfig: order.restaurant.ecommerceConfig }));

  if (result.ok && result.authorized) {
    await prisma.onlineOrder.update({
      where: { id: order.id },
      data: { paymentStatus: "paid", paidAt: new Date(), status: "ACCEPTED" },
    });
    // Pago confirmado → enviar el pedido al POS (Toteat) si está configurado.
    await dispatchOrderToPos(order.id).catch((e) => console.error("[ecommerce/webpay/return] POS:", e));
    if (order.source === "ecommerce") notifyNewEcommerceOrder({ id: order.id, restaurantId: order.restaurantId, customerName: order.customerName, total: order.total, orderType: order.orderType }).catch(() => {});
    return NextResponse.redirect(checkoutFor(slug, `pago=exito&order=${order.id}`), 303);
  }

  await prisma.onlineOrder.update({ where: { id: order.id }, data: { paymentStatus: "failed" } });
  return NextResponse.redirect(checkoutFor(slug, "pago=fallido"), 303);
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
