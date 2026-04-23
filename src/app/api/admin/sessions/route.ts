import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  checkAdminAuth,
  requireRestaurantForOwner,
  getOwnedRestaurantIds,
  isSuperAdmin,
  authErrorResponse,
} from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const url = new URL(req.url);
    const restaurantId = url.searchParams.get("restaurantId");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = 30;
    const skip = (page - 1) * limit;

    // Build where filter with ownership enforcement
    const where: any = {};
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

    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where,
        orderBy: { startedAt: "desc" },
        skip,
        take: limit,
        include: {
          restaurant: { select: { id: true, name: true, slug: true, logoUrl: true } },
          guest: { select: { id: true, visitCount: true, totalSessions: true, linkedQrUserId: true, preferences: true, favoriteIngredients: true } },
          qrUser: { select: { id: true, name: true, email: true, dietType: true } },
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
      ? await prisma.dish.findMany({ where: { id: { in: Array.from(allDishIds) } }, select: { id: true, name: true, photos: true, price: true, dishDiet: true, isSpicy: true, ingredients: true } })
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
    const genioEventTypes: any[] = ["GENIO_START", "GENIO_COMPLETE", "GENIO_STEP_DIET", "GENIO_STEP_RESTRICTIONS", "GENIO_STEP_DISLIKES", "GENIO_STEP_GRID", "GENIO_STEP_RESULTS", "GENIO_FEEDBACK_LIKE", "GENIO_FEEDBACK_DISLIKE", "GENIO_DISH_ACCEPTED", "GENIO_DISH_REJECTED"];

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

    const genioDataByDbSession: Record<string, { timesUsed: number; recommendations: { name: string; isBestMatch: boolean }[]; lastStep: string }> = {};
    const dbSessionsWithGenio = new Set<string>();

    for (const s of sessions) {
      // Match events: prefer dbSessionId, fall back to guestId + time window
      const start = s.startedAt.getTime();
      const end = s.endedAt ? s.endedAt.getTime() : Date.now();
      const matching = genioEvents.filter((e) =>
        e.dbSessionId === s.id ||
        (!e.dbSessionId && e.guestId === s.guestId && e.createdAt.getTime() >= start - 60_000 && e.createdAt.getTime() <= end + 60_000)
      );
      if (matching.length === 0) continue;

      dbSessionsWithGenio.add(s.id);
      const data = { timesUsed: 0, recommendations: [] as { name: string; isBestMatch: boolean }[], lastStep: "" };
      let completesAfterLastStart = 0;
      const stepOrder = ["GENIO_STEP_DIET", "GENIO_STEP_RESTRICTIONS", "GENIO_STEP_DISLIKES", "GENIO_STEP_GRID", "GENIO_STEP_RESULTS"];
      const stepLabels: Record<string, string> = { GENIO_STEP_DIET: "Dieta", GENIO_STEP_RESTRICTIONS: "Restricciones", GENIO_STEP_DISLIKES: "Gustos", GENIO_STEP_GRID: "Grilla", GENIO_STEP_RESULTS: "Resultados" };
      let maxStep = -1;
      for (const e of matching.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
        if (e.eventType === "GENIO_START") { data.timesUsed++; completesAfterLastStart = 0; }
        if (e.eventType === "GENIO_COMPLETE" && e.dishId) {
          const name = genioDishMap[e.dishId];
          if (name) { data.recommendations.push({ name, isBestMatch: completesAfterLastStart === 0 }); completesAfterLastStart++; }
        }
        const stepIdx = stepOrder.indexOf(e.eventType);
        if (stepIdx > maxStep) { maxStep = stepIdx; data.lastStep = stepLabels[e.eventType] || ""; }
      }
      genioDataByDbSession[s.id] = data;
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
        dishesViewed: viewed.map((d: any) => ({
          ...d,
          dish: dishMap[d.dishId] || null,
        })).sort((a: any, b: any) => (b.dwellMs || 0) - (a.dwellMs || 0)),
        categoriesViewed: cats.map((c: any) => ({
          ...c,
          name: catMap[c.categoryId] || c.categoryId,
        })),
        pickedDish: s.pickedDishId ? dishMap[s.pickedDishId] || null : null,
        usedGenio: dbSessionsWithGenio.has(s.id),
        genioData: genioDataByDbSession[s.id] || null,
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
