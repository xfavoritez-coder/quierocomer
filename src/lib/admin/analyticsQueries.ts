import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
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
      // Exclude Genio dislike searches
      NOT: { metadata: { path: ["context"], equals: "dislike_search" } },
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

export async function getPersonalizationMetrics(restaurantId: string | null, from: Date, to: Date) {
  const rf = restaurantFilter(restaurantId);

  // Recommendation events
  const recEvents = await prisma.statEvent.findMany({
    where: { ...rf, eventType: { in: ["RECOMMENDATION_SHOWN", "RECOMMENDATION_TAPPED"] }, createdAt: { gte: from, lte: to } },
    select: { eventType: true, dishId: true, metadata: true },
    take: 10000,
  });
  const shown = recEvents.filter(e => e.eventType === "RECOMMENDATION_SHOWN").length;
  const tapped = recEvents.filter(e => e.eventType === "RECOMMENDATION_TAPPED").length;

  // Top recommended dishes
  const dishCounts: Record<string, { shown: number; tapped: number }> = {};
  for (const e of recEvents) {
    if (!e.dishId) continue;
    if (!dishCounts[e.dishId]) dishCounts[e.dishId] = { shown: 0, tapped: 0 };
    if (e.eventType === "RECOMMENDATION_SHOWN") dishCounts[e.dishId].shown++;
    if (e.eventType === "RECOMMENDATION_TAPPED") dishCounts[e.dishId].tapped++;
  }
  const topDishIds = Object.entries(dishCounts).sort((a, b) => b[1].shown - a[1].shown).slice(0, 10).map(([id]) => id);
  const topDishes = topDishIds.length ? await prisma.dish.findMany({ where: { id: { in: topDishIds } }, select: { id: true, name: true } }) : [];
  const dishNameMap = Object.fromEntries(topDishes.map(d => [d.id, d.name]));

  // Genio onboarding funnel
  const genioStarts = await prisma.statEvent.count({ where: { ...rf, eventType: "GENIO_START", createdAt: { gte: from, lte: to } } });
  const genioCompletes = await prisma.statEvent.count({ where: { ...rf, eventType: "GENIO_COMPLETE", createdAt: { gte: from, lte: to } } });

  // Diet distribution from guest profiles
  const guests = await prisma.guestProfile.findMany({
    where: { preferences: { not: Prisma.JsonNull }, lastSeenAt: { gte: from, lte: to } },
    select: { preferences: true },
    take: 5000,
  });
  const dietCounts: Record<string, number> = {};
  const restrictionCounts: Record<string, number> = {};
  for (const g of guests) {
    const prefs = g.preferences as any;
    if (prefs?.dietType) dietCounts[prefs.dietType] = (dietCounts[prefs.dietType] || 0) + 1;
    for (const r of (prefs?.restrictions || [])) {
      if (r !== "ninguna") restrictionCounts[r] = (restrictionCounts[r] || 0) + 1;
    }
  }

  // Favorite ingredients aggregated
  const guestsWithFavs = await prisma.guestProfile.findMany({
    where: { favoriteIngredients: { not: Prisma.JsonNull }, lastSeenAt: { gte: from, lte: to } },
    select: { favoriteIngredients: true },
    take: 2000,
  });
  const ingredientTotals: Record<string, number> = {};
  for (const g of guestsWithFavs) {
    const favs = g.favoriteIngredients as Record<string, number>;
    for (const [name, score] of Object.entries(favs)) {
      ingredientTotals[name] = (ingredientTotals[name] || 0) + score;
    }
  }
  const topIngredients = Object.entries(ingredientTotals).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name, score]) => ({ name, score }));

  // Favorites (thumbs up) count
  const favoritesCount = await prisma.dishFavorite.count({
    where: { ...(restaurantId ? { restaurantId } : {}), createdAt: { gte: from, lte: to } },
  });

  return {
    recommendations: {
      shown,
      tapped,
      ctr: shown > 0 ? Math.round((tapped / shown) * 100) : 0,
      topDishes: topDishIds.map(id => ({ name: dishNameMap[id] || id, ...dishCounts[id] })),
    },
    onboarding: {
      started: genioStarts,
      completed: genioCompletes,
      completionRate: genioStarts > 0 ? Math.round((genioCompletes / genioStarts) * 100) : 0,
    },
    audience: {
      totalProfiles: guests.length,
      diets: Object.entries(dietCounts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count, pct: Math.round((count / guests.length) * 100) })),
      restrictions: Object.entries(restrictionCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count })),
      topIngredients,
    },
    favorites: { total: favoritesCount },
  };
}

