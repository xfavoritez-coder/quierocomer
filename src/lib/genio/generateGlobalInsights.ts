/**
 * Global insights for superadmin — compares restaurants, detects platform-wide patterns.
 */
import { prisma } from "@/lib/prisma";

interface Insight {
  type: string;
  title: string;
  body: string;
  priority: number;
  data: any;
}

export async function generateGlobalInsights(): Promise<Insight[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Get all restaurants with stats
  const restaurants = await prisma.restaurant.findMany({
    where: { isActive: true },
    select: { id: true, name: true, slug: true, _count: { select: { dishes: true } } },
  });

  // Per-restaurant stats
  const restaurantStats = [];
  for (const r of restaurants) {
    const [visitsWeek, visitsMonth, sessions, genioUsed, registeredGuests, totalGuests] = await Promise.all([
      prisma.statEvent.count({ where: { restaurantId: r.id, eventType: "SESSION_START", createdAt: { gte: weekAgo } } }),
      prisma.statEvent.count({ where: { restaurantId: r.id, eventType: "SESSION_START", createdAt: { gte: monthAgo } } }),
      prisma.session.findMany({ where: { restaurantId: r.id, startedAt: { gte: weekAgo } }, select: { durationMs: true, isAbandoned: true } }),
      prisma.statEvent.count({ where: { restaurantId: r.id, eventType: "GENIO_START", createdAt: { gte: monthAgo } } }),
      prisma.guestProfile.count({ where: { linkedQrUserId: { not: null }, sessions: { some: { restaurantId: r.id } } } }),
      prisma.guestProfile.count({ where: { sessions: { some: { restaurantId: r.id } } } }),
    ]);

    const avgDuration = sessions.length ? Math.round(sessions.reduce((a, s) => a + (s.durationMs || 0), 0) / sessions.length / 1000) : 0;
    const conversionRate = totalGuests > 0 ? Math.round((registeredGuests / totalGuests) * 100) : 0;

    restaurantStats.push({
      name: r.name,
      dishes: r._count.dishes,
      visitsWeek,
      visitsMonth,
      avgDuration,
      genioUsed,
      conversionRate,
      totalGuests,
      registeredGuests,
    });
  }

  const totalVisits = restaurantStats.reduce((a, r) => a + r.visitsWeek, 0);
  const totalRegistered = restaurantStats.reduce((a, r) => a + r.registeredGuests, 0);
  const totalAllGuests = restaurantStats.reduce((a, r) => a + r.totalGuests, 0);

  const prompt = `Eres el Genio de QuieroComer, analizando la plataforma completa como superadmin.

LOCALES EN LA PLATAFORMA (${restaurants.length} activos):
${restaurantStats.map(r =>
  `- ${r.name}: ${r.visitsWeek} visitas/semana, ${r.dishes} platos, duración ${r.avgDuration}s, Genio usado ${r.genioUsed}x, conversión ${r.conversionRate}% (${r.registeredGuests}/${r.totalGuests})`
).join("\n")}

TOTALES:
- Visitas esta semana: ${totalVisits}
- Visitantes únicos: ${totalAllGuests}
- Registrados: ${totalRegistered} (${totalAllGuests > 0 ? Math.round((totalRegistered / totalAllGuests) * 100) : 0}%)

Genera exactamente 3 insights comparativos y accionables a nivel plataforma. Compara locales entre sí, detecta oportunidades, sugiere acciones concretas.

Responde SOLO con JSON array, sin markdown:
[{
  "type": "platform|comparison|opportunity",
  "title": "Título corto",
  "body": "Análisis con números y acción sugerida",
  "priority": 1-3
}]`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1500, messages: [{ role: "user", content: prompt }] }),
  });

  if (!response.ok) throw new Error(`Claude API error: ${response.status}`);

  const result = await response.json();
  const text = result.content?.[0]?.text || "[]";

  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned).map((i: any) => ({ ...i, data: { totalVisits, totalRegistered, restaurantCount: restaurants.length } }));
  } catch {
    console.error("Failed to parse global insights:", text);
    return [];
  }
}
