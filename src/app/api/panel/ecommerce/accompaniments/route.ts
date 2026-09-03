import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseAccompConfig } from "@/lib/ecommerce/accompaniments";

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

/** GET → config de acompañamientos + platos del local (para las reglas por producto). */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ecommerceAccompaniments: true } });
  if (!r) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const rows = await prisma.dish.findMany({
    where: { restaurantId, isActive: true, deletedAt: null },
    orderBy: [{ category: { position: "asc" } }, { position: "asc" }],
    select: { id: true, name: true, category: { select: { name: true } } },
  });
  const dishes = rows.map((d) => ({ id: d.id, name: d.name, category: d.category?.name || "Sin categoría" }));

  return NextResponse.json({ config: parseAccompConfig(r.ecommerceAccompaniments), dishes });
}

/** PUT → guarda la config de acompañamientos. */
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = body?.restaurantId as string | undefined;
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const config = parseAccompConfig(body?.config);
  await prisma.restaurant.update({ where: { id: restaurantId }, data: { ecommerceAccompaniments: config as unknown as object } });
  return NextResponse.json({ ok: true, config });
}
