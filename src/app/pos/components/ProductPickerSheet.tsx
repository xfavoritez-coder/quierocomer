'use client'

import { useState, useCallback, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useCatalog, sendRound } from '@/lib/pos'
import type { CachedProduct, RoundItem, ItemModifier } from '@/lib/pos/types'
import ModifierModal from './ModifierModal'

interface Props {
  accountId: string
  restaurantId: string
  onClose: () => void
}

export default function ProductPickerSheet({ accountId, restaurantId, onClose }: Props) {
  const { products, categories, loading } = useCatalog(restaurantId)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [orderItems, setOrderItems] = useState<RoundItem[]>([])
  const [modalProduct, setModalProduct] = useState<CachedProduct | null>(null)
  const [sending, setSending] = useState(false)

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTriggered = useRef(false)

  const searchQuery = search.trim().toLowerCase()
  const filteredProducts = (selectedCategory
    ? products.filter(p => p.category_id === selectedCategory).sort((a, b) => a.position - b.position)
    : products.sort((a, b) => {
        if (a.category_position !== b.category_position) return a.category_position - b.category_position
        return a.position - b.position
      })
  ).filter(p => !searchQuery || p.name.toLowerCase().includes(searchQuery))

  const quickAdd = useCallback((product: CachedProduct) => {
    if (product.modifier_templates.some(t => t.groups.length > 0)) {
      setModalProduct(product)
      return
    }
    setOrderItems(prev => {
      const existing = prev.find(i => i.dish_id === product.id && i.modifiers.length === 0 && !i.note)
      if (existing) return prev.map(i => i.item_id === existing.item_id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { item_id: uuidv4(), dish_id: product.id, dish_name: product.name, quantity: 1, unit_price: product.discount_price ?? product.price, modifiers: [] }]
    })
  }, [])

  const onPointerDown = useCallback((product: CachedProduct) => {
    longPressTriggered.current = false
    longPressTimer.current = setTimeout(() => { longPressTriggered.current = true; setModalProduct(product) }, 500)
  }, [])

  const onPointerUp = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
  }, [])

  const onPointerCancel = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
  }, [])

  const onClick = useCallback((product: CachedProduct) => {
    if (longPressTriggered.current) return
    quickAdd(product)
  }, [quickAdd])

  const handleModifierConfirm = useCallback((modifiers: ItemModifier[], note: string, quantity: number) => {
    if (!modalProduct) return
    setOrderItems(prev => [...prev, {
      item_id: uuidv4(),
      dish_id: modalProduct.id,
      dish_name: modalProduct.name,
      quantity,
      unit_price: modalProduct.discount_price ?? modalProduct.price,
      modifiers,
      note: note || undefined,
    }])
    setModalProduct(null)
  }, [modalProduct])

  const removeItem = useCallback((itemId: string) => {
    setOrderItems(prev => prev.filter(i => i.item_id !== itemId))
  }, [])

  const handleSend = useCallback(async () => {
    if (orderItems.length === 0 || sending) return
    setSending(true)
    try {
      await sendRound({ round_id: uuidv4(), account_id: accountId, items: orderItems })
      onClose()
    } catch (err) {
    } finally {
      setSending(false)
    }
  }, [orderItems, accountId, sending, onClose])

  const itemCount = orderItems.reduce((s, i) => s + i.quantity, 0)
  const orderTotal = orderItems.reduce((s, i) =>
    s + i.quantity * (i.unit_price + i.modifiers.reduce((m, mod) => m + mod.price_adjustment, 0)), 0)

  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: '7px 14px',
    borderRadius: 20,
    border: `1px solid ${active ? 'var(--amber)' : 'var(--line)'}`,
    background: active ? 'var(--amber-tint-2)' : 'var(--surface)',
    color: active ? 'var(--amber-press)' : 'var(--ink-2)',
    fontWeight: active ? 600 : 500,
    fontSize: 13,
    whiteSpace: 'nowrap' as const,
    cursor: 'pointer',
    fontFamily: 'var(--sans)',
  })

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--surface)', flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--sunk)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink-2)', flexShrink: 0, minWidth: 44, minHeight: 44 }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
          <div style={{ flex: 1, fontWeight: 700, fontSize: 16 }}>Agregar ítem</div>
          {itemCount > 0 && (
            <span style={{ background: 'var(--amber)', color: '#fff', borderRadius: 99, padding: '3px 10px', fontSize: 13, fontWeight: 700, fontFamily: 'var(--mono)' }}>
              {itemCount}
            </span>
          )}
        </div>

        {/* Search */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', background: 'var(--surface)', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input
              type="search"
              placeholder="Buscar producto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '9px 10px 9px 32px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--sunk)', fontSize: 14, fontFamily: 'var(--sans)', color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {/* Category pills */}
        <div style={{ display: 'flex', gap: 6, padding: '8px 12px', overflowX: 'auto', borderBottom: '1px solid var(--line)', background: 'var(--sunk)', flexShrink: 0, scrollbarWidth: 'none' }}>
          <button onClick={() => setSelectedCategory(null)} style={pillStyle(!selectedCategory)}>Todo</button>
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} style={pillStyle(selectedCategory === cat.id)}>
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product grid */}
        {loading ? (
          <div className="pos-empty" style={{ flex: 1 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--line)', borderTopColor: 'var(--amber)', animation: 'spin 1s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            <div className="pos-picker-grid">
              {filteredProducts.length === 0 ? (
                <div className="pos-empty" style={{ gridColumn: '1/-1', minHeight: 120 }}>
                  <p>{products.length === 0 ? 'Sin productos en el catálogo' : 'Sin resultados'}</p>
                </div>
              ) : filteredProducts.map(product => {
                const qty = orderItems.filter(i => i.dish_id === product.id).reduce((s, i) => s + i.quantity, 0)
                return (
                  <button
                    key={product.id}
                    className="pos-prod"
                    onPointerDown={() => onPointerDown(product)}
                    onPointerUp={onPointerUp}
                    onPointerLeave={onPointerCancel}
                    onContextMenu={e => e.preventDefault()}
                    onClick={() => onClick(product)}
                    style={{ position: 'relative' }}
                  >
                    {qty > 0 && (
                      <span style={{ position: 'absolute', top: 6, right: 6, background: 'var(--amber)', color: '#fff', borderRadius: 99, minWidth: 20, height: 20, display: 'grid', placeItems: 'center', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 11, zIndex: 1, padding: '0 4px' }}>
                        {qty}
                      </span>
                    )}
                    <div className="pos-ph">
                      {product.photos[0] ? (
                        <img src={product.photos[0]} alt="" draggable={false} />
                      ) : (
                        <div className="pos-ph-empty">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                        </div>
                      )}
                    </div>
                    <div className="info">
                      <div className="pn">{product.name}</div>
                      <div className="pp">${(product.discount_price ?? product.price).toLocaleString('es-CL')}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Bottom bar */}
        {orderItems.length > 0 && (
          <div style={{ borderTop: '1px solid var(--line)', background: 'var(--surface)', padding: '10px 16px 16px', flexShrink: 0 }}>
            {/* Selected chips */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 10, scrollbarWidth: 'none', paddingBottom: 2 }}>
              {orderItems.map(item => (
                <div key={item.item_id} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--amber-tint-2)', border: '1px solid var(--amber-tint)', borderRadius: 99, padding: '5px 8px 5px 10px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12, color: 'var(--amber-press)' }}>{item.quantity}×</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-2)', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.dish_name}</span>
                  <button
                    onClick={() => removeItem(item.item_id)}
                    style={{ display: 'grid', placeItems: 'center', background: 'none', border: 0, cursor: 'pointer', color: 'var(--amber-press)', padding: 0, width: 16, height: 16, flexShrink: 0, marginLeft: 2 }}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M8 2L2 8M2 2l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </button>
                </div>
              ))}
            </div>
            {/* CTA */}
            <button
              onClick={handleSend}
              disabled={sending}
              style={{ width: '100%', padding: '14px 18px', borderRadius: 'var(--r-btn)', border: 0, background: 'var(--amber)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: sending ? 'default' : 'pointer', fontFamily: 'var(--sans)', opacity: sending ? 0.7 : 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box', boxShadow: '0 2px 4px rgba(222,124,0,.2),0 6px 16px rgba(222,124,0,.24)' }}
            >
              <span>{sending ? 'Agregando...' : `Agregar ${itemCount} ítem${itemCount !== 1 ? 's' : ''}`}</span>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>${orderTotal.toLocaleString('es-CL')}</span>
            </button>
          </div>
        )}
      </div>

      {modalProduct && (
        <ModifierModal
          product={modalProduct}
          onConfirm={handleModifierConfirm}
          onClose={() => setModalProduct(null)}
        />
      )}
    </>
  )
}
