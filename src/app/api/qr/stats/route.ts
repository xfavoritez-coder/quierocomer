import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { eventType, dishId, restaurantId, sessionId, categoryId, tableId } =
      body;

    if (!eventType || !restaurantId || !sessionId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    await prisma.statEvent.create({
      data: {
        eventType,
        dishId: dishId || null,
        categoryId: categoryId || null,
        tableId: tableId || null,
        restaurantId,
        sessionId,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("StatEvent error:", error);
    return NextResponse.json(
      { error: "Failed to record event" },
      { status: 500 }
    );
  }
}
