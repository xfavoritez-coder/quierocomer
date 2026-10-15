import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * POST /api/ecommerce/payment/fail { orderId }
 * Marca como "failed" un pago online que quedó pendiente (el cliente abandonó
 * la pasarela). Idempotente y seguro: solo actúa sobre pedidos online cuyo pago
 * sigue en "pending" — nunca pisa un pago ya confirmado (paid).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const orderId = body?.orderId as string | undefined;
  if (!orderId) return NextResponse.json({ error: "orderId requerido" }, { status: 400 });

  const order = await prisma.onlineOrder.findUnique({
    where: { id: orderId },
    select: { id: true, paymentStatus: true, paymentGateway: true, statusHistory: true, createdAt: true },
  });
  if (!order) return NextResponse.json({ ok: false }, { status: 404 });

  if (order.paymentGateway && order.paymentStatus === "pending") {
    // El cliente volvió a la tienda con el pago aún pendiente (nunca completó en
    // la pasarela, así que no hubo respuesta de Transbank/Flow/MP). Dejamos un
    // PAYMENT_LOG para que el panel muestre un motivo en vez de "sin detalle".
    const hist = Array.isArray(order.statusHistory) ? (order.statusHistory as unknown[]) : [];
    const secondsOnForm = Math.round((Date.now() - order.createdAt.getTime()) / 1000);
    const log = { status: "PAYMENT_LOG", ts: new Date().toISOString(), category: "abandoned", reason: "Volvió a la tienda sin completar el pago en la pasarela", secondsOnForm };
    await prisma.onlineOrder.update({
      where: { id: order.id },
      data: { paymentStatus: "failed", statusHistory: [...hist, log] as unknown as object },
    });
    return NextResponse.json({ ok: true, failed: true });
  }
  return NextResponse.json({ ok: true, failed: false, paymentStatus: order.paymentStatus });
}
