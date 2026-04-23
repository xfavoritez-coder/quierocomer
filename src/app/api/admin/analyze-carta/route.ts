import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";
import { extractIngredientsForDish } from "@/lib/ai/extractIngredients";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const { restaurantId } = await req.json();
    if (!restaurantId) return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });

    const dishes = await prisma.dish.findMany({
      where: { restaurantId, isActive: true, deletedAt: null },
      select: { id: true, name: true, description: true, photos: true },
    });

    // Pre-fetch ingredients and ignored list once (not per-dish)
    const existing = await prisma.ingredient.findMany({
      select: { id: true, name: true, aliases: true },
      orderBy: { name: "asc" },
    });
    const ignored = await prisma.ignoredIngredient.findMany({ select: { name: true } });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const results: any[] = [];
        let totalMatched = 0;
        let totalSuggested = 0;

        // Process in batches of 5 for speed
        const BATCH_SIZE = 5;
        for (let i = 0; i < dishes.length; i += BATCH_SIZE) {
          const batch = dishes.slice(i, i + BATCH_SIZE);
          const batchResults = await Promise.all(
            batch.map(dish =>
              extractIngredientsForDish(dish.id, dish.name, dish.description, null, existing, ignored)
            )
          );

          for (const result of batchResults) {
            results.push(result);
            totalMatched += result.matched.length;
            totalSuggested += result.suggested.length;

            // Send progress
            controller.enqueue(encoder.encode(
              JSON.stringify({ type: "progress", done: results.length, total: dishes.length, dish: result.dishName }) + "\n"
            ));
          }
        }

        // Send final result
        const allSuggestions = [...new Set(results.flatMap(r => r.suggested))].sort();
        controller.enqueue(encoder.encode(
          JSON.stringify({
            type: "done",
            dishesProcessed: dishes.length,
            totalMatched,
            totalSuggested,
            allSuggestions,
            results,
          }) + "\n"
        ));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Transfer-Encoding": "chunked" },
    });
  } catch (e) {
    console.error("[Analyze carta]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
