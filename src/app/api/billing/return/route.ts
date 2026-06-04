import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { flowPost } from "@/lib/billing/flow";
import { planFromFlowId, FLOW_PLANS, PLAN_LABELS, grossOf, type PlanKey } from "@/lib/billing/plans-config";
import { sendAdminEmail, planActivatedEmailHtml } from "@/lib/email/sendAdminEmail";

function redirect303(url: string) {
  return NextResponse.redirect(url, 303);
}

/**
 * GET|POST /api/billing/return
 *
 * Flow redirige aquí después del pago (POST con token en body).
 */
async function handleReturn(req: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";

  // Flow envía token vía POST form-data o GET query param
  let token = req.nextUrl.searchParams.get("token");
  if (!token && req.method === "POST") {
    try {
      const form = await req.formData();
      token = (form.get("token") as string) || null;
    } catch {}
  }

  if (!token) {
    return redirect303(`${baseUrl}/panel/suscripcion?status=error`);
  }

  // Buscar restaurant por token primero
  const restaurant = await prisma.restaurant.findFirst({
    where: { flowRegisterToken: token },
    include: { owner: { select: { email: true, name: true } } },
  });

  if (!restaurant) {
    console.error("[billing/return] No se encontró restaurant para token:", token);
    return redirect303(`${baseUrl}/panel/suscripcion?status=error&reason=${encodeURIComponent("No se encontró el restaurante asociado al pago")}`);
  }

  // Verificar estado del pago en Flow
  const FLOW_STATUS: Record<number, string> = { 1: "pendiente", 2: "pagada", 3: "rechazada", 4: "anulada" };
  let paymentOk = true;
  try {
    const payment = await flowPost<any>("/payment/getStatus", { token });
    console.log(`[billing/return] Flow payment status: ${payment.status} (${FLOW_STATUS[payment.status] || "?"}) for ${restaurant.name}`);
    // Solo rechazar si Flow dice explícitamente rechazada (3) o anulada (4)
    if (payment.status === 3 || payment.status === 4) {
      paymentOk = false;
      const reason = FLOW_STATUS[payment.status];
      return redirect303(`${baseUrl}/panel/suscripcion?status=failure&reason=${encodeURIComponent(`Pago ${reason} por Webpay`)}`);
    }
  } catch (err: any) {
    // Si getStatus falla pero el usuario volvió del checkout, seguimos adelante
    // El webhook de Flow confirmará el pago después
    console.warn("[billing/return] getStatus falló (continuando):", err?.message);
  }

  const appPlan = (planFromFlowId(restaurant.pendingFlowPlanId || "") || restaurant.plan) as "SILVER" | "GOLD" | "PREMIUM";
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
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
    const planLabel = PLAN_LABELS[appPlan as keyof typeof PLAN_LABELS] || appPlan;
    const chargeGross = grossOf(amountNet);
    const amountPaid = `$${chargeGross.toLocaleString("es-CL")} CLP`;
    const nextDate = periodEnd.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
    const nextAmount = `$${chargeGross.toLocaleString("es-CL")} CLP`;

    sendAdminEmail({
      to: ownerEmail,
      subject: `${restaurant.name} · Plan ${planLabel} activado`,
      html: planActivatedEmailHtml(ownerName, restaurant.name, planLabel, amountPaid, nextDate, nextAmount, `${baseUrl}/panel`, `${baseUrl}/qr/${restaurant.slug}`),
      purpose: "plan_activated",
    }).catch(() => {});
  }

  return redirect303(`${baseUrl}/panel/suscripcion/exito?plan=${appPlan}`);
}

export async function GET(req: NextRequest) { return handleReturn(req); }
export async function POST(req: NextRequest) { return handleReturn(req); }
