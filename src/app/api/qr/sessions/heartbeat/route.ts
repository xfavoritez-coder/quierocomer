import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST needed for sendBeacon (can't send PATCH)
export async function POST(request: Request) { return handleHeartbeat(request); }
export async function PATCH(request: Request) { return handleHeartbeat(request); }

async function handleHeartbeat(request: Request) {
  try {
    let body;
    const ct = request.headers.get("content-type") || "";
    if (ct.includes("json")) {
      body = await request.json();
    } else {
      body = JSON.parse(await request.text());
    }

    const { sessionId, durationMs, viewUsed, viewHistory, dishesViewed, categoriesViewed, pickedDishId, preferences, isFinal } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    // Update session
    const session = await prisma.session.update({
      where: { id: sessionId },
      data: {
        durationMs: durationMs || undefined,
        viewUsed: viewUsed || undefined,
        viewHistory: viewHistory || undefined,
        dishesViewed: dishesViewed || undefined,
        categoriesViewed: categoriesViewed || undefined,
        pickedDishId: pickedDishId || undefined,
        endedAt: new Date(),
        ...(isFinal ? { isAbandoned: false, closeReason: body.closeReason || "normal" } : {}),
      },
      select: { guestId: true },
    });

    // Save preferences to GuestProfile (from localStorage via heartbeat)
    if (preferences && session.guestId) {
      await prisma.guestProfile.update({
        where: { id: session.guestId },
        data: { preferences },
      }).catch(() => {});
    }

    // On final heartbeat, accumulate favorite ingredients from viewed dishes (dwell > 3s)
    if (isFinal && session.guestId && Array.isArray(dishesViewed) && dishesViewed.length > 0) {
      const significantDishIds = dishesViewed
        .filter((d: any) => d.dishId && (d.dwellMs || 0) > 3000)
        .map((d: any) => d.dishId);

      if (significantDishIds.length > 0) {
        const dishIngredients = await prisma.dishIngredient.findMany({
          where: { dishId: { in: significantDishIds } },
          select: { dishId: true, ingredient: { select: { name: true } } },
        });

        // Fallback: text ingredients for dishes without DishIngredient links
        const idsWithLinks = new Set(dishIngredients.map(di => di.dishId));
        const idsWithout = significantDishIds.filter((id: string) => !idsWithLinks.has(id));
        let textIngr: string[] = [];
        if (idsWithout.length > 0) {
          const fallback = await prisma.dish.findMany({ where: { id: { in: idsWithout } }, select: { ingredients: true } });
          textIngr = fallback.flatMap(d => (d.ingredients || "").split(/[,;]+/).map(s => s.trim().toLowerCase()).filter(Boolean));
        }

        if (dishIngredients.length > 0 || textIngr.length > 0) {
          const counts: Record<string, number> = {};
          for (const di of dishIngredients) {
            const name = di.ingredient.name.toLowerCase();
            counts[name] = (counts[name] || 0) + 1;
          }
          for (const name of textIngr) {
            counts[name] = (counts[name] || 0) + 1;
          }

          const guest = await prisma.guestProfile.findUnique({
            where: { id: session.guestId },
            select: { favoriteIngredients: true },
          });
          const existing = (guest?.favoriteIngredients as Record<string, number>) || {};
          for (const [name, score] of Object.entries(counts)) {
            existing[name] = (existing[name] || 0) + score;
          }
          await prisma.guestProfile.update({
            where: { id: session.guestId },
            data: { favoriteIngredients: existing },
          }).catch(() => {});
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    // Session might not exist (race condition) — ignore silently
    return NextResponse.json({ ok: true });
  }
}
