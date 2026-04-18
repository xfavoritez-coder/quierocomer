import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function getOwnerRestaurantIds(): Promise<string[] | null> {
  const cookieStore = await cookies();
  const role = cookieStore.get("admin_role")?.value;
  const adminId = cookieStore.get("admin_id")?.value;
  if (!adminId) return null;
  if (role === "SUPERADMIN") return null; // null = all
  const owner = await prisma.restaurantOwner.findUnique({
    where: { id: adminId },
    include: { restaurants: { select: { id: true } } },
  });
  return owner?.restaurants.map((r) => r.id) || [];
}

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    if (!cookieStore.get("admin_token")?.value) {
      return NextResponse.json({ error: "Not auth" }, { status: 401 });
    }

    const url = new URL(req.url);
    const filterRestaurantId = url.searchParams.get("restaurantId");
    const ownerIds = await getOwnerRestaurantIds();

    // Build restaurant filter
    let restaurantFilter: any = {};
    if (filterRestaurantId) {
      // Specific restaurant selected
      if (ownerIds && !ownerIds.includes(filterRestaurantId)) {
        return NextResponse.json({ error: "No access" }, { status: 403 });
      }
      restaurantFilter = { restaurantId: filterRestaurantId };
    } else if (ownerIds) {
      // Owner without specific selection — all their restaurants
      restaurantFilter = { restaurantId: { in: ownerIds } };
    }
    // If ownerIds is null (superadmin) and no filter, no restriction

    const now = new Date();
    const weekAgo = daysAgo(7);
    const twoWeeksAgo = daysAgo(14);
    const monthAgo = daysAgo(30);

    // Run all queries in parallel
    const [
      visitsThisWeek,
      visitsLastWeek,
      totalGuests,
      linkedGuests,
      sessionsThisWeek,
      genioUsedThisWeek,
      topDishesViewed,
      topDishesGenio,
      dietDistribution,
      sessionEngagement,
      activeRestaurants,
      topRestaurants,
    ] = await Promise.all([
      // Visits this week (SESSION_START events)
      prisma.statEvent.count({
        where: { ...restaurantFilter, eventType: "SESSION_START", createdAt: { gte: weekAgo } },
      }),

      // Visits last week
      prisma.statEvent.count({
        where: { ...restaurantFilter, eventType: "SESSION_START", createdAt: { gte: twoWeeksAgo, lt: weekAgo } },
      }),

      // Total unique guests
      prisma.guestProfile.count({
        where: restaurantFilter.restaurantId
          ? { statEvents: { some: { restaurantId: restaurantFilter.restaurantId } } }
          : undefined,
      }),

      // Guests linked to QRUser (registered)
      prisma.guestProfile.count({
        where: {
          linkedQrUserId: { not: null },
          ...(restaurantFilter.restaurantId
            ? { statEvents: { some: { restaurantId: restaurantFilter.restaurantId } } }
            : {}),
        },
      }),

      // Sessions this week with details
      prisma.session.findMany({
        where: { ...restaurantFilter, startedAt: { gte: weekAgo } },
        select: { durationMs: true, isAbandoned: true, viewUsed: true, deviceType: true },
      }),

      // Genio used this week
      prisma.statEvent.count({
        where: { ...restaurantFilter, eventType: "GENIO_START", createdAt: { gte: weekAgo } },
      }),

      // Top 5 most viewed dishes
      prisma.statEvent.groupBy({
        by: ["dishId"],
        where: { ...restaurantFilter, eventType: "DISH_VIEW", dishId: { not: null }, createdAt: { gte: monthAgo } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),

      // Top 5 dishes recommended by Genio
      prisma.statEvent.groupBy({
        by: ["dishId"],
        where: { ...restaurantFilter, eventType: "GENIO_COMPLETE", dishId: { not: null }, createdAt: { gte: monthAgo } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),

      // Diet type distribution from QRUsers
      prisma.qRUser.groupBy({
        by: ["dietType"],
        where: { dietType: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),

      // Session engagement: active vs abandoned this week
      prisma.session.groupBy({
        by: ["isAbandoned"],
        where: { ...restaurantFilter, startedAt: { gte: weekAgo } },
        _count: { id: true },
      }),

      // Active restaurants (with activity last 30 days) — superadmin only
      !filterRestaurantId && !ownerIds
        ? prisma.statEvent.groupBy({
            by: ["restaurantId"],
            where: { createdAt: { gte: monthAgo } },
            _count: { id: true },
          })
        : Promise.resolve([]),

      // Top 5 restaurants by visits — superadmin only
      !filterRestaurantId && !ownerIds
        ? prisma.statEvent.groupBy({
            by: ["restaurantId"],
            where: { eventType: "SESSION_START", createdAt: { gte: weekAgo } },
            _count: { id: true },
            orderBy: { _count: { id: "desc" } },
            take: 5,
          })
        : Promise.resolve([]),
    ]);

    // Resolve dish names
    const dishIds = [...new Set([
      ...topDishesViewed.filter(d => d.dishId).map(d => d.dishId!),
      ...topDishesGenio.filter(d => d.dishId).map(d => d.dishId!),
    ])];
    const dishNames = dishIds.length
      ? await prisma.dish.findMany({ where: { id: { in: dishIds } }, select: { id: true, name: true } })
      : [];
    const dishMap = Object.fromEntries(dishNames.map(d => [d.id, d.name]));

    // Resolve restaurant names for superadmin
    const restIds = [...new Set([
      ...((activeRestaurants as any[]) || []).map((r: any) => r.restaurantId),
      ...((topRestaurants as any[]) || []).map((r: any) => r.restaurantId),
    ])];
    const restNames = restIds.length
      ? await prisma.restaurant.findMany({ where: { id: { in: restIds } }, select: { id: true, name: true } })
      : [];
    const restMap = Object.fromEntries(restNames.map(r => [r.id, r.name]));

    // Calculate view distribution
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
      avgSessionDuration: durationCount > 0 ? Math.round(totalDuration / durationCount / 1000) : 0, // seconds
      genioUsedThisWeek,
      viewDistribution: viewDist,
      deviceDistribution: deviceDist,
      topDishesViewed: topDishesViewed.map(d => ({ name: dishMap[d.dishId!] || d.dishId, count: d._count.id })),
      topDishesGenio: topDishesGenio.map(d => ({ name: dishMap[d.dishId!] || d.dishId, count: d._count.id })),
      dietDistribution: dietDistribution.map(d => ({ type: d.dietType || "Sin definir", count: d._count.id })),
      // Superadmin only
      activeRestaurantsCount: (activeRestaurants as any[]).length,
      topRestaurants: (topRestaurants as any[]).map((r: any) => ({ name: restMap[r.restaurantId] || r.restaurantId, visits: r._count.id })),
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
