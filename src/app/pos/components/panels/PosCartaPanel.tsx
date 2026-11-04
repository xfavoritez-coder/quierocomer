'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import type { StorefrontData } from '@/lib/ecommerce/storefront-data'

type Product = StorefrontData['products'][number]
interface DedupOption { id: string; name: string; code: string | null; price: number; soldOut: boolean }
interface DedupGroup  { id: string; name: string; options: DedupOption[]; products: string[] }

const F    = 'var(--sans)'
const MONO = 'var(--mono)'
const GREEN = '#16a34a'

const clp = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-CL')

// ── Shared style tokens ────────────────────────────────────────────
const inputSt: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px 9px 34px',
  borderRadius: 10, border: '1px solid var(--line)',
  background: 'var(--sunk)', color: 'var(--ink)', fontFamily: F,
  fontSize: '0.84rem', outline: 'none',
}

// ── FilterChip ────────────────────────────────────────────────────
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

// ── TabBtn ────────────────────────────────────────────────────────
function TabBtn({ active, onClick, label, count, done }: { active: boolean; onClick: () => void; label: string; count: string; done: boolean }) {
  return (
    <button onClick={onClick} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px', borderRadius: 10, cursor: 'pointer', fontFamily: F, fontSize: '0.82rem', fontWeight: 700, border: `1px solid ${active ? 'var(--amber)' : 'var(--line)'}`, background: active ? 'var(--amber)' : 'var(--sunk)', color: active ? '#fff' : 'var(--ink-2)' }}>
      {label}
      <span style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.75, color: done && !active ? GREEN : undefined }}>{count}</span>
    </button>
  )
}

// ── CodeInput ─────────────────────────────────────────────────────
function CodeInput({ initial, endpoint, onValue }: { initial: string | null; endpoint: string; onValue?: (v: string) => void }) {
  const [value, setValue] = useState(initial ?? '')
  const [saved, setSaved] = useState<string>(initial ?? '')
  const [busy,  setBusy]  = useState(false)
  const [ok,    setOk]    = useState(false)

  const save = useCallback(async () => {
    const v = value.trim()
    if (v === saved) return
    setBusy(true); setOk(false)
    try {
      const res = await fetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toteatProductId: v || null }) })
      if (!res.ok) { setBusy(false); return }
      setSaved(v); setOk(true); setTimeout(() => setOk(false), 1500)
    } catch { /* noop */ }
    setBusy(false)
  }, [value, saved, endpoint])

  const dirty = value.trim() !== saved
  return (
    <div style={{ position: 'relative', flexShrink: 0, width: 140 }}>
      <input
        value={value}
        onChange={e => { setValue(e.target.value); onValue?.(e.target.value) }}
        onBlur={save}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        placeholder="Código POS"
        style={{ width: '100%', boxSizing: 'border-box', padding: '7px 24px 7px 9px', borderRadius: 8, border: `1px solid ${dirty ? 'var(--amber)' : saved ? GREEN + '66' : 'var(--line)'}`, background: 'var(--sunk)', color: 'var(--ink)', fontFamily: MONO, fontSize: '0.78rem', outline: 'none' }}
      />
      <span style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', fontSize: '0.7rem' }}>
        {busy ? '…' : ok ? <span style={{ color: GREEN }}>✓</span> : saved ? <span style={{ color: GREEN + '99' }}>✓</span> : null}
      </span>
    </div>
  )
}

