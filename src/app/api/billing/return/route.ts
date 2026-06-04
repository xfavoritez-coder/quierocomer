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

  // Verificar estado del pago en Flow
  let payment: { status: number; commerceOrder: string; amount: number };
  try {
    payment = await flowPost<any>("/payment/getStatus", { token });
  } catch (err: any) {
    console.error("[billing/return] getStatus falló:", err?.message);
    return redirect303(`${baseUrl}/panel/suscripcion?status=error`);
  }

  // Flow status: 1 = pendiente, 2 = pagada, 3 = rechazada, 4 = anulada
  // Aceptamos pendiente (1) y pagada (2) — el webhook confirma después
  if (payment.status !== 2 && payment.status !== 1) {
    return redirect303(`${baseUrl}/panel/suscripcion?status=failure`);
  }

  // Buscar restaurant por token
  const restaurant = await prisma.restaurant.findFirst({
    where: { flowRegisterToken: token },
    include: { owner: { select: { email: true, name: true } } },
  });

  if (!restaurant) {
    return redirect303(`${baseUrl}/panel/suscripcion?status=error`);
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
