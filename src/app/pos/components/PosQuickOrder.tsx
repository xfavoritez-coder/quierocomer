'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { StorefrontData, StoreProduct, StoreCategory } from '@/lib/ecommerce/storefront-data'

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
}

// ── Main Component ──────────────────────────────────────────
export default function PosQuickOrder({ restaurantId, data, onDone, isMesa, tableLabel, existingOrderId, covers: initCovers, garzon: initGarzon }: Props) {
  const { categories, products } = data
  const [view, setView] = useState<View>('order')
  const [saleType, setSaleType] = useState<SaleType>('QUICK')
  const [cart, setCart] = useState<CartItem[]>([])
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [address, setAddress] = useState('')
  const [addressRef, setAddressRef] = useState('')
  const [payMethod, setPayMethod] = useState<PayMethod>('efectivo')
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [discountType, setDiscountType] = useState<'%' | '$'>('%')
  const [discountInput, setDiscountInput] = useState('')
  const catScrollRef = useRef<HTMLDivElement>(null)

  // Mobile detection (must be before render)
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)
  const subtotal = cart.reduce((s, i) => s + (i.courtesy ? 0 : i.unit_price * i.quantity), 0)
  const discount = discountInput ? (discountType === '%' ? Math.round(subtotal * Math.min(100, Number(discountInput) || 0) / 100) : Math.min(subtotal, Number(discountInput) || 0)) : 0
  const total = Math.max(0, subtotal - discount)

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
          {([['QUICK', 'Venta rapida'], ['DELIVERY', 'Delivery'], ['PICKUP', 'Retiro']] as [SaleType, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setSaleType(t)}
              style={{
                flex: 1, padding: '10px 8px', borderRadius: 10, fontFamily: F, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                border: saleType === t ? `2px solid ${AMBER}` : '1.5px solid var(--line)',
                background: saleType === t ? `${AMBER}12` : 'var(--surface)',
                color: saleType === t ? AMBER : 'var(--ink-2)',
              }}
            >{label}</button>
          ))}
        </div>
      )}

      {/* Customer info (retiro/delivery) */}
      {!isMesa && saleType !== 'QUICK' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Nombre</label>
            <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nombre del cliente"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: F, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Telefono</label>
            <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="+56 9 1234 5678" type="tel"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: F, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          {saleType === 'DELIVERY' && (
            <>
              <div>
                <label style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Direccion</label>
                <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Calle y numero"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: F, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Depto / casa / referencia</label>
                <input value={addressRef} onChange={e => setAddressRef(e.target.value)} placeholder="Ej: depto 302, casa azul"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: F, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
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
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13, fontFamily: F }}>
            Sin productos aun
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {cart.map(item => (
              <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => updateQty(item.key, -1)} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', fontSize: 14 }}>−</button>
                  <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 800, width: 22, textAlign: 'center', color: 'var(--ink)' }}>{item.quantity}</span>
                  <button onClick={() => updateQty(item.key, 1)} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', fontSize: 14 }}>+</button>
                </div>
                <span style={{ flex: 1, fontFamily: F, fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', flexShrink: 0 }}>{clp(item.unit_price * item.quantity)}</span>
                <button onClick={() => removeFromCart(item.key)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', padding: 2, display: 'flex' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add products button */}
        <button onClick={() => setView('products')}
          style={{
            width: '100%', marginTop: 8, padding: '12px', borderRadius: 10,
            border: `1.5px dashed var(--line)`, background: 'transparent',
            color: 'var(--ink-3)', fontFamily: F, fontSize: 13, fontWeight: 600,
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
          {discount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: F, fontSize: 13, color: 'var(--ink-3)', marginBottom: 4 }}>
              <span>Subtotal</span><span style={{ fontFamily: MONO }}>{clp(subtotal)}</span>
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
              fontFamily: F, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: !activeCat ? `2px solid ${AMBER}` : '1.5px solid var(--line)',
              background: !activeCat ? `${AMBER}12` : 'var(--surface)',
              color: !activeCat ? AMBER : 'var(--ink-3)',
            }}
          >Todos</button>
          {visibleCats.map(c => (
            <button key={c.id} onClick={() => setActiveCat(c.id)}
              style={{
                padding: '6px 14px', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0,
                fontFamily: F, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: activeCat === c.id ? `2px solid ${AMBER}` : '1.5px solid var(--line)',
                background: activeCat === c.id ? `${AMBER}12` : 'var(--surface)',
                color: activeCat === c.id ? AMBER : 'var(--ink-3)',
              }}
            >{c.name}</button>
          ))}
        </div>
      )}

      {/* Product list */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {(activeCat ? filtered.filter(p => p.category_id === activeCat) : filtered).map(p => {
          const qty = qtyMap.get(p.id) || 0
          const hasModifiers = p.option_groups && p.option_groups.length > 0
          return (
            <button key={p.id}
              onClick={() => {
                if (hasModifiers) {
                  // TODO: modifier modal
                  addToCart(p)
                } else {
                  addToCart(p)
                }
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                borderRadius: 10, border: 'none', background: qty > 0 ? `${AMBER}08` : 'transparent',
                cursor: 'pointer', textAlign: 'left', fontFamily: F, width: '100%',
                transition: 'background .1s',
              }}
            >
              {/* Photo */}
              {p.image_url && (
                <img src={p.image_url} alt="" loading="lazy"
                  style={{ width: isMobile ? 48 : 40, height: isMobile ? 48 : 40, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
              )}
              {/* Name + price */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: isMobile ? 15 : 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                <div style={{ fontSize: isMobile ? 14 : 13, fontWeight: 800, color: AMBER, fontFamily: MONO }}>{clp(p.price)}</div>
              </div>
              {/* Qty badge or + */}
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: qty > 0 ? AMBER : 'var(--sunk)',
                color: qty > 0 ? '#fff' : 'var(--ink-3)',
                fontWeight: 800, fontSize: qty > 0 ? 13 : 16,
              }}>
                {qty > 0 ? qty : '+'}
              </div>
            </button>
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

  if (!isMobile) {
    // Desktop split
    return (
      <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0, height: '100%' }}>
        <div style={{ width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRadius: 14, border: '1px solid var(--line)', background: 'var(--surface)', padding: '14px 16px', overflow: 'hidden' }}>
          {orderPanel}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', borderRadius: 14, border: '1px solid var(--line)', background: 'var(--surface)', padding: '14px 16px', overflow: 'hidden' }}>
          {productsPanel}
        </div>
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
    </div>
  )
}
