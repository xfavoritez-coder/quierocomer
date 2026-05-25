import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMPPayment } from "@/lib/billing/mercadopago";
import { FLOW_PLANS, planFromFlowId, grossOf, PLAN_LABELS, type PlanKey } from "@/lib/billing/plans-config";
import { sendAdminEmail, planActivatedEmailHtml, adminNewActivationEmailHtml } from "@/lib/email/sendAdminEmail";

/**
 * GET /api/activar/pay/return?payment_id=...&status=...&plan=...
 *
 * MercadoPago redirige aquí después de que el usuario completa el pago único.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://${req.headers.get("host")}`;

  const paymentId = params.get("payment_id") || params.get("collection_id");
  const paymentStatus = params.get("status") || params.get("collection_status");
  const planParam = params.get("plan");
  const externalReference = params.get("external_reference");

  if (!paymentId && !externalReference) {
    return NextResponse.redirect(`${baseUrl}/pago-cancelado`);
  }

  // Verificar pago en MercadoPago
  let mpPayment;
  if (paymentId) {
    try {
      mpPayment = await getMPPayment(paymentId);
    } catch (err: any) {
      console.error("[activar/pay/return] getMPPayment falló:", err?.message);
    }
  }

  // Buscar restaurant
  const restaurantId = mpPayment?.externalReference || externalReference;
  if (!restaurantId) {
    return NextResponse.redirect(`${baseUrl}/pago-cancelado`);
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: { owner: { select: { email: true, name: true } } },
  });

  if (!restaurant || !restaurant.pendingMpPlanId) {
    return NextResponse.redirect(`${baseUrl}/pago-cancelado`);
  }

  // Idempotencia
  if (!restaurant.isDemo) {
    return NextResponse.redirect(`${baseUrl}/activar/${restaurant.slug}/exito?plan=${restaurant.plan}`);
  }

  // Verificar estado del pago
  if (mpPayment && mpPayment.status !== "approved" && paymentStatus !== "approved") {
    await prisma.restaurant.update({ where: { id: restaurant.id }, data: { pendingMpPlanId: null } });
    return NextResponse.redirect(`${baseUrl}/activar/${restaurant.slug}?pago=error&reason=payment_rejected`);
  }

  const appPlan = (planFromFlowId(restaurant.pendingMpPlanId) || planParam || "PREMIUM") as "SILVER" | "GOLD" | "PREMIUM";
  const planKey = appPlan as Exclude<PlanKey, "FREE">;
  const chargeGross = grossOf(FLOW_PLANS[planKey].amountNet);
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // Activar restaurant
  await prisma.$transaction([
    prisma.restaurant.update({
      where: { id: restaurant.id },
      data: {
        isDemo: false, plan: appPlan, subscriptionStatus: "ACTIVE",
        mpPlanId: restaurant.pendingMpPlanId,
        currentPeriodEnd: periodEnd, lastPaymentAt: new Date(),
        pendingMpPlanId: null, weeklyEmailEnabled: true,
        mpSubscriptionId: null, // No hay suscripción recurrente
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

  // Traducción para Gold y Premium (multilang feature)
  if (appPlan === "GOLD" || appPlan === "PREMIUM") {
    import("@/lib/ai/translateContent").then(({ translateAllForRestaurant }) => {
      translateAllForRestaurant(restaurant.id)
        .then(() => prisma.restaurant.update({ where: { id: restaurant.id }, data: { needsTranslation: false } }))
        .catch(() => {});
    });
  }

  return NextResponse.redirect(`${baseUrl}/activar/${restaurant.slug}/exito?plan=${appPlan}`);
}
