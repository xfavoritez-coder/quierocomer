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

/** Verifica que el proveedor pertenezca a la bodega del restaurante de la sesión. */
async function authProveedor(req: NextRequest, proveedorId: string, restaurantId: string) {
  if (!restaurantId || !(await assertOwnership(req, restaurantId))) return { error: "No autorizado", status: 403 as const };
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { bodegaId: true } });
  const prov = await prisma.proveedor.findUnique({ where: { id: proveedorId }, select: { bodegaId: true } });
  if (!prov) return { error: "Proveedor no encontrado", status: 404 as const };
  if (!r?.bodegaId || prov.bodegaId !== r.bodegaId) return { error: "No autorizado", status: 403 as const };
  return { ok: true as const };
}

const DETAIL_SELECT = {
  id: true, nombre: true, rut: true, razonSocial: true, telefono: true, correo: true, direccion: true, web: true,
  ctaNombre: true, ctaRut: true, ctaBanco: true, ctaTipo: true, ctaNumero: true,
  _count: { select: { compras: true } },
} as const;

function clean(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** GET /api/panel/bodega/proveedores/[id]?restaurantId=X → proveedor + sus facturas. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  const auth = await authProveedor(req, id, restaurantId);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const [proveedor, compras] = await Promise.all([
    prisma.proveedor.findUnique({ where: { id }, select: DETAIL_SELECT }),
    prisma.compra.findMany({
      where: { proveedorId: id },
      orderBy: { fecha: "desc" }, take: 200,
      select: { id: true, fecha: true, documentoTipo: true, documentoFolio: true, totalDeclarado: true, estadoPago: true, _count: { select: { lineas: true } } },
    }),
  ]);
  const totalComprado = compras.reduce((s, c) => s + (c.totalDeclarado || 0), 0);
  return NextResponse.json({ proveedor, compras, totalComprado });
}

/** PATCH /api/panel/bodega/proveedores/[id] → edita el proveedor. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  const auth = await authProveedor(req, id, restaurantId);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const data: Record<string, any> = {};
  if (typeof body.nombre === "string") {
    if (!body.nombre.trim()) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    data.nombre = body.nombre.trim();
  }
  for (const f of ["rut", "razonSocial", "telefono", "correo", "direccion", "web", "ctaNombre", "ctaRut", "ctaBanco", "ctaTipo", "ctaNumero"]) {
    if (body[f] !== undefined) data[f] = clean(body[f]);
  }

  try {
    const proveedor = await prisma.proveedor.update({ where: { id }, data, select: DETAIL_SELECT });
    return NextResponse.json({ proveedor });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ error: "Ya existe un proveedor con ese nombre" }, { status: 409 });
    console.error("[panel/bodega/proveedores PATCH]", e);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

/** DELETE /api/panel/bodega/proveedores/[id]?restaurantId=X → soft delete. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  const auth = await authProveedor(req, id, restaurantId);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  await prisma.proveedor.update({ where: { id }, data: { activo: false } });
  return NextResponse.json({ ok: true });
}
