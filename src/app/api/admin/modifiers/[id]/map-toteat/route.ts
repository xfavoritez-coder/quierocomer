import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin, getOwnedRestaurantIds } from "@/lib/adminAuth";

/**
 * Set or clear a ModifierTemplateOption's Toteat product mapping.
 * Body: { toteatProductId: string | null }
 *
 * Used when a parent dish (e.g. "Limonada Artesanal") has individual Toteat
 * codes per flavor (HV0301 Menta, HV0302 Jengibre…) that need to be summed
 * into the parent's sales total.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const { id } = await ctx.params;
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const toteatProductId: string | null = body?.toteatProductId ?? null;

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
    data: {
      toteatProductId: toteatProductId || null,
      toteatMappedAt: toteatProductId ? new Date() : null,
      toteatMappedBy: toteatProductId ? "manual" : null,
    },
  });

  return NextResponse.json({ ok: true });
}
