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

// Build a Prisma-compatible restaurant filter fragment for raw SQL
function buildRestaurantSQL(restaurantFilter: any): { clause: string; values: string[] } {
  if (!restaurantFilter.restaurantId) return { clause: "", values: [] };
  if (typeof restaurantFilter.restaurantId === "string") {
    return { clause: `AND "restaurantId" = $RFILTER`, values: [restaurantFilter.restaurantId] };
  }
  if (restaurantFilter.restaurantId?.in) {
    const ids = restaurantFilter.restaurantId.in as string[];
    return { clause: `AND "restaurantId" = ANY($RFILTER::text[])`, values: ids };
  }
  return { clause: "", values: [] };
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
    const adminMode = url.searchParams.get("mode") === "admin";

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
    } else {
      // Superadmin sin filtro: todos los restaurantes con owner (excluye Google Maps/importados sin dueño)
      const realRestaurants = await prisma.restaurant.findMany({
        where: { ownerId: { not: null } },
        select: { id: true },
      });
      const realIds = realRestaurants.map((r) => r.id);
      restaurantFilter = { restaurantId: { in: realIds } };
    }

    const dateFilter = { gte: rangeFrom, lte: rangeTo };

    // Chile "today" + "week" boundaries
    const chileNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
    const ymd = `${chileNow.getFullYear()}-${String(chileNow.getMonth() + 1).padStart(2, "0")}-${String(chileNow.getDate()).padStart(2, "0")}`;
    const todayStart = new Date(ymd + "T00:00:00.000-04:00");
    const weekAgo = new Date(todayStart.getTime() - 7 * 86400000);
    const twoWeeksAgo = new Date(todayStart.getTime() - 14 * 86400000);

    // ── Admin-mode: only the queries needed for /admin/dashboard (fast) ──
    if (adminMode) {
      const [
        totalSessions,
        uniqueGuestsCount,
        birthdaysSaved,
        restaurantRankingRaw,
        birthdaysByRestaurantRaw,
        periodDurationAgg,
        filterUsageRaw,
      ] = await Promise.all([
        prisma.session.count({ where: { ...restaurantFilter, startedAt: dateFilter } }),
        prisma.session.groupBy({ by: ["guestId"], where: { ...restaurantFilter, startedAt: dateFilter }, _count: { id: true } }).then(r => r.length),
        prisma.statEvent.count({ where: { ...restaurantFilter, eventType: "BIRTHDAY_SAVED" as any, createdAt: dateFilter } }),
        prisma.session.groupBy({ by: ["restaurantId"], where: { ...restaurantFilter, startedAt: dateFilter }, _count: { guestId: true }, orderBy: { _count: { guestId: "desc" } }, take: 20 }),
        prisma.statEvent.groupBy({ by: ["restaurantId"], where: { ...restaurantFilter, eventType: "BIRTHDAY_SAVED" as any, createdAt: dateFilter }, _count: { id: true }, orderBy: { _count: { id: "desc" } } }),
        prisma.session.aggregate({ where: { ...restaurantFilter, startedAt: dateFilter, durationMs: { gt: 0 } }, _avg: { durationMs: true } }),
        prisma.statEvent.groupBy({ by: ["restaurantId", "query"], where: { ...restaurantFilter, eventType: "FILTER_APPLIED" as any, query: { in: ["popular", "estrella", "veggie"] }, createdAt: { gte: weekAgo } }, _count: { id: true } }),
      ]);

      const uniqueGuests = uniqueGuestsCount as number;
      const avgDurationSec = Math.round((periodDurationAgg._avg?.durationMs || 0) / 1000);

      // Resolve restaurant names
      const restIds = [...new Set([
        ...restaurantRankingRaw.map((r: any) => r.restaurantId),
        ...(birthdaysByRestaurantRaw as any[]).map((r: any) => r.restaurantId),
      ])];
      const restRecords = restIds.length ? await prisma.restaurant.findMany({ where: { id: { in: restIds } }, select: { id: true, name: true } }) : [];
      const restMap = Object.fromEntries(restRecords.map(r => [r.id, r.name]));

      // Filter usage
      const filterUsage: Record<string, number> = { popular: 0, estrella: 0, veggie: 0 };
      const filterByRestaurantMap: Record<string, { popular: number; estrella: number; veggie: number }> = {};
      for (const row of filterUsageRaw as any[]) {
        const fv = row.query as string | undefined;
        const rid = row.restaurantId as string | undefined;
        if (!fv || !(fv in filterUsage)) continue;
        filterUsage[fv] += row._count.id;
        if (rid) {
          if (!filterByRestaurantMap[rid]) filterByRestaurantMap[rid] = { popular: 0, estrella: 0, veggie: 0 };
          filterByRestaurantMap[rid][fv as "popular" | "estrella" | "veggie"] += row._count.id;
        }
      }
      const filterRestIds = Object.keys(filterByRestaurantMap).filter(id => !restMap[id]);
      const extraRests = filterRestIds.length ? await prisma.restaurant.findMany({ where: { id: { in: filterRestIds } }, select: { id: true, name: true } }) : [];
      for (const r of extraRests) restMap[r.id] = r.name;
      const filterUsageByRestaurant = Object.entries(filterByRestaurantMap)
        .map(([rid, counts]) => ({ name: restMap[rid] || rid, ...counts, total: counts.popular + counts.estrella + counts.veggie }))
        .sort((a, b) => b.total - a.total);

      return NextResponse.json({
        period, from: rangeFrom.toISOString(), to: rangeTo.toISOString(),
        totalSessions, uniqueGuests, avgDurationSec, birthdaysSaved,
        registeredGuests: 0, conversionRate: 0,
        topDishesViewed: [], viewDistribution: {}, deviceDistribution: {},
        dietDistribution: [], restrictionsList: [],
        genio: { starts: 0, dietMarked: 0, completed: 0, completionRate: 0, dietRate: 0 },
        restaurantRanking: restaurantRankingRaw.map((r: any) => ({ name: restMap[r.restaurantId] || r.restaurantId, uniqueGuests: r._count.guestId })),
        birthdaysByRestaurant: (birthdaysByRestaurantRaw as any[]).map((r: any) => ({ name: restMap[r.restaurantId] || r.restaurantId, count: r._count.id })),
        filterUsage, filterUsageByRestaurant,
      });
    }

    // ── Full mode: all queries (for /panel/dashboard) ──
    const [
      // Period-based
      totalSessions,
      uniqueGuestsCount,
      viewDeviceDistRaw,
      birthdaysSaved,
      topDishesViewedPeriod,
      genioStartsPeriod,
      genioStepDietPeriod,
      genioCompletePeriod,
      restaurantRankingRaw,
      genioGuestIdsRaw,
      birthdaysByRestaurantRaw,
      // Panel: today
      todaySessionCount,
      todayUniqueCount,
      todayBirthdays,
      genioToday,
      todayDurationAgg,
      todayWaiterCalls,
      todayWaiterPending,
      // Panel: week
      visitsThisWeek,
      visitsLastWeek,
      weekBirthdays,
      genioUsedThisWeek,
      weekTopDishes,
      weekAvgDuration,
      weekGenioDiet,
      weekGenioComplete,
      weekGenioGuestIdsRaw,
      // Misc
      lastScan,
      activePromos,
      topSearches,
      // Period avg duration
      periodDurationAgg,
      // Filter usage week
      filterUsageRaw,
    ] = await Promise.all([
      // ── Period-based (using groupBy/count/aggregate instead of findMany) ──
      prisma.session.count({ where: { ...restaurantFilter, startedAt: dateFilter } }),
      // Unique guests: groupBy guestId then count length (avoids fetching all rows)
      prisma.session.groupBy({
        by: ["guestId"],
        where: { ...restaurantFilter, startedAt: dateFilter },
        _count: { id: true },
      }).then(rows => rows.length),
      // View + device distribution via groupBy (replaces fetching 10k rows)
      prisma.session.groupBy({
        by: ["viewUsed", "deviceType"],
        where: { ...restaurantFilter, startedAt: dateFilter },
        _count: { id: true },
      }),
      prisma.statEvent.count({ where: { ...restaurantFilter, eventType: "BIRTHDAY_SAVED" as any, createdAt: dateFilter } }),
      prisma.statEvent.groupBy({ by: ["dishId"], where: { ...restaurantFilter, eventType: "DISH_VIEW", dishId: { not: null }, createdAt: dateFilter }, _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 10 }),
      prisma.statEvent.count({ where: { ...restaurantFilter, eventType: "GENIO_START", createdAt: dateFilter } }),
      prisma.statEvent.count({ where: { ...restaurantFilter, eventType: "GENIO_STEP_RESTRICTIONS" as any, createdAt: dateFilter } }),
      prisma.statEvent.count({ where: { ...restaurantFilter, eventType: "GENIO_COMPLETE", createdAt: dateFilter } }),
      // Restaurant ranking: groupBy + count distinct via groupBy (replaces 50k row fetch)
      prisma.session.groupBy({
        by: ["restaurantId"],
        where: { ...restaurantFilter, startedAt: dateFilter },
        _count: { guestId: true },
        orderBy: { _count: { guestId: "desc" } },
        take: 20,
      }),
      // All genio guest IDs in period (complete + restrictions) — single query
      prisma.statEvent.findMany({
        where: { ...restaurantFilter, eventType: { in: ["GENIO_COMPLETE", "GENIO_STEP_RESTRICTIONS"] as any }, createdAt: dateFilter },
        select: { guestId: true, eventType: true },
        take: 5000,
      }),
      prisma.statEvent.groupBy({ by: ["restaurantId"], where: { ...restaurantFilter, eventType: "BIRTHDAY_SAVED" as any, createdAt: dateFilter }, _count: { id: true }, orderBy: { _count: { id: "desc" } } }),

      // ── Panel: today ──
      prisma.session.count({ where: { ...restaurantFilter, startedAt: { gte: todayStart } } }),
      prisma.session.groupBy({ by: ["guestId"], where: { ...restaurantFilter, startedAt: { gte: todayStart } }, _count: { id: true } }).then(r => r.length),
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
      prisma.session.aggregate({ where: { ...restaurantFilter, startedAt: { gte: weekAgo }, durationMs: { gt: 0 } }, _avg: { durationMs: true } }),
      prisma.statEvent.count({ where: { ...restaurantFilter, eventType: "GENIO_STEP_RESTRICTIONS" as any, createdAt: { gte: weekAgo } } }),
      prisma.statEvent.count({ where: { ...restaurantFilter, eventType: "GENIO_COMPLETE", createdAt: { gte: weekAgo } } }),
      prisma.statEvent.findMany({ where: { ...restaurantFilter, eventType: { in: ["GENIO_COMPLETE"] as any }, createdAt: { gte: weekAgo } }, select: { guestId: true }, take: 2000 }),

      // ── Misc ──
      prisma.session.findFirst({ where: restaurantFilter, orderBy: { startedAt: "desc" }, select: { startedAt: true } }),
      prisma.promotion.count({ where: { ...restaurantFilter, status: "ACTIVE" } }),
      prisma.statEvent.groupBy({ by: ["query"], where: { ...restaurantFilter, eventType: "SEARCH_PERFORMED" as any, query: { not: null }, createdAt: { gte: weekAgo } }, _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 5 }),
      // Period avg duration (via aggregate, not fetching 10k rows)
      prisma.session.aggregate({ where: { ...restaurantFilter, startedAt: dateFilter, durationMs: { gt: 0 } }, _avg: { durationMs: true } }),
      // Filter usage this week (popular, estrella/recomendados, veggie) — grouped by restaurantId + filter
      prisma.statEvent.groupBy({ by: ["restaurantId", "query"], where: { ...restaurantFilter, eventType: "FILTER_APPLIED" as any, query: { in: ["popular", "estrella", "veggie"] }, createdAt: { gte: weekAgo } }, _count: { id: true } }),
    ]);

    const uniqueGuests = uniqueGuestsCount as number;

    // Build view + device distributions from groupBy (no 10k row fetch needed)
    const viewDist: Record<string, number> = {};
    const deviceDist: Record<string, number> = {};
    for (const row of viewDeviceDistRaw) {
      if (row.viewUsed) viewDist[row.viewUsed] = (viewDist[row.viewUsed] || 0) + row._count.id;
      if (row.deviceType) deviceDist[row.deviceType] = (deviceDist[row.deviceType] || 0) + row._count.id;
    }

    // Collect all dish IDs for name resolution (period + week in one batch)
    const allDishIds = [...new Set([
      ...topDishesViewedPeriod.filter(d => d.dishId).map(d => d.dishId!),
      ...weekTopDishes.filter((d: any) => d.dishId).map((d: any) => d.dishId!),
    ])];

    // Collect all restaurant IDs for name resolution
    const restIds = [...new Set([
      ...restaurantRankingRaw.map((r: any) => r.restaurantId),
      ...(birthdaysByRestaurantRaw as any[]).map((r: any) => r.restaurantId),
    ])];

    // Collect all genio guest IDs (period + week combined)
    const periodCompleteGuestIds = new Set<string>();
    const periodRestrictionGuestIds = new Set<string>();
    for (const e of genioGuestIdsRaw as any[]) {
      if (!e.guestId) continue;
      if (e.eventType === "GENIO_COMPLETE") periodCompleteGuestIds.add(e.guestId);
      if (e.eventType === "GENIO_STEP_RESTRICTIONS") periodRestrictionGuestIds.add(e.guestId);
    }
    const weekGenioGuestIds = [...new Set((weekGenioGuestIdsRaw as any[]).filter(e => e.guestId).map(e => e.guestId))];
    const allGenioGuestIds = [...new Set([...periodCompleteGuestIds, ...periodRestrictionGuestIds, ...weekGenioGuestIds])];

    // ── Second parallel batch: resolve names (dish, restaurant, guest profiles) ──
    const [dishRecords, restRecords, guestProfiles] = await Promise.all([
      allDishIds.length
        ? prisma.dish.findMany({ where: { id: { in: allDishIds } }, select: { id: true, name: true, photos: true } })
        : [],
      restIds.length
        ? prisma.restaurant.findMany({ where: { id: { in: restIds } }, select: { id: true, name: true } })
        : [],
      allGenioGuestIds.length
        ? prisma.guestProfile.findMany({ where: { id: { in: allGenioGuestIds } }, select: { id: true, preferences: true } })
        : [],
    ]);

    const dishMap = Object.fromEntries(dishRecords.map(d => [d.id, d]));
    const restMap = Object.fromEntries(restRecords.map(r => [r.id, r.name]));
    const guestMap = Object.fromEntries(guestProfiles.map(g => [g.id, g.preferences]));

    // Period diet/restrictions distribution
    const dietCounts: Record<string, number> = {};
    const restrictionCounts: Record<string, number> = {};
    for (const gid of [...periodCompleteGuestIds, ...periodRestrictionGuestIds]) {
      const prefs = guestMap[gid] as any;
      if (!prefs) continue;
      if (prefs.dietType) dietCounts[prefs.dietType] = (dietCounts[prefs.dietType] || 0) + 1;
      if (Array.isArray(prefs.restrictions)) {
        for (const r of prefs.restrictions) {
          if (r && r !== "ninguna") restrictionCounts[r] = (restrictionCounts[r] || 0) + 1;
        }
      }
    }
    const dietDistribution = Object.entries(dietCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => ({ type, count }));
    const restrictionsList = Object.entries(restrictionCounts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));

    // Week diet/restrictions distribution (reuses same guestMap)
    const wDietCounts: Record<string, number> = {};
    const wResCounts: Record<string, number> = {};
    for (const gid of weekGenioGuestIds) {
      const prefs = guestMap[gid] as any;
      if (!prefs) continue;
      if (prefs.dietType) wDietCounts[prefs.dietType] = (wDietCounts[prefs.dietType] || 0) + 1;
      if (Array.isArray(prefs.restrictions)) {
        for (const r of prefs.restrictions) {
          if (r && r !== "ninguna") wResCounts[r] = (wResCounts[r] || 0) + 1;
        }
      }
    }
    const weekDietDistribution = Object.entries(wDietCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => ({ type, count }));
    const weekRestrictionsList = Object.entries(wResCounts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));

    // Star dish (week)
    const starDishId = weekTopDishes[0]?.dishId;
    const starDish = starDishId && dishMap[starDishId]
      ? { name: dishMap[starDishId].name, count: (weekTopDishes[0] as any)._count.id, photo: dishMap[starDishId].photos?.[0] || null }
      : null;

    const avgDurationSec = Math.round((periodDurationAgg._avg?.durationMs || 0) / 1000);

    // Aggregate filter clicks by restaurant + query field (popular | estrella | veggie)
    const filterUsage: Record<string, number> = { popular: 0, estrella: 0, veggie: 0 };
    const filterByRestaurantMap: Record<string, { popular: number; estrella: number; veggie: number }> = {};
    for (const row of filterUsageRaw as any[]) {
      const fv = row.query as string | undefined;
      const rid = row.restaurantId as string | undefined;
      if (!fv || !(fv in filterUsage)) continue;
      filterUsage[fv] += row._count.id;
      if (rid) {
        if (!filterByRestaurantMap[rid]) filterByRestaurantMap[rid] = { popular: 0, estrella: 0, veggie: 0 };
        filterByRestaurantMap[rid][fv as "popular" | "estrella" | "veggie"] += row._count.id;
      }
    }
    // Collect restaurant IDs from filter usage that may not be in restMap yet
    const filterRestIds = Object.keys(filterByRestaurantMap).filter(id => !restMap[id]);
    const extraRests = filterRestIds.length
      ? await prisma.restaurant.findMany({ where: { id: { in: filterRestIds } }, select: { id: true, name: true } })
      : [];
    for (const r of extraRests) restMap[r.id] = r.name;
    const filterUsageByRestaurant = Object.entries(filterByRestaurantMap)
      .map(([rid, counts]) => ({ name: restMap[rid] || rid, ...counts, total: counts.popular + counts.estrella + counts.veggie }))
      .sort((a, b) => b.total - a.total);
    const weekAvgDurationSec = Math.round((weekAvgDuration._avg?.durationMs || 0) / 1000);

    return NextResponse.json({
      // ── Period-based data ──
      period,
      from: rangeFrom.toISOString(),
      to: rangeTo.toISOString(),
      totalSessions,
      uniqueGuests,
      avgDurationSec,
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
      restaurantRanking: restaurantRankingRaw.map((r: any) => ({
        name: restMap[r.restaurantId] || r.restaurantId,
        uniqueGuests: r._count.guestId,
      })),
      birthdaysByRestaurant: (birthdaysByRestaurantRaw as any[]).map((r: any) => ({
        name: restMap[r.restaurantId] || r.restaurantId,
        count: r._count.id,
      })),

      // ── Panel compat fields ──
      todayScans: todaySessionCount,
      todayUniqueVisitors: todayUniqueCount,
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
      weekGenio: {
        starts: genioUsedThisWeek,
        dietMarked: weekGenioDiet as number,
        completed: weekGenioComplete as number,
        completionRate: genioUsedThisWeek > 0 ? Math.round(((weekGenioComplete as number) / genioUsedThisWeek) * 100) : 0,
        dietRate: genioUsedThisWeek > 0 ? Math.round(((weekGenioDiet as number) / genioUsedThisWeek) * 100) : 0,
      },
      weekDietDistribution,
      weekRestrictionsList,
      avgSessionDuration: weekAvgDurationSec,
      starDish,
      lastScanAt: lastScan?.startedAt || null,
      activePromos,
      topSearches: (topSearches as any[]).map((s: any) => ({ name: s.query || "—", count: s._count.id })),
      totalGuests: uniqueGuests,
      registeredGuests: 0,
      conversionRate: 0,
      filterUsage,
      filterUsageByRestaurant,
    });
  } catch (e: any) {
    if (e.status === 400 || e.status === 403) return authErrorResponse(e);
    console.error("Dashboard error:", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
