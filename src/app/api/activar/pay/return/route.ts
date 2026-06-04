import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMPPayment, getMPSubscription } from "@/lib/billing/mercadopago";
import { FLOW_PLANS, planFromFlowId, grossOf, PLAN_LABELS, type PlanKey } from "@/lib/billing/plans-config";
import { sendAdminEmail, planActivatedEmailHtml, adminNewActivationEmailHtml } from "@/lib/email/sendAdminEmail";

/**
 * GET /api/activar/pay/return?plan=...&status=approved&payment_id=...
 *
 * MercadoPago redirige aquí después de un pago exitoso (Checkout Pro)
 * desde la página de activación (demo → pagado).
 * También soporta el flujo legacy de suscripciones (preapproval_id).
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://${req.headers.get("host")}`;
  const planParam = params.get("plan");
  const mpStatus = params.get("status");
  const paymentId = params.get("payment_id");
  const preapprovalId = params.get("preapproval_id");

  // ── Checkout Pro flow (payment_id) ──
  if (paymentId) {
    if (mpStatus !== "approved") {
      return NextResponse.redirect(`${baseUrl}/pago-cancelado`);
    }

    let restaurantId: string | null = null;
    try {
      const payment = await getMPPayment(paymentId);
      restaurantId = payment.externalReference;
    } catch (err: any) {
      console.warn("[activar/pay/return] getMPPayment falló:", err?.message);
    }

    if (!restaurantId) return NextResponse.redirect(`${baseUrl}/pago-cancelado`);

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: { owner: { select: { email: true, name: true } } },
    });
    if (!restaurant) return NextResponse.redirect(`${baseUrl}/pago-cancelado`);

    // Idempotencia
    if (!restaurant.isDemo) {
      return NextResponse.redirect(`${baseUrl}/activar/${restaurant.slug}/exito?plan=${restaurant.plan}`);
    }

    const appPlan = (planFromFlowId(restaurant.pendingMpPlanId || "") || planParam || "PREMIUM") as "SILVER" | "GOLD" | "PREMIUM";
    const planKey = appPlan as Exclude<PlanKey, "FREE">;
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await activateRestaurant(restaurant, appPlan, periodEnd);
    await sendActivationEmails(restaurant, appPlan, planKey, periodEnd, baseUrl);

    return NextResponse.redirect(`${baseUrl}/activar/${restaurant.slug}/exito?plan=${appPlan}`);
  }

  // ── Legacy: subscription flow (preapproval_id) ──
  if (preapprovalId) {
    let mpSub;
    try {
      mpSub = await getMPSubscription(preapprovalId);
    } catch (err: any) {
      console.error("[activar/pay/return] getMPSubscription falló:", err?.message);
      return NextResponse.redirect(`${baseUrl}/pago-cancelado`);
    }

    const restaurantId = mpSub.externalReference;
    if (!restaurantId) return NextResponse.redirect(`${baseUrl}/pago-cancelado`);

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: { owner: { select: { email: true, name: true } } },
    });
    if (!restaurant || !restaurant.pendingMpPlanId) return NextResponse.redirect(`${baseUrl}/pago-cancelado`);

    if (!restaurant.isDemo) {
      return NextResponse.redirect(`${baseUrl}/activar/${restaurant.slug}/exito?plan=${restaurant.plan}`);
    }

    if (!["authorized", "pending"].includes(mpSub.status)) {
      await prisma.restaurant.update({ where: { id: restaurant.id }, data: { pendingMpPlanId: null } });
      return NextResponse.redirect(`${baseUrl}/activar/${restaurant.slug}?pago=error&reason=subscription_rejected`);
    }

    const appPlan = (planFromFlowId(restaurant.pendingMpPlanId) || planParam || "PREMIUM") as "SILVER" | "GOLD" | "PREMIUM";
    const planKey = appPlan as Exclude<PlanKey, "FREE">;
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await activateRestaurant(restaurant, appPlan, periodEnd, preapprovalId);
    await sendActivationEmails(restaurant, appPlan, planKey, periodEnd, baseUrl);

    return NextResponse.redirect(`${baseUrl}/activar/${restaurant.slug}/exito?plan=${appPlan}`);
  }

  return NextResponse.redirect(`${baseUrl}/pago-cancelado`);
}

// ── Helpers ──

async function activateRestaurant(restaurant: any, appPlan: string, periodEnd: Date, mpSubscriptionId?: string) {
  await prisma.$transaction([
    prisma.restaurant.update({
      where: { id: restaurant.id },
      data: {
        isDemo: false, plan: appPlan as any, subscriptionStatus: "ACTIVE",
        mpPlanId: restaurant.pendingMpPlanId,
        ...(mpSubscriptionId ? { mpSubscriptionId } : {}),
        currentPeriodEnd: periodEnd, lastPaymentAt: new Date(),
        pendingMpPlanId: null, weeklyEmailEnabled: true,
      },
    }),
    prisma.dish.updateMany({ where: { restaurantId: restaurant.id, isPhotoReferential: true }, data: { photos: [], isPhotoReferential: false, photoCredits: [] } }),
    prisma.session.deleteMany({ where: { restaurantId: restaurant.id } }),
  ]);

  // Traducción para Gold y Premium
  if (appPlan === "GOLD" || appPlan === "PREMIUM") {
    import("@/lib/ai/translateContent").then(({ translateAllForRestaurant }) => {
      translateAllForRestaurant(restaurant.id)
        .then(() => prisma.restaurant.update({ where: { id: restaurant.id }, data: { needsTranslation: false } }))
        .catch(() => {});
    });
  }
}

async function sendActivationEmails(restaurant: any, appPlan: string, planKey: Exclude<PlanKey, "FREE">, periodEnd: Date, baseUrl: string) {
  const planLabel = PLAN_LABELS[appPlan as keyof typeof PLAN_LABELS] || appPlan;
  const amountNet = restaurant.customPlanPriceNet ?? FLOW_PLANS[planKey].amountNet;
  const chargeGross = grossOf(amountNet);
  const amountPaid = `$${chargeGross.toLocaleString("es-CL")} CLP`;
  const nextDate = periodEnd.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
  const regularGross = grossOf(FLOW_PLANS[planKey].amountNet);
  const nextAmount = `$${regularGross.toLocaleString("es-CL")} CLP`;
  const ownerEmail = restaurant.owner?.email;
  const ownerName = restaurant.owner?.name || ownerEmail?.split("@")[0] || "Hola";
  const panelLink = `${baseUrl}/api/panel/demo-auth?slug=${restaurant.slug}`;
  const qrLink = `${baseUrl}/qr/${restaurant.slug}`;

  if (ownerEmail) {
    sendAdminEmail({
      to: ownerEmail, subject: `${restaurant.name} · Plan ${planLabel} activado`,
      html: planActivatedEmailHtml(ownerName, restaurant.name, planLabel, amountPaid, nextDate, nextAmount, panelLink, qrLink),
      purpose: "plan_activated",
    }).catch(() => {});
  }
  sendAdminEmail({
    to: "favoritez@gmail.com", subject: `Nuevo cliente: ${restaurant.name} activó ${planLabel}`,
    html: adminNewActivationEmailHtml(restaurant.name, planLabel, amountPaid, ownerEmail || "sin email", restaurant.slug || ""),
    purpose: "admin_new_activation",
  }).catch(() => {});
}
