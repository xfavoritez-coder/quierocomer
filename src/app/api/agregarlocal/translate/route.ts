import { NextRequest, NextResponse } from "next/server";
import { canSetupRestaurant } from "@/lib/restaurantClaim";
import { translateAllForRestaurant } from "@/lib/ai/translateContent";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const { restaurantId, claimToken } = await request.json();
    if (!restaurantId) return NextResponse.json({ error: "Missing restaurantId" }, { status: 400 });
    // Solo superadmin, o quien acaba de crear ESTE local en /agregarlocal.
    if (!canSetupRestaurant(request, String(restaurantId), claimToken)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const result = await translateAllForRestaurant(restaurantId);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    console.error("[agregarlocal translate]", e);
    return NextResponse.json({ error: e.message || "Error" }, { status: 500 });
  }
}
