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
  description?: string | null
  category: { id: string; name: string } | null
}

interface CategoryGroup {
  id: string
  name: string
  dishes: DishLite[]
}

const clp = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')

function Toggle({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{ flexShrink: 0, width: 48, height: 28, borderRadius: 999, border: 'none', cursor: disabled ? 'default' : 'pointer', background: checked ? 'var(--amber)' : 'var(--line)', position: 'relative', transition: 'background .2s', opacity: disabled ? 0.5 : 1 }}
    >
      <span style={{ position: 'absolute', top: 3, left: checked ? 23 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
    </button>
  )
}

export default function PosCartaPanel({ restaurantId, title, onDone }: { restaurantId: string; title?: string; onDone?: () => void }) {
  const [groups, setGroups] = useState<CategoryGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const [editDish, setEditDish] = useState<DishLite | null>(null)
  const [editPrice, setEditPrice] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editSoldOut, setEditSoldOut] = useState(false)
  const [editActive, setEditActive] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchDishes = useCallback(async () => {
    if (!restaurantId) return
    try {
      const r = await fetch(`/api/panel/ecommerce/dishes?restaurantId=${restaurantId}`, { cache: 'no-store' })
      const d = await r.json()
      if (!r.ok || !Array.isArray(d)) return
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

  const openEdit = (dish: DishLite) => {
    setEditDish(dish)
    setEditPrice(String(Math.round(dish.price)))
    setEditDesc(dish.description ?? '')
    setEditSoldOut(dish.soldOut)
    setEditActive(dish.isActive)
  }

  const closeEdit = () => setEditDish(null)

  const toggleActive = async (dish: DishLite) => {
    const key = `${dish.id}-isActive`
    setBusy(prev => ({ ...prev, [key]: true }))
    const newValue = !dish.isActive
    setGroups(prev => prev.map(g => ({ ...g, dishes: g.dishes.map(d => d.id === dish.id ? { ...d, isActive: newValue } : d) })))
    try {
      await fetch('/api/panel/ecommerce/dishes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, id: dish.id, isActive: newValue }),
      })
    } catch {
      setGroups(prev => prev.map(g => ({ ...g, dishes: g.dishes.map(d => d.id === dish.id ? { ...d, isActive: dish.isActive } : d) })))
    }
    setBusy(prev => ({ ...prev, [key]: false }))
  }

  const saveEdit = async () => {
    if (!editDish) return
    const price = parseFloat(editPrice.replace(/[^0-9.]/g, ''))
    if (isNaN(price) || price < 0) return
    setSaving(true)
    const patch = {
      restaurantId,
      id: editDish.id,
      price,
      description: editDesc.trim() || null,
      soldOut: editSoldOut,
      isActive: editActive,
    }
    try {
      const r = await fetch('/api/panel/ecommerce/dishes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (r.ok) {
        setGroups(prev => prev.map(g => ({
          ...g,
          dishes: g.dishes.map(d => d.id === editDish.id
            ? { ...d, price, description: editDesc.trim() || null, soldOut: editSoldOut, isActive: editActive }
            : d),
        })))
        closeEdit()
      }
    } catch { /* noop */ }
    setSaving(false)
  }

  const q = search.trim().toLowerCase()
  const filtered: CategoryGroup[] = q
    ? groups.map(g => ({ ...g, dishes: g.dishes.filter(d => d.name.toLowerCase().includes(q)) })).filter(g => g.dishes.length > 0)
    : groups

  return (
    <>
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
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-3)', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--line)' }}>
                  {group.name}
                </div>
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
                          <div style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--ink-3)', marginTop: 1, display: 'flex', gap: 8, alignItems: 'center' }}>
                            {clp(dish.price)}
                            {dish.soldOut && <span style={{ color: '#e05252', fontWeight: 700 }}>AGOTADO</span>}
                            {isHidden && <span style={{ color: '#6b7280', fontWeight: 700 }}>OCULTO</span>}
                          </div>
                        </div>

                        {/* Edit button */}
                        <button
                          onClick={() => openEdit(dish)}
                          title="Editar plato"
                          style={{
                            flexShrink: 0, width: 32, height: 32, borderRadius: 8,
                            border: '1px solid var(--line)', background: 'transparent',
                            color: 'var(--ink-3)', cursor: 'pointer', display: 'grid', placeItems: 'center',
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>

                        {/* Toggle: Ocultar */}
                        <button
                          onClick={() => toggleActive(dish)}
                          disabled={activeBusy}
                          title={isHidden ? 'Mostrar en carta' : 'Ocultar de carta'}
                          style={{
                            flexShrink: 0, padding: '6px 10px', borderRadius: 8,
                            border: isHidden ? '1px solid #16a34a' : '1px solid var(--line)',
                            background: isHidden ? '#16a34a' : 'transparent',
                            color: isHidden ? '#fff' : 'var(--ink-3)',
                            fontSize: 11, fontWeight: 700, fontFamily: 'var(--sans)',
                            cursor: activeBusy ? 'default' : 'pointer',
                            opacity: activeBusy ? 0.5 : 1,
                            transition: 'background .15s, color .15s, border-color .15s',
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

      {/* ── Edit sheet ── */}
      {editDish && (
        <>
          <div
            onClick={closeEdit}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, backdropFilter: 'blur(2px)' }}
          />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
            background: 'var(--surface)', borderRadius: '20px 20px 0 0',
            boxShadow: '0 -4px 32px rgba(0,0,0,.18)',
            padding: '0 0 env(safe-area-inset-bottom)',
            maxHeight: '85dvh', display: 'flex', flexDirection: 'column',
          }}>
            {/* Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--line)' }} />
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: '0 20px 32px' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, paddingTop: 4 }}>
                <div style={{ width: 48, height: 48, borderRadius: 10, flexShrink: 0, background: 'var(--sunk)', overflow: 'hidden' }}>
                  {editDish.photos?.[0]
                    ? <img src={editDish.photos[0]} alt={editDish.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--ink-3)' }}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                      </div>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{editDish.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{editDish.category?.name ?? 'Sin categoría'}</div>
                </div>
                <button onClick={closeEdit} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink-3)', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>

              {/* Price */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>Precio</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--ink-3)', pointerEvents: 'none' }}>$</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editPrice}
                    onChange={e => setEditPrice(e.target.value)}
                    style={{ width: '100%', padding: '12px 12px 12px 26px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--sunk)', fontSize: 15, fontFamily: 'var(--mono)', color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>Descripción</label>
                <textarea
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  rows={3}
                  placeholder="Descripción breve del plato…"
                  style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--sunk)', fontSize: 14, fontFamily: 'var(--sans)', color: 'var(--ink)', outline: 'none', boxSizing: 'border-box', resize: 'none', lineHeight: 1.5 }}
                />
              </div>

              {/* Toggles */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--sunk)', border: `1px solid ${editActive ? 'var(--line)' : 'var(--amber)'}`, borderRadius: 14, padding: '14px 16px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--ink)' }}>Visible en carta</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--ink-2)', lineHeight: 1.5, marginTop: 3 }}>El plato aparece en la carta del ecommerce y el POS.</div>
                  </div>
                  <Toggle checked={editActive} onChange={setEditActive} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--sunk)', border: `1px solid ${editSoldOut ? 'var(--amber)' : 'var(--line)'}`, borderRadius: 14, padding: '14px 16px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--ink)' }}>Agotado</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--ink-2)', lineHeight: 1.5, marginTop: 3 }}>El plato se muestra como no disponible. Se puede reactivar cuando vuelva a estar disponible.</div>
                  </div>
                  <Toggle checked={editSoldOut} onChange={setEditSoldOut} />
                </div>
              </div>

              {/* Save */}
              <button
                onClick={saveEdit}
                disabled={saving}
                style={{ width: '100%', padding: '16px', borderRadius: 14, border: 'none', background: 'var(--amber)', color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
