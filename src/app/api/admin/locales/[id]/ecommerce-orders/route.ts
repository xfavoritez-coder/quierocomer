import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin, authErrorResponse } from "@/lib/adminAuth";

export const runtime = "nodejs";

/**
 * DELETE /api/admin/locales/[id]/ecommerce-orders
 * Elimina TODOS los pedidos del ecommerce (OnlineOrder source="ecommerce") de un
 * local. Solo superadmin. Irreversible. Útil para limpiar pruebas.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  try {
    if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    const { id } = await params;
    const restaurant = await prisma.restaurant.findUnique({ where: { id }, select: { id: true } });
    if (!restaurant) return NextResponse.json({ error: "Local no encontrado" }, { status: 404 });

    const res = await prisma.onlineOrder.deleteMany({ where: { restaurantId: id, source: "ecommerce" } });
    return NextResponse.json({ ok: true, deleted: res.count });
  } catch (e: any) {
    if (e?.status === 400 || e?.status === 403) return authErrorResponse(e);
    console.error("[admin ecommerce-orders DELETE]", e);
    return NextResponse.json({ error: "Error al eliminar los pedidos" }, { status: 500 });
  }
}
