import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, getOwnedRestaurantIds, isSuperAdmin } from "@/lib/adminAuth";
import { syncRestaurantSales, loadCredentialsFromRestaurant } from "@/lib/toteat/sync";

/**
 * Manual on-demand sync of Toteat sales for a single restaurant.
 * Body: { restaurantId: string, days?: number, force?: boolean }
 *
 * Server-side debounce: ignores requests if the restaurant was synced in
 * the last 10 minutes. This protects the DB at scale (50+ clients with active
 * live dashboards would otherwise generate huge write volume) without losing
 * the "live" feel — owners get fresh data when they open the dashboard or
 * after staying on it for 10 min, plus a manual force-sync button.
 */
const DEBOUNCE_MS = 10 * 60_000;

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
  const force = !!body?.force;
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  // Authz: super-admin or owner of this restaurant
  if (!isSuperAdmin(req)) {
    const ownedIds = await getOwnedRestaurantIds(req);
    if (!ownedIds || !ownedIds.includes(restaurantId)) {
      return NextResponse.json({ error: "No tienes acceso a este local" }, { status: 403 });
    }
  }

  // Debounce check
  if (!force) {
    const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { toteatLastSyncAt: true } });
    if (r?.toteatLastSyncAt && Date.now() - r.toteatLastSyncAt.getTime() < DEBOUNCE_MS) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "debounced",
        lastSyncAt: r.toteatLastSyncAt,
      });
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
