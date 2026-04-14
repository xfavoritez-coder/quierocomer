import { NextRequest, NextResponse } from "next/server";
import { getInitialDishes } from "@/lib/genie-dishes";

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId") ?? undefined;
    const sessionId = req.nextUrl.searchParams.get("sessionId") ?? undefined;
    const exclude = req.nextUrl.searchParams.get("exclude");
    const excludeIds = exclude ? exclude.split(",").filter(Boolean) : [];

    const dishes = await getInitialDishes(userId, sessionId, excludeIds);
    return NextResponse.json(dishes);
  } catch (e) {
    console.error("[Genie dishes]", e);
    return NextResponse.json({ error: "Error al cargar platos" }, { status: 500 });
  }
}
