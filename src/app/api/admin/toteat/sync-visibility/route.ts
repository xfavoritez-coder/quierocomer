import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth, getOwnedRestaurantIds, isSuperAdmin } from "@/lib/adminAuth";
import { loadCredentialsFromRestaurant } from "@/lib/toteat/sync";
import { syncRestaurantVisibility } from "@/lib/toteat/syncVisibility";

/**
 * POST /api/admin/toteat/sync-visibility
 * Body: { restaurantId }
 *
 * Sincroniza solo la visibilidad (productos ocultos/visibles) — operacion ligera
 * que no requiere debounce, idempotente.
 */
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }
  const restaurantId = body?.restaurantId as string | undefined;
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  if (!isSuperAdmin(req)) {
    const ownedIds = await getOwnedRestaurantIds(req);
    if (!ownedIds || !ownedIds.includes(restaurantId)) {
      return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
    }
  }

  const credentials = await loadCredentialsFromRestaurant(restaurantId, false);
  if (!credentials) return NextResponse.json({ error: "Sin credenciales Toteat" }, { status: 400 });

  const result = await syncRestaurantVisibility({ restaurantId, credentials });
  return NextResponse.json(result);
}
