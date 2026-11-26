import { NextRequest, NextResponse } from "next/server";
import { getSellerFromRequest } from "@/lib/ventas/session";
import { seedShowcase } from "@/lib/ventas/showcase";

export const runtime = "nodejs";
export const maxDuration = 300;

/** POST /api/ventas/showcase/seed — crea o regenera el local de muestra (solo ADMIN). */
export async function POST(req: NextRequest) {
  const seller = await getSellerFromRequest(req);
  if (!seller || seller.role !== "ADMIN") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const res = await seedShowcase();
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    console.error("[ventas muestra]", e);
    return NextResponse.json({ error: (e as Error).message.slice(0, 300) }, { status: 500 });
  }
}
