import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { resolveDishLeaf } from '@/app/a/lib/feed-queries'
import { getMeiliClient, isMeiliConfigured } from '@/lib/meilisearch'

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const TARGET = 24

/**
 * Tipos de plato conceptualmente relacionados (hermanos en la misma familia).
 */
const RELATED_TX_TYPES: Record<string, string[]> = {
  'sándwich':    ['hamburguesa', 'hot dog', 'wrap', 'burrito', 'tostada', 'lomito', 'completo'],
  'hamburguesa': ['sándwich', 'hot dog', 'lomito', 'wrap'],
  'hot dog':     ['sándwich', 'hamburguesa', 'completo'],
  'completo':    ['sándwich', 'hot dog', 'hamburguesa'],
  'lomito':      ['sándwich', 'hamburguesa'],
  'wrap':        ['sándwich', 'burrito', 'taco'],
  'burrito':     ['wrap', 'taco', 'sándwich'],
  'taco':        ['burrito', 'wrap', 'quesadilla'],
  'quesadilla':  ['taco', 'burrito'],
  'pizza':       ['pasta', 'focaccia', 'calzone'],
  'focaccia':    ['pizza', 'pasta'],
  'calzone':     ['pizza', 'empanada'],
  'pasta':       ['pizza', 'risotto', 'gnocchi', 'lasaña', 'ravioli', 'fettuccine', 'spaghetti', 'tagliatelle', 'tortellini'],
  'lasaña':      ['pasta', 'pizza', 'risotto', 'gnocchi'],
  'gnocchi':     ['pasta', 'risotto'],
  'ravioli':     ['pasta', 'gnocchi'],
  'risotto':     ['pasta', 'gnocchi'],
  'sushi':       ['sashimi', 'poke', 'temaki', 'nigiri', 'uramaki'],
  'sashimi':     ['sushi', 'poke', 'temaki'],
  'temaki':      ['sushi', 'sashimi'],
  'nigiri':      ['sushi', 'sashimi'],
  'poke':        ['sushi', 'bowl', 'ensalada'],
  'pollo frito': ['hamburguesa', 'sándwich', 'tenders'],
  'tenders':     ['pollo frito', 'nuggets', 'hamburguesa'],
  'nuggets':     ['tenders', 'pollo frito'],
  'empanada':    ['calzone', 'masa rellena'],
  'ensalada':    ['bowl', 'poke'],
  'bowl':        ['ensalada', 'poke'],
  'ceviche':     ['causa', 'tiradito', 'leche de tigre'],
  'causa':       ['ceviche', 'tiradito'],
  'curry':       ['bowl', 'arroz'],
  'ramen':       ['sopa', 'fideos'],
}

/**
 * Tipos de plato → su familia "padre" (categoría superior).
 * Permite que si el usuario eligió lasañas, el fallback sea pasta en general.
 */
const PARENT_FAMILY: Record<string, string> = {
  'lasaña': 'pasta', 'lasagna': 'pasta',
  'gnocchi': 'pasta', 'ravioli': 'pasta', 'fettuccine': 'pasta',
  'spaghetti': 'pasta', 'tagliatelle': 'pasta', 'tortellini': 'pasta',
  'linguine': 'pasta', 'penne': 'pasta', 'rigatoni': 'pasta',
  'sashimi': 'sushi', 'temaki': 'sushi', 'nigiri': 'sushi',
  'uramaki': 'sushi', 'maki': 'sushi',
  'burrito': 'taco', 'quesadilla': 'taco', 'enchilada': 'taco',
  'hot dog': 'sándwich', 'completo': 'sándwich', 'lomito': 'sándwich',
  'wrap': 'sándwich', 'submarino': 'sándwich',
  'focaccia': 'pizza', 'calzone': 'pizza',
  'tenders': 'pollo frito', 'nuggets': 'pollo frito',
  'tiradito': 'ceviche', 'causa': 'ceviche',
  'ramen': 'sopa', 'fideos': 'sopa',
}

/**
 * Tipos de plato dulces/postres.
 * Si el usuario no eligió ninguno dulce, se excluyen del fallback.
 */
