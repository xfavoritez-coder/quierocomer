import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, assertOwnsRestaurant, authErrorResponse } from "@/lib/adminAuth";
import { translateDish } from "@/lib/ai/translateContent";
import { logActivity } from "@/lib/admin/logActivity";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { id } = await params;
    const body = await req.json();

    // Ownership check: fetch dish first to get restaurantId
    const existing = await prisma.dish.findUnique({ where: { id }, select: { restaurantId: true } });
    if (!existing) return NextResponse.json({ error: "Plato no encontrado" }, { status: 404 });
    await assertOwnsRestaurant(req, existing.restaurantId);

    // Enforce max 5 RECOMMENDED globally
    if (body.tags !== undefined && body.tags.includes("RECOMMENDED")) {
      const currentDish = await prisma.dish.findUnique({ where: { id }, select: { tags: true, restaurantId: true } });
      const alreadyRec = currentDish?.tags?.includes("RECOMMENDED");
      if (!alreadyRec && currentDish?.restaurantId) {
        const totalRecCount = await prisma.dish.count({
          where: { restaurantId: currentDish.restaurantId, tags: { has: "RECOMMENDED" }, isActive: true, deletedAt: null, id: { not: id } },
        });
        if (totalRecCount >= 5) {
          return NextResponse.json({ error: "Máximo 5 platos destacados. Quita uno antes de agregar otro." }, { status: 400 });
        }
      }
    }

    const dish = await prisma.dish.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description || null }),
        ...(body.price !== undefined && { price: Number(body.price) }),
        ...(body.discountPrice !== undefined && { discountPrice: body.discountPrice ? Number(body.discountPrice) : null }),
        ...(body.photos !== undefined && { photos: body.photos }),
        ...(body.tags !== undefined && { tags: body.tags }),
        ...(body.isHero !== undefined && { isHero: body.isHero }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.ingredients !== undefined && { ingredients: body.ingredients || null }),
        ...(body.allergens !== undefined && { allergens: body.allergens || null }),
        ...(body.dishDiet !== undefined && { dishDiet: body.dishDiet }),
        ...(body.isSpicy !== undefined && { isSpicy: body.isSpicy }),
        ...(body.isGlutenFree !== undefined && { isGlutenFree: body.isGlutenFree }),
        ...(body.isLactoseFree !== undefined && { isLactoseFree: body.isLactoseFree }),
        ...(body.isSoyFree !== undefined && { isSoyFree: body.isSoyFree }),
        ...(body.containsNuts !== undefined && { containsNuts: body.containsNuts }),
        ...(body.isHighMargin !== undefined && { isHighMargin: body.isHighMargin }),
        ...(body.isFeaturedAuto !== undefined && { isFeaturedAuto: body.isFeaturedAuto }),
        ...(body.flavorTags !== undefined && { flavorTags: body.flavorTags }),
        ...(body.isPhotoReferential !== undefined && { isPhotoReferential: body.isPhotoReferential }),
        ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
        ...(body.position !== undefined && { position: body.position }),
      },
      include: { category: { select: { id: true, name: true } }, dishIngredients: { select: { ingredientId: true } } },
    });

    // Re-translate if Spanish description changed
    if (body.description !== undefined) {
      // Reset auto-translations, keep manual ones
      await prisma.dishTranslation.updateMany({
        where: { dishId: id, isManual: false },
        data: { description: null },
      });
      translateDish(id).catch((e) => console.error("[translate dish]", e));
    }

    // Sync DishIngredient links if ingredientIds provided
    if (body.ingredientIds !== undefined) {
      await prisma.dishIngredient.deleteMany({ where: { dishId: id } });
      if (body.ingredientIds.length > 0) {
        await prisma.dishIngredient.createMany({
          data: body.ingredientIds.map((ingId: string) => ({ dishId: id, ingredientId: ingId })),
          skipDuplicates: true,
        });
      }
      const ings = await prisma.ingredient.findMany({ where: { id: { in: body.ingredientIds } }, select: { name: true } });
      await prisma.dish.update({ where: { id }, data: { ingredients: ings.map(i => i.name).join(", ") || null } });

      // Auto-detect allergen-free flags from ingredients
      if (body.ingredientIds.length > 0) {
        const allergens = await prisma.allergen.findMany({
          where: { ingredients: { some: { id: { in: body.ingredientIds } } } },
          select: { name: true },
        });
        const allergenNames = allergens.map(a => a.name.toLowerCase());
        const autoData: any = {};
        if (body.isGlutenFree === undefined) autoData.isGlutenFree = !allergenNames.includes("gluten");
        if (body.isLactoseFree === undefined) autoData.isLactoseFree = !allergenNames.includes("lactosa");
        if (body.isSoyFree === undefined) autoData.isSoyFree = !allergenNames.includes("soja") && !allergenNames.includes("soya");
        // Frutos secos: al reves — true si hay ingredientes con allergen tipo mani/nuez/almendra/etc.
        if (body.containsNuts === undefined) {
          autoData.containsNuts = allergenNames.some(a => /man[ií]|nuez|nueces|almendr|frutos secos|avellana|pistach|maranón|maranon|cashew/i.test(a));
        }
        if (Object.keys(autoData).length > 0) {
          await prisma.dish.update({ where: { id }, data: autoData });
        }
      }
    }

    // Track specific action for visibility toggle
    if (body.isActive !== undefined) {
      logActivity(existing.restaurantId, body.isActive ? "dish_show" : "dish_hide", { dishId: id, dishName: dish.name });
    }
    // Track activity
    const changes = Object.keys(body).filter(k => k !== "restaurantId");
    logActivity(existing.restaurantId, "dish_edit", { dishId: id, dishName: dish.name, fields: changes });

    return NextResponse.json(dish);
  } catch (e: any) {
    if (e.status === 403) return authErrorResponse(e);
    console.error("[Admin dishes PUT]", e);
    return NextResponse.json({ error: "Error al actualizar plato" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { id } = await params;

    // Ownership check
    const existing = await prisma.dish.findUnique({ where: { id }, select: { restaurantId: true } });
    if (!existing) return NextResponse.json({ error: "Plato no encontrado" }, { status: 404 });
    await assertOwnsRestaurant(req, existing.restaurantId);

    // Soft delete: mark as inactive + set deletedAt
    const deleted = await prisma.dish.update({ where: { id }, data: { isActive: false, deletedAt: new Date() }, select: { name: true } });
    logActivity(existing.restaurantId, "dish_delete", { dishId: id, dishName: deleted.name });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.status === 403) return authErrorResponse(e);
    console.error("[Admin dishes DELETE]", e);
    return NextResponse.json({ error: "Error al eliminar plato" }, { status: 500 });
  }
}
