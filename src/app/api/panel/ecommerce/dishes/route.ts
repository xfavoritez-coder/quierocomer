import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function verifyAccess(req: NextRequest, restaurantId: string): Promise<boolean> {
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

/** GET /api/panel/ecommerce/dishes?restaurantId=X — lista platos para la carta del POS */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await verifyAccess(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const dishes = await prisma.dish.findMany({
    where: { restaurantId, deletedAt: null },
    select: {
      id: true, name: true, price: true, isActive: true, soldOut: true,
      ecommerceOnly: true, appOnly: true, photos: true,
      category: { select: { id: true, name: true } },
    },
    orderBy: [{ category: { position: "asc" } }, { position: "asc" }],
  });

  return NextResponse.json(dishes);
}

/** PATCH /api/panel/ecommerce/dishes — actualiza isActive de un plato */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  const id = (body?.id || "").toString();
  if (!restaurantId || !id) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  if (!(await verifyAccess(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const dish = await prisma.dish.findUnique({ where: { id }, select: { restaurantId: true } });
  if (!dish || dish.restaurantId !== restaurantId) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const data: { isActive?: boolean } = {};
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (!Object.keys(data).length) return NextResponse.json({ error: "Sin cambios" }, { status: 400 });

  const updated = await prisma.dish.update({ where: { id }, data });
  return NextResponse.json({ ok: true, dish: updated });
}