const DULCE_TX_TYPES = new Set([
  'postre', 'helado', 'torta', 'cheesecake', 'brownie', 'muffin', 'waffles',
  'crepe', 'pannacotta', 'tiramisú', 'flan', 'mousse', 'pie', 'tarta',
  'churro', 'donuts', 'galleta', 'cupcake', 'milkshake', 'frappe', 'parfait',
  'chocolate', 'pudding', 'soufflé', 'paleta', 'gelato', 'sorbet',
  'cinnamon roll', 'croissant dulce', 'danish', 'baklava', 'arroz con leche',
])

// ── Candidate fetchers ─────────────────────────────────────────────────────────

async function getEurekaCandidatesFromMeili(p: {
  txArray: string[]
  ingArray: string[]
  likedCatNames: string[]
  restaurantId?: string
  lat?: number; lng?: number; maxKm?: number
}): Promise<any[]> {
  const { txArray, ingArray, likedCatNames, restaurantId, lat, lng, maxKm = 15 } = p
  const filters: string[] = ['isEligibleForFeed = true']

  if (restaurantId) {
    filters.push(`restaurantId = '${restaurantId}'`)
  } else if (txArray.length > 0 || ingArray.length > 0) {
    const parts: string[] = []
    if (txArray.length > 0) {
      parts.push(`txDishType IN [${txArray.map(t => `'${t.replace(/'/g, "\\'")}'`).join(', ')}]`)
    }
    if (ingArray.length > 0) {
      parts.push(`txIngredient IN [${ingArray.map(i => `'${i.replace(/'/g, "\\'")}'`).join(', ')}]`)
    }
    filters.push(`(${parts.join(' OR ')})`)
  } else if (likedCatNames.length > 0) {
    filters.push(`categoryName IN [${likedCatNames.map(n => `'${n.replace(/'/g, "\\'")}'`).join(', ')}]`)
  }

  if (lat != null && lng != null) {
    filters.push(`_geoRadius(${lat}, ${lng}, ${Math.round(maxKm * 1000)})`)
  }

  const client = getMeiliClient()
  const result = await client.index('dishes').search('', {
    filter: filters.join(' AND '),
    sort: ['popularityScore:desc'],
    limit: 500,
  })

  // Map Meilisearch doc shape → the row shape the scoring code expects
  return result.hits.map((d: any) => ({
    id: d.id,
    name: d.name,
    description: d.description ?? null,
    price: d.price,
    discountPrice: d.discountPrice ?? null,
    photos: d.photos ?? [],
    dishDiet: d.dishDiet,
    isSpicy: d.isSpicy,
    leafOverride: d.leafOverride ?? null,
    txDishType: d.txDishType ?? [],
    txIngredient: d.txIngredient ?? [],
    flavorTags: d.flavorTags ?? [],
    catName: d.categoryName,
    catNormOverride: d.catNormOverride ?? null,
    restaurantId: d.restaurantId,
    restaurantName: d.restaurantName,
    restaurantSlug: d.restaurantSlug,
    logoUrl: d.logoUrl ?? null,
    address: d.address ?? null,
    phone: d.phone ?? null,
    website: d.website ?? null,
    websiteIsOrderUrl: d.websiteIsOrderUrl,
    cartaProvider: d.cartaProvider ?? null,
    instagram: d.instagram ?? null,
    googlePlaceId: d.googlePlaceId ?? null,
    lat: d._geo?.lat ?? null,
    lng: d._geo?.lng ?? null,
    primaryCategory: d.primaryCategory ?? null,
    googleMapsUrl: d.googleMapsUrl ?? null,
    googleRating: d.googleRating ?? null,
    googleRatingCount: d.googleRatingCount ?? null,
    isShowcase: d.isShowcase,
    popularityScore: d.popularityScore ?? 0,
  }))
}

