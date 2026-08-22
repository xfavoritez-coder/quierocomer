import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseHours, getOpenStatus } from "@/lib/ecommerce/hours";

async function assertOwnership(req: NextRequest, restaurantId: string): Promise<boolean> {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return false;
  if (panelId === "demo") return true;
  if (panelId.startsWith("tm_")) {
    const m = await prisma.teamMember.findUnique({ where: { id: panelId.slice(3) }, select: { restaurantId: true } });
    return m?.restaurantId === restaurantId;
  }
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

/** GET → horario del ecommerce + estado abierto/cerrado ahora. */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ecommerceHours: true } });
  if (!r) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const hours = parseHours(r.ecommerceHours);
  return NextResponse.json({ hours, openNow: getOpenStatus(hours).open });
}

/** PUT → guarda el horario del ecommerce. */
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = body?.restaurantId as string | undefined;
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const hours = parseHours(body?.hours);
  await prisma.restaurant.update({ where: { id: restaurantId }, data: { ecommerceHours: hours as unknown as object } });
  return NextResponse.json({ ok: true, hours, openNow: getOpenStatus(hours).open });
}
