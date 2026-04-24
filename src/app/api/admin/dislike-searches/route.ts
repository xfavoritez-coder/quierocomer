import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    // Get all SEARCH_PERFORMED events with dislike_search context
    const events = await prisma.statEvent.findMany({
      where: {
        eventType: "SEARCH_PERFORMED",
        query: { not: null },
      },
      select: { query: true, resultsCount: true, metadata: true },
    });

    // Filter for dislike_search context
    const filtered = events.filter(e => {
      if (!e.metadata) return false;
      try { return String(e.metadata).includes("dislike_search"); } catch { return false; }
    });

    // Aggregate by query
    const counts: Record<string, { count: number; totalResults: number }> = {};
    for (const e of filtered) {
      if (!e.query) continue;
      const q = e.query.toLowerCase().trim();
      if (!counts[q]) counts[q] = { count: 0, totalResults: 0 };
      counts[q].count++;
      counts[q].totalResults += e.resultsCount || 0;
    }

    const searches = Object.entries(counts)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([query, { count, totalResults }]) => ({
        query,
        count,
        hasResult: totalResults > 0,
      }));

    return NextResponse.json({ searches });
  } catch (e) {
    console.error("[Admin dislike searches]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
