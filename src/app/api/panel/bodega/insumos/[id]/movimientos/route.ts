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

/** GET /api/panel/bodega/insumos/[id]/movimientos?restaurantId=&from=&to=
 *  Historial de ingresos/retiros del insumo (con costo FIFO). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sp = req.nextUrl.searchParams;
  const restaurantId = sp.get("restaurantId") || "";
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const rest = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { bodegaId: true } });
  const insumo = await prisma.insumo.findUnique({ where: { id }, select: { bodegaId: true } });
  if (!insumo || !rest?.bodegaId || insumo.bodegaId !== rest.bodegaId) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const from = sp.get("from") ? new Date(sp.get("from") as string) : null;
  const toRaw = sp.get("to") ? new Date(sp.get("to") as string) : null;
  const to = toRaw ? new Date(toRaw.getTime() + 24 * 60 * 60 * 1000) : null;
  const fecha: any = {};
  if (from && !isNaN(from.getTime())) fecha.gte = from;
  if (to && !isNaN(to.getTime())) fecha.lt = to;

  const movimientos = await prisma.movimientoInsumo.findMany({
    where: { insumoId: id, ...(Object.keys(fecha).length ? { fecha } : {}) },
    orderBy: { fecha: "desc" },
    take: 300,
    select: { id: true, tipo: true, motivo: true, cantidad: true, costoUnitario: true, costoTotal: true, nota: true, fecha: true },
  });

  const totalRetirado = movimientos.filter((m) => m.tipo === "retiro").reduce((s, m) => s + (m.costoTotal || 0), 0);
  return NextResponse.json({ movimientos, totalRetirado });
}
