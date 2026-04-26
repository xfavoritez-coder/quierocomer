import { NextRequest, NextResponse } from "next/server";
import { getPopularDishes } from "@/lib/qr/utils/getPopularDishes";

// In-memory cache: restaurantId -> { data, timestamp }
const cache = new Map<string, { data: { dishId: string; score: number }[]; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) {
    return NextResponse.json({ error: "restaurantId required" }, { status: 400 });
  }

  const cached = cache.get(restaurantId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json({ popular: cached.data });
  }

  try {
    const popular = await getPopularDishes(restaurantId);
    cache.set(restaurantId, { data: popular, timestamp: Date.now() });
    return NextResponse.json({ popular });
  } catch (err) {
    console.error("Popular dishes error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
