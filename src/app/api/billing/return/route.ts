import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMPSubscription } from "@/lib/billing/mercadopago";
import { planFromFlowId, FLOW_PLANS, PLAN_LABELS, grossOf, type PlanKey } from "@/lib/billing/plans-config";
import { sendAdminEmail, planActivatedEmailHtml } from "@/lib/email/sendAdminEmail";

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
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: { owner: { select: { email: true, name: true } } },
  });

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

  // Send confirmation email to owner
  const ownerEmail = restaurant.owner?.email;
  const ownerName = restaurant.owner?.name || ownerEmail?.split("@")[0] || "Hola";
  const planKey = appPlan as Exclude<PlanKey, "FREE">;
  const planLabel = PLAN_LABELS[appPlan as keyof typeof PLAN_LABELS] || appPlan;
  const chargeGross = grossOf(FLOW_PLANS[planKey]?.amountNet ?? 0);
  const amountPaid = `$${chargeGross.toLocaleString("es-CL")} CLP`;
  const nextDate = periodEnd.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
  const nextAmount = `$${chargeGross.toLocaleString("es-CL")} CLP`;
  const panelLink = `${baseUrl}/panel`;
  const qrLink = `${baseUrl}/qr/${restaurant.slug}`;

  if (ownerEmail) {
    sendAdminEmail({
      to: ownerEmail,
      subject: `${restaurant.name} · Plan ${planLabel} activado`,
      html: planActivatedEmailHtml(ownerName, restaurant.name, planLabel, amountPaid, nextDate, nextAmount, panelLink, qrLink),
      purpose: "plan_activated",
    }).catch(() => {});
  }

  return NextResponse.redirect(`${baseUrl}/panel/suscripcion/exito?plan=${appPlan}`);
}
