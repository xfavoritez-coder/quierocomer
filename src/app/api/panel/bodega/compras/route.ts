import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureOwnBodega } from "@/lib/bodega/provision";

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

const TIPOS = ["factura", "boleta", "nota_entrega"];
const METODOS = ["transferencia", "efectivo", "debito", "webpay"];
const ESTADOS_PAGO = ["por_pagar", "pagada"];

/** GET /api/panel/bodega/compras?restaurantId=X → lista de compras + proveedores usados. */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const bodegaId = await ensureOwnBodega(restaurantId);
  const compras = await prisma.compra.findMany({
    where: { bodegaId },
    orderBy: { fecha: "desc" },
    take: 200,
    select: {
      id: true, fecha: true, fechaSolicitud: true, proveedorNombre: true, documentoTipo: true, documentoFolio: true,
      totalDeclarado: true, metodoPago: true, estadoPago: true, comentarios: true, fotoUrl: true, fotoPagoUrl: true,
      _count: { select: { lineas: true } },
    },
  });

  const proveedores = Array.from(
    new Set(compras.map((c) => (c.proveedorNombre || "").trim()).filter(Boolean))
  ).sort();

  return NextResponse.json({ compras, proveedores });
}

/** POST /api/panel/bodega/compras → crea la cabecera de una compra (documento). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { bodegaEnabled: true } });
  if (!r?.bodegaEnabled) return NextResponse.json({ error: "Bodega no habilitada" }, { status: 404 });

  const proveedorId = (body?.proveedorId || "").toString();
  const fechaEntrega = body?.fechaEntrega ? new Date(body.fechaEntrega) : null;
  const documentoTipo = (body?.documentoTipo || "").toString();
  const documentoFolio = (body?.documentoFolio || "").toString().trim();
  const total = body?.totalDeclarado === "" || body?.totalDeclarado == null ? NaN : Number(body.totalDeclarado);
  const metodoPago = (body?.metodoPago || "").toString();
  const estadoPago = (body?.estadoPago || "").toString();

  if (!proveedorId) return NextResponse.json({ error: "Selecciona un proveedor" }, { status: 400 });
  const rest = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { bodegaId: true } });
  const prov = await prisma.proveedor.findUnique({ where: { id: proveedorId }, select: { id: true, bodegaId: true, nombre: true } });
  if (!prov) return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });
  if (!rest?.bodegaId || prov.bodegaId !== rest.bodegaId) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  if (!fechaEntrega || isNaN(fechaEntrega.getTime())) return NextResponse.json({ error: "La fecha de entrega es obligatoria" }, { status: 400 });
  if (!Number.isFinite(total) || total < 0) return NextResponse.json({ error: "El total es obligatorio" }, { status: 400 });
  if (!TIPOS.includes(documentoTipo)) return NextResponse.json({ error: "Tipo de documento inválido" }, { status: 400 });
  if (!documentoFolio) return NextResponse.json({ error: "El número de documento es obligatorio" }, { status: 400 });
  if (!METODOS.includes(metodoPago)) return NextResponse.json({ error: "Método de pago inválido" }, { status: 400 });
  if (!ESTADOS_PAGO.includes(estadoPago)) return NextResponse.json({ error: "Estado de pago inválido" }, { status: 400 });

  const fechaSolicitud = body?.fechaSolicitud ? new Date(body.fechaSolicitud) : null;

  const compra = await prisma.compra.create({
    data: {
      restaurantId,
      bodegaId: prov.bodegaId,
      origen: "MANUAL",
      estado: "CONFIRMADA",
      confirmadaAt: new Date(),
      fecha: fechaEntrega,
      fechaSolicitud: fechaSolicitud && !isNaN(fechaSolicitud.getTime()) ? fechaSolicitud : null,
      proveedorId: prov.id,
      proveedorNombre: prov.nombre,
      documentoTipo,
      documentoFolio,
      totalDeclarado: total,
      metodoPago,
      estadoPago,
      comentarios: typeof body?.comentarios === "string" && body.comentarios.trim() ? body.comentarios.trim() : null,
      fotoUrl: typeof body?.fotoUrl === "string" && body.fotoUrl.trim() ? body.fotoUrl.trim() : null,
      fotoPagoUrl: typeof body?.fotoPagoUrl === "string" && body.fotoPagoUrl.trim() ? body.fotoPagoUrl.trim() : null,
    },
    select: { id: true, proveedorNombre: true, totalDeclarado: true },
  });

  return NextResponse.json({ compra });
}
