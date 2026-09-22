import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FLOW_PLANS, planFromFlowId, grossOf, type PlanKey } from "@/lib/billing/plans-config";

/**
 * GET /api/billing/payments?restaurantId=...
 *
 * Devuelve el historial de pagos del restaurante.
 * Fuente: emailLog (plan_activated / plan_renewed) + panelActivity (payment_received).
 */
export async function GET(req: NextRequest) {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });

  const owner = await prisma.restaurantOwner.findUnique({
    where: { id: panelId },
    include: {
      restaurants: {
        where: { id: restaurantId },
        select: { id: true, flowPlanId: true, plan: true, customPlanPriceNet: true },
        take: 1,
      },
    },
  });
  if (!owner || !owner.restaurants[0]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const restaurant = owner.restaurants[0];

  // 1. Pagos registrados con detalle (panelActivity payment_received)
  const activityPayments = await prisma.panelActivity.findMany({
    where: { restaurantId, action: "payment_received" },
    orderBy: { createdAt: "desc" },
    take: 24,
    select: { details: true, createdAt: true },
  });

  // 2. Historial desde emailLog (plan_activated / plan_renewed) como fallback
  const emailPayments = await prisma.emailLog.findMany({
    where: { to: owner.email, purpose: { in: ["plan_activated", "plan_renewed"] } },
    orderBy: { createdAt: "desc" },
    take: 24,
    select: { subject: true, purpose: true, createdAt: true },
  });

  // Determinar precio actual para reconstruir histórico
  const planKey = (planFromFlowId(restaurant.flowPlanId || "") || restaurant.plan) as Exclude<PlanKey, "FREE">;
  const amountNet = restaurant.customPlanPriceNet ?? FLOW_PLANS[planKey]?.amountNet ?? 0;
  const amountGross = grossOf(amountNet);

  // Combinar y deduplicar por fecha (ventana de 1 min para actividad vs email del mismo pago)
  const activityDates = new Set(activityPayments.map(p => new Date(p.createdAt).toISOString().slice(0, 16)));

  const fromActivity = activityPayments.map(p => {
    const d = p.details as any;
    return {
      date: p.createdAt,
      plan: d?.plan || planKey,
      amountNet: d?.amountNet || amountNet,
      amountGross: d?.amountGross || amountGross,
      source: "activity" as const,
    };
  });

  const fromEmail = emailPayments
    .filter(e => !activityDates.has(new Date(e.createdAt).toISOString().slice(0, 16)))
    .map(e => ({
      date: e.createdAt,
      plan: planKey,
      amountNet,
      amountGross,
      source: "email" as const,
    }));

  const payments = [...fromActivity, ...fromEmail]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 24);

  return NextResponse.json({ payments });
}
