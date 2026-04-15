import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DIET_TO_DIETTYPE: Record<string, string[]> = {
  vegano: ["VEGAN"],
  vegetariano: ["VEGAN", "VEGETARIAN"],
  pescetariano: ["VEGAN", "VEGETARIAN"],
};

export async function GET(req: NextRequest) {
  try {
    const cat = req.nextUrl.searchParams.get("cat");
    const q = req.nextUrl.searchParams.get("q");
    const diet = req.nextUrl.searchParams.get("diet");

    const where: any = { isAvailable: true };
    if (cat) where.categoria = cat;
    if (q) {
      where.OR = [
        { nombre: { contains: q, mode: "insensitive" } },
        { local: { nombre: { contains: q, mode: "insensitive" } } },
      ];
    }

    const dishes = await prisma.menuItem.findMany({
      where,
      select: {
        id: true, nombre: true, categoria: true, precio: true,
        imagenUrl: true, dietType: true, avgRating: true, totalLoved: true,
        local: { select: { nombre: true } },
      },
      orderBy: [{ totalLoved: "desc" }, { avgRating: "desc" }],
      take: 80,
    });

    // Sort diet-matching dishes first
    if (diet && DIET_TO_DIETTYPE[diet]) {
      const preferred = DIET_TO_DIETTYPE[diet];
      dishes.sort((a, b) => {
        const aMatch = preferred.includes(a.dietType) ? 0 : 1;
        const bMatch = preferred.includes(b.dietType) ? 0 : 1;
        return aMatch - bMatch;
      });
    }

    return NextResponse.json(dishes);
  } catch (e) {
    console.error("[Explorar]", e);
    return NextResponse.json([], { status: 500 });
  }
}
