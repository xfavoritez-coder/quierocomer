import { NextRequest, NextResponse } from "next/server";
import { getDishRankings } from "@/lib/qr/utils/getDishRankings";

/**
 * Public endpoint that powers the carta sort selector ("Lo más pedido",
 * "Lo más visto"). Returns per-dish rankings for the public carta view.
 *
 * Query: ?restaurantId=...
 * Response:
 *  - views: { [dishId]: openCount } — distinct sessions opening modal (7d)
 *  - sales: { mode: "today" | "week" | null, byDish, total }
 *           Adaptive: only set when there's enough volume to be meaningful.
 *
 * Cached at the edge for 60s — the order tends to be stable minute-to-minute
 * and the carta gets hammered when many tables scan their QR.
 */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  try {
    const data = await getDishRankings(restaurantId);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "rankings_failed" }, { status: 500 });
  }
}
