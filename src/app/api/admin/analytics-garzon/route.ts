import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, requireRestaurantForOwner, authErrorResponse, isSuperAdmin } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  const allRestaurants = req.nextUrl.searchParams.get("all") === "true" && isSuperAdmin(req);

  try {
    if (!allRestaurants && restaurantId) {
      await requireRestaurantForOwner(req, restaurantId);
    }

    // Use Chile timezone for "today" calculation
    const chileNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
    const todayStart = new Date(chileNow.getFullYear(), chileNow.getMonth(), chileNow.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(todayStart);
    monthStart.setDate(monthStart.getDate() - 30);

    const where = allRestaurants ? {} : restaurantId ? { restaurantId } : {};

    // All calls this month
    const calls = await prisma.waiterCall.findMany({
      where: { ...where, calledAt: { gte: monthStart } },
      orderBy: { calledAt: "desc" },
      select: {
        id: true,
        tableName: true,
        calledAt: true,
        answeredAt: true,
        restaurantId: true,
        restaurant: { select: { name: true } },
      },
    });

    const todayCalls = calls.filter(c => c.calledAt >= todayStart);
    const weekCalls = calls.filter(c => c.calledAt >= weekStart);

    const answered = weekCalls.filter(c => c.answeredAt);
    const avgResponseMs = answered.length > 0
      ? answered.reduce((sum, c) => sum + (new Date(c.answeredAt!).getTime() - new Date(c.calledAt).getTime()), 0) / answered.length
      : 0;

    // Calls per day (last 7 days)
    const perDay: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayStart);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      perDay[key] = 0;
    }
    weekCalls.forEach(c => {
      const key = new Date(c.calledAt).toISOString().slice(0, 10);
      if (perDay[key] !== undefined) perDay[key]++;
    });

    // Top mesas
    const mesaCounts: Record<string, number> = {};
    weekCalls.forEach(c => {
      const name = c.tableName || "Sin mesa";
      mesaCounts[name] = (mesaCounts[name] || 0) + 1;
    });
    const topMesas = Object.entries(mesaCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // Peak hours
    const hourCounts: Record<number, number> = {};
    weekCalls.forEach(c => {
      const h = new Date(c.calledAt).getHours();
      hourCounts[h] = (hourCounts[h] || 0) + 1;
    });
    const peakHours = Object.entries(hourCounts)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 5)
      .map(([hour, count]) => ({ hour: Number(hour), count: Number(count) }));

    // Per restaurant (for superadmin)
    let perRestaurant: { id: string; name: string; weekCalls: number; todayCalls: number; answeredPct: number }[] = [];
    if (allRestaurants) {
      const grouped: Record<string, { name: string; week: number; today: number; answered: number }> = {};
      calls.forEach(c => {
        if (!grouped[c.restaurantId]) grouped[c.restaurantId] = { name: c.restaurant.name, week: 0, today: 0, answered: 0 };
        if (c.calledAt >= weekStart) {
          grouped[c.restaurantId].week++;
          if (c.answeredAt) grouped[c.restaurantId].answered++;
        }
        if (c.calledAt >= todayStart) grouped[c.restaurantId].today++;
      });
      perRestaurant = Object.entries(grouped)
        .map(([id, d]) => ({ id, name: d.name, weekCalls: d.week, todayCalls: d.today, answeredPct: d.week > 0 ? Math.round(d.answered / d.week * 100) : 0 }))
        .sort((a, b) => b.weekCalls - a.weekCalls);
    }

    // Recent calls (last 20)
    const recent = calls.slice(0, 20).map(c => ({
      id: c.id,
      tableName: c.tableName,
      calledAt: c.calledAt.toISOString(),
      answeredAt: c.answeredAt?.toISOString() || null,
      responseTime: c.answeredAt ? Math.round((new Date(c.answeredAt).getTime() - new Date(c.calledAt).getTime()) / 1000) : null,
      restaurantName: c.restaurant.name,
    }));

    return NextResponse.json({
      today: todayCalls.length,
      week: weekCalls.length,
      month: calls.length,
      answeredPct: weekCalls.length > 0 ? Math.round(answered.length / weekCalls.length * 100) : 0,
      avgResponseSec: Math.round(avgResponseMs / 1000),
      perDay,
      topMesas,
      peakHours,
      recent,
      perRestaurant,
    });
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    console.error("[Analytics garzon]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
