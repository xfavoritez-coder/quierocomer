import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMPPayment, getMPSubscription } from "@/lib/billing/mercadopago";
import { planFromFlowId, FLOW_PLANS, PLAN_LABELS, grossOf, type PlanKey } from "@/lib/billing/plans-config";
import { sendAdminEmail, planActivatedEmailHtml } from "@/lib/email/sendAdminEmail";

/**
 * GET /api/billing/return?plan=...&status=approved&payment_id=...
 *
 * MercadoPago redirige aquí después de un pago exitoso (Checkout Pro).
 * También soporta el flujo legacy de suscripciones (preapproval_id).
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const planParam = params.get("plan");
  const mpStatus = params.get("status");
  const paymentId = params.get("payment_id");
  const preapprovalId = params.get("preapproval_id");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://${req.headers.get("host")}`;

  // ── Checkout Pro flow (payment_id) ──
  if (paymentId) {
    if (mpStatus !== "approved") {
      return NextResponse.redirect(`${baseUrl}/panel/suscripcion?status=${mpStatus || "failure"}`);
    }

    // El webhook se encarga del update completo. Aquí hacemos un update
    // optimista para que el usuario vea el plan activo de inmediato.
    let restaurantId: string | null = null;
    try {
      const payment = await getMPPayment(paymentId);
      restaurantId = payment.externalReference;
    } catch (err: any) {
      console.warn("[billing/return] getMPPayment falló:", err?.message);
    }

    if (restaurantId) {
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        include: { owner: { select: { email: true, name: true } } },
      });

      if (restaurant) {
        const appPlan = ((restaurant.pendingMpPlanId ? planFromFlowId(restaurant.pendingMpPlanId) : planParam) || restaurant.plan) as "SILVER" | "GOLD" | "PREMIUM";
        const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const amountNet = restaurant.customPlanPriceNet ?? FLOW_PLANS[appPlan]?.amountNet ?? 0;

        await prisma.restaurant.update({
          where: { id: restaurant.id },
          data: {
            plan: appPlan,
            subscriptionStatus: "ACTIVE",
            mpPlanId: restaurant.pendingMpPlanId,
            currentPeriodEnd: periodEnd,
            lastPaymentAt: new Date(),
            pendingMpPlanId: null,
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
      }
    }

    return NextResponse.redirect(`${baseUrl}/panel/suscripcion/exito?plan=${planParam || "PREMIUM"}`);
  }

  // ── Legacy: subscription flow (preapproval_id) ──
  if (preapprovalId) {
    let mpSub;
    try {
      mpSub = await getMPSubscription(preapprovalId);
    } catch (err: any) {
      console.error("[billing/return] getMPSubscription falló:", err?.message);
      return NextResponse.redirect(`${baseUrl}/panel?billing=error&reason=subscription_verify_failed`);
    }

    if (!["authorized", "pending"].includes(mpSub.status)) {
      return NextResponse.redirect(`${baseUrl}/panel?billing=error&reason=subscription_not_authorized`);
    }

    const restaurantId = mpSub.externalReference;
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: { owner: { select: { email: true, name: true } } },
    });

    if (!restaurant) {
      return NextResponse.redirect(`${baseUrl}/panel?billing=error&reason=restaurant_not_found`);
    }

    const appPlan = ((restaurant.pendingMpPlanId ? planFromFlowId(restaurant.pendingMpPlanId) : planParam) || restaurant.plan) as "SILVER" | "GOLD" | "PREMIUM";
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: {
        plan: appPlan,
        subscriptionStatus: "ACTIVE",
        mpPlanId: restaurant.pendingMpPlanId,
        mpSubscriptionId: preapprovalId,
        currentPeriodEnd: periodEnd,
        lastPaymentAt: new Date(),
        pendingMpPlanId: null,
      },
    });

    const ownerEmail = restaurant.owner?.email;
    if (ownerEmail) {
      const ownerName = restaurant.owner?.name || ownerEmail.split("@")[0] || "Hola";
      const planKey = appPlan as Exclude<PlanKey, "FREE">;
      const planLabel = PLAN_LABELS[appPlan as keyof typeof PLAN_LABELS] || appPlan;
      const chargeGross = grossOf(FLOW_PLANS[planKey]?.amountNet ?? 0);
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

  return NextResponse.redirect(`${baseUrl}/panel/suscripcion?status=error`);
}