export async function getTopAttentionDishes(restaurantId: string | null, from: Date, to: Date) {
  const rf = restaurantFilter(restaurantId);
  const sessions = await prisma.session.findMany({
    where: { ...rf, startedAt: { gte: from, lte: to } },
    select: { dishesViewed: true },
    take: 5000,
  });

  // Aggregate modal opens per dish — only entries with detailMs > 0 count.
  // Legacy "views" (any dish that appeared in a session, including scroll
  // throughs) is no longer tracked.
  const stats: Record<string, { opens: number; totalDetailMs: number; uniqueSessions: number }> = {};
  for (const s of sessions) {
    const viewed = s.dishesViewed as any[];
    if (!Array.isArray(viewed)) continue;
    const seenInSession = new Set<string>();
    for (const d of viewed) {
      if (!d.dishId || !d.detailMs || d.detailMs <= 0) continue;
      if (!stats[d.dishId]) stats[d.dishId] = { opens: 0, totalDetailMs: 0, uniqueSessions: 0 };
      stats[d.dishId].opens++;
      stats[d.dishId].totalDetailMs += d.detailMs;
      if (!seenInSession.has(d.dishId)) { stats[d.dishId].uniqueSessions++; seenInSession.add(d.dishId); }
    }
  }

  const topIds = Object.entries(stats)
    .sort((a, b) => b[1].uniqueSessions - a[1].uniqueSessions)
    .slice(0, 15)
    .map(([id]) => id);

  if (topIds.length === 0) return { dishes: [], totalSessions: sessions.length };

  const dishes = await prisma.dish.findMany({
    where: { id: { in: topIds } },
    select: { id: true, name: true, price: true, photos: true, category: { select: { name: true } } },
  });
  const dishMap = Object.fromEntries(dishes.map(d => [d.id, d]));

  return {
    totalSessions: sessions.length,
    dishes: topIds.map(id => {
      const dish = dishMap[id];
      const data = stats[id];
      return {
        name: dish?.name || id,
        price: dish?.price || 0,
        photo: dish?.photos?.[0] || null,
        category: dish?.category?.name || "",
        opens: data.opens,
        uniqueSessions: data.uniqueSessions,
        avgDetailMs: data.opens > 0 ? Math.round(data.totalDetailMs / data.opens) : 0,
        totalDetailMs: data.totalDetailMs,
        openPct: sessions.length > 0 ? Math.round((data.uniqueSessions / sessions.length) * 100) : 0,
      };
    }),
  };
}

/**
 * Least-viewed active dishes — useful to surface "abandoned" dishes that
 * customers rarely see. Excludes brand-new dishes (created in the last 7 days)
 * to avoid penalizing dishes that haven't had a chance to be seen.
 */
