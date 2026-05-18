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
  const [restaurant, dishes, categories, sessions, dietCounts, topViewed, totalGuests, registeredGuests] = await Promise.all([
    prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { name: true, dietType: true } }),
    prisma.dish.findMany({ where: { restaurantId, isActive: true }, include: { category: { select: { name: true } } } }),
    prisma.category.findMany({ where: { restaurantId, isActive: true }, select: { id: true, name: true } }),
    prisma.session.findMany({ where: { restaurantId, startedAt: { gte: thirtyDaysAgo } }, select: { durationMs: true, viewUsed: true, isAbandoned: true, dishesViewed: true }, take: 5000 }),
    prisma.qRUser.groupBy({ by: ["dietType"], where: { dietType: { not: null }, guestProfiles: { some: { sessions: { some: { restaurantId } } } } }, _count: { id: true } }),
    prisma.statEvent.groupBy({ by: ["dishId"], where: { restaurantId, eventType: "DISH_VIEW", dishId: { not: null }, createdAt: { gte: thirtyDaysAgo } }, _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 10 }),
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

  const dietLabel = restaurant.dietType === "VEGAN" ? "100% vegano" : restaurant.dietType === "VEGETARIAN" ? "vegetariano" : null;

  const prompt = `Eres el Genio de QuieroComer. Analiza los datos de "${restaurant.name}"${dietLabel ? ` (restaurante ${dietLabel})` : ""} y genera exactamente 1 insight accionable.

DATOS DEL LOCAL (últimos 30 días):
- Sesiones: ${totalSessions} (${abandonedSessions} abandonadas, ${Math.round((abandonedSessions / Math.max(totalSessions, 1)) * 100)}% abandono)
- Duración promedio: ${avgDuration}s
- Visitantes únicos: ${totalGuests} (${registeredGuests} registrados, ${conversionRate}% conversión)
- Platos en carta: ${dishes.length} en ${categories.length} categorías
- Distribución por categoría: ${Object.entries(categoryDishCounts).map(([k, v]) => `${k}: ${v}`).join(", ")}
- Platos más vistos: ${topViewed.slice(0, 5).map((t: any) => `${dishMap[t.dishId]?.name || "?"}: ${t._count.id}`).join(", ") || "sin datos"}
- Dietas detectadas: ${dietCounts.map((d: any) => `${d.dietType}: ${d._count.id}`).join(", ") || "sin datos"}
- Vista preferida: ${Object.entries(viewCounts).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([k, v]) => `${k}: ${v}`).join(", ") || "sin datos"}

REGLAS:
- Solo comenta datos observables: qué platos miran más, patrones de visitas, dietas detectadas, duración de sesiones, vistas preferidas
- Sé específico con números del local, no genérico
- Puedes sugerir destacar platos de comida, pero NUNCA sugieras destacar bebestibles (café, té, jugos, bebidas), extras ni acompañamientos — eso se maneja con productos sugeridos automáticos
- NUNCA opines sobre estructura de carta, orden de secciones, mover categorías, precios o cantidad de platos — eso es decisión del dueño
- Infiere el tipo de restaurante por su nombre y categorías. Si es claramente vegano, vegetariano, de sushi, etc., NO sugieras cosas obvias sobre su identidad (ej: "destaca que tus platos son veganos" a un restaurante vegano) — el dueño ya lo sabe
- NUNCA menciones "recomendaciones del Genio" ni que el Genio sugiere platos — el Genio solo reordena la carta según preferencias del comensal
- NUNCA menciones cumpleaños captados, registros, conversión ni KPIs técnicos
- NUNCA uses palabras como bestseller, upselling, engagement, conversión, ticket promedio, cross-selling
- Tono informativo y positivo, como un dato curioso útil para el dueño
- Máximo 2-3 frases cortas
- Si no hay suficientes datos, dilo honestamente

Responde SOLO con un JSON array de 1 elemento, sin markdown:
[{
  "type": "menu_gap|segment_opportunity|pricing|engagement",
  "title": "Título corto del insight",
  "body": "Observación con números y dato útil",
  "priority": 1
}]`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1500, messages: [{ role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) throw new Error(`Claude API error: ${response.status}`);

  const result = await response.json();
  const text = result.content?.[0]?.text || "[]";

  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const insights: Insight[] = JSON.parse(cleaned);
    return insights.slice(0, 1).map(i => ({
      ...i,
      data: { totalSessions, avgDuration, totalGuests, registeredGuests, conversionRate },
    }));
  } catch {
    console.error("Failed to parse insights:", text);
    return [];
  }
}
