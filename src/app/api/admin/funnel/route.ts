import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseDevice(ua: string): string {
  const l = ua.toLowerCase();
  if (/mobile|android|iphone|ipod|windows phone|opera mini|iemobile/i.test(l)) return "mobile";
  if (/ipad|tablet|kindle|silk|playbook/i.test(l)) return "tablet";
  return "desktop";
}

export async function GET() {
  try {
    const [leads, visitCount, recentVisits] = await Promise.all([
      prisma.lead.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        include: {
          detectedProvider: { select: { name: true } },
        },
      }),
      prisma.funnelVisit.count({ where: { page: "subircarta" } }),
      prisma.funnelVisit.findMany({
        where: { page: "subircarta" },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true, ip: true, createdAt: true,
          utmSource: true, utmMedium: true, utmCampaign: true,
          referrer: true, userAgent: true,
        },
      }),
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

    // Match visits to leads by IP + close timestamp (within 30 min)
    const leadIps = new Map<string, string>(); // ip+window -> leadId
    for (const l of leads) {
      if (l.ip) {
        const bucket = Math.floor(new Date(l.createdAt).getTime() / (30 * 60 * 1000));
        leadIps.set(`${l.ip}:${bucket}`, l.id);
        leadIps.set(`${l.ip}:${bucket - 1}`, l.id);
      }
    }

    // Build reverse map: leadId -> userAgent from matched visit
    const leadDevice = new Map<string, string>();
    const visits = recentVisits.map((v) => {
      const bucket = Math.floor(new Date(v.createdAt).getTime() / (30 * 60 * 1000));
      const matchedLeadId = v.ip ? (leadIps.get(`${v.ip}:${bucket}`) || leadIps.get(`${v.ip}:${bucket + 1}`) || null) : null;
      if (matchedLeadId && v.userAgent && !leadDevice.has(matchedLeadId)) {
        leadDevice.set(matchedLeadId, parseDevice(v.userAgent));
      }
      return { ...v, matchedLeadId };
    });

    // Enrich leads with device type
    const enrichedLeads = leads.map((l) => ({
      ...l,
      device: leadDevice.get(l.id) || null,
    }));

    return NextResponse.json({ leads: enrichedLeads, stats, visits });
  } catch (error) {
    console.error("[Admin Funnel GET]", error);
    return NextResponse.json({ error: "Error al obtener leads." }, { status: 500 });
  }
}
