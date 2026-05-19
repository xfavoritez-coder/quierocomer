import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMPSubscription } from "@/lib/billing/mercadopago";
import { planFromFlowId, TRIAL_DAYS, GRACE_DAYS } from "@/lib/billing/plans-config";

/**
 * GET /api/billing/return?preapproval_id=...&status=...
 *
 * MercadoPago redirige aqui despues de que el comerciante completo el flujo
 * de suscripcion. Verificamos el estado real via API y actualizamos la DB.
 */
export async function GET(req: NextRequest) {
  const preapprovalId = req.nextUrl.searchParams.get("preapproval_id");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://${req.headers.get("host")}`;

  if (!preapprovalId) {
    return NextResponse.redirect(`${baseUrl}/panel?billing=error&reason=no_preapproval_id`);
  }

  // Buscar el restaurant por mpSubscriptionId (guardado en /start)
  const restaurant = await prisma.restaurant.findFirst({
    where: { mpSubscriptionId: preapprovalId },
  });
  if (!restaurant || !restaurant.pendingMpPlanId) {
    return NextResponse.redirect(`${baseUrl}/panel?billing=error&reason=not_found`);
  }

  // Consultar el estado real de la suscripcion en MercadoPago
  let mpSub;
  try {
    mpSub = await getMPSubscription(preapprovalId);
  } catch (err: any) {
    console.error("[billing/return] getMPSubscription fallo:", err?.message);
    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { pendingMpPlanId: null },
    });
    return NextResponse.redirect(`${baseUrl}/panel?billing=error&reason=subscription_failed`);
  }

  // MP status: "authorized", "pending", "paused", "cancelled"
  // Solo continuamos si es authorized o pending (el usuario completo el flujo)
  if (mpSub.status !== "authorized" && mpSub.status !== "pending") {
    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { pendingMpPlanId: null, mpSubscriptionId: null },
    });
    return NextResponse.redirect(`${baseUrl}/panel?billing=error&reason=register_failed`);
  }

  // Determinar si hay reactivacion dentro de gracia (7 dias) → sin trial
  const previousEnd = restaurant.currentPeriodEnd;
  const now = new Date();
  const isReactivationInGrace =
    previousEnd && (now.getTime() - previousEnd.getTime()) <= GRACE_DAYS * 24 * 60 * 60 * 1000;

  const appPlan = planFromFlowId(restaurant.pendingMpPlanId) || restaurant.plan;
  const trialEndsAt = isReactivationInGrace ? null : new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const newStatus = isReactivationInGrace ? "ACTIVE" : (mpSub.status === "authorized" ? "ACTIVE" : "TRIALING");

  const nextPayment = mpSub.nextPaymentDate ? new Date(mpSub.nextPaymentDate) : null;

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: {
      mpSubscriptionId: preapprovalId,
      mpPlanId: restaurant.pendingMpPlanId,
      plan: appPlan,
      subscriptionStatus: newStatus,
      trialEndsAt,
      currentPeriodEnd: nextPayment || (trialEndsAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
      pendingMpPlanId: null,
    },
  });

  return NextResponse.redirect(`${baseUrl}/panel?billing=success&plan=${appPlan}`);
}
