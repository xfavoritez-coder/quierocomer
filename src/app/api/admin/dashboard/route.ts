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

    const [
      totalSessions,
      totalGuests,
      registeredGuests,
      sessions,
      birthdaysSaved,
      topDishesViewed,
      dietDistribution,
      genioStarts,
      genioStepDiet,
      genioComplete,
      restrictionsRaw,
      sessionsByRestaurant,
    ] = await Promise.all([
      // Total sessions in period
      prisma.session.count({
        where: { ...restaurantFilter, startedAt: dateFilter },
      }),
      // Unique guests in period
      prisma.session.findMany({
        where: { ...restaurantFilter, startedAt: dateFilter },
        select: { guestId: true },
        distinct: ["guestId"],
      }),
      // Registered guests (linked)
      prisma.guestProfile.count({
        where: {
          linkedQrUserId: { not: null },
          ...(restaurantFilter.restaurantId
            ? {
                statEvents: {
                  some: {
                    ...(typeof restaurantFilter.restaurantId === "string"
                      ? { restaurantId: restaurantFilter.restaurantId }
                      : { restaurantId: restaurantFilter.restaurantId }),
                    createdAt: dateFilter,
                  },
                },
              }
            : { statEvents: { some: { createdAt: dateFilter } } }),
        },
      }),
      // Sessions with details for duration/device/view
      prisma.session.findMany({
        where: { ...restaurantFilter, startedAt: dateFilter },
        select: { durationMs: true, deviceType: true, viewUsed: true },
        take: 10000,
      }),
      // Birthdays saved
      prisma.statEvent.count({
        where: { ...restaurantFilter, eventType: "BIRTHDAY_SAVED" as any, createdAt: dateFilter },
      }),
      // Top dishes viewed
      prisma.statEvent.groupBy({
        by: ["dishId"],
        where: { ...restaurantFilter, eventType: "DISH_VIEW", dishId: { not: null }, createdAt: dateFilter },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),
      // Diet distribution from QRUser
      prisma.qRUser.groupBy({
        by: ["dietType"],
        where: { dietType: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),
      // Genio funnel: starts
      prisma.statEvent.count({
        where: { ...restaurantFilter, eventType: "GENIO_START", createdAt: dateFilter },
      }),
      // Genio funnel: diet step
      prisma.statEvent.count({
        where: { ...restaurantFilter, eventType: "GENIO_STEP_DIET" as any, createdAt: dateFilter },
      }),
      // Genio funnel: complete
      prisma.statEvent.count({
        where: { ...restaurantFilter, eventType: "GENIO_COMPLETE", createdAt: dateFilter },
      }),
      // Restrictions from QRUser
      prisma.qRUser.findMany({
        where: { restrictions: { isEmpty: false } },
        select: { restrictions: true },
      }),
      // Sessions by restaurant (ranking)
      prisma.session.groupBy({
        by: ["restaurantId"],
        where: { ...restaurantFilter, startedAt: dateFilter },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 20,
      }),
    ]);

    // Resolve dish names
    const dishIds = topDishesViewed.filter(d => d.dishId).map(d => d.dishId!);
    const dishRecords = dishIds.length
      ? await prisma.dish.findMany({ where: { id: { in: dishIds } }, select: { id: true, name: true, photos: true } })
      : [];
    const dishMap = Object.fromEntries(dishRecords.map(d => [d.id, d]));

    // Resolve restaurant names
    const restIds = sessionsByRestaurant.map((r: any) => r.restaurantId);
    const restRecords = restIds.length
      ? await prisma.restaurant.findMany({ where: { id: { in: restIds } }, select: { id: true, name: true } })
      : [];
    const restMap = Object.fromEntries(restRecords.map(r => [r.id, r.name]));

    // Compute averages
    let totalDuration = 0;
    let durationCount = 0;
    const viewDist: Record<string, number> = {};
    const deviceDist: Record<string, number> = {};
    for (const s of sessions) {
      if (s.durationMs && s.durationMs > 0) { totalDuration += s.durationMs; durationCount++; }
      if (s.viewUsed) viewDist[s.viewUsed] = (viewDist[s.viewUsed] || 0) + 1;
      if (s.deviceType) deviceDist[s.deviceType] = (deviceDist[s.deviceType] || 0) + 1;
    }

    // Aggregate restrictions
    const restrictionCounts: Record<string, number> = {};
    for (const u of restrictionsRaw) {
      for (const r of u.restrictions) {
        if (r && r !== "ninguna") restrictionCounts[r] = (restrictionCounts[r] || 0) + 1;
      }
    }
    const restrictionsList = Object.entries(restrictionCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    const uniqueGuests = totalGuests.length;
    const conversionRate = uniqueGuests > 0 ? Math.round((registeredGuests / uniqueGuests) * 100) : 0;
    const avgDurationSec = durationCount > 0 ? Math.round(totalDuration / durationCount / 1000) : 0;

    return NextResponse.json({
      period,
      from: rangeFrom.toISOString(),
      to: rangeTo.toISOString(),

      // Main metrics
      totalSessions,
      uniqueGuests,
      registeredGuests,
      conversionRate,
      avgDurationSec,
      birthdaysSaved,

      // Dishes
      topDishesViewed: topDishesViewed.map(d => ({
        name: dishMap[d.dishId!]?.name || d.dishId,
        photo: dishMap[d.dishId!]?.photos?.[0] || null,
        count: d._count.id,
      })),

      // Distributions
      viewDistribution: viewDist,
      deviceDistribution: deviceDist,
      dietDistribution: dietDistribution.map(d => ({
        type: d.dietType || "Sin definir",
        count: d._count.id,
      })),
      restrictionsList,

      // Genio funnel
      genio: {
        starts: genioStarts,
        dietMarked: genioStepDiet,
        completed: genioComplete,
        completionRate: genioStarts > 0 ? Math.round((genioComplete / genioStarts) * 100) : 0,
        dietRate: genioStarts > 0 ? Math.round((genioStepDiet / genioStarts) * 100) : 0,
      },

      // Restaurant ranking
      restaurantRanking: sessionsByRestaurant.map((r: any) => ({
        name: restMap[r.restaurantId] || r.restaurantId,
        sessions: r._count.id,
      })),
    });
  } catch (e: any) {
    if (e.status === 400 || e.status === 403) return authErrorResponse(e);
    console.error("Dashboard error:", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
