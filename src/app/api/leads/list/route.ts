import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PASSWORD = "joan";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("x-leads-auth");
  if (auth !== PASSWORD) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const leads = await prisma.lead.findMany({
    where: {
      step2At: { not: null },  // solo leads reales de /subircarta
      activated: false,         // excluye quienes ya tienen plan activo
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
      errorLog: true,
      crmStatus: true,
      crmNotes: true,
      crmFollowUpAt: true,
      city: true,
    },
  });

  return NextResponse.json({ leads });
}
