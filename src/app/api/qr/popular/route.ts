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

    const scores = new Map<string, number>();

    for (const session of sessions) {
      const viewed = session.dishesViewed as any[] | null;
      if (!Array.isArray(viewed)) continue;

      for (const entry of viewed) {
        if (!entry?.dishId) continue;
        const detailMs = entry.detailMs ?? 0;
        if (detailMs <= 0) continue;

        let points = 1; // opened detail
        if (detailMs >= 10000) {
          points += 3;
        } else if (detailMs >= 5000) {
          points += 2;
        }

        scores.set(entry.dishId, (scores.get(entry.dishId) ?? 0) + points);
      }
    }

    const popular = [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([dishId, score]) => ({ dishId, score }));

    // Store in cache
    cache.set(restaurantId, { data: popular, timestamp: Date.now() });

    return NextResponse.json({ popular });
  } catch (err) {
    console.error("Popular dishes error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
