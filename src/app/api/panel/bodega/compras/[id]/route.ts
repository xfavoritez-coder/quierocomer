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

const TIPOS = ["factura", "boleta", "nota_entrega"];
const METODOS = ["transferencia", "efectivo", "debito", "webpay"];
const ESTADOS_PAGO = ["por_pagar", "pagada"];

const SELECT = {
  id: true, fecha: true, fechaSolicitud: true, proveedorId: true, proveedorNombre: true,
  documentoTipo: true, documentoFolio: true, totalDeclarado: true, metodoPago: true, estadoPago: true,
  comentarios: true, fotoUrl: true, fotoPagoUrl: true, _count: { select: { lineas: true } },
} as const;

/** PATCH /api/panel/bodega/compras/[id] — edita la cabecera de la factura. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const rest = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { bodegaId: true } });
  const compra = await prisma.compra.findUnique({ where: { id }, select: { bodegaId: true } });
  if (!compra || !rest?.bodegaId || compra.bodegaId !== rest.bodegaId) return NextResponse.json({ error: "Compra no encontrada" }, { status: 404 });

  const data: Record<string, any> = {};

  if (body.proveedorId !== undefined) {
    const prov = await prisma.proveedor.findUnique({ where: { id: String(body.proveedorId) }, select: { id: true, bodegaId: true, nombre: true } });
    if (!prov || prov.bodegaId !== rest.bodegaId) return NextResponse.json({ error: "Proveedor inválido" }, { status: 400 });
    data.proveedorId = prov.id; data.proveedorNombre = prov.nombre;
  }
  if (body.fechaEntrega !== undefined) {
    const f = body.fechaEntrega ? new Date(body.fechaEntrega) : null;
    if (!f || isNaN(f.getTime())) return NextResponse.json({ error: "Fecha de entrega inválida" }, { status: 400 });
    data.fecha = f;
  }
  if (body.fechaSolicitud !== undefined) {
    const f = body.fechaSolicitud ? new Date(body.fechaSolicitud) : null;
    data.fechaSolicitud = f && !isNaN(f.getTime()) ? f : null;
  }
  if (body.totalDeclarado !== undefined) {
    const t = body.totalDeclarado === "" || body.totalDeclarado == null ? NaN : Number(body.totalDeclarado);
    if (!Number.isFinite(t) || t < 0) return NextResponse.json({ error: "Total inválido" }, { status: 400 });
    data.totalDeclarado = t;
  }
  if (body.documentoTipo !== undefined) {
    if (!TIPOS.includes(String(body.documentoTipo))) return NextResponse.json({ error: "Tipo de documento inválido" }, { status: 400 });
    data.documentoTipo = body.documentoTipo;
  }
  if (body.documentoFolio !== undefined) {
    const f = String(body.documentoFolio).trim();
    if (!f) return NextResponse.json({ error: "El número de documento es obligatorio" }, { status: 400 });
    data.documentoFolio = f;
  }
  if (body.metodoPago !== undefined) {
    if (!METODOS.includes(String(body.metodoPago))) return NextResponse.json({ error: "Método de pago inválido" }, { status: 400 });
    data.metodoPago = body.metodoPago;
  }
  if (body.estadoPago !== undefined) {
    if (!ESTADOS_PAGO.includes(String(body.estadoPago))) return NextResponse.json({ error: "Estado de pago inválido" }, { status: 400 });
    data.estadoPago = body.estadoPago;
  }
  if (body.comentarios !== undefined) data.comentarios = typeof body.comentarios === "string" && body.comentarios.trim() ? body.comentarios.trim() : null;
  if (body.fotoUrl !== undefined) data.fotoUrl = typeof body.fotoUrl === "string" && body.fotoUrl.trim() ? body.fotoUrl.trim() : null;
  if (body.fotoPagoUrl !== undefined) data.fotoPagoUrl = typeof body.fotoPagoUrl === "string" && body.fotoPagoUrl.trim() ? body.fotoPagoUrl.trim() : null;

  const updated = await prisma.compra.update({ where: { id }, data, select: SELECT });
  return NextResponse.json({ compra: updated });
}
