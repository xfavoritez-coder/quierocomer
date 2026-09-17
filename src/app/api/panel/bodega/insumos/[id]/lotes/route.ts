import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

/** GET /api/panel/bodega/insumos/[id]/lotes?restaurantId=X → lotes con saldo (FIFO). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const rest = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { bodegaId: true } });
  const insumo = await prisma.insumo.findUnique({ where: { id }, select: { bodegaId: true } });
  if (!insumo || !rest?.bodegaId || insumo.bodegaId !== rest.bodegaId) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const lotes = await prisma.insumoLote.findMany({
    where: { insumoId: id, cantidadRestante: { gt: 0 } },
    orderBy: [{ fecha: "asc" }, { createdAt: "asc" }],
    select: { id: true, fecha: true, precioUnitario: true, cantidadInicial: true, cantidadRestante: true },
  });
  return NextResponse.json({ lotes });
}
