import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/** GET /api/feed/swipe?seen=id1,id2,id3
 *  Devuelve hasta 30 platos con foto para el swipe feed.
 *  Excluye los IDs ya vistos en esta sesión.
 */
export async function GET(req: NextRequest) {
  const seen = req.nextUrl.searchParams.get('seen')?.split(',').filter(Boolean) ?? []

  const dishes = await prisma.dish.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      hiddenFromFeed: false,
      photos: { isEmpty: false },
      price: { gt: 0 },
      ...(seen.length > 0 ? { id: { notIn: seen } } : {}),
      restaurant: {
        isActive: true,
        isDemo: false,
        lat: { not: null },
        lng: { not: null },
        OR: [
          { googleMapsUrl: { not: null }, googleRating: { not: null } },
          { isShowcase: true },
        ],
      },
      category: { dishType: { not: 'drink' } },
    },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      photos: true,
      dishDiet: true,
      txDishType: true,
      txCuisine: true,
      txMealSlot: true,
      txIngredient: true,
      flavorTags: true,
      txEstilo: true,
      restaurant: {
        select: {
          name: true,
          slug: true,
          logoUrl: true,
          googleRating: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })

  // Shuffle para variedad
  const shuffled = dishes.sort(() => Math.random() - 0.5)

  return NextResponse.json(shuffled)
}
