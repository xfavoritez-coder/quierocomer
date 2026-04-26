import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// In-memory cache: restaurantId -> { data, timestamp }
const cache = new Map<string, { data: { dishId: string; score: number }[]; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) {
    return NextResponse.json({ error: "restaurantId required" }, { status: 400 });
  }

  // Check cache
  const cached = cache.get(restaurantId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json({ popular: cached.data });
  }

  try {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000); // last 48 hours
    const sessions = await prisma.session.findMany({
      where: { restaurantId, startedAt: { gte: since } },
      orderBy: { startedAt: "desc" },
      select: { dishesViewed: true },
    });

    // Count unique sessions per dish + dwell bonus (capped per session)
    const sessionCounts = new Map<string, number>();
    const dwellBonus = new Map<string, number>();

    for (const session of sessions) {
      const viewed = session.dishesViewed as any[] | null;
      if (!Array.isArray(viewed)) continue;

      const seenInSession = new Set<string>();
      for (const entry of viewed) {
        if (!entry?.dishId) continue;
        const detailMs = entry.detailMs ?? 0;
        if (detailMs <= 0) continue;

        // Count each dish only once per session
        if (!seenInSession.has(entry.dishId)) {
          seenInSession.add(entry.dishId);
          sessionCounts.set(entry.dishId, (sessionCounts.get(entry.dishId) ?? 0) + 1);

          // Small dwell bonus (max +1 per session, not +3)
          if (detailMs >= 5000) {
            dwellBonus.set(entry.dishId, (dwellBonus.get(entry.dishId) ?? 0) + 1);
          }
        }
      }
    }

    // Score = unique sessions (primary) + small dwell bonus
    const popular = [...sessionCounts.entries()]
      .filter(([, count]) => count >= 3) // minimum 3 unique sessions
      .map(([dishId, count]) => ({ dishId, score: count + (dwellBonus.get(dishId) ?? 0), sessions: count }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    // Store in cache
    cache.set(restaurantId, { data: popular, timestamp: Date.now() });

    return NextResponse.json({ popular });
  } catch (err) {
    console.error("Popular dishes error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
