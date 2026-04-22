import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";
import { extractIngredientsForDish } from "@/lib/ai/extractIngredients";

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const { restaurantId } = await req.json();
    if (!restaurantId) return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });

    const dishes = await prisma.dish.findMany({
      where: { restaurantId, isActive: true },
      select: { id: true, name: true, description: true, photos: true },
    });

    const results = [];
    let totalMatched = 0;
    let totalSuggested = 0;

    for (const dish of dishes) {
      const result = await extractIngredientsForDish(
        dish.id,
        dish.name,
        dish.description,
        dish.photos?.[0] || null,
      );
      results.push(result);
      totalMatched += result.matched.length;
      totalSuggested += result.suggested.length;
    }

    // Collect all unique suggestions
    const allSuggestions = [...new Set(results.flatMap(r => r.suggested))].sort();

    return NextResponse.json({
      dishesProcessed: dishes.length,
      totalMatched,
      totalSuggested,
      allSuggestions,
      results,
    });
  } catch (e) {
    console.error("[Analyze carta]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
