import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, assertOwnsRestaurant, authErrorResponse } from "@/lib/adminAuth";
import { parseEcommerceConfig } from "@/lib/ecommerce/config";
import { getStoreStatus, setStoreStatus, type UberStoreStatus } from "@/lib/ubereats/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function storeIdFor(restaurantId: string): Promise<string | null> {
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ecommerceConfig: true } });
  const ue = parseEcommerceConfig(r?.ecommerceConfig).ubereats;
  return ue?.enabled && ue?.storeId ? ue.storeId : null;
}

/** GET ?restaurantId=X → estado actual de la tienda en Uber Eats. */
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  try { await assertOwnsRestaurant(req, restaurantId); } catch (e) { return authErrorResponse(e); }
  const storeId = await storeIdFor(restaurantId);
  if (!storeId) return NextResponse.json({ error: "El local no tiene Store ID de Uber Eats" }, { status: 400 });
  const status = await getStoreStatus(storeId);
  return NextResponse.json({ ok: true, status });
}

/** POST { restaurantId, status } → pausa/reactiva la tienda en Uber Eats.
 *  ⚠️ Requiere el scope `eats.store.status.write` (producción). */
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  const status = (body?.status || "").toString().toUpperCase() as UberStoreStatus;
  if (!restaurantId || !["ONLINE", "PAUSED", "OFFLINE"].includes(status)) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try { await assertOwnsRestaurant(req, restaurantId); } catch (e) { return authErrorResponse(e); }
  const storeId = await storeIdFor(restaurantId);
  if (!storeId) return NextResponse.json({ error: "El local no tiene Store ID de Uber Eats" }, { status: 400 });
  const res = await setStoreStatus(storeId, status);
  if (!res.ok) return NextResponse.json({ ok: false, status: res.status, error: (res.body || "").slice(0, 300) || `HTTP ${res.status}` }, { status: 400 });
  return NextResponse.json({ ok: true, status });
}
