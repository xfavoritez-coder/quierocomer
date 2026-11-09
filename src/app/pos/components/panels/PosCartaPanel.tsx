'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import type { StorefrontData } from '@/lib/ecommerce/storefront-data'

type Product  = StorefrontData['products'][number]
type Category = StorefrontData['categories'][number]

interface FullCategory { id: string; name: string; position: number; isActive: boolean; _count?: { dishes: number } }
interface DedupOption  { id: string; name: string; code: string | null; price: number; soldOut: boolean }
interface DedupGroup   { id: string; name: string; options: DedupOption[]; products: string[] }

const F = 'var(--sans)'
type PosTab = 'productos' | 'categorias' | 'modificadores'

const clp = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-CL')

const inputSt: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px 9px 34px',
  borderRadius: 10, border: '1px solid var(--line)',
  background: 'var(--sunk)', color: 'var(--ink)', fontFamily: F,
  fontSize: '0.84rem', outline: 'none',
}

// ── FilterChip ─────────────────────────────────────────────────────
function FilterChip({ label, active, onClick, tone }: { label: string; active: boolean; onClick: () => void; tone?: 'warn' | 'hidden' }) {
  const accent = tone === 'hidden' ? '#b45309' : tone === 'warn' ? '#f97316' : 'var(--amber)'
  const bg     = active
    ? tone === 'hidden' ? 'rgba(245,158,11,0.16)' : tone === 'warn' ? 'rgba(249,115,22,0.14)' : 'var(--amber-tint)'
    : 'var(--sunk)'
  return (
    <button onClick={onClick} style={{ padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: F, fontSize: '0.76rem', fontWeight: 700, border: `1px solid ${active ? accent : 'var(--line)'}`, background: bg, color: active ? accent : 'var(--ink-2)' }}>
      {label}
    </button>
  )
}

// ── TabBtn ─────────────────────────────────────────────────────────
function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} style={{ flex: 1, padding: '10px 8px', borderRadius: 0, cursor: 'pointer', fontFamily: F, fontSize: '0.84rem', fontWeight: active ? 700 : 500, border: 'none', borderBottom: `2px solid ${active ? 'var(--amber)' : 'transparent'}`, background: 'transparent', color: active ? 'var(--ink)' : 'var(--ink-3)' }}>
      {label}
    </button>
  )
}


