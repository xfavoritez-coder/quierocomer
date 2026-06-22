/**
 * Meilisearch integration for QC feed.
 * Docs live at https://www.meilisearch.com/docs
 *
 * Required env vars:
 *   MEILISEARCH_HOST    — e.g. https://abc123.meilisearch.io
 *   MEILISEARCH_API_KEY — master key or admin key
 */
import { Meilisearch as MeiliSearch } from 'meilisearch'
import { prisma } from '@/lib/prisma'
import {
  isExcludedCategory,
  inferMealTime,
  inferDishType,
  getParentCategory,
} from '@/app/a/lib/categories'
import {
  resolveDishLeaf,
  isBrandedDrink,
  isNamedDrink,
  isCocktailDrink,
  isVolumeBeverage,
  isPackagedProduct,
  isNonFoodItem,
  isCondimentOrExtra,
} from '@/app/a/lib/feed-queries'

export const MEILI_INDEX = 'dishes'

export interface MeiliDish {
  // Core dish
  id: string
  name: string
  description: string | null
  price: number
  discountPrice: number | null
  photos: string[]
  dishDiet: string
  isSpicy: boolean
  isGlutenFree: boolean
  isLactoseFree: boolean
  isSoyFree: boolean
  containsNuts: boolean
  flavorTags: string[]
  isHero: boolean
  tags: string[]
  leafOverride: string | null
  txDishType: string[]
  txIngredient: string[]
  createdAtTs: number
  // Pre-computed category fields
  categoryName: string
  dishType: string
  cuisineTag: string | null
  catNormOverride: string | null
  categoriaNorm: string
  categoriaParent: string
  mealTime: string
  // Restaurant
  restaurantId: string
  restaurantName: string
  restaurantSlug: string
  logoUrl: string | null
  address: string | null
  restaurantCity: string | null
  isShowcase: boolean
  googleRating: number | null
  googleRatingCount: number | null
  googleMapsUrl: string | null
  googlePlaceId: string | null
  phone: string | null
  website: string | null
  websiteIsOrderUrl: boolean
  cartaProvider: string | null
  instagram: string | null
  primaryCategory: string | null
  // Stats
  avgRating: number | null
  ratingCount: number
  commentCount: number
  popularityScore: number
  // Feed eligibility: all conditions pre-computed so Meilisearch can filter cheaply
  isEligibleForFeed: boolean
  // Geo (omitted when restaurant has no coordinates)
  _geo?: { lat: number; lng: number }
}

// ── Lazy client (avoids initializing at import time in edge/build) ─────────────

let _client: MeiliSearch | null = null

export function getMeiliClient(): MeiliSearch {
  if (!_client) {
    const host = process.env.MEILISEARCH_HOST
    const key = process.env.MEILISEARCH_API_KEY
    if (!host || !key) {
      throw new Error('MEILISEARCH_HOST and MEILISEARCH_API_KEY env vars are required')
    }
    _client = new MeiliSearch({ host, apiKey: key })
  }
  return _client
}

