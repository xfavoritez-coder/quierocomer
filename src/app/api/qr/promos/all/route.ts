import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const restaurantId = req.nextUrl.searchParams.get("restaurantId");
    if (!restaurantId) return NextResponse.json({ promos: [] });

    const promotions = await prisma.promotion.findMany({
      where: {
        restaurantId,
        status: "ACTIVE",
        OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
      },
      orderBy: { createdAt: "desc" },
    });

    if (!promotions.length) return NextResponse.json({ promos: [] });

    // Resolve dishes
    const allDishIds = promotions.flatMap(p => p.dishIds);
    const dishes = allDishIds.length ? await prisma.dish.findMany({
      where: { id: { in: allDishIds } },
      select: { id: true, name: true, description: true, price: true, photos: true, ingredients: true },
    }) : [];
    const dishMap = Object.fromEntries(dishes.map(d => [d.id, d]));

    const promos = promotions.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      discountPct: p.discountPct,
      promoPrice: p.promoPrice,
      originalPrice: p.originalPrice,
      validUntil: p.validUntil,
      dishes: p.dishIds.map(id => dishMap[id]).filter(Boolean),
    }));

    return NextResponse.json({ promos });
  } catch (error) {
    console.error("Promos all error:", error);
    return NextResponse.json({ promos: [] });
  }
}
