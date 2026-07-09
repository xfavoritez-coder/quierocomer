import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PASSWORD = "joan";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("x-leads-auth");
  if (auth !== PASSWORD) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const [paidRestaurants, allLeads] = await Promise.all([
    prisma.restaurant.findMany({
      where: { plan: { in: ["GOLD", "PREMIUM"] } },
      select: { slug: true, plan: true },
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

  const paidSlugs = new Map(paidRestaurants.map(r => [r.slug, r.plan]));

  // Marcar leads cuyo restaurante ya tiene plan pago (no excluir, solo marcar)
  const leads = allLeads.map(l => ({
    ...l,
    restaurantPlan: l.generatedSlug ? (paidSlugs.get(l.generatedSlug) ?? null) : null,
  }));

  return NextResponse.json({ leads, total: leads.length });
}
