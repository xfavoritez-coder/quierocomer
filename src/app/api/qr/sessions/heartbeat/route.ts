import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  try {
    let body;
    const ct = request.headers.get("content-type") || "";
    if (ct.includes("json")) {
      body = await request.json();
    } else {
      body = JSON.parse(await request.text());
    }

    const { sessionId, durationMs, viewUsed, dishesViewed, categoriesViewed, pickedDishId, isFinal } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        durationMs: durationMs || undefined,
        viewUsed: viewUsed || undefined,
        dishesViewed: dishesViewed || undefined,
        categoriesViewed: categoriesViewed || undefined,
        pickedDishId: pickedDishId || undefined,
        ...(isFinal ? { endedAt: new Date(), isAbandoned: false } : {}),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    // Session might not exist (race condition) — ignore silently
    return NextResponse.json({ ok: true });
  }
}
