import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  FLOW_PLANS,
  planFromFlowId,
  ivaOf,
  grossOf,
  IVA_RATE,
  missingBillingFields,
} from "@/lib/billing/plans-config";

/**
 * GET /api/billing/status?restaurantId=...
 *
 * Devuelve el estado de billing del restaurant para mostrar en el panel.
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
        select: {
          id: true, name: true, plan: true,
          flowCustomerId: true, flowSubscriptionId: true, flowPlanId: true,
          subscriptionStatus: true, trialEndsAt: true, currentPeriodEnd: true, lastPaymentAt: true,
          billingExempt: true,
          billingCompanyName: true,
          billingRut: true,
          billingGiro: true,
          billingAddress: true,
          billingCity: true,
          billingEmail: true,
        },
        take: 1,
      },
    },
  });
  const restaurant = owner?.restaurants[0];
  if (!restaurant) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const flowPlan = restaurant.flowPlanId ? planFromFlowId(restaurant.flowPlanId) : null;

  // Adjuntar desglose neto/IVA/bruto a cada plan disponible
  const plansWithIva = Object.fromEntries(
    Object.entries(FLOW_PLANS).map(([key, cfg]) => [
      key,
      {
        ...cfg,
        amount: cfg.amountNet, // backwards-compat con clientes existentes
        amountIva: ivaOf(cfg.amountNet),
        amountGross: grossOf(cfg.amountNet),
      },
    ]),
  );

  const missing = missingBillingFields({
    billingCompanyName: restaurant.billingCompanyName,
    billingRut: restaurant.billingRut,
    billingGiro: restaurant.billingGiro,
    billingAddress: restaurant.billingAddress,
    billingCity: restaurant.billingCity,
    billingEmail: restaurant.billingEmail,
  });

  return NextResponse.json({
    restaurantId: restaurant.id,
    plan: restaurant.plan,
    subscriptionStatus: restaurant.subscriptionStatus,
    trialEndsAt: restaurant.trialEndsAt,
    currentPeriodEnd: restaurant.currentPeriodEnd,
    lastPaymentAt: restaurant.lastPaymentAt,
    hasSubscription: !!restaurant.flowSubscriptionId,
    activeFlowPlan: flowPlan,
    billingExempt: restaurant.billingExempt,
    plans: plansWithIva,
    ivaRate: IVA_RATE,
    billingInfo: {
      billingCompanyName: restaurant.billingCompanyName,
      billingRut: restaurant.billingRut,
      billingGiro: restaurant.billingGiro,
      billingAddress: restaurant.billingAddress,
      billingCity: restaurant.billingCity,
      billingEmail: restaurant.billingEmail,
      isComplete: missing.length === 0,
      missingFields: missing,
    },
  });
}
