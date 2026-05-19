import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Payment } from "mercadopago";
import {
  initMercadoPago,
  createMPSubscription,
  createMPPlan,
} from "@/lib/billing/mercadopago";
import { FLOW_PLANS, planFromFlowId, grossOf, activationPromoAmount, PLAN_LABELS } from "@/lib/billing/plans-config";
import { sendAdminEmail, planActivatedEmailHtml, adminNewActivationEmailHtml } from "@/lib/email/sendAdminEmail";

/**
 * GET /api/activar/pay/return?collection_id=...&collection_status=...&payment_id=...&status=...&external_reference=...&payment_type=...&merchant_order_id=...&preference_id=...
 *
 * MercadoPago redirige aqui despues de que el usuario completo el pago.
 *
 * Flujo:
 * 1. Verifica el pago via la API de Payment de MP
 * 2. Si fue aprobado: activa el restaurant, crea suscripcion recurrente
 * 3. Envia emails de notificacion
 * 4. Redirige a pagina de exito
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://${req.headers.get("host")}`;

  const paymentId = params.get("payment_id") || params.get("collection_id");
  const status = params.get("status") || params.get("collection_status");
  const externalReference = params.get("external_reference");

  // Si no hay parametros de pago, puede ser un return de suscripcion directa
  // (sin promo). En ese caso MP envia preapproval_id.
  const preapprovalId = params.get("preapproval_id");

  // ── Flujo de suscripcion directa (sin promo, ej: GOLD) ──
  if (preapprovalId && !paymentId) {
    return handleSubscriptionReturn(preapprovalId, externalReference, baseUrl);
  }

  // ── Flujo de pago unico promo (ej: PREMIUM primer mes) ──
  if (!paymentId || !externalReference) {
    return NextResponse.redirect(`${baseUrl}/pago-cancelado`);
  }

  // Buscar restaurant por external_reference (= restaurantId)
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: externalReference },
    include: { owner: { select: { email: true, name: true } } },
  });

  if (!restaurant || !restaurant.pendingMpPlanId) {
    return NextResponse.redirect(`${baseUrl}/pago-cancelado`);
  }

  // Idempotencia: si ya no es demo, ya fue activado
  if (!restaurant.isDemo) {
    return NextResponse.redirect(`${baseUrl}/activar/${restaurant.slug}/exito?plan=${restaurant.plan}`);
  }

  // Verificar estado del pago con la API de MP
  let paymentApproved = false;
  if (status === "approved") {
    // Doble verificacion via API
    try {
      const config = initMercadoPago();
      const paymentClient = new Payment(config);
      const paymentData = await paymentClient.get({ id: Number(paymentId) });
      paymentApproved = paymentData.status === "approved";
    } catch (err: any) {
      console.error("[activar/pay/return] Error verificando pago:", err?.message);
      // Si la verificacion falla pero el status del redirect dice approved,
      // confiamos en el status del redirect (MP ya valido del lado de ellos)
      paymentApproved = true;
    }
  }

  if (!paymentApproved) {
    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { pendingMpPlanId: null },
    });
    const reason = status === "pending" ? "payment_pending" : "payment_rejected";
    return NextResponse.redirect(`${baseUrl}/activar/${restaurant.slug}?pago=error&reason=${reason}`);
  }

  const appPlan = planFromFlowId(restaurant.pendingMpPlanId) || "PREMIUM";
  const planKey = appPlan as "GOLD" | "PREMIUM";

  // Determinar monto cobrado (para el email)
  const promoNet = activationPromoAmount(planKey);
  const chargeNet = promoNet ?? FLOW_PLANS[planKey].amountNet;
  const chargeGross = grossOf(chargeNet);

  // Crear suscripcion recurrente que empieza en 30 dias
  // (el primer mes ya se pago con la preference)
  const subscriptionStart = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  let subscriptionId = "";
  try {
    const mpPlan = await createMPPlan(planKey);
    const ownerEmail = restaurant.owner?.email || "";

    const subscription = await createMPSubscription({
      planId: mpPlan.id,
      payerEmail: ownerEmail,
      externalReference: restaurant.id,
    });
    subscriptionId = subscription.id;
  } catch (err: any) {
    console.error("[activar/pay/return] createMPSubscription falló:", err?.message);
    // El cobro promo ya se hizo. Activamos igual y logueamos el error.
    // Un admin puede crear la suscripcion manualmente.
  }

  // Activar restaurant: quitar demo, limpiar fotos, resetear stats
  await prisma.$transaction([
    prisma.restaurant.update({
      where: { id: restaurant.id },
      data: {
        isDemo: false,
        plan: appPlan,
        subscriptionStatus: "ACTIVE",
        mpSubscriptionId: subscriptionId || null,
        flowPlanId: restaurant.pendingMpPlanId,
        currentPeriodEnd: subscriptionStart,
        lastPaymentAt: new Date(),
        pendingMpPlanId: null,
        weeklyEmailEnabled: true,
      },
    }),
    // Limpiar fotos Unsplash referenciales
    prisma.dish.updateMany({
      where: { restaurantId: restaurant.id, isPhotoReferential: true },
      data: { photos: [], isPhotoReferential: false, photoCredits: [] },
    }),
    // Borrar sessions demo (cascade borra DishImpressions)
    prisma.session.deleteMany({ where: { restaurantId: restaurant.id } }),
  ]);

  // Fire-and-forget: emails de notificacion
  sendActivationEmails(restaurant, appPlan, planKey, chargeGross, subscriptionStart, baseUrl);

  // Fire-and-forget: traduccion completa solo para Premium
  if (appPlan === "PREMIUM") {
    import("@/lib/ai/translateContent").then(({ translateAllForRestaurant }) => {
      translateAllForRestaurant(restaurant.id)
        .then(() => prisma.restaurant.update({ where: { id: restaurant.id }, data: { needsTranslation: false } }))
        .then(() => console.log(`[activar/pay] Traducción completa para ${restaurant.id}`))
        .catch((err) => console.error(`[activar/pay] Traducción falló para ${restaurant.id}:`, err));
    });
  }

  return NextResponse.redirect(`${baseUrl}/activar/${restaurant.slug}/exito?plan=${appPlan}`);
}

/**
 * Maneja el return de una suscripcion directa (sin promo).
 * MP redirige con preapproval_id cuando el usuario completa el checkout de suscripcion.
 */
