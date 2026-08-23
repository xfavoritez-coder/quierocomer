import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { confirmFlowPayment } from "@/lib/payments/flowConfirm";

export const runtime = "nodejs";

/**
 * Retorno del cliente desde Flow (urlReturn). Flow redirige el navegador (POST
 * con token).
 *  - Pagado → volvemos al checkout con ?pago=exito (vacía carrito → seguimiento).
 *  - No pagado → marcamos el pago fallido y volvemos al checkout con ?pago=fallido.
 */
async function handle(req: NextRequest) {
  const baseUrl = req.nextUrl.origin;
  let token: string | null = null;
  if (req.method === "POST") {
    const form = await req.formData().catch(() => null);
    token = (form?.get("token") as string) || null;
  } else {
    token = req.nextUrl.searchParams.get("token");
  }

  if (!token) return NextResponse.redirect(`${baseUrl}/?pago=error`, 303);

  const order = await prisma.onlineOrder.findFirst({
    where: { flowToken: token },
    select: { id: true, paymentStatus: true, restaurant: { select: { slug: true } } },
  });
  if (!order) return NextResponse.redirect(`${baseUrl}/?pago=error`, 303);

  // Confirmar como respaldo (por si el webhook aún no llegó).
  const paid = order.paymentStatus === "paid" ? true : await confirmFlowPayment(token).catch(() => false);

  const checkout = `${baseUrl}/ecommerce/${order.restaurant.slug}/checkout`;
  if (paid) return NextResponse.redirect(`${checkout}?pago=exito&order=${order.id}`, 303);

  if (order.paymentStatus === "pending") {
    await prisma.onlineOrder.update({ where: { id: order.id }, data: { paymentStatus: "failed" } }).catch(() => {});
  }
  return NextResponse.redirect(`${checkout}?pago=fallido`, 303);
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
