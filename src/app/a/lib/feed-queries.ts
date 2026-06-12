import { prisma } from '@/lib/prisma'
import { normalizeCategory, isExcludedCategory } from './categories'
import type { FeedDish } from '../types'

type DietFilters = {
  isVegan: boolean
  isVegetarian: boolean
  isGlutenFree: boolean
  isLactoseFree: boolean
}

/** Trae platos para el feed: con foto, activos, de restaurantes reales, sin bebidas */
export async function getFeedDishes(limit = 60, diet?: DietFilters): Promise<FeedDish[]> {
  // Build diet filter for Prisma
  const dietWhere: Record<string, any> = {}
  if (diet?.isVegan) dietWhere.dishDiet = 'VEGAN'
  else if (diet?.isVegetarian) dietWhere.dishDiet = { in: ['VEGAN', 'VEGETARIAN'] }
  if (diet?.isGlutenFree) dietWhere.isGlutenFree = true
  if (diet?.isLactoseFree) dietWhere.isLactoseFree = true

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
      ...dietWhere,
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
    take: limit * 2, // traemos de más para filtrar bebidas
  })

  // Filtrar bebidas y normalizar
  const feedDishes: FeedDish[] = []

  for (const dish of dishes) {
    if (isExcludedCategory(dish.category.name)) continue
    if (dish.category.dishType === 'drink') continue

    feedDishes.push({
      id: dish.id,
      nombre: dish.name,
      descripcion: dish.description,
      precio: dish.price,
      precioDescuento: dish.discountPrice,
      fotoUrl: dish.photos[0] ?? null,
      categoria: dish.category.name,
      categoriaNorm: normalizeCategory(dish.category.name),
      categoriaTipo: dish.category.dishType,
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
      enOferta: dish.discountPrice != null && dish.discountPrice < dish.price,
      tags: dish.tags,
      isHero: dish.isHero,
      avgRating: dish.feedStats?.avgRating ?? null,
      ratingCount: dish.feedStats?.ratingCount ?? 0,
      commentCount: dish.feedStats?.commentCount ?? 0,
      popularityScore: dish.feedStats?.popularityScore ?? 0,
    })

    if (feedDishes.length >= limit) break
  }

  return feedDishes
}
