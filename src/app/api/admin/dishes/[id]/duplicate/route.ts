// ═══════════════════════════════════════════════════════════
//  Duplicar un plato: crea una copia en la misma categoría, justo después del
//  original. Copia todos los campos de contenido, CONECTA los mismos modificadores
//  (son plantillas compartidas) y COPIA los ingredientes (composición por plato).
//  Resetea el mapeo a Toteat y los embeddings (la copia es un producto nuevo).
// ═══════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/adminAuth";
import { translateDish } from "@/lib/ai/translateContent";
import { logActivity } from "@/lib/admin/logActivity";
import { revalidateQrCache } from "@/lib/qr/revalidateQrCache";
import { syncDishToMeilisearch } from "@/lib/meilisearch";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  const { id } = await params;

  try {
    // Campos de contenido a copiar (se excluyen id/fechas/posición/embeddings/toteat).
    const orig = await prisma.dish.findUnique({
      where: { id },
      select: {
        restaurantId: true, categoryId: true, name: true, description: true, price: true,
        discountPrice: true, photos: true, tags: true, isHero: true, isActive: true,
        stockCountdown: true, soldOut: true, ingredients: true, allergens: true, dishDiet: true,
        isSpicy: true, flavorTags: true, isFeaturedAuto: true, isHighMargin: true, isPhotoReferential: true,
        isGlutenFree: true, isLactoseFree: true, isSoyFree: true, containsNuts: true, photoCredits: true,
        hiddenFromFeed: true, leafOverride: true, txDishType: true, txCuisine: true, txMealSlot: true,
        txIngredient: true, txEstilo: true, hideFromOrdering: true, ecommerceOnly: true, appOnly: true,
        daysOfWeek: true, detailedDescription: true, dailyBadge: true, newBadge: true,
        modifierTemplates: { select: { id: true } },
        dishIngredients: { select: { ingredientId: true } },
      },
    });
    if (!orig) return NextResponse.json({ error: "Plato no encontrado" }, { status: 404 });

    const maxPos = await prisma.dish.findFirst({
      where: { categoryId: orig.categoryId },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const { modifierTemplates, dishIngredients, photoCredits, ...scalars } = orig;
    const created = await prisma.dish.create({
      data: {
        ...scalars,
        // photoCredits es JSON nullable: solo se pasa si tiene valor (Prisma no acepta null directo).
        ...(photoCredits != null ? { photoCredits: photoCredits as object } : {}),
        name: `${orig.name} (copia)`,
        position: (maxPos?.position ?? -1) + 1,
        // Relaciones: los modificadores son plantillas compartidas → conectar las mismas.
        ...(modifierTemplates.length ? { modifierTemplates: { connect: modifierTemplates.map((m) => ({ id: m.id })) } } : {}),
        // Ingredientes: filas por plato → copiar apuntando a los mismos insumos.
        ...(dishIngredients.length ? { dishIngredients: { create: dishIngredients.map((di) => ({ ingredientId: di.ingredientId })) } } : {}),
      },
    });

    // Devolver el plato con la misma forma que el listado (/api/admin/dishes GET).
    const dish = await prisma.dish.findUnique({
      where: { id: created.id },
      include: {
        category: { select: { id: true, name: true } },
        modifierTemplates: { select: { id: true, name: true } },
        dishIngredients: { include: { ingredient: { include: { allergens: { select: { id: true, name: true, type: true } } } } } },
      },
    });
    const allergenMap: Record<string, string[]> = {};
    for (const di of dish?.dishIngredients || []) {
      for (const a of di.ingredient.allergens) {
        if (a.type === "ALLERGEN") {
          (allergenMap[a.name] ||= []);
          if (!allergenMap[a.name].includes(di.ingredient.name)) allergenMap[a.name].push(di.ingredient.name);
        }
      }
    }
    const derivedAllergens = Object.keys(allergenMap).join(", ") || null;
    const { dishIngredients: _omit, ...rest } = dish!;
    const result = { ...rest, allergens: derivedAllergens, allergenDetails: Object.keys(allergenMap).length ? allergenMap : null };

    logActivity(orig.restaurantId, "dish_duplicate", { fromDishId: id, dishId: created.id, dishName: created.name }, undefined, req);
    revalidateQrCache();
    syncDishToMeilisearch(created.id).catch(() => {});
    translateDish(created.id).catch((e) => console.error("[translate dish]", e));

    return NextResponse.json(result);
  } catch (e: any) {
    console.error("[Admin dishes duplicate]", e);
    return NextResponse.json({ error: "Error al duplicar el plato", detail: e?.message || String(e) }, { status: 500 });
  }
}
