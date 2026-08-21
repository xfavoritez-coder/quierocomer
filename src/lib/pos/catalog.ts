import { posDb } from './db'
import type { CachedProduct, CachedModifierTemplate, CachedModifierGroup, CachedModifierOption } from './types'

// ── Load catalog via API route (uses Prisma with full relations) ──

export async function refreshCatalog(restaurantId: string): Promise<void> {
  if (!navigator.onLine) return

  try {
    const res = await fetch(`/api/pos/catalog?restaurantId=${encodeURIComponent(restaurantId)}`)
    if (!res.ok) {
      console.error('[POS Catalog] API error:', res.status, await res.text())
      return
    }

    const { categories, dishes } = await res.json() as {
      categories: Array<{ id: string; name: string; position: number }>
      dishes: Array<{
        id: string
        categoryId: string
        name: string
        description: string | null
        price: number
        discountPrice: number | null
        photos: string[]
        position: number
        modifierTemplates: Array<{
          id: string
          name: string
          groups: Array<{
            id: string
            name: string
            required: boolean
            minSelect: number
            maxSelect: number
            options: Array<{
              id: string
              name: string
              priceAdjustment: number
              isDefault: boolean
            }>
          }>
        }>
      }>
    }

    // Build category lookup
    const categoryMap = new Map<string, { name: string; position: number }>()
    for (const c of categories) {
      categoryMap.set(c.id, { name: c.name, position: c.position })
    }

    // Build cached products
    const products: CachedProduct[] = dishes.map(d => {
      const cat = categoryMap.get(d.categoryId)

      const modifierTemplates: CachedModifierTemplate[] = d.modifierTemplates.map(t => ({
        id: t.id,
        name: t.name,
        groups: t.groups.map((g): CachedModifierGroup => ({
          id: g.id,
          name: g.name,
          required: g.required,
          min_select: g.minSelect,
          max_select: g.maxSelect,
          options: g.options.map((o): CachedModifierOption => ({
            id: o.id,
            name: o.name,
            price_adjustment: o.priceAdjustment,
            is_default: o.isDefault,
          })),
        })),
      }))

      return {
        id: d.id,
        restaurant_id: restaurantId,
        category_id: d.categoryId,
        category_name: cat?.name ?? 'Sin categoría',
        category_position: cat?.position ?? 999,
        name: d.name,
        description: d.description ?? undefined,
        price: d.price,
        discount_price: d.discountPrice ?? undefined,
        photos: d.photos || [],
        is_active: true,
        position: d.position,
        modifier_templates: modifierTemplates,
      }
    })

    // Write to IndexedDB (replace all for this restaurant)
    await posDb.transaction('rw', posDb.products, async () => {
      await posDb.products.where('restaurant_id').equals(restaurantId).delete()
      await posDb.products.bulkPut(products)
    })

    console.log(`[POS Catalog] Cached ${products.length} products from ${categories.length} categories`)
  } catch (err) {
    console.error('[POS Catalog] Error:', err)
  }
}

// ── Read catalog from IndexedDB ──────────────────────────────────

export async function getCachedCategories(restaurantId: string) {
  const products = await posDb.products
    .where('restaurant_id')
    .equals(restaurantId)
    .toArray()

  const catMap = new Map<string, { id: string; name: string; position: number }>()
  for (const p of products) {
    if (!catMap.has(p.category_id)) {
      catMap.set(p.category_id, {
        id: p.category_id,
        name: p.category_name,
        position: p.category_position,
      })
    }
  }

  return Array.from(catMap.values()).sort((a, b) => a.position - b.position)
}

export async function getCachedProducts(restaurantId: string, categoryId?: string) {
  const products = await posDb.products
    .where('restaurant_id')
    .equals(restaurantId)
    .toArray()

  const filtered = categoryId
    ? products.filter(p => p.category_id === categoryId)
    : products

  return filtered.sort((a, b) => {
    if (a.category_position !== b.category_position) return a.category_position - b.category_position
    return a.position - b.position
  })
}
