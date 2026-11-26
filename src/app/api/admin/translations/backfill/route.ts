import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth, assertOwnsRestaurant, authErrorResponse } from "@/lib/adminAuth";
import { translateAllForRestaurant } from "@/lib/ai/translateContent";

export async function POST(req: NextRequest) {
  // Allow CRON_SECRET header as alternative auth
  const cronSecret = req.headers.get("x-cron-secret");
  const viaCron = !!cronSecret && cronSecret === process.env.CRON_SECRET;
  if (!viaCron) {
    const authErr = checkAdminAuth(req);
    if (authErr) return authErr;
  }

  const { restaurantId } = await req.json();
  if (!restaurantId) {
    return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });
  }

  if (!viaCron) {
    try {
      await assertOwnsRestaurant(req, restaurantId);
    } catch (err) {
      return authErrorResponse(err);
    }
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
