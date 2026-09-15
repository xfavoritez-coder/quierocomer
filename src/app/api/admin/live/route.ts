import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";

/**
 * Live dashboard stub — Toteat POS integration removed.
 * Returns empty data so the frontend handles it gracefully.
 */
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const now = new Date();
  const empty = { orderCount: 0, unitsSold: 0, revenue: 0 };
  return NextResponse.json({
    now: now.toISOString(),
    elapsedMs: 0,
    today: empty,
    yesterday: empty,
    lastWeek: empty,
    deltas: { revenueVsYesterday: null, revenueVsLastWeek: null, ordersVsYesterday: null, ordersVsLastWeek: null },
    byHour: new Array(24).fill(0).map((_, h) => ({ hour: h, units: 0, revenue: 0 })),
    topNow: [],
    topToday: [],
  });
}
