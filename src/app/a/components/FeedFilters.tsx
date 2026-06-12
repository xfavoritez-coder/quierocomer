'use client'

import { useState } from 'react'
import { getSuggestedMealTime, type MealTime } from '../lib/categories'
import type { FeedDish } from '../types'

export type MealFilter = 'all' | MealTime
export type DietFilter = 'all' | 'VEGAN' | 'VEGETARIAN' | 'GLUTEN_FREE' | 'LACTOSE_FREE'
export type SortFilter = 'relevance' | 'rating' | 'price_asc' | 'price_desc'

export type Filters = {
  meal: MealFilter
  dishTypes: Set<string>  // multi-select: 'food', 'dessert', 'drink', 'entry'
  diet: DietFilter
  sort: SortFilter
  priceMax: number | null
}

export function getDefaultFilters(userDiet?: { isVegan: boolean; isVegetarian: boolean }): Filters {
  const suggested = getSuggestedMealTime()
  return {
    meal: suggested.mealTime,
    dishTypes: new Set(['food']),
    diet: userDiet?.isVegan ? 'VEGAN' : userDiet?.isVegetarian ? 'VEGETARIAN' : 'all',
    sort: 'relevance',
    priceMax: null,
  }
}

const MEALS: { id: MealFilter; label: string }[] = [
  { id: 'all', label: 'Todo el día' },
  { id: 'desayuno', label: '🌅 Desayunos' },
  { id: 'almuerzo_cena', label: '🍴 Almuerzos y cenas' },
]

const DISH_TYPES: { id: string; label: string }[] = [
  { id: 'entry', label: '🥗 Entradas' },
  { id: 'food', label: '🍽 Platos' },
  { id: 'dessert', label: '🍰 Postres' },
  { id: 'drink', label: '🍹 Bebestibles' },
]

const DIETS: { id: DietFilter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'VEGAN', label: '🌱 Vegano' },
  { id: 'VEGETARIAN', label: '🥬 Vegetariano' },
  { id: 'GLUTEN_FREE', label: '🌾 Sin gluten' },
  { id: 'LACTOSE_FREE', label: '🥛 Sin lactosa' },
]

const PRICES: { label: string; max: number | null }[] = [
  { label: 'Cualquier precio', max: null },
  { label: '< $5.000', max: 5000 },
  { label: '< $10.000', max: 10000 },
  { label: '< $15.000', max: 15000 },
]

const SORTS: { id: SortFilter; label: string }[] = [
  { id: 'relevance', label: 'Para ti' },
  { id: 'rating', label: '⭐ Mejor valorados' },
  { id: 'price_asc', label: 'Precio ↑' },
  { id: 'price_desc', label: 'Precio ↓' },
]

