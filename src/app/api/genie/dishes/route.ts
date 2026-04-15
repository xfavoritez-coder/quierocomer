import { NextRequest, NextResponse } from "next/server";
import { getInitialDishes } from "@/lib/genie-dishes";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId") ?? undefined;
    const sessionId = req.nextUrl.searchParams.get("sessionId") ?? undefined;
    const exclude = req.nextUrl.searchParams.get("exclude");
    const excludeIds = exclude ? exclude.split(",").filter(Boolean) : [];
    const diet = req.nextUrl.searchParams.get("diet");
    const dietRestrictions = diet ? diet.split(",").filter(Boolean) : undefined;
    const category = req.nextUrl.searchParams.get("category") ?? "PLATOS";

    // Category filter mapping
    const CAT_MAP: Record<string, string[]> = {
      PLATOS: ["MAIN_COURSE", "PASTA", "PIZZA", "SUSHI", "BURGER", "SANDWICH", "SEAFOOD", "SALAD", "SOUP", "STARTER", "VEGETARIAN", "VEGAN", "BRUNCH", "BREAKFAST", "WOK", "SHARING", "COMBO"],
      DULCE: ["DESSERT", "ICE_CREAM"],
      BEBESTIBLE: ["COFFEE", "TEA", "JUICE", "DRINK", "SMOOTHIE", "COCKTAIL", "BEER", "WINE"],
    };

    if (category === "DULCE" || category === "BEBESTIBLE") {
      const allowedCats = CAT_MAP[category];
      const dishes = await prisma.menuItem.findMany({
        where: {
          isAvailable: true,
          categoria: { in: allowedCats },
        },
        include: {
          ingredientTags: { include: { ingredient: true } },
          local: { select: { id: true, nombre: true, comuna: true, direccion: true, lat: true, lng: true, logoUrl: true, linkPedido: true } },
        },
        orderBy: [{ totalLoved: "desc" }],
        take: 9,
      });
      return NextResponse.json(dishes.map(d => ({
        id: d.id, nombre: d.nombre, categoria: d.categoria, descripcion: d.descripcion,
        precio: d.precio, imagenUrl: d.imagenUrl, dietType: d.dietType,
        hungerLevel: d.hungerLevel, avgRating: d.avgRating, totalLoved: d.totalLoved,
        ingredients: d.ingredientTags.map(t => t.ingredient.name), local: d.local,
      })));
    }

    const dishes = await getInitialDishes(userId, sessionId, excludeIds, dietRestrictions);
    return NextResponse.json(dishes);
  } catch (e) {
    console.error("[Genie dishes]", e);
    return NextResponse.json({ error: "Error al cargar platos", detail: String(e) }, { status: 500 });
  }
}
