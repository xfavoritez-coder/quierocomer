import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { interactionId, score, comment, userId, sessionId } = await req.json();

    if (!interactionId || !score || !sessionId) {
      return NextResponse.json({ error: "Campos requeridos faltantes" }, { status: 400 });
    }

    // Get the interaction to find the menuItemId
    const interaction = await prisma.interaction.findUnique({
      where: { id: interactionId },
      select: { menuItemId: true },
    });
    if (!interaction) return NextResponse.json({ error: "Interaccion no encontrada" }, { status: 404 });

    // Create or update rating
    const ratingData = {
      score,
      comment: comment || null,
      sessionId,
      userId: userId || null,
      menuItemId: interaction.menuItemId,
    };

    if (userId) {
      await prisma.dishRating.upsert({
        where: { userId_menuItemId: { userId, menuItemId: interaction.menuItemId } },
        update: { score, comment: comment || null },
        create: ratingData,
      });
    } else {
      await prisma.dishRating.create({ data: ratingData });
    }

    // Update interaction action
    const actionMap: Record<string, string> = { LOVED: "LOVED", MEH: "MEH", DISLIKED: "DISLIKED" };
    if (actionMap[score]) {
      await prisma.interaction.update({
        where: { id: interactionId },
        data: { action: actionMap[score] as any },
      });
    }

    // Update MenuItem stats
    const allRatings = await prisma.dishRating.findMany({
      where: { menuItemId: interaction.menuItemId },
      select: { score: true },
    });
    const scoreValues: Record<string, number> = { LOVED: 1, MEH: 0.5, DISLIKED: 0 };
    const avg = allRatings.reduce((sum, r) => sum + (scoreValues[r.score] ?? 0.5), 0) / allRatings.length;
    const lovedCount = allRatings.filter(r => r.score === "LOVED").length;

    await prisma.menuItem.update({
      where: { id: interaction.menuItemId },
      data: { avgRating: Math.round(avg * 100) / 100, totalLoved: lovedCount },
    });

    // Update UserTasteProfile
    if (userId) {
      const dish = await prisma.menuItem.findUnique({
        where: { id: interaction.menuItemId },
        select: { ingredientTags: { select: { ingredient: { select: { name: true } } } } },
      });
      const dishIngredients = dish?.ingredientTags.map(t => t.ingredient.name) ?? [];

      if (score === "LOVED" && dishIngredients.length > 0) {
        const profile = await prisma.userTasteProfile.findUnique({ where: { userId }, select: { favoriteIngredients: true } });
        const current = new Set(profile?.favoriteIngredients ?? []);
        dishIngredients.forEach(i => current.add(i));
        await prisma.userTasteProfile.update({
          where: { userId },
          data: { favoriteIngredients: [...current] },
        });
      } else if (score === "DISLIKED" && dishIngredients.length > 0) {
        const profile = await prisma.userTasteProfile.findUnique({ where: { userId }, select: { avoidIngredients: true } });
        const current = new Set(profile?.avoidIngredients ?? []);
        dishIngredients.forEach(i => current.add(i));
        await prisma.userTasteProfile.update({
          where: { userId },
          data: { avoidIngredients: [...current] },
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[Genie feedback]", e);
    return NextResponse.json({ error: "Error al guardar feedback" }, { status: 500 });
  }
}
