import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPanelMagicToken } from "@/lib/magicLink";
import { getSellerFromRequest } from "@/lib/ventas/session";
import { getShowcaseOwner } from "@/lib/ventas/showcase";

export const runtime = "nodejs";

/** POST /api/ventas/showcase?to=panel|pos — enlace para entrar al panel o al POS del local de muestra. */
export async function POST(req: NextRequest) {
  const seller = await getSellerFromRequest(req);
  if (!seller) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const to = req.nextUrl.searchParams.get("to") === "pos" ? "pos" : "panel";
  const owner = await getShowcaseOwner();
  const has = owner ? await prisma.restaurant.count({ where: { ownerId: owner.id } }) : 0;
  if (!owner || !has || owner.status === "SUSPENDED") return NextResponse.json({ error: "El local de muestra aún no está creado. Un administrador puede crearlo en “Mi equipo”." }, { status: 409 });
  const url = `/api/panel/magic-entry?t=${encodeURIComponent(createPanelMagicToken(owner.id))}&r=${encodeURIComponent(to === "pos" ? "/pos" : "/panel")}`;
  return NextResponse.json({ url });
}
