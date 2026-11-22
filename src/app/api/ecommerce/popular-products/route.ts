import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Cache en memoria: por restaurantId, TTL 10 min
const _cache = new Map<string, { ts: number; data: PopularData }>();
const CACHE_TTL = 600_000;

interface PopularData {
  topIds: string[];                          // top 20 más agregados al carrito
  pairs: Record<string, string[]>;           // dishId → [dishIds que se compran junto]
}

/** GET /api/ecommerce/popular-products?restaurantId=X
 *  Devuelve:
 *  - topIds: productos más agregados al carrito (últimos 30 días)
 *  - pairs: co-ocurrencias (qué productos se agregan juntos en la misma sesión)
 *  Público (solo IDs). */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ topIds: [], pairs: {} });

  const cached = _cache.get(restaurantId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  const since = new Date(Date.now() - 30 * 86400000);

  const events = await prisma.statEvent.findMany({
    where: {
      restaurantId,
      eventType: "STORE_CART_ADD",
      createdAt: { gte: since },
    },
    select: { metadata: true, sessionId: true },
  });

  // 1. Contar adds por dishId → topIds
  const counts = new Map<string, number>();
  // 2. Agrupar por sesión para encontrar co-ocurrencias
  const sessionDishes = new Map<string, Set<string>>();

  for (const e of events) {
    const meta = e.metadata as Record<string, unknown> | null;
    const dishId = meta?.dishId as string | undefined;
    if (!dishId) continue;

    counts.set(dishId, (counts.get(dishId) ?? 0) + 1);

    if (e.sessionId) {
      if (!sessionDishes.has(e.sessionId)) sessionDishes.set(e.sessionId, new Set());
      sessionDishes.get(e.sessionId)!.add(dishId);
    }
  }

  // Top 20 más agregados (mínimo 2 adds)
  const topIds = [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([id]) => id);

  // Co-ocurrencias: para cada par de productos en la misma sesión, contar frecuencia
  const pairCounts = new Map<string, Map<string, number>>(); // dishA → { dishB → count }

  for (const dishes of sessionDishes.values()) {
    if (dishes.size < 2 || dishes.size > 15) continue; // ignorar sesiones con 1 item o excesivas
    const arr = [...dishes];
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        // Bidireccional: A→B y B→A
        if (!pairCounts.has(arr[i])) pairCounts.set(arr[i], new Map());
        if (!pairCounts.has(arr[j])) pairCounts.set(arr[j], new Map());
        pairCounts.get(arr[i])!.set(arr[j], (pairCounts.get(arr[i])!.get(arr[j]) ?? 0) + 1);
        pairCounts.get(arr[j])!.set(arr[i], (pairCounts.get(arr[j])!.get(arr[i]) ?? 0) + 1);
      }
    }
  }

  // Para cada producto, top 5 pares más frecuentes (mínimo 2 co-ocurrencias)
  const pairs: Record<string, string[]> = {};
  for (const [dishId, map] of pairCounts) {
    const top = [...map.entries()]
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);
    if (top.length) pairs[dishId] = top;
  }

  const data: PopularData = { topIds, pairs };
  _cache.set(restaurantId, { ts: Date.now(), data });

  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300" },
  });
}
