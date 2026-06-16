import { prisma } from '@/lib/prisma'
import { unstable_cache } from 'next/cache'
import { normalizeCategory, isExcludedCategory, inferMealTime, inferDishType } from './categories'
import type { FeedDish } from '../types'

export type SearchIndexEntry = FeedDish & { _search: string }

type SearchIndex = {
  dishes: SearchIndexEntry[]
  restaurants: { label: string; slug: string }[]
}

async function _buildSearchIndex(): Promise<SearchIndex> {
  const [dishes, restaurants] = await Promise.all([
    prisma.dish.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        photos: { isEmpty: false },
        price: { gt: 0 },
        category: { dishType: { not: 'drink' } },
        restaurant: { isActive: true, isDemo: false },
      },
      select: {
        id: true, name: true, description: true, price: true, discountPrice: true,
        photos: true, dishDiet: true, isSpicy: true, isGlutenFree: true,
        isLactoseFree: true, isSoyFree: true, containsNuts: true,
        flavorTags: true, isHero: true, tags: true,
        category: { select: { name: true, dishType: true, normOverride: true, cuisineTag: true } },
        restaurant: { select: { id: true, name: true, slug: true, logoUrl: true, address: true, lat: true, lng: true, description: true } },
        feedStats: { select: { avgRating: true, ratingCount: true, commentCount: true, popularityScore: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.restaurant.findMany({
      where: { isActive: true, isDemo: false },
      select: { name: true, slug: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const indexedDishes: SearchIndexEntry[] = dishes
    .filter(d => !isExcludedCategory(d.category.name))
    .map(d => {
      const categoriaNorm = d.category.normOverride ?? normalizeCategory(d.category.name)
      const dish: FeedDish = {
        id: d.id,
        nombre: d.name,
        descripcion: d.description,
        precio: d.price,
        precioDescuento: d.discountPrice,
        fotoUrl: d.photos[0] ?? null,
        categoria: d.category.name,
        categoriaNorm,
        categoriaTipo: inferDishType(categoriaNorm, d.category.dishType),
        sabores: d.flavorTags,
        dieta: {
          tipo: d.dishDiet as 'VEGAN' | 'VEGETARIAN' | 'OMNIVORE',
          sinGluten: d.isGlutenFree, sinLactosa: d.isLactoseFree,
          sinSoja: d.isSoyFree, contieneFrutosSecos: d.containsNuts, esPicante: d.isSpicy,
        },
        restauranteId: d.restaurant.id,
        restaurante: d.restaurant.name,
        restauranteSlug: d.restaurant.slug,
        restauranteLogo: d.restaurant.logoUrl,
        restauranteDireccion: d.restaurant.address,
        restauranteLat: d.restaurant.lat,
        restauranteLng: d.restaurant.lng,
        enOferta: d.discountPrice != null && d.discountPrice < d.price,
        mealTime: inferMealTime(categoriaNorm),
        tags: d.tags,
        isHero: d.isHero,
        avgRating: d.feedStats?.avgRating ?? null,
        ratingCount: d.feedStats?.ratingCount ?? 0,
        commentCount: d.feedStats?.commentCount ?? 0,
        popularityScore: d.feedStats?.popularityScore ?? 0,
        cuisineTag: d.category.cuisineTag ?? null,
      }
      const _search = [
        d.name, d.description ?? '', d.restaurant.name,
        d.restaurant.description ?? '',
        categoriaNorm, ...(d.flavorTags ?? []),
      ].join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

      return { ...dish, _search }
    })

  return {
    dishes: indexedDishes,
    restaurants: restaurants.map(r => ({ label: r.name, slug: r.slug })),
  }
}

/** Índice completo cacheado 1 hora. */
export const getSearchIndex = unstable_cache(
  _buildSearchIndex,
  ['search-index'],
  { revalidate: 3600 },
)
