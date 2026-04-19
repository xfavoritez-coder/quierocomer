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
    // source: "picked" (weight 10) | "genio_result" (weight 5) | "genio_liked" (weight 3) | "viewed" (weight 1) | "rejected" (weight -2)

    if (!guestId || !dishIds?.length) {
      return NextResponse.json({ ok: true }); // silently skip
    }

    const weight = source === "picked" ? 10 : source === "genio_result" ? 5 : source === "genio_liked" ? 3 : source === "rejected" ? -2 : 1;

    // Get ingredients for these dishes
    const dishIngredients = await prisma.dishIngredient.findMany({
      where: { dishId: { in: dishIds } },
      select: { ingredient: { select: { name: true } } },
    });

    if (dishIngredients.length === 0) {
      return NextResponse.json({ ok: true });
    }

    // Count ingredient occurrences * weight
    const counts: Record<string, number> = {};
    for (const di of dishIngredients) {
      const name = di.ingredient.name.toLowerCase();
      counts[name] = (counts[name] || 0) + weight;
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
