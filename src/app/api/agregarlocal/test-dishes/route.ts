import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug") || "calendula";

  const restaurant = await prisma.restaurant.findFirst({
    where: { slug: { contains: slug } },
    select: { id: true, name: true },
  });
  if (!restaurant) return NextResponse.json({ error: `No se encontró local con slug "${slug}"`, dishes: [] });

  const dishes = await prisma.dish.findMany({
    where: { restaurantId: restaurant.id, isActive: true },
    select: { id: true, name: true, photos: true },
    orderBy: { position: "asc" },
  });

  return NextResponse.json({ restaurantId: restaurant.id, name: restaurant.name, dishes });
}
