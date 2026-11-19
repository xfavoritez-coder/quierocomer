'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { StorefrontData, StoreProduct, StoreCategory } from '@/lib/ecommerce/storefront-data'
import type { AccompConfig } from '@/lib/ecommerce/accompaniments'
import AccompanimentsSection from '@/components/ecommerce/AccompanimentsSection'

// ── Types ──────────────────────────────────────────────────
interface CartItem {
  key: string
  product_id: string
  name: string
  unit_price: number
  base_price: number
  quantity: number
  toteat_code: string | null
  options: CartOption[]
  comment: string
  courtesy: boolean
  addedAt: string
}
interface CartOption { group_id: string; group_name: string; value_id: string; value: string; price_delta: number }

type SaleType = 'QUICK' | 'DELIVERY' | 'PICKUP'
type View = 'order' | 'products'
type PayMethod = 'efectivo' | 'debito' | 'credito' | 'transferencia'

const AMBER = '#f59e0b'
const F = "var(--sans, 'Inter', system-ui, sans-serif)"
const MONO = "var(--mono, 'JetBrains Mono', monospace)"

let _uid = 0
function uid() { return `qi_${Date.now()}_${++_uid}` }
function clp(n: number) { return '$' + Math.round(n).toLocaleString('es-CL') }
// Una dirección guardada viene como "<calle> · Dpto/casa: <ref>". Se separa para
// que el campo Dirección tenga SOLO la calle (geocodable) y el Depto su referencia;
// si no, el " · Dpto/casa: …" hace que Google la marque como imprecisa.
function splitSavedAddr(a: string): { street: string; ref: string } {
  const parts = String(a || '').split(/\s*·\s*dpto\/casa:\s*/i)
  return { street: (parts[0] || '').trim(), ref: (parts[1] || '').trim() }
}

// ── Props ──────────────────────────────────────────────────
interface Props {
  restaurantId: string
  data: StorefrontData
  onDone: () => void
  // Mesa mode
  isMesa?: boolean
  tableLabel?: string
  existingOrderId?: string | null
  covers?: number
  garzon?: string
  onClientInfo?: (name: string, label: string) => void
}

