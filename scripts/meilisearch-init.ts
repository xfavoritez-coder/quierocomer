/**
 * Meilisearch initial setup + bulk sync of all 10k+ dishes.
 *
 * Run once after creating the Meilisearch instance:
 *   npx tsx scripts/meilisearch-init.ts
 *
 * Or to force a full re-index:
 *   FORCE_RESET=1 npx tsx scripts/meilisearch-init.ts
 */
import 'dotenv/config'
import { Meilisearch as MeiliSearch } from 'meilisearch'
import { PrismaClient } from '@prisma/client'
import {
  isExcludedCategory, inferMealTime, getParentCategory,
} from '../src/app/a/lib/categories'
import {
  resolveDishLeaf, isBrandedDrink, isNamedDrink, isCocktailDrink,
  isVolumeBeverage, isPackagedProduct, isNonFoodItem, isCondimentOrExtra,
} from '../src/app/a/lib/feed-queries'
import type { MeiliDish } from '../src/lib/meilisearch'

const MEILI_INDEX = 'dishes'
const BATCH_SIZE = 500

const prisma = new PrismaClient()

function parseCity(address: string | null): string | null {
  if (!address) return null
  const parts = address.split(',').map(p => p.trim()).filter(Boolean)
  return parts.length >= 2 ? parts[parts.length - 1] ?? null : parts[0] ?? null
}

