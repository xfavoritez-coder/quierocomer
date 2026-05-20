import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const days = parseInt(req.nextUrl.searchParams.get("days") || "30", 10);
    const since = new Date(Date.now() - days * 86400000);

    // All ad sessions (any utm_source, but primarily facebook_ads)
    const sessions = await prisma.adSession.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    // Funnel visits from ads
    const adVisits = await prisma.funnelVisit.count({
      where: { utmSource: { not: null }, createdAt: { gte: since } },
    });

    const fbVisits = await prisma.funnelVisit.count({
      where: { utmSource: "facebook_ads", createdAt: { gte: since } },
    });

    const totalVisits = await prisma.funnelVisit.count({
      where: { page: "subircarta", createdAt: { gte: since } },
    });

    // Aggregate stats
    const fbSessions = sessions.filter((s) => s.utmSource === "facebook_ads");
    const totalSessions = fbSessions.length;
    const bounced = fbSessions.filter((s) => s.bounced).length;
    const converted = fbSessions.filter((s) => s.converted).length;
    const avgDuration = totalSessions > 0 ? Math.round(fbSessions.reduce((s, x) => s + x.duration, 0) / totalSessions) : 0;
    const avgScroll = totalSessions > 0 ? Math.round(fbSessions.reduce((s, x) => s + x.maxScroll, 0) / totalSessions) : 0;
    const avgInteractions = totalSessions > 0 ? Math.round(fbSessions.reduce((s, x) => s + x.interactions, 0) / totalSessions) : 0;

    // Device breakdown
    const mobile = fbSessions.filter((s) => s.device === "mobile").length;
    const desktop = fbSessions.filter((s) => s.device === "desktop").length;

    // Campaign breakdown
    const byCampaign: Record<string, { visits: number; bounced: number; converted: number; avgDuration: number; avgScroll: number }> = {};
    for (const s of fbSessions) {
      const key = s.utmCampaign || "(sin campaña)";
      if (!byCampaign[key]) byCampaign[key] = { visits: 0, bounced: 0, converted: 0, avgDuration: 0, avgScroll: 0 };
      byCampaign[key].visits++;
      if (s.bounced) byCampaign[key].bounced++;
      if (s.converted) byCampaign[key].converted++;
      byCampaign[key].avgDuration += s.duration;
      byCampaign[key].avgScroll += s.maxScroll;
    }
    for (const key of Object.keys(byCampaign)) {
      const c = byCampaign[key];
      c.avgDuration = c.visits > 0 ? Math.round(c.avgDuration / c.visits) : 0;
      c.avgScroll = c.visits > 0 ? Math.round(c.avgScroll / c.visits) : 0;
    }

    // Content/ad breakdown
    const byContent: Record<string, { visits: number; bounced: number; converted: number }> = {};
    for (const s of fbSessions) {
      const key = s.utmContent || "(sin contenido)";
      if (!byContent[key]) byContent[key] = { visits: 0, bounced: 0, converted: 0 };
      byContent[key].visits++;
      if (s.bounced) byContent[key].bounced++;
      if (s.converted) byContent[key].converted++;
    }

    // Section engagement — which parts of the page were seen
    const sectionCounts: Record<string, number> = {};
    for (const s of fbSessions) {
      for (const sec of (s.sectionsViewed || [])) {
        sectionCounts[sec] = (sectionCounts[sec] || 0) + 1;
      }
    }

    // Click heatmap — what elements were clicked
    const clickCounts: Record<string, number> = {};
    for (const s of fbSessions) {
      for (const ev of (s.events as any[] || [])) {
        if (ev.type === "click" && ev.data?.label) {
          const label = ev.data.label.slice(0, 50);
          clickCounts[label] = (clickCounts[label] || 0) + 1;
        }
      }
    }

    // Daily breakdown for chart
    const daily: Record<string, { visits: number; converted: number; bounced: number }> = {};
    for (const s of fbSessions) {
      const day = s.createdAt.toISOString().slice(0, 10);
      if (!daily[day]) daily[day] = { visits: 0, converted: 0, bounced: 0 };
      daily[day].visits++;
      if (s.converted) daily[day].converted++;
      if (s.bounced) daily[day].bounced++;
    }

    const pct = (n: number, base: number) => base > 0 ? Math.round((n / base) * 100) : 0;

    return NextResponse.json({
      stats: {
        totalVisits,
        adVisits,
        fbVisits,
        fbPctOfTotal: pct(fbVisits, totalVisits),
        totalSessions,
        bounced,
        bounceRate: pct(bounced, totalSessions),
        converted,
        conversionRate: pct(converted, totalSessions),
        avgDuration,
        avgScroll,
        avgInteractions,
        mobile,
        desktop,
      },
      byCampaign,
      byContent,
      sectionCounts,
      clickCounts,
      daily,
      sessions: fbSessions.slice(0, 100).map((s) => ({
        id: s.id,
        sessionId: s.sessionId,
        utmCampaign: s.utmCampaign,
        utmContent: s.utmContent,
        device: s.device,
        duration: s.duration,
        maxScroll: s.maxScroll,
        interactions: s.interactions,
        sectionsViewed: s.sectionsViewed,
        converted: s.converted,
        bounced: s.bounced,
        leadId: s.leadId,
        events: s.events,
        createdAt: s.createdAt,
      })),
    });
  } catch (error) {
    console.error("[Admin Facebook Ads]", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
