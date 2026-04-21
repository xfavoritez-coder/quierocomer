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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { eventType, dishId, restaurantId, sessionId, categoryId, tableId, guestId, promoId } = body;

    if (!eventType || !restaurantId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const effectiveGuestId = guestId || sessionId || null;

    // Get qrUserId from cookie if logged in
    const cookieStore = await cookies();
    const qrUserId = cookieStore.get("qr_user_id")?.value || null;

    // Ensure GuestProfile exists
    if (effectiveGuestId) {
      await prisma.guestProfile.upsert({
        where: { id: effectiveGuestId },
        create: { id: effectiveGuestId, linkedQrUserId: qrUserId },
        update: { lastSeenAt: new Date(), visitCount: { increment: eventType === "SESSION_START" ? 1 : 0 }, linkedQrUserId: qrUserId || undefined },
      });
    }

    // Get weather and time
    const [weather, timeOfDay] = await Promise.all([
      getWeatherForRestaurant(restaurantId),
      Promise.resolve(getTimeOfDay()),
    ]);

    await prisma.statEvent.create({
      data: {
        eventType,
        dishId: dishId || null,
        categoryId: categoryId || null,
        tableId: tableId || null,
        promoId: promoId || null,
        restaurantId,
        sessionId: sessionId || effectiveGuestId || "",
        guestId: effectiveGuestId,
        qrUserId,
        weather,
        timeOfDay,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("StatEvent error:", error);
    return NextResponse.json({ error: "Failed to record event" }, { status: 500 });
  }
}
