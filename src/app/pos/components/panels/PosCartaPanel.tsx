'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface DishLite {
  id: string
  name: string
  price: number
  isActive: boolean
  soldOut: boolean
  ecommerceOnly: boolean
  appOnly: boolean
  photos: string[]
  category: { id: string; name: string } | null
}

interface CategoryGroup {
  id: string
  name: string
  dishes: DishLite[]
}

const clp = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')

export default function PosCartaPanel({ restaurantId, title, onDone }: { restaurantId: string; title?: string; onDone?: () => void }) {
  const [groups, setGroups] = useState<CategoryGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const fetchDishes = useCallback(async () => {
    if (!restaurantId) return
    try {
      const r = await fetch(`/api/panel/ecommerce/dishes?restaurantId=${restaurantId}`, { cache: 'no-store' })
      const d = await r.json()
      if (!r.ok || !Array.isArray(d)) return
      // Group by category
      const map = new Map<string, CategoryGroup>()
      for (const dish of d as DishLite[]) {
        const catId = dish.category?.id ?? '__sin_categoria'
        const catName = dish.category?.name ?? 'Sin categoría'
        if (!map.has(catId)) map.set(catId, { id: catId, name: catName, dishes: [] })
        map.get(catId)!.dishes.push(dish)
      }
      setGroups(Array.from(map.values()))
    } catch { }
    setLoading(false)
  }, [restaurantId])

  useEffect(() => {
    setLoading(true)
    fetchDishes()
  }, [fetchDishes])

  const toggleActive = async (dish: DishLite) => {
    const key = `${dish.id}-isActive`
    setBusy(prev => ({ ...prev, [key]: true }))
    const newValue = !dish.isActive
    // Optimistic update
    setGroups(prev => prev.map(g => ({
      ...g,
      dishes: g.dishes.map(d => d.id === dish.id ? { ...d, isActive: newValue } : d),
    })))
    try {
      await fetch('/api/panel/ecommerce/dishes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, id: dish.id, isActive: newValue }),
      })
    } catch {
      // Revert on error
      setGroups(prev => prev.map(g => ({
        ...g,
        dishes: g.dishes.map(d => d.id === dish.id ? { ...d, isActive: dish.isActive } : d),
      })))
    }
    setBusy(prev => ({ ...prev, [key]: false }))
  }

  const q = search.trim().toLowerCase()
  const filtered: CategoryGroup[] = q
    ? groups.map(g => ({ ...g, dishes: g.dishes.filter(d => d.name.toLowerCase().includes(q)) })).filter(g => g.dishes.length > 0)
    : groups

  return (
    <div className="pos-scroll">
      <div className="pos-pad">
        {title && <p className="pos-inner-title">{title}</p>}
        {/* Search */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ position: 'relative' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar plato…"
              style={{ width: '100%', padding: '10px 12px 10px 34px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--sunk)', fontSize: 14, color: 'var(--ink)', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--sans)' }}
            />
          </div>
        </div>

        {loading ? (
          <div className="pos-empty" style={{ minHeight: 200 }}>
            <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '3px solid var(--line)', borderTopColor: 'var(--amber)' }} />
          </div>
        ) : (
          filtered.map(group => (
            <div key={group.id} style={{ marginBottom: 24 }}>
              {/* Category header */}
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-3)', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--line)' }}>
                {group.name}
              </div>
              {/* Dishes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {group.dishes.map(dish => {
                  const isHidden = !dish.isActive
                  const activeBusy = busy[`${dish.id}-isActive`]
                  return (
                    <div key={dish.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 12px', borderRadius: 10,
                      background: isHidden ? 'rgba(107,114,128,.06)' : 'var(--surface)',
                      border: '1px solid var(--line)',
                      opacity: isHidden ? 0.65 : 1,
                      transition: 'opacity .15s, background .15s',
                    }}>
                      {/* Foto */}
                      <div style={{ width: 44, height: 44, borderRadius: 8, flexShrink: 0, background: 'var(--sunk)', overflow: 'hidden' }}>
                        {dish.photos?.[0]
                          ? <img src={dish.photos[0]} alt={dish.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--ink-3)' }}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                            </div>
                        }
                      </div>
                      {/* Name + price */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {dish.name}
                        </div>
                        <div style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--ink-3)', marginTop: 1 }}>
                          {clp(dish.price)}
                          {isHidden && <span style={{ marginLeft: 8, color: '#6b7280', fontWeight: 700 }}>OCULTO</span>}
                        </div>
                      </div>

                      {/* Toggle: Ocultar */}
                      <button
                        onClick={() => toggleActive(dish)}
                        disabled={activeBusy}
                        title={isHidden ? 'Mostrar en carta' : 'Ocultar de carta'}
                        style={{
                          flexShrink: 0, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--line)',
                          background: isHidden ? '#374151' : 'var(--sunk)',
                          color: isHidden ? '#fff' : 'var(--ink-2)',
                          fontSize: 11, fontWeight: 700, fontFamily: 'var(--sans)',
                          cursor: activeBusy ? 'default' : 'pointer',
                          opacity: activeBusy ? 0.5 : 1,
                          transition: 'background .15s, color .15s',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {activeBusy ? '…' : isHidden ? 'Mostrar' : 'Ocultar'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}

        {!loading && filtered.length === 0 && (
          <div className="pos-empty" style={{ minHeight: 150 }}>
            <p>{q ? 'Sin resultados.' : 'No hay platos.'}</p>
          </div>
        )}
      </div>
    </div>
  )
}
