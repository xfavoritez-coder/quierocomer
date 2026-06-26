import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, requireRestaurantForOwner, authErrorResponse } from "@/lib/adminAuth";

const PAGE_SIZE = 30;

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const restaurantIdParam = req.nextUrl.searchParams.get("restaurantId") || null;
    const restaurantId = await requireRestaurantForOwner(req, restaurantIdParam);

    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") || "1"));
    const fromStr = req.nextUrl.searchParams.get("from");
    const toStr = req.nextUrl.searchParams.get("to");
    const guestId = req.nextUrl.searchParams.get("guestId");
    const hideEmpty = req.nextUrl.searchParams.get("hideEmpty") === "true";

    const rf = restaurantId ? { restaurantId } : {};

    const where: any = { ...rf };

    if (guestId) {
      where.guestId = guestId;
    } else {
      const to = toStr ? new Date(toStr + "T23:59:59.999-04:00") : new Date();
      const from = fromStr ? new Date(fromStr + "T00:00:00.000-04:00") : new Date(to.getTime() - 7 * 86400000);
      where.startedAt = { gte: from, lte: to };
    }

    if (hideEmpty) {
      where.durationMs = { gt: 3000 };
    }

    const [total, sessions] = await Promise.all([
      prisma.session.count({ where }),
      prisma.session.findMany({
        where,
        orderBy: { startedAt: "desc" },
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE,
        include: {
          qrUser: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    // Enrich sessions with genio data, waiter calls, visit counts
    const sessionIds = sessions.map(s => s.id);
    const guestIds = [...new Set(sessions.map(s => s.guestId))];

    const [statEvents, waiterCalls, guestSessionCounts] = await Promise.all([
      sessionIds.length > 0
        ? prisma.statEvent.findMany({
            where: { dbSessionId: { in: sessionIds } },
            select: { dbSessionId: true, eventType: true, metadata: true },
          })
        : [],
      sessionIds.length > 0
        ? prisma.waiterCall.findMany({
            where: { sessionId: { in: sessionIds } },
            select: { sessionId: true, calledAt: true, answeredAt: true },
          })
        : [],
      // Count distinct days each guest has visited this restaurant
      guestIds.length > 0 && restaurantId
        ? prisma.$queryRaw<{ guestId: string; days: number }[]>`
            SELECT "guestId", COUNT(DISTINCT DATE("startedAt"))::int AS days
            FROM "Session"
            WHERE "guestId" = ANY(${guestIds}) AND "restaurantId" = ${restaurantId}
            GROUP BY "guestId"
          `
        : [],
    ]);

    const eventsBySession = new Map<string, any[]>();
    for (const e of statEvents) {
      if (!e.dbSessionId) continue;
      if (!eventsBySession.has(e.dbSessionId)) eventsBySession.set(e.dbSessionId, []);
      eventsBySession.get(e.dbSessionId)!.push(e);
    }

    const waiterBySession = new Map<string, any[]>();
    for (const w of waiterCalls) {
      if (!w.sessionId) continue;
      if (!waiterBySession.has(w.sessionId)) waiterBySession.set(w.sessionId, []);
      waiterBySession.get(w.sessionId)!.push(w);
    }

    const visitDaysMap = new Map<string, number>();
    for (const r of guestSessionCounts as any[]) {
      visitDaysMap.set(r.guestId, r.days);
    }

    // Count visits today per guest for "X de Y hoy" badges
    const todayStart = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
    todayStart.setHours(0, 0, 0, 0);

    const enriched = sessions.map((s, idx) => {
      const events = eventsBySession.get(s.id) || [];
      const genioEvents = events.filter(e =>
        ["GENIO_START", "GENIO_COMPLETE", "GENIO_STEP_DIET", "GENIO_STEP_RESTRICTIONS", "GENIO_STEP_DISLIKES", "GENIO_STEP_GRID", "GENIO_STEP_RESULTS"].includes(e.eventType)
      );
      const birthdayEvents = events.filter(e =>
        ["BIRTHDAY_SAVED", "BIRTHDAY_DISMISSED", "BIRTHDAY_MODAL_AUTO_SHOWN"].includes(e.eventType)
      );

      const genioData = genioEvents.length > 0 ? {
        timesUsed: genioEvents.filter(e => e.eventType === "GENIO_START").length,
        completed: genioEvents.some(e => e.eventType === "GENIO_COMPLETE"),
        lastStep: genioEvents[genioEvents.length - 1]?.eventType?.replace("GENIO_STEP_", "").toLowerCase(),
        birthdaySaved: birthdayEvents.some(e => e.eventType === "BIRTHDAY_SAVED"),
        birthdayDismissed: birthdayEvents.some(e => e.eventType === "BIRTHDAY_DISMISSED"),
        birthdayModalAutoShown: birthdayEvents.some(e => e.eventType === "BIRTHDAY_MODAL_AUTO_SHOWN"),
      } : {
        timesUsed: 0,
        completed: false,
        lastStep: null,
        birthdaySaved: birthdayEvents.some(e => e.eventType === "BIRTHDAY_SAVED"),
        birthdayDismissed: birthdayEvents.some(e => e.eventType === "BIRTHDAY_DISMISSED"),
        birthdayModalAutoShown: birthdayEvents.some(e => e.eventType === "BIRTHDAY_MODAL_AUTO_SHOWN"),
      };

      const waiterCallsForSession = waiterBySession.get(s.id) || [];
      const visitDays = visitDaysMap.get(s.guestId) || 1;

      // Suspicious: bot UA, no activity + very short, or known bots
      const ua = (s.userAgent || "").toLowerCase();
      const suspicious = s.isBot || (s.durationMs != null && s.durationMs < 2000 && (!s.dishesViewed || (s.dishesViewed as any[]).length === 0));

      // Anonymous ID: first 8 chars of guestId
      const anonId = s.guestId ? s.guestId.slice(0, 8) : null;

      return {
        id: s.id,
        guestId: s.guestId,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        durationMs: s.durationMs,
        viewUsed: s.viewUsed,
        deviceType: s.deviceType,
        dishesViewed: s.dishesViewed || [],
        categoriesViewed: s.categoriesViewed || [],
        ipAddress: s.ipAddress,
        language: s.language,
        userAgent: s.userAgent,
        qrUser: s.qrUser,
        genioData,
        waiterCalls: waiterCallsForSession,
        visitDays,
        visitsToday: 1,
        visitNumToday: 1,
        suspicious,
        anonId,
        guestSessionCount: visitDays,
      };
    });

    return NextResponse.json({
      sessions: enriched,
      total,
      page,
      totalPages: Math.ceil(total / PAGE_SIZE),
    });
  } catch (e: any) {
    if (e.status === 400 || e.status === 403) return authErrorResponse(e);
    console.error("[Admin sessions]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
