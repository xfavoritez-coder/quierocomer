import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";
import { buildWeeklyEmailHtml } from "@/lib/email/weeklyEmailHtml";
import { getVisitorMetrics, getTopAttentionDishes } from "@/lib/admin/analyticsQueries";
import { chileHourOf } from "@/lib/toteat/timezone";

/**
 * GET /api/admin/informe-semanal/preview?slug=<slug>
 * Regenerates the weekly email HTML for preview.
 */
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const r = await prisma.restaurant.findFirst({
    where: { slug },
    select: { id: true, name: true, slug: true, logoUrl: true, isDemo: true, owner: { select: { name: true } } },
  });
  if (!r) return NextResponse.json({ error: "not found" }, { status: 404 });

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 86400000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
  const weekStart = oneWeekAgo.toLocaleDateString("es-CL", { day: "numeric", month: "long" });
  const weekEnd = now.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });

  const ownerName = r.owner?.name?.split(" ")[0] || "Hola";

  if (r.isDemo) {
    // Demo: fake data
    const dishes = await prisma.dish.findMany({
      where: { restaurantId: r.id, isActive: true },
      select: { name: true, photos: true },
      orderBy: { position: "asc" },
      take: 5,
    });
    const topViewed = dishes.slice(0, 3).map((d, i) => ({
      name: d.name, count: [42, 35, 28][i] || 20, photo: d.photos?.[0] || null,
    }));
    const leastViewed = dishes.slice(-3).map((d, i) => ({ name: d.name, count: [3, 5, 7][i] || 4 }));
    const visitsByHour = [
      { hour: "12", count: 18 }, { hour: "13", count: 32 }, { hour: "14", count: 25 },
      { hour: "19", count: 15 }, { hour: "20", count: 38 }, { hour: "21", count: 42 }, { hour: "22", count: 20 },
    ];

    const html = buildWeeklyEmailHtml({
      ownerName, restaurantName: r.name, logoUrl: r.logoUrl,
      weekLabel: `${weekStart} – ${weekEnd}`,
      totalVisits: 147, visitsDelta: 23, newClients: 12, clientsDelta: 15,
      topViewed, leastViewed, visitsByHour,
      panelUrl: `https://quierocomer.cl/api/panel/demo-auth?slug=${r.slug}`,
      slug: r.slug!, isDemo: true,
      insight: { title: topViewed[0] ? `Destaca ${topViewed[0].name}` : "Tu carta está lista", body: "Tu plato más visto recibe mucha atención. Márcalo como recomendado." },
    });
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  // Real data
  const [metrics, prevMetrics, topDishes] = await Promise.all([
    getVisitorMetrics(r.id, oneWeekAgo, now),
    getVisitorMetrics(r.id, twoWeeksAgo, oneWeekAgo),
    getTopAttentionDishes(r.id, oneWeekAgo, now),
  ]);

  const sessions = await prisma.session.findMany({
    where: { restaurantId: r.id, startedAt: { gte: oneWeekAgo, lte: now } },
    select: { startedAt: true },
  });
  const hourBuckets: Record<string, number> = {};
  for (let h = 10; h <= 23; h++) hourBuckets[String(h)] = 0;
  for (const s of sessions) {
    const h = String(chileHourOf(new Date(s.startedAt)));
    if (hourBuckets[h] !== undefined) hourBuckets[h]++;
  }
  const visitsByHour = Object.entries(hourBuckets).map(([hour, count]) => ({ hour, count }));

  const totalVisits = metrics.totalVisitors;
  const prevVisits = prevMetrics.totalVisitors || 1;
  const visitsDelta = Math.round(((totalVisits - prevVisits) / prevVisits) * 100);
  const newClients = metrics.birthdaysSaved || 0;
  const prevClients = prevMetrics.birthdaysSaved || 0;
  const clientsDelta = prevClients > 0 ? Math.round(((newClients - prevClients) / prevClients) * 100) : 0;
  const topViewed = (topDishes?.dishes || []).slice(0, 3).map((d: any) => ({
    name: d.name, count: d.opens, photo: d.photo || null,
  }));

  // Least viewed dishes
  const leastViewedRaw = await prisma.statEvent.groupBy({
    by: ["dishId"],
    where: { restaurantId: r.id, createdAt: { gte: oneWeekAgo }, dishId: { not: null }, eventType: "DISH_VIEW" },
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

  // Insight (same logic as cron)
  let insight: { title: string; body: string } | undefined = await prisma.genioInsight.findFirst({
    where: { restaurantId: r.id, status: "active" },
    orderBy: { priority: "asc" },
    select: { title: true, body: true },
  }) ?? undefined;
  if (!insight && topViewed.length > 0) {
    insight = {
      title: `${topViewed[0].name} lidera tu carta`,
      body: `Con ${topViewed[0].count} vistas esta semana, es tu plato estrella. Asegúrate de que tenga buena foto y esté marcado como destacado para aprovechar su potencial.`,
    };
  }
  if (!insight) {
    insight = {
      title: "Pon tu QR en las mesas",
      body: "Cuantas más personas escaneen tu carta, mejores datos tendrás para tomar decisiones. Imprime el QR desde tu panel y ponlo visible en cada mesa.",
    };
  }

  const html = buildWeeklyEmailHtml({
    ownerName, restaurantName: r.name, logoUrl: r.logoUrl,
    weekLabel: `${weekStart} – ${weekEnd}`,
    totalVisits, visitsDelta, newClients, clientsDelta,
    topViewed, leastViewed, visitsByHour,
    panelUrl: "https://quierocomer.cl/panel",
    slug: r.slug!, isDemo: false,
    insight,
  });

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
