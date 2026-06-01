import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMPSubscription } from "@/lib/billing/mercadopago";
import { planFromFlowId } from "@/lib/billing/plans-config";

/**
 * GET /api/billing/return?preapproval_id=...&plan=...
 *
 * MercadoPago redirige aquí después de que el usuario autoriza la suscripción.
 * La suscripción puede estar en "authorized" o "pending" — el primer cobro
 * puede tardar unos segundos. El webhook se encarga de confirmar el pago.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const preapprovalId = params.get("preapproval_id");
  const planParam = params.get("plan");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://${req.headers.get("host")}`;

  if (!preapprovalId) {
    return NextResponse.redirect(`${baseUrl}/panel?billing=error&reason=no_subscription_id`);
  }

  // Verificar suscripción en MercadoPago
  let mpSub;
  try {
    mpSub = await getMPSubscription(preapprovalId);
  } catch (err: any) {
    console.error("[billing/return] getMPSubscription falló:", err?.message);
    return NextResponse.redirect(`${baseUrl}/panel?billing=error&reason=subscription_verify_failed`);
  }

  // "authorized" o "pending" son estados válidos post-checkout
  if (!["authorized", "pending"].includes(mpSub.status)) {
    return NextResponse.redirect(`${baseUrl}/panel?billing=error&reason=subscription_not_authorized`);
  }

  const restaurantId = mpSub.externalReference;
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
      mpSubscriptionId: preapprovalId,
      currentPeriodEnd: periodEnd,
      lastPaymentAt: new Date(),
      pendingMpPlanId: null,
    },
  });

  return NextResponse.redirect(`${baseUrl}/panel?billing=success&plan=${appPlan}`);
}
