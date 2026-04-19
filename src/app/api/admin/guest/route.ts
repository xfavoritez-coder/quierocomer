import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  if (!cookieStore.get("admin_token")?.value) return NextResponse.json({ error: "Not auth" }, { status: 401 });

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

  // All sessions
  const sessions = await prisma.session.findMany({
    where: { guestId },
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
  const dishMap = Object.fromEntries(dishes.map(d => [d.id, d]));

  // Category names
  const allCatIds = new Set<string>();
  for (const s of sessions) {
    const viewed = s.categoriesViewed as any[];
    if (Array.isArray(viewed)) viewed.forEach((c: any) => { if (c.categoryId) allCatIds.add(c.categoryId); });
  }
  const cats = allCatIds.size > 0
    ? await prisma.category.findMany({ where: { id: { in: Array.from(allCatIds) } }, select: { id: true, name: true } })
    : [];
  const catMap = Object.fromEntries(cats.map(c => [c.id, c.name]));

  // Aggregate stats
  const restaurantsVisited = new Set(sessions.map(s => s.restaurantId)).size;
  const totalDuration = sessions.reduce((a, s) => a + (s.durationMs || 0), 0);
  const avgDuration = sessions.length ? Math.round(totalDuration / sessions.length / 1000) : 0;

  // Most viewed dishes across all sessions
  const dishViews: Record<string, { name: string; count: number; totalMs: number }> = {};
  for (const s of sessions) {
    const viewed = s.dishesViewed as any[];
    if (!Array.isArray(viewed)) continue;
    for (const d of viewed) {
      if (!d.dishId) continue;
      if (!dishViews[d.dishId]) dishViews[d.dishId] = { name: dishMap[d.dishId]?.name || d.dishId, count: 0, totalMs: 0 };
      dishViews[d.dishId].count++;
      dishViews[d.dishId].totalMs += d.dwellMs || 0;
    }
  }
  const topDishes = Object.values(dishViews).sort((a, b) => b.totalMs - a.totalMs).slice(0, 10);

  // View preferences
  const viewCounts: Record<string, number> = {};
  for (const s of sessions) {
    if (s.viewUsed) viewCounts[s.viewUsed] = (viewCounts[s.viewUsed] || 0) + 1;
    const history = s.viewHistory as any[];
    if (Array.isArray(history)) history.forEach((v: any) => {
      if (v.view) viewCounts[v.view] = (viewCounts[v.view] || 0) + 1;
    });
  }

  // Fetch experience submissions for this guest
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

  // Enrich sessions
  const enrichedSessions = sessions.map(s => ({
    ...s,
    dishesViewed: (Array.isArray(s.dishesViewed) ? s.dishesViewed : []).map((d: any) => ({
      ...d, dish: dishMap[d.dishId] || null,
    })).sort((a: any, b: any) => (b.dwellMs || 0) - (a.dwellMs || 0)),
    categoriesViewed: (Array.isArray(s.categoriesViewed) ? s.categoriesViewed : []).map((c: any) => ({
      ...c, name: catMap[c.categoryId] || c.categoryId,
    })),
    pickedDish: s.pickedDishId ? dishMap[s.pickedDishId] || null : null,
  }));

  return NextResponse.json({
    guest: {
      id: guest.id,
      visitCount: guest.visitCount,
      totalSessions: guest.totalSessions,
      createdAt: guest.createdAt,
      lastSeenAt: guest.lastSeenAt,
      preferences: guest.preferences,
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
    experiences: experienceSubmissions.map(sub => ({
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
}
