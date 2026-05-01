import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  checkAdminAuth,
  requireRestaurantForOwner,
  getOwnedRestaurantIds,
  isSuperAdmin,
  authErrorResponse,
} from "@/lib/adminAuth";

export async function DELETE(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const { sessionId, sessionIds } = await req.json();
    const ids: string[] = sessionIds || (sessionId ? [sessionId] : []);
    if (ids.length === 0) return NextResponse.json({ error: "sessionId o sessionIds requerido" }, { status: 400 });

    // Delete related records first, then sessions
    await prisma.statEvent.deleteMany({ where: { dbSessionId: { in: ids } } });
    await prisma.waiterCall.deleteMany({ where: { sessionId: { in: ids } } });
    await prisma.session.deleteMany({ where: { id: { in: ids } } });

    return NextResponse.json({ ok: true, deleted: ids.length });
  } catch (e: any) {
    console.error("Session delete error:", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const url = new URL(req.url);
    const restaurantId = url.searchParams.get("restaurantId");
    const dateFilter = url.searchParams.get("date"); // YYYY-MM-DD
    const dateFrom = url.searchParams.get("from"); // YYYY-MM-DD
    const dateTo = url.searchParams.get("to"); // YYYY-MM-DD
    const page = parseInt(url.searchParams.get("page") || "1");
    const activity = url.searchParams.get("activity"); // genio | garzon | cumple | favoritos
    const limit = 30;
    const skip = (page - 1) * limit;

    // Build where filter with ownership enforcement
    const where: any = {};

    if (dateFilter) {
      const start = new Date(dateFilter + "T00:00:00");
      const end = new Date(dateFilter + "T23:59:59.999");
      where.startedAt = { gte: start, lte: end };
    } else if (dateFrom || dateTo) {
      where.startedAt = {};
      if (dateFrom) where.startedAt.gte = new Date(dateFrom + "T00:00:00");
      if (dateTo) where.startedAt.lte = new Date(dateTo + "T23:59:59.999");
    }

    if (restaurantId) {
      await requireRestaurantForOwner(req, restaurantId);
      where.restaurantId = restaurantId;
    } else if (!isSuperAdmin(req)) {
      // Owner without specific filter: show all their restaurants
      const ownedIds = await getOwnedRestaurantIds(req);
      if (!ownedIds || ownedIds.length === 0) {
        return NextResponse.json({ sessions: [], total: 0, page: 1, totalPages: 0 });
      }
      where.restaurantId = { in: ownedIds };
    }

    // Activity filters — pre-filter session IDs
    if (activity === "genio") {
      const genioSessionIds = await prisma.statEvent.findMany({
        where: { eventType: "GENIO_START", ...(where.restaurantId ? { restaurantId: where.restaurantId } : {}), ...(where.startedAt ? { createdAt: where.startedAt } : {}) },
        select: { dbSessionId: true },
        distinct: ["dbSessionId"],
      });
      const ids = genioSessionIds.map(e => e.dbSessionId).filter(Boolean) as string[];
      where.id = { in: ids };
    } else if (activity === "garzon") {
      const waiterSessionIds = await prisma.waiterCall.findMany({
        where: { sessionId: { not: null }, ...(where.startedAt ? { calledAt: where.startedAt } : {}) },
        select: { sessionId: true },
        distinct: ["sessionId"],
      });
      const ids = waiterSessionIds.map(w => w.sessionId).filter(Boolean) as string[];
      where.id = { in: ids };
    } else if (activity === "cumple") {
      const birthdaySessionIds = await prisma.statEvent.findMany({
        where: { eventType: { in: ["BIRTHDAY_BANNER_CLICKED", "BIRTHDAY_SAVED", "BIRTHDAY_MODAL_AUTO_SHOWN"] }, ...(where.restaurantId ? { restaurantId: where.restaurantId } : {}), ...(where.startedAt ? { createdAt: where.startedAt } : {}) },
        select: { dbSessionId: true },
        distinct: ["dbSessionId"],
      });
      const ids = birthdaySessionIds.map(e => e.dbSessionId).filter(Boolean) as string[];
      where.id = { in: ids };
    } else if (activity === "favoritos") {
      where.qrUserId = { not: null };
      // Actually filter by sessions that have favorites — use dishFavorites scoped to session time
      const favGuestIds = await prisma.dishFavorite.findMany({
        where: { ...(where.restaurantId ? { restaurantId: where.restaurantId } : {}), ...(where.startedAt ? { createdAt: where.startedAt } : {}) },
        select: { guestId: true },
        distinct: ["guestId"],
      });
      delete where.qrUserId;
      const ids = favGuestIds.map(f => f.guestId);
      where.guestId = { in: ids };
    }

    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where,
        orderBy: { startedAt: "desc" },
        skip,
        take: limit,
        include: {
          restaurant: { select: { id: true, name: true, slug: true, logoUrl: true } },
          guest: { select: { id: true, visitCount: true, totalSessions: true, linkedQrUserId: true, preferences: true, favoriteIngredients: true } },
          qrUser: { select: { id: true, name: true, email: true, dietType: true, createdAt: true, interactions: { where: { type: { endsWith: "_CONVERTED" } }, select: { type: true, createdAt: true, restaurant: { select: { name: true } } }, orderBy: { createdAt: "asc" }, take: 1 } } },
        },
      }),
      prisma.session.count({ where }),
    ]);

    // Resolve dish names for dishesViewed
    const allDishIds = new Set<string>();
    for (const s of sessions) {
      const viewed = s.dishesViewed as any[];
      if (Array.isArray(viewed)) viewed.forEach((d: any) => { if (d.dishId) allDishIds.add(d.dishId); });
      if (s.pickedDishId) allDishIds.add(s.pickedDishId);
    }

    const dishNames = allDishIds.size > 0
      ? await prisma.dish.findMany({ where: { id: { in: Array.from(allDishIds) } }, select: { id: true, name: true, photos: true, price: true, dishDiet: true, isSpicy: true, ingredients: true, tags: true, isFeaturedAuto: true } })
      : [];
    const dishMap = Object.fromEntries(dishNames.map((d) => [d.id, d]));

    // Get ingredients for all viewed dishes
    const dishIngredients = allDishIds.size > 0
      ? await prisma.dishIngredient.findMany({
          where: { dishId: { in: Array.from(allDishIds) } },
          select: { dishId: true, ingredient: { select: { id: true, name: true, allergens: { select: { name: true } } } } },
        })
      : [];
    const ingredientsByDish: Record<string, { name: string; allergens: { name: string }[] }[]> = {};
    for (const di of dishIngredients) {
      if (!ingredientsByDish[di.dishId]) ingredientsByDish[di.dishId] = [];
      ingredientsByDish[di.dishId].push(di.ingredient);
    }
    for (const d of dishNames) {
      if (!ingredientsByDish[d.id] && d.ingredients) {
        ingredientsByDish[d.id] = d.ingredients.split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean).map((name: string) => ({ name: name.toLowerCase(), allergens: [] }));
      }
    }

    // Resolve category names
    const allCatIds = new Set<string>();
    for (const s of sessions) {
      const viewed = s.categoriesViewed as any[];
      if (Array.isArray(viewed)) viewed.forEach((c: any) => { if (c.categoryId) allCatIds.add(c.categoryId); });
    }
    const catNames = allCatIds.size > 0
      ? await prisma.category.findMany({ where: { id: { in: Array.from(allCatIds) } }, select: { id: true, name: true } })
      : [];
    const catMap = Object.fromEntries(catNames.map((c) => [c.id, c.name]));

    // ── Genio events: scoped to each session via dbSessionId or time range ──
    const sessionIds = sessions.map(s => s.id);
    const sessionGuestIds = [...new Set(sessions.map((s) => s.guestId))];

    // Try dbSessionId first (new events), fall back to time range (legacy events)
    const genioEventTypes: any[] = ["GENIO_START", "GENIO_COMPLETE", "GENIO_PROFILE_SAVED", "GENIO_STEP_DIET", "GENIO_STEP_RESTRICTIONS", "GENIO_STEP_DISLIKES", "GENIO_STEP_GRID", "GENIO_STEP_RESULTS", "GENIO_FEEDBACK_LIKE", "GENIO_FEEDBACK_DISLIKE", "GENIO_DISH_ACCEPTED", "GENIO_DISH_REJECTED", "BIRTHDAY_BANNER_CLICKED", "BIRTHDAY_SAVED", "BIRTHDAY_MODAL_AUTO_SHOWN"];

    const genioEvents = sessionIds.length ? await prisma.statEvent.findMany({
      where: {
        eventType: { in: genioEventTypes },
        OR: [
          // New: linked by dbSessionId
          { dbSessionId: { in: sessionIds } },
          // Legacy fallback: by guestId + time range of any session
          ...(sessionGuestIds.length ? [{
            guestId: { in: sessionGuestIds },
            dbSessionId: null,
            createdAt: {
              gte: new Date(Math.min(...sessions.map(s => s.startedAt.getTime())) - 60_000),
              lte: new Date(Math.max(...sessions.map(s => (s.endedAt?.getTime() || Date.now()))) + 60_000),
            },
          }] : []),
        ],
      },
      select: { guestId: true, dbSessionId: true, eventType: true, dishId: true, createdAt: true },
    }) : [];

    const genioDishIds = [...new Set(genioEvents.filter(e => e.eventType === "GENIO_COMPLETE" && e.dishId).map(e => e.dishId!))];
    const genioDishes = genioDishIds.length ? await prisma.dish.findMany({
      where: { id: { in: genioDishIds } }, select: { id: true, name: true },
    }) : [];
    const genioDishMap = Object.fromEntries(genioDishes.map((d) => [d.id, d.name]));

    const genioDataByDbSession: Record<string, { timesUsed: number; completed: boolean; lastStep: string }> = {};
    const dbSessionsWithGenio = new Set<string>();

    for (const s of sessions) {
      const start = s.startedAt.getTime();
      const end = s.endedAt ? s.endedAt.getTime() : Date.now();
      const matching = genioEvents.filter((e) =>
        e.dbSessionId === s.id ||
        (!e.dbSessionId && e.guestId === s.guestId && e.createdAt.getTime() >= start - 60_000 && e.createdAt.getTime() <= end + 60_000)
      );
      if (matching.length === 0) continue;

      dbSessionsWithGenio.add(s.id);
      const data = { timesUsed: 0, completed: false, profileEdits: 0, lastStep: "", birthdayClicked: false, birthdaySaved: false, birthdayModalAutoShown: false };
      const stepOrder = ["GENIO_STEP_DIET", "GENIO_STEP_RESTRICTIONS", "GENIO_STEP_DISLIKES"];
      const stepLabels: Record<string, string> = { GENIO_STEP_DIET: "Dieta", GENIO_STEP_RESTRICTIONS: "Restricciones", GENIO_STEP_DISLIKES: "Gustos" };
      let maxStep = -1;
      for (const e of matching.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
        if (e.eventType === "GENIO_START") { data.timesUsed++; }
        if (e.eventType === "GENIO_COMPLETE") { data.completed = true; }
        if (e.eventType === "GENIO_PROFILE_SAVED") { data.profileEdits++; }
        if (e.eventType === "BIRTHDAY_BANNER_CLICKED") { data.birthdayClicked = true; }
        if (e.eventType === "BIRTHDAY_SAVED") { data.birthdaySaved = true; }
        if (e.eventType === "BIRTHDAY_MODAL_AUTO_SHOWN") { data.birthdayModalAutoShown = true; }
        const stepIdx = stepOrder.indexOf(e.eventType);
        if (stepIdx > maxStep) { maxStep = stepIdx; data.lastStep = stepLabels[e.eventType] || ""; }
      }
      genioDataByDbSession[s.id] = data;
    }

    // ── Personalization events (RECOMMENDATION_SHOWN/TAPPED) ──
    const recEventTypes: any[] = ["RECOMMENDATION_SHOWN", "RECOMMENDATION_TAPPED"];
    const recEvents = sessionIds.length ? await prisma.statEvent.findMany({
      where: {
        eventType: { in: recEventTypes },
        OR: [
          { dbSessionId: { in: sessionIds } },
          ...(sessionGuestIds.length ? [{
            guestId: { in: sessionGuestIds },
            dbSessionId: null,
            createdAt: {
              gte: new Date(Math.min(...sessions.map(s => s.startedAt.getTime())) - 60_000),
              lte: new Date(Math.max(...sessions.map(s => (s.endedAt?.getTime() || Date.now()))) + 60_000),
            },
          }] : []),
        ],
      },
      select: { guestId: true, dbSessionId: true, eventType: true, dishId: true, metadata: true, createdAt: true },
    }) : [];

    const recDataBySession: Record<string, { shown: number; tapped: number; dishes: { name: string; score: number; tapped: boolean }[] }> = {};
    for (const s of sessions) {
      const start = s.startedAt.getTime();
      const end = s.endedAt ? s.endedAt.getTime() : Date.now();
      const matching = recEvents.filter((e) =>
        e.dbSessionId === s.id ||
        (!e.dbSessionId && e.guestId === s.guestId && e.createdAt.getTime() >= start - 60_000 && e.createdAt.getTime() <= end + 60_000)
      );
      if (matching.length === 0) continue;

      const seenDishes = new Set<string>();
      const tappedDishes = new Set<string>();
      for (const e of matching) {
        if (e.eventType === "RECOMMENDATION_SHOWN" && e.dishId) seenDishes.add(e.dishId);
        if (e.eventType === "RECOMMENDATION_TAPPED" && e.dishId) tappedDishes.add(e.dishId);
      }
      const data = { shown: seenDishes.size, tapped: tappedDishes.size, dishes: [] as { name: string; score: number; tapped: boolean }[] };
      // Resolve dish names
      const allRecDishIds = [...new Set([...seenDishes, ...tappedDishes])];
      for (const dishId of allRecDishIds) {
        const dish = dishMap[dishId];
        const meta = matching.find(e => e.dishId === dishId && e.metadata)?.metadata as any;
        data.dishes.push({ name: dish?.name || dishId, score: meta?.score || 0, tapped: tappedDishes.has(dishId) });
      }
      recDataBySession[s.id] = data;
    }

    // ── Experience submissions: scoped to session time range ──
    const expSubmissions = sessionGuestIds.length ? await prisma.experienceSubmission.findMany({
      where: { guestId: { in: sessionGuestIds } },
      select: {
        id: true, guestId: true, qrUserId: true, status: true, submittedAt: true,
        assignedResult: { select: { id: true, name: true, traits: true } },
        experience: { select: { template: { select: { name: true, iconEmoji: true } } } },
      },
    }) : [];

    // ── DishFavorites: scoped to session time range ──
    const dishFavorites = sessionGuestIds.length ? await prisma.dishFavorite.findMany({
      where: { guestId: { in: sessionGuestIds } },
      select: { id: true, guestId: true, dishId: true, createdAt: true, restaurantId: true },
    }) : [];
    const favDishIds = [...new Set(dishFavorites.map(f => f.dishId))];
    const favDishes = favDishIds.length ? await prisma.dish.findMany({
      where: { id: { in: favDishIds } }, select: { id: true, name: true, photos: true },
    }) : [];
    const favDishMap = Object.fromEntries(favDishes.map(d => [d.id, d]));

    // ── Visit days (for badge, stays per guest) ──
    const allGuestSessions = sessionGuestIds.length ? await prisma.session.findMany({
      where: { guestId: { in: sessionGuestIds } },
      select: { guestId: true, startedAt: true },
    }) : [];
    const visitDaysByGuest: Record<string, number> = {};
    for (const s of allGuestSessions) {
      if (!visitDaysByGuest[s.guestId]) {
        const days = new Set(allGuestSessions.filter((x) => x.guestId === s.guestId).map((x) => x.startedAt.toISOString().split("T")[0]));
        visitDaysByGuest[s.guestId] = days.size;
      }
    }

    // ── Waiter calls by session ──
    const waiterCalls = sessionIds.length ? await prisma.waiterCall.findMany({
      where: { sessionId: { in: sessionIds } },
      select: { id: true, sessionId: true, tableName: true, calledAt: true, answeredAt: true },
      orderBy: { calledAt: "asc" },
    }) : [];
    const waiterCallsBySession: Record<string, typeof waiterCalls> = {};
    for (const wc of waiterCalls) {
      if (wc.sessionId) {
        if (!waiterCallsBySession[wc.sessionId]) waiterCallsBySession[wc.sessionId] = [];
        waiterCallsBySession[wc.sessionId].push(wc);
      }
    }

    // ── Hero click events ──
    const heroClickEvents = sessionIds.length ? await prisma.statEvent.findMany({
      where: {
        eventType: "HERO_CLICK" as any,
        OR: [
          { dbSessionId: { in: sessionIds } },
          ...(sessionGuestIds.length ? [{
            guestId: { in: sessionGuestIds },
            dbSessionId: null,
            createdAt: {
              gte: new Date(Math.min(...sessions.map(s => s.startedAt.getTime())) - 60_000),
              lte: new Date(Math.max(...sessions.map(s => (s.endedAt?.getTime() || Date.now()))) + 60_000),
            },
          }] : []),
        ],
      },
      select: { guestId: true, dbSessionId: true, dishId: true, metadata: true, createdAt: true },
    }) : [];

    const heroClicksBySession: Record<string, { dishId: string; dishName: string; dishPhoto: string | null; view: string; clickedAt: Date }[]> = {};
    for (const s of sessions) {
      const start = s.startedAt.getTime();
      const end = s.endedAt ? s.endedAt.getTime() : Date.now();
      const matching = heroClickEvents.filter((e) =>
        e.dbSessionId === s.id ||
        (!e.dbSessionId && e.guestId === s.guestId && e.createdAt.getTime() >= start - 60_000 && e.createdAt.getTime() <= end + 60_000)
      );
      if (matching.length === 0) continue;
      heroClicksBySession[s.id] = matching.map((e) => {
        const dish = e.dishId ? dishMap[e.dishId] : null;
        const meta = e.metadata as any;
        return {
          dishId: e.dishId || "",
          dishName: dish?.name || (e.dishId?.slice(0, 8) ?? ""),
          dishPhoto: dish?.photos?.[0] || null,
          view: meta?.view || "unknown",
          clickedAt: e.createdAt,
        };
      });
    }

    // ── Popular dishes per restaurant (same logic as /api/qr/popular) ──
    const restaurantIds = [...new Set(sessions.map(s => s.restaurantId))];
    const popularByRestaurant: Record<string, Set<string>> = {};
    if (restaurantIds.length > 0) {
      const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const recentSessions = await prisma.session.findMany({
        where: { restaurantId: { in: restaurantIds }, startedAt: { gte: since48h } },
        select: { restaurantId: true, dishesViewed: true },
      });
      const countsByRest: Record<string, Map<string, number>> = {};
      for (const rs of recentSessions) {
        if (!countsByRest[rs.restaurantId]) countsByRest[rs.restaurantId] = new Map();
        const viewed = rs.dishesViewed as any[] | null;
        if (!Array.isArray(viewed)) continue;
        const seen = new Set<string>();
        for (const entry of viewed) {
          if (!entry?.dishId || seen.has(entry.dishId)) continue;
          if ((entry.detailMs ?? 0) <= 0) continue;
          seen.add(entry.dishId);
          const m = countsByRest[rs.restaurantId];
          m.set(entry.dishId, (m.get(entry.dishId) ?? 0) + 1);
        }
      }
      for (const rid of restaurantIds) {
        const m = countsByRest[rid];
        if (!m) continue;
        const top = [...m.entries()]
          .filter(([, c]) => c >= 3)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([id]) => id);
        popularByRestaurant[rid] = new Set(top);
      }
    }

    // ── Enrich: scope everything to each session ──
    const enriched = sessions.map((s) => {
      const viewed = (s.dishesViewed as any[]) || [];
      const cats = (s.categoriesViewed as any[]) || [];
      const start = s.startedAt.getTime();
      const end = s.endedAt ? s.endedAt.getTime() : Date.now();

      // Scope experiences to this session's time range
      const sessionExps = expSubmissions.filter(sub =>
        sub.guestId === s.guestId && sub.submittedAt.getTime() >= start - 60_000 && sub.submittedAt.getTime() <= end + 60_000
      );

      // Scope dish favorites to this session's time range
      const sessionFavs = dishFavorites.filter(f =>
        f.guestId === s.guestId && f.createdAt.getTime() >= start - 60_000 && f.createdAt.getTime() <= end + 60_000
      );

      return {
        ...s,
        dishesViewed: viewed.map((d: any, idx: number) => {
          const dish = dishMap[d.dishId] || null;
          const pop = popularByRestaurant[s.restaurantId];
          return {
            ...d,
            order: idx,
            dish,
            isPopular: pop ? pop.has(d.dishId) : false,
            isRecommended: dish?.tags?.includes("RECOMMENDED") || false,
            isNew: dish?.tags?.includes("NEW") || false,
          };
        }),
        categoriesViewed: cats.map((c: any) => ({
          ...c,
          name: catMap[c.categoryId] || c.categoryId,
        })),
        pickedDish: s.pickedDishId ? dishMap[s.pickedDishId] || null : null,
        usedGenio: dbSessionsWithGenio.has(s.id),
        genioData: genioDataByDbSession[s.id] || null,
        personalizationData: recDataBySession[s.id] || null,
        visitDays: visitDaysByGuest[s.guestId] || 1,
        dishFavorites: sessionFavs.map(f => ({
          id: f.id,
          dishId: f.dishId,
          dish: favDishMap[f.dishId] || null,
          createdAt: f.createdAt,
        })),
        experienceSubmissions: sessionExps.map((sub) => ({
          id: sub.id,
          templateName: sub.experience.template.name,
          templateEmoji: sub.experience.template.iconEmoji,
          resultName: sub.assignedResult?.name || null,
          resultTraits: sub.assignedResult?.traits || [],
          status: sub.status,
          submittedAt: sub.submittedAt,
        })),
        heroClicks: heroClicksBySession[s.id] || [],
        waiterCalls: (waiterCallsBySession[s.id] || []).map(wc => ({
          id: wc.id,
          tableName: wc.tableName,
          calledAt: wc.calledAt,
          answeredAt: wc.answeredAt,
          responseTime: wc.answeredAt ? Math.round((new Date(wc.answeredAt).getTime() - new Date(wc.calledAt).getTime()) / 1000) : null,
        })),
      };
    });

    return NextResponse.json({ sessions: enriched, total, page, totalPages: Math.ceil(total / limit) });
  } catch (e: any) {
    if (e.status === 400 || e.status === 403) return authErrorResponse(e);
    console.error("Sessions error:", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
