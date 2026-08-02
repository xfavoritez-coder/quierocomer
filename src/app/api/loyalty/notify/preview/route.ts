import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth, requireRestaurantForOwner, authErrorResponse } from "@/lib/adminAuth";
import { getFilteredMemberIds, type MemberFilter } from "@/lib/loyalty/memberFilter";

export const runtime = "nodejs";

// GET /api/loyalty/notify/preview?restaurantId=xxx&filter=birthday_today
// Devuelve el número de destinatarios para el filtro dado (sin enviar nada).
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const restaurantId = req.nextUrl.searchParams.get("restaurantId");
    const filter = (req.nextUrl.searchParams.get("filter") || "all") as MemberFilter;
    if (!restaurantId) return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });
    await requireRestaurantForOwner(req, restaurantId);

    const ids = await getFilteredMemberIds(restaurantId, filter);
    return NextResponse.json({ count: ids.length });
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    console.error("[Loyalty notify preview]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