async function main() {
  const host = process.env.MEILISEARCH_HOST
  const key = process.env.MEILISEARCH_API_KEY
  if (!host || !key) {
    console.error('❌  Set MEILISEARCH_HOST and MEILISEARCH_API_KEY in .env.local')
    process.exit(1)
  }

  const client = new MeiliSearch({ host, apiKey: key })

  // ── Configure index settings ──────────────────────────────────────────────
  console.log('🔧  Configuring index settings…')
  const index = client.index(MEILI_INDEX)

  if (process.env.FORCE_RESET === '1') {
    console.log('⚠️   FORCE_RESET=1 — deleting existing index…')
    await client.deleteIndexIfExists(MEILI_INDEX)
  }

  await client.createIndex(MEILI_INDEX, { primaryKey: 'id' }).catch(() => {
    /* index already exists — fine */
  })

  await index.updateSettings({
    searchableAttributes: [
      'name',
      'description',
      'restaurantName',
    ],
    filterableAttributes: [
      'isEligibleForFeed',
      'dishDiet',
      'categoriaNorm',
      'categoriaParent',
      'mealTime',
      'cuisineTag',
      'txDishType',
      'txIngredient',
      'restaurantId',
      'restaurantCity',
      'isShowcase',
      '_geo',
    ],
    sortableAttributes: [
      'isHero',
      'popularityScore',
      'createdAtTs',
    ],
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 },
    },
    pagination: { maxTotalHits: 5000 },
  })

  console.log('✅  Index settings applied')

  // ── Bulk fetch all dishes ─────────────────────────────────────────────────
  console.log('📦  Fetching dishes from DB…')

  const totalCount = await prisma.dish.count()
  console.log(`   Total dishes in DB: ${totalCount}`)

  // Fetch stats as a map for fast lookup
  const statsRows = await prisma.feedDishStats.findMany({
    select: { dishId: true, avgRating: true, ratingCount: true, commentCount: true, popularityScore: true },
  })
  const statsMap = new Map(statsRows.map(s => [s.dishId, s]))

  let cursor: string | undefined = undefined
  let totalIndexed = 0
  let batch: MeiliDish[] = []

  async function flushBatch() {
    if (batch.length === 0) return
    const task = await index.addDocuments(batch)
    console.log(`   ↑ Indexed ${totalIndexed} dishes (taskUid=${task.taskUid})`)
    batch = []
  }

  // Process in pages to avoid loading all 10k dishes into memory at once
  while (true) {
    const rows = await prisma.dish.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: 'asc' },
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

    if (rows.length === 0) break

    for (const row of rows) {
      const c = row.category
      const r = row.restaurant
      const catName = c.name

      const categoriaNorm = resolveDishLeaf(
        row.name, catName, row.leafOverride ?? null,
        r.primaryCategory ?? null, row.description ?? null, c.normOverride ?? null,
      )
      const categoriaParent = getParentCategory(categoriaNorm)
      const mealTime = inferMealTime(categoriaNorm)

      const basicEligible =
        row.isActive &&
        row.deletedAt === null &&
        !row.hiddenFromFeed &&
        row.photos.length > 0 &&
        (row.price > 0 || r.isShowcase) &&
        c.dishType !== 'drink' &&
        r.isActive &&
        !r.isDemo &&
        r.lat != null &&
        r.lng != null &&
        (r.googleMapsUrl != null || r.isShowcase) &&
        (r.googleRating != null || r.isShowcase)

      const contentEligible =
        !isExcludedCategory(catName) &&
        !isBrandedDrink(row.name) &&
        !isNamedDrink(row.name) &&
        !isCocktailDrink(row.name) &&
        !isVolumeBeverage(row.name) &&
        !isPackagedProduct(row.name, row.description ?? null) &&
        !isNonFoodItem(row.name, catName) &&
        !isCondimentOrExtra(row.name)

      const stats = statsMap.get(row.id) ?? null
      const doc: MeiliDish = {
        id: row.id,
        name: row.name,
        description: row.description ?? null,
        price: Number(row.price),
        discountPrice: row.discountPrice != null ? Number(row.discountPrice) : null,
        photos: row.photos,
        dishDiet: row.dishDiet,
        isSpicy: row.isSpicy,
        isGlutenFree: row.isGlutenFree,
        isLactoseFree: row.isLactoseFree,
        isSoyFree: row.isSoyFree,
        containsNuts: row.containsNuts,
        flavorTags: row.flavorTags,
        isHero: row.isHero,
        tags: row.tags as string[],
        leafOverride: row.leafOverride ?? null,
        txDishType: row.txDishType,
        txIngredient: row.txIngredient,
        createdAtTs: row.createdAt.getTime(),
        categoryName: catName,
        dishType: c.dishType,
        cuisineTag: c.cuisineTag ?? null,
        catNormOverride: c.normOverride ?? null,
        categoriaNorm,
        categoriaParent,
        mealTime,
        restaurantId: r.id,
        restaurantName: r.name,
        restaurantSlug: r.slug,
        logoUrl: r.logoUrl ?? null,
        address: r.address ?? null,
        restaurantCity: parseCity(r.address ?? null),
        isShowcase: r.isShowcase,
        googleRating: r.googleRating != null ? Number(r.googleRating) : null,
        googleRatingCount: r.googleRatingCount != null ? Number(r.googleRatingCount) : null,
        googleMapsUrl: r.googleMapsUrl ?? null,
        googlePlaceId: r.googlePlaceId ?? null,
        phone: r.phone ?? null,
        website: r.website ?? null,
        websiteIsOrderUrl: r.websiteIsOrderUrl ?? false,
        cartaProvider: r.cartaProvider ?? null,
        instagram: r.instagram ?? null,
        primaryCategory: r.primaryCategory ?? null,
        avgRating: stats?.avgRating != null ? Number(stats.avgRating) : null,
        ratingCount: Number(stats?.ratingCount ?? 0),
        commentCount: Number(stats?.commentCount ?? 0),
        popularityScore: Number(stats?.popularityScore ?? 0),
        isEligibleForFeed: basicEligible && contentEligible,
      }

      if (r.lat != null && r.lng != null) {
        doc._geo = { lat: Number(r.lat), lng: Number(r.lng) }
      }

      batch.push(doc)
      totalIndexed++
    }

    await flushBatch()
    cursor = rows[rows.length - 1]?.id
    if (rows.length < BATCH_SIZE) break
  }

  await flushBatch()

  console.log(`\n🎉  Done. Indexed ${totalIndexed} dishes total.`)
  console.log('   Meilisearch will process indexing asynchronously — check task status in the dashboard.')

  await prisma.$disconnect()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
