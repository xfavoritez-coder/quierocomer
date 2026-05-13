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

  const { eventType, metadata } = body || {};
  if (!eventType) return NextResponse.json({ error: "eventType required" }, { status: 400 });

  // Use provided restaurantId or fall back to first restaurant in DB
  const restaurantId = body.restaurantId || await getLandingRestaurantId();

  await prisma.statEvent.create({
    data: {
      eventType,
      restaurantId,
      sessionId: body.sessionId || "anonymous",
      metadata: metadata || undefined,
    },
  });

  return NextResponse.json({ ok: true });
}