async function handleSubscriptionReturn(
  preapprovalId: string,
  externalReference: string | null,
  baseUrl: string,
) {
  // Buscar restaurant por external_reference o por preapproval pendiente
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

  // Idempotencia
  if (!restaurant.isDemo) {
    return NextResponse.redirect(`${baseUrl}/activar/${restaurant.slug}/exito?plan=${restaurant.plan}`);
  }

  const appPlan = planFromFlowId(restaurant.pendingMpPlanId) || "GOLD";
  const planKey = appPlan as "GOLD" | "PREMIUM";
  const chargeGross = grossOf(FLOW_PLANS[planKey].amountNet);
  const subscriptionStart = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // Activar restaurant
  await prisma.$transaction([
    prisma.restaurant.update({
      where: { id: restaurant.id },
      data: {
        isDemo: false,
        plan: appPlan,
        subscriptionStatus: "ACTIVE",
        mpSubscriptionId: preapprovalId,
        flowPlanId: restaurant.pendingMpPlanId,
        currentPeriodEnd: subscriptionStart,
        lastPaymentAt: new Date(),
        pendingMpPlanId: null,
        weeklyEmailEnabled: true,
      },
    }),
    prisma.dish.updateMany({
      where: { restaurantId: restaurant.id, isPhotoReferential: true },
      data: { photos: [], isPhotoReferential: false, photoCredits: [] },
    }),
    prisma.session.deleteMany({ where: { restaurantId: restaurant.id } }),
  ]);

  sendActivationEmails(restaurant, appPlan, planKey, chargeGross, subscriptionStart, baseUrl);

  if (appPlan === "PREMIUM") {
    import("@/lib/ai/translateContent").then(({ translateAllForRestaurant }) => {
      translateAllForRestaurant(restaurant.id)
        .then(() => prisma.restaurant.update({ where: { id: restaurant.id }, data: { needsTranslation: false } }))
        .then(() => console.log(`[activar/pay] Traducción completa para ${restaurant.id}`))
        .catch((err) => console.error(`[activar/pay] Traducción falló para ${restaurant.id}:`, err));
    });
  }

  return NextResponse.redirect(`${baseUrl}/activar/${restaurant.slug}/exito?plan=${appPlan}`);
}

/**
 * Envia emails de activacion (al dueno y al admin). Fire-and-forget.
 */
function sendActivationEmails(
  restaurant: { id: string; name: string; slug: string | null; owner: { email: string; name: string | null } | null },
  appPlan: string,
  planKey: "GOLD" | "PREMIUM",
  chargeGross: number,
  subscriptionStart: Date,
  baseUrl: string,
) {
  const planLabel = PLAN_LABELS[appPlan as keyof typeof PLAN_LABELS] || appPlan;
  const amountPaid = `$${chargeGross.toLocaleString("es-CL")} CLP`;
  const nextDate = subscriptionStart.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
  const regularGross = grossOf(FLOW_PLANS[planKey].amountNet);
  const nextAmount = `$${regularGross.toLocaleString("es-CL")} CLP`;
  const ownerEmail = restaurant.owner?.email;
  const ownerName = restaurant.owner?.name || restaurant.owner?.email?.split("@")[0] || "Hola";
  const panelLink = `${baseUrl}/api/panel/demo-auth?slug=${restaurant.slug}`;
  const qrLink = `${baseUrl}/qr/${restaurant.slug}`;

  if (ownerEmail) {
    sendAdminEmail({
      to: ownerEmail,
      subject: `${restaurant.name} · Plan ${planLabel} activado`,
      html: planActivatedEmailHtml(ownerName, restaurant.name, planLabel, amountPaid, nextDate, nextAmount, panelLink, qrLink),
      purpose: "plan_activated",
    }).catch((err) => console.error("[activar/pay] Email al dueño falló:", err));
  }

  sendAdminEmail({
    to: "favoritez@gmail.com",
    subject: `Nuevo cliente: ${restaurant.name} activó ${planLabel}`,
    html: adminNewActivationEmailHtml(restaurant.name, planLabel, amountPaid, ownerEmail || "sin email", restaurant.slug || ""),
    purpose: "admin_new_activation",
  }).catch((err) => console.error("[activar/pay] Email admin falló:", err));
}
