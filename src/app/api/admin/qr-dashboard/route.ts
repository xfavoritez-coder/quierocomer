import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || undefined;
  const days = Number(req.nextUrl.searchParams.get("days") || "30");
  const since = new Date(Date.now() - days * 86400000);

  try {
    const eventWhere: any = {
      createdAt: { gte: since },
      ...(restaurantId ? { restaurantId } : {}),
    };

    // Total registered users
    const totalUsers = await prisma.qRUser.count();
    const newUsers = await prisma.qRUser.count({ where: { createdAt: { gte: since } } });
    const verifiedUsers = await prisma.qRUser.count({ where: { verifiedAt: { not: null } } });

    // Session stats
    const sessionEventCounts = await prisma.statEvent.groupBy({
      by: ["eventType"],
      where: { ...eventWhere, eventType: { in: ["SESSION_START", "DISH_VIEW", "GENIO_START", "RECOMMENDATION_SHOWN", "PROMO_VIEWED", "DISH_FAVORITED"] as any[] } },
      _count: { _all: true },
    });
    const eventMap: Record<string, number> = {};
    for (const e of sessionEventCounts) eventMap[e.eventType as string] = e._count._all;

    // Top viewed dishes (DISH_VIEW events)
    const dishViewEvents = await prisma.statEvent.findMany({
      where: { ...eventWhere, eventType: "DISH_VIEW" as any },
      select: { metadata: true },
      take: 1000,
    });
    const dishViews = new Map<string, { name: string; count: number }>();
    for (const e of dishViewEvents) {
      const meta = e.metadata as any;
      const name: string = meta?.dishName || meta?.name || "?";
      if (name === "?") continue;
      if (!dishViews.has(name)) dishViews.set(name, { name, count: 0 });
      dishViews.get(name)!.count++;
    }
    const topViewedDishes = Array.from(dishViews.values()).sort((a, b) => b.count - a.count).slice(0, 10);

    // Peak hours (SESSION_START)
    const sessionEvents = await prisma.statEvent.findMany({
      where: { ...eventWhere, eventType: "SESSION_START" as any },
      select: { createdAt: true },
      take: 5000,
    });
    const hourCounts = new Array(24).fill(0);
    for (const e of sessionEvents) hourCounts[new Date(e.createdAt).getHours()]++;
    const peakHours = hourCounts.map((count, hour) => ({ hour, count }));

    // Visits by day
    const byDay = new Map<string, number>();
    for (const e of sessionEvents) {
      const day = new Date(e.createdAt).toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) || 0) + 1);
    }
    const visitsChart = Array.from(byDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));

    // Diet preferences
    const dietCounts = await prisma.qRUser.groupBy({
      by: ["dietType"],
      _count: { _all: true },
      where: { dietType: { not: null } },
    });

    return NextResponse.json({
      period: { days, since },
      users: { total: totalUsers, new: newUsers, verified: verifiedUsers },
      events: {
        menuViews: eventMap["MENU_VIEW"] || 0,
        dishViews: eventMap["DISH_VIEW"] || 0,
        genioSessions: eventMap["GENIO_SESSION_START"] || 0,
        genioRecommendations: eventMap["GENIO_RECOMMENDATION"] || 0,
        promoViews: eventMap["PROMO_VIEW"] || 0,
        reviews: eventMap["REVIEW_SUBMIT"] || 0,
      },
      topViewedDishes,
      peakHours,
      visitsChart,
      dietPreferences: dietCounts.map(d => ({ diet: d.dietType, count: d._count._all })),
    });
  } catch (e) {
    console.error("[qr-dashboard]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
