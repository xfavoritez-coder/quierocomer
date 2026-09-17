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

/** Verifica auth y devuelve la línea (con su compra/lote) o un error. */
async function loadLinea(req: NextRequest, id: string, lineaId: string, restaurantId: string) {
  if (!restaurantId || !(await assertOwnership(req, restaurantId))) return { error: "No autorizado", status: 403 as const };
  const rest = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { bodegaId: true } });
  const linea = await prisma.compraLinea.findUnique({
    where: { id: lineaId },
    select: { id: true, compraId: true, insumoId: true, cantidad: true, compra: { select: { bodegaId: true } } },
  });
  if (!linea || linea.compraId !== id) return { error: "Línea no encontrada", status: 404 as const };
  if (!rest?.bodegaId || linea.compra.bodegaId !== rest.bodegaId) return { error: "No autorizado", status: 403 as const };
  const lote = await prisma.insumoLote.findFirst({ where: { compraLineaId: lineaId } });
  return { linea, lote };
}

/** PATCH /api/panel/bodega/compras/[id]/lineas/[lineaId] — edita cantidad/precio de una línea. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; lineaId: string }> }) {
  const { id, lineaId } = await params;
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  const auth = await loadLinea(req, id, lineaId, restaurantId);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { linea, lote } = auth;

  const cantidad = Number(body?.cantidad);
  const precioUnitNeto = Number(body?.precioUnitNeto);
  const precioUnitConIva = body?.precioUnitConIva === "" || body?.precioUnitConIva == null ? Math.round(precioUnitNeto * 1.19) : Number(body.precioUnitConIva);
  if (!Number.isFinite(cantidad) || cantidad <= 0) return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });
  if (!Number.isFinite(precioUnitNeto) || precioUnitNeto < 0) return NextResponse.json({ error: "Precio inválido" }, { status: 400 });

  // Solo se puede editar si el lote no fue consumido (para no descuadrar el FIFO).
  if (lote && lote.cantidadRestante !== lote.cantidadInicial) {
    return NextResponse.json({ error: "No se puede editar: ya se consumió parte de este lote. Bórralo y créalo de nuevo." }, { status: 409 });
  }

  const precioNeto = precioUnitNeto * cantidad;
  const precioTotal = precioUnitConIva * cantidad;
  const iva = precioTotal - precioNeto;
  const delta = cantidad - linea.cantidad;

  const insumo = await prisma.$transaction(async (tx) => {
    await tx.compraLinea.update({ where: { id: lineaId }, data: { cantidad, precioNeto, iva, precioTotal, precioUnitario: precioUnitNeto } });
    if (lote) await tx.insumoLote.update({ where: { id: lote.id }, data: { cantidadInicial: cantidad, cantidadRestante: cantidad, precioUnitario: precioUnitConIva } });
    return tx.insumo.update({ where: { id: linea.insumoId! }, data: { stockActual: { increment: delta }, ultimoPrecio: precioUnitNeto }, select: INSUMO_SELECT });
  });

  const lineaAct = await prisma.compraLinea.findUnique({ where: { id: lineaId }, select: { id: true, cantidad: true, unidad: true, precioNeto: true, iva: true, precioTotal: true, precioUnitario: true, insumo: { select: { id: true, nombre: true } } } });
  return NextResponse.json({ linea: lineaAct, insumo });
}

/** DELETE /api/panel/bodega/compras/[id]/lineas/[lineaId]?restaurantId=X — elimina la línea y revierte el stock. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; lineaId: string }> }) {
  const { id, lineaId } = await params;
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  const auth = await loadLinea(req, id, lineaId, restaurantId);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { linea, lote } = auth;

  const insumo = await prisma.$transaction(async (tx) => {
    // Revierte del stock lo que aún queda del lote (lo ya consumido no vuelve).
    const revertir = lote ? lote.cantidadRestante : 0;
    if (lote) await tx.insumoLote.delete({ where: { id: lote.id } });
    await tx.compraLinea.delete({ where: { id: lineaId } });
    if (linea.insumoId && revertir > 0) {
      return tx.insumo.update({ where: { id: linea.insumoId }, data: { stockActual: { decrement: revertir } }, select: INSUMO_SELECT });
    }
    return linea.insumoId ? tx.insumo.findUnique({ where: { id: linea.insumoId }, select: INSUMO_SELECT }) : null;
  });

  return NextResponse.json({ ok: true, insumo });
}
