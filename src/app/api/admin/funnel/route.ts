import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [leads, visitCount] = await Promise.all([
      prisma.lead.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        include: {
          detectedProvider: { select: { name: true } },
        },
      }),
      prisma.funnelVisit.count({ where: { page: "subircarta" } }),
    ]);

    const total = leads.length;
    const reachedStep2 = leads.filter((l) => l.step2At).length;
    const completed = leads.filter((l) => l.completedAt).length;
    // Orphan leads: have file/url but no email and created > 10 min ago
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    const orphanLeads = leads.filter(
      (l) => !l.email && (l.cartaUrl || l.cartaFileUrl) && new Date(l.createdAt) < tenMinAgo
    ).length;
    const delivered = leads.filter((l) => l.cartaStatus === "DELIVERED" || l.deliveredAt).length;
    const emailOpened = leads.filter((l) => l.emailOpenedAt).length;
    const emailClicked = leads.filter((l) => l.emailClickedAt).length;
    const onboardingDone = leads.filter((l) => l.onboardingDoneAt).length;
    const panelVisited = leads.filter((l) => l.panelVisitedAt).length;
    const activarVisited = leads.filter((l) => l.activarVisitedAt).length;
    const activated = leads.filter((l) => l.activatedAt || l.activated).length;

    const pct = (n: number, base: number) => base > 0 ? Math.round((n / base) * 100) : 0;

    const stats = {
      visitCount,
      total,
      reachedStep2,
      completed,
      delivered,
      emailOpened,
      emailClicked,
      onboardingDone,
      panelVisited,
      activarVisited,
      activated,
      abandoned: total - completed,
      // Percentages
      visitToLeadRate: pct(total, visitCount),
      step2Rate: pct(reachedStep2, total),
      conversionRate: pct(completed, total),
      deliveredRate: pct(delivered, completed),
      openRate: pct(emailOpened, delivered),
      clickRate: pct(emailClicked, delivered),
      onboardingRate: pct(onboardingDone, emailClicked),
      panelRate: pct(panelVisited, emailClicked),
      activarVisitedRate: pct(activarVisited, emailClicked),
      activatedRate: pct(activated, emailClicked),
      orphanLeads,
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
