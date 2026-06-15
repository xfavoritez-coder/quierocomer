import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json([])

  const dishes = await prisma.dish.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      photos: { isEmpty: false },
      price: { gt: 0 },
      category: { dishType: { not: 'drink' } },
      restaurant: { isActive: true, isDemo: false },
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { restaurant: { name: { contains: q, mode: 'insensitive' } } },
        { category: { name: { contains: q, mode: 'insensitive' } } },
      ],
    },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      discountPrice: true,
      photos: true,
      dishDiet: true,
      isSpicy: true,
      isGlutenFree: true,
      isLactoseFree: true,
      isSoyFree: true,
      containsNuts: true,
      flavorTags: true,
      isHero: true,
      tags: true,
      category: { select: { name: true, dishType: true } },
      restaurant: { select: { id: true, name: true, slug: true, logoUrl: true, address: true, lat: true, lng: true } },
      feedStats: { select: { avgRating: true, ratingCount: true, commentCount: true, popularityScore: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  // Also search restaurants by name (return unique restaurants)
  const restaurants = await prisma.restaurant.findMany({
    where: {
      isActive: true, isDemo: false,
      name: { contains: q, mode: 'insensitive' },
    },
    select: { name: true, slug: true },
    take: 5,
  })

  // Also find matching categories
  const categories = await prisma.category.findMany({
    where: { name: { contains: q, mode: 'insensitive' } },
    select: { name: true },
    distinct: ['name'],
    take: 5,
  })

  return NextResponse.json({
    dishes: dishes.map(d => ({
      id: d.id,
      nombre: d.name,
      descripcion: d.description,
      precio: d.price,
      precioDescuento: d.discountPrice,
      fotoUrl: d.photos[0] ?? null,
      categoriaNorm: d.category.name,
      categoriaTipo: d.category.dishType,
      restauranteId: d.restaurant.id,
      restaurante: d.restaurant.name,
      restauranteSlug: d.restaurant.slug,
      restauranteLogo: d.restaurant.logoUrl,
      restauranteDireccion: d.restaurant.address,
      restauranteLat: d.restaurant.lat,
      restauranteLng: d.restaurant.lng,
      enOferta: d.discountPrice != null && d.discountPrice < d.price,
      dieta: { tipo: d.dishDiet, sinGluten: d.isGlutenFree, sinLactosa: d.isLactoseFree, sinSoja: d.isSoyFree, contieneFrutosSecos: d.containsNuts, esPicante: d.isSpicy },
      sabores: d.flavorTags,
      tags: d.tags,
      isHero: d.isHero,
      mealTime: 'almuerzo_cena' as const,
      avgRating: d.feedStats?.avgRating ?? null,
      ratingCount: d.feedStats?.ratingCount ?? 0,
      commentCount: d.feedStats?.commentCount ?? 0,
      popularityScore: d.feedStats?.popularityScore ?? 0,
    })),
    suggestions: [
      ...categories.map(c => ({ label: c.name, type: 'categoria' as const })),
      ...restaurants.map(r => ({ label: r.name, type: 'restaurante' as const })),
    ],
  })
}