// ── ProductRow ────────────────────────────────────────────────────
function ProductRow({ p, toteatMap, bannerIds, bannerMax, onToggleSoldOut, onToggleBanner }: {
  p: Product
  toteatMap: Record<string, { name: string; price: number }> | null
  bannerIds: string[]
  bannerMax: number
  onToggleSoldOut: () => void
  onToggleBanner: () => void
}) {
  const [code, setCode] = useState(p.toteat_code ?? '')
  const norm = code.trim().toUpperCase()
  const tInfo = toteatMap && norm ? toteatMap[norm] : undefined
  const showToteat = !!toteatMap && norm.length > 0
  const priceMismatch = tInfo != null && Math.round(tInfo.price) !== Math.round(p.price)
  const inBanner = bannerIds.includes(p.id)
  const bannerFull = !inBanner && bannerIds.length >= bannerMax

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Star */}
        <button
          onClick={bannerFull ? undefined : onToggleBanner}
          title={inBanner ? 'Quitar del banner' : bannerFull ? 'Máx. 5 en banner' : 'Destacar en banner'}
          style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent', cursor: bannerFull ? 'not-allowed' : 'pointer', display: 'grid', placeItems: 'center', opacity: bannerFull ? 0.3 : 1, fontSize: '1rem' }}
        >
          {inBanner ? '⭐' : '☆'}
        </button>

        {/* Name + badges */}
        <span style={{ flex: 1, minWidth: 0, display: 'inline-flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
          <span style={{ minWidth: 0, fontFamily: F, fontSize: '0.88rem', fontWeight: 700, color: p.is_sold_out ? 'var(--ink-3)' : 'var(--ink)', textDecoration: p.is_sold_out ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
          {p.hidden && (
            <span style={{ flexShrink: 0, fontFamily: F, fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', color: '#b45309', background: 'rgba(245,158,11,0.16)', border: '1px solid rgba(245,158,11,0.35)', padding: '2px 6px', borderRadius: 999 }}>Oculto</span>
          )}
        </span>

        {/* Agotado btn */}
        <button
          onClick={onToggleSoldOut}
          style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 9px', borderRadius: 7, cursor: 'pointer', fontFamily: F, fontSize: '0.72rem', fontWeight: 700, border: `1px solid ${p.is_sold_out ? '#ef4444' : 'var(--line)'}`, background: p.is_sold_out ? 'rgba(239,68,68,0.12)' : 'transparent', color: p.is_sold_out ? '#ef4444' : 'var(--ink-2)' }}
        >
          {p.is_sold_out ? 'Agotado' : 'Agotar'}
        </button>

        {/* Code */}
        <CodeInput initial={p.toteat_code} endpoint={`/api/admin/dishes/${p.id}/map-toteat`} onValue={setCode} />
      </div>

      {/* Price row */}
      <div style={{ paddingLeft: 36, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontFamily: F, fontSize: '0.72rem', lineHeight: 1.3 }}>
        <span style={{ color: 'var(--ink-2)' }}>QuieroComer: <strong style={{ color: 'var(--ink)' }}>{clp(p.price)}</strong></span>
        {showToteat && tInfo != null && (
          <span style={{ color: priceMismatch ? '#f97316' : 'var(--ink-2)' }}>POS: <strong style={{ color: priceMismatch ? '#f97316' : 'var(--ink)' }}>{clp(tInfo.price)}</strong>{priceMismatch ? ' ⚠ distinto' : ''}</span>
        )}
        {showToteat && tInfo == null && (
          <span style={{ color: '#f97316' }}>⚠ Código no existe en Toteat</span>
        )}
        {showToteat && tInfo != null && tInfo.name && (
          <span style={{ color: GREEN }}>Toteat: <strong style={{ color: 'var(--ink)' }}>{tInfo.name}</strong></span>
        )}
      </div>
    </div>
  )
}

// ── ModifierRow ───────────────────────────────────────────────────
function ModifierRow({ opt, toteatMap, onToggleSoldOut }: {
  opt: DedupOption
  toteatMap: Record<string, { name: string; price: number }> | null
  onToggleSoldOut: () => void
}) {
  const [code, setCode] = useState(opt.code ?? '')
  const norm = code.trim().toUpperCase()
  const tInfo = toteatMap && norm ? toteatMap[norm] : undefined
  const showToteat = !!toteatMap && norm.length > 0
  const priceMismatch = tInfo != null && opt.price != null && Math.round(tInfo.price) !== Math.round(opt.price)

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1, minWidth: 0, fontFamily: F, fontSize: '0.88rem', fontWeight: 700, color: opt.soldOut ? 'var(--ink-3)' : 'var(--ink)', textDecoration: opt.soldOut ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.name}</span>
        <button
          onClick={onToggleSoldOut}
          style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 9px', borderRadius: 7, cursor: 'pointer', fontFamily: F, fontSize: '0.72rem', fontWeight: 700, border: `1px solid ${opt.soldOut ? '#ef4444' : 'var(--line)'}`, background: opt.soldOut ? 'rgba(239,68,68,0.12)' : 'transparent', color: opt.soldOut ? '#ef4444' : 'var(--ink-2)' }}
        >
          {opt.soldOut ? 'Agotado' : 'Agotar'}
        </button>
        <CodeInput initial={opt.code} endpoint={`/api/admin/modifiers/${opt.id}/map-toteat`} onValue={setCode} />
      </div>

      {opt.price > 0 && (
        <div style={{ fontFamily: F, fontSize: '0.72rem', color: 'var(--ink-2)' }}>
          Precio extra: <strong style={{ color: 'var(--ink)' }}>{clp(opt.price)}</strong>
          {showToteat && tInfo != null && (
            <span style={{ marginLeft: 12, color: priceMismatch ? '#f97316' : 'var(--ink-2)' }}>POS: <strong>{clp(tInfo.price)}</strong>{priceMismatch ? ' ⚠' : ''}</span>
          )}
        </div>
      )}
      {showToteat && tInfo == null && <span style={{ fontFamily: F, fontSize: '0.72rem', color: '#f97316' }}>⚠ Código no existe en Toteat</span>}
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────
export default function PosCartaPanel({ restaurantId, title }: { restaurantId: string; title?: string; onDone?: () => void }) {
  const [data,       setData]       = useState<StorefrontData | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [tab,        setTab]        = useState<'productos' | 'modificadores'>('productos')
  const [search,     setSearch]     = useState('')
  const [only,       setOnly]       = useState<'all' | 'hidden' | 'nocode'>('all')
  const [bannerIds,  setBannerIds]  = useState<string[]>([])
  const [brandSlug,  setBrandSlug]  = useState<string | null>(null)
  const [copyBusy,   setCopyBusy]   = useState(false)
  const [copyMsg,    setCopyMsg]    = useState('')
  const cfgRef = useRef<Record<string, unknown>>({})
  const BANNER_MAX = 5

  const [toteatMap, setToteatMap] = useState<Record<string, { name: string; price: number }> | null>(null)

  // Load menu
  useEffect(() => {
    if (!restaurantId) return
    setLoading(true)
    fetch(`/api/panel/ecommerce/menu?restaurantId=${restaurantId}&includeHidden=1`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [restaurantId])

  // Load settings (brandSlug + bannerIds)
  useEffect(() => {
    if (!restaurantId) return
    fetch(`/api/panel/ecommerce/settings?restaurantId=${restaurantId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.config) {
          cfgRef.current = d.config
          setBrandSlug(d.config.brandSlug ?? null)
          setBannerIds(Array.isArray(d.config.bannerProductIds) ? d.config.bannerProductIds : [])
        }
      })
      .catch(() => {})
  }, [restaurantId])

  // Load Toteat catalog
  useEffect(() => {
    if (!restaurantId) return
    fetch(`/api/panel/ecommerce/toteat-catalog?restaurantId=${restaurantId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.map && Object.keys(d.map).length) setToteatMap(d.map); else setToteatMap(null) })
      .catch(() => setToteatMap(null))
  }, [restaurantId])

  const toggleSoldOut = useCallback(async (id: string, next: boolean) => {
    setData(d => d ? { ...d, products: d.products.map(p => p.id === id ? { ...p, is_sold_out: next } : p) } : d)
    try {
      const res = await fetch(`/api/admin/dishes/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ soldOut: next }) })
      if (!res.ok) setData(d => d ? { ...d, products: d.products.map(p => p.id === id ? { ...p, is_sold_out: !next } : p) } : d)
    } catch { setData(d => d ? { ...d, products: d.products.map(p => p.id === id ? { ...p, is_sold_out: !next } : p) } : d) }
  }, [])

  const toggleModSoldOut = useCallback(async (id: string, next: boolean) => {
    const apply = (val: boolean) => setData(d => d ? {
      ...d,
      products: d.products.map(p => ({
        ...p,
        option_groups: (p.option_groups ?? []).map(g => ({
          ...g,
          values: g.values.map(v => v.id === id ? { ...v, is_sold_out: val } : v),
        })),
      })),
    } : d)
    apply(next)
    try {
      const res = await fetch(`/api/admin/modifiers/${id}/sold-out`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ soldOut: next }) })
      if (!res.ok) apply(!next)
    } catch { apply(!next) }
  }, [])

  const toggleBanner = useCallback((id: string) => {
    setBannerIds(prev => {
      const has = prev.includes(id)
      if (!has && prev.length >= BANNER_MAX) return prev
      const next = has ? prev.filter(x => x !== id) : [...prev, id]
      const cfg = { ...cfgRef.current, bannerProductIds: next }
      cfgRef.current = cfg
      fetch('/api/panel/ecommerce/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ restaurantId, config: cfg }) }).catch(() => {})
      return next
    })
  }, [restaurantId])

  const copyToBranches = async () => {
    if (!restaurantId || copyBusy) return
    if (!confirm('¿Copiar esta carta a TODAS las sucursales de tu marca?\n\nSe REEMPLAZARÁ la carta actual de cada sucursal. Esta acción no se puede deshacer.')) return
    setCopyBusy(true); setCopyMsg('')
    try {
      const r = await fetch('/api/panel/ecommerce/catalog/copy-to-branches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ restaurantId }) })
      const d = await r.json().catch(() => ({}))
      setCopyMsg(r.ok ? `Copiada a ${d.branches} sucursal(es)` : d.error || 'Error al copiar')
    } catch { setCopyMsg('Error de conexión') }
    setCopyBusy(false)
  }

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
  const prodWithCode = products.filter(p => p.toteat_code).length
  const modOptions   = dedupGroups.flatMap(g => g.options)
  const modTotal     = modOptions.length
  const modWithCode  = modOptions.filter(o => o.code).length

  const q           = search.trim().toLowerCase()
  const hiddenCount = products.filter(p => p.hidden).length
  const noCodeCount = tab === 'productos' ? prodTotal - prodWithCode : modTotal - modWithCode

  let filteredProducts = q ? products.filter(p => p.name.toLowerCase().includes(q) || (p.toteat_code ?? '').toLowerCase().includes(q)) : products
  if (only === 'hidden')  filteredProducts = filteredProducts.filter(p => p.hidden)
  else if (only === 'nocode') filteredProducts = filteredProducts.filter(p => !p.toteat_code)

  let filteredGroups = q
    ? dedupGroups.map(g => ({ ...g, options: g.options.filter(o => o.name.toLowerCase().includes(q) || (o.code ?? '').toLowerCase().includes(q)) })).filter(g => g.options.length)
    : dedupGroups
  if (only === 'nocode') filteredGroups = filteredGroups.map(g => ({ ...g, options: g.options.filter(o => !o.code) })).filter(g => g.options.length)

  return (
    <div className="pos-scroll">
      <div style={{ maxWidth: 680, margin: '0 auto', width: '100%', padding: '20px 16px 48px' }}>
        {title && <p className="pos-inner-title">{title}</p>}

        {/* Copy to branches */}
        {brandSlug && (
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={copyToBranches} disabled={copyBusy} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--amber)', background: 'var(--amber-tint)', color: 'var(--amber)', fontFamily: F, fontSize: '0.8rem', fontWeight: 800, cursor: copyBusy ? 'wait' : 'pointer' }}>
              {copyBusy ? '…' : '📋'} {copyBusy ? 'Copiando…' : 'Copiar carta a sucursales'}
            </button>
            {copyMsg && <span style={{ fontFamily: F, fontSize: '0.76rem', color: 'var(--ink-2)' }}>{copyMsg}</span>}
          </div>
        )}

        {/* Tabs */}
        {!loading && prodTotal > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <TabBtn active={tab === 'productos'} onClick={() => { setTab('productos'); setSearch(''); setOnly('all') }} label="Productos" count={`${prodWithCode}/${prodTotal}`} done={prodWithCode === prodTotal} />
            <TabBtn active={tab === 'modificadores'} onClick={() => { setTab('modificadores'); setSearch(''); setOnly('all') }} label="Modificadores" count={`${modWithCode}/${modTotal}`} done={modTotal > 0 && modWithCode === modTotal} />
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '48px 0', color: 'var(--ink-3)', fontFamily: F, fontSize: '0.84rem' }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2.5px solid var(--line)', borderTopColor: 'var(--amber)', animation: 'spin 1s linear infinite' }} />
            Cargando catálogo…
          </div>
        ) : prodTotal === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', border: '1px dashed var(--line)', borderRadius: 14, fontFamily: F, color: 'var(--ink-3)' }}>No hay productos en la carta.</div>
        ) : (
          <>
            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar producto o código…" style={inputSt} />
            </div>

            {/* Filter chips */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <FilterChip label="Todos"    active={only === 'all'}    onClick={() => setOnly('all')} />
              <FilterChip label={`Sin código${noCodeCount ? ` (${noCodeCount})` : ''}`} active={only === 'nocode'} onClick={() => setOnly(only === 'nocode' ? 'all' : 'nocode')} tone="warn" />
              {tab === 'productos' && <FilterChip label={`Ocultos${hiddenCount ? ` (${hiddenCount})` : ''}`} active={only === 'hidden'} onClick={() => setOnly(only === 'hidden' ? 'all' : 'hidden')} tone="hidden" />}
            </div>

            {tab === 'productos' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* Banner hint */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--sunk)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px' }}>
                  <span>⭐</span>
                  <span style={{ flex: 1, fontFamily: F, fontSize: '0.8rem', color: 'var(--ink-2)' }}>Toca la ⭐ para destacar productos en el <b>banner</b> de la tienda (tema Impact).</span>
                  <span style={{ fontFamily: F, fontSize: '0.8rem', fontWeight: 800, color: bannerIds.length ? 'var(--amber)' : 'var(--ink-3)' }}>{bannerIds.length}/{BANNER_MAX}</span>
                </div>

                {filteredProducts.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '32px 20px', border: '1px dashed var(--line)', borderRadius: 14, fontFamily: F, color: 'var(--ink-3)' }}>
                    {only === 'hidden' ? 'No hay productos ocultos.' : only === 'nocode' ? 'Todos los productos tienen código. 🎉' : 'No hay productos que coincidan.'}
                  </div>
                )}

                {(q ? [{ id: '_all', name: '', position: 0 }] : categories).map(cat => {
                  const catProds = q ? filteredProducts : filteredProducts.filter(p => p.category_id === cat.id)
                  if (!catProds.length) return null
                  return (
                    <div key={cat.id}>
                      {!q && <div style={{ fontFamily: F, fontSize: '0.76rem', fontWeight: 800, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>{cat.name}</div>}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {catProds.map(p => (
                          <ProductRow key={p.id} p={p} toteatMap={toteatMap} bannerIds={bannerIds} bannerMax={BANNER_MAX}
                            onToggleSoldOut={() => toggleSoldOut(p.id, !p.is_sold_out)}
                            onToggleBanner={() => toggleBanner(p.id)} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : modTotal === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', border: '1px dashed var(--line)', borderRadius: 14, fontFamily: F, color: 'var(--ink-3)' }}>Los productos no tienen modificadores.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {filteredGroups.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '32px 20px', border: '1px dashed var(--line)', borderRadius: 14, fontFamily: F, color: 'var(--ink-3)' }}>
                    {only === 'nocode' ? 'Todos los modificadores tienen código. 🎉' : 'No hay modificadores que coincidan.'}
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
                        <ModifierRow key={o.id} opt={o} toteatMap={toteatMap}
                          onToggleSoldOut={() => toggleModSoldOut(o.id, !o.soldOut)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
