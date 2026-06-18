import { prisma } from '@/lib/prisma'
import SwipeClient from './SwipeClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: '¿Qué se te antoja? — QuieroComer' }

async function getInitialDishes() {
  const dishes = await prisma.dish.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      hiddenFromFeed: false,
      photos: { isEmpty: false },
      price: { gt: 0 },
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
        select: { name: true, slug: true, logoUrl: true, googleRating: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })

  // Shuffle
  return dishes.sort(() => Math.random() - 0.5)
}

export default async function SwipePage() {
  const dishes = await getInitialDishes()
  return <SwipeClient initialDishes={dishes as any} />
}
