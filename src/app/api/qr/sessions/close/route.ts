import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { fetchWeather } from "@/lib/weather";
import type { TimeOfDay } from "@prisma/client";

const DEFAULT_LAT = -33.4489;
const DEFAULT_LNG = -70.6693;

function getTimeOfDay(): TimeOfDay {
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
    // Support both application/json and text/plain (sendBeacon fallback)
    let body;
    const ct = request.headers.get("content-type") || "";
    if (ct.includes("json")) {
      body = await request.json();
    } else {
      const text = await request.text();
      body = JSON.parse(text);
    }
    const {
      guestId, sessionId, restaurantId, tableId,
      durationMs, viewUsed, deviceType,
      dishesViewed, categoriesViewed, pickedDishId, closeReason,
    } = body;

    if (!restaurantId || !guestId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Get user from cookie
    const cookieStore = await cookies();
    const qrUserId = cookieStore.get("qr_user_id")?.value || null;

    // Get weather
    const weather = await fetchWeather(DEFAULT_LAT, DEFAULT_LNG);
    const weatherStr = weather ? `${weather.weatherCondition}:${weather.weatherTemp}°C` : null;
    const timeOfDay = getTimeOfDay();

    // Ensure GuestProfile exists
    await prisma.guestProfile.upsert({
      where: { id: guestId },
      create: { id: guestId, totalSessions: 1, linkedQrUserId: qrUserId },
      update: {
        lastSeenAt: new Date(),
        totalSessions: { increment: 1 },
        linkedQrUserId: qrUserId || undefined,
      },
    });

    // Create session record
    await prisma.session.create({
      data: {
        guestId,
        qrUserId,
        restaurantId,
        durationMs: durationMs || null,
        viewUsed: viewUsed || null,
        deviceType: deviceType || null,
        closeReason: closeReason || null,
        weather: weatherStr,
        timeOfDay,
        dishesViewed: dishesViewed || [],
        categoriesViewed: categoriesViewed || [],
        pickedDishId: pickedDishId || null,
        endedAt: new Date(),
        isAbandoned: closeReason === "inactivity",
      },
    });

    // Fire SESSION_END stat event
    await prisma.statEvent.create({
      data: {
        eventType: "SESSION_END",
        restaurantId,
        sessionId: sessionId || guestId,
        guestId,
        qrUserId,
        weather: weatherStr,
        timeOfDay,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Session close error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
