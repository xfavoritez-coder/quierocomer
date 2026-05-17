import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const { ids } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Se requiere un array de IDs" }, { status: 400 });
    }

    let deleted = 0;
    for (const id of ids) {
      try {
        await prisma.dishImpression.deleteMany({ where: { session: { restaurantId: id } } });
        await prisma.dishFavorite.deleteMany({ where: { restaurantId: id } });
        await prisma.review.deleteMany({ where: { dish: { restaurantId: id } } });
        await prisma.dishIngredient.deleteMany({ where: { dish: { restaurantId: id } } });
        await prisma.dishTranslation.deleteMany({ where: { dish: { restaurantId: id } } });
        await prisma.modifierTemplateOption.deleteMany({ where: { group: { template: { restaurantId: id } } } });
        await prisma.modifierTemplateGroup.deleteMany({ where: { template: { restaurantId: id } } });
        await prisma.modifierTemplate.deleteMany({ where: { restaurantId: id } });
        await prisma.dish.deleteMany({ where: { restaurantId: id } });
        await prisma.category.deleteMany({ where: { restaurantId: id } });
        await prisma.waiterCall.deleteMany({ where: { restaurantId: id } });
        await prisma.waiterPushSubscription.deleteMany({ where: { restaurantId: id } });
        await prisma.statEvent.deleteMany({ where: { restaurantId: id } });
        await prisma.session.deleteMany({ where: { restaurantId: id } });
        await prisma.promotion.deleteMany({ where: { restaurantId: id } });
        await prisma.restaurantScheduleRule.deleteMany({ where: { restaurantId: id } });
        await prisma.restaurantTable.deleteMany({ where: { restaurantId: id } });
        await prisma.restaurant.delete({ where: { id } });
        deleted++;
      } catch (e) {
        console.error(`[Bulk delete] Error deleting ${id}:`, e);
      }
    }

    return NextResponse.json({ ok: true, deleted, total: ids.length });
  } catch (e: any) {
    console.error("[Admin bulk delete]", e);
    return NextResponse.json({ error: e.message || "Error al eliminar" }, { status: 500 });
  }
}
