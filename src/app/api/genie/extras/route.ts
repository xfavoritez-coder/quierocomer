import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const localId = req.nextUrl.searchParams.get("localId");
  const type = req.nextUrl.searchParams.get("type"); // "postres" or "bebidas"
  if (!localId) return NextResponse.json([]);

  try {
    const categories = type === "bebidas"
      ? ["COCKTAIL", "BEER", "WINE", "DRINK", "JUICE", "SMOOTHIE", "COFFEE", "TEA"]
      : ["DESSERT", "ICE_CREAM"];

    const items = await prisma.menuItem.findMany({
      where: { localId, isAvailable: true, categoria: { in: categories } },
      select: { id: true, nombre: true, precio: true, imagenUrl: true, categoria: true, avgRating: true, _count: { select: { ratings: true } } },
      orderBy: { totalLoved: "desc" },
      take: 4,
    });

    return NextResponse.json(items);
  } catch {
    return NextResponse.json([]);
  }
}
