import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin, getOwnedRestaurantIds } from "@/lib/adminAuth";

/**
 * Manually set or clear a Dish's Toteat product mapping.
 * Body: { toteatProductId?: string | null, noDirectMapping?: boolean }
 *
 * - toteatProductId: setea/limpia el codigo Toteat directo del plato
 * - noDirectMapping: true si el plato es agrupador (la atribucion va por
 *   modifiers, no por el plato padre). Limpia toteatProductId si existia.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const { id } = await ctx.params;
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const dish = await prisma.dish.findUnique({ where: { id }, select: { id: true, restaurantId: true } });
  if (!dish) return NextResponse.json({ error: "Plato no encontrado" }, { status: 404 });

  if (!isSuperAdmin(req)) {
    const ownedIds = await getOwnedRestaurantIds(req);
    if (!ownedIds || !ownedIds.includes(dish.restaurantId)) {
      return NextResponse.json({ error: "No tienes acceso a este plato" }, { status: 403 });
    }
  }

  const data: Record<string, any> = {};

  if (body?.noDirectMapping === true) {
    data.toteatNoDirectMapping = true;
    data.toteatProductId = null;
    data.toteatMappedAt = null;
    data.toteatMappedBy = null;
  } else if (body?.noDirectMapping === false) {
    data.toteatNoDirectMapping = false;
  }

  if (body?.toteatProductId !== undefined) {
    const tpid = body.toteatProductId || null;
    data.toteatProductId = tpid;
    data.toteatMappedAt = tpid ? new Date() : null;
    data.toteatMappedBy = tpid ? "manual" : null;
    if (tpid) data.toteatNoDirectMapping = false; // mapeo directo desactiva flag
  }

  await prisma.dish.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}
