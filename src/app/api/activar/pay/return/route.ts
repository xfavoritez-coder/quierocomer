import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { flowPost } from "@/lib/billing/flow";
import { FLOW_PLANS, planFromFlowId, grossOf, activationPromoAmount, PLAN_LABELS } from "@/lib/billing/plans-config";
import { sendAdminEmail, planActivatedEmailHtml, adminNewActivationEmailHtml } from "@/lib/email/sendAdminEmail";

/**
 * GET /api/activar/pay/return?token=...
 *
 * Flow redirige aquí después de que el dueño inscribió su tarjeta en Webpay.
 * 1. Verifica el registro de tarjeta
 * 2. Cobra el primer mes (promo o regular)
 * 3. Crea suscripción que empieza en 30 días
 * 4. Activa el restaurant (quita demo, limpia fotos, resetea stats)
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://${req.headers.get("host")}`;

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/activar?error=no_token`);
  }

  const restaurant = await prisma.restaurant.findFirst({
    where: { flowRegisterToken: token },
    include: { owner: { select: { email: true } } },
  });

  if (!restaurant || !restaurant.flowCustomerId || !restaurant.pendingFlowPlanId) {
    return NextResponse.redirect(`${baseUrl}/activar?error=not_found`);
  }

  // Idempotencia: si ya no es demo, ya fue activado. Redirigir a éxito.
  if (!restaurant.isDemo) {
    return NextResponse.redirect(`${baseUrl}/activar/${restaurant.slug}/exito?plan=${restaurant.plan}`);
  }

  // Verificar registro de tarjeta
  let registerOk = true;
  try {
    const status = await flowPost<{ status: number }>("/customer/getRegisterStatus", { token });
    registerOk = status.status === 1;
  } catch (err: any) {
    if (!err?.message?.includes("No services available")) registerOk = false;
  }

  if (!registerOk) {
    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { flowRegisterToken: null, pendingFlowPlanId: null },
    });
    return NextResponse.redirect(`${baseUrl}/activar/${restaurant.slug}?pago=error&reason=register_failed`);
  }

  const appPlan = planFromFlowId(restaurant.pendingFlowPlanId) || "PREMIUM";
  const planKey = appPlan as "GOLD" | "PREMIUM";

  // Determinar monto del primer cobro (promo o regular)
  const promoNet = activationPromoAmount(planKey);
  const chargeNet = promoNet ?? FLOW_PLANS[planKey].amountNet;
  const chargeGross = grossOf(chargeNet);

  // Cobro inmediato del primer mes
  try {
    await flowPost("/charge/create", {
      customerId: restaurant.flowCustomerId,
      planId: restaurant.pendingFlowPlanId,
      amount: chargeGross,
      commerceOrder: `activar_${restaurant.id}_${Date.now()}`,
    });
  } catch (err: any) {
    console.error("[activar/pay/return] charge/create falló:", err?.message);
    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { flowRegisterToken: null, pendingFlowPlanId: null },
    });
    return NextResponse.redirect(`${baseUrl}/activar/${restaurant.slug}?pago=error&reason=charge_failed`);
  }

  // Crear suscripción que empieza en 30 días (el primer cobro ya se hizo arriba)
  const subscriptionStart = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  let subscription: { subscriptionId: string; periodEnd?: string };
  try {
    subscription = await flowPost<{ subscriptionId: string; periodEnd?: string }>(
      "/subscription/create",
      {
        planId: restaurant.pendingFlowPlanId,
        customerId: restaurant.flowCustomerId,
        subscription_start: subscriptionStart.toISOString().slice(0, 10),
      },
    );
  } catch (err: any) {
    console.error("[activar/pay/return] subscription/create falló:", err?.message);
    // El cobro ya se hizo pero la suscripción falló. Activamos igual y logueamos el error.
    // Un admin puede crear la suscripción manualmente después.
    subscription = { subscriptionId: "" };
  }

  // Activar restaurant: quitar demo, limpiar fotos, resetear stats
  await prisma.$transaction([
    prisma.restaurant.update({
      where: { id: restaurant.id },
      data: {
        isDemo: false,
        plan: appPlan,
        subscriptionStatus: "ACTIVE",
        flowSubscriptionId: subscription.subscriptionId || null,
        flowPlanId: restaurant.pendingFlowPlanId,
        currentPeriodEnd: subscriptionStart,
        lastPaymentAt: new Date(),
        flowRegisterToken: null,
        pendingFlowPlanId: null,
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

  // Fire-and-forget: emails de notificación
  const planLabel = PLAN_LABELS[appPlan as keyof typeof PLAN_LABELS] || appPlan;
  const amountPaid = `$${chargeGross.toLocaleString("es-CL")} CLP`;
  const nextDate = subscriptionStart.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
  const regularGross = grossOf(FLOW_PLANS[planKey].amountNet);
  const nextAmount = `$${regularGross.toLocaleString("es-CL")} CLP`;
  const ownerEmail = restaurant.owner?.email;
  const ownerName = restaurant.owner?.email?.split("@")[0] || "Hola";
  const panelLink = `${baseUrl}/api/panel/demo-auth?slug=${restaurant.slug}`;
  const qrLink = `${baseUrl}/qr/${restaurant.slug}`;

  if (ownerEmail) {
    // Email al dueño
    sendAdminEmail({
      to: ownerEmail,
      subject: `${restaurant.name} · Plan ${planLabel} activado`,
      html: planActivatedEmailHtml(ownerName, restaurant.name, planLabel, amountPaid, nextDate, nextAmount, panelLink, qrLink),
      purpose: "plan_activated",
    }).catch((err) => console.error("[activar/pay] Email al dueño falló:", err));
  }

  // Email al admin
  sendAdminEmail({
    to: "favoritez@gmail.com",
    subject: `Nuevo cliente: ${restaurant.name} activó ${planLabel}`,
    html: adminNewActivationEmailHtml(restaurant.name, planLabel, amountPaid, ownerEmail || "sin email", restaurant.slug || ""),
    purpose: "admin_new_activation",
  }).catch((err) => console.error("[activar/pay] Email admin falló:", err));

  // Fire-and-forget: traducción completa solo para Premium
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
