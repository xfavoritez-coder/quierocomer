import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth, getOwnedRestaurantIds, assertOwnsRestaurant, authErrorResponse } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

async function matchTicketToSession(restaurantId: string, mesaId: string | null, paidAt: Date): Promise<{ sessionId: string | null; confidence: string }> {
  const windowStart = new Date(paidAt.getTime() - 3 * 60 * 60 * 1000);
  const windowEnd = new Date(paidAt.getTime() + 30 * 60 * 1000);

  const sessions = await prisma.session.findMany({
    where: { restaurantId, startedAt: { gte: windowStart, lte: windowEnd } },
    select: { id: true, startedAt: true },
    orderBy: { startedAt: "desc" },
  });

  if (sessions.length === 0) return { sessionId: null, confidence: "none" };

  // Prefer session closest to paidAt - 30min (payment usually at end)
  const targetTime = paidAt.getTime() - 30 * 60 * 1000;
  sessions.sort((a, b) => Math.abs(a.startedAt.getTime() - targetTime) - Math.abs(b.startedAt.getTime() - targetTime));

  if (mesaId) {
    return sessions.length === 1
      ? { sessionId: sessions[0].id, confidence: "exact" }
      : { sessionId: sessions[0].id, confidence: "probable" };
  }

  return { sessionId: sessions[0].id, confidence: "approximate" };
}

/** GET — list tickets */
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || undefined;
  const confidence = req.nextUrl.searchParams.get("confidence") || undefined;

  // Superadmin (null) ve todo; el resto solo sus locales.
  const ownedIds = await getOwnedRestaurantIds(req);
  if (ownedIds && restaurantId && !ownedIds.includes(restaurantId)) {
    return NextResponse.json({ error: "No tienes permisos para este restaurant" }, { status: 403 });
  }

  const tickets = await prisma.restaurantTicket.findMany({
    where: {
      ...(restaurantId ? { restaurantId } : ownedIds ? { restaurantId: { in: ownedIds } } : {}),
      ...(confidence ? { matchConfidence: confidence } : {}),
    },
    include: { restaurant: { select: { name: true } } },
    orderBy: { paidAt: "desc" },
    take: 200,
  });

  return NextResponse.json(tickets);
}

/** POST — create ticket(s) */
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const body = await req.json();

    // Batch (CSV) or single
    const items = Array.isArray(body) ? body : [body];
    const results = [];
    // Superadmin (null) puede cargar a cualquier local; el resto solo a los suyos.
    const ownedIds = await getOwnedRestaurantIds(req);

    for (const item of items) {
      const { restaurantId, restaurantSlug, mesaId, ticketTotal, ticketCountItems, paidAt, notes } = item;

      let resId = restaurantId;
      if (!resId && restaurantSlug) {
        const r = await prisma.restaurant.findUnique({ where: { slug: restaurantSlug }, select: { id: true } });
        if (r) resId = r.id;
      }
      if (!resId || !ticketTotal || !paidAt) { results.push({ error: "Missing fields", item }); continue; }
      if (ownedIds && !ownedIds.includes(resId)) { results.push({ error: "No tienes permisos para este restaurant", item }); continue; }

      const paidDate = new Date(paidAt);
      const match = await matchTicketToSession(resId, mesaId || null, paidDate);

      const ticket = await prisma.restaurantTicket.create({
        data: {
          restaurantId: resId,
          mesaId: mesaId || null,
          ticketTotal,
          ticketCountItems: ticketCountItems || null,
          paidAt: paidDate,
          matchedSessionId: match.sessionId,
          matchConfidence: match.confidence,
          notes: notes || null,
        },
      });

      results.push(ticket);
    }

    return NextResponse.json({ ok: true, count: results.length, results });
  } catch (error) {
    console.error("[Tickets POST]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

/** DELETE — remove ticket */
export async function DELETE(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const existing = await prisma.restaurantTicket.findUnique({ where: { id }, select: { restaurantId: true } });
  if (existing) {
    try {
      await assertOwnsRestaurant(req, existing.restaurantId);
    } catch (err) {
      return authErrorResponse(err);
    }
  }

  await prisma.restaurantTicket.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
