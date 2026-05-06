import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { fetchWeather } from "@/lib/weather";
import type { TimeOfDay } from "@prisma/client";

const DEFAULT_LAT = -33.4489;
const DEFAULT_LNG = -70.6693;

const BOT_PATTERNS = /bot|crawl|spider|facebookexternalhit|WhatsApp|Googlebot|bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot|Sogou|Twitterbot|LinkedInBot|TelegramBot|Applebot|PetalBot|MJ12bot|AhrefsBot|SemrushBot|DataForSeoBot|preview/i;

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
    const { guestId, restaurantId, tableId, deviceType, externalReferer, isQrScan } = await request.json();
    if (!guestId || !restaurantId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const qrUserId = cookieStore.get("qr_user_id")?.value || null;

    const weather = await fetchWeather(DEFAULT_LAT, DEFAULT_LNG);
    const weatherStr = weather ? `${weather.weatherCondition}:${weather.weatherTemp}°C` : null;
    const timeOfDay = getTimeOfDay();

    // Ensure GuestProfile exists and get visit count (global across restaurantes)
    const guest = await prisma.guestProfile.upsert({
      where: { id: guestId },
      create: { id: guestId, linkedQrUserId: qrUserId, deviceType: deviceType || null },
      update: { lastSeenAt: new Date(), visitCount: { increment: 1 }, linkedQrUserId: qrUserId || undefined, deviceType: deviceType || undefined },
    });

    // visitas previas en ESTE restaurante — define isReturningVisitor por local, no global
    const priorSessionsHere = await prisma.session.count({
      where: { guestId, restaurantId, startedAt: { lt: new Date() } },
    });
    const isReturningHere = priorSessionsHere >= 1;

    // Get IP address + browser metadata from headers
    const forwarded = request.headers.get("x-forwarded-for");
    const ipAddress = forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip") || null;
    const userAgent = request.headers.get("user-agent") || null;
    const referer = request.headers.get("referer") || null;
    const language = request.headers.get("accept-language")?.split(",")[0]?.trim() || null;

    // Detect bots from user agent
    const isBot = userAgent ? BOT_PATTERNS.test(userAgent) : false;

    // Deduplicate: if same guest has ANY session for this restaurant within last 2 min, reuse it
    // (covers both open sessions and sessions that were closed quickly by pagehide/inactivity)
    const recentSession = await prisma.session.findFirst({
      where: {
        guestId,
        restaurantId,
        startedAt: { gte: new Date(Date.now() - 2 * 60_000) },
      },
      orderBy: { startedAt: "desc" },
      select: { id: true },
    });
    if (recentSession) {
      // Reopen it if it was closed
      await prisma.session.update({
        where: { id: recentSession.id },
        data: { endedAt: null },
      });
      return NextResponse.json({ ok: true, sessionId: recentSession.id });
    }

    // Create session with returning visitor flag
    const session = await prisma.session.create({
      data: {
        guestId,
        qrUserId,
        restaurantId,
        tableId: tableId || null,
        deviceType: deviceType || null,
        ipAddress,
        userAgent,
        referer,
        externalReferer: externalReferer || null,
        language,
        weather: weatherStr,
        timeOfDay,
        isBot,
        isQrScan: isQrScan || false,
        isReturningVisitor: isReturningHere,
      },
    });

    return NextResponse.json({ ok: true, sessionId: session.id });
  } catch (error) {
    console.error("Session start error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
