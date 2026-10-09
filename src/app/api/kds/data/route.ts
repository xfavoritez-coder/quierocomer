import { NextRequest, NextResponse } from "next/server";
import { resolveKdsRestaurant, kdsOrders } from "@/lib/kds/liteServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// JSON de pedidos para el polling de la KDS liviana (autenticado por cookie kds_token).
export async function GET(req: NextRequest) {
  const token = req.cookies.get("kds_token")?.value || "";
  const rest = token ? await resolveKdsRestaurant(token) : null;
  if (!rest) return NextResponse.json({ ok: false, error: "No vinculado" }, { status: 401 });

  const { pend, comp } = await kdsOrders(rest.id);
  return NextResponse.json({ ok: true, pend, comp, now: Math.floor(Date.now() / 1000) }, { headers: { "cache-control": "no-store" } });
}
