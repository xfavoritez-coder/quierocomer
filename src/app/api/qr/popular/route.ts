import { NextRequest, NextResponse } from "next/server";
import { getPopularDishes, type PopularResult } from "@/lib/qr/utils/getPopularDishes";

// In-memory cache: restaurantId -> { data, timestamp }
const cache = new Map<string, { data: PopularResult; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) {
    return NextResponse.json({ error: "restaurantId required" }, { status: 400 });
  }

  const cached = cache.get(restaurantId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    // Flatten for backward compat
    const all = [...cached.data.global, ...cached.data.byCategory];
    return NextResponse.json({ popular: all });
  }

  try {
    const result = await getPopularDishes(restaurantId);
    cache.set(restaurantId, { data: result, timestamp: Date.now() });
    const all = [...result.global, ...result.byCategory];
    return NextResponse.json({ popular: all });
  } catch (err) {
    console.error("Popular dishes error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
