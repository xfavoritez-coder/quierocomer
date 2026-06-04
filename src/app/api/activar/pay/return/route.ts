import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { flowPost } from "@/lib/billing/flow";
import { FLOW_PLANS, planFromFlowId, grossOf, PLAN_LABELS, type PlanKey } from "@/lib/billing/plans-config";
import { sendAdminEmail, planActivatedEmailHtml, adminNewActivationEmailHtml } from "@/lib/email/sendAdminEmail";

/**
 * GET /api/activar/pay/return?token=...&plan=...
 *
 * Flow redirige aquí después del pago para activación desde demo.
 */
async function handleReturn(req: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://${req.headers.get("host")}`;

  let token = req.nextUrl.searchParams.get("token");
  if (!token && req.method === "POST") {
    try {
      const form = await req.formData();
      token = (form.get("token") as string) || null;
    } catch {}
  }

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/pago-cancelado`);
  }

  // Verificar estado del pago
  let payment: { status: number };
  try {
    payment = await flowPost<any>("/payment/getStatus", { token });
  } catch (err: any) {
    console.error("[activar/pay/return] getStatus falló:", err?.message);
    return NextResponse.redirect(`${baseUrl}/pago-cancelado`);
  }

  if (payment.status !== 2) {
    return NextResponse.redirect(`${baseUrl}/pago-cancelado`);
  }

  // Buscar restaurant por token
  const restaurant = await prisma.restaurant.findFirst({
    where: { flowRegisterToken: token },
    include: { owner: { select: { email: true, name: true } } },
  });

  if (!restaurant) {
    return NextResponse.redirect(`${baseUrl}/pago-cancelado`);
  }

  // Idempotencia
  if (!restaurant.isDemo) {
    return NextResponse.redirect(`${baseUrl}/activar/${restaurant.slug}/exito?plan=${restaurant.plan}`);
  }

  const appPlan = (planFromFlowId(restaurant.pendingFlowPlanId || "") || "PREMIUM") as "SILVER" | "GOLD" | "PREMIUM";
  const planKey = appPlan as Exclude<PlanKey, "FREE">;
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const amountNet = restaurant.customPlanPriceNet ?? FLOW_PLANS[planKey].amountNet;

  // Activar restaurant
  await prisma.$transaction([
    prisma.restaurant.update({
      where: { id: restaurant.id },
      data: {
        isDemo: false, plan: appPlan, subscriptionStatus: "ACTIVE",
        flowPlanId: restaurant.pendingFlowPlanId,
        currentPeriodEnd: periodEnd, lastPaymentAt: new Date(),
        pendingFlowPlanId: null, flowRegisterToken: null,
        weeklyEmailEnabled: true,
      },
    }),
    prisma.dish.updateMany({ where: { restaurantId: restaurant.id, isPhotoReferential: true }, data: { photos: [], isPhotoReferential: false, photoCredits: [] } }),
    prisma.session.deleteMany({ where: { restaurantId: restaurant.id } }),
  ]);

  // Emails
  const planLabel = PLAN_LABELS[appPlan as keyof typeof PLAN_LABELS] || appPlan;
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

  // Traducción para Gold y Premium
  if (appPlan === "GOLD" || appPlan === "PREMIUM") {
    import("@/lib/ai/translateContent").then(({ translateAllForRestaurant }) => {
      translateAllForRestaurant(restaurant.id)
        .then(() => prisma.restaurant.update({ where: { id: restaurant.id }, data: { needsTranslation: false } }))
        .catch(() => {});
    });
  }

  return NextResponse.redirect(`${baseUrl}/activar/${restaurant.slug}/exito?plan=${appPlan}`);
}

export async function GET(req: NextRequest) { return handleReturn(req); }
export async function POST(req: NextRequest) { return handleReturn(req); }
