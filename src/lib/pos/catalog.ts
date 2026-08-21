import { supabase } from '@/lib/supabase'
import { posDb } from './db'
import type { CachedProduct, CachedModifierTemplate, CachedModifierGroup, CachedModifierOption } from './types'

// ── Load catalog from Supabase into IndexedDB ────────────────────

export async function refreshCatalog(restaurantId: string): Promise<void> {
  if (!navigator.onLine) return

  // 1. Fetch categories
  const { data: categories, error: catError } = await supabase
    .from('Category')
    .select('id, name, position, isActive, dishType')
    .eq('restaurantId', restaurantId)
    .eq('isActive', true)
    .order('position')

  if (catError) {
    console.error('[POS Catalog] Categories error:', catError)
    return
  }

  // 2. Fetch dishes with their modifier template IDs
  const { data: dishes, error: dishError } = await supabase
    .from('Dish')
    .select('id, categoryId, name, description, price, discountPrice, photos, isActive, position')
    .eq('restaurantId', restaurantId)
    .eq('isActive', true)
    .is('deletedAt', null)
    .order('position')

  if (dishError) {
    console.error('[POS Catalog] Dishes error:', dishError)
    return
  }

  // 3. Fetch modifier templates for this restaurant with full hierarchy
  const { data: templates, error: tmplError } = await supabase
    .from('ModifierTemplate')
    .select(`
      id, name,
      groups:ModifierTemplateGroup (
        id, name, required, minSelect, maxSelect, position,
        options:ModifierTemplateOption (
          id, name, priceAdjustment, isDefault, position, isHidden
        )
      )
    `)
    .eq('restaurantId', restaurantId)
    .order('name')

  if (tmplError) {
    console.error('[POS Catalog] Modifiers error:', tmplError)
    return
  }

  // 4. Fetch dish-to-modifier-template associations (many-to-many)
  const { data: dishModLinks, error: linkError } = await supabase
    .from('_DishToModifierTemplate')
    .select('A, B')

  if (linkError) {
    console.error('[POS Catalog] Dish-modifier links error:', linkError)
    return
  }

  // Build lookup: dishId → templateIds
  const dishTemplateMap = new Map<string, string[]>()
  if (dishModLinks) {
    for (const link of dishModLinks) {
      // A = Dish id, B = ModifierTemplate id
      const dishId = link.A as string
      const templateId = link.B as string
      if (!dishTemplateMap.has(dishId)) dishTemplateMap.set(dishId, [])
      dishTemplateMap.get(dishId)!.push(templateId)
    }
  }

  // Build template lookup
  const templateMap = new Map<string, CachedModifierTemplate>()
  if (templates) {
    for (const t of templates) {
      const groups = ((t.groups as unknown[]) || []) as Array<{
        id: string; name: string; required: boolean;
        minSelect: number; maxSelect: number; position: number;
        options: Array<{
          id: string; name: string; priceAdjustment: number;
          isDefault: boolean; position: number; isHidden: boolean;
        }>
      }>

      templateMap.set(t.id, {
        id: t.id,
        name: t.name,
        groups: groups
          .sort((a, b) => a.position - b.position)
          .map((g): CachedModifierGroup => ({
            id: g.id,
            name: g.name,
            required: g.required,
            min_select: g.minSelect,
            max_select: g.maxSelect,
            options: (g.options || [])
              .filter(o => !o.isHidden)
              .sort((a, b) => a.position - b.position)
              .map((o): CachedModifierOption => ({
                id: o.id,
                name: o.name,
                price_adjustment: o.priceAdjustment,
                is_default: o.isDefault,
              })),
          })),
      })
    }
  }

  // Build category lookup
  const categoryMap = new Map<string, { name: string; position: number }>()
  if (categories) {
    for (const c of categories) {
      categoryMap.set(c.id, { name: c.name, position: c.position })
    }
  }

  // 5. Build cached products
  const products: CachedProduct[] = (dishes || []).map(d => {
    const cat = categoryMap.get(d.categoryId)
    const templateIds = dishTemplateMap.get(d.id) || []
    const modifierTemplates = templateIds
      .map(id => templateMap.get(id))
      .filter((t): t is CachedModifierTemplate => !!t)

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
      is_active: d.isActive,
      position: d.position,
      modifier_templates: modifierTemplates,
    }
  }).filter(p => categoryMap.has(p.category_id)) // Only include products from active categories

  // 6. Write to IndexedDB (replace all for this restaurant)
  await posDb.transaction('rw', posDb.products, async () => {
    await posDb.products.where('restaurant_id').equals(restaurantId).delete()
    await posDb.products.bulkPut(products)
  })

  console.log(`[POS Catalog] Cached ${products.length} products, ${templateMap.size} templates`)
}

// ── Read catalog from IndexedDB ──────────────────────────────────

export async function getCachedCategories(restaurantId: string) {
  const products = await posDb.products
    .where('restaurant_id')
    .equals(restaurantId)
    .toArray()

  // Group by category and deduplicate
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
  let query = posDb.products.where('restaurant_id').equals(restaurantId)

  const products = await query.toArray()

  const filtered = categoryId
    ? products.filter(p => p.category_id === categoryId)
    : products

  return filtered.sort((a, b) => {
    if (a.category_position !== b.category_position) return a.category_position - b.category_position
    return a.position - b.position
  })
}
