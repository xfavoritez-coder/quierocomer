import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Payment } from "mercadopago";
import { initMercadoPago, createMPSubscription } from "@/lib/billing/mercadopago";
import { FLOW_PLANS, planFromFlowId, grossOf, PLAN_LABELS } from "@/lib/billing/plans-config";
import { sendAdminEmail, planActivatedEmailHtml, adminNewActivationEmailHtml } from "@/lib/email/sendAdminEmail";

/**
 * GET /api/activar/pay/return
 *
 * Dos flujos posibles:
 * 1. Pago unico (promo): MP envia payment_id + external_reference
 *    → verificamos pago, creamos suscripcion desde dia 30, activamos.
 * 2. Suscripcion directa: MP envia preapproval_id
 *    → verificamos suscripcion, activamos.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://${req.headers.get("host")}`;

  const paymentId = params.get("payment_id") || params.get("collection_id");
  const status = params.get("status") || params.get("collection_status");
  const externalReference = params.get("external_reference");
  const preapprovalId = params.get("preapproval_id");

  // ── Flujo suscripcion directa (sin promo) ──
  if (preapprovalId && !paymentId) {
    return handleSubscriptionReturn(preapprovalId, externalReference, baseUrl);
  }

  // ── Flujo pago unico (promo) ──
  if (!paymentId || !externalReference) {
    return NextResponse.redirect(`${baseUrl}/pago-cancelado`);
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: externalReference },
    include: { owner: { select: { email: true, name: true } } },
  });

  if (!restaurant || !restaurant.pendingMpPlanId) {
    return NextResponse.redirect(`${baseUrl}/pago-cancelado`);
  }

  if (!restaurant.isDemo) {
    return NextResponse.redirect(`${baseUrl}/activar/${restaurant.slug}/exito?plan=${restaurant.plan}`);
  }

  // Verificar pago
  let paymentApproved = false;
  if (status === "approved") {
    try {
      const config = initMercadoPago();
      const paymentClient = new Payment(config);
      const paymentData = await paymentClient.get({ id: Number(paymentId) });
      paymentApproved = paymentData.status === "approved";
    } catch (err: any) {
      console.error("[activar/pay/return] Error verificando pago:", err?.message);
      paymentApproved = true;
    }
  }

  if (!paymentApproved) {
    await prisma.restaurant.update({ where: { id: restaurant.id }, data: { pendingMpPlanId: null } });
    const reason = status === "pending" ? "payment_pending" : "payment_rejected";
    const hasLead = await prisma.lead.findFirst({ where: { generatedSlug: restaurant.slug }, select: { id: true } });
    const errorPage = hasLead ? "activar" : "registrar";
    return NextResponse.redirect(`${baseUrl}/${errorPage}/${restaurant.slug}?pago=error&reason=${reason}`);
  }

  const appPlan = planFromFlowId(restaurant.pendingMpPlanId) || "PREMIUM";
  const planKey = appPlan as "GOLD" | "PREMIUM";
  const chargeGross = grossOf(FLOW_PLANS[planKey].amountNet);
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // Crear suscripcion recurrente que empieza en 30 dias
  let subscriptionId = "";
  try {
    const subscription = await createMPSubscription({
      planKey,
      payerEmail: restaurant.owner?.email || "",
      externalReference: restaurant.id,
      startDate: periodEnd,
    });
    subscriptionId = subscription.id;
  } catch (err: any) {
    console.error("[activar/pay/return] createMPSubscription falló:", err?.message);
  }

  // Activar restaurant
  await prisma.$transaction([
    prisma.restaurant.update({
      where: { id: restaurant.id },
      data: {
        isDemo: false, plan: appPlan, subscriptionStatus: "ACTIVE",
        mpSubscriptionId: subscriptionId || null,
        flowPlanId: restaurant.pendingMpPlanId,
        currentPeriodEnd: periodEnd, lastPaymentAt: new Date(),
        pendingMpPlanId: null, weeklyEmailEnabled: true,
      },
    }),
    prisma.dish.updateMany({ where: { restaurantId: restaurant.id, isPhotoReferential: true }, data: { photos: [], isPhotoReferential: false, photoCredits: [] } }),
    prisma.session.deleteMany({ where: { restaurantId: restaurant.id } }),
  ]);

  sendActivationEmails(restaurant, appPlan, planKey, chargeGross, periodEnd, baseUrl);

  if (appPlan === "PREMIUM") {
    import("@/lib/ai/translateContent").then(({ translateAllForRestaurant }) => {
      translateAllForRestaurant(restaurant.id)
        .then(() => prisma.restaurant.update({ where: { id: restaurant.id }, data: { needsTranslation: false } }))
        .catch((err) => console.error(`[activar/pay] Traducción falló:`, err));
    });
  }

  return NextResponse.redirect(`${baseUrl}/activar/${restaurant.slug}/exito?plan=${appPlan}`);
}

/** Maneja return de suscripcion directa (sin promo) */
async function handleSubscriptionReturn(preapprovalId: string, externalReference: string | null, baseUrl: string) {
  let restaurant;
  if (externalReference) {
    restaurant = await prisma.restaurant.findUnique({
      where: { id: externalReference },
      include: { owner: { select: { email: true, name: true } } },
    });
  }

  if (!restaurant || !restaurant.pendingMpPlanId) {
    return NextResponse.redirect(`${baseUrl}/pago-cancelado`);
  }

  if (!restaurant.isDemo) {
    return NextResponse.redirect(`${baseUrl}/activar/${restaurant.slug}/exito?plan=${restaurant.plan}`);
  }

  const appPlan = planFromFlowId(restaurant.pendingMpPlanId) || "GOLD";
  const planKey = appPlan as "GOLD" | "PREMIUM";
  const chargeGross = grossOf(FLOW_PLANS[planKey].amountNet);
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.restaurant.update({
      where: { id: restaurant.id },
      data: {
        isDemo: false, plan: appPlan, subscriptionStatus: "ACTIVE",
        mpSubscriptionId: preapprovalId,
        flowPlanId: restaurant.pendingMpPlanId,
        currentPeriodEnd: periodEnd, lastPaymentAt: new Date(),
        pendingMpPlanId: null, weeklyEmailEnabled: true,
      },
    }),
    prisma.dish.updateMany({ where: { restaurantId: restaurant.id, isPhotoReferential: true }, data: { photos: [], isPhotoReferential: false, photoCredits: [] } }),
    prisma.session.deleteMany({ where: { restaurantId: restaurant.id } }),
  ]);

  sendActivationEmails(restaurant, appPlan, planKey, chargeGross, periodEnd, baseUrl);

  if (appPlan === "PREMIUM") {
    import("@/lib/ai/translateContent").then(({ translateAllForRestaurant }) => {
      translateAllForRestaurant(restaurant.id)
        .then(() => prisma.restaurant.update({ where: { id: restaurant.id }, data: { needsTranslation: false } }))
        .catch((err) => console.error(`[activar/pay] Traducción falló:`, err));
    });
  }

  return NextResponse.redirect(`${baseUrl}/activar/${restaurant.slug}/exito?plan=${appPlan}`);
}

function sendActivationEmails(
  restaurant: { id: string; name: string; slug: string | null; owner: { email: string; name: string | null } | null },
  appPlan: string, planKey: "GOLD" | "PREMIUM", chargeGross: number, periodEnd: Date, baseUrl: string,
) {
  const planLabel = PLAN_LABELS[appPlan as keyof typeof PLAN_LABELS] || appPlan;
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
    }).catch((err) => console.error("[activar/pay] Email al dueño falló:", err));
  }

  sendAdminEmail({
    to: "favoritez@gmail.com", subject: `Nuevo cliente: ${restaurant.name} activó ${planLabel}`,
    html: adminNewActivationEmailHtml(restaurant.name, planLabel, amountPaid, ownerEmail || "sin email", restaurant.slug || ""),
    purpose: "admin_new_activation",
  }).catch((err) => console.error("[activar/pay] Email admin falló:", err));
}
