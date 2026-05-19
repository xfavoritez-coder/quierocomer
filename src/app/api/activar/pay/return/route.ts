import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMPSubscription } from "@/lib/billing/mercadopago";
import { FLOW_PLANS, planFromFlowId, grossOf, PLAN_LABELS } from "@/lib/billing/plans-config";
import { sendAdminEmail, planActivatedEmailHtml, adminNewActivationEmailHtml } from "@/lib/email/sendAdminEmail";

/**
 * GET /api/activar/pay/return?preapproval_id=...&external_reference=...
 *
 * MercadoPago redirige aqui despues de que el usuario completa
 * el registro de su tarjeta en la suscripcion.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://${req.headers.get("host")}`;

  const preapprovalId = params.get("preapproval_id");
  const externalReference = params.get("external_reference");

  if (!preapprovalId && !externalReference) {
    return NextResponse.redirect(`${baseUrl}/pago-cancelado`);
  }

  // Buscar restaurant
  let restaurant;
  if (externalReference) {
    restaurant = await prisma.restaurant.findUnique({
      where: { id: externalReference },
      include: { owner: { select: { email: true, name: true } } },
    });
  }
  if (!restaurant && preapprovalId) {
    restaurant = await prisma.restaurant.findFirst({
      where: { mpSubscriptionId: preapprovalId },
      include: { owner: { select: { email: true, name: true } } },
    });
  }

  if (!restaurant || !restaurant.pendingMpPlanId) {
    return NextResponse.redirect(`${baseUrl}/pago-cancelado`);
  }

  // Idempotencia
  if (!restaurant.isDemo) {
    return NextResponse.redirect(`${baseUrl}/activar/${restaurant.slug}/exito?plan=${restaurant.plan}`);
  }

  // Verificar estado de la suscripcion en MP
  if (preapprovalId) {
    try {
      const mpSub = await getMPSubscription(preapprovalId);
      if (mpSub.status !== "authorized" && mpSub.status !== "pending") {
        await prisma.restaurant.update({ where: { id: restaurant.id }, data: { pendingMpPlanId: null } });
        const hasLead = await prisma.lead.findFirst({ where: { generatedSlug: restaurant.slug }, select: { id: true } });
        const errorPage = hasLead ? "activar" : "registrar";
        return NextResponse.redirect(`${baseUrl}/${errorPage}/${restaurant.slug}?pago=error&reason=subscription_rejected`);
      }
    } catch (err: any) {
      console.error("[activar/pay/return] getMPSubscription falló:", err?.message);
      // Continuamos — MP ya redirigió con éxito
    }
  }

  const appPlan = planFromFlowId(restaurant.pendingMpPlanId) || "PREMIUM";
  const planKey = appPlan as "GOLD" | "PREMIUM";
  const chargeGross = grossOf(FLOW_PLANS[planKey].amountNet);
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // Activar restaurant
  await prisma.$transaction([
    prisma.restaurant.update({
      where: { id: restaurant.id },
      data: {
        isDemo: false, plan: appPlan, subscriptionStatus: "ACTIVE",
        mpSubscriptionId: preapprovalId || null,
        flowPlanId: restaurant.pendingMpPlanId,
        currentPeriodEnd: periodEnd, lastPaymentAt: new Date(),
        pendingMpPlanId: null, weeklyEmailEnabled: true,
      },
    }),
    prisma.dish.updateMany({ where: { restaurantId: restaurant.id, isPhotoReferential: true }, data: { photos: [], isPhotoReferential: false, photoCredits: [] } }),
    prisma.session.deleteMany({ where: { restaurantId: restaurant.id } }),
  ]);

  // Emails
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
    }).catch(() => {});
  }
  sendAdminEmail({
    to: "favoritez@gmail.com", subject: `Nuevo cliente: ${restaurant.name} activó ${planLabel}`,
    html: adminNewActivationEmailHtml(restaurant.name, planLabel, amountPaid, ownerEmail || "sin email", restaurant.slug || ""),
    purpose: "admin_new_activation",
  }).catch(() => {});

  // Traduccion para Premium
  if (appPlan === "PREMIUM") {
    import("@/lib/ai/translateContent").then(({ translateAllForRestaurant }) => {
      translateAllForRestaurant(restaurant.id)
        .then(() => prisma.restaurant.update({ where: { id: restaurant.id }, data: { needsTranslation: false } }))
        .catch(() => {});
    });
  }

  return NextResponse.redirect(`${baseUrl}/activar/${restaurant.slug}/exito?plan=${appPlan}`);
}
