import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/adminAuth";
import { extractIngredientsForDish } from "@/lib/ai/extractIngredients";
import { translateDish } from "@/lib/ai/translateContent";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });

  const dishes = await prisma.dish.findMany({
    where: { restaurantId, deletedAt: null },
    include: {
      category: { select: { id: true, name: true } },
      modifierTemplates: { select: { id: true, name: true } },
      dishIngredients: {
        include: {
          ingredient: {
            include: { allergens: { select: { id: true, name: true, type: true } } },
          },
        },
      },
    },
    orderBy: [{ category: { position: "asc" } }, { position: "asc" }],
    take: 500,
  });

  // Compute derived allergens for each dish (only type ALLERGEN, not RESTRICTION)
  const result = dishes.map(d => {
    const allergenMap: Record<string, string[]> = {};
    for (const di of d.dishIngredients) {
      for (const a of di.ingredient.allergens) {
        if (a.type === "ALLERGEN") {
          if (!allergenMap[a.name]) allergenMap[a.name] = [];
          if (!allergenMap[a.name].includes(di.ingredient.name)) allergenMap[a.name].push(di.ingredient.name);
        }
      }
    }
    const derivedAllergens = Object.keys(allergenMap).join(", ") || null;
    const { dishIngredients: _, ...rest } = d;
    return { ...rest, allergens: derivedAllergens, allergenDetails: Object.keys(allergenMap).length > 0 ? allergenMap : null };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const { restaurantId, categoryId, name, description, price, discountPrice, photos, tags, isHero, ingredients, allergens, dishDiet } = body;

    if (!restaurantId || !categoryId || !name || price == null) {
      return NextResponse.json({ error: "restaurantId, categoryId, name y price requeridos" }, { status: 400 });
    }

    // Get max position in category
    const maxPos = await prisma.dish.findFirst({
      where: { categoryId },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const dish = await prisma.dish.create({
      data: {
        restaurantId,
        categoryId,
        name,
        description: description || null,
        price: Number(price),
        discountPrice: discountPrice ? Number(discountPrice) : null,
        photos: photos || [],
        tags: tags || [],
        isHero: !!isHero,
        ingredients: ingredients || null,
        allergens: allergens || null,
        dishDiet: dishDiet || "OMNIVORE",
        position: (maxPos?.position ?? -1) + 1,
      },
      include: { category: { select: { id: true, name: true } } },
    });

    // Extract ingredients (blocking, text-only for speed)
    let aiResult = null;
    try {
      aiResult = await extractIngredientsForDish(dish.id, name, description || null, null);
      console.log(`[AI] ${name}: ${aiResult.matched.length} matched, ${aiResult.suggested.length} suggested`);
    } catch (e) {
      console.error("[AI extract]", e);
    }

    // Auto-detect allergen-free flags from extracted ingredients
    try {
      const dishIngs = await prisma.dishIngredient.findMany({
        where: { dishId: dish.id },
        include: { ingredient: { include: { allergens: { select: { name: true } } } } },
      });
      if (dishIngs.length > 0) {
        const allergenNames = dishIngs.flatMap(di => di.ingredient.allergens.map(a => a.name.toLowerCase()));
        await prisma.dish.update({
          where: { id: dish.id },
          data: {
            isGlutenFree: !allergenNames.includes("gluten"),
            isLactoseFree: !allergenNames.includes("lactosa"),
            isSoyFree: !allergenNames.includes("soja") && !allergenNames.includes("soya"),
          },
        });
      }
    } catch (e) { console.error("[auto-detect allergens]", e); }

    // Translate description to en/pt in background
    if (description) {
      translateDish(dish.id).catch((e) => console.error("[translate dish]", e));
    }

    // Re-fetch dish with updated ingredients
    const updatedDish = await prisma.dish.findUnique({
      where: { id: dish.id },
      include: { category: { select: { id: true, name: true } }, modifierTemplates: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ ...(updatedDish || dish), aiIngredients: aiResult });
  } catch (e) {
    console.error("[Admin dishes POST]", e);
    return NextResponse.json({ error: "Error al crear plato" }, { status: 500 });
  }
}
