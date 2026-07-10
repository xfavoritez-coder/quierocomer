import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { flowPost } from "@/lib/billing/flow";
import { planFromFlowId, FLOW_PLANS, PLAN_LABELS, grossOf, type PlanKey } from "@/lib/billing/plans-config";
import { sendAdminEmail, planActivatedEmailHtml, monthlyRenewalEmailHtml } from "@/lib/email/sendAdminEmail";

function redirect303(url: string) {
  return NextResponse.redirect(url, 303);
}

/**
 * GET|POST /api/billing/return
 *
 * Flow redirige aquí después del pago.
 */
async function handleReturn(req: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.com";

  let token = req.nextUrl.searchParams.get("token");
  if (!token && req.method === "POST") {
    try {
      const form = await req.formData();
      token = (form.get("token") as string) || null;
    } catch {}
  }

  if (!token) {
    return redirect303(`${baseUrl}/panel/suscripcion?status=error&reason=${encodeURIComponent("No se recibió token de pago")}`);
  }

  console.log(`[billing/return] Token recibido: ${token}`);

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
    return redirect303(`${baseUrl}/panel/suscripcion?status=error&reason=${encodeURIComponent("No se encontró el restaurante asociado al pago")}`);
  }

  // Si el webhook ya activó el plan, redirigir a éxito
  if (restaurant.subscriptionStatus === "ACTIVE" && restaurant.lastPaymentAt && !restaurant.pendingFlowPlanId) {
    await prisma.restaurant.update({ where: { id: restaurant.id }, data: { flowRegisterToken: null } });
    return redirect303(`${baseUrl}/panel/suscripcion/exito?plan=${restaurant.plan}`);
  }

  // Extraer flowOrder
  const savedToken = restaurant.flowRegisterToken || "";
  const [, flowOrderStr] = savedToken.split("|");
  const flowOrder = flowOrderStr ? Number(flowOrderStr) : null;

  // Verificar pago con múltiples intentos
  let paymentStatus: number | null = null;

  try {
    const result = await flowPost<any>("/payment/getStatus", { token });
    paymentStatus = result.status;
    console.log(`[billing/return] getStatus: ${result.status}`);
  } catch (err: any) {
    console.warn(`[billing/return] getStatus falló: ${err?.message}`);
  }

  if (paymentStatus === null && flowOrder) {
    try {
      const result = await flowPost<any>("/payment/getStatusByFlowOrder", { flowOrder });
      paymentStatus = result.status;
      console.log(`[billing/return] getStatusByFlowOrder: ${result.status}`);
    } catch (err: any) {
      console.warn(`[billing/return] getStatusByFlowOrder falló: ${err?.message}`);
    }
  }

  // Pago confirmado (status 2)
  if (paymentStatus === 2) {
    const appPlan = (planFromFlowId(restaurant.pendingFlowPlanId || "") || restaurant.plan) as "SILVER" | "GOLD" | "PREMIUM";
    // Early renewal: si el plan está activo y el período aún no vence, extender desde currentPeriodEnd
    const existingEnd = restaurant.currentPeriodEnd ? new Date(restaurant.currentPeriodEnd) : null;
    const isEarlyRenewal = restaurant.subscriptionStatus === "ACTIVE" && !!existingEnd && existingEnd > new Date();
    const baseDate = isEarlyRenewal ? existingEnd! : new Date();
    const periodEnd = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    const amountNet = restaurant.customPlanPriceNet ?? FLOW_PLANS[appPlan as Exclude<PlanKey, "FREE">]?.amountNet ?? 0;

    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: {
        plan: appPlan,
        subscriptionStatus: "ACTIVE",
        flowPlanId: restaurant.pendingFlowPlanId,
        currentPeriodEnd: periodEnd,
        lastPaymentAt: new Date(),
        pendingFlowPlanId: null,
        flowRegisterToken: null,
      },
    });

    // Email de confirmación
    const ownerEmail = restaurant.owner?.email;
    if (ownerEmail) {
      const ownerName = restaurant.owner?.name || ownerEmail.split("@")[0] || "Hola";
      const firstName = ownerName.split(" ")[0];
      const planLabel = PLAN_LABELS[appPlan as keyof typeof PLAN_LABELS] || appPlan;
      const chargeGross = grossOf(amountNet);
      const amountPaid = `$${chargeGross.toLocaleString("es-CL")} CLP`;
      const nextDate = periodEnd.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
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
        const nextAmount = `$${chargeGross.toLocaleString("es-CL")} CLP`;
        sendAdminEmail({
          to: ownerEmail,
          subject: `${restaurant.name} · Plan ${planLabel} activado`,
          html: planActivatedEmailHtml(firstName, restaurant.name, planLabel, amountPaid, nextDate, nextAmount, panelLink, qrLink),
          purpose: "plan_activated",
        }).catch(() => {});
      }
    }

    return redirect303(`${baseUrl}/panel/suscripcion/exito?plan=${appPlan}`);
  }

  // Rechazado o anulado
  if (paymentStatus === 3 || paymentStatus === 4) {
    const labels: Record<number, string> = { 3: "rechazado", 4: "anulado" };
    await prisma.restaurant.update({ where: { id: restaurant.id }, data: { flowRegisterToken: null, pendingFlowPlanId: null } });
    return redirect303(`${baseUrl}/panel/suscripcion?status=failure&reason=${encodeURIComponent(`Pago ${labels[paymentStatus]} por Webpay`)}`);
  }

  // No se pudo verificar o pendiente
  const msg = paymentStatus === null
    ? "No se pudo verificar el pago. Si pagaste, se activará en unos minutos."
    : "Tu pago está siendo procesado. Se activará en unos minutos.";
  return redirect303(`${baseUrl}/panel/suscripcion?status=pending&reason=${encodeURIComponent(msg)}`);
}

export async function GET(req: NextRequest) { return handleReturn(req); }
export async function POST(req: NextRequest) { return handleReturn(req); }
