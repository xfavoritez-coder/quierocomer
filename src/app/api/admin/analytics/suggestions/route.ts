import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, requireRestaurantForOwner, authErrorResponse } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const restaurantId = req.nextUrl.searchParams.get("restaurantId");
    const validated = await requireRestaurantForOwner(req, restaurantId);
    if (!validated) return NextResponse.json({ error: "Missing restaurant" }, { status: 400 });

    const from = req.nextUrl.searchParams.get("from");
    const to = req.nextUrl.searchParams.get("to");
    const dateFrom = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateTo = to ? new Date(to + "T23:59:59") : new Date();

    // Get all suggestion events
    const [shownEvents, clickEvents] = await Promise.all([
      prisma.statEvent.findMany({
        where: { restaurantId: validated, eventType: "SUGGESTION_SHOWN", createdAt: { gte: dateFrom, lte: dateTo } },
        select: { dishId: true, metadata: true, dbSessionId: true },
      }),
      prisma.statEvent.findMany({
        where: { restaurantId: validated, eventType: "SUGGESTION_CLICK", createdAt: { gte: dateFrom, lte: dateTo } },
        select: { dishId: true, metadata: true, dbSessionId: true, createdAt: true },
      }),
    ]);

    // Total counts
    const totalShown = shownEvents.length;
    const totalClicks = clickEvents.length;
    const clickRate = totalShown > 0 ? Math.round((totalClicks / totalShown) * 1000) / 10 : 0;

    // Unique sessions that saw suggestions vs clicked
    const sessionsWithSuggestions = new Set(shownEvents.map(e => e.dbSessionId).filter(Boolean)).size;
    const sessionsWithClicks = new Set(clickEvents.map(e => e.dbSessionId).filter(Boolean)).size;

    // Top suggested dishes that get clicked (toDishId = dishId in SUGGESTION_CLICK)
    const clicksByDish: Record<string, number> = {};
    const shownByDish: Record<string, number> = {};
    for (const e of clickEvents) {
      if (e.dishId) clicksByDish[e.dishId] = (clicksByDish[e.dishId] || 0) + 1;
    }
    for (const e of shownEvents) {
      if (e.dishId) shownByDish[e.dishId] = (shownByDish[e.dishId] || 0) + 1;
    }

    // Top pairs: fromDish → toDish
    const pairCounts: Record<string, number> = {};
    for (const e of clickEvents) {
      const meta = e.metadata as any;
      const fromId = meta?.fromDishId;
      if (fromId && e.dishId) {
        const key = `${fromId}::${e.dishId}`;
        pairCounts[key] = (pairCounts[key] || 0) + 1;
      }
    }

    // Get dish names for top items
    const allDishIds = new Set([
      ...Object.keys(clicksByDish),
      ...Object.keys(shownByDish),
      ...Object.keys(pairCounts).flatMap(k => k.split("::")),
    ]);
    const dishes = await prisma.dish.findMany({
      where: { id: { in: [...allDishIds] } },
      select: { id: true, name: true, photos: true },
    });
    const dishMap = Object.fromEntries(dishes.map(d => [d.id, d]));

    // Top clicked suggestions
    const topClicked = Object.entries(clicksByDish)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([dishId, clicks]) => ({
        dishId,
        name: dishMap[dishId]?.name || "Desconocido",
        photo: dishMap[dishId]?.photos?.[0] || null,
        clicks,
        shown: shownByDish[dishId] || 0,
        rate: shownByDish[dishId] ? Math.round((clicks / shownByDish[dishId]) * 1000) / 10 : 0,
      }));

    // Top pairs
    const topPairs = Object.entries(pairCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([key, count]) => {
        const [fromId, toId] = key.split("::");
        return {
          fromName: dishMap[fromId]?.name || "Desconocido",
          fromPhoto: dishMap[fromId]?.photos?.[0] || null,
          toName: dishMap[toId]?.name || "Desconocido",
          toPhoto: dishMap[toId]?.photos?.[0] || null,
          count,
        };
      });

    return NextResponse.json({
      totalShown,
      totalClicks,
      clickRate,
      sessionsWithSuggestions,
      sessionsWithClicks,
      topClicked,
      topPairs,
      hasToteat: false,
      salesFromSuggestions: 0,
      salesFromSuggestionsDishes: [],
    });
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    console.error("Suggestions analytics error:", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
