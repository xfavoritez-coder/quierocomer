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

/** GET /api/panel/bodega/compras/[id]/lineas?restaurantId=X → líneas de la compra. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const compra = await prisma.compra.findUnique({ where: { id }, select: { restaurantId: true } });
  if (!compra || compra.restaurantId !== restaurantId) return NextResponse.json({ error: "Compra no encontrada" }, { status: 404 });

  const lineas = await prisma.compraLinea.findMany({
    where: { compraId: id },
    select: { id: true, cantidad: true, unidad: true, precioTotal: true, precioUnitario: true, insumo: { select: { id: true, nombre: true } } },
  });
  return NextResponse.json({ lineas });
}

/** POST /api/panel/bodega/compras/[id]/lineas → agrega un insumo a la compra.
 *  Suma el stock del insumo y actualiza su último precio. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  const insumoId = (body?.insumoId || "").toString();
  const cantidad = Number(body?.cantidad);
  const precioTotal = Number(body?.precioTotal);

  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  if (!Number.isFinite(cantidad) || cantidad <= 0) return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });
  if (!Number.isFinite(precioTotal) || precioTotal < 0) return NextResponse.json({ error: "Precio inválido" }, { status: 400 });

  const rest = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { bodegaId: true } });
  const compra = await prisma.compra.findUnique({ where: { id }, select: { restaurantId: true } });
  if (!compra || compra.restaurantId !== restaurantId) return NextResponse.json({ error: "Compra no encontrada" }, { status: 404 });
  const insumo = await prisma.insumo.findUnique({ where: { id: insumoId }, select: { bodegaId: true, nombre: true, unidadBase: true } });
  if (!insumo) return NextResponse.json({ error: "Insumo no encontrado" }, { status: 404 });
  if (!rest?.bodegaId || insumo.bodegaId !== rest.bodegaId) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const precioUnitario = precioTotal / cantidad;

  const [linea, insumoActualizado] = await prisma.$transaction([
    prisma.compraLinea.create({
      data: {
        compraId: id, insumoId, textoOriginal: insumo.nombre,
        cantidad, unidad: insumo.unidadBase, precioTotal, precioUnitario,
      },
      select: { id: true, cantidad: true, unidad: true, precioTotal: true, precioUnitario: true, insumo: { select: { id: true, nombre: true } } },
    }),
    prisma.insumo.update({
      where: { id: insumoId },
      data: { stockActual: { increment: cantidad }, ultimoPrecio: precioUnitario },
      select: INSUMO_SELECT,
    }),
  ]);

  return NextResponse.json({ linea, insumo: insumoActualizado });
}
