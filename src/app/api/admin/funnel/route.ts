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

    const stats = {
      total: leads.length,
      completed: leads.filter((l) => l.email).length,
      pending: leads.filter((l) => !l.email).length,
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
