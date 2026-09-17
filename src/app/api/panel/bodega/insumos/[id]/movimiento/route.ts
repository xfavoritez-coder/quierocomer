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
  const insumo = await prisma.insumo.findUnique({ where: { id }, select: { bodegaId: true, stockActual: true, ultimoPrecio: true } });
  if (!insumo) return NextResponse.json({ error: "Insumo no encontrado" }, { status: 404 });
  if (!rest?.bodegaId || insumo.bodegaId !== rest.bodegaId) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const nota = typeof body?.nota === "string" && body.nota.trim() ? body.nota.trim().slice(0, 240) : null;

  if (tipo === "ingreso") {
    // Precio del lote (con IVA). Si no viene, usa el último lote o el último precio conocido.
    let precio = Number(body?.precioConIva);
    if (!Number.isFinite(precio) || precio < 0) {
      const last = await prisma.insumoLote.findFirst({ where: { insumoId: id }, orderBy: { createdAt: "desc" }, select: { precioUnitario: true } });
      precio = last?.precioUnitario ?? (insumo.ultimoPrecio != null ? insumo.ultimoPrecio * 1.19 : 0);
    }
    const actualizado = await prisma.$transaction(async (tx) => {
      await tx.insumoLote.create({ data: { insumoId: id, fecha: new Date(), precioUnitario: precio, cantidadInicial: cantidad, cantidadRestante: cantidad } });
      await tx.movimientoInsumo.create({ data: { insumoId: id, bodegaId: insumo.bodegaId, restaurantId, tipo: "ingreso", cantidad, costoUnitario: precio, costoTotal: precio * cantidad, nota } });
      return tx.insumo.update({ where: { id }, data: { stockActual: { increment: cantidad } }, select: INSUMO_SELECT });
    });
    return NextResponse.json({ insumo: actualizado });
  }

  // Retiro: consume los lotes más antiguos primero (FIFO) y guarda el costo consumido.
  const MOTIVOS = ["consumo", "merma", "ajuste", "otro"];
  const motivo = MOTIVOS.includes((body?.motivo || "").toString()) ? (body.motivo as string) : "consumo";

  const result = await prisma.$transaction(async (tx) => {
    const lotes = await tx.insumoLote.findMany({ where: { insumoId: id, cantidadRestante: { gt: 0 } }, orderBy: [{ fecha: "asc" }, { createdAt: "asc" }] });
    let restante = cantidad, costo = 0;
    for (const lote of lotes) {
      if (restante <= 0) break;
      const take = Math.min(lote.cantidadRestante, restante);
      costo += take * lote.precioUnitario; // costo FIFO con IVA
      await tx.insumoLote.update({ where: { id: lote.id }, data: { cantidadRestante: lote.cantidadRestante - take } });
      restante -= take;
    }
    const consumido = cantidad - restante; // lo realmente descontado (si no había suficiente)
    const insumoUpd = await tx.insumo.update({ where: { id }, data: { stockActual: { decrement: consumido } }, select: INSUMO_SELECT });
    await tx.movimientoInsumo.create({ data: { insumoId: id, bodegaId: insumo.bodegaId, restaurantId, tipo: "retiro", motivo, cantidad: consumido, costoUnitario: consumido > 0 ? costo / consumido : null, costoTotal: costo, nota } });
    return { insumo: insumoUpd, costo, consumido };
  });
  return NextResponse.json({ insumo: result.insumo, costoConsumido: result.costo, cantidadConsumida: result.consumido });
}
