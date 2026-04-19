import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    if (!cookieStore.get("admin_token")?.value) {
      return NextResponse.json({ error: "Not auth" }, { status: 401 });
    }

    const url = new URL(req.url);
    const restaurantId = url.searchParams.get("restaurantId");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = 30;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (restaurantId) where.restaurantId = restaurantId;

    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where,
        orderBy: { startedAt: "desc" },
        skip,
        take: limit,
        include: {
          restaurant: { select: { id: true, name: true, slug: true, logoUrl: true } },
          guest: { select: { id: true, visitCount: true, totalSessions: true, linkedQrUserId: true, preferences: true } },
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
      ? await prisma.dish.findMany({ where: { id: { in: Array.from(allDishIds) } }, select: { id: true, name: true, photos: true, price: true } })
      : [];
    const dishMap = Object.fromEntries(dishNames.map(d => [d.id, d]));

    // Resolve category names
    const allCatIds = new Set<string>();
    for (const s of sessions) {
      const viewed = s.categoriesViewed as any[];
      if (Array.isArray(viewed)) viewed.forEach((c: any) => { if (c.categoryId) allCatIds.add(c.categoryId); });
    }
    const catNames = allCatIds.size > 0
      ? await prisma.category.findMany({ where: { id: { in: Array.from(allCatIds) } }, select: { id: true, name: true } })
      : [];
    const catMap = Object.fromEntries(catNames.map(c => [c.id, c.name]));

    // Check which sessions used Genio + what it recommended (per session, not per guest)
    const sessionIds = sessions.map(s => s.id);
    const sessionGuestIds = [...new Set(sessions.map(s => s.guestId))];
    const genioEvents = sessionIds.length ? await prisma.statEvent.findMany({
      where: { sessionId: { in: sessionIds }, eventType: { in: ["GENIO_START", "GENIO_COMPLETE"] } },
      select: { sessionId: true, eventType: true, dishId: true, createdAt: true },
    }) : [];

    // Get Genio recommended dish names
    const genioDishIds = [...new Set(genioEvents.filter(e => e.eventType === "GENIO_COMPLETE" && e.dishId).map(e => e.dishId!))];
    const genioDishes = genioDishIds.length ? await prisma.dish.findMany({
      where: { id: { in: genioDishIds } }, select: { id: true, name: true },
    }) : [];
    const genioDishMap = Object.fromEntries(genioDishes.map(d => [d.id, d.name]));

    // Build Genio data per session with all recommendations
    const genioDataBySession: Record<string, { timesUsed: number; recommendations: string[] }> = {};
    for (const e of genioEvents) {
      if (!genioDataBySession[e.sessionId]) genioDataBySession[e.sessionId] = { timesUsed: 0, recommendations: [] };
      if (e.eventType === "GENIO_START") genioDataBySession[e.sessionId].timesUsed++;
      if (e.eventType === "GENIO_COMPLETE" && e.dishId) {
        const name = genioDishMap[e.dishId];
        if (name) genioDataBySession[e.sessionId].recommendations.push(name);
      }
    }
    const sessionIdsWithGenio = new Set(genioEvents.map(e => e.sessionId));

    // Fetch experience submissions for these guests
    const expSubmissions = sessionGuestIds.length ? await prisma.experienceSubmission.findMany({
      where: { guestId: { in: sessionGuestIds } },
      select: {
        id: true, guestId: true, qrUserId: true, status: true, submittedAt: true,
        assignedResult: { select: { id: true, name: true, traits: true } },
        experience: { select: { template: { select: { name: true, iconEmoji: true } } } },
      },
    }) : [];
    const expByGuest: Record<string, typeof expSubmissions> = {};
    for (const sub of expSubmissions) {
      const key = sub.guestId || "";
      if (!expByGuest[key]) expByGuest[key] = [];
      expByGuest[key].push(sub);
    }

    // Count distinct visit days per guest
    const allGuestSessions = sessionGuestIds.length ? await prisma.session.findMany({
      where: { guestId: { in: sessionGuestIds } },
      select: { guestId: true, startedAt: true },
    }) : [];
    const visitDaysByGuest: Record<string, number> = {};
    for (const s of allGuestSessions) {
      if (!visitDaysByGuest[s.guestId]) {
        const days = new Set(allGuestSessions.filter(x => x.guestId === s.guestId).map(x => x.startedAt.toISOString().split("T")[0]));
        visitDaysByGuest[s.guestId] = days.size;
      }
    }

    // Enrich sessions
    const enriched = sessions.map(s => {
      const viewed = (s.dishesViewed as any[]) || [];
      const cats = (s.categoriesViewed as any[]) || [];
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
        usedGenio: sessionIdsWithGenio.has(s.id),
        genioData: genioDataBySession[s.id] || null,
        visitDays: visitDaysByGuest[s.guestId] || 1,
        experienceSubmissions: (expByGuest[s.guestId] || []).map(sub => ({
          id: sub.id,
          templateName: sub.experience.template.name,
          templateEmoji: sub.experience.template.iconEmoji,
          resultName: sub.assignedResult?.name || null,
          resultTraits: sub.assignedResult?.traits || [],
          status: sub.status,
          submittedAt: sub.submittedAt,
        })),
      };
    });

    return NextResponse.json({ sessions: enriched, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("Sessions error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
