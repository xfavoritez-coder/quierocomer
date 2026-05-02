import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chileDateOf } from "@/lib/toteat/timezone";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const guestId = url.searchParams.get("guestId");
    const restaurantId = url.searchParams.get("restaurantId");
    if (!guestId) return NextResponse.json({ visitCount: 0, restaurantSessions: 0, priorDays: 0 });

    const guest = await prisma.guestProfile.findUnique({
      where: { id: guestId },
      select: { visitCount: true },
    });

    let restaurantSessions = 0;
    let priorDays = 0;
    if (restaurantId) {
      const sessions = await prisma.session.findMany({
        where: { guestId, restaurantId },
        select: { startedAt: true },
      });
      restaurantSessions = sessions.length;
      // Count distinct days in Chile timezone, excluding today. A real "visit"
      // is one day. Without this, refreshing the page or being idle >5min
      // creates new sessions that wrongly bump the visit count and trigger
      // the 2nd-visit birthday modal during the very first visit.
      const todayChile = chileDateOf(new Date());
      const days = new Set(sessions.map((s) => chileDateOf(s.startedAt)));
      days.delete(todayChile);
      priorDays = days.size;
    }

    return NextResponse.json({
      visitCount: guest?.visitCount || 0,
      restaurantSessions,
      priorDays,
    });
  } catch {
    return NextResponse.json({ visitCount: 0, restaurantSessions: 0, priorDays: 0 });
  }
}
