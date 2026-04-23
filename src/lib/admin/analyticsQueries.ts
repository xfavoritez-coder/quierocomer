import { prisma } from "@/lib/prisma";
import type { VisitorMetrics, FunnelData, TicketTrend, FailedSearch, GenioImpactComparison } from "@/types/analytics";

function restaurantFilter(restaurantId: string | null) {
  return restaurantId ? { restaurantId } : {};
}

export async function getVisitorMetrics(restaurantId: string | null, from: Date, to: Date): Promise<VisitorMetrics> {
  const rf = restaurantFilter(restaurantId);
  const where = { ...rf, startedAt: { gte: from, lte: to } };

  // Use DB aggregations instead of loading all sessions into memory
  const [
    totalSessions,
    uniqueGuestsResult,
    returningGuestsResult,
    convertedGuestsResult,
    durationAgg,
    // dishesViewed is JSON so we still need in-memory for avg dishes
    dishSessions,
  ] = await Promise.all([
    prisma.session.count({ where }),
    prisma.session.groupBy({ by: ["guestId"], where, _count: true }).then((r) => r.length),
    prisma.session.groupBy({ by: ["guestId"], where: { ...where, isReturningVisitor: true }, _count: true }).then((r) => r.length),
    prisma.session.groupBy({ by: ["guestId"], where: { ...where, converted: true }, _count: true }).then((r) => r.length),
    prisma.session.aggregate({ where: { ...where, durationMs: { gt: 0 } }, _avg: { durationMs: true } }),
    prisma.session.findMany({ where, select: { dishesViewed: true }, take: 5000 }),
  ]);

  const totalVisitors = uniqueGuestsResult;
  const returningVisitors = returningGuestsResult;
  const convertedCount = convertedGuestsResult;

  const dishCounts = dishSessions.map((s) => {
    const dv = s.dishesViewed as any[];
    return Array.isArray(dv) ? dv.length : 0;
  });

  return {
    totalVisitors,
    returningVisitors,
    returningPct: totalVisitors > 0 ? Math.round((returningVisitors / totalVisitors) * 100) : 0,
    convertedCount,
    conversionPct: totalVisitors > 0 ? Math.round((convertedCount / totalVisitors) * 100) : 0,
    totalSessions,
    avgDurationMs: Math.round(durationAgg._avg.durationMs || 0),
    avgDishesViewed: dishCounts.length > 0 ? Math.round((dishCounts.reduce((a, b) => a + b, 0) / dishCounts.length) * 10) / 10 : 0,
  };
}

export async function getFunnelConversion(restaurantId: string | null, from: Date, to: Date): Promise<FunnelData> {
  const rf = restaurantFilter(restaurantId);

  // All unique ghosts with sessions in the period
  const sessions = await prisma.session.findMany({
    where: { ...rf, startedAt: { gte: from, lte: to } },
    select: { guestId: true, isReturningVisitor: true, converted: true, qrUserId: true },
  });

  const allGhosts = new Set(sessions.map((s) => s.guestId));
  const returnedGhosts = new Set(sessions.filter((s) => s.isReturningVisitor).map((s) => s.guestId));

  // Ghosts that converted in this period
  const convertedGhosts = await prisma.guestProfile.findMany({
    where: {
      id: { in: [...allGhosts] },
      convertedToUserAt: { gte: from, lte: to },
    },
    select: { id: true, linkedQrUserId: true },
  });

  // Activated = converted users who came back as registered
  const convertedUserIds = convertedGhosts.map((g) => g.linkedQrUserId).filter(Boolean) as string[];
  const activatedCount = convertedUserIds.length > 0
    ? await prisma.session.groupBy({
        by: ["qrUserId"],
        where: { qrUserId: { in: convertedUserIds }, startedAt: { gte: from, lte: to } },
        _count: true,
        having: { qrUserId: { _count: { gt: 1 } } },
      }).then((r) => r.length)
    : 0;

  return {
    totalGhosts: allGhosts.size,
    returnedGhosts: returnedGhosts.size,
    returnedPct: allGhosts.size > 0 ? Math.round((returnedGhosts.size / allGhosts.size) * 100) : 0,
    convertedUsers: convertedGhosts.length,
    convertedPct: returnedGhosts.size > 0 ? Math.round((convertedGhosts.length / returnedGhosts.size) * 100) : 0,
    activatedUsers: activatedCount,
    activatedPct: convertedGhosts.length > 0 ? Math.round((activatedCount / convertedGhosts.length) * 100) : 0,
  };
}

