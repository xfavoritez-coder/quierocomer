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
    let totalExtracted = 0;
    let totalCreated = 0;

    for (const dish of dishes) {
      const result = await extractIngredientsForDish(
        dish.id,
        dish.name,
        dish.description,
        dish.photos?.[0] || null,
      );
      results.push(result);
      totalExtracted += result.extracted.length;
      totalCreated += result.created.length;
    }

    return NextResponse.json({
      dishesProcessed: dishes.length,
      totalExtracted,
      totalCreated,
      results,
    });
  } catch (e) {
    console.error("[Analyze carta]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
