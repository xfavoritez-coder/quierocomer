'use client'

import { getSuggestedMealTime, type MealTime } from '../lib/categories'

export type DishTypeFilter = 'all' | 'food' | 'dessert' | 'drink'
export type DietFilter = 'all' | 'VEGAN' | 'VEGETARIAN' | 'GLUTEN_FREE' | 'LACTOSE_FREE'
export type SortFilter = 'relevance' | 'rating' | 'price_asc' | 'price_desc'
export type MealFilter = 'all' | MealTime

export type Filters = {
  dishType: DishTypeFilter
  meal: MealFilter
  diet: DietFilter
  sort: SortFilter
  priceMax: number | null
}

const DISH_TYPES: { id: DishTypeFilter; label: string }[] = [
  { id: 'all', label: 'Todo' },
  { id: 'food', label: '🍽 Comida' },
  { id: 'dessert', label: '🍰 Postres' },
  { id: 'drink', label: '🍹 Bebestibles' },
]

const MEALS: { id: MealFilter; label: string }[] = [
  { id: 'all', label: 'Cualquier hora' },
  { id: 'desayuno', label: '🌅 Desayunos' },
  { id: 'almuerzo_cena', label: '🍴 Almuerzos y cenas' },
]

const DIETS: { id: DietFilter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'VEGAN', label: '🌱 Vegano' },
  { id: 'VEGETARIAN', label: '🥬 Vegetariano' },
  { id: 'GLUTEN_FREE', label: '🌾 Sin gluten' },
  { id: 'LACTOSE_FREE', label: '🥛 Sin lactosa' },
]

const PRICES: { label: string; max: number | null }[] = [
  { label: 'Todos', max: null },
  { label: '< $5.000', max: 5000 },
  { label: '< $10.000', max: 10000 },
  { label: '< $15.000', max: 15000 },
  { label: '< $20.000', max: 20000 },
]

const SORTS: { id: SortFilter; label: string }[] = [
  { id: 'relevance', label: 'Para ti' },
  { id: 'rating', label: '⭐ Mejor valorados' },
  { id: 'price_asc', label: '💰 Precio ↑' },
  { id: 'price_desc', label: '💰 Precio ↓' },
]

export default function FeedFilters({
  filters,
  onChange,
}: {
  filters: Filters
  onChange: (f: Filters) => void
}) {
  const suggested = getSuggestedMealTime()

  return (
    <div style={{ padding: '8px 0 4px', overflowX: 'auto' }}>
      {/* Row 1: Dish type + Meal time */}
      <div className="category-chips" style={{ paddingBottom: 6 }}>
        {DISH_TYPES.map(t => (
          <button key={t.id}
            className={`category-chip ${filters.dishType === t.id ? 'active' : ''}`}
            onClick={() => onChange({ ...filters, dishType: t.id })}>
            {t.label}
          </button>
        ))}
        <span style={{ width: 1, background: 'rgba(255,255,255,0.1)', margin: '0 2px', flexShrink: 0 }} />
        {MEALS.map(m => (
          <button key={m.id}
            className={`category-chip ${filters.meal === m.id ? 'active' : ''}`}
            onClick={() => onChange({ ...filters, meal: m.id })}>
            {m.label}
            {m.id === suggested.mealTime && filters.meal === 'all' && (
              <span style={{ marginLeft: 4, fontSize: 9, opacity: 0.5 }}>sugerido</span>
            )}
          </button>
        ))}
      </div>

      {/* Row 2: Diet + Price + Sort */}
      <div className="category-chips" style={{ paddingBottom: 6 }}>
        {DIETS.map(d => (
          <button key={d.id}
            className={`category-chip ${filters.diet === d.id ? 'active' : ''}`}
            onClick={() => onChange({ ...filters, diet: d.id })}>
            {d.label}
          </button>
        ))}
        <span style={{ width: 1, background: 'rgba(255,255,255,0.1)', margin: '0 2px', flexShrink: 0 }} />
        {PRICES.map((p, i) => (
          <button key={i}
            className={`category-chip ${filters.priceMax === p.max ? 'active' : ''}`}
            onClick={() => onChange({ ...filters, priceMax: p.max })}>
            {p.label}
          </button>
        ))}
        <span style={{ width: 1, background: 'rgba(255,255,255,0.1)', margin: '0 2px', flexShrink: 0 }} />
        {SORTS.map(s => (
          <button key={s.id}
            className={`category-chip ${filters.sort === s.id ? 'active' : ''}`}
            onClick={() => onChange({ ...filters, sort: s.id })}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Aplica los filtros a un array de platos */
export function applyFilters(
  dishes: import('../types').FeedDish[],
  filters: Filters,
): import('../types').FeedDish[] {
  let result = dishes

  // Dish type
  if (filters.dishType !== 'all') {
    result = result.filter(d => d.categoriaTipo === filters.dishType)
  }

  // Meal time
  if (filters.meal !== 'all') {
    result = result.filter(d => d.mealTime === filters.meal)
  }

  // Diet
  if (filters.diet === 'VEGAN') result = result.filter(d => d.dieta.tipo === 'VEGAN')
  else if (filters.diet === 'VEGETARIAN') result = result.filter(d => d.dieta.tipo === 'VEGAN' || d.dieta.tipo === 'VEGETARIAN')
  else if (filters.diet === 'GLUTEN_FREE') result = result.filter(d => d.dieta.sinGluten)
  else if (filters.diet === 'LACTOSE_FREE') result = result.filter(d => d.dieta.sinLactosa)

  // Price
  if (filters.priceMax != null) {
    result = result.filter(d => (d.precioDescuento ?? d.precio) <= filters.priceMax!)
  }

  // Sort
  if (filters.sort === 'rating') {
    result = [...result].sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0))
  } else if (filters.sort === 'price_asc') {
    result = [...result].sort((a, b) => (a.precioDescuento ?? a.precio) - (b.precioDescuento ?? b.precio))
  } else if (filters.sort === 'price_desc') {
    result = [...result].sort((a, b) => (b.precioDescuento ?? b.precio) - (a.precioDescuento ?? a.precio))
  }

  return result
}
