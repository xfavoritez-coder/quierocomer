import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { translateAllForRestaurant } from "@/lib/ai/translateContent";

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const { restaurantId } = await req.json();
  if (!restaurantId) {
    return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });
  }

  try {
    const result = await translateAllForRestaurant(restaurantId);
    return NextResponse.json({
      ok: true,
      translated: result,
    });
  } catch (e) {
    console.error("[backfill translations]", e);
    return NextResponse.json({ error: "Error al traducir" }, { status: 500 });
  }
}
