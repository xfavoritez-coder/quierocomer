import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        detectedProvider: { select: { name: true } },
      },
    });

    const reachedStep2 = leads.filter((l) => l.step2At).length;
    const completed = leads.filter((l) => l.completedAt).length;

    const stats = {
      total: leads.length,
      reachedStep2,
      completed,
      abandoned: leads.length - completed,
      conversionRate: leads.length > 0 ? Math.round((completed / leads.length) * 100) : 0,
      step2Rate: leads.length > 0 ? Math.round((reachedStep2 / leads.length) * 100) : 0,
      byType: {
        LINK: leads.filter((l) => l.cartaType === "LINK").length,
        DOCUMENT: leads.filter((l) => l.cartaType === "DOCUMENT").length,
        PHOTO: leads.filter((l) => l.cartaType === "PHOTO").length,
      },
    };

    return NextResponse.json({ leads, stats });
  } catch (error) {
    console.error("[Admin Funnel GET]", error);
    return NextResponse.json({ error: "Error al obtener leads." }, { status: 500 });
  }
}