export function isMeiliConfigured(): boolean {
  return !!(process.env.MEILISEARCH_HOST && process.env.MEILISEARCH_API_KEY)
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseCity(address: string | null): string | null {
  if (!address) return null
  const parts = address.split(',').map(p => p.trim()).filter(Boolean)
  // Chilean addresses: "Calle 123, Comuna, Ciudad" → last part is city/region
  return parts.length >= 2 ? parts[parts.length - 1] : parts[0] ?? null
}

// ── Build document ─────────────────────────────────────────────────────────────

export function buildMeiliDoc(
  dish: {
    id: string; name: string; description: string | null; price: number
    discountPrice: number | null; photos: string[]; dishDiet: string
    isSpicy: boolean; isGlutenFree: boolean; isLactoseFree: boolean
    isSoyFree: boolean; containsNuts: boolean; flavorTags: string[]
    isHero: boolean; tags: string[]; leafOverride: string | null
    txDishType: string[]; txIngredient: string[]; hiddenFromFeed: boolean
    isActive: boolean; deletedAt: Date | null; createdAt: Date
  },
  category: {
    name: string; dishType: string; cuisineTag: string | null; normOverride: string | null
  },
  restaurant: {
    id: string; name: string; slug: string; logoUrl: string | null; address: string | null
    lat: number | Decimal | null; lng: number | Decimal | null; primaryCategory: string | null
    isShowcase: boolean; googleRating: number | Decimal | null; googleRatingCount: number | null
    googleMapsUrl: string | null; googlePlaceId: string | null; phone: string | null
    website: string | null; websiteIsOrderUrl: boolean; cartaProvider: string | null
    instagram: string | null; isActive: boolean; isDemo: boolean
  },
  stats: { avgRating: number | Decimal | null; ratingCount: number; commentCount: number; popularityScore: number | Decimal } | null,
): MeiliDish {
  const catName = category.name
  const categoriaNorm = resolveDishLeaf(
    dish.name, catName, dish.leafOverride,
    restaurant.primaryCategory, dish.description, category.normOverride,
  )
  const categoriaParent = getParentCategory(categoriaNorm)
  const mealTime = inferMealTime(categoriaNorm)

  // Compute feed eligibility (mirrors the SQL WHERE + JS filters in /api/dishes/search)
  const basicEligible =
    dish.isActive &&
    dish.deletedAt === null &&
    !dish.hiddenFromFeed &&
    dish.photos.length > 0 &&
    (dish.price > 0 || restaurant.isShowcase) &&
    category.dishType !== 'drink' &&
    restaurant.isActive &&
    !restaurant.isDemo &&
    restaurant.lat != null &&
    restaurant.lng != null &&
    (restaurant.googleMapsUrl != null || restaurant.isShowcase) &&
    (restaurant.googleRating != null || restaurant.isShowcase)

  const contentEligible =
    !isExcludedCategory(catName) &&
    !isBrandedDrink(dish.name) &&
    !isNamedDrink(dish.name) &&
    !isCocktailDrink(dish.name) &&
    !isVolumeBeverage(dish.name) &&
    !isPackagedProduct(dish.name, dish.description) &&
    !isNonFoodItem(dish.name, catName) &&
    !isCondimentOrExtra(dish.name)

  const doc: MeiliDish = {
    id: dish.id,
    name: dish.name,
    description: dish.description,
    price: Number(dish.price),
    discountPrice: dish.discountPrice != null ? Number(dish.discountPrice) : null,
    photos: dish.photos,
    dishDiet: dish.dishDiet,
    isSpicy: dish.isSpicy,
    isGlutenFree: dish.isGlutenFree,
    isLactoseFree: dish.isLactoseFree,
    isSoyFree: dish.isSoyFree,
    containsNuts: dish.containsNuts,
    flavorTags: dish.flavorTags,
    isHero: dish.isHero,
    tags: dish.tags as string[],
    leafOverride: dish.leafOverride,
    txDishType: dish.txDishType,
    txIngredient: dish.txIngredient,
    createdAtTs: dish.createdAt.getTime(),
    categoryName: catName,
    dishType: category.dishType,
    cuisineTag: category.cuisineTag,
    catNormOverride: category.normOverride,
    categoriaNorm,
    categoriaParent,
    mealTime,
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    restaurantSlug: restaurant.slug,
    logoUrl: restaurant.logoUrl,
    address: restaurant.address,
    restaurantCity: parseCity(restaurant.address),
    isShowcase: restaurant.isShowcase,
    googleRating: restaurant.googleRating != null ? Number(restaurant.googleRating) : null,
    googleRatingCount: restaurant.googleRatingCount != null ? Number(restaurant.googleRatingCount) : null,
    googleMapsUrl: restaurant.googleMapsUrl,
    googlePlaceId: restaurant.googlePlaceId,
    phone: restaurant.phone,
    website: restaurant.website,
    websiteIsOrderUrl: restaurant.websiteIsOrderUrl,
    cartaProvider: restaurant.cartaProvider,
    instagram: restaurant.instagram,
    primaryCategory: restaurant.primaryCategory,
    avgRating: stats?.avgRating != null ? Number(stats.avgRating) : null,
    ratingCount: Number(stats?.ratingCount ?? 0),
    commentCount: Number(stats?.commentCount ?? 0),
    popularityScore: Number(stats?.popularityScore ?? 0),
    isEligibleForFeed: basicEligible && contentEligible,
  }

  if (restaurant.lat != null && restaurant.lng != null) {
    doc._geo = { lat: Number(restaurant.lat), lng: Number(restaurant.lng) }
  }

  return doc
}

// Prisma Decimal type placeholder
type Decimal = { toNumber(): number } | number

// ── Per-dish sync (called from write routes) ───────────────────────────────────

export async function syncDishToMeilisearch(dishId: string): Promise<void> {
  if (!isMeiliConfigured()) return
  try {
    const row = await prisma.dish.findUnique({
      where: { id: dishId },
      include: {
        category: { select: { name: true, dishType: true, cuisineTag: true, normOverride: true } },
        restaurant: {
          select: {
            id: true, name: true, slug: true, logoUrl: true, address: true,
            lat: true, lng: true, primaryCategory: true, isShowcase: true,
            googleRating: true, googleRatingCount: true, googleMapsUrl: true,
            googlePlaceId: true, phone: true, website: true, websiteIsOrderUrl: true,
            cartaProvider: true, instagram: true, isActive: true, isDemo: true,
          },
        },
      },
    })
    if (!row) return

    const stats = await prisma.feedDishStats.findUnique({ where: { dishId } }).catch(() => null)
    const doc = buildMeiliDoc(row, row.category, row.restaurant, stats)

    const client = getMeiliClient()
    await client.index(MEILI_INDEX).addDocuments([doc])
  } catch (err) {
    // Non-fatal: Meilisearch is a read cache, DB is the source of truth
    console.error('[meilisearch] syncDish error', dishId, err)
  }
}

// ── Per-restaurant bulk sync (called after menu import) ───────────────────────

export async function syncRestaurantToMeilisearch(restaurantId: string): Promise<void> {
  if (!isMeiliConfigured()) return
  try {
    const ids = await prisma.dish.findMany({
      where: { restaurantId },
      select: { id: true },
    })
    // Fire-and-forget individual syncs, batched to avoid overwhelming DB
    const CONCURRENCY = 8
    for (let i = 0; i < ids.length; i += CONCURRENCY) {
      await Promise.all(
        ids.slice(i, i + CONCURRENCY).map(d => syncDishToMeilisearch(d.id))
      )
    }
  } catch (err) {
    console.error('[meilisearch] syncRestaurant error', restaurantId, err)
  }
}
