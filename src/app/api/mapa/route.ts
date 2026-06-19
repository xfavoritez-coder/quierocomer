import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const restaurants = await prisma.restaurant.findMany({
    where: {
      isActive: true,
      isDemo: false,
      lat: { not: null },
      lng: { not: null },
      googleMapsUrl: { not: null },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      lat: true,
      lng: true,
      logoUrl: true,
      googleRating: true,
      googleRatingCount: true,
      dishes: {
        where: {
          isActive: true,
          hiddenFromFeed: false,
          deletedAt: null,
          price: { gt: 0 },
        },
        select: {
          id: true,
          name: true,
          photos: true,
          price: true,
          category: {
            select: { name: true },
          },
        },
        orderBy: { position: 'asc' },
        take: 5,
      },
    },
  })

  const result = restaurants
    .filter((r) => r.lat !== null && r.lng !== null)
    .map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      lat: r.lat as number,
      lng: r.lng as number,
      logo: r.logoUrl ?? null,
      googleRating: r.googleRating ?? null,
      googleRatingCount: r.googleRatingCount ?? null,
      dishes: r.dishes
        .filter((d) => d.photos.length > 0)
        .map((d) => ({
          id: d.id,
          name: d.name,
          fotoUrl: d.photos[0] ?? null,
          precio: d.price,
          categoria: d.category.name,
        })),
    }))
    .filter((r) => r.dishes.length > 0)

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
    },
  })
}
