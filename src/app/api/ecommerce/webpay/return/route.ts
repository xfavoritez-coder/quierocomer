import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { webpayConfirm, webpaySettingsFor } from "@/lib/payments/webpay";

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

  // Pago cancelado/abortado por el usuario
  if (tbkToken && !tokenWs) {
    const order = await prisma.onlineOrder.findFirst({ where: { webpayToken: tbkToken }, select: { id: true } });
    if (order) await prisma.onlineOrder.update({ where: { id: order.id }, data: { paymentStatus: "failed" } });
    return NextResponse.redirect(order ? `${baseUrl}/pedido/${order.id}?pago=cancelado` : `${baseUrl}/?pago=cancelado`, 303);
  }

  if (!tokenWs) return NextResponse.redirect(`${baseUrl}/?pago=error`, 303);

  const order = await prisma.onlineOrder.findFirst({ where: { webpayToken: tokenWs } });
  if (!order) return NextResponse.redirect(`${baseUrl}/?pago=error`, 303);

  // Si ya se confirmó antes, redirigir según su estado (idempotente)
  if (order.paymentStatus === "paid") {
    return NextResponse.redirect(`${baseUrl}/pedido/${order.id}?pago=exito`, 303);
  }

  const result = await webpayConfirm(tokenWs, webpaySettingsFor(null));

  if (result.ok && result.authorized) {
    await prisma.onlineOrder.update({
      where: { id: order.id },
      data: { paymentStatus: "paid", paidAt: new Date() },
    });
    return NextResponse.redirect(`${baseUrl}/pedido/${order.id}?pago=exito`, 303);
  }

  await prisma.onlineOrder.update({ where: { id: order.id }, data: { paymentStatus: "failed" } });
  return NextResponse.redirect(`${baseUrl}/pedido/${order.id}?pago=fallido`, 303);
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
