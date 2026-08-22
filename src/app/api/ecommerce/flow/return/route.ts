import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { confirmFlowPayment } from "@/lib/payments/flowConfirm";

export const runtime = "nodejs";

/**
 * Retorno del cliente desde Flow (urlReturn). Flow redirige el navegador (POST
 * con token). Confirmamos como respaldo y llevamos al seguimiento del pedido.
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

  const order = await prisma.onlineOrder.findFirst({ where: { flowToken: token }, select: { id: true, paymentStatus: true } });
  if (!order) return NextResponse.redirect(`${baseUrl}/?pago=error`, 303);

  // Confirmar como respaldo (por si el webhook aún no llegó).
  const paid = order.paymentStatus === "paid" ? true : await confirmFlowPayment(token).catch(() => false);
  return NextResponse.redirect(`${baseUrl}/pedido/${order.id}?pago=${paid ? "exito" : "pendiente"}`, 303);
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
