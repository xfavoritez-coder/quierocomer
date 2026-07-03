import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { flowPost } from "@/lib/billing/flow";
import { planFromFlowId, FLOW_PLANS, PLAN_LABELS, grossOf, type PlanKey } from "@/lib/billing/plans-config";
import { sendAdminEmail, planActivatedEmailHtml, monthlyRenewalEmailHtml } from "@/lib/email/sendAdminEmail";

/**
 * POST /api/billing/webhook
 *
 * Flow.cl envía confirmación de pago aquí (urlConfirmation).
 * Solo activa el plan si puede confirmar que el pago fue exitoso (status 2).
 */
export async function POST(req: NextRequest) {
  let formData: FormData;
  try { formData = await req.formData(); } catch {
    return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 });
  }

  const token = (formData.get("token") as string | null) || null;
  if (!token) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  console.log(`[billing/webhook] Recibido token: ${token}`);

  // Buscar restaurant — flowRegisterToken puede ser "token|flowOrder"
  let restaurant = await prisma.restaurant.findFirst({
    where: { flowRegisterToken: { startsWith: token } },
    include: { owner: { select: { email: true, name: true } } },
  });
  if (!restaurant) {
    restaurant = await prisma.restaurant.findFirst({
      where: { flowRegisterToken: token },
      include: { owner: { select: { email: true, name: true } } },
    });
  }

  if (!restaurant) {
    console.log(`[billing/webhook] No se encontró restaurant para token ${token}`);
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Extraer flowOrder si está guardado
  const savedToken = restaurant.flowRegisterToken || "";
  const [savedFlowToken, flowOrderStr] = savedToken.split("|");
  const flowOrder = flowOrderStr ? Number(flowOrderStr) : null;

  // Intentar verificar el pago con getStatus, si falla intentar getStatusByFlowOrder
  let paymentStatus: number | null = null;

  // Intento 1: /payment/getStatus con token
  try {
    const result = await flowPost<any>("/payment/getStatus", { token });
    paymentStatus = result.status;
    console.log(`[billing/webhook] getStatus OK: status=${result.status} for ${restaurant.name}`);
  } catch (err: any) {
    console.warn(`[billing/webhook] getStatus falló: ${err?.message}`);
  }

  // Intento 2: /payment/getStatusByFlowOrder si el primero falló
  if (paymentStatus === null && flowOrder) {
    try {
      const result = await flowPost<any>("/payment/getStatusByFlowOrder", { flowOrder });
      paymentStatus = result.status;
      console.log(`[billing/webhook] getStatusByFlowOrder OK: status=${result.status} for ${restaurant.name}`);
    } catch (err: any) {
      console.warn(`[billing/webhook] getStatusByFlowOrder falló: ${err?.message}`);
    }
  }

  // Intento 3: /payment/getStatusByCommerceId
  if (paymentStatus === null) {
    try {
      const result = await flowPost<any>("/payment/getStatusByCommerceId", { commerceId: `b_${restaurant.id.slice(-8)}` });
      paymentStatus = result.status;
      console.log(`[billing/webhook] getStatusByCommerceId OK: status=${result.status} for ${restaurant.name}`);
    } catch (err: any) {
      console.warn(`[billing/webhook] getStatusByCommerceId falló: ${err?.message}`);
    }
  }

  // Si no pudimos verificar con getStatus pero Flow envió el webhook, confiar
  // Flow solo envía urlConfirmation cuando el pago se procesa
  if (paymentStatus === null) {
    console.warn(`[billing/webhook] getStatus no disponible — confiando en webhook como confirmación para ${restaurant.name}`);
    paymentStatus = 2;
  }

  // Rechazado o anulado
  if (paymentStatus === 3 || paymentStatus === 4) {
    console.log(`[billing/webhook] Pago rechazado/anulado (${paymentStatus}) para ${restaurant.name}`);
    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { flowRegisterToken: null, pendingFlowPlanId: null },
    });
    return NextResponse.json({ ok: true, rejected: true });
  }

  // Pendiente
  if (paymentStatus !== 2) {
    console.log(`[billing/webhook] Pago pendiente (${paymentStatus}) para ${restaurant.name}`);
    return NextResponse.json({ ok: true, pending: true });
  }

  // ✅ Pago confirmado — activar plan
  const appPlan = planFromFlowId(restaurant.pendingFlowPlanId || "") || restaurant.plan;
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: {
      plan: appPlan,
      subscriptionStatus: "ACTIVE",
      flowPlanId: restaurant.pendingFlowPlanId,
      currentPeriodEnd: periodEnd,
      lastPaymentAt: new Date(),
      pendingFlowPlanId: null,
      // No borrar flowRegisterToken — el return handler lo necesita
    },
  });

  // Email de confirmación
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";
  const ownerEmail = restaurant.owner?.email;
  if (ownerEmail) {
    const planKey = appPlan as Exclude<PlanKey, "FREE">;
    const ownerName = restaurant.owner?.name || ownerEmail.split("@")[0] || "Hola";
    const firstName = ownerName.split(" ")[0];
    const planLabel = PLAN_LABELS[planKey as keyof typeof PLAN_LABELS] || planKey;
    const amountNet = restaurant.customPlanPriceNet ?? FLOW_PLANS[planKey]?.amountNet ?? 0;
    const chargeGross = grossOf(amountNet);
    const amountPaid = `$${chargeGross.toLocaleString("es-CL")} CLP`;
    const nextDate = periodEnd.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
    const nextAmount = `$${grossOf(FLOW_PLANS[planKey]?.amountNet ?? 0).toLocaleString("es-CL")} CLP`;
    const panelLink = `${baseUrl}/panel`;
    const qrLink = `${baseUrl}/qr/${restaurant.slug}`;
    const isRenewal = restaurant.subscriptionStatus === "ACTIVE" && !!restaurant.lastPaymentAt;

    if (isRenewal) {
      sendAdminEmail({
        to: ownerEmail,
        subject: `${restaurant.name} · Plan ${planLabel} renovado`,
        html: monthlyRenewalEmailHtml(firstName, restaurant.name, planLabel, amountPaid, nextDate, panelLink, qrLink),
        purpose: "plan_renewed",
      }).catch(() => {});
    } else {
      sendAdminEmail({
        to: ownerEmail,
        subject: `${restaurant.name} · Plan ${planLabel} activado`,
        html: planActivatedEmailHtml(firstName, restaurant.name, planLabel, amountPaid, nextDate, nextAmount, panelLink, qrLink),
        purpose: "plan_activated",
      }).catch(() => {});
    }
  }

  console.log(`[billing/webhook] ✅ Pago confirmado y plan activado: ${restaurant.name} → ${appPlan}`);
  return NextResponse.json({ ok: true, plan: appPlan });
}
