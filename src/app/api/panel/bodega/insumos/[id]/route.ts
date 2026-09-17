import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CATEGORIAS, UNIDADES } from "@/lib/bodega/labels";

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

/** Verifica que el insumo pertenezca a la bodega del restaurante que maneja la sesión.
 *  Devuelve el insumo (con precio/rendimiento) o null si no autorizado/no existe. */
async function authInsumo(req: NextRequest, insumoId: string, restaurantId: string) {
  if (!restaurantId || !(await assertOwnership(req, restaurantId))) return { error: "No autorizado", status: 403 as const };
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { bodegaId: true } });
  const insumo = await prisma.insumo.findUnique({ where: { id: insumoId }, select: { id: true, bodegaId: true, ultimoPrecio: true, rendimiento: true } });
  if (!insumo) return { error: "Insumo no encontrado", status: 404 as const };
  if (!r?.bodegaId || insumo.bodegaId !== r.bodegaId) return { error: "No autorizado", status: 403 as const };
  return { insumo };
}

const INSUMO_SELECT = {
  id: true, nombre: true, categoria: true, unidadBase: true,
  ultimoPrecio: true, rendimiento: true, precioConRendimiento: true, familia: true,
  stockActual: true, fotoUrl: true, esCritico: true, activo: true,
} as const;

/** PATCH /api/panel/bodega/insumos/[id] — edita un insumo. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();

  const auth = await authInsumo(req, id, restaurantId);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const data: Record<string, any> = {};
  if (typeof body.nombre === "string") {
    if (!body.nombre.trim()) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    data.nombre = body.nombre.trim();
  }
  if (body.categoria !== undefined) {
    if (!CATEGORIAS.includes(String(body.categoria))) return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
    data.categoria = body.categoria;
  }
  if (body.unidadBase !== undefined) {
    if (!UNIDADES.includes(String(body.unidadBase))) return NextResponse.json({ error: "Unidad inválida" }, { status: 400 });
    data.unidadBase = body.unidadBase;
  }
  if (body.familia !== undefined) data.familia = typeof body.familia === "string" && body.familia.trim() ? body.familia.trim().slice(0, 80) : null;
  if (body.fotoUrl !== undefined) data.fotoUrl = typeof body.fotoUrl === "string" && body.fotoUrl.trim() ? body.fotoUrl.trim() : null;
  if (body.activo !== undefined) data.activo = body.activo === true || body.activo === "true";

  // Precio / rendimiento (y recalcular precio con rendimiento si cambia alguno).
  const precioNext = body.ultimoPrecio !== undefined ? Number(body.ultimoPrecio) : auth.insumo.ultimoPrecio;
  const rendNext = body.rendimiento !== undefined ? Number(body.rendimiento) : auth.insumo.rendimiento;
  if (body.ultimoPrecio !== undefined) {
    if (!Number.isFinite(precioNext as number) || (precioNext as number) < 0) return NextResponse.json({ error: "Precio inválido" }, { status: 400 });
    data.ultimoPrecio = precioNext;
  }
  if (body.rendimiento !== undefined) {
    if (!Number.isFinite(rendNext as number) || (rendNext as number) <= 0) return NextResponse.json({ error: "Rendimiento inválido" }, { status: 400 });
    data.rendimiento = rendNext;
  }
  if ((body.ultimoPrecio !== undefined || body.rendimiento !== undefined) && Number.isFinite(precioNext as number) && Number.isFinite(rendNext as number) && (rendNext as number) > 0) {
    data.precioConRendimiento = (precioNext as number) / ((rendNext as number) / 100);
  }

  try {
    const insumo = await prisma.insumo.update({ where: { id }, data, select: INSUMO_SELECT });
    return NextResponse.json({ insumo });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ error: "Ya existe un insumo con ese nombre en la bodega" }, { status: 409 });
    console.error("[panel/bodega/insumos PATCH]", e);
    return NextResponse.json({ error: "Error al actualizar el insumo" }, { status: 500 });
  }
}

/** DELETE /api/panel/bodega/insumos/[id]?restaurantId=X — soft delete (activo:false). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";

  const auth = await authInsumo(req, id, restaurantId);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  await prisma.insumo.update({ where: { id }, data: { activo: false } });
  return NextResponse.json({ ok: true });
}
