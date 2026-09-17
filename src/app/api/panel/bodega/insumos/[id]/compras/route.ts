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

/** GET /api/panel/bodega/insumos/[id]/compras?restaurantId=&from=&to=
 *  Historial de compras del insumo (líneas) en el rango de fechas. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sp = req.nextUrl.searchParams;
  const restaurantId = sp.get("restaurantId") || "";
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const rest = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { bodegaId: true } });
  const insumo = await prisma.insumo.findUnique({ where: { id }, select: { bodegaId: true, nombre: true, unidadBase: true } });
  if (!insumo || !rest?.bodegaId || insumo.bodegaId !== rest.bodegaId) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const from = sp.get("from") ? new Date(sp.get("from") as string) : null;
  const toRaw = sp.get("to") ? new Date(sp.get("to") as string) : null;
  const to = toRaw ? new Date(toRaw.getTime() + 24 * 60 * 60 * 1000) : null; // incluir el día "to"

  const fechaFilter: any = {};
  if (from && !isNaN(from.getTime())) fechaFilter.gte = from;
  if (to && !isNaN(to.getTime())) fechaFilter.lt = to;

  const lineas = await prisma.compraLinea.findMany({
    where: {
      insumoId: id,
      compra: { bodegaId: rest.bodegaId, ...(Object.keys(fechaFilter).length ? { fecha: fechaFilter } : {}) },
    },
    select: {
      id: true, cantidad: true, precioNeto: true, iva: true, precioTotal: true, precioUnitario: true,
      compra: { select: { id: true, fecha: true, proveedorNombre: true, documentoTipo: true, documentoFolio: true } },
    },
  });

  const items = lineas
    .map((l) => ({
      lineaId: l.id,
      compraId: l.compra.id,
      fecha: l.compra.fecha.toISOString(),
      proveedorNombre: l.compra.proveedorNombre,
      documentoTipo: l.compra.documentoTipo,
      documentoFolio: l.compra.documentoFolio,
      cantidad: l.cantidad,
      precioUnitNeto: l.precioUnitario,
      precioUnitConIva: l.cantidad > 0 ? l.precioTotal / l.cantidad : l.precioUnitario,
      precioTotal: l.precioTotal,
    }))
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

  return NextResponse.json({ nombre: insumo.nombre, unidadBase: insumo.unidadBase, items });
}
