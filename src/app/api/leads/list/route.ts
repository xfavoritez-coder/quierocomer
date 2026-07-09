import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PASSWORD = "joan";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("x-leads-auth");
  if (auth !== PASSWORD) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const [paidRestaurants, allLeads] = await Promise.all([
    // Restaurantes con plan pago activo o bonificados
    prisma.restaurant.findMany({
      where: {
        OR: [
          { subscriptionStatus: "ACTIVE" },
          { billingExempt: true },
        ],
      },
      select: {
        slug: true,
        plan: true,
        subscriptionStatus: true,
        currentPeriodEnd: true,
        lastPaymentAt: true,
        billingExempt: true,
        flowSubscriptionId: true,
        mpSubscriptionId: true,
      },
    }),
    prisma.lead.findMany({
      where: {
        email: { not: "import@quierocomer.cl" },
      },
      orderBy: { createdAt: "desc" },
      take: 2000,
      select: {
        id: true,
        localName: true,
        ownerName: true,
        email: true,
        whatsapp: true,
        cartaType: true,
        cartaStatus: true,
        cartaUrl: true,
        generatedSlug: true,
        createdAt: true,
        completedAt: true,
        deliveredAt: true,
        emailOpenedAt: true,
        emailClickedAt: true,
        panelVisitedAt: true,
        activatedAt: true,
        activated: true,
        errorLog: true,
        crmStatus: true,
        crmNotes: true,
        crmFollowUpAt: true,
        city: true,
      },
    }),
  ]);

  const PLAN_PRICES: Record<string, number> = { SILVER: 14900, GOLD: 29900, PREMIUM: 44900 };

  const paidMap = new Map(paidRestaurants.map(r => [r.slug, r]));

  // Marcar leads cuyo restaurante ya tiene plan pago (no excluir, solo marcar)
  const leads = allLeads.map(l => {
    const paidR = l.generatedSlug ? paidMap.get(l.generatedSlug) : undefined;
    return {
      ...l,
      restaurantPlan: paidR?.plan ?? null,
      restaurantPlanPrice: paidR ? (PLAN_PRICES[paidR.plan] ?? null) : null,
      restaurantPeriodEnd: paidR?.currentPeriodEnd ?? null,
      restaurantLastPayment: paidR?.lastPaymentAt ?? null,
    };
  });

  return NextResponse.json({ leads, total: leads.length });
}
