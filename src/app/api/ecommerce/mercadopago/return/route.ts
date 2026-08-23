import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { confirmMercadoPagoPayment } from "@/lib/payments/mercadopagoConfirm";

export const runtime = "nodejs";

/**
 * Retorno del cliente desde MercadoPago (back_urls). Trae ?order=… y los
 * parámetros de estado/pago. Confirmamos como respaldo y llevamos al
 * seguimiento del pedido.
 */
async function handle(req: NextRequest) {
  const baseUrl = req.nextUrl.origin;
  const orderId = req.nextUrl.searchParams.get("order");
  const paymentId = req.nextUrl.searchParams.get("payment_id") || req.nextUrl.searchParams.get("collection_id");
  const status = req.nextUrl.searchParams.get("status") || req.nextUrl.searchParams.get("collection_status");

  if (!orderId) return NextResponse.redirect(`${baseUrl}/?pago=error`, 303);

  const order = await prisma.onlineOrder.findUnique({ where: { id: orderId }, select: { paymentStatus: true } });
  if (!order) return NextResponse.redirect(`${baseUrl}/?pago=error`, 303);

  let paid = order.paymentStatus === "paid";
  if (!paid && paymentId) paid = await confirmMercadoPagoPayment(orderId, paymentId).catch(() => false);
  else if (!paid) paid = status === "approved";

  return NextResponse.redirect(`${baseUrl}/pedido/${orderId}?pago=${paid ? "exito" : "pendiente"}`, 303);
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
