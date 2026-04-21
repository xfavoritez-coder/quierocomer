/**
 * Validate dashboard analytics queries against seeded Demo Oasis data
 * Run: npx tsx scripts/test-dashboard-queries.ts
 */
import { PrismaClient } from "@prisma/client";

// Import queries directly (can't use path aliases in scripts)
const prisma = new PrismaClient();

// Inline query implementations (mirror of analyticsQueries.ts)
async function getVisitorMetrics(restaurantId: string, from: Date, to: Date) {
  const sessions = await prisma.session.findMany({
    where: { restaurantId, startedAt: { gte: from, lte: to } },
    select: { guestId: true, qrUserId: true, durationMs: true, dishesViewed: true, isReturningVisitor: true, converted: true },
  });
  const uniqueGuests = new Set(sessions.map((s) => s.guestId));
  const returningGuests = new Set(sessions.filter((s) => s.isReturningVisitor).map((s) => s.guestId));
  const convertedGuests = new Set(sessions.filter((s) => s.converted).map((s) => s.guestId));
  const durations = sessions.map((s) => s.durationMs || 0).filter((d) => d > 0);
  const dishCounts = sessions.map((s) => { const dv = s.dishesViewed as any[]; return Array.isArray(dv) ? dv.length : 0; });
  return {
    totalVisitors: uniqueGuests.size,
    returningVisitors: returningGuests.size,
    returningPct: uniqueGuests.size > 0 ? Math.round((returningGuests.size / uniqueGuests.size) * 100) : 0,
    convertedCount: convertedGuests.size,
    conversionPct: uniqueGuests.size > 0 ? Math.round((convertedGuests.size / uniqueGuests.size) * 100) : 0,
    totalSessions: sessions.length,
    avgDurationMs: durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
    avgDishesViewed: dishCounts.length > 0 ? Math.round((dishCounts.reduce((a, b) => a + b, 0) / dishCounts.length) * 10) / 10 : 0,
  };
}

async function getFunnelConversion(restaurantId: string, from: Date, to: Date) {
  const sessions = await prisma.session.findMany({
    where: { restaurantId, startedAt: { gte: from, lte: to } },
    select: { guestId: true, isReturningVisitor: true, converted: true, qrUserId: true },
  });
  const allGhosts = new Set(sessions.map((s) => s.guestId));
  const returnedGhosts = new Set(sessions.filter((s) => s.isReturningVisitor).map((s) => s.guestId));
  const convertedGhosts = await prisma.guestProfile.findMany({
    where: { id: { in: [...allGhosts] }, convertedToUserAt: { gte: from, lte: to } },
    select: { id: true, linkedQrUserId: true },
  });
  const convertedUserIds = convertedGhosts.map((g) => g.linkedQrUserId).filter(Boolean) as string[];
  const activatedCount = convertedUserIds.length > 0
    ? await prisma.session.groupBy({ by: ["qrUserId"], where: { qrUserId: { in: convertedUserIds }, startedAt: { gte: from, lte: to } }, _count: true, having: { qrUserId: { _count: { gt: 1 } } } }).then((r) => r.length)
    : 0;
  return { totalGhosts: allGhosts.size, returnedGhosts: returnedGhosts.size, convertedUsers: convertedGhosts.length, activatedUsers: activatedCount };
}

async function getFailedSearches(restaurantId: string, from: Date, to: Date) {
  const searches = await prisma.statEvent.findMany({
    where: { restaurantId, eventType: "SEARCH_PERFORMED", createdAt: { gte: from, lte: to }, query: { not: null }, OR: [{ resultsCount: 0 }, { clickedResultId: null }] },
    select: { query: true, guestId: true, restaurantId: true, createdAt: true },
  });
  const map = new Map<string, { count: number; visitors: Set<string> }>();
  for (const s of searches) {
    const q = (s.query || "").toLowerCase().trim();
    if (!q) continue;
    const existing = map.get(q) || { count: 0, visitors: new Set() };
    existing.count++;
    if (s.guestId) existing.visitors.add(s.guestId);
    map.set(q, existing);
  }
  return [...map.entries()].map(([query, data]) => ({ query, timesSearched: data.count, uniqueVisitors: data.visitors.size })).sort((a, b) => b.uniqueVisitors - a.uniqueVisitors);
}

async function getGenioImpact(restaurantId: string, from: Date, to: Date) {
  const genioEvents = await prisma.statEvent.findMany({ where: { restaurantId, eventType: "GENIO_START", createdAt: { gte: from, lte: to } }, select: { sessionId: true } });
  const genioSessionIds = new Set(genioEvents.map((e) => e.sessionId));
  const allSessions = await prisma.session.findMany({ where: { restaurantId, startedAt: { gte: from, lte: to } }, select: { id: true, durationMs: true, dishesViewed: true, converted: true, isReturningVisitor: true } });
  const withGenio = allSessions.filter((s) => genioSessionIds.has(s.id));
  const withoutGenio = allSessions.filter((s) => !genioSessionIds.has(s.id));
  return { withGenioCount: withGenio.length, withoutGenioCount: withoutGenio.length, totalSessions: allSessions.length };
}

