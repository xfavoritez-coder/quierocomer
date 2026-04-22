import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: read favorite ingredients for a guest
export async function GET(req: NextRequest) {
  const guestId = req.nextUrl.searchParams.get("guestId");
  if (!guestId) return NextResponse.json({ favorites: {} });
  const guest = await prisma.guestProfile.findUnique({
    where: { id: guestId },
    select: { favoriteIngredients: true },
  });
  return NextResponse.json({ favorites: (guest?.favoriteIngredients as Record<string, number>) || {} });
}

// POST: accumulate favorite ingredients for a guest
// Called from Genio (liked dishes) and heartbeat (viewed dishes)
export async function POST(request: Request) {
  try {
    const { guestId, dishIds, source } = await request.json();
    // Weights based on explicit user actions only:
    // "favorite" (+5) — tapped heart, strongest signal
    // "feedback_like" (+3) — confirmed genio recommendation was good
    // "genio_liked" (+2) — selected dish in genio grid
    // "picked" (+1) — genio suggested it (not confirmed by user)
    // "genio_result" (+1) — appeared as result
    // "feedback_dislike" (-3) — rejected genio recommendation
    // "rejected" (-2) — explicitly rejected

    if (!guestId || !dishIds?.length) {
      return NextResponse.json({ ok: true });
    }

    if (source === "viewed") return NextResponse.json({ ok: true });

    const weights: Record<string, number> = { favorite: 5, feedback_like: 3, genio_liked: 2, picked: 1, genio_result: 1, feedback_dislike: -3, rejected: -2 };
    const weight = weights[source] ?? 0;
    if (weight === 0) return NextResponse.json({ ok: true });

    // Get ingredients from DishIngredient table
    const dishIngredients = await prisma.dishIngredient.findMany({
      where: { dishId: { in: dishIds } },
      select: { dishId: true, ingredient: { select: { name: true } } },
    });

    // Also get text ingredients as fallback for dishes without DishIngredient links
    const dishIdsWithLinks = new Set(dishIngredients.map(di => di.dishId));
    const dishesWithoutLinks = dishIds.filter((id: string) => !dishIdsWithLinks.has(id));
    let textIngredients: { dishId: string; name: string }[] = [];
    if (dishesWithoutLinks.length > 0) {
      const dishes = await prisma.dish.findMany({
        where: { id: { in: dishesWithoutLinks } },
        select: { id: true, ingredients: true },
      });
      textIngredients = dishes.flatMap(d =>
        (d.ingredients || "").split(/[,;]+/).map(s => s.trim().toLowerCase()).filter(Boolean).map(name => ({ dishId: d.id, name }))
      );
    }

    if (dishIngredients.length === 0 && textIngredients.length === 0) {
      return NextResponse.json({ ok: true });
    }

    // Count ingredient occurrences * weight
    const counts: Record<string, number> = {};
    for (const di of dishIngredients) {
      const name = di.ingredient.name.toLowerCase();
      counts[name] = (counts[name] || 0) + weight;
    }
    for (const ti of textIngredients) {
      counts[ti.name] = (counts[ti.name] || 0) + weight;
    }

    // Merge with existing favorites
    const guest = await prisma.guestProfile.findUnique({
      where: { id: guestId },
      select: { favoriteIngredients: true },
    });

    const existing = (guest?.favoriteIngredients as Record<string, number>) || {};
    for (const [name, score] of Object.entries(counts)) {
      existing[name] = (existing[name] || 0) + score;
    }

    await prisma.guestProfile.update({
      where: { id: guestId },
      data: { favoriteIngredients: existing },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // fail silently
  }
}
