import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// A "visit" is a cluster of sessions with no gap larger than this threshold.
// Sized so refreshes / idle resumes / typical meal duration stay one visit,
// but coming back after dinner for dessert (~1h+ later) counts as a new one.
const VISIT_GAP_MS = 60 * 60 * 1000; // 1 hour

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const guestId = url.searchParams.get("guestId");
    const restaurantId = url.searchParams.get("restaurantId");
    if (!guestId) return NextResponse.json({ visitCount: 0, restaurantSessions: 0, priorVisits: 0 });

    const guest = await prisma.guestProfile.findUnique({
      where: { id: guestId },
      select: { visitCount: true },
    });

    let restaurantSessions = 0;
    let priorVisits = 0;
    if (restaurantId) {
      const sessions = await prisma.session.findMany({
        where: { guestId, restaurantId },
        select: { startedAt: true },
        orderBy: { startedAt: "asc" },
      });
      restaurantSessions = sessions.length;

      // Cluster sessions into visits: a new visit starts whenever there's
      // a gap > VISIT_GAP_MS between consecutive sessions. Each "group" tracks
      // the latest startedAt in that visit, used to decide if it ended long
      // enough ago to count as "prior" (not the visit-in-progress).
      const groupLastStart: number[] = [];
      for (const s of sessions) {
        const t = s.startedAt.getTime();
        const lastT = groupLastStart[groupLastStart.length - 1];
        if (lastT === undefined || t - lastT > VISIT_GAP_MS) {
          groupLastStart.push(t);
        } else {
          groupLastStart[groupLastStart.length - 1] = t;
        }
      }
      const now = Date.now();
      // A visit counts as "prior" if its last activity was more than the
      // gap ago — meaning the customer already left and came back.
      priorVisits = groupLastStart.filter((t) => now - t > VISIT_GAP_MS).length;
    }

    return NextResponse.json({
      visitCount: guest?.visitCount || 0,
      restaurantSessions,
      priorVisits,
    });
  } catch {
    return NextResponse.json({ visitCount: 0, restaurantSessions: 0, priorVisits: 0 });
  }
}
