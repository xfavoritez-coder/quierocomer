import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Payment } from "mercadopago";
import { initMercadoPago } from "@/lib/billing/mercadopago";
import { planFromFlowId, GRACE_DAYS } from "@/lib/billing/plans-config";

/**
 * GET /api/billing/return?payment_id=...&status=...&external_reference=...
 *
 * MercadoPago redirige aqui despues del pago unico de upgrade.
 * Verifica el pago y activa/renueva el plan por 30 dias.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://${req.headers.get("host")}`;

  const paymentId = params.get("payment_id") || params.get("collection_id");
  const status = params.get("status") || params.get("collection_status");
  const externalReference = params.get("external_reference");

  if (!paymentId || !externalReference) {
    return NextResponse.redirect(`${baseUrl}/panel?billing=error&reason=no_payment`);
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: externalReference },
  });

  if (!restaurant || !restaurant.pendingMpPlanId) {
    return NextResponse.redirect(`${baseUrl}/panel?billing=error&reason=not_found`);
  }

  // Verificar pago con API de MP
  let paymentApproved = false;
  if (status === "approved") {
    try {
      const config = initMercadoPago();
      const paymentClient = new Payment(config);
      const paymentData = await paymentClient.get({ id: Number(paymentId) });
      paymentApproved = paymentData.status === "approved";
    } catch (err: any) {
      console.error("[billing/return] Error verificando pago:", err?.message);
      paymentApproved = true;
    }
  }

  if (!paymentApproved) {
    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { pendingMpPlanId: null },
    });
    return NextResponse.redirect(`${baseUrl}/panel?billing=error&reason=payment_failed`);
  }

  // Determinar si es reactivación dentro de gracia
  const previousEnd = restaurant.currentPeriodEnd;
  const now = new Date();
  const isReactivationInGrace =
    previousEnd && (now.getTime() - previousEnd.getTime()) <= GRACE_DAYS * 24 * 60 * 60 * 1000;

  const appPlan = planFromFlowId(restaurant.pendingMpPlanId) || restaurant.plan;
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: {
      plan: appPlan,
      subscriptionStatus: "ACTIVE",
      currentPeriodEnd: isReactivationInGrace && previousEnd
        ? new Date(previousEnd.getTime() + 30 * 24 * 60 * 60 * 1000)
        : periodEnd,
      lastPaymentAt: new Date(),
      pendingMpPlanId: null,
    },
  });

  return NextResponse.redirect(`${baseUrl}/panel?billing=success&plan=${appPlan}`);
}
