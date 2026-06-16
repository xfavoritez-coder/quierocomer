import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isExcludedCategory, QC_LEAVES, normalizeCategory, AMBIGUOUS_CATEGORIES } from '@/app/a/lib/categories'
import { resolveDishLeaf } from '@/app/a/lib/feed-queries'

export const dynamic = 'force-dynamic'

/** Resuelve el leaf de una categoría SOLO desde el nombre (sin inferir desde platos) */
function resolveCatLeaf(catName: string, normOverride: string | null, primaryCategory: string | null): string {
  if (normOverride && QC_LEAVES.has(normOverride)) return normOverride
  const catNorm = normalizeCategory(catName)
  if (QC_LEAVES.has(catNorm)) return catNorm
  if (AMBIGUOUS_CATEGORIES.has(catName.trim()) || AMBIGUOUS_CATEGORIES.has(catNorm)) {
    if (primaryCategory && QC_LEAVES.has(primaryCategory)) return primaryCategory
  }
  return ''
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'slug requerido' }, { status: 400 })

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, primaryCategory: true },
  })

  if (!restaurant) return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })

  const dishes = await prisma.dish.findMany({
    where: { restaurantId: restaurant.id, deletedAt: null },
    select: {
      id: true, name: true, price: true, photos: true,
      dishDiet: true, isActive: true, hiddenFromFeed: true, leafOverride: true, flavorTags: true,
      category: { select: { id: true, name: true, normOverride: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const primaryCategory = restaurant.primaryCategory ?? null

  // Group dishes by category
  const categoryMap = new Map<string, {
    categoryId: string
    categoryName: string
    normOverride: string | null
    leafResolved: string   // leaf de la categoría (solo por nombre)
    isMapped: boolean
    dishes: {
      id: string
      name: string
      price: number
      photo: string | null
      isActive: boolean
      hiddenFromFeed: boolean
      diet: string
      leafOverride: string | null
      flavorTags: string[]
      dishLeafResolved: string  // leaf efectivo del plato (con inferencia por nombre)
    }[]
  }>()

  for (const dish of dishes) {
    const catName = dish.category.name
    if (isExcludedCategory(catName)) continue

    if (!categoryMap.has(catName)) {
      const leafResolved = resolveCatLeaf(catName, dish.category.normOverride, primaryCategory)
      categoryMap.set(catName, {
        categoryId: dish.category.id,
        categoryName: catName,
        normOverride: dish.category.normOverride,
        leafResolved,
        isMapped: QC_LEAVES.has(leafResolved),
        dishes: [],
      })
    }

    // Per-dish resolution: usa inferencia por nombre del plato también
    const dishLeafResolved = resolveDishLeaf(dish.name, catName, dish.leafOverride ?? null, primaryCategory)

    const photos = Array.isArray(dish.photos) ? dish.photos : []
    categoryMap.get(catName)!.dishes.push({
      id: dish.id,
      name: dish.name,
      price: Number(dish.price),
      photo: photos[0] ?? null,
      isActive: dish.isActive,
      hiddenFromFeed: dish.hiddenFromFeed,
      diet: dish.dishDiet,
      leafOverride: dish.leafOverride ?? null,
      flavorTags: Array.isArray(dish.flavorTags) ? (dish.flavorTags as string[]) : [],
      dishLeafResolved,
    })
  }

  const categories = [...categoryMap.values()].sort((a, b) => {
    if (!a.isMapped && b.isMapped) return -1
    if (a.isMapped && !b.isMapped) return 1
    return a.categoryName.localeCompare(b.categoryName)
  })

  return NextResponse.json({
    restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug },
    categories,
    totalDishes: dishes.length,
    unmappedCount: categories.filter(c => !c.isMapped).length,
  })
}
