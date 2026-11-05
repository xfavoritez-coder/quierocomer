import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Cache a valid restaurantId for landing events (StatEvent requires FK)
let _landingRestaurantId: string | null = null;
async function getLandingRestaurantId(): Promise<string> {
  if (_landingRestaurantId) return _landingRestaurantId;
  const r = await prisma.restaurant.findFirst({ select: { id: true }, orderBy: { createdAt: "asc" } });
  _landingRestaurantId = r?.id || "unknown";
  return _landingRestaurantId;
}

/**
 * Lightweight POST endpoint for tracking stat events that don't belong to a
 * specific carta session (e.g. landing page A/B impressions & conversions).
 *
 * Body: { eventType, restaurantId?, sessionId?, metadata? }
 */
export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { eventType, metadata, guestId } = body || {};
  if (!eventType) return NextResponse.json({ error: "eventType required" }, { status: 400 });

  // Use provided restaurantId or fall back to first restaurant in DB
  const restaurantId = body.restaurantId || await getLandingRestaurantId();

  // Si viene guestId, asegurar que exista el GuestProfile (upsert ligero).
  if (guestId && typeof guestId === "string" && guestId.length > 10) {
    try {
      await prisma.guestProfile.upsert({
        where: { id: guestId },
        create: { id: guestId, lastSeenAt: new Date() },
        update: { lastSeenAt: new Date() },
      });
    } catch { /* ignore */ }
  }

  try {
    await prisma.statEvent.create({
      data: {
        eventType,
        restaurantId,
        sessionId: body.sessionId || "anonymous",
        metadata: metadata || undefined,
        ...(guestId && typeof guestId === "string" ? { guestId } : {}),
      },
    });
  } catch (e: any) {
    // Unknown eventType or FK violation — log and ignore to avoid 500s
    console.warn("[stat-events] skipped:", eventType, e?.message?.slice(0, 120));
  }

  return NextResponse.json({ ok: true });
}
