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
    _unusedReturning,
    convertedGuestsResult,
    durationAgg,
    // dishesViewed is JSON so we still need in-memory for avg dishes
    dishSessions,
    // Eventos BIRTHDAY_SAVED en periodo — los validamos abajo contra la
    // persistencia real para no contar fantasmas si el register fallo.
    birthdayEventsRaw,
    // Guests in this period — to cross-check with prior visits
    guestsInPeriod,
  ] = await Promise.all([
    prisma.session.count({ where }),
    prisma.session.groupBy({ by: ["guestId"], where, _count: true }).then((r) => r.length),
    Promise.resolve(0), // replaced by true returning calculation below
    prisma.session.groupBy({ by: ["guestId"], where: { ...where, converted: true }, _count: true }).then((r) => r.length),
    prisma.session.aggregate({ where: { ...where, durationMs: { gt: 0 } }, _avg: { durationMs: true } }),
    prisma.session.findMany({ where, select: { dishesViewed: true }, take: 5000 }),
    prisma.statEvent.groupBy({
      by: ["guestId"],
      where: {
        eventType: "BIRTHDAY_SAVED" as any,
        ...rf,
        createdAt: { gte: from, lte: to },
      },
      _count: true,
    }),
    // Distinct guests in this period — for true returning calculation
    prisma.session.findMany({
      where,
      select: { guestId: true },
      distinct: ["guestId"],
    }),
  ]);

  // True returning: guests who visited in THIS period AND have sessions on a DIFFERENT day before the period
  let returningGuestsResult = 0;
  if (guestsInPeriod.length > 0) {
    const guestIds = guestsInPeriod.map(g => g.guestId).filter(Boolean) as string[];
    if (guestIds.length > 0) {
      // Find guests who have at least one session BEFORE this period started
      const priorVisitors = await prisma.session.groupBy({
        by: ["guestId"],
        where: {
          ...rf,
          guestId: { in: guestIds },
          startedAt: { lt: from },
        },
      });
      returningGuestsResult = priorVisitors.length;
    }
  }

  // Saco el cast aca — Prisma puede tipar guestId como string|null en groupBy
  // y dentro de Promise.all el type guard del .filter no se propaga bien al
  // tipo final de la tupla.
  const birthdayEventGuests: string[] = [];
  for (const ev of birthdayEventsRaw) {
    if (ev.guestId) birthdayEventGuests.push(ev.guestId);
  }

  // Verificacion real: del set de guests que dispararon BIRTHDAY_SAVED, contar
  // solo aquellos cuyo cumple efectivamente quedo guardado (en GuestProfile.preferences
  // .birthday O en qrUser.birthDate vinculado). Si el register fallo, el evento
  // queda huerfano y NO se cuenta — la metrica refleja la realidad.
  let birthdayGuestsResult = 0;
  if (birthdayEventGuests.length > 0) {
    const guests = await prisma.guestProfile.findMany({
      where: { id: { in: birthdayEventGuests } },
      select: { id: true, preferences: true, linkedQrUserId: true },
    });
    const linkedUserIds: string[] = [];
    for (const g of guests) {
      if (g.linkedQrUserId) linkedUserIds.push(g.linkedQrUserId);
    }
    const users = linkedUserIds.length
      ? await prisma.qRUser.findMany({ where: { id: { in: linkedUserIds } }, select: { id: true, birthDate: true } })
      : [];
    const userBirthdayMap = new Map(users.map((u) => [u.id, !!u.birthDate]));
    for (const g of guests) {
      const prefs = (g.preferences as any) || {};
      const inPrefs = !!prefs?.birthday;
      const inLinkedUser = !!(g.linkedQrUserId && userBirthdayMap.get(g.linkedQrUserId));
      if (inPrefs || inLinkedUser) birthdayGuestsResult++;
    }
  }

  const totalVisitors = uniqueGuestsResult;
  const returningVisitors = returningGuestsResult;
  const convertedCount = convertedGuestsResult;

  const dishCounts = dishSessions.map((s) => {
    const dv = s.dishesViewed as any[];
    return Array.isArray(dv) ? dv.length : 0;
  });
  // Engagement: visitantes UNICOS que abrieron al menos 1 plato (detailMs > 0).
  // Mas accionable que 'tiempo promedio' — distingue scans pasivos de exploracion real.
  const engagedSessionsRaw = await prisma.session.findMany({
    where: { ...where },
    select: { guestId: true, dishesViewed: true },
    take: 5000,
  });
  const engagedGuestIds = new Set<string>();
  for (const s of engagedSessionsRaw) {
    const viewed = s.dishesViewed as any[];
    if (!Array.isArray(viewed)) continue;
    if (viewed.some((v: any) => v?.dishId && (v.detailMs ?? 0) > 0)) {
      engagedGuestIds.add(s.guestId);
    }
  }
  const engagedVisitors = engagedGuestIds.size;

  // Genio: distinct guests que abrieron el Genio (GENIO_START) en periodo.
  const genioGuests = await prisma.statEvent.groupBy({
    by: ["guestId"],
    where: {
      eventType: "GENIO_START" as any,
      ...rf,
      createdAt: { gte: from, lte: to },
    },
    _count: true,
  });
  const genioUsers = genioGuests.length;

  return {
    totalVisitors,
    returningVisitors,
    returningPct: totalVisitors > 0 ? Math.round((returningVisitors / totalVisitors) * 100) : 0,
    convertedCount,
    conversionPct: totalVisitors > 0 ? Math.round((convertedCount / totalVisitors) * 100) : 0,
    totalSessions,
    avgDurationMs: Math.round(durationAgg._avg.durationMs || 0),
    avgDishesViewed: dishCounts.length > 0 ? Math.round((dishCounts.reduce((a, b) => a + b, 0) / dishCounts.length) * 10) / 10 : 0,
    birthdaysSaved: birthdayGuestsResult,
    birthdayPct: totalVisitors > 0 ? Math.round((birthdayGuestsResult / totalVisitors) * 100) : 0,
    avgVisitsPerGuest: totalVisitors > 0 ? Math.round((totalSessions / totalVisitors) * 10) / 10 : 0,
    engagedVisitors,
    engagementPct: totalVisitors > 0 ? Math.round((engagedVisitors / totalVisitors) * 100) : 0,
    genioUsers,
    genioUsedPct: totalVisitors > 0 ? Math.round((genioUsers / totalVisitors) * 100) : 0,
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
    },
    select: { query: true, guestId: true, restaurantId: true, createdAt: true, resultsCount: true, metadata: true },
    take: 5000,
  });

  // Aggregate (exclude Genio dislike searches in JS to avoid Prisma Json path issues with null metadata)
  const map = new Map<string, { count: number; visitors: Set<string>; restaurants: Set<string>; lastAt: Date }>();
  for (const s of searches) {
    if ((s as any).metadata && (s as any).metadata.context === "dislike_search") continue;
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

/**
 * Salud de la carta: detecta platos activos sin foto, sin descripcion, o
 * con descripcion floja (< 20 chars). Util para que el dueño priorice
 * trabajo editorial en la carta.
 */
export async function getMenuHealth(restaurantId: string | null) {
  if (!restaurantId) return null;
  const dishes = await prisma.dish.findMany({
    where: { restaurantId, isActive: true, deletedAt: null },
    select: { id: true, name: true, photos: true, description: true, price: true },
  });

  const total = dishes.length;
  const withoutPhoto = dishes.filter(d => !d.photos || d.photos.length === 0);
  const withoutDescription = dishes.filter(d => !d.description || d.description.trim().length === 0);
  const weakDescription = dishes.filter(d => {
    const desc = (d.description || "").trim();
    return desc.length > 0 && desc.length < 20;
  });
  const withoutPrice = dishes.filter(d => !d.price || Number(d.price) <= 0);

  // Score 0-100: 100 = perfecto, baja por cada problema
  const issues = withoutPhoto.length + withoutDescription.length + weakDescription.length + withoutPrice.length;
  const denom = total * 4 || 1;
  const healthScore = Math.max(0, Math.round(100 - (issues / denom) * 100));

  return {
    total,
    healthScore,
    withoutPhoto: { count: withoutPhoto.length, samples: withoutPhoto.slice(0, 5).map(d => ({ id: d.id, name: d.name })) },
    withoutDescription: { count: withoutDescription.length, samples: withoutDescription.slice(0, 5).map(d => ({ id: d.id, name: d.name })) },
    weakDescription: { count: weakDescription.length, samples: weakDescription.slice(0, 5).map(d => ({ id: d.id, name: d.name })) },
    withoutPrice: { count: withoutPrice.length, samples: withoutPrice.slice(0, 5).map(d => ({ id: d.id, name: d.name })) },
  };
}

/**
 * Top dish por horario del día (Mañana / Almuerzo / Tarde / Cena / Noche).
 * Cada sesion tiene un timeOfDay calculado al inicio. Para cada bucket
 * contamos aperturas únicas de plato (detail > 0) y devolvemos el top 1.
 * Util para que el dueño sepa "el plato estrella del almuerzo" vs "de la cena".
 */
export async function getPopularByTimeOfDay(restaurantId: string | null, from: Date, to: Date) {
  if (!restaurantId) return [];
  const rf = restaurantFilter(restaurantId);

  const sessions = await prisma.session.findMany({
    where: { ...rf, startedAt: { gte: from, lte: to }, timeOfDay: { not: null } },
    select: { timeOfDay: true, dishesViewed: true },
    take: 5000,
  });

  const buckets: Record<string, Map<string, number>> = {
    MORNING: new Map(), LUNCH: new Map(), AFTERNOON: new Map(),
    DINNER: new Map(), LATE: new Map(),
  };

  for (const s of sessions) {
    const tod = s.timeOfDay as string | null;
    if (!tod || !buckets[tod]) continue;
    const viewed = s.dishesViewed as any[];
    if (!Array.isArray(viewed)) continue;
    const seen = new Set<string>();
    for (const v of viewed) {
      if (!v?.dishId || (v.detailMs ?? 0) <= 0 || seen.has(v.dishId)) continue;
      seen.add(v.dishId);
      const m = buckets[tod];
      m.set(v.dishId, (m.get(v.dishId) || 0) + 1);
    }
  }

  const top: { key: string; dishId: string; count: number }[] = [];
  for (const [key, m] of Object.entries(buckets)) {
    const sorted = [...m.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) continue;
    top.push({ key, dishId: sorted[0][0], count: sorted[0][1] });
  }

  if (top.length === 0) return [];

  const dishIds = top.map(t => t.dishId);
  const dishes = await prisma.dish.findMany({
    where: { id: { in: dishIds } },
    select: {
      id: true, name: true, photos: true, toteatProductId: true,
      modifierTemplates: { select: { groups: { select: { options: { where: { toteatProductId: { not: null } }, select: { toteatProductId: true } } } } } },
    },
  });
  const dishMap = Object.fromEntries(dishes.map(d => [d.id, d]));

  // Cruzar con ventas de Toteat: si el plato tiene toteatProductId (o modifiers
  // mapeados) y hay ventas en el periodo, contamos las unidades vendidas.
  // Solo se aplica si el local tiene Toteat conectado — si no, salesByDish
  // queda vacio y el frontend lo trata como sin Toteat.
  const allToteatIds = new Set<string>();
  for (const d of dishes) {
    if (d.toteatProductId) allToteatIds.add(d.toteatProductId);
    for (const tpl of d.modifierTemplates) for (const grp of tpl.groups) for (const opt of grp.options) {
      if (opt.toteatProductId) allToteatIds.add(opt.toteatProductId);
    }
  }
  const salesByDish: Record<string, number> = {};
  if (allToteatIds.size > 0) {
    const sales = await prisma.toteatSale.findMany({
      where: { restaurantId, dateClosed: { gte: from, lte: to } },
      select: { products: { select: { toteatProductId: true, quantity: true } } },
    });
    const qtyByCode = new Map<string, number>();
    for (const s of sales) for (const p of s.products) {
      qtyByCode.set(p.toteatProductId, (qtyByCode.get(p.toteatProductId) || 0) + (p.quantity || 0));
    }
    for (const d of dishes) {
      let qty = 0;
      if (d.toteatProductId) qty += qtyByCode.get(d.toteatProductId) || 0;
      for (const tpl of d.modifierTemplates) for (const grp of tpl.groups) for (const opt of grp.options) {
        if (opt.toteatProductId) qty += qtyByCode.get(opt.toteatProductId) || 0;
      }
      if (qty > 0) salesByDish[d.id] = qty;
    }
  }

  const ORDER = ["MORNING", "LUNCH", "AFTERNOON", "DINNER", "LATE"];
  return top
    .map(t => ({
      key: t.key,
      label: TIME_OF_DAY_LABELS[t.key]?.label || t.key,
      hint: TIME_OF_DAY_LABELS[t.key]?.hint || "",
      dishId: t.dishId,
      name: dishMap[t.dishId]?.name || "?",
      photo: dishMap[t.dishId]?.photos?.[0] || null,
      count: t.count,
      sales: salesByDish[t.dishId] || 0,
    }))
    .sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key));
}

