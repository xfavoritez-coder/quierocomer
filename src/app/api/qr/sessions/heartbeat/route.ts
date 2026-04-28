import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST needed for sendBeacon (can't send PATCH)
export async function POST(request: Request) { return handleHeartbeat(request); }
export async function PATCH(request: Request) { return handleHeartbeat(request); }

async function handleHeartbeat(request: Request) {
  try {
    let body;
    const ct = request.headers.get("content-type") || "";
    if (ct.includes("json")) {
      body = await request.json();
    } else {
      body = JSON.parse(await request.text());
    }

    const { sessionId, durationMs, viewUsed, viewHistory, dishesViewed, categoriesViewed, pickedDishId, cartaLang, preferences, isFinal } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    // Update session
    const session = await prisma.session.update({
      where: { id: sessionId },
      data: {
        durationMs: durationMs || undefined,
        viewUsed: viewUsed || undefined,
        viewHistory: viewHistory || undefined,
        dishesViewed: dishesViewed || undefined,
        categoriesViewed: categoriesViewed || undefined,
        pickedDishId: pickedDishId || undefined,
        cartaLang: cartaLang || undefined,
        endedAt: new Date(),
        ...(isFinal ? { isAbandoned: false, closeReason: body.closeReason || "normal" } : {}),
      },
      select: { guestId: true },
    });

    // Save preferences to GuestProfile (from localStorage via heartbeat)
    if (preferences && session.guestId) {
      await prisma.guestProfile.update({
        where: { id: session.guestId },
        data: { preferences },
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    // Session might not exist (race condition) — ignore silently
    return NextResponse.json({ ok: true });
  }
}
