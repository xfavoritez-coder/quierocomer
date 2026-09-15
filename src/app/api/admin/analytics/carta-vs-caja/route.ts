import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";

/**
 * Cross-system analysis stub — Toteat integration removed.
 * Returns empty data structure so the frontend handles it gracefully.
 */
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  return NextResponse.json({
    summary: { totalDishes: 0, mappedDishes: 0, totalOpens: 0, totalSales: 0, orphanCount: 0 },
    rows: [],
    orphans: [],
    insights: { fantasmas: [], estrellas: [], sospechosos: [] },
  });
}
