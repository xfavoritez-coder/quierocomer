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

const INSUMO_SELECT = {
  id: true, nombre: true, categoria: true, unidadBase: true,
  ultimoPrecio: true, rendimiento: true, precioConRendimiento: true, familia: true,
  stockActual: true, fotoUrl: true, esCritico: true,
} as const;

/** POST /api/panel/bodega/insumos/[id]/movimiento
 *  Body: { restaurantId, tipo: "ingreso" | "retiro", cantidad }
 *  Ajusta el stock del insumo (materializado). El retiro no baja de 0. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  const tipo = (body?.tipo || "").toString();
  const cantidad = Number(body?.cantidad);

  if (!restaurantId || !(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  if (tipo !== "ingreso" && tipo !== "retiro") return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  if (!Number.isFinite(cantidad) || cantidad <= 0) return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });

  const rest = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { bodegaId: true } });
  const insumo = await prisma.insumo.findUnique({ where: { id }, select: { bodegaId: true, stockActual: true } });
  if (!insumo) return NextResponse.json({ error: "Insumo no encontrado" }, { status: 404 });
  if (!rest?.bodegaId || insumo.bodegaId !== rest.bodegaId) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const nuevo = tipo === "ingreso"
    ? insumo.stockActual + cantidad
    : Math.max(0, insumo.stockActual - cantidad);

  const actualizado = await prisma.insumo.update({ where: { id }, data: { stockActual: nuevo }, select: INSUMO_SELECT });
  return NextResponse.json({ insumo: actualizado });
}
