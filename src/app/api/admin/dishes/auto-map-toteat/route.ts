import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth, isSuperAdmin, getOwnedRestaurantIds } from "@/lib/adminAuth";
import { autoMapRestaurantDishes } from "@/lib/toteat/mapping";

/**
 * Auto-map every unmapped dish in a restaurant against Toteat product names.
 * Body: { restaurantId: string, force?: boolean }
 * - force=true: re-maps even already-mapped dishes (overwrites manual links).
 */
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const restaurantId = body?.restaurantId as string | undefined;
  const force = !!body?.force;
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  if (!isSuperAdmin(req)) {
    const ownedIds = await getOwnedRestaurantIds(req);
    if (!ownedIds || !ownedIds.includes(restaurantId)) {
      return NextResponse.json({ error: "No tienes acceso a este local" }, { status: 403 });
    }
  }

  const results = await autoMapRestaurantDishes(restaurantId, { force });
  const matched = results.filter((r) => r.status === "matched").length;
  const candidates = results.filter((r) => r.status === "candidate").length;
  const unmapped = results.filter((r) => r.status === "unmapped").length;

  return NextResponse.json({
    ok: true,
    summary: { total: results.length, matched, candidates, unmapped },
    results,
  });
}
