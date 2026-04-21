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
    const { guestId, restaurantId, tableId, deviceType } = await request.json();
    if (!guestId || !restaurantId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const qrUserId = cookieStore.get("qr_user_id")?.value || null;

    const weather = await fetchWeather(DEFAULT_LAT, DEFAULT_LNG);
    const weatherStr = weather ? `${weather.weatherCondition}:${weather.weatherTemp}°C` : null;
    const timeOfDay = getTimeOfDay();

    // Ensure GuestProfile exists and get visit count
    const guest = await prisma.guestProfile.upsert({
      where: { id: guestId },
      create: { id: guestId, linkedQrUserId: qrUserId, deviceType: deviceType || null },
      update: { lastSeenAt: new Date(), visitCount: { increment: 1 }, linkedQrUserId: qrUserId || undefined, deviceType: deviceType || undefined },
    });

    // Get IP address
    const forwarded = request.headers.get("x-forwarded-for");
    const ipAddress = forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip") || null;

    // Create session with returning visitor flag
    const session = await prisma.session.create({
      data: {
        guestId,
        qrUserId,
        restaurantId,
        deviceType: deviceType || null,
        ipAddress,
        weather: weatherStr,
        timeOfDay,
        isReturningVisitor: guest.visitCount > 1,
      },
    });

    return NextResponse.json({ ok: true, sessionId: session.id });
  } catch (error) {
    console.error("Session start error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
