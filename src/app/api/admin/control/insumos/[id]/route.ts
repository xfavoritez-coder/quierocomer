import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, requireRestaurantForOwner, authErrorResponse } from "@/lib/adminAuth";

/** PATCH /api/admin/control/insumos/[id] */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { id } = params;
    const body = await req.json();

    const existing = await prisma.insumo.findUnique({
      where: { id },
      select: { restaurantId: true },
    });
    if (!existing) return NextResponse.json({ error: "Insumo no encontrado" }, { status: 404 });

    await requireRestaurantForOwner(req, existing.restaurantId);

    const data: Record<string, any> = {};
    if (body.nombre !== undefined) data.nombre = body.nombre;
    if (body.categoria !== undefined) data.categoria = body.categoria;
    if (body.unidadBase !== undefined) data.unidadBase = body.unidadBase;
    if (body.esCritico !== undefined) data.esCritico = body.esCritico;
    if (body.ordenConteo !== undefined) data.ordenConteo = body.ordenConteo ?? null;
    if (body.activo !== undefined) data.activo = body.activo;
    if (body.ultimoPrecio !== undefined) data.ultimoPrecio = body.ultimoPrecio ?? null;

    const updated = await prisma.insumo.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    console.error("[control/insumos PATCH]", e);
    return NextResponse.json({ error: "Error al actualizar insumo" }, { status: 500 });
  }
}

/** DELETE /api/admin/control/insumos/[id] — soft delete */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { id } = params;

    const existing = await prisma.insumo.findUnique({
      where: { id },
      select: { restaurantId: true },
    });
    if (!existing) return NextResponse.json({ error: "Insumo no encontrado" }, { status: 404 });

    await requireRestaurantForOwner(req, existing.restaurantId);

    await prisma.insumo.update({ where: { id }, data: { activo: false } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    console.error("[control/insumos DELETE]", e);
    return NextResponse.json({ error: "Error al eliminar insumo" }, { status: 500 });
  }
}
