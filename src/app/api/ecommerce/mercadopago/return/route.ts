import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { confirmMercadoPagoPayment } from "@/lib/payments/mercadopagoConfirm";

export const runtime = "nodejs";

/**
 * Retorno del cliente desde MercadoPago (back_urls). Trae ?order=… y los
 * parámetros de estado/pago.
 *  - Pagado → volvemos al checkout con ?pago=exito (vacía carrito → seguimiento).
 *  - No pagado → marcamos el pago fallido y volvemos al checkout con ?pago=fallido
 *    (conserva el carrito para reintentar).
 */
async function handle(req: NextRequest) {
  const baseUrl = req.nextUrl.origin;
  const orderId = req.nextUrl.searchParams.get("order");
  const paymentId = req.nextUrl.searchParams.get("payment_id") || req.nextUrl.searchParams.get("collection_id");

  if (!orderId) return NextResponse.redirect(`${baseUrl}/?pago=error`, 303);

  const order = await prisma.onlineOrder.findUnique({
    where: { id: orderId },
    select: { id: true, paymentStatus: true, restaurant: { select: { slug: true } } },
  });
  if (!order) return NextResponse.redirect(`${baseUrl}/?pago=error`, 303);

  let paid = order.paymentStatus === "paid";
  if (!paid && paymentId) paid = await confirmMercadoPagoPayment(orderId, paymentId).catch(() => false);

  const checkout = `${baseUrl}/ecommerce/${order.restaurant.slug}/checkout`;
  if (paid) return NextResponse.redirect(`${checkout}?pago=exito&order=${orderId}`, 303);

  // Pago no completado → marcar fallido (si sigue pendiente) y volver a reintentar.
  if (order.paymentStatus === "pending") {
    await prisma.onlineOrder.update({ where: { id: order.id }, data: { paymentStatus: "failed" } }).catch(() => {});
  }
  return NextResponse.redirect(`${checkout}?pago=fallido`, 303);
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
