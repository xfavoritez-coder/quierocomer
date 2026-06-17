import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { resolveDishLeaf } from '@/app/a/lib/feed-queries'
import { isExcludedCategory, inferMealTime, inferDishType, getParentCategory } from '@/app/a/lib/categories'
import type { FeedDish } from '@/app/a/types'

function normStr(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

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

    // Build WHERE conditions dynamically
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

    // Text search — accent-insensitive + stemming básico (quita 's' final para plural→singular)
    if (q) {
      const qLike = `%${q}%`
      const qNorm = normStr(q)
      const qNormLike = `%${qNorm}%`
      // Si termina en 's', buscar también sin la 's' (hamburguesas → hamburguesa)
      const qStem = q.endsWith('s') && q.length > 3 ? q.slice(0, -1) : null
      const qStemNorm = qStem ? normStr(qStem) : null
      const qStemLike = qStem ? `%${qStem}%` : null
      const qStemNormLike = qStemNorm ? `%${qStemNorm}%` : null

      if (qStemLike && qStemNormLike && qStemNorm !== qNorm) {
        // Busca plural Y singular, con y sin acento — también en nombre del restaurante
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

    // Diet filter
    if (diet === 'VEGAN') {
      conditions.push(Prisma.sql`d."dishDiet" = 'VEGAN'`)
    } else if (diet === 'VEGETARIAN') {
      conditions.push(Prisma.sql`d."dishDiet" IN ('VEGAN', 'VEGETARIAN')`)
    }

    // Location bounding box — se omite cuando el query hace match con nombre de restaurante,
    // así buscar "Jireh" o "Long An" siempre muestra ese local sin importar la distancia.
    const hasLocationFilter = lat !== null && lng !== null && maxKm < 30
    const qLikeForName = q ? `%${q}%` : null
    const qNormForName = q ? normStr(q) : null
    const qNormLikeForName = qNormForName ? `%${qNormForName}%` : null

    if (hasLocationFilter) {
      const latOffset = maxKm / 111.0
      const lngOffset = maxKm / (111.0 * Math.cos(lat! * Math.PI / 180))
      const latMin = lat! - latOffset
      const latMax = lat! + latOffset
      const lngMin = lng! - lngOffset
      const lngMax = lng! + lngOffset
      // Si hay query y el restaurante hace match por nombre → ignorar bbox para ese restaurante
      if (q && qLikeForName && qNormLikeForName) {
        conditions.push(Prisma.sql`(
          (r.lat BETWEEN ${latMin} AND ${latMax} AND r.lng BETWEEN ${lngMin} AND ${lngMax})
          OR r.name ILIKE ${qLikeForName}
          OR r.name ILIKE ${qNormLikeForName}
        )`)
      } else {
        conditions.push(Prisma.sql`r.lat BETWEEN ${latMin} AND ${latMax}`)
        conditions.push(Prisma.sql`r.lng BETWEEN ${lngMin} AND ${lngMax}`)
      }
    }

    // Location name filter (commune/city)
    if (locationName && !q) {
      // Solo aplicar filtro de ciudad cuando NO hay query de texto
      const locLike = `%${locationName}%`
      conditions.push(Prisma.sql`r.address ILIKE ${locLike}`)
    }

    const whereClause = Prisma.join(conditions, ' AND ')

    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        d.id, d.name, d.description, d.price, d."discountPrice",
        d.photos, d."dishDiet", d."isSpicy", d."isGlutenFree", d."isLactoseFree",
        d."isSoyFree", d."containsNuts", d."flavorTags", d."isHero", d.tags, d."leafOverride", d."createdAt",
        c.name AS "categoryName", c."dishType", c."cuisineTag", c."normOverride" AS "catNormOverride",
        r.id AS "restaurantId", r.name AS "restaurantName", r.slug AS "restaurantSlug",
        r."logoUrl", r.address, r.lat, r.lng, r."primaryCategory", r."isShowcase",
        r."googleRating", r."googleRatingCount", r."googleMapsUrl",
        fs."avgRating", fs."ratingCount", fs."commentCount", fs."popularityScore"
      FROM "Dish" d
      JOIN "Category" c ON c.id = d."categoryId"
      JOIN "Restaurant" r ON r.id = d."restaurantId"
      LEFT JOIN "FeedDishStats" fs ON fs."dishId" = d.id
      WHERE ${whereClause}
      ORDER BY d."isHero" DESC, COALESCE(fs."popularityScore", 0) DESC, d."createdAt" DESC
      LIMIT 600
    `

    // Map rows to FeedDish (same logic as _getFeedDishes)
    let feedDishes: FeedDish[] = []
    const seenKey = new Set<string>()
    for (const d of rows) {
      const catName = d.categoryName as string
      if (isExcludedCategory(catName)) continue
      // Dedup: showcase usa ID (cada plato es único aunque tenga mismo nombre);
      // restaurantes normales deduplicamos por nombre para eliminar importaciones duplicadas
      const dupKey = d.isShowcase
        ? `${d.restaurantId}::id::${d.id}`
        : `${d.restaurantId}::${(d.name as string).toLowerCase().trim()}`
      if (seenKey.has(dupKey)) continue
      seenKey.add(dupKey)
      const categoriaNorm = resolveDishLeaf(
        d.name as string, catName, d.leafOverride ?? null,
        d.primaryCategory ?? null, d.description ?? null, d.catNormOverride ?? null
      )
      const categoriaParent = getParentCategory(categoriaNorm)
      const cuisineTag = (d.cuisineTag as string | null) ?? null
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
        isShowcase: Boolean(d.isShowcase ?? false),
        avgRating: d.avgRating != null ? Number(d.avgRating) : null,
        ratingCount: Number(d.ratingCount ?? 0),
        commentCount: Number(d.commentCount ?? 0),
        popularityScore: Number(d.popularityScore ?? 0),
        cuisineTag,
        createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
      })
    }

    // JS-level filters (categoriaNorm-based, can't do in SQL)
    const matchesCategory = (d: FeedDish, cat: string) =>
      d.categoriaParent === cat || d.categoriaNorm === cat || d.cuisineTag === cat

    if (categoryPill) {
      feedDishes = feedDishes.filter(d => matchesCategory(d, categoryPill))
    } else if (categoriesParam.length > 0) {
      feedDishes = feedDishes.filter(d => categoriesParam.some(cat => matchesCategory(d, cat)))
    }

    if (meal !== 'all') {
      feedDishes = feedDishes.filter(d => d.mealTime === meal)
    }

    return NextResponse.json(feedDishes, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    console.error('[/api/dishes/search]', e)
    return NextResponse.json([], { status: 500 })
  }
}
