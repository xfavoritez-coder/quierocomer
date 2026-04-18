/**
 * Genio Insights — Claude analyzes restaurant data and generates actionable insights.
 */
import { prisma } from "@/lib/prisma";

interface Insight {
  type: string;
  title: string;
  body: string;
  priority: number;
  data: any;
}

export async function generateInsights(restaurantId: string): Promise<Insight[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Gather all data in parallel
  const [restaurant, dishes, categories, sessions, dietCounts, topViewed, topGenio, totalGuests, registeredGuests] = await Promise.all([
    prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { name: true } }),
    prisma.dish.findMany({ where: { restaurantId, isActive: true }, include: { category: { select: { name: true } } } }),
    prisma.category.findMany({ where: { restaurantId, isActive: true }, select: { id: true, name: true } }),
    prisma.session.findMany({ where: { restaurantId, startedAt: { gte: thirtyDaysAgo } }, select: { durationMs: true, viewUsed: true, isAbandoned: true, dishesViewed: true } }),
    prisma.qRUser.groupBy({ by: ["dietType"], where: { dietType: { not: null }, guestProfiles: { some: { sessions: { some: { restaurantId } } } } }, _count: { id: true } }),
    prisma.statEvent.groupBy({ by: ["dishId"], where: { restaurantId, eventType: "DISH_VIEW", dishId: { not: null }, createdAt: { gte: thirtyDaysAgo } }, _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 10 }),
    prisma.statEvent.groupBy({ by: ["dishId"], where: { restaurantId, eventType: "GENIO_COMPLETE", dishId: { not: null }, createdAt: { gte: thirtyDaysAgo } }, _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 5 }),
    prisma.guestProfile.count({ where: { sessions: { some: { restaurantId } } } }),
    prisma.guestProfile.count({ where: { linkedQrUserId: { not: null }, sessions: { some: { restaurantId } } } }),
  ]);

  if (!restaurant || dishes.length === 0) return [];

  const dishMap = Object.fromEntries(dishes.map(d => [d.id, d]));

  // Build stats
  const totalSessions = sessions.length;
  const abandonedSessions = sessions.filter(s => s.isAbandoned).length;
  const avgDuration = sessions.length ? Math.round(sessions.reduce((a, s) => a + (s.durationMs || 0), 0) / sessions.length / 1000) : 0;
  const conversionRate = totalGuests > 0 ? Math.round((registeredGuests / totalGuests) * 100) : 0;

  const viewCounts: Record<string, number> = {};
  sessions.forEach(s => { if (s.viewUsed) viewCounts[s.viewUsed] = (viewCounts[s.viewUsed] || 0) + 1; });

  const categoryDishCounts: Record<string, number> = {};
  categories.forEach(c => { categoryDishCounts[c.name] = dishes.filter(d => d.categoryId === c.id).length; });

  const prompt = `Eres el Genio de QuieroComer. Analiza los datos de "${restaurant.name}" y genera exactamente 3 insights accionables.

DATOS DEL LOCAL (últimos 30 días):
- Sesiones: ${totalSessions} (${abandonedSessions} abandonadas, ${Math.round((abandonedSessions / Math.max(totalSessions, 1)) * 100)}% abandono)
- Duración promedio: ${avgDuration}s
- Visitantes únicos: ${totalGuests} (${registeredGuests} registrados, ${conversionRate}% conversión)
- Platos en carta: ${dishes.length} en ${categories.length} categorías
- Distribución por categoría: ${Object.entries(categoryDishCounts).map(([k, v]) => `${k}: ${v}`).join(", ")}
- Platos más vistos: ${topViewed.slice(0, 5).map((t: any) => `${dishMap[t.dishId]?.name || "?"}: ${t._count.id}`).join(", ") || "sin datos"}
- Platos recomendados por Genio: ${topGenio.map((t: any) => `${dishMap[t.dishId]?.name || "?"}: ${t._count.id}`).join(", ") || "sin datos"}
- Dietas detectadas: ${dietCounts.map((d: any) => `${d.dietType}: ${d._count.id}`).join(", ") || "sin datos"}
- Vista preferida: ${Object.entries(viewCounts).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([k, v]) => `${k}: ${v}`).join(", ") || "sin datos"}

REGLAS:
- Sé específico con números, no genérico
- Prioriza insights que generen más ingresos
- Sugiere acciones concretas
- Si no hay suficientes datos, dilo honestamente

Responde SOLO con un JSON array, sin markdown:
[{
  "type": "menu_gap|segment_opportunity|pricing|engagement",
  "title": "Título corto del insight",
  "body": "Explicación con números y acción sugerida",
  "priority": 1-3 (1 = más importante)
}]`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1500, messages: [{ role: "user", content: prompt }] }),
  });

  if (!response.ok) throw new Error(`Claude API error: ${response.status}`);

  const result = await response.json();
  const text = result.content?.[0]?.text || "[]";

  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const insights: Insight[] = JSON.parse(cleaned);
    return insights.map(i => ({
      ...i,
      data: { totalSessions, avgDuration, totalGuests, registeredGuests, conversionRate },
    }));
  } catch {
    console.error("Failed to parse insights:", text);
    return [];
  }
}
