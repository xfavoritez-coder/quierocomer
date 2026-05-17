import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildWeeklyEmailHtml } from "@/lib/email/weeklyEmailHtml";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "alas-papas";

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: { id: true, name: true, logoUrl: true, slug: true, isDemo: true, owner: { select: { name: true, email: true } } },
  });

  if (!restaurant) return new NextResponse("Not found", { status: 404 });

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekStart = oneWeekAgo.toLocaleDateString("es-CL", { day: "numeric", month: "long" });
  const weekEnd = now.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
  const ownerName = restaurant.owner?.name?.split(" ")[0] || "Hola";

  // Use fake data for demo, real dishes for names
  const dishes = await prisma.dish.findMany({
    where: { restaurantId: restaurant.id, isActive: true },
    select: { name: true, photos: true },
    orderBy: { position: "asc" },
    take: 5,
  });

  const topViewed = dishes.slice(0, 3).map((d, i) => ({
    name: d.name, count: [42, 35, 28][i] || 20, photo: d.photos?.[0] || null,
  }));
  const leastViewed = dishes.slice(-3).map((d, i) => ({
    name: d.name, count: [3, 5, 7][i] || 4,
  }));
  const visitsByHour = [
    { hour: "12", count: 18 }, { hour: "13", count: 32 }, { hour: "14", count: 25 },
    { hour: "19", count: 15 }, { hour: "20", count: 38 }, { hour: "21", count: 42 },
    { hour: "22", count: 20 },
  ];

  const demoInsight = {
    title: topViewed[0] ? `Destaca ${topViewed[0].name}` : "Tu carta está lista",
    body: topViewed[0]
      ? `Tu plato más visto recibe mucha atención pero no está marcado como recomendado. Agrégale la etiqueta para que aparezca primero y veas cómo aumenta tu venta.`
      : "Al activar empezarás a ver datos reales de cómo interactúan tus clientes con tu carta.",
  };

  const html = buildWeeklyEmailHtml({
    ownerName,
    restaurantName: restaurant.name,
    logoUrl: restaurant.logoUrl,
    weekLabel: `${weekStart} – ${weekEnd}`,
    totalVisits: 147,
    visitsDelta: 23,
    newClients: 12,
    clientsDelta: 15,
    topViewed,
    leastViewed,
    visitsByHour,
    panelUrl: `https://quierocomer.cl/api/panel/demo-auth?slug=${restaurant.slug}`,
    slug: restaurant.slug,
    isDemo: true,
    insight: demoInsight,
  });

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
