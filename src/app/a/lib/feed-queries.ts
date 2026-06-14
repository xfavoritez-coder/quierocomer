import { prisma } from '@/lib/prisma'
import { normalizeCategory, isExcludedCategory, inferMealTime, inferDishType } from './categories'
import type { FeedDish } from '../types'
import { unstable_cache } from 'next/cache'

/** Trae todos los platos para el feed: con foto, activos, restaurantes reales */
async function _getFeedDishes(limit = 200): Promise<FeedDish[]> {
  const dishes = await prisma.dish.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      photos: { isEmpty: false },
      price: { gt: 0 },
      restaurant: {
        isActive: true,
        isDemo: false,
      },
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
      category: {
        select: {
          name: true,
          dishType: true,
        },
      },
      restaurant: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          address: true,
          lat: true,
          lng: true,
        },
      },
      feedStats: {
        select: {
          avgRating: true,
          ratingCount: true,
          commentCount: true,
          popularityScore: true,
        },
      },
    },
    orderBy: [
      { feedStats: { popularityScore: 'desc' } },
    ],
    take: limit,
  })

  const feedDishes: FeedDish[] = []

  for (const dish of dishes) {
    if (isExcludedCategory(dish.category.name)) continue

    const categoriaNorm = normalizeCategory(dish.category.name)

    feedDishes.push({
      id: dish.id,
      nombre: dish.name,
      descripcion: dish.description,
      precio: dish.price,
      precioDescuento: dish.discountPrice,
      fotoUrl: dish.photos[0] ?? null,
      categoria: dish.category.name,
      categoriaNorm,
      categoriaTipo: inferDishType(categoriaNorm, dish.category.dishType),
      sabores: dish.flavorTags,
      dieta: {
        tipo: dish.dishDiet as 'VEGAN' | 'VEGETARIAN' | 'OMNIVORE',
        sinGluten: dish.isGlutenFree,
        sinLactosa: dish.isLactoseFree,
        sinSoja: dish.isSoyFree,
        contieneFrutosSecos: dish.containsNuts,
        esPicante: dish.isSpicy,
      },
      restauranteId: dish.restaurant.id,
      restaurante: dish.restaurant.name,
      restauranteSlug: dish.restaurant.slug,
      restauranteLogo: dish.restaurant.logoUrl,
      restauranteDireccion: dish.restaurant.address,
      restauranteLat: dish.restaurant.lat,
      restauranteLng: dish.restaurant.lng,
      enOferta: dish.discountPrice != null && dish.discountPrice < dish.price,
      mealTime: inferMealTime(categoriaNorm),
      tags: dish.tags,
      isHero: dish.isHero,
      avgRating: dish.feedStats?.avgRating ?? null,
      ratingCount: dish.feedStats?.ratingCount ?? 0,
      commentCount: dish.feedStats?.commentCount ?? 0,
      popularityScore: dish.feedStats?.popularityScore ?? 0,
    })
  }

  return feedDishes
}

/** Cached version — shared across all users, revalidates every 5 minutes */
export const getFeedDishes = unstable_cache(
  _getFeedDishes,
  ['feed-dishes'],
  { revalidate: 300 }, // 5 minutes
)
