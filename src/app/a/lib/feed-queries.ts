import { prisma } from '@/lib/prisma'
import { normalizeCategory, isExcludedCategory, inferMealTime, inferDishType } from './categories'
import type { FeedDish } from '../types'
import { unstable_cache } from 'next/cache'

/** Trae platos para el feed: hasta 5 por restaurante usando una sola query SQL */
async function _getFeedDishes(): Promise<FeedDish[]> {
  const MAX_PER = 8

  // Una sola query con ROW_NUMBER() — eficiente con cualquier cantidad de restaurantes
  const rows = await prisma.$queryRaw<any[]>`
    SELECT
      d.id, d.name, d.description, d.price, d."discountPrice",
      d.photos, d."dishDiet", d."isSpicy", d."isGlutenFree", d."isLactoseFree",
      d."isSoyFree", d."containsNuts", d."flavorTags", d."isHero", d.tags,
      c.name AS "categoryName", c."dishType",
      r.id AS "restaurantId", r.name AS "restaurantName", r.slug AS "restaurantSlug",
      r."logoUrl", r.address, r.lat, r.lng,
      r."googleRating", r."googleRatingCount", r."googleMapsUrl",
      fs."avgRating", fs."ratingCount", fs."commentCount", fs."popularityScore"
    FROM (
      SELECT d.id,
        ROW_NUMBER() OVER (PARTITION BY d."restaurantId" ORDER BY d."isHero" DESC, d."createdAt" DESC) AS rn
      FROM "Dish" d
      JOIN "Category" c ON c.id = d."categoryId"
      JOIN "Restaurant" r ON r.id = d."restaurantId"
      WHERE d."isActive" = true
        AND d."deletedAt" IS NULL
        AND d."hiddenFromFeed" = false
        AND array_length(d.photos, 1) > 0
        AND d.price > 0
        AND c."dishType" != 'drink'
        AND r."isActive" = true
        AND r."isDemo" = false
        AND r.lat IS NOT NULL
        AND r.lng IS NOT NULL
        AND r."googleMapsUrl" IS NOT NULL
        AND r."googleRating" IS NOT NULL
    ) ranked
    JOIN "Dish" d ON d.id = ranked.id
    JOIN "Category" c ON c.id = d."categoryId"
    JOIN "Restaurant" r ON r.id = d."restaurantId"
    LEFT JOIN "FeedDishStats" fs ON fs."dishId" = d.id
    WHERE ranked.rn <= ${MAX_PER}
  `

  const dishes = rows

  const feedDishes: FeedDish[] = []

  for (const d of dishes) {
    const catName = d.categoryName as string
    if (isExcludedCategory(catName)) continue
    const categoriaNorm = normalizeCategory(catName)
    const photos = Array.isArray(d.photos) ? d.photos : []
    feedDishes.push({
      id: d.id,
      nombre: d.name,
      descripcion: d.description,
      precio: Number(d.price),
      precioDescuento: d.discountPrice != null ? Number(d.discountPrice) : null,
      fotoUrl: photos[0] ?? null,
      categoria: catName,
      categoriaNorm,
      categoriaTipo: inferDishType(categoriaNorm, d.dishType),
      sabores: Array.isArray(d.flavorTags) ? d.flavorTags : [],
      dieta: {
        tipo: d.dishDiet as 'VEGAN' | 'VEGETARIAN' | 'OMNIVORE',
        sinGluten: d.isGlutenFree,
        sinLactosa: d.isLactoseFree,
        sinSoja: d.isSoyFree,
        contieneFrutosSecos: d.containsNuts,
        esPicante: d.isSpicy,
      },
      restauranteId: d.restaurantId,
      restaurante: d.restaurantName,
      restauranteSlug: d.restaurantSlug,
      restauranteLogo: d.logoUrl,
      restauranteDireccion: d.address,
      restauranteLat: d.lat != null ? Number(d.lat) : null,
      restauranteLng: d.lng != null ? Number(d.lng) : null,
      enOferta: d.discountPrice != null && Number(d.discountPrice) < Number(d.price),
      mealTime: inferMealTime(categoriaNorm),
      tags: Array.isArray(d.tags) ? d.tags : [],
      isHero: d.isHero,
      googleRating: d.googleRating != null ? Number(d.googleRating) : null,
      googleRatingCount: d.googleRatingCount != null ? Number(d.googleRatingCount) : null,
      googleMapsUrl: d.googleMapsUrl ?? null,
      avgRating: d.avgRating != null ? Number(d.avgRating) : null,
      ratingCount: Number(d.ratingCount ?? 0),
      commentCount: Number(d.commentCount ?? 0),
      popularityScore: Number(d.popularityScore ?? 0),
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

/** Fetch specific dishes by ID (for vector-scored dishes missing from the cache) */
export async function getDishesById(ids: string[]): Promise<FeedDish[]> {
  if (ids.length === 0) return []

  const dishes = await prisma.dish.findMany({
    where: { id: { in: ids } },
    select: {
      id: true, name: true, description: true, price: true, discountPrice: true,
      photos: true, dishDiet: true, isSpicy: true, isGlutenFree: true,
      isLactoseFree: true, isSoyFree: true, containsNuts: true, flavorTags: true,
      isHero: true, tags: true,
      category: { select: { name: true, dishType: true } },
      restaurant: { select: { id: true, name: true, slug: true, logoUrl: true, address: true, lat: true, lng: true, googleRating: true, googleRatingCount: true, googleMapsUrl: true } },
      feedStats: { select: { avgRating: true, ratingCount: true, commentCount: true, popularityScore: true } },
    },
  })

  return dishes
    .filter(d => !isExcludedCategory(d.category.name))
    .map(dish => {
      const categoriaNorm = normalizeCategory(dish.category.name)
      return {
        id: dish.id, nombre: dish.name, descripcion: dish.description,
        precio: dish.price, precioDescuento: dish.discountPrice,
        fotoUrl: dish.photos[0] ?? null, categoria: dish.category.name,
        categoriaNorm, categoriaTipo: inferDishType(categoriaNorm, dish.category.dishType),
        sabores: dish.flavorTags,
        dieta: {
          tipo: dish.dishDiet as 'VEGAN' | 'VEGETARIAN' | 'OMNIVORE',
          sinGluten: dish.isGlutenFree, sinLactosa: dish.isLactoseFree,
          sinSoja: dish.isSoyFree, contieneFrutosSecos: dish.containsNuts, esPicante: dish.isSpicy,
        },
        restauranteId: dish.restaurant.id, restaurante: dish.restaurant.name,
        restauranteSlug: dish.restaurant.slug, restauranteLogo: dish.restaurant.logoUrl,
        restauranteDireccion: dish.restaurant.address,
        restauranteLat: dish.restaurant.lat, restauranteLng: dish.restaurant.lng,
        googleRating: dish.restaurant.googleRating ?? null,
        googleRatingCount: dish.restaurant.googleRatingCount ?? null,
        googleMapsUrl: dish.restaurant.googleMapsUrl ?? null,
        enOferta: dish.discountPrice != null && dish.discountPrice < dish.price,
        mealTime: inferMealTime(categoriaNorm), tags: dish.tags, isHero: dish.isHero,
        avgRating: dish.feedStats?.avgRating ?? null,
        ratingCount: dish.feedStats?.ratingCount ?? 0,
        commentCount: dish.feedStats?.commentCount ?? 0,
        popularityScore: dish.feedStats?.popularityScore ?? 0,
      }
    })
}
