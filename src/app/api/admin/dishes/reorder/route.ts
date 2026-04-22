import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, assertOwnsRestaurant, authErrorResponse } from "@/lib/adminAuth";

// Reorder dishes within a category, or move a dish to another category
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { restaurantId, categoryId, dishIds, moveDishId, toCategoryId } = await req.json();

    // Move dish to another category
    if (moveDishId && toCategoryId) {
      const dish = await prisma.dish.findUnique({ where: { id: moveDishId }, select: { restaurantId: true } });
      if (!dish) return NextResponse.json({ error: "Plato no encontrado" }, { status: 404 });
      await assertOwnsRestaurant(req, dish.restaurantId);

      // Get max position in target category
      const maxPos = await prisma.dish.findFirst({
        where: { categoryId: toCategoryId },
        orderBy: { position: "desc" },
        select: { position: true },
      });

      await prisma.dish.update({
        where: { id: moveDishId },
        data: { categoryId: toCategoryId, position: (maxPos?.position ?? -1) + 1 },
      });

      return NextResponse.json({ success: true });
    }

    // Reorder dishes within category
    if (restaurantId && categoryId && dishIds?.length) {
      await assertOwnsRestaurant(req, restaurantId);

      // Update positions in order
      const updates = dishIds.map((id: string, index: number) =>
        prisma.dish.update({ where: { id }, data: { position: index } })
      );
      await prisma.$transaction(updates);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    console.error("[Dishes reorder]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