// ── Main Component ──────────────────────────────────────────
export default function PosQuickOrder({ restaurantId, data, onDone, isMesa, tableLabel, existingOrderId, covers: initCovers, garzon: initGarzon, onClientInfo }: Props) {
  const { categories, products } = data
  const [view, setView] = useState<View>('order')
  const [saleType, setSaleType] = useState<SaleType>('QUICK')
  const [cart, setCart] = useState<CartItem[]>([])
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [address, setAddress] = useState('')
  const [addressRef, setAddressRef] = useState('')
  // Autocompletado de dirección (Google vía /api/geo/search, con fallback OSM).
  const [addrSug, setAddrSug] = useState<{ place_id: string; label: string }[]>([])
  const [addrSugOpen, setAddrSugOpen] = useState(false)
  const addrSugTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const skipAddrSug = useRef(false)
  // Búsqueda de cliente por teléfono (autollenar nombre + direcciones conocidas).
  const [custAddrs, setCustAddrs] = useState<string[]>([])
  const [custFound, setCustFound] = useState(false)
  const custTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const nameAutofilled = useRef(false)
  const [payMethod, setPayMethod] = useState<PayMethod>('efectivo')
  const [deliveryFee, setDeliveryFee] = useState(0)
  const [deliveryMsg, setDeliveryMsg] = useState('')
  const [deliveryLoading, setDeliveryLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [discountType, setDiscountType] = useState<'%' | '$'>('%')
  const [discountInput, setDiscountInput] = useState('')
  const [modProduct, setModProduct] = useState<StoreProduct | null>(null)
  const [editComment, setEditComment] = useState<string | null>(null)
  const [accomNote, setAccomNote] = useState('')
  const catScrollRef = useRef<HTMLDivElement>(null)

  // Mobile detection (must be before render)
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Auto-calculate delivery fee
  const deliveryTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => {
    if (saleType !== 'DELIVERY' || address.trim().length < 6) {
      setDeliveryFee(0); setDeliveryMsg(''); setDeliveryLoading(false); return
    }
    setDeliveryLoading(true); setDeliveryMsg('Calculando envio...')
    clearTimeout(deliveryTimer.current)
    deliveryTimer.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/panel/ecommerce/delivery-quote', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ restaurantId, address: address.trim() }),
        })
        const q = await res.json()
        if (q.available) { setDeliveryFee(q.fee); setDeliveryMsg(`${clp(q.fee)} delivery · ${q.formatted || ''}`); }
        else { setDeliveryFee(0); setDeliveryMsg(q.reason || 'Zona no disponible'); }
      } catch { setDeliveryFee(0); setDeliveryMsg('Error al calcular'); }
      setDeliveryLoading(false)
    }, 800)
    return () => clearTimeout(deliveryTimer.current)
  }, [address, saleType, restaurantId])

  // Sugerencias de dirección mientras se escribe (solo delivery).
  useEffect(() => {
    if (saleType !== 'DELIVERY') { setAddrSug([]); setAddrSugOpen(false); return }
    if (skipAddrSug.current) { skipAddrSug.current = false; return }
    const q = address.trim()
    clearTimeout(addrSugTimer.current)
    if (q.length < 3) { setAddrSug([]); setAddrSugOpen(false); return }
    addrSugTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geo/search?q=${encodeURIComponent(q)}`)
        const d = await res.json()
        const list = Array.isArray(d)
          ? d.map((s: { place_id?: string | number; display_name?: string; description?: string }) => ({ place_id: String(s.place_id ?? ''), label: String(s.display_name ?? s.description ?? '') })).filter((s) => s.label)
          : []
        setAddrSug(list)
        setAddrSugOpen(list.length > 0)
      } catch { setAddrSug([]); setAddrSugOpen(false) }
    }, 300)
    return () => clearTimeout(addrSugTimer.current)
  }, [address, saleType])

  const selectAddr = (label: string) => {
    skipAddrSug.current = true
    setAddress(label)
    setAddrSug([]); setAddrSugOpen(false)
  }

  // Búsqueda de cliente al escribir el teléfono: trae nombre + direcciones previas.
  useEffect(() => {
    if (isMesa || saleType === 'QUICK') { setCustAddrs([]); setCustFound(false); return }
    const digits = customerPhone.replace(/\D/g, '')
    clearTimeout(custTimer.current)
    if (digits.length < 8) { setCustAddrs([]); setCustFound(false); return }
    custTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/panel/ecommerce/pos-orders/customer?restaurantId=${restaurantId}&phone=${encodeURIComponent(customerPhone)}&lite=1`, { cache: 'no-store' })
        const d = await res.json()
        if (!d?.found) { setCustFound(false); setCustAddrs([]); return }
        setCustFound(true)
        setCustAddrs(Array.isArray(d.addresses) ? d.addresses : [])
        if (d.name && (!customerName.trim() || nameAutofilled.current)) {
          nameAutofilled.current = true
          setCustomerName(d.name)
        }
        if (saleType === 'DELIVERY' && !address.trim() && Array.isArray(d.addresses) && d.addresses.length) {
          const { street, ref } = splitSavedAddr(d.addresses[0])
          skipAddrSug.current = true
          setAddress(street)
          if (ref && !addressRef.trim()) setAddressRef(ref)
        }
      } catch { /* noop */ }
    }, 450)
    return () => clearTimeout(custTimer.current)
  }, [customerPhone, saleType, isMesa, restaurantId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Report client info to parent for minimized pill label
  useEffect(() => {
    if (!onClientInfo) return
    const label = isMesa ? `Mesa ${tableLabel}` : customerName.trim() || (saleType === 'QUICK' ? 'Venta rapida' : 'Nuevo pedido')
    onClientInfo(customerName, label)
  }, [customerName, saleType, isMesa, tableLabel, onClientInfo])

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)
  const subtotal = cart.reduce((s, i) => s + (i.courtesy ? 0 : i.unit_price * i.quantity), 0)
  const discount = discountInput ? (discountType === '%' ? Math.round(subtotal * Math.min(100, Number(discountInput) || 0) / 100) : Math.min(subtotal, Number(discountInput) || 0)) : 0
  const fee = saleType === 'DELIVERY' ? deliveryFee : 0
  const total = Math.max(0, subtotal + fee - discount)

  // Product quantity map for badges
  const qtyMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of cart) m.set(i.product_id, (m.get(i.product_id) || 0) + i.quantity)
    return m
  }, [cart])

  // ── Cart actions ──────────────────────────────────────────
  const addToCart = useCallback((p: StoreProduct, qty = 1, options: CartOption[] = []) => {
    const optDelta = options.reduce((s, o) => s + o.price_delta, 0)
    const existing = cart.find(i => i.product_id === p.id && i.options.length === 0 && options.length === 0)
    if (existing) {
      setCart(prev => prev.map(i => i.key === existing.key ? { ...i, quantity: i.quantity + qty } : i))
    } else {
      setCart(prev => [...prev, {
        key: uid(), product_id: p.id, name: p.name,
        base_price: p.price, unit_price: p.price + optDelta,
        quantity: qty, toteat_code: p.toteat_code,
        options, comment: '', courtesy: false, addedAt: new Date().toISOString(),
      }])
    }
  }, [cart])

  const removeFromCart = useCallback((key: string) => {
    setCart(prev => prev.filter(i => i.key !== key))
  }, [])

  const updateQty = useCallback((key: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.key !== key) return i
      const q = i.quantity + delta
      return q <= 0 ? i : { ...i, quantity: q }
    }).filter(i => i.quantity > 0))
  }, [])

  // ── Submit ──────────────────────────────────────────────
  const submit = async () => {
    setSending(true)
    try {
      if (isMesa) {
        const items = cart.map(i => ({
          product_id: i.product_id, name: i.name, unit_price: i.unit_price,
          quantity: i.quantity, comment: i.comment, courtesy: i.courtesy, options: i.options,
          addedAt: i.addedAt,
        }))
        const res = existingOrderId
          ? await fetch('/api/panel/ecommerce/pos-orders', {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ restaurantId, id: existingOrderId, action: 'addItems', items }),
            })
          : await fetch('/api/panel/ecommerce/manual-order', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                restaurantId, orderType: 'DINEIN', tableLabel, posNative: true,
                covers: initCovers || null, garzon: initGarzon || null,
                items,
              }),
            })
        const d = await res.json()
        if (!res.ok || (!d.ok && !d.order)) throw new Error(d.error || 'Error')
        onDone()
        return
      }

      const res = await fetch('/api/panel/ecommerce/manual-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId,
          customerName: saleType === 'QUICK' ? '' : customerName.trim(),
          customerPhone: saleType === 'QUICK' ? '' : customerPhone.trim(),
          orderType: saleType,
          deliveryAddress: saleType === 'DELIVERY' ? [address, addressRef].filter(Boolean).join(', ') : null,
          paymentMethod: saleType === 'QUICK' ? 'efectivo' : (payMethod === 'debito' || payMethod === 'credito' ? 'tarjeta' : payMethod),
          discount,
          deliveryFee: fee,
          notes: accomNote || null,
          posNative: true,
          items: cart.map(i => ({
            product_id: i.product_id, name: i.name, unit_price: i.unit_price,
            quantity: i.quantity, toteat_code: i.toteat_code, comment: i.comment,
            courtesy: i.courtesy, options: i.options,
          })),
        }),
      })
      const d = await res.json()
      if (!res.ok || !d.ok) throw new Error(d.error || 'Error')
      onDone()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al enviar')
    } finally {
      setSending(false)
    }
  }

  // ── Filtered products ──────────────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return products.filter(p => !p.hidden && !p.is_sold_out)
    const q = search.toLowerCase()
    return products.filter(p => !p.hidden && !p.is_sold_out && p.name.toLowerCase().includes(q))
  }, [products, search])

  const visibleCats = useMemo(() => {
    const catIds = new Set(filtered.map(p => p.category_id))
    return categories.filter(c => catIds.has(c.id))
  }, [categories, filtered])

  // ── Validation ──────────────────────────────────────────
  const validationMsg = !cart.length ? 'Agrega productos' : (saleType !== 'QUICK' && !isMesa && !customerName.trim()) ? 'Falta el nombre' : (saleType !== 'QUICK' && !isMesa && !customerPhone.trim()) ? 'Falta el telefono' : (saleType === 'DELIVERY' && !address.trim()) ? 'Falta la direccion' : null
  const canSubmit = !validationMsg && !sending

  // ── Render ──────────────────────────────────────────────
  const isNarrow = typeof window !== 'undefined' && window.innerWidth < 768

  if (view === 'products' || (!isNarrow && !isMesa)) {
    // Desktop: split view (always show products + cart sidebar)
    // Mobile products view
  }

  // ── ORDER VIEW (mobile or main) ──────────────────────────
  const orderPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0', flex: 1, overflowY: 'auto' }}>
      {/* Sale type pills (not for mesa) */}
      {!isMesa && (
        <div style={{ display: 'flex', gap: 6 }}>
          {([
            ['QUICK', 'Rápida', <svg key="q" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>],
            ['DELIVERY', 'Delivery', <svg key="d" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>],
            ['PICKUP', 'Retiro', <svg key="p" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 01-8 0"/></svg>],
          ] as [SaleType, string, React.ReactNode][]).map(([t, label, icon]) => (
            <button key={t} onClick={() => setSaleType(t)}
              style={{
                flex: 1, padding: '10px 8px', borderRadius: 10, fontFamily: F, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, whiteSpace: 'nowrap',
                border: saleType === t ? `2px solid ${AMBER}` : '1.5px solid var(--line)',
                background: saleType === t ? `${AMBER}12` : 'var(--surface)',
                color: saleType === t ? AMBER : 'var(--ink-2)',
              }}
            >{icon}{label}</button>
          ))}
        </div>
      )}

      {/* Customer info (retiro/delivery) */}
      {!isMesa && saleType !== 'QUICK' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Telefono</label>
            <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="+56 9 1234 5678" type="tel" inputMode="tel"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: F, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            {custFound && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, fontFamily: F, fontSize: 12, fontWeight: 600, color: 'var(--jade)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                Cliente encontrado
              </div>
            )}
          </div>
          <div>
            <label style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Nombre</label>
            <input value={customerName} onChange={e => { setCustomerName(e.target.value); nameAutofilled.current = false }} placeholder="Nombre del cliente"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: F, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          {saleType === 'DELIVERY' && (
            <>
              {custAddrs.length > 0 && (
                <div>
                  <div style={{ fontFamily: F, fontSize: 11, fontWeight: 600, color: 'var(--ink-4)', marginBottom: 5 }}>
                    {custAddrs.length > 1 ? 'Direcciones del cliente — elige una o escribe otra' : 'Dirección del cliente'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {custAddrs.map((a, i) => {
                      const { street, ref } = splitSavedAddr(a)
                      const active = address.trim().toLowerCase() === street.toLowerCase()
                      const shortStreet = street.replace(/,?\s*chile\b/gi, '').replace(/\s{2,}/g, ' ').trim()
                      return (
                        <button key={i} type="button" onClick={() => { skipAddrSug.current = true; setAddress(street); setAddressRef(ref) }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, maxWidth: '100%', padding: '6px 10px', borderRadius: 999, border: `1.5px solid ${active ? 'var(--amber)' : 'var(--line)'}`, background: active ? 'rgba(222,124,0,.08)' : 'var(--surface)', color: active ? 'var(--amber)' : 'var(--ink-2)', fontFamily: F, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{shortStreet}{ref ? ` · ${ref}` : ''}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              <div style={{ position: 'relative' }}>
                <label style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Direccion</label>
                <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Calle y numero" autoComplete="off"
                  onFocus={() => { if (addrSug.length) setAddrSugOpen(true) }}
                  onBlur={() => setTimeout(() => setAddrSugOpen(false), 150)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: F, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                {addrSugOpen && addrSug.length > 0 && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 60, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 6px 20px rgba(0,0,0,.14)', overflow: 'hidden', maxHeight: 240, overflowY: 'auto' }}>
                    {addrSug.map((s, i) => (
                      <button key={s.place_id || `${s.label}-${i}`} type="button"
                        onMouseDown={(e) => { e.preventDefault(); selectAddr(s.label) }}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: i < addrSug.length - 1 ? '1px solid var(--line)' : 'none', padding: '10px 12px', cursor: 'pointer', fontFamily: F, fontSize: 13.5, color: 'var(--ink)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0, marginTop: 1, color: 'var(--ink-3)' }}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>
                        <span>{s.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Depto / casa / referencia</label>
                <input value={addressRef} onChange={e => setAddressRef(e.target.value)} placeholder="Ej: depto 302, casa azul"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: F, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              {/* Delivery fee */}
              {deliveryMsg && (
                <div style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: deliveryLoading ? 'var(--ink-3)' : deliveryFee > 0 ? '#16a34a' : '#ef4444', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
                  {deliveryLoading && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>}
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  {deliveryMsg}
                </div>
              )}
            </>
          )}
          {/* Payment */}
          <div>
            <label style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>Medio de pago</label>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {([['efectivo', 'Efectivo'], ['debito', 'Debito'], ['credito', 'Credito'], ['transferencia', 'Transferencia']] as [PayMethod, string][]).map(([m, label]) => (
                <button key={m} onClick={() => setPayMethod(m)}
                  style={{
                    flex: '1 1 calc(50% - 4px)', padding: '8px 6px', borderRadius: 8, fontFamily: F, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: payMethod === m ? `2px solid ${AMBER}` : '1.5px solid var(--line)',
                    background: payMethod === m ? `${AMBER}12` : 'var(--surface)',
                    color: payMethod === m ? AMBER : 'var(--ink-3)',
                  }}
                >{label}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Acompañamientos */}
      {!isMesa && cart.length > 0 && data.tenant.accompaniments && ((data.tenant.accompaniments as AccompConfig).perAmountEnabled || (data.tenant.accompaniments as AccompConfig).perProductEnabled) && (
        <AccompanimentsSection
          config={data.tenant.accompaniments as AccompConfig}
          items={cart.map(i => ({ product_id: i.product_id, name: i.name, quantity: i.quantity, unit_price: i.unit_price }))}
          subtotal={subtotal}
          primaryColor={AMBER}
          onResolve={(r) => setAccomNote(r.notesPart)}
        />
      )}

      {/* Descuento (todos los tipos) */}
      {!isMesa && cart.length > 0 && (
        <div>
          <label style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>Descuento</label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div style={{ display: 'flex', borderRadius: 8, border: '1.5px solid var(--line)', overflow: 'hidden', flexShrink: 0 }}>
              <button onClick={() => setDiscountType('%')} style={{ padding: '7px 10px', border: 'none', fontFamily: F, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: discountType === '%' ? `${AMBER}18` : 'var(--surface)', color: discountType === '%' ? AMBER : 'var(--ink-3)' }}>%</button>
              <button onClick={() => setDiscountType('$')} style={{ padding: '7px 10px', border: 'none', borderLeft: '1px solid var(--line)', fontFamily: F, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: discountType === '$' ? `${AMBER}18` : 'var(--surface)', color: discountType === '$' ? AMBER : 'var(--ink-3)' }}>$</button>
            </div>
            <input value={discountInput} onChange={e => setDiscountInput(e.target.value.replace(/[^0-9]/g, ''))} placeholder={discountType === '%' ? '0%' : '$0'}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: MONO, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            {discount > 0 && <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: '#ef4444', flexShrink: 0 }}>-{clp(discount)}</span>}
          </div>
        </div>
      )}

      {/* Cart items */}
      <div>
        <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
          Productos {cartCount > 0 && `(${cartCount})`}
        </div>
        {cart.length === 0 ? (
          <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--ink-4)', fontSize: 12, fontFamily: F, fontWeight: 500, opacity: 0.7 }}>
            Sin productos aun
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {cart.map(item => (
              <div key={item.key} style={{ padding: '8px 10px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <button onClick={() => updateQty(item.key, -1)} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', fontSize: 14 }}>−</button>
                    <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 800, width: 22, textAlign: 'center', color: 'var(--ink)' }}>{item.quantity}</span>
                    <button onClick={() => updateQty(item.key, 1)} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', fontSize: 14 }}>+</button>
                  </div>
                  <div onClick={() => setEditComment(editComment === item.key ? null : item.key)} title="Agregar/editar nota" style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
                    <span style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{item.name}</span>
                    {item.options.length > 0 && (
                      <span style={{ fontFamily: F, fontSize: 11, color: 'var(--ink-3)' }}>{item.options.map(o => o.value).join(', ')}</span>
                    )}
                  </div>
                  <span onClick={() => setEditComment(editComment === item.key ? null : item.key)} title="Agregar/editar nota" style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', flexShrink: 0, cursor: 'pointer' }}>{clp(item.unit_price * item.quantity)}</span>
                  <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                    <button onClick={() => setEditComment(editComment === item.key ? null : item.key)} title="Nota" style={{ background: 'none', border: 'none', cursor: 'pointer', color: item.comment ? AMBER : 'var(--ink-4)', padding: 2, display: 'flex' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    </button>
                    <button onClick={() => removeFromCart(item.key)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', padding: 2, display: 'flex' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                </div>
                {editComment === item.key && (
                  <input value={item.comment} onChange={e => setCart(prev => prev.map(i => i.key === item.key ? { ...i, comment: e.target.value } : i))}
                    placeholder="Nota: ej. sin cebolla"
                    autoFocus
                    style={{ width: '100%', marginTop: 6, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--line)', fontFamily: F, fontSize: 12, color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add products button */}
        <button onClick={() => setView('products')}
          style={{
            width: '100%', marginTop: 8, padding: '12px', borderRadius: 10,
            border: `1.5px solid var(--line)`, background: 'var(--surface)',
            color: 'var(--ink-2)', fontFamily: F, fontSize: 13, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14"/></svg>
          Agregar productos
        </button>
      </div>

      {/* Total + Submit */}
      {cart.length > 0 && (
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 'auto' }}>
          {(discount > 0 || fee > 0) && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: F, fontSize: 13, color: 'var(--ink-3)', marginBottom: 4 }}>
              <span>Subtotal</span><span style={{ fontFamily: MONO }}>{clp(subtotal)}</span>
            </div>
          )}
          {fee > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: F, fontSize: 13, color: 'var(--ink-3)', marginBottom: 4 }}>
              <span>Delivery</span><span style={{ fontFamily: MONO }}>{clp(fee)}</span>
            </div>
          )}
          {discount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: F, fontSize: 13, color: '#ef4444', marginBottom: 4 }}>
              <span>Descuento</span><span style={{ fontFamily: MONO }}>-{clp(discount)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: F, fontSize: 16, fontWeight: 800, color: 'var(--ink)', marginBottom: 10 }}>
            <span>Total</span>
            <span style={{ fontFamily: MONO }}>{clp(total)}</span>
          </div>
          <button onClick={canSubmit ? submit : undefined}
            style={{
              width: '100%', padding: '14px', borderRadius: 12, border: 'none',
              background: canSubmit ? AMBER : '#e5e7eb', color: canSubmit ? '#fff' : '#9ca3af',
              fontFamily: F, fontSize: 15, fontWeight: 800, cursor: canSubmit ? 'pointer' : 'default',
              opacity: sending ? 0.6 : 1, position: 'relative',
            }}
          >
            {sending ? 'Enviando...' : isMesa ? 'Enviar a cocina' : 'Tomar pedido'}
          </button>
          {validationMsg && !sending && (
            <p style={{ fontFamily: F, fontSize: 12, color: '#ef4444', textAlign: 'center', marginTop: 6 }}>{validationMsg}</p>
          )}
        </div>
      )}
    </div>
  )

  // ── PRODUCTS VIEW ──────────────────────────────────────────
  const productsPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 10, flexShrink: 0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar producto..."
          style={{ width: '100%', padding: '9px 12px 9px 32px', borderRadius: 10, border: '1.5px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: F, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {/* Categories */}
      {!search && (
        <div ref={catScrollRef} style={{ display: 'flex', gap: 6, flexShrink: 0, marginBottom: 10, paddingBottom: 2, ...(isMobile ? { overflowX: 'auto', scrollbarWidth: 'none' } : { flexWrap: 'wrap' }) }}>
          <style>{`div::-webkit-scrollbar{display:none}`}</style>
          <button onClick={() => setActiveCat(null)}
            style={{
              padding: '6px 14px', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0,
              fontFamily: F, fontSize: 14, fontWeight: 700, cursor: 'pointer',
              border: !activeCat ? `2px solid ${AMBER}` : '1.5px solid var(--line)',
              background: !activeCat ? `${AMBER}12` : 'var(--surface)',
              color: !activeCat ? AMBER : 'var(--ink-3)',
            }}
          >Todos</button>
          {visibleCats.map(c => (
            <button key={c.id} onClick={() => setActiveCat(c.id)}
              style={{
                padding: '6px 14px', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0,
                fontFamily: F, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                border: activeCat === c.id ? `2px solid ${AMBER}` : '1.5px solid var(--line)',
                background: activeCat === c.id ? `${AMBER}12` : 'var(--surface)',
                color: activeCat === c.id ? AMBER : 'var(--ink-3)',
              }}
            >{c.name}</button>
          ))}
        </div>
      )}

      {/* Product grid/list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {(activeCat ? visibleCats.filter(c => c.id === activeCat) : visibleCats).map(cat => {
          const catProducts = filtered.filter(p => p.category_id === cat.id)
          if (!catProducts.length) return null
          return (
            <div key={cat.id} style={{ marginBottom: 16 }}>
              {!activeCat && <div style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8, paddingLeft: 2 }}>{cat.name}</div>}
              <div style={isMobile
                ? { display: 'flex', flexDirection: 'column', gap: 2 }
                : { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }
              }>
                {catProducts.map(p => {
                  const qty = qtyMap.get(p.id) || 0
                  const hasModifiers = p.option_groups && p.option_groups.length > 0
                  return isMobile ? (
                    /* Mobile: lista compacta */
                    <button key={p.id} onClick={() => hasModifiers ? setModProduct(p) : addToCart(p)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: 'none', background: qty > 0 ? `${AMBER}08` : 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: F, width: '100%', contentVisibility: 'auto', containIntrinsicSize: '320px 68px' }}>
                      {p.image_url && <img src={p.image_url} alt="" loading="lazy" decoding="async" style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: AMBER, fontFamily: MONO }}>{clp(p.price)}</div>
                      </div>
                      <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: qty > 0 ? AMBER : 'var(--sunk)', color: qty > 0 ? '#fff' : 'var(--ink-3)', fontWeight: 800, fontSize: qty > 0 ? 13 : 16 }}>
                        {qty > 0 ? qty : '+'}
                      </div>
                    </button>
                  ) : (
                    /* Desktop: card con foto grande */
                    <button key={p.id} onClick={() => hasModifiers ? setModProduct(p) : addToCart(p)}
                      style={{ display: 'flex', flexDirection: 'column', borderRadius: 12, border: qty > 0 ? `2px solid ${AMBER}` : '1.5px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', textAlign: 'left', fontFamily: F, overflow: 'hidden', position: 'relative', contentVisibility: 'auto', containIntrinsicSize: '180px 168px' }}>
                      {p.image_url ? (
                        <img src={p.image_url} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: 100, objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: 50, background: 'var(--sunk)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-4)', fontSize: 20 }}>🍽</div>
                      )}
                      <div style={{ padding: '8px 10px' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>{p.name}</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: AMBER, fontFamily: MONO, marginTop: 2 }}>{clp(p.price)}</div>
                      </div>
                      {qty > 0 && (
                        <div style={{ position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 999, background: AMBER, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 12, boxShadow: '0 2px 6px rgba(0,0,0,.2)' }}>{qty}</div>
                      )}
                      {hasModifiers && (
                        <div style={{ position: 'absolute', top: 6, left: 6, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,0,0,.5)', color: '#fff', fontSize: 9, fontWeight: 700 }}>+ Opciones</div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom: "Listo" button (solo mobile, en desktop ambos paneles son visibles) */}
      {cartCount > 0 && isMobile && (
        <button onClick={() => setView('order')}
          style={{
            marginTop: 8, padding: '12px', borderRadius: 12, border: 'none', flexShrink: 0,
            background: AMBER, color: '#fff', fontFamily: F, fontSize: 14, fontWeight: 800,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          Listo · {cartCount} {cartCount === 1 ? 'producto' : 'productos'}
        </button>
      )}
    </div>
  )

  // ── Layout ──────────────────────────────────────────────
  // Desktop: split (order left, products right)
  // Mobile: tabs
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ── Modifiers Modal ──────────────────────────────────────
  const modifiersModal = modProduct && (() => {
    const groups = modProduct.option_groups ?? []
    return (
      <ModifiersOverlay product={modProduct} groups={groups} onAdd={(options, qty) => {
        addToCart(modProduct, qty, options)
        setModProduct(null)
      }} onClose={() => setModProduct(null)} />
    )
  })()

  if (!isMobile) {
    // Desktop split
    return (
      <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0, height: '100%', position: 'relative' }}>
        <div style={{ width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRadius: 14, border: '1px solid var(--line)', background: 'var(--surface)', padding: '14px 16px', overflow: 'hidden' }}>
          {orderPanel}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', borderRadius: 14, border: '1px solid var(--line)', background: 'var(--surface)', padding: '14px 16px', overflow: 'hidden' }}>
          {productsPanel}
        </div>
        {modifiersModal}
      </div>
    )
  }

  // Mobile: tabs
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {view === 'order' ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 2px' }}>{orderPanel}</div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '0 2px' }}>
            {productsPanel}
          </div>
        )}
      </div>
      {/* Bottom tabs */}
      <div style={{ display: 'flex', gap: 6, padding: '8px 0 4px', borderTop: '1px solid var(--line)', flexShrink: 0 }}>
        <button onClick={() => setView('order')}
          style={{
            flex: 1, padding: '10px', borderRadius: 10, fontFamily: F, fontSize: 13, fontWeight: 700,
            border: 'none', cursor: 'pointer',
            background: view === 'order' ? `${AMBER}14` : 'transparent',
            color: view === 'order' ? AMBER : 'var(--ink-3)',
          }}
        >
          Pedido {cartCount > 0 && `(${cartCount})`}
        </button>
        <button onClick={() => setView('products')}
          style={{
            flex: 1, padding: '10px', borderRadius: 10, fontFamily: F, fontSize: 13, fontWeight: 700,
            border: 'none', cursor: 'pointer',
            background: view === 'products' ? `${AMBER}14` : 'transparent',
            color: view === 'products' ? AMBER : 'var(--ink-3)',
          }}
        >
          Productos
        </button>
      </div>
      {modifiersModal}
    </div>
  )
}

// ── Modifiers Overlay ──────────────────────────────────────
function ModifiersOverlay({ product, groups, onAdd, onClose }: {
  product: StoreProduct
  groups: StoreProduct['option_groups']
  onAdd: (options: CartOption[], qty: number) => void
  onClose: () => void
}) {
  const [selected, setSelected] = useState<Record<string, string[]>>({})
  const [qty, setQty] = useState(1)

  const toggle = (gId: string, maxSelect: number, valueId: string) => {
    setSelected(prev => {
      const cur = prev[gId] ?? []
      if (cur.includes(valueId)) return { ...prev, [gId]: cur.filter(v => v !== valueId) }
      if (maxSelect === 1) return { ...prev, [gId]: [valueId] }
      if (cur.length < maxSelect) return { ...prev, [gId]: [...cur, valueId] }
      return prev
    })
  }

  const optionsFlat: CartOption[] = groups.flatMap(g => (selected[g.id] ?? []).map(vid => {
    const val = (g.values ?? []).find(v => v.id === vid)!
    return { group_id: g.id, group_name: g.name, value_id: vid, value: val.name, price_delta: val.price_delta }
  }))
  const unitPrice = product.price + optionsFlat.reduce((s, o) => s + o.price_delta, 0)
  const canAdd = groups.every(g => (selected[g.id]?.length ?? 0) >= Math.max(1, g.min_select))

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 400, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
            <h2 style={{ fontFamily: F, fontSize: 16, fontWeight: 800, color: '#111', margin: 0 }}>{product.name}</h2>
            {product.description && <p style={{ fontFamily: F, fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>{product.description}</p>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 2 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        {/* Groups */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {groups.map(g => (
            <div key={g.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: '#111' }}>{g.name}</span>
                {g.is_required && <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', background: '#fef2f2', padding: '1px 6px', borderRadius: 4 }}>Requerido</span>}
                {g.max_select > 1 && <span style={{ fontSize: 11, color: '#9ca3af' }}>Max {g.max_select}</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(g.values ?? []).map(v => {
                  const checked = (selected[g.id] ?? []).includes(v.id)
                  return (
                    <button key={v.id} onClick={() => toggle(g.id, g.max_select, v.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', textAlign: 'left', border: checked ? `2px solid ${AMBER}` : '1.5px solid #e5e7eb', background: checked ? `${AMBER}08` : '#fff' }}>
                      <span style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${checked ? AMBER : '#d1d5db'}`, background: checked ? AMBER : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {checked && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                      </span>
                      <span style={{ flex: 1, fontFamily: F, fontSize: 13, color: '#111' }}>{v.name}</span>
                      {v.price_delta !== 0 && <span style={{ fontFamily: MONO, fontSize: 12, color: '#6b7280' }}>{v.price_delta > 0 ? '+' : ''}{clp(v.price_delta)}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderTop: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#6b7280' }}>−</button>
            <span style={{ width: 24, textAlign: 'center', fontFamily: F, fontWeight: 800, fontSize: 15 }}>{qty}</span>
            <button onClick={() => setQty(q => q + 1)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#6b7280' }}>+</button>
          </div>
          <button onClick={() => { if (canAdd) onAdd(optionsFlat, qty) }} disabled={!canAdd}
            style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', fontFamily: F, fontSize: 14, fontWeight: 800, cursor: canAdd ? 'pointer' : 'default', background: canAdd ? AMBER : '#e5e7eb', color: canAdd ? '#fff' : '#9ca3af' }}>
            {canAdd ? `Agregar — ${clp(unitPrice * qty)}` : 'Selecciona una opcion'}
          </button>
        </div>
      </div>
    </div>
  )
}
