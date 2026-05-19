import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMPSubscription } from "@/lib/billing/mercadopago";
import { planFromFlowId, GRACE_DAYS } from "@/lib/billing/plans-config";

/**
 * GET /api/billing/return?preapproval_id=...
 *
 * MercadoPago redirige aqui despues de que el usuario completa
 * el flujo de suscripcion para upgrade de plan.
 */
export async function GET(req: NextRequest) {
  const preapprovalId = req.nextUrl.searchParams.get("preapproval_id");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://${req.headers.get("host")}`;

  if (!preapprovalId) {
    return NextResponse.redirect(`${baseUrl}/panel?billing=error&reason=no_preapproval_id`);
  }

  const restaurant = await prisma.restaurant.findFirst({
    where: { mpSubscriptionId: preapprovalId },
  });
  if (!restaurant || !restaurant.pendingMpPlanId) {
    return NextResponse.redirect(`${baseUrl}/panel?billing=error&reason=not_found`);
  }

  // Verificar estado real en MP
  let mpSub;
  try {
    mpSub = await getMPSubscription(preapprovalId);
  } catch (err: any) {
    console.error("[billing/return] getMPSubscription fallo:", err?.message);
    await prisma.restaurant.update({ where: { id: restaurant.id }, data: { pendingMpPlanId: null } });
    return NextResponse.redirect(`${baseUrl}/panel?billing=error&reason=subscription_failed`);
  }

  if (mpSub.status !== "authorized" && mpSub.status !== "pending") {
    await prisma.restaurant.update({ where: { id: restaurant.id }, data: { pendingMpPlanId: null, mpSubscriptionId: null } });
    return NextResponse.redirect(`${baseUrl}/panel?billing=error&reason=register_failed`);
  }

  // Grace period: reactivacion dentro de 7 dias sin trial extra
  const previousEnd = restaurant.currentPeriodEnd;
  const now = new Date();
  const isReactivationInGrace = previousEnd && (now.getTime() - previousEnd.getTime()) <= GRACE_DAYS * 24 * 60 * 60 * 1000;

  const appPlan = planFromFlowId(restaurant.pendingMpPlanId) || restaurant.plan;
  const periodEnd = isReactivationInGrace && previousEnd
    ? new Date(previousEnd.getTime() + 30 * 24 * 60 * 60 * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: {
      plan: appPlan,
      subscriptionStatus: "ACTIVE",
      mpPlanId: restaurant.pendingMpPlanId,
      currentPeriodEnd: periodEnd,
      lastPaymentAt: new Date(),
      pendingMpPlanId: null,
    },
  });

  return NextResponse.redirect(`${baseUrl}/panel?billing=success&plan=${appPlan}`);
}
