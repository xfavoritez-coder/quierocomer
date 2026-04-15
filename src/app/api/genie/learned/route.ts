import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  const userId = req.nextUrl.searchParams.get("userId");
  if (!sessionId && !userId) return NextResponse.json({ categories: [], ingredients: [], locals: [] });

  try {
    const interactions = await prisma.interaction.findMany({
      where: {
        action: "SELECTED",
        ...(userId ? { userId } : { sessionId: sessionId! }),
      },
      select: {
        menuItem: {
          select: {
            categoria: true,
            ingredients: true,
            local: { select: { nombre: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Count categories
    const catCounts: Record<string, number> = {};
    const ingCounts: Record<string, number> = {};
    const localCounts: Record<string, number> = {};

    for (const i of interactions) {
      const cat = i.menuItem.categoria;
      catCounts[cat] = (catCounts[cat] ?? 0) + 1;

      for (const ing of i.menuItem.ingredients) {
        ingCounts[ing] = (ingCounts[ing] ?? 0) + 1;
      }

      const local = i.menuItem.local.nombre;
      localCounts[local] = (localCounts[local] ?? 0) + 1;
    }

    const categories = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
    const ingredients = Object.entries(ingCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }));
    const locals = Object.entries(localCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]) => ({ name, count }));

    return NextResponse.json({ categories, ingredients, locals, totalSelections: interactions.length });
  } catch {
    return NextResponse.json({ categories: [], ingredients: [], locals: [], totalSelections: 0 });
  }
}