export async function getLeastViewedDishes(restaurantId: string | null, from: Date, to: Date) {
  const rf = restaurantFilter(restaurantId);
  if (!restaurantId) return [];

  const sessions = await prisma.session.findMany({
    where: { ...rf, startedAt: { gte: from, lte: to } },
    select: { id: true, dishesViewed: true },
    take: 5000,
  });
  const totalSessions = sessions.length;

  // Count unique sessions that opened each dish's modal — entries without
  // detailMs > 0 represent legacy scroll-through and are not tracked anymore.
  const seen: Record<string, number> = {};
  for (const s of sessions) {
    const viewed = s.dishesViewed as any[];
    if (!Array.isArray(viewed)) continue;
    const inThis = new Set<string>();
    for (const d of viewed) {
      if (d.dishId && d.detailMs && d.detailMs > 0) inThis.add(d.dishId);
    }
    for (const id of inThis) seen[id] = (seen[id] || 0) + 1;
  }

  // Pull all active dishes for this restaurant, ignore the brand new ones
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const allDishes = await prisma.dish.findMany({
    where: {
      restaurantId,
      isActive: true,
      createdAt: { lt: sevenDaysAgo },
    },
    select: { id: true, name: true, photos: true },
  });
  if (allDishes.length === 0) return [];

  return allDishes
    .map(d => ({ id: d.id, name: d.name, photo: d.photos?.[0] || null, count: seen[d.id] || 0 }))
    .sort((a, b) => a.count - b.count)
    .slice(0, 10)
    .map(d => ({
      name: d.name,
      photo: d.photo,
      count: totalSessions > 0 ? `${Math.round((d.count / totalSessions) * 100)}%` : `${d.count}`,
    }));
}

/**
 * Top categories by total dwell time across all sessions in the window.
 * Each category appears once per session in `categoriesViewed` with the time
 * the user spent on that section. Useful to know which carta sections drive
 * attention regardless of dish-level performance — e.g. "Sushi" might capture
 * 40% of time even if individual sushi dishes don't top the dish ranking.
 */
export async function getTopCategoriesByDwell(restaurantId: string | null, from: Date, to: Date) {
  const rf = restaurantFilter(restaurantId);
  if (!restaurantId) return [];

  const sessions = await prisma.session.findMany({
    where: { ...rf, startedAt: { gte: from, lte: to } },
    select: { categoriesViewed: true },
    take: 5000,
  });

  const byCat: Record<string, { totalMs: number; sessions: number }> = {};
  for (const s of sessions) {
    const cats = s.categoriesViewed as any[];
    if (!Array.isArray(cats)) continue;
    const seenInSession = new Set<string>();
    for (const c of cats) {
      if (!c.categoryId || !c.dwellMs || c.dwellMs <= 0) continue;
      if (!byCat[c.categoryId]) byCat[c.categoryId] = { totalMs: 0, sessions: 0 };
      byCat[c.categoryId].totalMs += c.dwellMs;
      if (!seenInSession.has(c.categoryId)) {
        byCat[c.categoryId].sessions++;
        seenInSession.add(c.categoryId);
      }
    }
  }

  const ids = Object.keys(byCat);
  if (ids.length === 0) return [];

  const cats = await prisma.category.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  const nameMap = Object.fromEntries(cats.map(c => [c.id, c.name]));

  const totalMsAll = Object.values(byCat).reduce((s, x) => s + x.totalMs, 0);
  return ids
    .map(id => ({
      id,
      name: nameMap[id] || "Sin categoría",
      totalMs: byCat[id].totalMs,
      sessions: byCat[id].sessions,
      pct: totalMsAll > 0 ? Math.round((byCat[id].totalMs / totalMsAll) * 100) : 0,
    }))
    .sort((a, b) => b.totalMs - a.totalMs)
    .slice(0, 10);
}

const TIME_OF_DAY_LABELS: Record<string, { label: string; hint: string }> = {
  MORNING: { label: "Mañana", hint: "6–11" },
  LUNCH: { label: "Almuerzo", hint: "11–15" },
  AFTERNOON: { label: "Tarde", hint: "15–19" },
  DINNER: { label: "Cena", hint: "19–23" },
  LATE: { label: "Noche", hint: "23–6" },
};
const DIET_LABELS: Record<string, string> = {
  OMNIVORE: "Carnívoro",
  VEGAN: "Vegano",
  VEGETARIAN: "Vegetariano",
  PESCETARIAN: "Pescetariano",
};

