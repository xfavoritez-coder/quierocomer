import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { resolveDishLeaf, isBrandedDrink, isNamedDrink, isCocktailDrink, isVolumeBeverage, isPackagedProduct, isNonFoodItem, isCondimentOrExtra } from '@/app/a/lib/feed-queries'
import { isExcludedCategory, inferMealTime, inferDishType, getParentCategory } from '@/app/a/lib/categories'
import { getMeiliClient, isMeiliConfigured, type MeiliDish } from '@/lib/meilisearch'
import type { FeedDish } from '@/app/a/types'

function normStr(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// ── Meilisearch path ────────────────────────────────────────────────────────────

async function searchViaMeilisearch(params: {
  q: string
  lat: number | null
  lng: number | null
  maxKm: number
  diet: string
  meal: string
  categoriesParam: string[]
  categoryPill: string | null
  locationName: string | null
}): Promise<FeedDish[]> {
  const { q, lat, lng, maxKm, diet, meal, categoriesParam, categoryPill, locationName } = params

  const filters: string[] = ['isEligibleForFeed = true']

  if (diet === 'VEGAN') filters.push("dishDiet = 'VEGAN'")
  else if (diet === 'VEGETARIAN') filters.push("dishDiet IN ['VEGAN', 'VEGETARIAN']")

  // Geo filter: siempre que haya coordenadas. Si el usuario no activó "cerca de ti",
  // el frontend no envía lat/lng y este filtro no aplica.
  const hasGeo = lat !== null && lng !== null
  if (hasGeo) {
    filters.push(`_geoRadius(${lat}, ${lng}, ${Math.round(maxKm * 1000)})`)
  }

  // City filter solo cuando hay nombre de ciudad pero NO coordenadas GPS.
  // Si hay lat/lng, el filtro de distancia (geo) ya maneja la ubicación.
  if (locationName && !q && lat === null) {
    const city = locationName.split(',')[0].trim()
    filters.push(`restaurantCity = '${city.replace(/'/g, "\\'")}'`)
  }

  const client = getMeiliClient()
  const result = await client.index('dishes').search<MeiliDish>(q || '', {
    filter: filters.join(' AND '),
    sort: ['isHero:desc', 'popularityScore:desc', 'createdAtTs:desc'],
    limit: 5000,
    attributesToRetrieve: [
      'id', 'name', 'description', 'price', 'discountPrice', 'photos',
      'dishDiet', 'isSpicy', 'isGlutenFree', 'isLactoseFree', 'isSoyFree',
      'containsNuts', 'flavorTags', 'isHero', 'tags', 'leafOverride', 'txDishType',
      'categoryName', 'dishType', 'cuisineTag', 'catNormOverride',
      'categoriaNorm', 'categoriaParent', 'mealTime', 'createdAtTs',
      'restaurantId', 'restaurantName', 'restaurantSlug', 'logoUrl', 'address',
      'isShowcase', 'googleRating', 'googleRatingCount', 'googleMapsUrl', 'googlePlaceId',
      'phone', 'website', 'websiteIsOrderUrl', 'cartaProvider', 'instagram',
      'primaryCategory', 'avgRating', 'ratingCount', 'commentCount', 'popularityScore',
      '_geo',
    ],
  })

  const seenKey = new Set<string>()
  let dishes: FeedDish[] = []

  for (const d of result.hits) {
    // Dedup: showcase → unique per id; normal → dedup by restaurant+name
    const dupKey = d.isShowcase
      ? `${d.restaurantId}::id::${d.id}`
      : `${d.restaurantId}::${d.name.toLowerCase().trim()}`
    if (seenKey.has(dupKey)) continue
    seenKey.add(dupKey)

    dishes.push({
      id: d.id,
      nombre: d.name,
      descripcion: d.description,
      precio: Number(d.price),
      precioDescuento: d.discountPrice != null ? Number(d.discountPrice) : null,
      fotoUrl: Array.isArray(d.photos) && d.photos.length > 0 ? d.photos[0] : null,
      categoria: d.categoryName,
      categoriaNorm: d.categoriaNorm,
      categoriaParent: d.categoriaParent,
      categoriaTipo: inferDishType(d.categoriaNorm, d.dishType),
      txDishType: Array.isArray(d.txDishType) ? d.txDishType : [],
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
      restaurantePhone: d.phone ?? null,
      restaurantePlaceId: d.googlePlaceId ?? null,
      restauranteWebsite: d.website ?? null,
      restauranteWebsiteIsOrderUrl: Boolean(d.websiteIsOrderUrl),
      restauranteCartaProvider: d.cartaProvider ?? null,
      restauranteInstagram: d.instagram ?? null,
      restauranteLat: d._geo?.lat ?? null,
      restauranteLng: d._geo?.lng ?? null,
      enOferta: d.discountPrice != null && Number(d.discountPrice) < Number(d.price),
      mealTime: d.mealTime as any,
      tags: Array.isArray(d.tags) ? d.tags : [],
      isHero: d.isHero,
      googleRating: d.googleRating != null ? Number(d.googleRating) : null,
      googleRatingCount: d.googleRatingCount != null ? Number(d.googleRatingCount) : null,
      googleMapsUrl: d.googleMapsUrl ?? null,
      isShowcase: Boolean(d.isShowcase),
      avgRating: d.avgRating != null ? Number(d.avgRating) : null,
      ratingCount: Number(d.ratingCount ?? 0),
      commentCount: Number(d.commentCount ?? 0),
      popularityScore: Number(d.popularityScore ?? 0),
      cuisineTag: d.cuisineTag ?? null,
      createdAt: d.createdAtTs ? new Date(d.createdAtTs).toISOString() : null,
    })
  }

  // JS-level category + meal filters (same logic as before)
  const matchesCategory = (fd: FeedDish, cat: string) =>
    fd.categoriaParent === cat || fd.categoriaNorm === cat || fd.cuisineTag === cat

  if (categoryPill) {
    dishes = dishes.filter(fd => matchesCategory(fd, categoryPill))
  } else if (categoriesParam.length > 0) {
    dishes = dishes.filter(fd => categoriesParam.some(cat => matchesCategory(fd, cat)))
  }

  if (meal !== 'all') {
    dishes = dishes.filter(fd => fd.mealTime === meal)
  }

  // Cap response to avoid oversized payloads — the client shuffles and paginates anyway
  return dishes.slice(0, 2500)
}

// ── Postgres fallback path ──────────────────────────────────────────────────────

async function searchViaDB(params: {
  q: string
  lat: number | null
  lng: number | null
  maxKm: number
  diet: string
  meal: string
  categoriesParam: string[]
  categoryPill: string | null
  locationName: string | null
}): Promise<FeedDish[]> {
  const { q, lat, lng, maxKm, diet, meal, categoriesParam, categoryPill, locationName } = params

  const conditions: Prisma.Sql[] = [
    Prisma.sql`d."isActive" = true`,
    Prisma.sql`d."deletedAt" IS NULL`,
    Prisma.sql`d."hiddenFromFeed" = false`,
    Prisma.sql`array_length(d.photos, 1) > 0`,
    Prisma.sql`(d.price > 0 OR r."isShowcase" = true)`,
    Prisma.sql`c."dishType" != 'drink'`,
    Prisma.sql`r."isActive" = true`,
    Prisma.sql`r."isDemo" = false`,
    Prisma.sql`r.lat IS NOT NULL`,
    Prisma.sql`r.lng IS NOT NULL`,
    Prisma.sql`(r."googleMapsUrl" IS NOT NULL OR r."isShowcase" = true)`,
    Prisma.sql`(r."googleRating" IS NOT NULL OR r."isShowcase" = true)`,
  ]

  if (q) {
    const qLike = `%${q}%`
    const qNorm = normStr(q)
    const qNormLike = `%${qNorm}%`
    const qStem = q.endsWith('s') && q.length > 3 ? q.slice(0, -1) : null
    const qStemNorm = qStem ? normStr(qStem) : null
    const qStemLike = qStem ? `%${qStem}%` : null
    const qStemNormLike = qStemNorm ? `%${qStemNorm}%` : null

    if (qStemLike && qStemNormLike && qStemNorm !== qNorm) {
      conditions.push(Prisma.sql`(
        d.name ILIKE ${qLike} OR COALESCE(d.description, '') ILIKE ${qLike} OR r.name ILIKE ${qLike}
        OR d.name ILIKE ${qNormLike} OR COALESCE(d.description, '') ILIKE ${qNormLike} OR r.name ILIKE ${qNormLike}
        OR d.name ILIKE ${qStemLike} OR COALESCE(d.description, '') ILIKE ${qStemLike}
        OR d.name ILIKE ${qStemNormLike} OR COALESCE(d.description, '') ILIKE ${qStemNormLike}
      )`)
    } else if (qNorm !== q) {
      conditions.push(Prisma.sql`(d.name ILIKE ${qLike} OR COALESCE(d.description, '') ILIKE ${qLike} OR r.name ILIKE ${qLike} OR d.name ILIKE ${qNormLike} OR COALESCE(d.description, '') ILIKE ${qNormLike} OR r.name ILIKE ${qNormLike})`)
    } else {
      conditions.push(Prisma.sql`(d.name ILIKE ${qLike} OR COALESCE(d.description, '') ILIKE ${qLike} OR r.name ILIKE ${qLike})`)
    }
  }

  if (diet === 'VEGAN') conditions.push(Prisma.sql`d."dishDiet" = 'VEGAN'`)
  else if (diet === 'VEGETARIAN') conditions.push(Prisma.sql`d."dishDiet" IN ('VEGAN', 'VEGETARIAN')`)

  const hasLocationFilter = lat !== null && lng !== null
  const qLikeForName = q ? `%${q}%` : null
  const qNormForName = q ? normStr(q) : null
  const qNormLikeForName = qNormForName ? `%${qNormForName}%` : null

  if (hasLocationFilter) {
    const latOffset = maxKm / 111.0
    const lngOffset = maxKm / (111.0 * Math.cos(lat! * Math.PI / 180))
    const latMin = lat! - latOffset, latMax = lat! + latOffset
    const lngMin = lng! - lngOffset, lngMax = lng! + lngOffset
    if (q && qLikeForName && qNormLikeForName) {
      conditions.push(Prisma.sql`(
        (r.lat BETWEEN ${latMin} AND ${latMax} AND r.lng BETWEEN ${lngMin} AND ${lngMax})
        OR r.name ILIKE ${qLikeForName} OR r.name ILIKE ${qNormLikeForName}
      )`)
    } else {
      conditions.push(Prisma.sql`r.lat BETWEEN ${latMin} AND ${latMax}`)
      conditions.push(Prisma.sql`r.lng BETWEEN ${lngMin} AND ${lngMax}`)
    }
  }

  if (locationName && !q && lat === null) {
    const locLike = `%${locationName}%`
    conditions.push(Prisma.sql`r.address ILIKE ${locLike}`)
  }

  const whereClause = Prisma.join(conditions, ' AND ')

  const rows = await prisma.$queryRaw<any[]>`
    SELECT
      d.id, d.name, d.description, d.price, d."discountPrice",
      d.photos, d."dishDiet", d."isSpicy", d."isGlutenFree", d."isLactoseFree",
      d."isSoyFree", d."containsNuts", d."flavorTags", d."isHero", d.tags, d."leafOverride", d."createdAt", d."txDishType",
      c.name AS "categoryName", c."dishType", c."cuisineTag", c."normOverride" AS "catNormOverride",
      r.id AS "restaurantId", r.name AS "restaurantName", r.slug AS "restaurantSlug",
      r."logoUrl", r.address, r.lat, r.lng, r."primaryCategory", r."isShowcase",
      r."googleRating", r."googleRatingCount", r."googleMapsUrl", r."googlePlaceId",
      r.phone, r.website, r."websiteIsOrderUrl", r."cartaProvider", r.instagram,
      fs."avgRating", fs."ratingCount", fs."commentCount", fs."popularityScore"
    FROM "Dish" d
    JOIN "Category" c ON c.id = d."categoryId"
    JOIN "Restaurant" r ON r.id = d."restaurantId"
    LEFT JOIN "FeedDishStats" fs ON fs."dishId" = d.id
    WHERE ${whereClause}
    ORDER BY d."isHero" DESC, COALESCE(fs."popularityScore", 0) DESC, d."createdAt" DESC
    LIMIT 600
  `

  let feedDishes: FeedDish[] = []
  const seenKey = new Set<string>()
  for (const d of rows) {
    const catName = d.categoryName as string
    if (isExcludedCategory(catName)) continue
    if (isBrandedDrink(d.name)) continue
    if (isNamedDrink(d.name)) continue
    if (isCocktailDrink(d.name)) continue
    if (isVolumeBeverage(d.name)) continue
    if (isPackagedProduct(d.name, d.description)) continue
    if (isNonFoodItem(d.name, catName)) continue
    if (isCondimentOrExtra(d.name)) continue

    const dupKey = d.isShowcase
      ? `${d.restaurantId}::id::${d.id}`
      : `${d.restaurantId}::${(d.name as string).toLowerCase().trim()}`
    if (seenKey.has(dupKey)) continue
    seenKey.add(dupKey)

    const categoriaNorm = resolveDishLeaf(
      d.name, catName, d.leafOverride ?? null,
      d.primaryCategory ?? null, d.description ?? null, d.catNormOverride ?? null,
    )
    const categoriaParent = getParentCategory(categoriaNorm)
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
      categoriaParent,
      categoriaTipo: inferDishType(categoriaNorm, d.dishType),
      txDishType: Array.isArray(d.txDishType) ? d.txDishType : [],
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
      restaurantePhone: d.phone ?? null,
      restaurantePlaceId: d.googlePlaceId ?? null,
      restauranteWebsite: d.website ?? null,
      restauranteWebsiteIsOrderUrl: Boolean(d.websiteIsOrderUrl ?? false),
      restauranteCartaProvider: d.cartaProvider ?? null,
      restauranteInstagram: d.instagram ?? null,
      restauranteLat: d.lat != null ? Number(d.lat) : null,
      restauranteLng: d.lng != null ? Number(d.lng) : null,
      enOferta: d.discountPrice != null && Number(d.discountPrice) < Number(d.price),
      mealTime: inferMealTime(categoriaNorm),
      tags: Array.isArray(d.tags) ? d.tags : [],
      isHero: d.isHero,
      googleRating: d.googleRating != null ? Number(d.googleRating) : null,
      googleRatingCount: d.googleRatingCount != null ? Number(d.googleRatingCount) : null,
      googleMapsUrl: d.googleMapsUrl ?? null,
      isShowcase: Boolean(d.isShowcase ?? false),
      avgRating: d.avgRating != null ? Number(d.avgRating) : null,
      ratingCount: Number(d.ratingCount ?? 0),
      commentCount: Number(d.commentCount ?? 0),
      popularityScore: Number(d.popularityScore ?? 0),
      cuisineTag: (d.cuisineTag as string | null) ?? null,
      createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
    })
  }

  const matchesCategory = (fd: FeedDish, cat: string) =>
    fd.categoriaParent === cat || fd.categoriaNorm === cat || fd.cuisineTag === cat

  if (categoryPill) feedDishes = feedDishes.filter(fd => matchesCategory(fd, categoryPill))
  else if (categoriesParam.length > 0) feedDishes = feedDishes.filter(fd => categoriesParam.some(cat => matchesCategory(fd, cat)))
  if (meal !== 'all') feedDishes = feedDishes.filter(fd => fd.mealTime === meal)

  return feedDishes
}

