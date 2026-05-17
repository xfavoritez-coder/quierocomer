import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildWeeklyEmailHtml } from "@/lib/email/weeklyEmailHtml";
import { getVisitorMetrics, getTopAttentionDishes } from "@/lib/admin/analyticsQueries";

export const maxDuration = 30;

async function generateSingleInsight(restaurantId: string, restaurantName: string, topViewedFromEmail?: { name: string; count: number }[]): Promise<{ title: string; body: string; subject: string } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { toteatRestaurantId: true } });
  const hasToteat = !!restaurant?.toteatRestaurantId;

  const [sessions, dishes, topViewed, suggestionClicks, suggestionShows] = await Promise.all([
    prisma.session.findMany({ where: { restaurantId, startedAt: { gte: oneWeekAgo } }, select: { durationMs: true, isAbandoned: true, dishesViewed: true }, take: 5000 }),
    prisma.dish.findMany({ where: { restaurantId, isActive: true }, select: { id: true, name: true } }),
    prisma.statEvent.groupBy({ by: ["dishId"], where: { restaurantId, eventType: "DISH_VIEW", dishId: { not: null }, createdAt: { gte: oneWeekAgo } }, _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 10 }),
    prisma.statEvent.findMany({ where: { restaurantId, eventType: "SUGGESTION_CLICK", createdAt: { gte: oneWeekAgo } }, select: { dishId: true, metadata: true } }),
    prisma.statEvent.count({ where: { restaurantId, eventType: "SUGGESTION_SHOWN", createdAt: { gte: oneWeekAgo } } }),
  ]);

  if (sessions.length < 5) return null;

  const dishMap = Object.fromEntries(dishes.map(d => [d.id, d.name]));
  const totalSessions = sessions.length;
  const avgDuration = Math.round(sessions.reduce((a, s) => a + (s.durationMs || 0), 0) / sessions.length / 1000);

  // Build suggestion stats
  const suggClicksByDish: Record<string, number> = {};
  const suggPairs: Record<string, number> = {};
  for (const e of suggestionClicks) {
    if (e.dishId) suggClicksByDish[e.dishId] = (suggClicksByDish[e.dishId] || 0) + 1;
    const meta = e.metadata as any;
    if (meta?.fromDishId && e.dishId) {
      const key = `${dishMap[meta.fromDishId] || "?"} → ${dishMap[e.dishId] || "?"}`;
      suggPairs[key] = (suggPairs[key] || 0) + 1;
    }
  }
  const topSuggClicked = Object.entries(suggClicksByDish).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, c]) => `${dishMap[id] || "?"}: ${c} clicks`).join(", ");
  const topSuggPairs = Object.entries(suggPairs).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([pair, c]) => `${pair} (${c}x)`).join(", ");
  const suggRate = suggestionShows > 0 ? Math.round((suggestionClicks.length / suggestionShows) * 100) : 0;

  const prompt = `Eres el Genio de QuieroComer. Genera exactamente 1 insight accionable para "${restaurantName}".

DATOS (esta semana):
- ${totalSessions} sesiones
- Duración promedio: ${avgDuration}s
- Top platos vistos esta semana: ${(topViewedFromEmail || topViewed.slice(0, 5).map((t: any) => ({ name: dishMap[t.dishId] || "?", count: t._count.id }))).map((d: any) => `${d.name}: ${d.count} vistas`).join(", ")}
${suggestionShows > 0 ? `- SUGERIDOS: ${suggestionShows} veces mostrados, ${suggestionClicks.length} clicks (${suggRate}% tasa)${topSuggClicked ? `. Más clickeados: ${topSuggClicked}` : ""}${topSuggPairs ? `. Pares: ${topSuggPairs}` : ""}` : "- SUGERIDOS: sin datos aún esta semana"}
${hasToteat ? `- DATOS DE VENTAS DISPONIBLES: este local tiene POS conectado, puedes hablar de ventas y conversión de sugeridos` : `- NO hay datos de ventas. Solo puedes hablar de vistas, clicks y comportamiento en la carta.`}
IMPORTANTE: Los números que menciones DEBEN coincidir exactamente con los datos de arriba. No inventes cifras.

REGLAS:
- Solo comenta datos observables: qué platos miran más, en qué horarios entran, qué vista usan, tendencias de visitas
- NUNCA opines sobre cantidad de platos, estructura de carta o precios — eso es decisión del dueño
- NUNCA menciones cumpleaños captados, registros o conversión — eso depende del sistema, no del dueño
- Sé específico con números
- Máximo 2 frases cortas
- Tono informativo y positivo, como un dato curioso útil
- Usa lenguaje simple y coloquial, como si le hablaras al dueño en persona. NUNCA uses palabras técnicas como bestseller, upselling, engagement, conversión, KPI, etc.
- El subject es para el asunto del email: corto, con gancho basado en el dato, que dé ganas de abrir. No pongas el nombre del restaurante en el subject.

Responde SOLO JSON, sin markdown:
{"title": "Título corto", "body": "Explicación con acción concreta", "subject": "Asunto corto con gancho"}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 300, messages: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.content?.[0]?.text || "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// GET /api/email-preview/insight?slug=alleria-pizza — returns HTML to view in browser
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "alleria-pizza";

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: { id: true, name: true, logoUrl: true, slug: true, owner: { select: { name: true } } },
  });

  if (!restaurant) return new NextResponse("Restaurant not found", { status: 404 });

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [metrics, prevMetrics, topDishes] = await Promise.all([
    getVisitorMetrics(restaurant.id, oneWeekAgo, now),
    getVisitorMetrics(restaurant.id, twoWeeksAgo, oneWeekAgo),
    getTopAttentionDishes(restaurant.id, oneWeekAgo, now),
  ]);

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

  const totalVisits = metrics.totalVisitors;
  const prevVisits = prevMetrics.totalVisitors || 1;
  const visitsDelta = Math.round(((totalVisits - prevVisits) / prevVisits) * 100);
  const newClients = metrics.birthdaysSaved || 0;
  const prevClients = prevMetrics.birthdaysSaved || 0;
  const clientsDelta = prevClients > 0 ? Math.round(((newClients - prevClients) / prevClients) * 100) : 0;
  const topViewed = (topDishes?.dishes || []).slice(0, 3).map((d: any) => ({
    name: d.name, count: d.opens, photo: d.photo || null,
  }));

  const weekStart = oneWeekAgo.toLocaleDateString("es-CL", { day: "numeric", month: "long" });
  const weekEnd = now.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
  const ownerName = restaurant.owner?.name?.split(" ")[0] || "Hola";

  const insight = await generateSingleInsight(restaurant.id, restaurant.name, topViewed);

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
    insight: insight || undefined,
  });

  const subjectLine = insight?.subject
    ? `${restaurant.name}: ${insight.subject}`
    : `Tu semana en ${restaurant.name}`;

  // Wrap with subject preview bar
  const fullHtml = `
    <div style="background:#333;padding:12px 20px;font-family:system-ui;position:sticky;top:0;z-index:100;">
      <div style="font-size:11px;color:#999;margin-bottom:4px;">ASUNTO DEL EMAIL:</div>
      <div style="font-size:15px;color:#fff;font-weight:600;">${subjectLine}</div>
    </div>
    ${emailHtml}
  `;

  return new NextResponse(fullHtml, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
