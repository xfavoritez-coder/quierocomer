import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { flowPost } from "@/lib/billing/flow";
import { FLOW_PLANS, planFromFlowId, TRIAL_DAYS, GRACE_DAYS } from "@/lib/billing/plans-config";

/**
 * GET /api/billing/return?token=...
 *
 * Flow redirige aqui despues de que el comerciante inscribio la tarjeta.
 * Verifica el status del registro y si fue exitoso crea la suscripcion
 * con trial de 14 dias.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://${req.headers.get("host")}`;

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/panel?billing=error&reason=no_token`);
  }

  const restaurant = await prisma.restaurant.findFirst({ where: { flowRegisterToken: token } });
  if (!restaurant || !restaurant.flowCustomerId || !restaurant.pendingFlowPlanId) {
    return NextResponse.redirect(`${baseUrl}/panel?billing=error&reason=not_found`);
  }

  // Verificamos el registro si el endpoint esta disponible. Si Flow responde
  // "No services available" (algunos servicios estan recien activados o no
  // habilitan ese endpoint), seguimos adelante: el comerciante volvio del
  // callback de Webpay, asumimos que la tarjeta quedo inscrita. Si no quedo,
  // /subscription/create fallara y mostraremos error.
  let registerOk = true;
  try {
    const status = await flowPost<{ status: number }>("/customer/getRegisterStatus", { token });
    registerOk = status.status === 1;
  } catch (err: any) {
    if (!err?.message?.includes("No services available")) {
      registerOk = false;
    }
  }

  if (!registerOk) {
    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { flowRegisterToken: null, pendingFlowPlanId: null },
    });
    return NextResponse.redirect(`${baseUrl}/panel?billing=error&reason=register_failed`);
  }

  // Determinar si hay reactivacion dentro de gracia (7 dias) → ciclo anclado.
  // Si el restaurant tuvo una suscripcion previa que termino hace <= 7 dias,
  // arrancamos la nueva suscripcion en la fecha en que vencio la anterior
  // (sin trial). Asi el cliente paga por el periodo en que estuvo "en gracia"
  // y no acumula dias gratis. Fuera de los 7 dias, ciclo nuevo desde hoy.
  const previousEnd = restaurant.currentPeriodEnd;
  const now = new Date();
  const isReactivationInGrace =
    previousEnd && (now.getTime() - previousEnd.getTime()) <= GRACE_DAYS * 24 * 60 * 60 * 1000;

  const subscriptionParams: Record<string, string | number> = {
    planId: restaurant.pendingFlowPlanId,
    customerId: restaurant.flowCustomerId,
  };
  if (isReactivationInGrace && previousEnd) {
    // subscription_start en formato YYYY-MM-DD = fecha en que vencio el ciclo previo
    // Sin trial al reactivar (ya tuvieron su trial inicial)
    subscriptionParams.subscription_start = previousEnd.toISOString().slice(0, 10);
  } else {
    // Primera suscripcion o vuelve fuera de gracia: trial completo
    subscriptionParams.trial_period_days = TRIAL_DAYS;
  }

  let subscription: { subscriptionId: string; periodEnd?: string };
  try {
    subscription = await flowPost<{ subscriptionId: string; periodEnd?: string }>(
      "/subscription/create",
      subscriptionParams,
    );
  } catch (err: any) {
    console.error("[billing/return] subscription/create fallo:", err?.message);
    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { flowRegisterToken: null, pendingFlowPlanId: null },
    });
    return NextResponse.redirect(`${baseUrl}/panel?billing=error&reason=subscription_failed`);
  }

  const appPlan = planFromFlowId(restaurant.pendingFlowPlanId) || restaurant.plan;
  const trialEndsAt = isReactivationInGrace ? null : new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const newStatus = isReactivationInGrace ? "ACTIVE" : "TRIALING";

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: {
      flowSubscriptionId: subscription.subscriptionId,
      flowPlanId: restaurant.pendingFlowPlanId,
      plan: appPlan,
      subscriptionStatus: newStatus,
      trialEndsAt,
      currentPeriodEnd: subscription.periodEnd ? new Date(subscription.periodEnd) : (trialEndsAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
      flowRegisterToken: null,
      pendingFlowPlanId: null,
    },
  });

  return NextResponse.redirect(`${baseUrl}/panel?billing=success&plan=${appPlan}`);
}
