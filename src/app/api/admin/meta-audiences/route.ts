// Trigger MANUAL (superadmin) del sync de Custom Audiences de Meta para un local.
// GET ?restaurantId=…  → corre el sync y devuelve el resultado (para probar/depurar).
import { NextRequest, NextResponse } from "next/server";
import { isSuperAdmin } from "@/lib/adminAuth";
import { syncRestaurantAudiences } from "@/lib/meta/syncAudiences";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  const result = await syncRestaurantAudiences(restaurantId);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
