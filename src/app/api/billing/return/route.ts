import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMPPayment } from "@/lib/billing/mercadopago";
import { planFromFlowId } from "@/lib/billing/plans-config";

/**
 * GET /api/billing/return?payment_id=...&status=...&plan=...
 *
 * MercadoPago redirige aquí después de que el usuario completa
 * el pago único mensual.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const paymentId = params.get("payment_id") || params.get("collection_id");
  const paymentStatus = params.get("status") || params.get("collection_status");
  const planParam = params.get("plan");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://${req.headers.get("host")}`;

  if (!paymentId) {
    return NextResponse.redirect(`${baseUrl}/panel?billing=error&reason=no_payment_id`);
  }

  // Verificar pago en MercadoPago
  let mpPayment;
  try {
    mpPayment = await getMPPayment(paymentId);
  } catch (err: any) {
    console.error("[billing/return] getMPPayment falló:", err?.message);
    return NextResponse.redirect(`${baseUrl}/panel?billing=error&reason=payment_verify_failed`);
  }

  if (mpPayment.status !== "approved" && paymentStatus !== "approved") {
    return NextResponse.redirect(`${baseUrl}/panel?billing=error&reason=payment_not_approved`);
  }

  // Buscar restaurant por external_reference (restaurantId)
  const restaurantId = mpPayment.externalReference;
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });

  if (!restaurant) {
    return NextResponse.redirect(`${baseUrl}/panel?billing=error&reason=restaurant_not_found`);
  }

  const appPlan = ((restaurant.pendingMpPlanId ? planFromFlowId(restaurant.pendingMpPlanId) : planParam) || restaurant.plan) as "SILVER" | "GOLD" | "PREMIUM";
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: {
      plan: appPlan,
      subscriptionStatus: "ACTIVE",
      mpPlanId: restaurant.pendingMpPlanId,
      currentPeriodEnd: periodEnd,
      lastPaymentAt: new Date(),
      pendingMpPlanId: null,
      // Limpiar campos de suscripción recurrente legacy
      mpSubscriptionId: null,
    },
  });

  return NextResponse.redirect(`${baseUrl}/panel?billing=success&plan=${appPlan}`);
}
