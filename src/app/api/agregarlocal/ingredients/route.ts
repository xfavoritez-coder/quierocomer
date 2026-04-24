import { NextResponse } from "next/server";
export const maxDuration = 60;
import { prisma } from "@/lib/prisma";
import { extractIngredientsForDish } from "@/lib/ai/extractIngredients";

// Cache ingredients list across calls
let cachedIngredients: any[] | null = null;
let cachedIgnored: any[] | null = null;

export async function POST(request: Request) {
  try {
    const { dishId } = await request.json();
    if (!dishId) return NextResponse.json({ error: "Missing dishId" }, { status: 400 });

    const dish = await prisma.dish.findUnique({ where: { id: dishId }, select: { id: true, name: true, description: true } });
    if (!dish) return NextResponse.json({ error: "Dish not found" }, { status: 404 });

    if (!cachedIngredients) {
      cachedIngredients = await prisma.ingredient.findMany({ select: { id: true, name: true, aliases: true }, orderBy: { name: "asc" } });
      cachedIgnored = await prisma.ignoredIngredient.findMany({ select: { name: true } });
    }

    const result = await extractIngredientsForDish(dish.id, dish.name, dish.description, null, cachedIngredients, cachedIgnored || []);
    return NextResponse.json({ ok: true, matched: result.matched, suggested: result.suggested });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
