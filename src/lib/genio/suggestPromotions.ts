/**
 * Genio Promotion Suggester — uses Claude to analyze a restaurant's menu,
 * segments, weather forecast, and past promos to suggest 3 smart promotions.
 */
import { prisma } from "@/lib/prisma";
import { fetchWeather } from "@/lib/weather";

const DEFAULT_LAT = -33.4489;
const DEFAULT_LNG = -70.6693;

interface PromoSuggestion {
  name: string;
  description: string;
  dishIds: string[];
  dishNames: string[];
  promoPrice: number;
  originalPrice: number;
  discountPct: number;
  targetSegment: string;
  justification: string;
  emailCopy: string;
}

export async function suggestPromotions(restaurantId: string): Promise<PromoSuggestion[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  // Gather context
  const [restaurant, dishes, segments, pastPromos, weather, topViewed, topGenio] = await Promise.all([
    prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { name: true, slug: true } }),
    prisma.dish.findMany({ where: { restaurantId, isActive: true }, include: { category: { select: { name: true } } }, orderBy: { position: "asc" } }),
    prisma.segment.findMany({ where: { restaurantId }, select: { name: true, cachedCount: true, rules: true } }),
    prisma.promotion.findMany({ where: { restaurantId }, orderBy: { createdAt: "desc" }, take: 5, select: { name: true, status: true, discountPct: true, metrics: true } }),
    fetchWeather(DEFAULT_LAT, DEFAULT_LNG),
    // Top 5 most viewed dishes (last 30 days)
    prisma.statEvent.groupBy({
      by: ["dishId"], where: { restaurantId, eventType: "DISH_VIEW", dishId: { not: null }, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 5,
    }),
    // Top 5 Genio recommendations
    prisma.statEvent.groupBy({
      by: ["dishId"], where: { restaurantId, eventType: "GENIO_COMPLETE", dishId: { not: null }, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 5,
    }),
  ]);

  if (!restaurant || dishes.length === 0) return [];

  // Build dish map for names
  const dishMap = Object.fromEntries(dishes.map(d => [d.id, d]));

  // Format menu for prompt
  const menuText = dishes.map(d =>
    `- ${d.name} ($${d.price.toLocaleString("es-CL")}) [${d.category.name}]${d.tags.includes("RECOMMENDED") ? " ★" : ""}${d.description ? ` — ${d.description}` : ""}`
  ).join("\n");

  const topViewedText = topViewed.map((t: any) => `${dishMap[t.dishId]?.name || t.dishId}: ${t._count.id} vistas`).join(", ");
  const topGenioText = topGenio.map((t: any) => `${dishMap[t.dishId]?.name || t.dishId}: ${t._count.id} recomendaciones`).join(", ");
  const segmentsText = segments.map(s => `${s.name} (${s.cachedCount ?? "?"} personas)`).join(", ");
  const pastPromosText = pastPromos.length ? pastPromos.map(p => `${p.name} (${p.status}, ${p.discountPct}% off)`).join(", ") : "Ninguna";
  const weatherText = weather ? `${weather.weatherCondition}, ${weather.weatherTemp}°C` : "No disponible";

  const prompt = `Eres el Genio de QuieroComer, un asistente de marketing para restaurantes en Chile.

Analiza la carta de "${restaurant.name}" y propón exactamente 3 promociones para esta semana.

CARTA COMPLETA:
${menuText}

DATOS DE COMPORTAMIENTO (últimos 30 días):
- Platos más vistos: ${topViewedText || "Sin datos suficientes"}
- Platos más recomendados por el Genio: ${topGenioText || "Sin datos suficientes"}
- Segmentos detectados: ${segmentsText || "Sin segmentos"}

CONTEXTO:
- Clima actual: ${weatherText}
- Promociones anteriores: ${pastPromosText}

REGLAS:
- Cada promo debe incluir 1-3 platos
- El descuento debe ser entre 10% y 30%
- Justifica por qué esta promo tiene sentido con los datos
- Escribe un copy corto para email (2-3 frases)
- Los precios deben ser en CLP (pesos chilenos)
- Sé creativo pero realista

Responde SOLO con un JSON array de 3 objetos, sin markdown, sin explicación fuera del JSON:
[{
  "name": "Nombre de la promo",
  "description": "Descripción corta",
  "dishNames": ["Plato 1", "Plato 2"],
  "promoPrice": 8990,
  "originalPrice": 11900,
  "discountPct": 25,
  "targetSegment": "A qué tipo de cliente apunta",
  "justification": "Por qué esta promo tiene sentido",
  "emailCopy": "Copy para email"
}]`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error: ${response.status} ${err}`);
  }

  const result = await response.json();
  const text = result.content?.[0]?.text || "[]";

  // Parse JSON from response (handle potential markdown wrapping)
  let suggestions: any[];
  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    suggestions = JSON.parse(cleaned);
  } catch {
    console.error("Failed to parse Claude response:", text);
    return [];
  }

  // Match dish names to IDs
  return suggestions.map((s: any) => {
    const matchedDishIds = (s.dishNames || []).map((name: string) => {
      const match = dishes.find(d => d.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(d.name.toLowerCase()));
      return match?.id;
    }).filter(Boolean);

    return {
      name: s.name,
      description: s.description,
      dishIds: matchedDishIds,
      dishNames: s.dishNames || [],
      promoPrice: s.promoPrice,
      originalPrice: s.originalPrice,
      discountPct: s.discountPct,
      targetSegment: s.targetSegment,
      justification: s.justification,
      emailCopy: s.emailCopy,
    };
  });
}
