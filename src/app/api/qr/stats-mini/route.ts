import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/qr/stats-mini?restaurantId=xxx
 * Lightweight endpoint for owner banner — returns today's visit count.
 */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ todayVisits: 0 });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayVisits = await prisma.session.count({
    where: { restaurantId, startedAt: { gte: todayStart } },
  });

  return NextResponse.json({ todayVisits }, { headers: { "Cache-Control": "private, max-age=60" } });
}
