import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  checkAdminAuth,
  isSuperAdmin,
  getOwnedRestaurantIds,
  requireRestaurantForOwner,
  authErrorResponse,
} from "@/lib/adminAuth";

function getDateRange(period: string | null, from: string | null, to: string | null) {
  const chileNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
  const ymd = `${chileNow.getFullYear()}-${String(chileNow.getMonth() + 1).padStart(2, "0")}-${String(chileNow.getDate()).padStart(2, "0")}`;
  const todayStart = new Date(ymd + "T00:00:00.000-04:00");

  switch (period) {
    case "yesterday": {
      const ys = new Date(todayStart.getTime() - 86400000);
      return { from: ys, to: todayStart };
    }
    case "week":
      return { from: new Date(todayStart.getTime() - 7 * 86400000), to: new Date() };
    case "month":
      return { from: new Date(todayStart.getTime() - 30 * 86400000), to: new Date() };
    case "custom":
      if (from && to) return { from: new Date(from), to: new Date(to) };
      return { from: new Date(todayStart.getTime() - 7 * 86400000), to: new Date() };
    case "today":
    default:
      return { from: todayStart, to: new Date() };
  }
}

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const url = new URL(req.url);
    const filterRestaurantId = url.searchParams.get("restaurantId");
    const period = url.searchParams.get("period") || "today";
    const customFrom = url.searchParams.get("from");
    const customTo = url.searchParams.get("to");

    const { from: rangeFrom, to: rangeTo } = getDateRange(period, customFrom, customTo);

    const isSuper = isSuperAdmin(req);
    let restaurantFilter: any = {};

    if (filterRestaurantId) {
      await requireRestaurantForOwner(req, filterRestaurantId);
      restaurantFilter = { restaurantId: filterRestaurantId };
    } else if (!isSuper) {
      const ownerIds = await getOwnedRestaurantIds(req);
      if (!ownerIds || ownerIds.length === 0) {
        return NextResponse.json({ error: "No tienes restaurantes asignados" }, { status: 403 });
      }
      restaurantFilter = { restaurantId: { in: ownerIds } };
    }

    const dateFilter = { gte: rangeFrom, lte: rangeTo };

    // Chile "today" + "week" boundaries (always computed for panel compat)
    const chileNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
    const ymd = `${chileNow.getFullYear()}-${String(chileNow.getMonth() + 1).padStart(2, "0")}-${String(chileNow.getDate()).padStart(2, "0")}`;
    const todayStart = new Date(ymd + "T00:00:00.000-04:00");
    const weekAgo = new Date(todayStart.getTime() - 7 * 86400000);
    const twoWeeksAgo = new Date(todayStart.getTime() - 14 * 86400000);

    const [
      // Period-based queries
      totalSessions,
      guestsInPeriod,
      sessionsDetail,
      birthdaysSaved,
      topDishesViewedPeriod,
      genioStartsPeriod,
      genioStepDietPeriod,
      genioCompletePeriod,
      sessionsByRestaurantRaw,
      // Period-dependent diet/restrictions (from Genio events)
      genioDietEventsRaw,
      genioRestrictionEventsRaw,
      // Birthdays by restaurant
      birthdaysByRestaurantRaw,
      // Panel compat: today
      todaySessionCount,
      todayUniqueRaw,
      todayBirthdays,
      genioToday,
      todayDurationAgg,
      todayWaiterCalls,
      todayWaiterPending,
      // Panel compat: week
      visitsThisWeek,
      visitsLastWeek,
      weekBirthdays,
      genioUsedThisWeek,
      weekTopDishes,
      weekSessions,
      weekGenioDiet,
      weekGenioComplete,
      weekGenioGuestsRaw,
      // Panel: star dish
      lastScan,
      activePromos,
      topSearches,
    ] = await Promise.all([
      // ── Period-based ──
      prisma.session.count({ where: { ...restaurantFilter, startedAt: dateFilter } }),
      prisma.session.findMany({ where: { ...restaurantFilter, startedAt: dateFilter }, select: { guestId: true }, distinct: ["guestId"] }),
      prisma.session.findMany({ where: { ...restaurantFilter, startedAt: dateFilter }, select: { durationMs: true, deviceType: true, viewUsed: true }, take: 10000 }),
      prisma.statEvent.count({ where: { ...restaurantFilter, eventType: "BIRTHDAY_SAVED" as any, createdAt: dateFilter } }),
      prisma.statEvent.groupBy({ by: ["dishId"], where: { ...restaurantFilter, eventType: "DISH_VIEW", dishId: { not: null }, createdAt: dateFilter }, _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 10 }),
      prisma.statEvent.count({ where: { ...restaurantFilter, eventType: "GENIO_START", createdAt: dateFilter } }),
      prisma.statEvent.count({ where: { ...restaurantFilter, eventType: "GENIO_STEP_RESTRICTIONS" as any, createdAt: dateFilter } }),
      prisma.statEvent.count({ where: { ...restaurantFilter, eventType: "GENIO_COMPLETE", createdAt: dateFilter } }),
      prisma.session.findMany({ where: { ...restaurantFilter, startedAt: dateFilter }, select: { guestId: true, restaurantId: true }, take: 50000 }),
      // Period-dependent: reaching restrictions step means they selected a diet
      prisma.statEvent.findMany({ where: { ...restaurantFilter, eventType: "GENIO_COMPLETE" as any, createdAt: dateFilter }, select: { guestId: true } }),
      // Restrictions: from guests who completed genio in period
      prisma.statEvent.findMany({ where: { ...restaurantFilter, eventType: "GENIO_STEP_RESTRICTIONS" as any, createdAt: dateFilter }, select: { guestId: true } }),
      // Birthdays by restaurant
      prisma.statEvent.groupBy({ by: ["restaurantId"], where: { ...restaurantFilter, eventType: "BIRTHDAY_SAVED" as any, createdAt: dateFilter }, _count: { id: true }, orderBy: { _count: { id: "desc" } } }),
      // ── Panel: today ──
      prisma.session.count({ where: { ...restaurantFilter, startedAt: { gte: todayStart } } }),
      prisma.session.findMany({ where: { ...restaurantFilter, startedAt: { gte: todayStart } }, select: { guestId: true }, distinct: ["guestId"] }),
      prisma.statEvent.count({ where: { ...restaurantFilter, eventType: "BIRTHDAY_SAVED" as any, createdAt: { gte: todayStart } } }),
      prisma.statEvent.count({ where: { ...restaurantFilter, eventType: "GENIO_START", createdAt: { gte: todayStart } } }),
      prisma.session.aggregate({ where: { ...restaurantFilter, startedAt: { gte: todayStart }, durationMs: { gt: 0 } }, _avg: { durationMs: true } }),
      prisma.waiterCall.count({ where: { ...restaurantFilter, calledAt: { gte: todayStart }, answeredAt: { not: null } } }),
      prisma.waiterCall.count({ where: { ...restaurantFilter, calledAt: { gte: todayStart }, answeredAt: null } }),
      // ── Panel: week ──
      prisma.statEvent.count({ where: { ...restaurantFilter, eventType: "SESSION_START", createdAt: { gte: weekAgo } } }),
      prisma.statEvent.count({ where: { ...restaurantFilter, eventType: "SESSION_START", createdAt: { gte: twoWeeksAgo, lt: weekAgo } } }),
      prisma.statEvent.count({ where: { ...restaurantFilter, eventType: "BIRTHDAY_SAVED" as any, createdAt: { gte: weekAgo } } }),
      prisma.statEvent.count({ where: { ...restaurantFilter, eventType: "GENIO_START", createdAt: { gte: weekAgo } } }),
      prisma.statEvent.groupBy({ by: ["dishId"], where: { ...restaurantFilter, eventType: "DISH_VIEW", dishId: { not: null }, createdAt: { gte: weekAgo } }, _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 5 }),
      prisma.session.findMany({ where: { ...restaurantFilter, startedAt: { gte: weekAgo } }, select: { durationMs: true, viewUsed: true, deviceType: true }, take: 10000 }),
      // Week genio funnel for panel
      prisma.statEvent.count({ where: { ...restaurantFilter, eventType: "GENIO_STEP_RESTRICTIONS" as any, createdAt: { gte: weekAgo } } }),
      prisma.statEvent.count({ where: { ...restaurantFilter, eventType: "GENIO_COMPLETE", createdAt: { gte: weekAgo } } }),
      // Week genio guests for diet/restrictions
      prisma.statEvent.findMany({ where: { ...restaurantFilter, eventType: "GENIO_COMPLETE" as any, createdAt: { gte: weekAgo } }, select: { guestId: true } }),
      // ── Panel: misc ──
      prisma.session.findFirst({ where: restaurantFilter, orderBy: { startedAt: "desc" }, select: { startedAt: true } }),
      prisma.promotion.count({ where: { ...restaurantFilter, status: "ACTIVE" } }),
      prisma.statEvent.groupBy({ by: ["query"], where: { ...restaurantFilter, eventType: "SEARCH_PERFORMED" as any, query: { not: null }, createdAt: { gte: weekAgo } }, _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 5 }),
    ]);

    // Resolve dish names for period + week
    const allDishIds = [...new Set([
      ...topDishesViewedPeriod.filter(d => d.dishId).map(d => d.dishId!),
      ...weekTopDishes.filter((d: any) => d.dishId).map((d: any) => d.dishId!),
    ])];
    const dishRecords = allDishIds.length
      ? await prisma.dish.findMany({ where: { id: { in: allDishIds } }, select: { id: true, name: true, photos: true } })
      : [];
    const dishMap = Object.fromEntries(dishRecords.map(d => [d.id, d]));

    // Compute restaurant ranking by unique guests
    const restGuestSets: Record<string, Set<string>> = {};
    for (const s of sessionsByRestaurantRaw) {
      if (!s.restaurantId || !s.guestId) continue;
      if (!restGuestSets[s.restaurantId]) restGuestSets[s.restaurantId] = new Set();
      restGuestSets[s.restaurantId].add(s.guestId);
    }
    const restaurantRankingRaw = Object.entries(restGuestSets)
      .map(([rid, guests]) => ({ restaurantId: rid, uniqueGuests: guests.size }))
      .sort((a, b) => b.uniqueGuests - a.uniqueGuests)
      .slice(0, 20);

    // Resolve restaurant names (ranking + birthdays)
    const restIds = [...new Set([
      ...restaurantRankingRaw.map(r => r.restaurantId),
      ...birthdaysByRestaurantRaw.map((r: any) => r.restaurantId),
    ])];
    const restRecords = restIds.length
      ? await prisma.restaurant.findMany({ where: { id: { in: restIds } }, select: { id: true, name: true } })
      : [];
    const restMap = Object.fromEntries(restRecords.map(r => [r.id, r.name]));

    // Period-based distributions
    let totalDuration = 0, durationCount = 0;
    const viewDist: Record<string, number> = {};
    const deviceDist: Record<string, number> = {};
    for (const s of sessionsDetail) {
      if (s.durationMs && s.durationMs > 0) { totalDuration += s.durationMs; durationCount++; }
      if (s.viewUsed) viewDist[s.viewUsed] = (viewDist[s.viewUsed] || 0) + 1;
      if (s.deviceType) deviceDist[s.deviceType] = (deviceDist[s.deviceType] || 0) + 1;
    }

    // Week avg duration for panel
    let weekTotalDur = 0, weekDurCount = 0;
    for (const s of weekSessions) {
      if (s.durationMs && s.durationMs > 0) { weekTotalDur += s.durationMs; weekDurCount++; }
    }

    // Diet + restrictions: from guests who used Genio in this period
    // Get the guest profiles for those who completed genio in period
    const genioGuestIds = [...new Set(genioDietEventsRaw.filter((e: any) => e.guestId).map((e: any) => e.guestId))];
    const restrictionGuestIds = [...new Set(genioRestrictionEventsRaw.filter((e: any) => e.guestId).map((e: any) => e.guestId))];
    const allGenioGuestIds = [...new Set([...genioGuestIds, ...restrictionGuestIds])];

    let dietDistribution: { type: string; count: number }[] = [];
    let restrictionsList: { name: string; count: number }[] = [];

    if (allGenioGuestIds.length > 0) {
      const guestProfiles = await prisma.guestProfile.findMany({
        where: { id: { in: allGenioGuestIds } },
        select: { preferences: true },
      });

      const dietCounts: Record<string, number> = {};
      const restrictionCounts: Record<string, number> = {};

      for (const gp of guestProfiles) {
        const prefs = gp.preferences as any;
        if (!prefs) continue;
        if (prefs.dietType) dietCounts[prefs.dietType] = (dietCounts[prefs.dietType] || 0) + 1;
        if (Array.isArray(prefs.restrictions)) {
          for (const r of prefs.restrictions) {
            if (r && r !== "ninguna") restrictionCounts[r] = (restrictionCounts[r] || 0) + 1;
          }
        }
      }

      dietDistribution = Object.entries(dietCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => ({ type, count }));
      restrictionsList = Object.entries(restrictionCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count }));
    }

    const uniqueGuests = guestsInPeriod.length;
    const linkedGuestsCount = 0; // simplified — panel uses registeredGuests from total
    const totalGuestsCount = uniqueGuests;

    // Week-based genio funnel for panel
    const weekGenioStarts = genioUsedThisWeek;
    const weekGenioDietCount = weekGenioDiet as number;
    const weekGenioCompleteCount = weekGenioComplete as number;

    // Week diet/restrictions for panel (from guests who completed genio this week)
    const weekGenioGuestIds = [...new Set((weekGenioGuestsRaw as any[]).filter((e: any) => e.guestId).map((e: any) => e.guestId))];
    let weekDietDistribution: { type: string; count: number }[] = [];
    let weekRestrictionsList: { name: string; count: number }[] = [];
    if (weekGenioGuestIds.length > 0) {
      const weekGuestProfiles = await prisma.guestProfile.findMany({
        where: { id: { in: weekGenioGuestIds } },
        select: { preferences: true },
      });
      const wDietCounts: Record<string, number> = {};
      const wResCounts: Record<string, number> = {};
      for (const gp of weekGuestProfiles) {
        const prefs = gp.preferences as any;
        if (!prefs) continue;
        if (prefs.dietType) wDietCounts[prefs.dietType] = (wDietCounts[prefs.dietType] || 0) + 1;
        if (Array.isArray(prefs.restrictions)) {
          for (const r of prefs.restrictions) {
            if (r && r !== "ninguna") wResCounts[r] = (wResCounts[r] || 0) + 1;
          }
        }
      }
      weekDietDistribution = Object.entries(wDietCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => ({ type, count }));
      weekRestrictionsList = Object.entries(wResCounts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
    }

    // Star dish (week)
    const starDishId = weekTopDishes[0]?.dishId;
    const starDish = starDishId && dishMap[starDishId]
      ? { name: dishMap[starDishId].name, count: (weekTopDishes[0] as any)._count.id, photo: dishMap[starDishId].photos?.[0] || null }
      : null;

    return NextResponse.json({
      // ── New period-based data (used by /admin dashboard) ──
      period,
      from: rangeFrom.toISOString(),
      to: rangeTo.toISOString(),
      totalSessions,
      uniqueGuests,
      avgDurationSec: durationCount > 0 ? Math.round(totalDuration / durationCount / 1000) : 0,
      birthdaysSaved,
      topDishesViewed: topDishesViewedPeriod.map(d => ({
        name: dishMap[d.dishId!]?.name || d.dishId,
        photo: dishMap[d.dishId!]?.photos?.[0] || null,
        count: d._count.id,
      })),
      viewDistribution: viewDist,
      deviceDistribution: deviceDist,
      dietDistribution,
      restrictionsList,
      genio: {
        starts: genioStartsPeriod,
        dietMarked: genioStepDietPeriod,
        completed: genioCompletePeriod,
        completionRate: genioStartsPeriod > 0 ? Math.round((genioCompletePeriod / genioStartsPeriod) * 100) : 0,
        dietRate: genioStartsPeriod > 0 ? Math.round((genioStepDietPeriod / genioStartsPeriod) * 100) : 0,
      },
      restaurantRanking: restaurantRankingRaw.map(r => ({
        name: restMap[r.restaurantId] || r.restaurantId,
        uniqueGuests: r.uniqueGuests,
      })),
      birthdaysByRestaurant: (birthdaysByRestaurantRaw as any[]).map((r: any) => ({
        name: restMap[r.restaurantId] || r.restaurantId,
        count: r._count.id,
      })),

      // ── Panel compat fields (always returned) ──
      todayScans: todaySessionCount,
      todayUniqueVisitors: todayUniqueRaw.length,
      todayBirthdays,
      genioToday,
      todayAvgDuration: Math.round((todayDurationAgg._avg?.durationMs || 0) / 1000),
      todayWaiterCalls,
      todayWaiterPending,
      visitsThisWeek,
      visitsLastWeek,
      visitsDelta: visitsLastWeek > 0 ? Math.round(((visitsThisWeek - visitsLastWeek) / visitsLastWeek) * 100) : null,
      weekBirthdays,
      genioUsedThisWeek,
      // Week genio funnel for panel
      weekGenio: {
        starts: weekGenioStarts,
        dietMarked: weekGenioDietCount,
        completed: weekGenioCompleteCount,
        completionRate: weekGenioStarts > 0 ? Math.round((weekGenioCompleteCount / weekGenioStarts) * 100) : 0,
        dietRate: weekGenioStarts > 0 ? Math.round((weekGenioDietCount / weekGenioStarts) * 100) : 0,
      },
      weekDietDistribution,
      weekRestrictionsList,
      avgSessionDuration: weekDurCount > 0 ? Math.round(weekTotalDur / weekDurCount / 1000) : 0,
      starDish,
      lastScanAt: lastScan?.startedAt || null,
      activePromos,
      topSearches: (topSearches as any[]).map((s: any) => ({ name: s.query || "—", count: s._count.id })),
      totalGuests: totalGuestsCount,
      registeredGuests: linkedGuestsCount,
      conversionRate: totalGuestsCount > 0 ? Math.round((linkedGuestsCount / totalGuestsCount) * 100) : 0,
    });
  } catch (e: any) {
    if (e.status === 400 || e.status === 403) return authErrorResponse(e);
    console.error("Dashboard error:", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