// ── ProductForm (create / edit) ────────────────────────────────────
function ProductForm({ restaurantId, categories, initial, onSave, onCancel }: {
  restaurantId: string
  categories: Category[]
  initial?: { id: string; name: string; price: number; description?: string | null; category_id: string; hidden?: boolean }
  onSave: (p: Partial<Product> & { id: string }) => void
  onCancel: () => void
}) {
  const [name,   setName]   = useState(initial?.name ?? '')
  const [price,  setPrice]  = useState(initial ? String(initial.price) : '')
  const [desc,   setDesc]   = useState(initial?.description ?? '')
  const [catId,  setCatId]  = useState(initial?.category_id ?? (categories[0]?.id ?? ''))
  const [hidden, setHidden] = useState(initial?.hidden ?? false)
  const [busy,   setBusy]   = useState(false)
  const [err,    setErr]    = useState('')

  const isEdit = !!initial

  const handleSubmit = async () => {
    const n = name.trim()
    const p = parseFloat(price)
    if (!n) { setErr('Nombre requerido'); return }
    if (isNaN(p) || p < 0) { setErr('Precio inválido'); return }
    if (!catId) { setErr('Elige una categoría'); return }
    setBusy(true); setErr('')
    try {
      let res: Response
      if (isEdit) {
        res = await fetch(`/api/admin/dishes/${initial.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: n, price: p, description: desc || null, categoryId: catId, isActive: !hidden }),
        })
      } else {
        res = await fetch('/api/admin/dishes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ restaurantId, name: n, price: p, description: desc || null, categoryId: catId }),
        })
      }
      if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(d.error || 'Error al guardar'); setBusy(false); return }
      const saved = await res.json()
      onSave({ id: saved.id ?? initial?.id ?? '', name: n, price: p, description: desc || null, category_id: catId, hidden, is_sold_out: false, ...saved })
    } catch { setErr('Error de conexión') }
    setBusy(false)
  }

  const btn: React.CSSProperties = { padding: '10px 18px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', fontFamily: F }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--amber)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{isEdit ? 'Editar producto' : 'Nuevo producto'}</div>

      <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre *"
        style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--sunk)', color: 'var(--ink)', fontFamily: F, fontSize: '0.88rem', outline: 'none' }} />

      <div style={{ display: 'flex', gap: 8 }}>
        <input value={price} onChange={e => setPrice(e.target.value)} placeholder="Precio *" type="number" min="0"
          style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--sunk)', color: 'var(--ink)', fontFamily: F, fontSize: '0.88rem', outline: 'none' }} />
        <select value={catId} onChange={e => setCatId(e.target.value)}
          style={{ flex: 2, padding: '9px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--sunk)', color: 'var(--ink)', fontFamily: F, fontSize: '0.88rem', outline: 'none', cursor: 'pointer' }}>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descripción (opcional)" rows={2}
        style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--sunk)', color: 'var(--ink)', fontFamily: F, fontSize: '0.84rem', outline: 'none', resize: 'vertical' }} />

      {isEdit && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: F, fontSize: '0.84rem', color: 'var(--ink-2)' }}>
          <input type="checkbox" checked={hidden} onChange={e => setHidden(e.target.checked)} /> Ocultar en la tienda
        </label>
      )}

      {err && <div style={{ color: '#ef4444', fontFamily: F, fontSize: '0.78rem' }}>{err}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleSubmit} disabled={busy} style={{ ...btn, background: 'var(--amber)', color: '#fff', flex: 1, opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Guardando…' : isEdit ? 'Guardar' : 'Agregar'}
        </button>
        <button onClick={onCancel} style={{ ...btn, background: 'var(--sunk)', color: 'var(--ink-2)', border: '1px solid var(--line)' }}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ── ProductRow ─────────────────────────────────────────────────────
function ProductRow({ p, onToggleSoldOut, onToggleDailyBadge, onToggleNewBadge, onEdit, onDelete }: {
  p: Product
  onToggleSoldOut: () => void
  onToggleDailyBadge: () => void
  onToggleNewBadge: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const isHidden   = !!p.hidden
  const isSoldOut  = !!p.is_sold_out
  const isDailyBadge = !!p.daily_badge
  const isNewBadge   = !!p.new_badge
  return (
    <div style={{ background: isSoldOut ? 'rgba(239,68,68,0.04)' : isHidden ? 'var(--sunk)' : 'var(--surface)', border: `1px solid ${isSoldOut ? 'rgba(239,68,68,0.25)' : 'var(--line)'}`, borderRadius: 12, padding: '10px 12px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, opacity: isHidden ? 0.5 : 1 }}>
      {/* Thumb */}
      <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 8, background: 'var(--sunk)', border: '1px solid var(--line)', overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
        {p.image_url
          ? <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
        }
      </div>

      {/* Name + price */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ fontFamily: F, fontSize: '0.88rem', fontWeight: 700, color: isSoldOut ? '#ef4444' : isHidden ? 'var(--ink-3)' : 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
          {isSoldOut && <span style={{ flexShrink: 0, fontFamily: F, fontSize: '0.62rem', fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 4, padding: '1px 5px' }}>AGOTADO</span>}
          {isHidden && !isSoldOut && <span style={{ flexShrink: 0, fontFamily: F, fontSize: '0.62rem', color: 'var(--ink-3)', background: 'var(--sunk)', borderRadius: 4, padding: '1px 5px' }}>oculto</span>}
        </div>
        <div style={{ fontFamily: F, fontSize: '0.74rem', color: 'var(--ink-3)', marginTop: 1 }}>{clp(p.price)}</div>
      </div>

      {/* Cintas */}
      <button onClick={onToggleDailyBadge} title={isDailyBadge ? 'Quitar cinta Solo hoy' : 'Activar cinta Solo hoy'}
        style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 8px', borderRadius: 7, cursor: 'pointer', fontFamily: F, fontSize: '0.69rem', fontWeight: 700, border: `1px solid ${isDailyBadge ? '#f97316' : 'var(--line)'}`, background: isDailyBadge ? 'rgba(249,115,22,0.12)' : 'transparent', color: isDailyBadge ? '#f97316' : 'var(--ink-3)' }}>
        🏷 {isDailyBadge ? 'Solo hoy ✓' : 'Solo hoy'}
      </button>
      <button onClick={onToggleNewBadge} title={isNewBadge ? 'Quitar cinta Nuevo' : 'Activar cinta Nuevo'}
        style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 8px', borderRadius: 7, cursor: 'pointer', fontFamily: F, fontSize: '0.69rem', fontWeight: 700, border: `1px solid ${isNewBadge ? '#16a34a' : 'var(--line)'}`, background: isNewBadge ? 'rgba(22,163,74,0.12)' : 'transparent', color: isNewBadge ? '#16a34a' : 'var(--ink-3)' }}>
        ✨ {isNewBadge ? 'Nuevo ✓' : 'Nuevo'}
      </button>

      {/* Agotar / Disponible */}
      <button onClick={onToggleSoldOut}
        style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', padding: '5px 9px', borderRadius: 7, cursor: 'pointer', fontFamily: F, fontSize: '0.72rem', fontWeight: 700, border: `1px solid ${isSoldOut ? '#ef4444' : 'var(--line)'}`, background: isSoldOut ? 'rgba(239,68,68,0.12)' : 'transparent', color: isSoldOut ? '#ef4444' : 'var(--ink-2)' }}>
        {isSoldOut ? 'Reponer' : 'Agotar'}
      </button>

      {/* Edit */}
      <button onClick={onEdit} title="Editar"
        style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 7, border: '1px solid var(--line)', background: 'var(--sunk)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--ink-2)' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>

      {/* Delete */}
      <button onClick={onDelete} title="Eliminar"
        style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 7, border: '1px solid var(--line)', background: 'var(--sunk)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
      </button>
    </div>
  )
}

// ── ModifierRow ────────────────────────────────────────────────────
function ModifierRow({ opt, onToggleSoldOut }: {
  opt: DedupOption
  onToggleSoldOut: () => void
}) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: F, fontSize: '0.88rem', fontWeight: 700, color: opt.soldOut ? 'var(--ink-3)' : 'var(--ink)', textDecoration: opt.soldOut ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.name}</div>
        {opt.price > 0 && <div style={{ fontFamily: F, fontSize: '0.74rem', color: 'var(--ink-3)', marginTop: 1 }}>+{clp(opt.price)}</div>}
      </div>
      <button onClick={onToggleSoldOut}
        style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', padding: '5px 9px', borderRadius: 7, cursor: 'pointer', fontFamily: F, fontSize: '0.72rem', fontWeight: 700, border: `1px solid ${opt.soldOut ? '#ef4444' : 'var(--line)'}`, background: opt.soldOut ? 'rgba(239,68,68,0.12)' : 'transparent', color: opt.soldOut ? '#ef4444' : 'var(--ink-2)' }}>
        {opt.soldOut ? 'Agotado' : 'Agotar'}
      </button>
    </div>
  )
}

// ── CategoryRow ────────────────────────────────────────────────────
function CategoryRow({ cat, isFirst, isLast, onRename, onDelete, onMoveUp, onMoveDown }: {
  cat: FullCategory
  isFirst: boolean
  isLast: boolean
  onRename: (name: string) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(cat.name)

  const save = () => {
    const n = name.trim()
    if (n && n !== cat.name) onRename(n)
    setEditing(false)
  }

  const iconBtn: React.CSSProperties = { width: 30, height: 30, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--sunk)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--ink-2)', flexShrink: 0 }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px' }}>
      {editing ? (
        <input autoFocus value={name} onChange={e => setName(e.target.value)}
          onBlur={save} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setName(cat.name); setEditing(false) } }}
          style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--amber)', background: 'var(--sunk)', color: 'var(--ink)', fontFamily: F, fontSize: '0.88rem', fontWeight: 700, outline: 'none' }}
        />
      ) : (
        <span style={{ flex: 1, fontFamily: F, fontSize: '0.88rem', fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</span>
      )}
      {cat._count != null && (
        <span style={{ fontFamily: F, fontSize: '0.72rem', color: 'var(--ink-3)', flexShrink: 0 }}>{cat._count.dishes} platos</span>
      )}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button onClick={() => setEditing(true)} title="Renombrar" style={iconBtn}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button onClick={onMoveUp} disabled={isFirst} title="Subir" style={{ ...iconBtn, opacity: isFirst ? 0.3 : 1 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 15l-6-6-6 6"/></svg>
        </button>
        <button onClick={onMoveDown} disabled={isLast} title="Bajar" style={{ ...iconBtn, opacity: isLast ? 0.3 : 1 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <button onClick={onDelete} title="Eliminar" style={{ ...iconBtn, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
        </button>
      </div>
    </div>
  )
}

// ── Main panel ─────────────────────────────────────────────────────
export default function PosCartaPanel({ restaurantId, title, onBack }: { restaurantId: string; title?: string; onBack?: () => void; onDone?: () => void }) {
  const [data,       setData]       = useState<StorefrontData | null>(null)
  const [fullCats,   setFullCats]   = useState<FullCategory[]>([])
  const [loading,    setLoading]    = useState(true)
  const [tab,        setTab]        = useState<PosTab>('productos')
  const [search,     setSearch]     = useState('')
  const [only,       setOnly]       = useState<'all' | 'hidden' | 'nocode'>('all')

  // Product form state
  const [addingProduct,  setAddingProduct]  = useState(false)
  const [editingProdId,  setEditingProdId]  = useState<string | null>(null)

  // Category form state
  const [newCatName, setNewCatName] = useState('')
  const [savingCat,  setSavingCat]  = useState(false)

  // Load menu
  const loadMenu = useCallback(() => {
    if (!restaurantId) return
    setLoading(true)
    fetch(`/api/panel/ecommerce/menu?restaurantId=${restaurantId}&includeHidden=1`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [restaurantId])

  useEffect(() => { loadMenu() }, [loadMenu])

  // Load full categories (with counts)
  const loadCategories = useCallback(() => {
    if (!restaurantId) return
    fetch(`/api/admin/categories?restaurantId=${restaurantId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (Array.isArray(d)) setFullCats(d) })
      .catch(() => {})
  }, [restaurantId])

  useEffect(() => { loadCategories() }, [loadCategories])



  const toggleHidden = useCallback(async (id: string, nextHidden: boolean) => {
    setData(d => d ? { ...d, products: d.products.map(p => p.id === id ? { ...p, hidden: nextHidden } : p) } : d)
    try {
      const res = await fetch(`/api/admin/dishes/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !nextHidden }) })
      if (!res.ok) setData(d => d ? { ...d, products: d.products.map(p => p.id === id ? { ...p, hidden: !nextHidden } : p) } : d)
    } catch { setData(d => d ? { ...d, products: d.products.map(p => p.id === id ? { ...p, hidden: !nextHidden } : p) } : d) }
  }, [])

  const toggleDishSoldOut = useCallback(async (id: string, next: boolean) => {
    setData(d => d ? { ...d, products: d.products.map(p => p.id === id ? { ...p, is_sold_out: next } : p) } : d)
    try {
      const res = await fetch(`/api/admin/dishes/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ soldOut: next }) })
      if (!res.ok) setData(d => d ? { ...d, products: d.products.map(p => p.id === id ? { ...p, is_sold_out: !next } : p) } : d)
    } catch { setData(d => d ? { ...d, products: d.products.map(p => p.id === id ? { ...p, is_sold_out: !next } : p) } : d) }
  }, [])

  const toggleDailyBadge = useCallback(async (id: string, next: boolean) => {
    setData(d => d ? { ...d, products: d.products.map(p => p.id === id ? { ...p, daily_badge: next } : p) } : d)
    try {
      const res = await fetch(`/api/admin/dishes/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dailyBadge: next }) })
      if (!res.ok) setData(d => d ? { ...d, products: d.products.map(p => p.id === id ? { ...p, daily_badge: !next } : p) } : d)
    } catch { setData(d => d ? { ...d, products: d.products.map(p => p.id === id ? { ...p, daily_badge: !next } : p) } : d) }
  }, [])

  const toggleNewBadge = useCallback(async (id: string, next: boolean) => {
    setData(d => d ? { ...d, products: d.products.map(p => p.id === id ? { ...p, new_badge: next } : p) } : d)
    try {
      const res = await fetch(`/api/admin/dishes/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newBadge: next }) })
      if (!res.ok) setData(d => d ? { ...d, products: d.products.map(p => p.id === id ? { ...p, new_badge: !next } : p) } : d)
    } catch { setData(d => d ? { ...d, products: d.products.map(p => p.id === id ? { ...p, new_badge: !next } : p) } : d) }
  }, [])

  const toggleModSoldOut = useCallback(async (id: string, next: boolean) => {
    const apply = (val: boolean) => setData(d => d ? {
      ...d,
      products: d.products.map(p => ({ ...p, option_groups: (p.option_groups ?? []).map(g => ({ ...g, values: g.values.map(v => v.id === id ? { ...v, is_sold_out: val } : v) })) })),
    } : d)
    apply(next)
    try {
      const res = await fetch(`/api/admin/modifiers/${id}/sold-out`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ soldOut: next }) })
      if (!res.ok) apply(!next)
    } catch { apply(!next) }
  }, [])


  const handleProductSaved = useCallback((saved: Partial<Product> & { id: string }) => {
    setData(d => {
      if (!d) return d
      const exists = d.products.some(p => p.id === saved.id)
      if (exists) {
        return { ...d, products: d.products.map(p => p.id === saved.id ? { ...p, ...saved } : p) }
      } else {
        return { ...d, products: [...d.products, saved as Product] }
      }
    })
    setAddingProduct(false)
    setEditingProdId(null)
    loadCategories()
  }, [loadCategories])

  const handleDeleteProduct = useCallback(async (id: string) => {
    if (!confirm('¿Eliminar este producto?')) return
    setData(d => d ? { ...d, products: d.products.filter(p => p.id !== id) } : d)
    try {
      await fetch(`/api/admin/dishes/${id}`, { method: 'DELETE' })
    } catch { loadMenu() }
    loadCategories()
  }, [loadMenu, loadCategories])

  // Category handlers
  const handleAddCategory = async () => {
    const n = newCatName.trim()
    if (!n) return
    setSavingCat(true)
    try {
      const res = await fetch('/api/admin/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ restaurantId, name: n }) })
      if (res.ok) { setNewCatName(''); loadCategories(); loadMenu() }
    } catch { /* noop */ }
    setSavingCat(false)
  }

  const handleRenameCategory = useCallback(async (id: string, name: string) => {
    setFullCats(cs => cs.map(c => c.id === id ? { ...c, name } : c))
    try {
      await fetch('/api/admin/categories', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, name }) })
    } catch { loadCategories() }
    loadMenu()
  }, [loadCategories, loadMenu])

  const handleDeleteCategory = useCallback(async (id: string) => {
    const cat = fullCats.find(c => c.id === id)
    const count = cat?._count?.dishes ?? 0
    if (count > 0) { alert(`Esta categoría tiene ${count} platos. Mueve o elimina los platos primero.`); return }
    if (!confirm('¿Eliminar esta categoría?')) return
    setFullCats(cs => cs.filter(c => c.id !== id))
    try {
      await fetch(`/api/admin/categories?id=${id}`, { method: 'DELETE' })
    } catch { loadCategories() }
  }, [fullCats, loadCategories])

  const handleMoveCategory = useCallback(async (id: string, dir: 'up' | 'down') => {
    setFullCats(cs => {
      const idx = cs.findIndex(c => c.id === id)
      if (idx < 0) return cs
      const newIdx = dir === 'up' ? idx - 1 : idx + 1
      if (newIdx < 0 || newIdx >= cs.length) return cs
      const next = [...cs]
      ;[next[idx], next[newIdx]] = [next[newIdx], next[idx]]
      const updated = next.map((c, i) => ({ ...c, position: i }))
      // persist reorder
      fetch('/api/admin/categories/reorder', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, order: updated.map(c => c.id) }),
      }).catch(() => {})
      return updated
    })
  }, [restaurantId])


  const products   = data?.products   ?? []
  const categories = data?.categories ?? []

  const dedupGroups = useMemo<DedupGroup[]>(() => {
    const map = new Map<string, DedupGroup>()
    for (const p of products) {
      for (const g of p.option_groups ?? []) {
        let grp = map.get(g.id)
        if (!grp) { grp = { id: g.id, name: g.name, options: [], products: [] }; map.set(g.id, grp) }
        if (p.name && !grp.products.includes(p.name)) grp.products.push(p.name)
        for (const v of g.values) {
          if (!grp.options.some(o => o.id === v.id)) grp.options.push({ id: v.id, name: v.name, code: v.toteat_modifier_code, price: v.price_delta, soldOut: v.is_sold_out === true })
        }
      }
    }
    return [...map.values()]
  }, [products])

  const prodTotal    = products.length
  const modOptions   = dedupGroups.flatMap(g => g.options)
  const modTotal     = modOptions.length
  const q            = search.trim().toLowerCase()
  const hiddenCount  = products.filter(p => p.hidden).length

  let filteredProducts = q ? products.filter(p => p.name.toLowerCase().includes(q) || (p.toteat_code ?? '').toLowerCase().includes(q)) : products
  if (only === 'hidden')  filteredProducts = filteredProducts.filter(p => p.hidden)
  else if (only === 'nocode') filteredProducts = filteredProducts.filter(p => !p.toteat_code)

  const filteredGroups = q
    ? dedupGroups.map(g => ({ ...g, options: g.options.filter(o => o.name.toLowerCase().includes(q)) })).filter(g => g.options.length)
    : dedupGroups

  const editingProd = editingProdId ? products.find(p => p.id === editingProdId) : null

  return (
    <div className="pos-scroll">
      <div style={{ maxWidth: 680, margin: '0 auto', width: '100%', padding: '20px 16px 60px' }}>

        {/* Title row */}
        {title && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            {onBack && (
              <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--sunk)', cursor: 'pointer', color: 'var(--ink-2)', fontFamily: F, fontSize: '0.82rem', fontWeight: 600, flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
            )}
            <p className="pos-inner-title" style={{ margin: 0, flex: 1 }}>{title}</p>
            {tab === 'productos' && !addingProduct && (
              <button onClick={() => { setAddingProduct(true); setEditingProdId(null) }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, border: 'none', background: 'var(--amber)', color: '#fff', fontFamily: F, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                Nuevo
              </button>
            )}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--line)', marginBottom: 20 }}>
          <TabBtn active={tab === 'productos'}    onClick={() => { setTab('productos');    setSearch(''); setOnly('all'); setAddingProduct(false); setEditingProdId(null) }} label={`Productos${prodTotal ? ` (${prodTotal})` : ''}`} />
          <TabBtn active={tab === 'categorias'}   onClick={() => { setTab('categorias');   setSearch(''); setOnly('all') }} label={`Categorías${fullCats.length ? ` (${fullCats.length})` : ''}`} />
          <TabBtn active={tab === 'modificadores'} onClick={() => { setTab('modificadores'); setSearch(''); setOnly('all') }} label={`Modificadores${modTotal ? ` (${modTotal})` : ''}`} />
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '48px 0', color: 'var(--ink-3)', fontFamily: F, fontSize: '0.84rem' }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2.5px solid var(--line)', borderTopColor: 'var(--amber)', animation: 'spin 1s linear infinite' }} />
            Cargando…
          </div>
        ) : (
          <>
            {/* ── PRODUCTOS ── */}
            {tab === 'productos' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Add product form */}
                {addingProduct && (
                  <ProductForm restaurantId={restaurantId} categories={categories}
                    onSave={handleProductSaved} onCancel={() => setAddingProduct(false)} />
                )}

                {prodTotal === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 20px', border: '1px dashed var(--line)', borderRadius: 14, fontFamily: F, color: 'var(--ink-3)' }}>No hay productos. Crea uno arriba.</div>
                ) : (
                  <>
                    {/* Search */}
                    <div style={{ position: 'relative' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar producto o código…" style={inputSt} />
                    </div>

                    {/* Filter chips */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <FilterChip label="Todos"  active={only === 'all'}    onClick={() => setOnly('all')} />
                      <FilterChip label={`Ocultos${hiddenCount ? ` (${hiddenCount})` : ''}`} active={only === 'hidden'} onClick={() => setOnly(only === 'hidden' ? 'all' : 'hidden')} tone="hidden" />
                    </div>


                    {(q ? [{ id: '_all', name: '', position: 0 }] : categories).map(cat => {
                      const catProds = q ? filteredProducts : filteredProducts.filter(p => p.category_id === cat.id)
                      if (!catProds.length) return null
                      return (
                        <div key={cat.id}>
                          {!q && <div style={{ fontFamily: F, fontSize: '0.76rem', fontWeight: 800, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>{cat.name}</div>}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {catProds.map(p => (
                              editingProdId === p.id ? (
                                <ProductForm key={p.id} restaurantId={restaurantId} categories={categories}
                                  initial={{ id: p.id, name: p.name, price: p.price, description: p.description, category_id: p.category_id, hidden: p.hidden }}
                                  onSave={handleProductSaved} onCancel={() => setEditingProdId(null)} />
                              ) : (
                                <ProductRow key={p.id} p={p}
                                  onToggleSoldOut={() => toggleDishSoldOut(p.id, !p.is_sold_out)}
                                  onToggleDailyBadge={() => toggleDailyBadge(p.id, !p.daily_badge)}
                                  onToggleNewBadge={() => toggleNewBadge(p.id, !p.new_badge)}
                                  onEdit={() => { setEditingProdId(p.id); setAddingProduct(false) }}
                                  onDelete={() => handleDeleteProduct(p.id)} />
                              )
                            ))}
                          </div>
                        </div>
                      )
                    })}

                    {filteredProducts.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '32px 20px', border: '1px dashed var(--line)', borderRadius: 14, fontFamily: F, color: 'var(--ink-3)' }}>
                        {only === 'hidden' ? 'No hay productos ocultos.' : only === 'nocode' ? 'Todos los productos tienen código. 🎉' : 'No hay productos que coincidan.'}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── CATEGORÍAS ── */}
            {tab === 'categorias' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Add category */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                    placeholder="Nueva categoría…"
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--sunk)', color: 'var(--ink)', fontFamily: F, fontSize: '0.88rem', outline: 'none' }}
                  />
                  <button onClick={handleAddCategory} disabled={!newCatName.trim() || savingCat}
                    style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: 'var(--amber)', color: '#fff', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', fontFamily: F, opacity: !newCatName.trim() ? 0.5 : 1 }}>
                    Agregar
                  </button>
                </div>

                {fullCats.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 20px', border: '1px dashed var(--line)', borderRadius: 14, fontFamily: F, color: 'var(--ink-3)' }}>Sin categorías.</div>
                ) : (
                  fullCats.map((cat, i) => (
                    <CategoryRow key={cat.id} cat={cat}
                      isFirst={i === 0} isLast={i === fullCats.length - 1}
                      onRename={name => handleRenameCategory(cat.id, name)}
                      onDelete={() => handleDeleteCategory(cat.id)}
                      onMoveUp={() => handleMoveCategory(cat.id, 'up')}
                      onMoveDown={() => handleMoveCategory(cat.id, 'down')}
                    />
                  ))
                )}
              </div>
            )}

            {/* ── MODIFICADORES ── */}
            {tab === 'modificadores' && (
              modTotal === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 20px', border: '1px dashed var(--line)', borderRadius: 14, fontFamily: F, color: 'var(--ink-3)' }}>Los productos no tienen modificadores.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Search */}
                  <div style={{ position: 'relative' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar modificador o código…" style={inputSt} />
                  </div>


                  {filteredGroups.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '32px 20px', border: '1px dashed var(--line)', borderRadius: 14, fontFamily: F, color: 'var(--ink-3)' }}>
                      No hay modificadores que coincidan.
                    </div>
                  )}

                  {filteredGroups.map(g => (
                    <div key={g.id}>
                      <div style={{ fontFamily: F, fontSize: '0.76rem', fontWeight: 800, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>{g.name}</div>
                      {g.products.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                          {g.products.map(pn => (
                            <span key={pn} style={{ fontFamily: F, fontSize: '0.72rem', fontWeight: 600, color: 'var(--ink-2)', background: 'var(--sunk)', border: '1px solid var(--line)', borderRadius: 999, padding: '3px 9px' }}>{pn}</span>
                          ))}
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {g.options.map(o => (
                          <ModifierRow key={o.id} opt={o}
                            onToggleSoldOut={() => toggleModSoldOut(o.id, !o.soldOut)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </>
        )}
      </div>
    </div>
  )
}
