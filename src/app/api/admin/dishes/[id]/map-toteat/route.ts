import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin, getOwnedRestaurantIds } from "@/lib/adminAuth";

/**
 * Manually set or clear a Dish's Toteat product mapping.
 * Body: { toteatProductId: string | null }
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const { id } = await ctx.params;
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const toteatProductId: string | null = body?.toteatProductId ?? null;

  const dish = await prisma.dish.findUnique({ where: { id }, select: { id: true, restaurantId: true } });
  if (!dish) return NextResponse.json({ error: "Plato no encontrado" }, { status: 404 });

  if (!isSuperAdmin(req)) {
    const ownedIds = await getOwnedRestaurantIds(req);
    if (!ownedIds || !ownedIds.includes(dish.restaurantId)) {
      return NextResponse.json({ error: "No tienes acceso a este plato" }, { status: 403 });
    }
  }

  await prisma.dish.update({
    where: { id },
    data: {
      toteatProductId: toteatProductId || null,
      toteatMappedAt: toteatProductId ? new Date() : null,
      toteatMappedBy: toteatProductId ? "manual" : null,
    },
  });

  return NextResponse.json({ ok: true });
}
