import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, getOwnedRestaurantIds, isSuperAdmin } from "@/lib/adminAuth";
import { syncRestaurantSales, loadCredentialsFromRestaurant } from "@/lib/toteat/sync";

/**
 * Manual on-demand sync of Toteat sales for a single restaurant.
 * Body: { restaurantId: string, days?: number }
 */
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const restaurantId = body?.restaurantId as string | undefined;
  const days = Math.min(Math.max(Number(body?.days) || 1, 1), 14);
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  // Authz: super-admin or owner of this restaurant
  if (!isSuperAdmin(req)) {
    const ownedIds = await getOwnedRestaurantIds(req);
    if (!ownedIds || !ownedIds.includes(restaurantId)) {
      return NextResponse.json({ error: "No tienes acceso a este local" }, { status: 403 });
    }
  }

  const credentials = await loadCredentialsFromRestaurant(restaurantId, /* fallbackToEnv */ true);
  if (!credentials) {
    return NextResponse.json({ error: "Restaurante sin credenciales Toteat configuradas" }, { status: 400 });
  }

  const result = await syncRestaurantSales({
    restaurantId,
    credentials,
    from: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
    to: new Date(),
  });

  return NextResponse.json(result);
}