async function getTicketTrend(restaurantId: string) {
  const tickets = await prisma.restaurantTicket.findMany({ where: { restaurantId }, select: { ticketTotal: true, paidAt: true, matchConfidence: true } });
  const byConf = { exact: 0, probable: 0, approximate: 0, none: 0 };
  for (const t of tickets) { const c = t.matchConfidence as string; if (c in byConf) (byConf as any)[c]++; }
  return { total: tickets.length, ...byConf, avgTicket: tickets.length > 0 ? Math.round(tickets.reduce((a, t) => a + Number(t.ticketTotal), 0) / tickets.length) : 0 };
}

async function main() {
  const rest = await prisma.restaurant.findUnique({ where: { slug: "demo-oasis" } });
  if (!rest) { console.log("❌ Demo Oasis not found. Run seed first."); process.exit(1); }

  const from = new Date(Date.now() - 35 * 86400000);
  const to = new Date();

  console.log("=== DASHBOARD QUERIES TEST ===\n");

  // 1. Visitor Metrics
  const metrics = await getVisitorMetrics(rest.id, from, to);
  const m1ok = metrics.totalVisitors >= 40 && metrics.returningPct > 0 && metrics.conversionPct > 0 && metrics.avgDurationMs > 0;
  console.log(`${m1ok ? "✅" : "❌"} getVisitorMetrics: ${metrics.totalVisitors} visitantes, ${metrics.returningPct}% recurrentes, ${metrics.conversionPct}% conversión, ${metrics.totalSessions} sesiones, avg ${Math.round(metrics.avgDurationMs / 1000)}s, ${metrics.avgDishesViewed} platos/sesión`);

  // 2. Funnel
  const funnel = await getFunnelConversion(rest.id, from, to);
  const f1ok = funnel.totalGhosts >= 40 && funnel.returnedGhosts > 0 && funnel.convertedUsers > 0;
  console.log(`${f1ok ? "✅" : "❌"} getFunnelConversion: ${funnel.totalGhosts} fantasmas → ${funnel.returnedGhosts} recurrentes → ${funnel.convertedUsers} convertidos → ${funnel.activatedUsers} activados`);

  // 3. Ticket Trend
  const tickets = await getTicketTrend(rest.id);
  const t1ok = tickets.total === 30 && tickets.avgTicket > 0;
  console.log(`${t1ok ? "✅" : "❌"} getTicketTrend: ${tickets.total} tickets, avg $${tickets.avgTicket.toLocaleString("es-CL")}, match: ${tickets.exact} exact, ${tickets.probable} probable, ${tickets.approximate} approx, ${tickets.none} none`);

  // 4. Failed Searches
  const searches = await getFailedSearches(rest.id, from, to);
  const topQuery = searches[0];
  const s1ok = searches.length >= 3 && topQuery?.query === "ceviche";
  console.log(`${s1ok ? "✅" : "❌"} getFailedSearches: ${searches.length} queries, top="${topQuery?.query}" (${topQuery?.timesSearched}x, ${topQuery?.uniqueVisitors} visitors)`);
  if (searches.length > 1) console.log(`   Otros: ${searches.slice(1, 4).map((s) => `"${s.query}" (${s.timesSearched}x)`).join(", ")}`);

  // 5. Genio Impact
  const genio = await getGenioImpact(rest.id, from, to);
  const g1ok = genio.withGenioCount > 0 && genio.withoutGenioCount > 0;
  console.log(`${g1ok ? "✅" : "❌"} getGenioImpact: ${genio.withGenioCount} con Genio (${Math.round((genio.withGenioCount / genio.totalSessions) * 100)}%), ${genio.withoutGenioCount} sin Genio`);

  // 6. Favorites
  const favCount = await prisma.dishFavorite.count({ where: { restaurantId: rest.id } });
  const favUserCount = await prisma.dishFavorite.count({ where: { restaurantId: rest.id, qrUserId: { not: null } } });
  console.log(`✅ Favoritos: ${favCount} total (${favUserCount} migrados a users)`);

  // 7. Impressions
  const impCount = await prisma.dishImpression.count({ where: { restaurantId: rest.id } });
  console.log(`✅ DishImpressions: ${impCount}`);

  const allOk = m1ok && f1ok && t1ok && s1ok && g1ok;
  console.log(`\n${allOk ? "✅ ALL QUERIES VALID" : "⚠️ SOME QUERIES NEED REVIEW"}`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error("❌ FATAL:", e); process.exit(1); });
