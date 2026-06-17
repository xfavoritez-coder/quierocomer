'use client'

import { useState } from 'react'
import { getSuggestedMealTime, type MealTime } from '../lib/categories'
import type { FeedDish } from '../types'

export type MealFilter = 'all' | MealTime
export type SortFilter = 'relevance' | 'rating' | 'price_asc' | 'price_desc'

export type Filters = {
  meal: MealFilter
  dishType: string | null  // null = all, 'food', 'dessert', 'drink'
  sort: SortFilter
  priceMax: number | null
}

export function getDefaultFilters(): Filters {
  const suggested = getSuggestedMealTime()
  return {
    meal: suggested.mealTime,
    dishType: 'food',
    sort: 'relevance',
    priceMax: null,
  }
}

const MEALS: { id: MealFilter; label: string }[] = [
  { id: 'all', label: 'Todo el día' },
  { id: 'desayuno', label: '🌅 Desayunos' },
  { id: 'almuerzo_cena', label: '🍴 Almuerzos y cenas' },
]

const DISH_TYPES: { id: string | null; label: string; matches: string[] }[] = [
  { id: null, label: 'Todos', matches: [] },
  { id: 'food', label: '🍽 Platos', matches: ['food', 'entry'] },
  { id: 'dessert', label: '🍰 Postres', matches: ['dessert'] },
  { id: 'drink', label: '🍹 Bebestibles', matches: ['drink', 'coffee'] },
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
  greetingOnly,
  noGreeting,
  showMore: showMoreProp,
  onToggleMore,
}: {
  filters: Filters
  onChange: (f: Filters) => void
  greetingOnly?: boolean
  noGreeting?: boolean
  showMore?: boolean
  onToggleMore?: () => void
}) {
  const activeSecondaryCount =
    (filters.priceMax != null ? 1 : 0) +
    (filters.sort !== 'relevance' ? 1 : 0)

  // Use external control if provided
  const showMore = showMoreProp ?? false

  if (greetingOnly) {
    return (
      <div style={{ padding: '6px 0 2px' }}>
        <MealGreeting meal={filters.meal} onChange={m => onChange({ ...filters, meal: m })} />
      </div>
    )
  }

  return (
    <div style={{ padding: '6px 0 2px' }}>
      {/* Greeting with meal selector — only if not noGreeting */}
      {!noGreeting && <MealGreeting meal={filters.meal} onChange={m => onChange({ ...filters, meal: m })} />}

      {/* Dish type chips */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="category-chips" style={{ paddingBottom: 6 }}>
          {DISH_TYPES.map(t => (
            <button key={t.id ?? 'all'}
              style={chipStyle(filters.dishType === t.id)}
              onClick={() => onChange({ ...filters, dishType: t.id })}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: 24,
          background: 'linear-gradient(to right, transparent, #f5f4f1)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* Secondary filters panel — controlled from header Filtros button */}
      {showMore && (
        <div style={{
          margin: '0 12px 8px', padding: 16, borderRadius: 14,
          background: '#fff', border: '1px solid rgba(0,0,0,0.07)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          animation: 'fadeIn 0.2s ease-out',
        }}>
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 11, color: 'rgba(0,0,0,0.45)', margin: '0 0 8px', fontWeight: 600 }}>Precio máximo</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PRICES.map((p, i) => (
                <button key={i} onClick={() => onChange({ ...filters, priceMax: p.max })}
                  style={chipStyleSmall(filters.priceMax === p.max)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p style={{ fontSize: 11, color: 'rgba(0,0,0,0.45)', margin: '0 0 8px', fontWeight: 600 }}>Ordenar por</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SORTS.map(s => (
                <button key={s.id} onClick={() => onChange({ ...filters, sort: s.id })}
                  style={chipStyleSmall(filters.sort === s.id)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          {activeSecondaryCount > 0 && (
            <button onClick={() => onChange({ ...filters, priceMax: null, sort: 'relevance' })}
              style={{ marginTop: 12, width: '100%', padding: 10, borderRadius: 10, background: 'none', border: '1px solid rgba(0,0,0,0.08)', color: 'rgba(0,0,0,0.4)', fontSize: 12, cursor: 'pointer' }}>
              Limpiar filtros
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function MealGreeting({ meal, onChange }: { meal: MealFilter; onChange: (m: MealFilter) => void }) {
  const [open, setOpen] = useState(false)
  const hour = new Date().getHours()
  const greeting = hour >= 5 && hour < 12 ? 'Buenos días'
    : hour >= 12 && hour < 20 ? 'Buenas tardes'
    : 'Buenas noches'

  const mealLabel: Record<MealFilter, string> = {
    'all': 'platos',
    'desayuno': 'desayunos',
    'almuerzo_cena': hour >= 18 ? 'cenas' : 'almuerzos',
  }

  const options: { id: MealFilter; label: string }[] = [
    { id: 'desayuno', label: 'Desayunos' },
    { id: 'almuerzo_cena', label: 'Almuerzos y cenas' },
  ]

  return (
    <div style={{ padding: '6px 14px 12px', position: 'relative' }}>
      <p style={{ fontSize: 15, color: 'rgba(0,0,0,0.45)', margin: 0, fontWeight: 500 }}>
        {greeting},{' '}
        <button onClick={() => setOpen(!open)} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          color: '#c97d00', fontWeight: 700, fontSize: 15,
          borderBottom: '1px dashed rgba(201,125,0,0.4)',
          display: 'inline-flex', alignItems: 'center', gap: 3,
        }}>
          {mealLabel[meal]}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#c97d00" strokeWidth="2.5" strokeLinecap="round"
            style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {' '}para ti
      </p>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 44 }} />
          <div style={{
            position: 'absolute', top: '100%', left: 14, zIndex: 45,
            background: '#fff',
            border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12,
            padding: 4, marginTop: 4, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          }}>
            {options.map(o => (
              <button key={o.id} onClick={() => { onChange(o.id); setOpen(false) }}
                style={{
                  display: 'block', width: '100%', padding: '10px 16px', borderRadius: 8,
                  background: meal === o.id ? 'rgba(244,166,35,0.1)' : 'transparent',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  fontSize: 14, fontWeight: meal === o.id ? 700 : 400,
                  color: meal === o.id ? '#c97d00' : '#111',
                  whiteSpace: 'nowrap',
                }}>
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: '10px 18px', borderRadius: 22, fontSize: 13, fontWeight: 500,
    whiteSpace: 'nowrap', border: active ? 'none' : '1px solid rgba(0,0,0,0.08)', cursor: 'pointer',
    background: active ? '#F4A623' : '#fff',
    color: active ? '#000' : 'rgba(0,0,0,0.55)',
    transition: 'all 0.15s', WebkitTapHighlightColor: 'transparent',
  }
}

function chipStyleSmall(active: boolean): React.CSSProperties {
  return {
    padding: '6px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
    border: active ? 'none' : '1px solid rgba(0,0,0,0.08)',
    background: active ? '#F4A623' : '#fff',
    color: active ? '#000' : 'rgba(0,0,0,0.55)',
  }
}

/** Aplica los filtros a un array de platos */
export function applyFilters(dishes: FeedDish[], filters: Filters): FeedDish[] {
  let result = dishes

  // Dish type (single select)
  if (filters.dishType) {
    const dt = DISH_TYPES.find(t => t.id === filters.dishType)
    if (dt && dt.matches.length > 0) {
      const matchSet = new Set(dt.matches)
      result = result.filter(d => matchSet.has(d.categoriaTipo))
    }
  }

  // Meal time — only applies to food, not desserts/drinks
  if (filters.meal !== 'all') {
    result = result.filter(d => {
      if (d.categoriaTipo === 'dessert' || d.categoriaTipo === 'drink' || d.categoriaTipo === 'coffee') return true
      return d.mealTime === filters.meal
    })
  }

  // Price
  if (filters.priceMax != null) {
    result = result.filter(d => {
      const p = d.precioDescuento ?? d.precio
      return p == null || p <= filters.priceMax!
    })
  }

  // Sort
  if (filters.sort === 'rating') {
    result = [...result].sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0))
  } else if (filters.sort === 'price_asc') {
    result = [...result].sort((a, b) => ((a.precioDescuento ?? a.precio) ?? 0) - ((b.precioDescuento ?? b.precio) ?? 0))
  } else if (filters.sort === 'price_desc') {
    result = [...result].sort((a, b) => ((b.precioDescuento ?? b.precio) ?? 0) - ((a.precioDescuento ?? a.precio) ?? 0))
  }

  return result
}
