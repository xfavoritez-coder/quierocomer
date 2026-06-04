import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { flowPost } from "@/lib/billing/flow";

/**
 * POST /api/billing/webhook
 *
 * Flow.cl envía confirmación de pago aquí (urlConfirmation).
 * Verifica el pago y actualiza el restaurant.
 */
export async function POST(req: NextRequest) {
  let formData: FormData;
  try { formData = await req.formData(); } catch {
    return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 });
  }

  const token = (formData.get("token") as string | null) || null;
  if (!token) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Verificar estado del pago
  let payment: { status: number; commerceOrder: string; amount: number };
  try {
    payment = await flowPost<any>("/payment/getStatus", { token });
  } catch (err: any) {
    console.error("[billing/webhook] getStatus falló:", err?.message);
    return NextResponse.json({ ok: true, error: "getStatus_failed" });
  }

  // Solo procesar pagos aprobados (status 2)
  if (payment.status !== 2) {
    console.log(`[billing/webhook] Pago status ${payment.status} — ignorando`);
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Buscar restaurant por token
  const restaurant = await prisma.restaurant.findFirst({
    where: { flowRegisterToken: token },
  });

  if (!restaurant) {
    console.log(`[billing/webhook] No se encontró restaurant para token ${token}`);
    return NextResponse.json({ ok: true, ignored: true });
  }

  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: {
      subscriptionStatus: "ACTIVE",
      currentPeriodEnd: periodEnd,
      lastPaymentAt: new Date(),
    },
  });

  console.log(`[billing/webhook] Pago confirmado: ${restaurant.name}`);
  return NextResponse.json({ ok: true });
}
