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
        email: { not: "import@quierocomer.com" },
        whatsapp: { not: null },
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
        crmStatusHistory: true,
        city: true,
      },
    }),
  ]);

  const PLAN_PRICES: Record<string, number> = { SILVER: 14900, GOLD: 29900, PREMIUM: 44900 };

  const paidMap = new Map(paidRestaurants.map(r => [r.slug, r]));

  // Excluir leads cuyo restaurante ya es cliente activo (pago o bonificado)
  // y deduplicar por whatsapp (queda el más reciente — orderBy: createdAt desc arriba)
  const seenWa = new Set<string>();
  const leads = allLeads
    .filter(l => !l.generatedSlug || !paidMap.has(l.generatedSlug))
    .filter(l => {
      const key = l.whatsapp!.replace(/\D/g, "");
      if (seenWa.has(key)) return false;
      seenWa.add(key);
      return true;
    })
    .map(l => ({
      ...l,
      restaurantPlan: null,
      restaurantPlanPrice: null,
      restaurantPeriodEnd: null,
      restaurantLastPayment: null,
    }));

  return NextResponse.json({ leads, total: leads.length });
}