async function getEurekaCandidatesFromDB(p: {
  txArray: string[]
  ingArray: string[]
  likedCatNames: string[]
  restaurantId?: string
  allExcluded: string[]
  lat?: number; lng?: number; maxKm?: number
}): Promise<any[]> {
  const { txArray, ingArray, likedCatNames, restaurantId, allExcluded } = p
  return prisma.$queryRaw<any[]>`
    SELECT
      d.id, d.name, d.description, d.price, d."discountPrice",
      d.photos, d."dishDiet", d."isSpicy", d."leafOverride", d."txDishType", d."txIngredient", d."flavorTags",
      c.name AS "catName", c."normOverride" AS "catNormOverride",
      r.id AS "restaurantId", r.name AS "restaurantName", r.slug AS "restaurantSlug",
      r."logoUrl", r.address, r.phone, r.website, r."websiteIsOrderUrl", r."cartaProvider", r.instagram, r."googlePlaceId",
      r.lat, r.lng, r."primaryCategory",
      r."googleMapsUrl", r."googleRating", r."googleRatingCount", r."isShowcase",
      COALESCE(fs."popularityScore", 0) AS "popularityScore"
    FROM "Dish" d
    JOIN "Category" c ON c.id = d."categoryId"
    JOIN "Restaurant" r ON r.id = d."restaurantId"
    LEFT JOIN "FeedDishStats" fs ON fs."dishId" = d.id
    WHERE d."isActive" = true
      AND d."deletedAt" IS NULL
      AND d."hiddenFromFeed" = false
      AND array_length(d.photos, 1) > 0
      AND d.price > 0
      AND c."dishType" != 'drink'
      AND r."isActive" = true
      AND r."isDemo" = false
      AND r.lat IS NOT NULL AND r.lng IS NOT NULL
      AND d.id != ALL(${allExcluded})
      ${restaurantId
        ? Prisma.sql`AND r.id = ${restaurantId}`
        : (txArray.length > 0 || ingArray.length > 0)
          ? Prisma.sql`AND (d."txDishType" && ${txArray.length > 0 ? txArray : ['']} OR d."txIngredient" && ${ingArray.length > 0 ? ingArray : ['']})`
          : Prisma.sql`AND c.name = ANY(${likedCatNames})`
      }
    ORDER BY COALESCE(fs."popularityScore", 0) DESC
    LIMIT 500
  `
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      dishIds,
      dislikedIds = [],
      excludeIds = [],
      lat,
      lng,
      maxKm = 15,
      diet,
      restaurantId,
    }: {
      dishIds: string[]
      dislikedIds?: string[]
      excludeIds?: string[]
      lat?: number
      lng?: number
      maxKm?: number
      diet?: string
      restaurantId?: string
    } = body

    if (!dishIds?.length) return NextResponse.json({ dishes: [] })
    // excludeIds = recomendaciones ya mostradas (no repetir)
    // dishIds (liked) SÍ pueden volver como candidatos — el más afín merece recomendarse
    const allExcluded = [...excludeIds]

    // ── 1. Detalles de los platos liked ──────────────────────────────────────
    const likedRows = await prisma.$queryRaw<any[]>`
      SELECT d.id, d.name, d."leafOverride", d."txDishType", d."txIngredient",
             c.name AS "catName", c."normOverride" AS "catNormOverride",
             r."primaryCategory"
      FROM "Dish" d
      JOIN "Category" c ON c.id = d."categoryId"
      JOIN "Restaurant" r ON r.id = d."restaurantId"
      WHERE d.id = ANY(${dishIds})
    `

    // ── 2. Perfil de preferencias: frecuencia por categoría + txDishType ─────
    // Peso igual para todas las selecciones
    const positionWeight: Record<string, number> = {}
    dishIds.forEach((id: string) => {
      positionWeight[id] = 1
    })

    // catFreq: suma de pesos de los liked por cada categoría
    const catFreq: Record<string, number> = {}
    const txTypesByCat: Record<string, Set<string>> = {}
    const ingsByCat: Record<string, Set<string>> = {}
    const allTxTypes = new Set<string>()
    const allIngs = new Set<string>()

    for (const row of likedRows) {
      const leaf = resolveDishLeaf(row.name, row.catName, row.leafOverride, row.primaryCategory, null, row.catNormOverride)
      const w = positionWeight[row.id] ?? 1
      catFreq[leaf] = (catFreq[leaf] ?? 0) + w
      if (!txTypesByCat[leaf]) txTypesByCat[leaf] = new Set()
      if (!ingsByCat[leaf]) ingsByCat[leaf] = new Set()
      if (Array.isArray(row.txDishType)) row.txDishType.forEach((t: string) => { txTypesByCat[leaf].add(t); allTxTypes.add(t) })
      if (Array.isArray(row.txIngredient)) row.txIngredient.forEach((i: string) => { ingsByCat[leaf].add(i); allIngs.add(i) })
    }

    const totalLiked = Object.values(positionWeight).reduce((s, v) => s + v, 0)
    const cats = Object.keys(catFreq)
    const txArray = [...allTxTypes]
    const ingArray = [...allIngs]

    // ── 2b. Perfil de dislikes: tipos y categorías que el usuario rechazó ────
    const dislikedTypeFreq: Record<string, number> = {}
    const dislikedCatFreq: Record<string, number> = {}
    if (dislikedIds.length > 0) {
      const dislikedRows = await prisma.$queryRaw<any[]>`
        SELECT d."txDishType", c.name AS "catName", c."normOverride" AS "catNormOverride",
               d."leafOverride", d.name, r."primaryCategory"
        FROM "Dish" d
        JOIN "Category" c ON c.id = d."categoryId"
        JOIN "Restaurant" r ON r.id = d."restaurantId"
        WHERE d.id = ANY(${dislikedIds})
      `
      for (const row of dislikedRows) {
        const leaf = resolveDishLeaf(row.name, row.catName, row.leafOverride, row.primaryCategory, null, row.catNormOverride)
        dislikedCatFreq[leaf] = (dislikedCatFreq[leaf] ?? 0) + 1
        if (Array.isArray(row.txDishType)) {
          for (const t of row.txDishType) dislikedTypeFreq[t] = (dislikedTypeFreq[t] ?? 0) + 1
        }
      }
    }

    // ── 3. Asignar slots proporcionales a cada categoría ──────────────────────
    // round proporcional con redistribución de restos (Largest Remainder Method)
    const exact = cats.map(cat => ({ cat, exact: (catFreq[cat] / totalLiked) * TARGET }))
    const floors = exact.map(e => ({ ...e, floor: Math.floor(e.exact), rem: e.exact - Math.floor(e.exact) }))
    let remaining = TARGET - floors.reduce((s, f) => s + f.floor, 0)
    floors.sort((a, b) => b.rem - a.rem)
    const slots: Record<string, number> = {}
    floors.forEach((f, i) => { slots[f.cat] = f.floor + (i < remaining ? 1 : 0) })

    // ── 4. Buscar candidatos ──────────────────────────────────────────────────
    const likedCatNames = [...new Set(likedRows.map((r: any) => r.catName as string))]

    let candidates: any[]

    if (isMeiliConfigured()) {
      try {
        candidates = await getEurekaCandidatesFromMeili({
          txArray, ingArray, likedCatNames, restaurantId,
          lat, lng, maxKm,
        })
      } catch (meiliErr) {
        console.error('[eureka] Meilisearch error, falling back to DB:', meiliErr)
        candidates = await getEurekaCandidatesFromDB({
          txArray, ingArray, likedCatNames, restaurantId, allExcluded,
          lat, lng, maxKm,
        })
      }
    } else {
      candidates = await getEurekaCandidatesFromDB({
        txArray, ingArray, likedCatNames, restaurantId, allExcluded,
        lat, lng, maxKm,
      })
    }

    // ── 5. Clasificar candidatos por categoría y filtrar ─────────────────────
    type Candidate = { row: any; leaf: string; score: number }
    const byCat: Record<string, Candidate[]> = {}

    for (const row of candidates) {
      const leaf = resolveDishLeaf(row.name, row.catName, row.leafOverride, row.primaryCategory, null, row.catNormOverride)

      // Solo categorías que el usuario eligió
      if (!slots[leaf]) continue

      // Filtro distancia
      if (lat != null && lng != null && row.lat != null && row.lng != null) {
        const d = haversineKm(lat, lng, Number(row.lat), Number(row.lng))
        if (d > maxKm) continue
      }

      // Filtro dieta
      if (diet === 'VEGAN' && row.dishDiet !== 'VEGAN') continue
      if (diet === 'VEGETARIAN' && row.dishDiet !== 'VEGAN' && row.dishDiet !== 'VEGETARIAN') continue

      // Score dentro de su categoría (tipo + ingrediente + popularidad)
      let score = Number(row.popularityScore ?? 0) * 0.01
      const types: string[] = Array.isArray(row.txDishType) ? row.txDishType : []
      const ings: string[] = Array.isArray(row.txIngredient) ? row.txIngredient : []
      const catTx = txTypesByCat[leaf] ?? new Set()
      const catIng = ingsByCat[leaf] ?? new Set()
      score += types.filter(t => catTx.has(t)).length * 3
      score += ings.filter(i => catIng.has(i)).length * 2

      // Penalización por dislikes: tipos rechazados bajan el score
      for (const t of types) {
        const disCount = dislikedTypeFreq[t] ?? 0
        if (disCount >= 2) score -= 6  // fuerte rechazo
        else if (disCount === 1) score -= 3
      }
      // Penalización por categoría rechazada
      const catDisCount = dislikedCatFreq[leaf] ?? 0
      if (catDisCount >= 2) score -= 4

      if (!byCat[leaf]) byCat[leaf] = []
      byCat[leaf].push({ row, leaf, score })
    }

    // ── 6. Selección proporcional (max 2 platos por restaurante) ───────────────
    const MAX_PER_RESTAURANT = restaurantId ? 999 : 2
    const selected: Candidate[] = []
    const usedIds = new Set<string>()
    const restaurantCount: Record<string, number> = {}

    for (const cat of cats) {
      const n = slots[cat] ?? 0
      if (n === 0) continue
      const pool = (byCat[cat] ?? []).sort((a, b) => b.score - a.score)
      for (const c of pool) {
        if (selected.filter(s => s.leaf === cat).length >= n) break
        const rId = c.row.restaurantId as string
        if ((restaurantCount[rId] ?? 0) >= MAX_PER_RESTAURANT) continue
        selected.push(c)
        usedIds.add(c.row.id)
        restaurantCount[rId] = (restaurantCount[rId] ?? 0) + 1
      }
    }

    // Fase 2: overflow de las mismas categorías liked (antes de salir a fallback)
    // Cubre el caso donde una cat tiene < slots asignados por falta de candidatos cercanos
    if (selected.length < TARGET) {
      for (const cat of cats) {
        if (selected.length >= TARGET) break
        const pool = (byCat[cat] ?? []).sort((a, b) => b.score - a.score)
        for (const c of pool) {
          if (selected.length >= TARGET) break
          if (usedIds.has(c.row.id)) continue
          const rId = c.row.restaurantId as string
          if ((restaurantCount[rId] ?? 0) >= MAX_PER_RESTAURANT) continue
          selected.push(c)
          usedIds.add(c.row.id)
          restaurantCount[rId] = (restaurantCount[rId] ?? 0) + 1
        }
      }
    }

    // Fase 3: fallback por familia superior → si eligió lasañas, busca pastas en general.
    // Nunca sugiere postres si el usuario solo eligió cosas saladas.
    if (selected.length < TARGET) {
      // 3a. Construir tipos de la familia expandida:
      //     txType propio → resolver al padre (lasaña→pasta) → hermanos del padre (pizza, risotto…)
      const familyExpanded = new Set<string>(allTxTypes)
      for (const t of allTxTypes) {
        const parent = PARENT_FAMILY[t] ?? t
        familyExpanded.add(parent)
        for (const sibling of (RELATED_TX_TYPES[parent] ?? [])) familyExpanded.add(sibling)
        for (const related of (RELATED_TX_TYPES[t] ?? [])) familyExpanded.add(related)
      }

      // 3b. Detectar si el usuario eligió algo dulce; si no, excluir postres del fallback
      const userWantsDulce = [...allTxTypes].some(t => DULCE_TX_TYPES.has(t))

      const catCount: Record<string, number> = {}
      for (const s of selected) catCount[s.leaf] = (catCount[s.leaf] ?? 0) + 1

      // Excluir tipos fuertemente rechazados del fallback
      const hardDisliked = new Set(Object.entries(dislikedTypeFreq).filter(([, c]) => c >= 2).map(([t]) => t))

      for (const row of candidates) {
        if (selected.length >= TARGET) break
        if (usedIds.has(row.id)) continue
        const types: string[] = Array.isArray(row.txDishType) ? row.txDishType : []
        // Debe pertenecer a la familia expandida
        if (!types.some(t => familyExpanded.has(t))) continue
        // Excluir tipos fuertemente rechazados
        if (types.some(t => hardDisliked.has(t))) continue
        // Excluir postres/dulces si el usuario no eligió ninguno
        if (!userWantsDulce && types.some(t => DULCE_TX_TYPES.has(t))) continue
        // Respetar el filtro de distancia también en el fallback
        if (lat != null && lng != null && row.lat != null && row.lng != null) {
          if (haversineKm(lat, lng, Number(row.lat), Number(row.lng)) > maxKm) continue
        }
        // Diversificación por restaurante
        const rId = row.restaurantId as string
        if ((restaurantCount[rId] ?? 0) >= MAX_PER_RESTAURANT) continue
        const leaf = resolveDishLeaf(row.name, row.catName, row.leafOverride, row.primaryCategory, null, row.catNormOverride)
        if ((catCount[leaf] ?? 0) >= 4) continue
        catCount[leaf] = (catCount[leaf] ?? 0) + 1
        selected.push({ row, leaf, score: 0 })
        usedIds.add(row.id)
        restaurantCount[rId] = (restaurantCount[rId] ?? 0) + 1
      }
    }

    const dishes = selected.map(({ row, leaf }) => ({
      id: row.id,
      nombre: row.name,
      descripcion: row.description ?? null,
      precio: Number(row.price ?? 0),
      precioDescuento: row.discountPrice != null ? Number(row.discountPrice) : null,
      fotoUrl: Array.isArray(row.photos) && row.photos.length > 0 ? row.photos[0] : null,
      categoria: row.catName,
      categoriaNorm: leaf,
      categoriaParent: null,
      cuisineTag: null,
      categoriaTipo: 'food',
      sabores: Array.isArray(row.flavorTags) ? row.flavorTags : [],
      txDishType: Array.isArray(row.txDishType) ? row.txDishType : [],
      txIngredient: Array.isArray(row.txIngredient) ? row.txIngredient : [],
      dieta: {
        tipo: (row.dishDiet as string) === 'VEGAN' ? 'VEGAN' : (row.dishDiet as string) === 'VEGETARIAN' ? 'VEGETARIAN' : 'OMNIVORE',
        sinGluten: false,
        sinLactosa: false,
        sinSoja: false,
        contieneFrutosSecos: false,
        esPicante: Boolean(row.isSpicy),
      },
      restauranteId: row.restaurantId,
      restaurante: row.restaurantName,
      restauranteSlug: row.restaurantSlug,
      restauranteLogo: row.logoUrl ?? null,
      restauranteDireccion: row.address ?? null,
      restaurantePhone: row.phone ?? null,
      restauranteWebsite: row.website ?? null,
      restauranteWebsiteIsOrderUrl: Boolean(row.websiteIsOrderUrl ?? false),
      restauranteCartaProvider: row.cartaProvider ?? null,
      restauranteInstagram: row.instagram ?? null,
      restaurantePlaceId: row.googlePlaceId ?? null,
      restauranteLat: row.lat != null ? Number(row.lat) : null,
      restauranteLng: row.lng != null ? Number(row.lng) : null,
      googleMapsUrl: row.googleMapsUrl ?? null,
      googleRating: row.googleRating != null ? Number(row.googleRating) : null,
      googleRatingCount: row.googleRatingCount != null ? Number(row.googleRatingCount) : null,
      isShowcase: Boolean(row.isShowcase ?? false),
      enOferta: false,
      mealTime: 'almuerzo_cena' as const,
      tags: [],
      isHero: false,
      avgRating: null,
      ratingCount: 0,
      commentCount: 0,
      popularityScore: Number(row.popularityScore ?? 0),
    }))

    return NextResponse.json({ dishes })
  } catch (err) {
    console.error('[eureka]', err)
    return NextResponse.json({ dishes: [] }, { status: 500 })
  }
}