/**
 * Aggregated customer-profile data for the /panel/analytics Clientes tab:
 * timeOfDay distribution, acquisition (QR vs direct + device split) and
 * dietary profile (declared diets, restrictions, allergens) of guests.
 */
export async function getClientesAnalytics(restaurantId: string | null, from: Date, to: Date) {
  const rf = restaurantFilter(restaurantId);
  const where = { ...rf, startedAt: { gte: from, lte: to } };

  const [timeGroups, qrScanCount, totalSessionsCount, deviceGroups, langGroups, sessions] = await Promise.all([
    prisma.session.groupBy({ by: ["timeOfDay"], where, _count: true }),
    prisma.session.count({ where: { ...where, isQrScan: true } }),
    prisma.session.count({ where }),
    prisma.session.groupBy({ by: ["deviceType"], where: { ...where, deviceType: { not: null } }, _count: true }),
    prisma.session.groupBy({ by: ["cartaLang"], where: { ...where, cartaLang: { not: null } }, _count: true }),
    prisma.session.findMany({
      where,
      select: {
        guestId: true,
        guest: { select: { preferences: true } },
        qrUser: { select: { dietType: true, restrictions: true } },
      },
      take: 5000,
    }),
  ]);

  const timeOfDay = (["MORNING", "LUNCH", "AFTERNOON", "DINNER", "LATE"]).map((key) => {
    const g = timeGroups.find((t) => t.timeOfDay === key);
    return {
      key,
      label: TIME_OF_DAY_LABELS[key]?.label || key,
      hint: TIME_OF_DAY_LABELS[key]?.hint || "",
      count: g?._count || 0,
    };
  });

  const directCount = Math.max(totalSessionsCount - qrScanCount, 0);
  const acquisition = {
    qrScans: qrScanCount,
    direct: directCount,
    qrPct: totalSessionsCount > 0 ? Math.round((qrScanCount / totalSessionsCount) * 100) : 0,
    directPct: totalSessionsCount > 0 ? Math.round((directCount / totalSessionsCount) * 100) : 0,
    devices: deviceGroups
      .map((d) => ({ name: d.deviceType || "unknown", count: d._count }))
      .sort((a, b) => b.count - a.count),
  };

  // Dietary profile — dedupe by guestId so we count one declaration per visitor
  const seenGuests = new Set<string>();
  const dietCount: Record<string, number> = {};
  const restrictionCount: Record<string, number> = {};
  for (const s of sessions) {
    if (seenGuests.has(s.guestId)) continue;
    seenGuests.add(s.guestId);
    const prefs = (s.guest?.preferences as any) || {};
    const diet = s.qrUser?.dietType || prefs?.dietType;
    if (diet) dietCount[diet] = (dietCount[diet] || 0) + 1;
    const restrictions = (s.qrUser?.restrictions || prefs?.restrictions || []) as string[];
    for (const r of restrictions) {
      const key = r.toLowerCase();
      if (!key || key === "ninguna" || key === "ninguno") continue;
      restrictionCount[key] = (restrictionCount[key] || 0) + 1;
    }
  }
  const diets = Object.entries(dietCount)
    .map(([key, count]) => ({ key, label: DIET_LABELS[key] || key, count }))
    .sort((a, b) => b.count - a.count);
  const restrictions = Object.entries(restrictionCount)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const totalDietGuests = diets.reduce((s, d) => s + d.count, 0);

  const languages = langGroups
    .map((l) => ({ code: l.cartaLang || "es", count: l._count }))
    .sort((a, b) => b.count - a.count);

  return {
    timeOfDay,
    acquisition,
    dietProfile: { diets, totalDietGuests, restrictions },
    languages,
    totalSessions: totalSessionsCount,
  };
}
