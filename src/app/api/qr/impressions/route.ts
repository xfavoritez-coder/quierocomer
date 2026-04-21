import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { sessionId, impressions } = await request.json();
    if (!sessionId || !Array.isArray(impressions) || impressions.length === 0) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    await prisma.dishImpression.createMany({
      data: impressions.map((imp: { dishId: string; restaurantId: string; position: number; visibleMs: number }) => ({
        sessionId,
        dishId: imp.dishId,
        restaurantId: imp.restaurantId,
        position: imp.position ?? null,
        visibleMs: imp.visibleMs,
      })),
    });

    return NextResponse.json({ ok: true, count: impressions.length });
  } catch (error) {
    console.error("Impressions batch error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