export default function FeedFilters({
  filters,
  onChange,
}: {
  filters: Filters
  onChange: (f: Filters) => void
}) {
  const [showMore, setShowMore] = useState(false)

  const toggleDishType = (id: string) => {
    const next = new Set(filters.dishTypes)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange({ ...filters, dishTypes: next })
  }

  const activeSecondaryCount =
    (filters.diet !== 'all' ? 1 : 0) +
    (filters.priceMax != null ? 1 : 0) +
    (filters.sort !== 'relevance' ? 1 : 0)

  return (
    <div style={{ padding: '6px 0 2px' }}>
      {/* Row 1: Meal time */}
      <div className="category-chips" style={{ paddingBottom: 6 }}>
        {MEALS.map(m => (
          <button key={m.id}
            className={`category-chip ${filters.meal === m.id ? 'active' : ''}`}
            onClick={() => onChange({ ...filters, meal: m.id })}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Row 2: Dish types (scrollable) + fixed filter button */}
      <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 6 }}>
        {/* Scrollable chips with fade */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minWidth: 0 }}>
          <div className="category-chips" style={{ paddingBottom: 0, paddingRight: 8 }}>
            <button
              className={`category-chip ${filters.dishTypes.size === 0 ? 'active' : ''}`}
              onClick={() => onChange({ ...filters, dishTypes: new Set() })}>
              Todos
            </button>
            {DISH_TYPES.map(t => (
              <button key={t.id}
                className={`category-chip ${filters.dishTypes.has(t.id) ? 'active' : ''}`}
                onClick={() => toggleDishType(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          {/* Fade right */}
          <div style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, width: 24,
            background: 'linear-gradient(to right, transparent, #0e0e0e)',
            pointerEvents: 'none',
          }} />
        </div>

        {/* Fixed filter button */}
        <button
          onClick={() => setShowMore(!showMore)}
          style={{
            padding: '10px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
            whiteSpace: 'nowrap', cursor: 'pointer',
            background: showMore || activeSecondaryCount > 0 ? 'rgba(244,166,35,0.15)' : 'rgba(255,255,255,0.03)',
            color: showMore || activeSecondaryCount > 0 ? '#F4A623' : 'rgba(255,255,255,0.35)',
            border: `1px solid ${showMore || activeSecondaryCount > 0 ? 'rgba(244,166,35,0.25)' : 'rgba(255,255,255,0.08)'}`,
            display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
            marginLeft: 4, marginRight: 12,
          }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
            <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
            <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
            <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
          </svg>
          {activeSecondaryCount > 0 && (
            <span style={{
              background: '#000', color: 'var(--feed-amber)',
              fontSize: 9, fontWeight: 700, width: 14, height: 14,
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {activeSecondaryCount}
            </span>
          )}
        </button>
      </div>

      {/* Secondary filters panel */}
      {showMore && (
        <div style={{
          margin: '0 12px 8px', padding: 16, borderRadius: 14,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
          animation: 'fadeIn 0.2s ease-out',
        }}>
          {/* Diet */}
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '0 0 8px', fontWeight: 600 }}>Dieta</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {DIETS.map(d => (
                <button key={d.id}
                  onClick={() => onChange({ ...filters, diet: d.id })}
                  style={{
                    padding: '6px 12px', borderRadius: 20, fontSize: 12, border: 'none', cursor: 'pointer',
                    background: filters.diet === d.id ? 'var(--feed-amber)' : 'rgba(255,255,255,0.06)',
                    color: filters.diet === d.id ? '#000' : 'rgba(255,255,255,0.55)',
                  }}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Price */}
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '0 0 8px', fontWeight: 600 }}>Precio máximo</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PRICES.map((p, i) => (
                <button key={i}
                  onClick={() => onChange({ ...filters, priceMax: p.max })}
                  style={{
                    padding: '6px 12px', borderRadius: 20, fontSize: 12, border: 'none', cursor: 'pointer',
                    background: filters.priceMax === p.max ? 'var(--feed-amber)' : 'rgba(255,255,255,0.06)',
                    color: filters.priceMax === p.max ? '#000' : 'rgba(255,255,255,0.55)',
                  }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '0 0 8px', fontWeight: 600 }}>Ordenar por</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SORTS.map(s => (
                <button key={s.id}
                  onClick={() => onChange({ ...filters, sort: s.id })}
                  style={{
                    padding: '6px 12px', borderRadius: 20, fontSize: 12, border: 'none', cursor: 'pointer',
                    background: filters.sort === s.id ? 'var(--feed-amber)' : 'rgba(255,255,255,0.06)',
                    color: filters.sort === s.id ? '#000' : 'rgba(255,255,255,0.55)',
                  }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clear */}
          {activeSecondaryCount > 0 && (
            <button onClick={() => onChange({ ...filters, diet: 'all', priceMax: null, sort: 'relevance' })}
              style={{
                marginTop: 12, width: '100%', padding: 10, borderRadius: 10,
                background: 'none', border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer',
              }}>
              Limpiar filtros secundarios
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Aplica los filtros a un array de platos */
export function applyFilters(dishes: FeedDish[], filters: Filters): FeedDish[] {
  let result = dishes

  // Dish types (multi-select)
  if (filters.dishTypes.size > 0) {
    result = result.filter(d => filters.dishTypes.has(d.categoriaTipo))
  }

  // Meal time — applies to food and entry. Desserts and drinks always show.
  if (filters.meal !== 'all') {
    result = result.filter(d => {
      if (d.categoriaTipo === 'dessert' || d.categoriaTipo === 'drink' || d.categoriaTipo === 'coffee') return true
      return d.mealTime === filters.meal
    })
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
