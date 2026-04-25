import { NextResponse } from "next/server";
import { translateAllForRestaurant } from "@/lib/ai/translateContent";

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const { restaurantId } = await request.json();
    if (!restaurantId) return NextResponse.json({ error: "Missing restaurantId" }, { status: 400 });

    const result = await translateAllForRestaurant(restaurantId);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    console.error("[agregarlocal translate]", e);
    return NextResponse.json({ error: e.message || "Error" }, { status: 500 });
  }
}
