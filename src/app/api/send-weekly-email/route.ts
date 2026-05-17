import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAdminEmail } from "@/lib/email/sendAdminEmail";
import { getVisitorMetrics, getTopAttentionDishes } from "@/lib/admin/analyticsQueries";
import { buildWeeklyEmailHtml } from "@/lib/email/weeklyEmailHtml";

export const maxDuration = 30;

export async function GET() {
  const slug = "horusvegan";
  const to = "favoritez@gmail.com";

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: { id: true, name: true, logoUrl: true, slug: true, owner: { select: { name: true } } },
  });

  if (!restaurant) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [metrics, prevMetrics, topDishes] = await Promise.all([
    getVisitorMetrics(restaurant.id, oneWeekAgo, now),
    getVisitorMetrics(restaurant.id, twoWeeksAgo, oneWeekAgo),
    getTopAttentionDishes(restaurant.id, oneWeekAgo, now),
  ]);

  // Sessions by hour
  const sessions = await prisma.session.findMany({
    where: { restaurantId: restaurant.id, startedAt: { gte: oneWeekAgo, lte: now } },
    select: { startedAt: true },
  });
  const hourBuckets: Record<string, number> = {};
  for (let h = 10; h <= 23; h++) hourBuckets[String(h)] = 0;
  for (const s of sessions) {
    const h = String(new Date(s.startedAt).getHours());
    if (hourBuckets[h] !== undefined) hourBuckets[h]++;
  }
  const visitsByHour = Object.entries(hourBuckets).map(([hour, count]) => ({ hour, count }));

  // Least viewed
  const leastViewedRaw = await prisma.statEvent.groupBy({
    by: ["dishId"],
    where: { restaurantId: restaurant.id, createdAt: { gte: oneWeekAgo }, dishId: { not: null }, eventType: "DISH_VIEW" },
    _count: { dishId: true },
    orderBy: { _count: { dishId: "asc" } },
    take: 3,
  });
  const leastDishIds = leastViewedRaw.map(d => d.dishId!);
  const leastDishes = leastDishIds.length > 0
    ? await prisma.dish.findMany({ where: { id: { in: leastDishIds } }, select: { id: true, name: true } })
    : [];
  const leastViewed = leastViewedRaw.map(d => {
    const dish = leastDishes.find(dd => dd.id === d.dishId);
    return { name: dish?.name || "Desconocido", count: d._count.dishId };
  });

  // Computed values
  const totalVisits = metrics.totalVisitors;
  const prevVisits = prevMetrics.totalVisitors || 1;
  const visitsDelta = Math.round(((totalVisits - prevVisits) / prevVisits) * 100);
  const newClients = metrics.birthdaysSaved || 0;
  const prevClients = prevMetrics.birthdaysSaved || 0;
  const clientsDelta = prevClients > 0 ? Math.round(((newClients - prevClients) / prevClients) * 100) : 0;
  const avgSessionsPerDay = Math.round(metrics.totalSessions / 7);
  const topViewed = (topDishes?.dishes || []).slice(0, 3).map((d: any) => ({
    name: d.name, count: d.opens, photo: d.photo || null,
  }));
  const weekStart = oneWeekAgo.toLocaleDateString("es-CL", { day: "numeric", month: "long" });
  const weekEnd = now.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
  const ownerName = restaurant.owner?.name?.split(" ")[0] || "Hola";

  const emailHtml = buildWeeklyEmailHtml({
    ownerName,
    restaurantName: restaurant.name,
    logoUrl: restaurant.logoUrl,
    weekLabel: `${weekStart} – ${weekEnd}`,
    totalVisits,
    visitsDelta,
    newClients,
    clientsDelta,
    topViewed,
    leastViewed,
    visitsByHour,
    panelUrl: "https://quierocomer.cl/panel",
    slug: restaurant.slug,
  });

  await sendAdminEmail({
    to,
    subject: `Tu semana en ${restaurant.name}`,
    html: emailHtml,
    purpose: "weekly_summary",
  });

  return NextResponse.json({ ok: true, to, restaurant: restaurant.name });
}
