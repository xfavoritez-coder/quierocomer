import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const cat = req.nextUrl.searchParams.get("cat");
    const q = req.nextUrl.searchParams.get("q");

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
      take: 50,
    });

    return NextResponse.json(dishes);
  } catch (e) {
    console.error("[Explorar]", e);
    return NextResponse.json([], { status: 500 });
  }
}