// ── Route handler ───────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim() || ''
    const lat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : null
    const lng = searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : null
    const maxKm = searchParams.get('maxKm') ? parseFloat(searchParams.get('maxKm')!) : 30
    const diet = searchParams.get('diet') || 'all'
    const meal = searchParams.get('meal') || 'all'
    const categoriesParam = searchParams.get('categories')?.split(',').filter(Boolean) || []
    const categoryPill = searchParams.get('categoryPill') || null
    const locationName = searchParams.get('locationName') || null

    const p = { q, lat, lng, maxKm, diet, meal, categoriesParam, categoryPill, locationName }

    let feedDishes: FeedDish[]

    if (isMeiliConfigured()) {
      try {
        feedDishes = await searchViaMeilisearch(p)
      } catch (meiliErr) {
        console.error('[/api/dishes/search] Meilisearch error, falling back to DB:', meiliErr)
        feedDishes = await searchViaDB(p)
      }
    } else {
      feedDishes = await searchViaDB(p)
    }

    // Log search query (fire-and-forget)
    if (q) {
      const cookieStore = await cookies()
      const fingerprint = cookieStore.get('qc_feed_user')?.value ?? null
      const feedUserId = fingerprint
        ? (await prisma.feedUser.findUnique({ where: { fingerprint }, select: { id: true } }))?.id ?? null
        : null
      prisma.feedSearchLog.create({
        data: { query: q, resultsCount: feedDishes.length, feedUserId },
      }).catch(() => {})
    }

    return NextResponse.json(feedDishes, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    console.error('[/api/dishes/search]', e)
    return NextResponse.json([], { status: 500 })
  }
}