const DIET_LABELS: Record<string, string> = {
  OMNIVORE: "Carnívoro",
  VEGAN: "Vegano",
  VEGETARIAN: "Vegetariano",
  PESCETARIAN: "Pescetariano",
};
// Etiquetas amigables para restricciones — los valores en DB vienen en es-lowercase
// pero algunos son codigos internos (_spicy) o variantes (soja vs soya) que conviene unificar.
const RESTRICTION_LABELS: Record<string, string> = {
  "_spicy": "Sin picante",
  "spicy": "Sin picante",
  "gluten": "Sin gluten",
  "lactosa": "Sin lactosa",
  "soja": "Sin soya",
  "soya": "Sin soya",
  "frutos secos": "Sin frutos secos",
  "mariscos": "Sin mariscos",
  "cerdo": "Sin cerdo",
  "pescado": "Sin pescado",
  "huevo": "Sin huevo",
  "alcohol": "Sin alcohol",
  "mani": "Sin maní",
  "maní": "Sin maní",
  "nueces": "Sin nueces",
  "almendras": "Sin almendras",
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
    if (diet) {
      // Normalizar a uppercase: el enum del schema viene UPPER pero localStorage del Genio lower
      const dietKey = String(diet).toUpperCase();
      dietCount[dietKey] = (dietCount[dietKey] || 0) + 1;
    }
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
    .map(([name, count]) => ({ name, label: RESTRICTION_LABELS[name] || name, count }))
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
