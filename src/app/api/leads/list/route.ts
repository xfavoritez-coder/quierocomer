import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PASSWORD = "joan";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("x-leads-auth");
  if (auth !== PASSWORD) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Slugs de restaurantes con plan pago activo (GOLD o PREMIUM)
  const paidRestaurants = await prisma.restaurant.findMany({
    where: { plan: { in: ["GOLD", "PREMIUM"] } },
    select: { slug: true },
  });
  const paidSlugs = new Set(paidRestaurants.map(r => r.slug));

  const allLeads = await prisma.lead.findMany({
    where: {
      step2At: { not: null }, // solo leads reales de /subircarta
    },
    orderBy: { createdAt: "desc" },
    take: 500,
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
  });

  // Excluir leads cuyo restaurante ya tiene plan pago
  const leads = allLeads.filter(l => !l.generatedSlug || !paidSlugs.has(l.generatedSlug));

  return NextResponse.json({ leads, total: allLeads.length, filtered: leads.length });
}
