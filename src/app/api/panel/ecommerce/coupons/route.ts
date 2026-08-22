import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseCoupons } from "@/lib/ecommerce/coupons";

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

/** GET → cupones + platos del local (para el producto gratis) + conteo de usos. */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ecommerceCoupons: true } });
  if (!r) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const dishes = await prisma.dish.findMany({ where: { restaurantId, isActive: true, deletedAt: null }, orderBy: [{ category: { position: "asc" } }, { position: "asc" }], select: { id: true, name: true } });

  const coupons = parseCoupons(r.ecommerceCoupons);
  // Conteo de usos por código.
  const usesRows = await prisma.ecommerceCouponUse.groupBy({ by: ["couponCode"], where: { restaurantId }, _count: { _all: true } });
  const uses: Record<string, number> = {};
  for (const row of usesRows) uses[row.couponCode] = row._count._all;

  return NextResponse.json({ coupons, dishes, uses });
}

/** PUT → guarda los cupones del local. */
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = body?.restaurantId as string | undefined;
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const coupons = parseCoupons(body?.coupons);
  // Validar códigos únicos.
  const codes = coupons.map((c) => c.code);
  if (new Set(codes).size !== codes.length) return NextResponse.json({ error: "Hay códigos de cupón repetidos" }, { status: 400 });

  await prisma.restaurant.update({ where: { id: restaurantId }, data: { ecommerceCoupons: coupons as unknown as object } });
  return NextResponse.json({ ok: true, coupons });
}
