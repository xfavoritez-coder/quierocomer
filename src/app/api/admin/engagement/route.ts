import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/engagement
 *
 * Devuelve valoraciones y miembros loyalty por restaurante (solo los que tienen > 0).
 * Usado en el dashboard de admin para monitoreo rápido.
 */
export async function GET(req: NextRequest) {
  const adminId = req.cookies.get("admin_id")?.value;
  if (!adminId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Valoraciones por restaurante (agrupado)
  const reviewsRaw = await prisma.privateReview.groupBy({
    by: ["restaurantId"],
    _count: { id: true },
    _max: { createdAt: true },
    orderBy: { _count: { id: "desc" } },
  });

  // Loyalty members por restaurante (agrupado)
  const loyaltyRaw = await prisma.loyaltyMember.groupBy({
    by: ["restaurantId"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });

  // Obtener nombres de restaurantes involucrados
  const allRestaurantIds = Array.from(new Set([
    ...reviewsRaw.map(r => r.restaurantId),
    ...loyaltyRaw.map(r => r.restaurantId),
  ]));

  const restaurants = await prisma.restaurant.findMany({
    where: { id: { in: allRestaurantIds } },
    select: { id: true, name: true, slug: true },
  });
  const nameMap = new Map(restaurants.map(r => [r.id, r.name]));
  const slugMap = new Map(restaurants.map(r => [r.id, r.slug]));

  const reviews = reviewsRaw.map(r => ({
    restaurantId: r.restaurantId,
    name: nameMap.get(r.restaurantId) || r.restaurantId,
    slug: slugMap.get(r.restaurantId),
    count: r._count.id,
    lastAt: r._max.createdAt,
  }));

  const loyalty = loyaltyRaw.map(r => ({
    restaurantId: r.restaurantId,
    name: nameMap.get(r.restaurantId) || r.restaurantId,
    slug: slugMap.get(r.restaurantId),
    members: r._count.id,
  }));

  return NextResponse.json({ reviews, loyalty });
}
