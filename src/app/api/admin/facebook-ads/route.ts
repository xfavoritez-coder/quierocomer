import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const daysParam = req.nextUrl.searchParams.get("days");
    const sinceParam = req.nextUrl.searchParams.get("since");
    const source = req.nextUrl.searchParams.get("source") || null;
    const untilParam = req.nextUrl.searchParams.get("until");
    const since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - (parseInt(daysParam || "30", 10)) * 86400000);
    const until = untilParam ? new Date(untilParam) : undefined;

    // All ad sessions
    const sessions = await prisma.adSession.findMany({
      where: {
        createdAt: { gte: since, ...(until ? { lt: until } : {}) },
        ...(source ? { utmSource: source } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    // Funnel visits
    const [totalVisits, adVisits, adVisitsBySource] = await Promise.all([
      prisma.funnelVisit.count({ where: { createdAt: { gte: since, ...(until ? { lt: until } : {}) } } }),
      prisma.funnelVisit.count({ where: { utmSource: { not: null }, createdAt: { gte: since, ...(until ? { lt: until } : {}) } } }),
      prisma.funnelVisit.groupBy({
        by: ["utmSource"],
        where: { utmSource: { not: null }, createdAt: { gte: since, ...(until ? { lt: until } : {}) } },
        _count: true,
      }),
    ]);

    const sourceBreakdown: Record<string, number> = {};
    for (const g of adVisitsBySource) {
      if (g.utmSource) sourceBreakdown[g.utmSource] = g._count;
    }

    // Filter ghost sessions: in-app browsers (IG/FB) that load the page
    // in background with 0% scroll and <= 2 interactions are not real visits
    const filteredSessions = sessions.filter((s) => {
      const ua = s.userAgent || "";
      const isInAppBrowser = /FBAN|FBAV|FB_IAB|Instagram/i.test(ua);
      const isGhost = isInAppBrowser && s.maxScroll === 0 && s.interactions <= 2;
      return !isGhost;
    });
    const totalSessions = filteredSessions.length;
    const bounced = filteredSessions.filter((s) => s.bounced).length;
    const converted = filteredSessions.filter((s) => s.converted).length;
    const avgDuration = totalSessions > 0 ? Math.round(filteredSessions.reduce((s, x) => s + x.duration, 0) / totalSessions) : 0;
    const avgScroll = totalSessions > 0 ? Math.round(filteredSessions.reduce((s, x) => s + x.maxScroll, 0) / totalSessions) : 0;
    const avgInteractions = totalSessions > 0 ? Math.round(filteredSessions.reduce((s, x) => s + x.interactions, 0) / totalSessions) : 0;

    const mobile = filteredSessions.filter((s) => s.device === "mobile").length;
    const desktop = filteredSessions.filter((s) => s.device === "desktop").length;
    // Sessions that landed on landing page and then navigated to /subircarta
    const flatEvents = (s: any) => (s.events as any[]).flat();
    const landingSessions = filteredSessions.filter((s) => !(s.landingPage || "").includes("/subircarta"));
    const sessionVisitedSubircarta = (s: any) => {
      const landed = (s.landingPage || "").includes("/subircarta");
      if (landed) return true;
      return flatEvents(s).some((e: any) => e.type === "page_load" && e.data?.page?.includes("/subircarta"));
    };
    const visitedSubircarta = filteredSessions.filter((s) => sessionVisitedSubircarta(s)).length;

    // Logo clicks: sessions where user clicked a restaurant logo (href contains /qr/)
    const logoClicks: Record<string, number> = {};
    for (const s of filteredSessions) {
      for (const ev of flatEvents(s)) {
        if (ev.type === "click" && ev.data?.href?.includes("/qr/")) {
          const match = ev.data.href.match(/\/qr\/([^?/]+)/);
          const slug = match ? match[1] : "desconocido";
          logoClicks[slug] = (logoClicks[slug] || 0) + 1;
        }
      }
    }
    const totalLogoClicks = Object.values(logoClicks).reduce((a, b) => a + b, 0);

    // Campaign breakdown
    const byCampaign: Record<string, { visits: number; bounced: number; converted: number; avgDuration: number; avgScroll: number; subircarta: number; landedSubircarta: number; landedLanding: number }> = {};
    for (const s of filteredSessions) {
      const key = s.utmCampaign || "(sin campaña)";
      if (!byCampaign[key]) byCampaign[key] = { visits: 0, bounced: 0, converted: 0, avgDuration: 0, avgScroll: 0, subircarta: 0, landedSubircarta: 0, landedLanding: 0 };
      byCampaign[key].visits++;
      if (s.bounced) byCampaign[key].bounced++;
      if (s.converted) byCampaign[key].converted++;
      byCampaign[key].avgDuration += s.duration;
      byCampaign[key].avgScroll += s.maxScroll;
      // Track landing page + /subircarta visits
      const landedOnSubircarta = (s.landingPage || "").includes("/subircarta");
      if (landedOnSubircarta) {
        byCampaign[key].landedSubircarta++;
        byCampaign[key].subircarta++;
      } else {
        byCampaign[key].landedLanding++;
        const navigated = flatEvents(s).some((e: any) => e.type === "page_load" && e.data?.page?.includes("/subircarta"));
        if (navigated) byCampaign[key].subircarta++;
      }
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
      for (const ev of flatEvents(s)) {
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

    // Hourly breakdown (all sessions in period, aggregated by hour in Chile time)
    const hourly: Record<number, { visits: number; bounced: number; converted: number; subircarta: number }> = {};
    for (let h = 0; h < 24; h++) hourly[h] = { visits: 0, bounced: 0, converted: 0, subircarta: 0 };
    for (const s of filteredSessions) {
      const clHour = parseInt(s.createdAt.toLocaleString("en-US", { timeZone: "America/Santiago", hour: "numeric", hour12: false }), 10);
      hourly[clHour].visits++;
      if (s.bounced) hourly[clHour].bounced++;
      if (s.converted) hourly[clHour].converted++;
      if (sessionVisitedSubircarta(s)) hourly[clHour].subircarta++;
    }

    // Daily breakdown — always last 30 days regardless of filter
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const dailySessions = await prisma.adSession.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, converted: true, bounced: true, userAgent: true, maxScroll: true, interactions: true },
      orderBy: { createdAt: "asc" },
    });
    const daily: Record<string, { visits: number; converted: number; bounced: number }> = {};
    for (const s of dailySessions) {
      const ua = s.userAgent || "";
      const isGhost = /FBAN|FBAV|FB_IAB|Instagram/i.test(ua) && s.maxScroll === 0 && s.interactions <= 2;
      if (isGhost) continue;
      const day = s.createdAt.toISOString().slice(0, 10);
      if (!daily[day]) daily[day] = { visits: 0, converted: 0, bounced: 0 };
      daily[day].visits++;
      if (s.converted) daily[day].converted++;
      if (s.bounced) daily[day].bounced++;
    }

    const pct = (n: number, base: number) => base > 0 ? Math.round((n / base) * 100) : 0;

    const ghostSessions = sessions.length - filteredSessions.length;
    const fbSessions = filteredSessions.filter(s => s.utmSource === "facebook" || s.fbclid).length;

    return NextResponse.json({
      stats: {
        totalVisits,
        adVisits,
        fbVisits: fbSessions,
        fbPctOfTotal: totalVisits > 0 ? Math.round((fbSessions / totalVisits) * 100) : 0,
        ghostSessions,
        totalSessions,
        bounced,
        bounceRate: pct(bounced, totalSessions),
        converted,
        conversionRate: pct(converted, totalSessions),
        avgDuration,
        avgScroll,
        avgInteractions,
        visitedSubircarta,
        visitedSubircartaRate: pct(visitedSubircarta, totalSessions),
        mobile,
        desktop,
      },
      logoClicks,
      totalLogoClicks,
      sourceBreakdown,
      byLanding,
      byCampaign,
      byContent,
      sectionCounts,
      clickCounts,
      hourly,
      daily,
      sessions: filteredSessions.slice(0, 100).map((s) => ({
        id: s.id,
        sessionId: s.sessionId,
        utmSource: s.utmSource,
        utmMedium: s.utmMedium,
        utmCampaign: s.utmCampaign,
        utmContent: s.utmContent,
        utmTerm: s.utmTerm,
        fbclid: s.fbclid,
        device: s.device,
        userAgent: s.userAgent,
        ip: s.ip,
        referrer: s.referrer,
        landingPage: s.landingPage,
        duration: s.duration,
        maxScroll: s.maxScroll,
        pageViews: s.pageViews,
        interactions: s.interactions,
        sectionsViewed: s.sectionsViewed,
        converted: s.converted,
        bounced: s.bounced,
        exitPage: s.exitPage,
        leadId: s.leadId,
        events: s.events,
        visitedSubircarta: sessionVisitedSubircarta(s),
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    });
  } catch (error) {
    console.error("[Admin Facebook Ads]", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
