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
 * Flow redirige aquí después del pago.
 * - Si el webhook ya activó el plan → redirige a éxito
 * - Si el pago fue confirmado por getStatus → activa y redirige a éxito
 * - Si no se puede confirmar → redirige a pendiente (el webhook activará después)
 */
async function handleReturn(req: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";

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

  // Buscar restaurant por token
  const restaurant = await prisma.restaurant.findFirst({
    where: { flowRegisterToken: token },
    include: { owner: { select: { email: true, name: true } } },
  });

  if (!restaurant) {
    return redirect303(`${baseUrl}/panel/suscripcion?status=error&reason=${encodeURIComponent("No se encontró el restaurante asociado al pago")}`);
  }

  // Si el webhook ya activó el plan, solo redirigir a éxito
  if (restaurant.subscriptionStatus === "ACTIVE" && restaurant.lastPaymentAt && !restaurant.pendingFlowPlanId) {
    await prisma.restaurant.update({ where: { id: restaurant.id }, data: { flowRegisterToken: null } });
    return redirect303(`${baseUrl}/panel/suscripcion/exito?plan=${restaurant.plan}`);
  }

  // Verificar estado del pago en Flow
  try {
    const payment = await flowPost<any>("/payment/getStatus", { token });
    console.log(`[billing/return] Flow status: ${payment.status} for ${restaurant.name}`);

    if (payment.status === 2) {
      // Pago confirmado — activar
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

    if (payment.status === 3 || payment.status === 4) {
      // Rechazado o anulado
      const labels: Record<number, string> = { 3: "rechazado", 4: "anulado" };
      await prisma.restaurant.update({ where: { id: restaurant.id }, data: { flowRegisterToken: null, pendingFlowPlanId: null } });
      return redirect303(`${baseUrl}/panel/suscripcion?status=failure&reason=${encodeURIComponent(`Pago ${labels[payment.status]} por Webpay`)}`);
    }

    // Status 1 (pendiente) — redirigir a suscripción con mensaje
    return redirect303(`${baseUrl}/panel/suscripcion?status=pending&reason=${encodeURIComponent("Tu pago está siendo procesado. Se activará en unos minutos.")}`);
  } catch (err: any) {
    console.warn("[billing/return] getStatus falló:", err?.message);
    // No pudimos verificar — redirigir con mensaje de espera
    return redirect303(`${baseUrl}/panel/suscripcion?status=pending&reason=${encodeURIComponent("Tu pago está siendo procesado. Se activará en unos minutos.")}`);
  }
}

export async function GET(req: NextRequest) { return handleReturn(req); }
export async function POST(req: NextRequest) { return handleReturn(req); }
