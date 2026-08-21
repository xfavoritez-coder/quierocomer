'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { toast } from 'sonner'
import {
  useCatalog,
  usePosSync,
  setRestaurantId,
  setUserId,
  sendRound,
  openAccount,
} from '@/lib/pos'
import { printComanda, getBridgeUrl } from '@/lib/pos/bridge'
import type { CachedProduct, RoundItem, ItemModifier } from '@/lib/pos/types'
import PosHeader from '../components/PosHeader'
import ModifierModal from '../components/ModifierModal'
import OrderPanel from '../components/OrderPanel'

const TEST_RESTAURANT_ID = 'cmo22e53z0000l404vsw2cksk'
const TEST_USER_ID = 'test-garzon'

export default function ComanderoPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const accountId = searchParams.get('cuenta')

  const { syncing } = usePosSync(TEST_RESTAURANT_ID)
  const { products, categories, loading } = useCatalog(TEST_RESTAURANT_ID)

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [orderItems, setOrderItems] = useState<RoundItem[]>([])
  const [modalProduct, setModalProduct] = useState<CachedProduct | null>(null)
  const [sending, setSending] = useState(false)
  const [showOrder, setShowOrder] = useState(false)

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTriggered = useRef(false)

  useState(() => {
    setRestaurantId(TEST_RESTAURANT_ID)
    setUserId(TEST_USER_ID)
  })

  const filteredProducts = selectedCategory
    ? products.filter(p => p.category_id === selectedCategory).sort((a, b) => a.position - b.position)
    : products.sort((a, b) => {
        if (a.category_position !== b.category_position) return a.category_position - b.category_position
        return a.position - b.position
      })

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
    setOrderItems(prev => [...prev, { item_id: uuidv4(), dish_id: modalProduct.id, dish_name: modalProduct.name, quantity, unit_price: modalProduct.discount_price ?? modalProduct.price, modifiers, note: note || undefined }])
    setModalProduct(null)
  }, [modalProduct])

  const updateQuantity = useCallback((itemId: string, delta: number) => {
    setOrderItems(prev => prev.map(i => i.item_id === itemId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i).filter(i => i.quantity > 0))
  }, [])

  const removeItem = useCallback((itemId: string) => {
    setOrderItems(prev => prev.filter(i => i.item_id !== itemId))
  }, [])

  const handleSend = useCallback(async () => {
    if (orderItems.length === 0) return
    setSending(true)
    try {
      let targetAccountId = accountId
      if (!targetAccountId) {
        targetAccountId = uuidv4()
        await openAccount({ account_id: targetAccountId, account_type: 'mostrador' })
      }
      const roundId = uuidv4()
      await sendRound({ round_id: roundId, account_id: targetAccountId, items: orderItems })

      // Imprimir comanda si el puente está configurado
      if (getBridgeUrl()) {
        const printResult = await printComanda({
          jobId: roundId,
          type: 'mostrador',
          accountId: targetAccountId,
          roundNumber: 1,
          sentBy: TEST_USER_ID,
          items: orderItems.map(i => ({
            quantity: i.quantity,
            dish_name: i.dish_name,
            modifiers: i.modifiers.map(m => ({ name: m.option_name, price_adjustment: m.price_adjustment })),
            note: i.note,
          })),
        })
        if (!printResult.ok) {
          toast.warning(`Enviado a cocina, pero fallo la impresion: ${printResult.error}`)
        } else {
          toast.success(`Enviado a cocina (${orderItems.length} ítems)`)
        }
      } else {
        toast.success(`Enviado a cocina (${orderItems.length} ítems)`)
      }

      setOrderItems([])
      setShowOrder(false)
      router.push(`/pos/cuenta/${targetAccountId}`)
    } catch (err) {
      toast.error('Error al enviar: ' + String(err))
    } finally {
      setSending(false)
    }
  }, [orderItems, accountId])

  const itemCount = orderItems.reduce((sum, i) => sum + i.quantity, 0)
  const orderTotal = orderItems.reduce((sum, i) => {
    const modExtra = i.modifiers.reduce((s, m) => s + m.price_adjustment, 0)
    return sum + i.quantity * (i.unit_price + modExtra)
  }, 0)

  return (
    <div className="pos-shell">
      <PosHeader
        mode="back"
        eyebrow="Comandero"
        subtitle={accountId ? `Mostrador · Cuenta #${accountId.slice(-4)}` : 'Nueva cuenta'}
        syncing={syncing}
        onBack={() => router.push('/pos')}
      />

      {loading ? (
        <div className="pos-empty" style={{ flex: 1 }}>
          <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '3px solid var(--line)', borderTopColor: 'var(--amber)' }} />
        </div>
      ) : (
        <>
          {/* Single layout — CSS handles desktop (3-col grid) vs mobile (stacked scroll) */}
          <div className="pos-cmd">
            {/* Categories */}
            <div className="pos-cats">
              <button
                className={`pos-cat ${!selectedCategory ? 'on' : ''}`}
                onClick={() => setSelectedCategory(null)}
              >
                Todo
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  className={`pos-cat ${selectedCategory === cat.id ? 'on' : ''}`}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Grid */}
            <div className="pos-grid-wrap">
              <div className="pos-grid">
                {filteredProducts.length === 0 ? (
                  <div className="pos-empty" style={{ gridColumn: '1/-1' }}>
                    <p>{products.length === 0 ? 'Sin productos en el catálogo' : 'Sin productos en esta categoría'}</p>
                  </div>
                ) : filteredProducts.map(product => (
                  <ProductCard key={product.id} product={product} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onClick={onClick} />
                ))}
              </div>
            </div>

            {/* Order panel — visible on desktop, hidden on mobile */}
            <div className="pos-order pos-desktop">
              <div className="pos-order-h">
                <div className="ti">Pedido actual</div>
                <div className="tbl">Ronda 1</div>
              </div>
              <OrderPanel items={orderItems} onUpdateQuantity={updateQuantity} onRemove={removeItem} onSend={handleSend} sending={sending} />
            </div>
          </div>

          {/* Mobile FAB */}
          {itemCount > 0 && !showOrder && (
            <button className="pos-fab pos-mobile" onClick={() => setShowOrder(true)}>
              <span className="flex items-center gap-2">
                <span className="badge">{itemCount}</span>
                Ver comanda
              </span>
              <span className="total">${orderTotal.toLocaleString('es-CL')}</span>
            </button>
          )}

          {/* Mobile bottom sheet */}
          {showOrder && (
            <div className="pos-mobile">
              <div className="pos-sheet-backdrop" onClick={() => setShowOrder(false)} />
              <div className="pos-sheet">
                <div className="pos-sheet-header">
                  <div>
                    <div className="pos-order-h" style={{ border: 0, padding: 0 }}>
                      <div className="ti">Pedido actual</div>
                      <div className="tbl">Ronda 1</div>
                    </div>
                  </div>
                  <button onClick={() => setShowOrder(false)} style={{ background: 'none', border: 0, cursor: 'pointer', padding: 8, color: 'var(--ink-3)' }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </button>
                </div>
                <OrderPanel items={orderItems} onUpdateQuantity={updateQuantity} onRemove={removeItem} onSend={handleSend} sending={sending} />
              </div>
            </div>
          )}
        </>
      )}

      {modalProduct && (
        <ModifierModal product={modalProduct} onConfirm={handleModifierConfirm} onClose={() => setModalProduct(null)} />
      )}
    </div>
  )
}

function ProductCard({ product, onPointerDown, onPointerUp, onPointerCancel, onClick }: {
  product: CachedProduct
  onPointerDown: (p: CachedProduct) => void
  onPointerUp: () => void
  onPointerCancel: () => void
  onClick: (p: CachedProduct) => void
}) {
  return (
    <button
      className="pos-prod"
      onPointerDown={() => onPointerDown(product)}
      onPointerUp={() => onPointerUp()}
      onPointerLeave={onPointerCancel}
      onContextMenu={e => e.preventDefault()}
      onClick={() => onClick(product)}
    >
      <div className="pos-ph">
        {product.photos[0] ? (
          <img src={product.photos[0]} alt="" draggable={false} />
        ) : (
          <div className="pos-ph-empty">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
            </svg>
          </div>
        )}
      </div>
      <div className="info">
        <div className="pn">{product.name}</div>
        <div className="pp">${(product.discount_price ?? product.price).toLocaleString('es-CL')}</div>
      </div>
    </button>
  )
}
