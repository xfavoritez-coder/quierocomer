import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { resolveDishLeaf } from '@/app/a/lib/feed-queries'

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

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      dishIds,
      excludeIds = [],
      lat,
      lng,
      maxKm = 15,
      diet,
    }: {
      dishIds: string[]
      excludeIds?: string[]
      lat?: number
      lng?: number
      maxKm?: number
      diet?: string
    } = body

    if (!dishIds?.length) return NextResponse.json({ dishes: [] })
    const allExcluded = [...dishIds, ...excludeIds]

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
    // catFreq: cuántos de los 6 liked son de cada categoría
    const catFreq: Record<string, number> = {}
    const txTypesByCat: Record<string, Set<string>> = {}
    const ingsByCat: Record<string, Set<string>> = {}
    const allTxTypes = new Set<string>()
    const allIngs = new Set<string>()

    for (const row of likedRows) {
      const leaf = resolveDishLeaf(row.name, row.catName, row.leafOverride, row.primaryCategory, null, row.catNormOverride)
      catFreq[leaf] = (catFreq[leaf] ?? 0) + 1
      if (!txTypesByCat[leaf]) txTypesByCat[leaf] = new Set()
      if (!ingsByCat[leaf]) ingsByCat[leaf] = new Set()
      if (Array.isArray(row.txDishType)) row.txDishType.forEach((t: string) => { txTypesByCat[leaf].add(t); allTxTypes.add(t) })
      if (Array.isArray(row.txIngredient)) row.txIngredient.forEach((i: string) => { ingsByCat[leaf].add(i); allIngs.add(i) })
    }

    const totalLiked = likedRows.length
    const cats = Object.keys(catFreq)
    const txArray = [...allTxTypes]
    const ingArray = [...allIngs]

    // ── 3. Asignar slots proporcionales a cada categoría ──────────────────────
    // round proporcional con redistribución de restos (Largest Remainder Method)
    const exact = cats.map(cat => ({ cat, exact: (catFreq[cat] / totalLiked) * TARGET }))
    const floors = exact.map(e => ({ ...e, floor: Math.floor(e.exact), rem: e.exact - Math.floor(e.exact) }))
    let remaining = TARGET - floors.reduce((s, f) => s + f.floor, 0)
    floors.sort((a, b) => b.rem - a.rem)
    const slots: Record<string, number> = {}
    floors.forEach((f, i) => { slots[f.cat] = f.floor + (i < remaining ? 1 : 0) })

    // ── 4. Buscar candidatos ──────────────────────────────────────────────────
    const candidates = await prisma.$queryRaw<any[]>`
      SELECT
        d.id, d.name, d.description, d.price, d."discountPrice",
        d.photos, d."dishDiet", d."leafOverride", d."txDishType", d."txIngredient", d."flavorTags",
        c.name AS "catName", c."normOverride" AS "catNormOverride",
        r.id AS "restaurantId", r.name AS "restaurantName", r.slug AS "restaurantSlug",
        r."logoUrl", r.address, r.phone, r.lat, r.lng, r."primaryCategory",
        r."googleMapsUrl",
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
        AND (
          d."txDishType" && ${txArray.length > 0 ? txArray : ['']}
          OR d."txIngredient" && ${ingArray.length > 0 ? ingArray : ['']}
        )
      ORDER BY COALESCE(fs."popularityScore", 0) DESC
      LIMIT 500
    `

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

      if (!byCat[leaf]) byCat[leaf] = []
      byCat[leaf].push({ row, leaf, score })
    }

    // ── 6. Selección proporcional ─────────────────────────────────────────────
    const selected: Candidate[] = []
    for (const cat of cats) {
      const n = slots[cat] ?? 0
      if (n === 0) continue
      const pool = (byCat[cat] ?? []).sort((a, b) => b.score - a.score)
      selected.push(...pool.slice(0, n))
    }

    // Si quedaron slots vacíos (sin candidatos en esa cat), rellenar con cualquier otro
    if (selected.length < TARGET) {
      const usedIds = new Set(selected.map(s => s.row.id))
      const fallback = candidates
        .filter(r => !usedIds.has(r.id))
        .slice(0, TARGET - selected.length)
        .map(row => {
          const leaf = resolveDishLeaf(row.name, row.catName, row.leafOverride, row.primaryCategory, null, row.catNormOverride)
          return { row, leaf, score: 0 }
        })
      selected.push(...fallback)
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
        esPicante: false,
      },
      restauranteId: row.restaurantId,
      restaurante: row.restaurantName,
      restauranteSlug: row.restaurantSlug,
      restauranteLogo: row.logoUrl ?? null,
      restauranteDireccion: row.address ?? null,
      restaurantePhone: row.phone ?? null,
      restauranteLat: row.lat != null ? Number(row.lat) : null,
      restauranteLng: row.lng != null ? Number(row.lng) : null,
      googleMapsUrl: row.googleMapsUrl ?? null,
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
