import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth, assertOwnsRestaurant, authErrorResponse } from "@/lib/adminAuth";
import { syncStoreMenu } from "@/lib/ubereats/menu";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/admin/ubereats/sync-menu  { restaurantId }
 *  Sube el menú del local a su tienda de Uber Eats (admin/superadmin). */
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  try {
    await assertOwnsRestaurant(req, restaurantId);
  } catch (e) {
    return authErrorResponse(e);
  }
  const res = await syncStoreMenu(restaurantId);
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error || "No se pudo sincronizar" }, { status: 400 });
  return NextResponse.json({ ok: true, counts: res.counts });
}
