import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { fetchWeather } from "@/lib/weather";
import type { TimeOfDay } from "@prisma/client";

// Santiago default coords (used when restaurant has no location)
const DEFAULT_LAT = -33.4489;
const DEFAULT_LNG = -70.6693;

// Cache weather per restaurant for 30 min
const weatherCache = new Map<string, { data: string; expiry: number }>();

async function getWeatherForRestaurant(restaurantId: string): Promise<string | null> {
  const cached = weatherCache.get(restaurantId);
  if (cached && cached.expiry > Date.now()) return cached.data;

  const weather = await fetchWeather(DEFAULT_LAT, DEFAULT_LNG);
  if (!weather) return null;

  const condition = `${weather.weatherCondition}:${weather.weatherTemp}°C`;
  weatherCache.set(restaurantId, { data: condition, expiry: Date.now() + 30 * 60 * 1000 });
  return condition;
}

function getTimeOfDay(): TimeOfDay {
  // Chile timezone (UTC-3 / UTC-4)
  const now = new Date();
  const clHour = new Date(now.toLocaleString("en-US", { timeZone: "America/Santiago" })).getHours();
  if (clHour >= 6 && clHour < 11) return "MORNING";
  if (clHour >= 11 && clHour < 15) return "LUNCH";
  if (clHour >= 15 && clHour < 19) return "AFTERNOON";
  if (clHour >= 19 && clHour < 23) return "DINNER";
  return "LATE";
}

async function processEvent(event: any, qrUserId: string | null, weather: string | null, timeOfDay: TimeOfDay) {
  const { eventType, dishId, restaurantId, sessionId, dbSessionId, categoryId, tableId, guestId, promoId, query, resultsCount, clickedResultId, genioSessionId, metadata } = event;

  if (!eventType || !restaurantId) return null;

  const effectiveGuestId = guestId || sessionId || null;

  return {
    eventType,
    dishId: dishId || null,
    categoryId: categoryId || null,
    tableId: tableId || null,
    promoId: promoId || null,
    query: query || null,
    resultsCount: resultsCount ?? null,
    clickedResultId: clickedResultId || null,
    genioSessionId: genioSessionId || null,
    metadata: metadata || null,
    restaurantId,
    sessionId: sessionId || effectiveGuestId || "",
    dbSessionId: dbSessionId || null,
    guestId: effectiveGuestId,
    qrUserId,
    weather,
    timeOfDay,
  };
}

export async function POST(request: Request) {
  try {
    let body;
    const ct = request.headers.get("content-type") || "";
    if (ct.includes("json")) {
      body = await request.json();
    } else {
      body = JSON.parse(await request.text());
    }

    const cookieStore = await cookies();
    const qrUserId = cookieStore.get("qr_user_id")?.value || null;

    // Support both single event and batch
    const events: any[] = body.events || [body];
    if (events.length === 0) return NextResponse.json({ ok: true });

    // Get weather and time once for the batch
    const restaurantId = events[0].restaurantId;
    const [weather, timeOfDay] = await Promise.all([
      getWeatherForRestaurant(restaurantId),
      Promise.resolve(getTimeOfDay()),
    ]);

    // Ensure GuestProfile exists (once per batch)
    const effectiveGuestId = events[0].guestId || events[0].sessionId || null;
    if (effectiveGuestId) {
      const hasSessionStart = events.some((e: any) => e.eventType === "SESSION_START");
      await prisma.guestProfile.upsert({
        where: { id: effectiveGuestId },
        create: { id: effectiveGuestId, linkedQrUserId: qrUserId },
        update: { lastSeenAt: new Date(), visitCount: { increment: hasSessionStart ? 1 : 0 }, linkedQrUserId: qrUserId || undefined },
      });
    }

    // Process all events
    const records = [];
    for (const event of events) {
      const record = await processEvent(event, qrUserId, weather, timeOfDay);
      if (record) records.push(record);
    }

    // Batch insert
    if (records.length === 1) {
      await prisma.statEvent.create({ data: records[0] });
    } else if (records.length > 1) {
      await prisma.statEvent.createMany({ data: records });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("StatEvent error:", error);
    return NextResponse.json({ error: "Failed to record event" }, { status: 500 });
  }
}
