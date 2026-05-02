import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  checkAdminAuth,
  isSuperAdmin,
  getOwnedRestaurantIds,
} from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const guestId = req.nextUrl.searchParams.get("guestId");
    if (!guestId) return NextResponse.json({ error: "guestId required" }, { status: 400 });

    const guest = await prisma.guestProfile.findUnique({
      where: { id: guestId },
      include: {
        linkedQrUser: {
          select: { id: true, name: true, email: true, dietType: true, restrictions: true, birthDate: true, createdAt: true },
        },
      },
    });

    if (!guest) return NextResponse.json({ error: "Guest not found" }, { status: 404 });

    // For owners: verify this guest has sessions at one of their restaurants
    if (!isSuperAdmin(req)) {
      const ownedIds = await getOwnedRestaurantIds(req);
      if (ownedIds && ownedIds.length > 0) {
        const guestInOwnerRestaurant = await prisma.session.findFirst({
          where: { guestId, restaurantId: { in: ownedIds } },
          select: { id: true },
        });
        if (!guestInOwnerRestaurant) {
          return NextResponse.json({ error: "No tienes acceso a este visitante" }, { status: 403 });
        }
      } else {
        return NextResponse.json({ error: "No tienes restaurantes asignados" }, { status: 403 });
      }
    }

    // Build session filter for owners
    const isSuper = isSuperAdmin(req);
    let sessionWhere: any = { guestId };
    if (!isSuper) {
      const ownedIds = await getOwnedRestaurantIds(req);
      if (ownedIds) sessionWhere.restaurantId = { in: ownedIds };
    }

    // All sessions (filtered for owners)
    const sessions = await prisma.session.findMany({
      where: sessionWhere,
      orderBy: { startedAt: "desc" },
      include: {
        restaurant: { select: { id: true, name: true, slug: true, logoUrl: true } },
      },
    });

    // Resolve dish names from all sessions
    const allDishIds = new Set<string>();
    for (const s of sessions) {
      const viewed = s.dishesViewed as any[];
      if (Array.isArray(viewed)) viewed.forEach((d: any) => { if (d.dishId) allDishIds.add(d.dishId); });
      if (s.pickedDishId) allDishIds.add(s.pickedDishId);
    }
    const dishes = allDishIds.size > 0
      ? await prisma.dish.findMany({ where: { id: { in: Array.from(allDishIds) } }, select: { id: true, name: true, photos: true, price: true } })
      : [];
    const dishMap = Object.fromEntries(dishes.map((d) => [d.id, d]));

    // Category names
    const allCatIds = new Set<string>();
    for (const s of sessions) {
      const viewed = s.categoriesViewed as any[];
      if (Array.isArray(viewed)) viewed.forEach((c: any) => { if (c.categoryId) allCatIds.add(c.categoryId); });
    }
    const cats = allCatIds.size > 0
      ? await prisma.category.findMany({ where: { id: { in: Array.from(allCatIds) } }, select: { id: true, name: true } })
      : [];
    const catMap = Object.fromEntries(cats.map((c) => [c.id, c.name]));

    // Aggregate stats
    const restaurantsVisited = new Set(sessions.map((s) => s.restaurantId)).size;
    const totalDuration = sessions.reduce((a, s) => a + (s.durationMs || 0), 0);
    const avgDuration = sessions.length ? Math.round(totalDuration / sessions.length / 1000) : 0;

    // Most opened dishes — modal opens with detail time
    const dishOpens: Record<string, { name: string; count: number; totalMs: number }> = {};
    for (const s of sessions) {
      const viewed = s.dishesViewed as any[];
      if (!Array.isArray(viewed)) continue;
      for (const d of viewed) {
        if (!d.dishId || !d.detailMs || d.detailMs <= 0) continue;
        if (!dishOpens[d.dishId]) dishOpens[d.dishId] = { name: dishMap[d.dishId]?.name || d.dishId, count: 0, totalMs: 0 };
        dishOpens[d.dishId].count++;
        dishOpens[d.dishId].totalMs += d.detailMs;
      }
    }
    const topDishes = Object.values(dishOpens).sort((a, b) => b.totalMs - a.totalMs).slice(0, 10);

    // View preferences
    const viewCounts: Record<string, number> = {};
    for (const s of sessions) {
      if (s.viewUsed) viewCounts[s.viewUsed] = (viewCounts[s.viewUsed] || 0) + 1;
      const history = s.viewHistory as any[];
      if (Array.isArray(history)) history.forEach((v: any) => {
        if (v.view) viewCounts[v.view] = (viewCounts[v.view] || 0) + 1;
      });
    }

    // Experience submissions
    const experienceSubmissions = await prisma.experienceSubmission.findMany({
      where: { OR: [{ guestId }, ...(guest.linkedQrUserId ? [{ qrUserId: guest.linkedQrUserId }] : [])] },
      orderBy: { submittedAt: "desc" },
      include: {
        assignedResult: { select: { id: true, name: true, description: true, traits: true, imageUrl: true } },
        experience: {
          select: {
            id: true,
            restaurantId: true,
            template: { select: { id: true, name: true, slug: true, iconEmoji: true, accentColor: true, description: true } },
          },
        },
      },
    });

    // Sort selector usage per session — fetch FILTER_APPLIED stats with
    // metadata.filterType === "sort" and key by dbSessionId so each session
    // can show what sort the user picked (if any).
    const sessionIds = sessions.map((s) => s.id);
    const sortEvents = sessionIds.length > 0
      ? await prisma.statEvent.findMany({
          where: {
            dbSessionId: { in: sessionIds },
            eventType: "FILTER_APPLIED",
            metadata: { path: ["filterType"], equals: "sort" },
          },
          select: { dbSessionId: true, metadata: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        })
      : [];
    // Last sort wins per session (the user might toggle several times)
    const sortBySession = new Map<string, string>();
    for (const e of sortEvents) {
      if (!e.dbSessionId) continue;
      const m = e.metadata as any;
      if (m?.filterValue) sortBySession.set(e.dbSessionId, m.filterValue);
    }

    // Enrich sessions
    const enrichedSessions = sessions.map((s) => ({
      ...s,
      dishesViewed: (Array.isArray(s.dishesViewed) ? s.dishesViewed : []).map((d: any) => ({
        ...d, dish: dishMap[d.dishId] || null,
      })).sort((a: any, b: any) => (b.detailMs || 0) - (a.detailMs || 0)),
      categoriesViewed: (Array.isArray(s.categoriesViewed) ? s.categoriesViewed : []).map((c: any) => ({
        ...c, name: catMap[c.categoryId] || c.categoryId,
      })),
      pickedDish: s.pickedDishId ? dishMap[s.pickedDishId] || null : null,
      sortUsed: sortBySession.get(s.id) || null,
    }));

    return NextResponse.json({
      guest: {
        id: guest.id,
        visitCount: guest.visitCount,
        totalSessions: guest.totalSessions,
        createdAt: guest.createdAt,
        lastSeenAt: guest.lastSeenAt,
        preferences: guest.preferences,
        favoriteIngredients: guest.favoriteIngredients,
      },
      user: guest.linkedQrUser,
      stats: {
        restaurantsVisited,
        totalSessions: sessions.length,
        avgDuration,
        totalDuration: Math.round(totalDuration / 1000),
        topDishes,
        viewPreferences: viewCounts,
      },
      sessions: enrichedSessions,
      experiences: experienceSubmissions.map((sub) => ({
        id: sub.id,
        templateName: sub.experience.template.name,
        templateSlug: sub.experience.template.slug,
        templateEmoji: sub.experience.template.iconEmoji,
        templateDescription: sub.experience.template.description,
        accentColor: sub.experience.template.accentColor,
        experienceId: sub.experience.id,
        resultName: sub.assignedResult?.name || null,
        resultDescription: sub.assignedResult?.description || null,
        resultTraits: sub.assignedResult?.traits || [],
        resultImageUrl: sub.assignedResult?.imageUrl || null,
        personalizedMsg: sub.personalizedMsg,
        teaserMsg: sub.teaserMsg,
        status: sub.status,
        submittedAt: sub.submittedAt,
      })),
    });
  } catch (e: any) {
    console.error("Guest error:", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
