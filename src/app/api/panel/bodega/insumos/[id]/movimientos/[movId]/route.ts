import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aplicarEfecto, revertirEfecto } from "@/lib/bodega/movimientos";

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
const MOTIVOS = ["consumo", "merma", "ajuste", "otro"];

async function loadMov(req: NextRequest, id: string, movId: string, restaurantId: string) {
  if (!restaurantId || !(await assertOwnership(req, restaurantId))) return { error: "No autorizado", status: 403 as const };
  const rest = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { bodegaId: true } });
  const mov = await prisma.movimientoInsumo.findUnique({ where: { id: movId }, select: { id: true, insumoId: true, bodegaId: true, tipo: true, motivo: true, cantidad: true, costoUnitario: true, detalle: true, fecha: true } });
  if (!mov || mov.insumoId !== id) return { error: "Movimiento no encontrado", status: 404 as const };
  if (!rest?.bodegaId || mov.bodegaId !== rest.bodegaId) return { error: "No autorizado", status: 403 as const };
  return { mov };
}

/** PATCH — edita un movimiento (cantidad/precio/motivo/nota) revirtiendo y re-aplicando. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; movId: string }> }) {
  const { id, movId } = await params;
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  const auth = await loadMov(req, id, movId, restaurantId);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { mov } = auth;

  const nuevaNota = body?.nota !== undefined ? (typeof body.nota === "string" && body.nota.trim() ? body.nota.trim().slice(0, 240) : null) : undefined;
  const nuevoMotivo = mov.tipo === "retiro" && body?.motivo !== undefined && MOTIVOS.includes(String(body.motivo)) ? String(body.motivo) : undefined;
  const recompute = body?.cantidad !== undefined || body?.precioConIva !== undefined;

  if (!recompute) {
    const data: Record<string, any> = {};
    if (nuevoMotivo !== undefined) data.motivo = nuevoMotivo;
    if (nuevaNota !== undefined) data.nota = nuevaNota;
    await prisma.movimientoInsumo.update({ where: { id: movId }, data });
    const insumo = await prisma.insumo.findUnique({ where: { id }, select: INSUMO_SELECT });
    return NextResponse.json({ insumo });
  }

  const cantidad = Number(body?.cantidad ?? mov.cantidad);
  if (!Number.isFinite(cantidad) || cantidad <= 0) return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });
  const precio = mov.tipo === "ingreso" ? Number(body?.precioConIva ?? mov.costoUnitario ?? 0) : undefined;

  try {
    const insumo = await prisma.$transaction(async (tx) => {
      const cur = await tx.movimientoInsumo.findUnique({ where: { id: movId }, select: { insumoId: true, tipo: true, cantidad: true, costoUnitario: true, detalle: true, fecha: true } });
      await revertirEfecto(tx, cur as any);
      const eff = await aplicarEfecto(tx, { insumoId: mov.insumoId, tipo: mov.tipo as "ingreso" | "retiro", cantidad, precioConIva: precio, fecha: cur!.fecha });
      await tx.movimientoInsumo.update({
        where: { id: movId },
        data: { cantidad: eff.cantidadAplicada, costoUnitario: eff.costoUnitario, costoTotal: eff.costoTotal, detalle: eff.detalle, ...(nuevoMotivo !== undefined ? { motivo: nuevoMotivo } : {}), ...(nuevaNota !== undefined ? { nota: nuevaNota } : {}) },
      });
      return tx.insumo.findUnique({ where: { id: mov.insumoId }, select: INSUMO_SELECT });
    });
    return NextResponse.json({ insumo });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "No se pudo editar el movimiento" }, { status: 409 });
  }
}

/** DELETE — elimina un movimiento y revierte su efecto en el stock/lotes. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; movId: string }> }) {
  const { id, movId } = await params;
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  const auth = await loadMov(req, id, movId, restaurantId);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { mov } = auth;

  try {
    const insumo = await prisma.$transaction(async (tx) => {
      const cur = await tx.movimientoInsumo.findUnique({ where: { id: movId }, select: { insumoId: true, tipo: true, cantidad: true, costoUnitario: true, detalle: true } });
      await revertirEfecto(tx, cur as any);
      await tx.movimientoInsumo.delete({ where: { id: movId } });
      return tx.insumo.findUnique({ where: { id: mov.insumoId }, select: INSUMO_SELECT });
    });
    return NextResponse.json({ ok: true, insumo });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "No se pudo eliminar el movimiento" }, { status: 409 });
  }
}