export async function getAverageTicketByWeek(restaurantId: string, weeksBack: number): Promise<TicketTrend[]> {
  const from = new Date();
  from.setDate(from.getDate() - weeksBack * 7);

  const tickets = await prisma.restaurantTicket.findMany({
    where: { restaurantId, paidAt: { gte: from } },
    select: { ticketTotal: true, paidAt: true },
    orderBy: { paidAt: "asc" },
  });

  // Group by ISO week
  const weeks = new Map<string, { total: number; count: number }>();
  for (const t of tickets) {
    const d = new Date(t.paidAt);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(d.setDate(diff)).toISOString().split("T")[0];
    const existing = weeks.get(weekStart) || { total: 0, count: 0 };
    existing.total += Number(t.ticketTotal);
    existing.count++;
    weeks.set(weekStart, existing);
  }

  const result: TicketTrend[] = [];
  let prev: number | null = null;
  for (const [weekStart, data] of weeks) {
    const avg = Math.round(data.total / data.count);
    result.push({
      weekStart,
      avgTicket: avg,
      ticketCount: data.count,
      changePct: prev !== null ? Math.round(((avg - prev) / prev) * 100) : null,
    });
    prev = avg;
  }

  return result;
}

export async function getFailedSearches(restaurantId: string | null, from: Date, to: Date): Promise<FailedSearch[]> {
  const rf = restaurantFilter(restaurantId);

  const searches = await prisma.statEvent.findMany({
    where: {
      ...rf,
      eventType: "SEARCH_PERFORMED",
      createdAt: { gte: from, lte: to },
      query: { not: null },
      OR: [{ resultsCount: 0 }, { clickedResultId: null }],
    },
    select: { query: true, guestId: true, restaurantId: true, createdAt: true, resultsCount: true },
    take: 5000,
  });

  // Aggregate
  const map = new Map<string, { count: number; visitors: Set<string>; restaurants: Set<string>; lastAt: Date }>();
  for (const s of searches) {
    const q = (s.query || "").toLowerCase().trim();
    if (!q) continue;
    const existing = map.get(q) || { count: 0, visitors: new Set(), restaurants: new Set(), lastAt: new Date(0) };
    existing.count++;
    if (s.guestId) existing.visitors.add(s.guestId);
    existing.restaurants.add(s.restaurantId);
    if (s.createdAt > existing.lastAt) existing.lastAt = s.createdAt;
    map.set(q, existing);
  }

  return [...map.entries()]
    .map(([query, data]) => ({
      query,
      timesSearched: data.count,
      uniqueVisitors: data.visitors.size,
      restaurants: [...data.restaurants],
      lastSearchedAt: data.lastAt.toISOString(),
    }))
    .sort((a, b) => b.uniqueVisitors - a.uniqueVisitors);
}

export async function getGenioImpact(restaurantId: string | null, from: Date, to: Date): Promise<GenioImpactComparison> {
  const rf = restaurantFilter(restaurantId);

  // Sessions with Genio = sessions that have GENIO_START event
  const genioEvents = await prisma.statEvent.findMany({
    where: { ...rf, eventType: "GENIO_START", createdAt: { gte: from, lte: to } },
    select: { sessionId: true },
    take: 5000,
  });
  const genioSessionIds = new Set(genioEvents.map((e) => e.sessionId));

  const allSessions = await prisma.session.findMany({
    where: { ...rf, startedAt: { gte: from, lte: to } },
    select: { id: true, guestId: true, durationMs: true, dishesViewed: true, converted: true, isReturningVisitor: true },
    take: 5000,
  });

  const withGenio = allSessions.filter((s) => genioSessionIds.has(s.id));
  const withoutGenio = allSessions.filter((s) => !genioSessionIds.has(s.id));

  function computeMetrics(sessions: typeof allSessions) {
    if (sessions.length === 0) return { avgDishesViewed: 0, avgDurationMs: 0, conversionRate: 0, returnRate: 0, sessionCount: 0 };
    const durations = sessions.map((s) => s.durationMs || 0);
    const dishCounts = sessions.map((s) => Array.isArray(s.dishesViewed) ? (s.dishesViewed as any[]).length : 0);
    const converted = sessions.filter((s) => s.converted).length;
    const returning = sessions.filter((s) => s.isReturningVisitor).length;
    return {
      avgDishesViewed: Math.round((dishCounts.reduce((a, b) => a + b, 0) / sessions.length) * 10) / 10,
      avgDurationMs: Math.round(durations.reduce((a, b) => a + b, 0) / sessions.length),
      conversionRate: Math.round((converted / sessions.length) * 100),
      returnRate: Math.round((returning / sessions.length) * 100),
      sessionCount: sessions.length,
    };
  }

  return { withGenio: computeMetrics(withGenio), withoutGenio: computeMetrics(withoutGenio) };
}
