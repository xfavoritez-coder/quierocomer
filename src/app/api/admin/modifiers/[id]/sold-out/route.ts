import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin, getOwnedRestaurantIds } from "@/lib/adminAuth";

/**
 * Mark a ModifierTemplateOption as sold out (agotado) or available.
 * Body: { soldOut: boolean }
 *
 * Un modificador agotado se muestra deshabilitado con badge "Agotado"
 * en el storefront del ecommerce (ambos temas).
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const { id } = await ctx.params;
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const soldOut = body?.soldOut === true;

  // Walk option → group → template → restaurant for ownership check
  const option = await prisma.modifierTemplateOption.findUnique({
    where: { id },
    select: { id: true, group: { select: { template: { select: { restaurantId: true } } } } },
  });
  if (!option) return NextResponse.json({ error: "Modificador no encontrado" }, { status: 404 });
  const restaurantId = option.group.template.restaurantId;

  if (!isSuperAdmin(req)) {
    const ownedIds = await getOwnedRestaurantIds(req);
    if (!ownedIds || !ownedIds.includes(restaurantId)) {
      return NextResponse.json({ error: "No tienes acceso a este modificador" }, { status: 403 });
    }
  }

  await prisma.modifierTemplateOption.update({
    where: { id },
    data: { soldOut },
  });

  return NextResponse.json({ ok: true, soldOut });
}
