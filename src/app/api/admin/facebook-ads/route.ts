import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const days = parseInt(req.nextUrl.searchParams.get("days") || "30", 10);
    const source = req.nextUrl.searchParams.get("source") || null; // null = all ad sources
    const since = new Date(Date.now() - days * 86400000);

    // All ad sessions
    const sessions = await prisma.adSession.findMany({
      where: {
        createdAt: { gte: since },
        ...(source ? { utmSource: source } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    // Funnel visits
    const [totalVisits, adVisits, adVisitsBySource] = await Promise.all([
      prisma.funnelVisit.count({ where: { createdAt: { gte: since } } }),
      prisma.funnelVisit.count({ where: { utmSource: { not: null }, createdAt: { gte: since } } }),
      prisma.funnelVisit.groupBy({
        by: ["utmSource"],
        where: { utmSource: { not: null }, createdAt: { gte: since } },
        _count: true,
      }),
    ]);

    const sourceBreakdown: Record<string, number> = {};
    for (const g of adVisitsBySource) {
      if (g.utmSource) sourceBreakdown[g.utmSource] = g._count;
    }

    const filteredSessions = sessions;
    const totalSessions = filteredSessions.length;
    const bounced = filteredSessions.filter((s) => s.bounced).length;
    const converted = filteredSessions.filter((s) => s.converted).length;
    const avgDuration = totalSessions > 0 ? Math.round(filteredSessions.reduce((s, x) => s + x.duration, 0) / totalSessions) : 0;
    const avgScroll = totalSessions > 0 ? Math.round(filteredSessions.reduce((s, x) => s + x.maxScroll, 0) / totalSessions) : 0;
    const avgInteractions = totalSessions > 0 ? Math.round(filteredSessions.reduce((s, x) => s + x.interactions, 0) / totalSessions) : 0;

    const mobile = filteredSessions.filter((s) => s.device === "mobile").length;
    const desktop = filteredSessions.filter((s) => s.device === "desktop").length;

    // Campaign breakdown
    const byCampaign: Record<string, { visits: number; bounced: number; converted: number; avgDuration: number; avgScroll: number }> = {};
    for (const s of filteredSessions) {
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
    for (const s of filteredSessions) {
      const key = s.utmContent || "(sin contenido)";
      if (!byContent[key]) byContent[key] = { visits: 0, bounced: 0, converted: 0 };
      byContent[key].visits++;
      if (s.bounced) byContent[key].bounced++;
      if (s.converted) byContent[key].converted++;
    }

    // Section engagement
    const sectionCounts: Record<string, number> = {};
    for (const s of filteredSessions) {
      for (const sec of (s.sectionsViewed || [])) {
        sectionCounts[sec] = (sectionCounts[sec] || 0) + 1;
      }
    }

    // Click heatmap
    const clickCounts: Record<string, number> = {};
    for (const s of filteredSessions) {
      for (const ev of (s.events as any[] || [])) {
        if (ev.type === "click" && ev.data?.label) {
          const label = ev.data.label.slice(0, 50);
          clickCounts[label] = (clickCounts[label] || 0) + 1;
        }
      }
    }

    // Landing page breakdown
    const byLanding: Record<string, number> = {};
    for (const s of filteredSessions) {
      const page = (s.landingPage || "/").split("?")[0];
      byLanding[page] = (byLanding[page] || 0) + 1;
    }

    // Daily breakdown
    const daily: Record<string, { visits: number; converted: number; bounced: number }> = {};
    for (const s of filteredSessions) {
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
      sourceBreakdown,
      byLanding,
      byCampaign,
      byContent,
      sectionCounts,
      clickCounts,
      daily,
      sessions: filteredSessions.slice(0, 100).map((s) => ({
        id: s.id,
        sessionId: s.sessionId,
        utmSource: s.utmSource,
        utmCampaign: s.utmCampaign,
        utmContent: s.utmContent,
        device: s.device,
        landingPage: s.landingPage,
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
