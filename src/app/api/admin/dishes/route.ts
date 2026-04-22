import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/adminAuth";
import { extractIngredientsForDish } from "@/lib/ai/extractIngredients";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });

  const dishes = await prisma.dish.findMany({
    where: { restaurantId, deletedAt: null },
    include: { category: { select: { id: true, name: true } }, modifierTemplates: { select: { id: true, name: true } } },
    orderBy: [{ category: { position: "asc" } }, { position: "asc" }],
  });
  return NextResponse.json(dishes);
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
      console.log(`[AI] ${name}: ${aiResult.matched.length} matched, ${aiResult.suggested.length} suggested, diet: ${aiResult.detectedDiet}`);
      // Update diet if detected and owner didn't set one (or left default)
      if (aiResult.detectedDiet && (!dishDiet || dishDiet === "OMNIVORE") && aiResult.detectedDiet !== "OMNIVORE") {
        await prisma.dish.update({ where: { id: dish.id }, data: { dishDiet: aiResult.detectedDiet } });
      }
    } catch (e) {
      console.error("[AI extract]", e);
    }

    return NextResponse.json({ ...dish, aiIngredients: aiResult });
  } catch (e) {
    console.error("[Admin dishes POST]", e);
    return NextResponse.json({ error: "Error al crear plato" }, { status: 500 });
  }
}
