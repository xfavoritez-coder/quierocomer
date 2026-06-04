import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { flowPost } from "@/lib/billing/flow";
import { planFromFlowId } from "@/lib/billing/plans-config";

/**
 * POST /api/billing/webhook
 *
 * Flow.cl envía confirmación de pago aquí (urlConfirmation).
 * Si Flow envía el webhook, el pago fue procesado. Verificamos con getStatus
 * si está disponible, pero si Flow retorna "No services available" activamos
 * igual — el hecho de recibir el webhook ya confirma el pago.
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

  // Buscar restaurant por token
  const restaurant = await prisma.restaurant.findFirst({
    where: { flowRegisterToken: token },
  });

  if (!restaurant) {
    console.log(`[billing/webhook] No se encontró restaurant para token ${token}`);
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Verificar estado del pago — SOLO activar si getStatus confirma (status 2)
  let paymentConfirmed = false;
  try {
    const payment = await flowPost<any>("/payment/getStatus", { token });
    console.log(`[billing/webhook] Flow status: ${payment.status} for ${restaurant.name}`);
    if (payment.status === 2) {
      paymentConfirmed = true;
    } else if (payment.status === 3 || payment.status === 4) {
      console.log(`[billing/webhook] Pago rechazado/anulado para ${restaurant.name}`);
      await prisma.restaurant.update({
        where: { id: restaurant.id },
        data: { flowRegisterToken: null, pendingFlowPlanId: null },
      });
      return NextResponse.json({ ok: true, rejected: true });
    } else {
      console.log(`[billing/webhook] Pago pendiente (status ${payment.status}) para ${restaurant.name} — no activar aún`);
      return NextResponse.json({ ok: true, pending: true });
    }
  } catch (err: any) {
    console.error(`[billing/webhook] getStatus falló — NO se activa: ${err?.message}`);
    return NextResponse.json({ ok: true, error: "getStatus_unavailable" });
  }

  if (!paymentConfirmed) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Activar plan — solo si pago confirmado
  const appPlan = planFromFlowId(restaurant.pendingFlowPlanId || "") || restaurant.plan;
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: {
      plan: appPlan,
      subscriptionStatus: "ACTIVE",
      flowPlanId: restaurant.pendingFlowPlanId,
      currentPeriodEnd: periodEnd,
      lastPaymentAt: new Date(),
      pendingFlowPlanId: null,
      // NO borrar flowRegisterToken aquí — el return handler lo necesita para encontrar el restaurant
    },
  });

  console.log(`[billing/webhook] Pago confirmado: ${restaurant.name} → ${appPlan}`);
  return NextResponse.json({ ok: true, plan: appPlan });
}
