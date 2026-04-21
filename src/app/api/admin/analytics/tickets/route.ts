import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
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

  const tickets = await prisma.restaurantTicket.findMany({
    where: {
      ...(restaurantId ? { restaurantId } : {}),
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

    for (const item of items) {
      const { restaurantId, restaurantSlug, mesaId, ticketTotal, ticketCountItems, paidAt, notes } = item;

      let resId = restaurantId;
      if (!resId && restaurantSlug) {
        const r = await prisma.restaurant.findUnique({ where: { slug: restaurantSlug }, select: { id: true } });
        if (r) resId = r.id;
      }
      if (!resId || !ticketTotal || !paidAt) { results.push({ error: "Missing fields", item }); continue; }

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

  await prisma.restaurantTicket.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
