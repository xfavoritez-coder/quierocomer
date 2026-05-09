import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  checkAdminAuth,
  isSuperAdmin,
  getOwnedRestaurantIds,
  requireRestaurantForOwner,
  authErrorResponse,
} from "@/lib/adminAuth";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const url = new URL(req.url);
    const filterRestaurantId = url.searchParams.get("restaurantId");

    // For owners without a specific filter, use all their restaurants
    // For superadmin, allow global view
    let restaurantFilter: any = {};
    const isSuper = isSuperAdmin(req);

    if (filterRestaurantId) {
      // Validate ownership if not superadmin
      await requireRestaurantForOwner(req, filterRestaurantId);
      restaurantFilter = { restaurantId: filterRestaurantId };
    } else if (!isSuper) {
      // Owner without specific selection — all their restaurants
      const ownerIds = await getOwnedRestaurantIds(req);
      if (!ownerIds || ownerIds.length === 0) {
        return NextResponse.json({ error: "No tienes restaurantes asignados" }, { status: 403 });
      }
      restaurantFilter = { restaurantId: { in: ownerIds } };
    }
    // If superadmin and no filter, no restriction

    // Use Chile timezone for "today" boundaries
    const chileNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
    const chileDateStr = `${chileNow.getFullYear()}-${String(chileNow.getMonth()+1).padStart(2,"0")}-${String(chileNow.getDate()).padStart(2,"0")}`;
    const todayStart = new Date(chileDateStr + "T00:00:00.000-04:00");
    const weekAgo = new Date(todayStart.getTime() - 7 * 86400000);
    const twoWeeksAgo = new Date(todayStart.getTime() - 14 * 86400000);
    const monthAgo = new Date(todayStart.getTime() - 30 * 86400000);

    const [
      visitsThisWeek,
      visitsLastWeek,
      totalGuests,
      linkedGuests,
      sessionsThisWeek,
      genioUsedThisWeek,
      topDishesViewed,
      sessionsForDetailTime,
      dietDistribution,
      sessionEngagement,
      activeRestaurants,
      topRestaurants,
      todayScans,
      todayWaiterCalls,
      todayWaiterPending,
      lastScan,
      activePromos,
      weekDetailViews,
      weekWaiterCalls,
      uniqueVisitorsToday,
      weekBirthdays,
      genioToday,
      todayBirthdays,
      todayDurationAgg,
      topSearches,
    ] = await Promise.all([
      prisma.statEvent.count({
        where: { ...restaurantFilter, eventType: "SESSION_START", createdAt: { gte: weekAgo } },
      }),
      prisma.statEvent.count({
        where: { ...restaurantFilter, eventType: "SESSION_START", createdAt: { gte: twoWeeksAgo, lt: weekAgo } },
      }),
      prisma.guestProfile.count({
        where: restaurantFilter.restaurantId
          ? { statEvents: { some: { restaurantId: typeof restaurantFilter.restaurantId === "string" ? restaurantFilter.restaurantId : undefined, ...(restaurantFilter.restaurantId?.in ? { restaurantId: { in: restaurantFilter.restaurantId.in } } : {}) } } }
          : undefined,
      }),
      prisma.guestProfile.count({
        where: {
          linkedQrUserId: { not: null },
          ...(restaurantFilter.restaurantId
            ? { statEvents: { some: { restaurantId: typeof restaurantFilter.restaurantId === "string" ? restaurantFilter.restaurantId : undefined } } }
            : {}),
        },
      }),
      prisma.session.findMany({
        where: { ...restaurantFilter, startedAt: { gte: weekAgo } },
        select: { durationMs: true, isAbandoned: true, viewUsed: true, deviceType: true },
      }),
      prisma.statEvent.count({
        where: { ...restaurantFilter, eventType: "GENIO_START", createdAt: { gte: weekAgo } },
      }),
      prisma.statEvent.groupBy({
        by: ["dishId"],
        where: { ...restaurantFilter, eventType: "DISH_VIEW", dishId: { not: null }, createdAt: { gte: weekAgo } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),
      // (placeholder — sessionsForDetailTime no longer used)
      Promise.resolve([]),
      prisma.qRUser.groupBy({
        by: ["dietType"],
        where: { dietType: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),
      prisma.session.groupBy({
        by: ["isAbandoned"],
        where: { ...restaurantFilter, startedAt: { gte: weekAgo } },
        _count: { id: true },
      }),
      // Active restaurants — superadmin only
      isSuper && !filterRestaurantId
        ? prisma.statEvent.groupBy({
            by: ["restaurantId"],
            where: { createdAt: { gte: monthAgo } },
            _count: { id: true },
          })
        : Promise.resolve([]),
      // Top 5 restaurants — superadmin only
      isSuper && !filterRestaurantId
        ? prisma.statEvent.groupBy({
            by: ["restaurantId"],
            where: { eventType: "SESSION_START", createdAt: { gte: weekAgo } },
            _count: { id: true },
            orderBy: { _count: { id: "desc" } },
            take: 5,
          })
        : Promise.resolve([]),
      // ── Owner-relevant KPIs ──
      // Today's sessions (use Session table, not SESSION_START events, for consistency with analytics)
      prisma.session.count({
        where: { ...restaurantFilter, startedAt: { gte: todayStart } },
      }),
      // Today's waiter calls (answered)
      prisma.waiterCall.count({
        where: { ...restaurantFilter, calledAt: { gte: todayStart }, answeredAt: { not: null } },
      }),
      // Today's waiter calls (pending)
      prisma.waiterCall.count({
        where: { ...restaurantFilter, calledAt: { gte: todayStart }, answeredAt: null },
      }),
      // Last scan timestamp
      prisma.session.findFirst({
        where: restaurantFilter,
        orderBy: { startedAt: "desc" },
        select: { startedAt: true },
      }),
      // Active promotions count
      prisma.promotion.count({
        where: { ...restaurantFilter, status: "ACTIVE" },
      }),
      // Detail modal opens this week (DISH_VIEW = popup opened)
      prisma.statEvent.count({
        where: { ...restaurantFilter, eventType: "DISH_VIEW", createdAt: { gte: weekAgo } },
      }),
      // Waiter calls this week
      prisma.waiterCall.count({
        where: { ...restaurantFilter, calledAt: { gte: weekAgo } },
      }),
      // Today's unique visitors (distinct guestId in sessions)
      prisma.session.findMany({
        where: { ...restaurantFilter, startedAt: { gte: todayStart } },
        select: { guestId: true },
        distinct: ["guestId"],
      }),
      // Birthdays saved this week
      prisma.statEvent.count({
        where: { ...restaurantFilter, eventType: "BIRTHDAY_SAVED" as any, createdAt: { gte: weekAgo } },
      }),
      // Genio used today
      prisma.statEvent.count({
        where: { ...restaurantFilter, eventType: "GENIO_START", createdAt: { gte: todayStart } },
      }),
      // Birthdays saved today
      prisma.statEvent.count({
        where: { ...restaurantFilter, eventType: "BIRTHDAY_SAVED" as any, createdAt: { gte: todayStart } },
      }),
      // Today's avg session duration
      prisma.session.aggregate({
        where: { ...restaurantFilter, startedAt: { gte: todayStart }, durationMs: { gt: 0 } },
        _avg: { durationMs: true },
      }),
      // Top searches this week
      prisma.statEvent.groupBy({
        by: ["query"],
        where: { ...restaurantFilter, eventType: "SEARCH_PERFORMED" as any, query: { not: null }, createdAt: { gte: weekAgo } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),
    ]);

    // Resolve dish names
    const dishIds = [...new Set(
      topDishesViewed.filter((d) => d.dishId).map((d) => d.dishId!),
    )];
    const dishRecords = dishIds.length
      ? await prisma.dish.findMany({ where: { id: { in: dishIds } }, select: { id: true, name: true, photos: true } })
      : [];
    const dishMap = Object.fromEntries(dishRecords.map((d) => [d.id, d.name]));
    const dishPhotoMap = Object.fromEntries(dishRecords.map((d) => [d.id, d.photos?.[0] || null]));

    // Resolve restaurant names for superadmin
    const restIds = [...new Set([
      ...((activeRestaurants as any[]) || []).map((r: any) => r.restaurantId),
      ...((topRestaurants as any[]) || []).map((r: any) => r.restaurantId),
    ])];
    const restNames = restIds.length
      ? await prisma.restaurant.findMany({ where: { id: { in: restIds } }, select: { id: true, name: true } })
      : [];
    const restMap = Object.fromEntries(restNames.map((r) => [r.id, r.name]));

    // Calculate distributions
    const viewDist: Record<string, number> = {};
    const deviceDist: Record<string, number> = {};
    let totalDuration = 0;
    let durationCount = 0;
    for (const s of sessionsThisWeek) {
      if (s.viewUsed) viewDist[s.viewUsed] = (viewDist[s.viewUsed] || 0) + 1;
      if (s.deviceType) deviceDist[s.deviceType] = (deviceDist[s.deviceType] || 0) + 1;
      if (s.durationMs) { totalDuration += s.durationMs; durationCount++; }
    }

    const abandoned = sessionEngagement.find((s: any) => s.isAbandoned)?._count?.id || 0;
    const active = sessionEngagement.find((s: any) => !s.isAbandoned)?._count?.id || 0;

    return NextResponse.json({
      visitsThisWeek,
      visitsLastWeek,
      visitsDelta: visitsLastWeek > 0 ? Math.round(((visitsThisWeek - visitsLastWeek) / visitsLastWeek) * 100) : null,
      totalGuests,
      registeredGuests: linkedGuests,
      conversionRate: totalGuests > 0 ? Math.round((linkedGuests / totalGuests) * 100) : 0,
      avgSessionDuration: durationCount > 0 ? Math.round(totalDuration / durationCount / 1000) : 0,
      genioUsedThisWeek,
      viewDistribution: viewDist,
      deviceDistribution: deviceDist,
      topDishesViewed: topDishesViewed.map((d) => ({ name: dishMap[d.dishId!] || d.dishId, count: d._count.id, photo: dishPhotoMap[d.dishId!] || null })),
      starDish: topDishesViewed[0] ? { name: dishMap[topDishesViewed[0].dishId!] || "—", count: topDishesViewed[0]._count.id, photo: dishPhotoMap[topDishesViewed[0].dishId!] || null } : null,
      topDishesByDetailTime: [],
      dietDistribution: dietDistribution.map((d) => ({ type: d.dietType || "Sin definir", count: d._count.id })),
      abandonedThisWeek: abandoned,
      activeThisWeek: active,
      activeRestaurantsCount: (activeRestaurants as any[]).length,
      topRestaurants: (topRestaurants as any[]).map((r: any) => ({ name: restMap[r.restaurantId] || r.restaurantId, visits: r._count.id })),
      // Owner KPIs
      todayScans,
      todayWaiterCalls,
      todayWaiterPending,
      lastScanAt: lastScan?.startedAt || null,
      activePromos,
      weekDetailViews,
      weekWaiterCalls,
      todayUniqueVisitors: uniqueVisitorsToday.length,
      genioToday,
      todayBirthdays,
      todayAvgDuration: Math.round((todayDurationAgg._avg?.durationMs || 0) / 1000),
      weekBirthdays,
      topSearches: (topSearches as any[]).map((s: any) => ({ name: s.query || "—", count: s._count.id })),
    });
  } catch (e: any) {
    if (e.status === 400 || e.status === 403) return authErrorResponse(e);
    console.error("Dashboard error:", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
