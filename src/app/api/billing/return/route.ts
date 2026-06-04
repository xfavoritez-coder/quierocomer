import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { flowPost } from "@/lib/billing/flow";
import { planFromFlowId, FLOW_PLANS, PLAN_LABELS, grossOf, type PlanKey } from "@/lib/billing/plans-config";
import { sendAdminEmail, planActivatedEmailHtml } from "@/lib/email/sendAdminEmail";

/**
 * GET /api/billing/return?token=...&plan=...
 *
 * Flow redirige aquí después del pago. Verificamos el estado y activamos.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const token = params.get("token");
  const planParam = params.get("plan");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://${req.headers.get("host")}`;

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/panel/suscripcion?status=error`);
  }

  // Verificar estado del pago en Flow
  let payment: { status: number; commerceOrder: string; amount: number };
  try {
    payment = await flowPost<any>("/payment/getStatus", { token });
  } catch (err: any) {
    console.error("[billing/return] getStatus falló:", err?.message);
    return NextResponse.redirect(`${baseUrl}/panel/suscripcion?status=error`);
  }

  // Flow status: 1 = pendiente, 2 = pagada, 3 = rechazada, 4 = anulada
  if (payment.status !== 2) {
    return NextResponse.redirect(`${baseUrl}/panel/suscripcion?status=failure`);
  }

  // Buscar restaurant por token
  const restaurant = await prisma.restaurant.findFirst({
    where: { flowRegisterToken: token },
    include: { owner: { select: { email: true, name: true } } },
  });

  if (!restaurant) {
    return NextResponse.redirect(`${baseUrl}/panel/suscripcion?status=error`);
  }

  const appPlan = ((restaurant.pendingFlowPlanId ? planFromFlowId(restaurant.pendingFlowPlanId) : planParam) || restaurant.plan) as "SILVER" | "GOLD" | "PREMIUM";
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

  return NextResponse.redirect(`${baseUrl}/panel/suscripcion/exito?plan=${appPlan}`);
}
