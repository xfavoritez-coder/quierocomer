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
import type { CachedProduct, RoundItem, ItemModifier } from '@/lib/pos/types'
import PosHeader from '../components/PosHeader'
import ModifierModal from '../components/ModifierModal'
import OrderPanel from '../components/OrderPanel'

// TODO: will come from auth/context
const TEST_RESTAURANT_ID = 'test-restaurant'
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

  // Init context
  useState(() => {
    setRestaurantId(TEST_RESTAURANT_ID)
    setUserId(TEST_USER_ID)
  })

  // Filter products by category
  const filteredProducts = selectedCategory
    ? products.filter(p => p.category_id === selectedCategory).sort((a, b) => a.position - b.position)
    : products.sort((a, b) => {
        if (a.category_position !== b.category_position) return a.category_position - b.category_position
        return a.position - b.position
      })

  // ── Product tap (quick add) ────────────────────────────────────

  const quickAdd = useCallback((product: CachedProduct) => {
    // If product has modifiers, always open modal
    if (product.modifier_templates.some(t => t.groups.length > 0)) {
      setModalProduct(product)
      return
    }

    setOrderItems(prev => {
      const existing = prev.find(
        i => i.dish_id === product.id && i.modifiers.length === 0 && !i.note
      )
      if (existing) {
        return prev.map(i =>
          i.item_id === existing.item_id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [...prev, {
        item_id: uuidv4(),
        dish_id: product.id,
        dish_name: product.name,
        quantity: 1,
        unit_price: product.discount_price ?? product.price,
        modifiers: [],
      }]
    })
  }, [])

  // ── Long press (open modifier modal) ────────────────────────────

  const onPointerDown = useCallback((product: CachedProduct) => {
    longPressTriggered.current = false
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true
      setModalProduct(product)
    }, 500)
  }, [])

  const onPointerUp = useCallback((product: CachedProduct) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    if (!longPressTriggered.current) {
      quickAdd(product)
    }
  }, [quickAdd])

  const onPointerCancel = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  // ── Modifier modal confirm ──────────────────────────────────────

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

  // ── Order management ────────────────────────────────────────────

  const updateQuantity = useCallback((itemId: string, delta: number) => {
    setOrderItems(prev =>
      prev
        .map(i => i.item_id === itemId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i)
        .filter(i => i.quantity > 0)
    )
  }, [])

  const removeItem = useCallback((itemId: string) => {
    setOrderItems(prev => prev.filter(i => i.item_id !== itemId))
  }, [])

  // ── Send to kitchen ─────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    if (orderItems.length === 0) return
    setSending(true)

    try {
      // If no account, create one (mostrador by default)
      let targetAccountId = accountId
      if (!targetAccountId) {
        targetAccountId = uuidv4()
        await openAccount({
          account_id: targetAccountId,
          account_type: 'mostrador',
        })
      }

      await sendRound({
        round_id: uuidv4(),
        account_id: targetAccountId,
        items: orderItems,
      })

      toast.success(`Ronda enviada (${orderItems.length} ítems)`)
      setOrderItems([])
      setShowOrder(false)
    } catch (err) {
      toast.error('Error al enviar: ' + String(err))
    } finally {
      setSending(false)
    }
  }, [orderItems, accountId])

  const itemCount = orderItems.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <div className="h-dvh flex flex-col bg-white">
      <PosHeader
        title="Comandero"
        syncing={syncing}
        onBack={() => router.push('/pos')}
      />

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-amber-200 border-t-amber-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* ── Desktop: Categories sidebar ──────────── */}
          <aside className="hidden sm:flex flex-col w-48 border-r border-stone-100 overflow-y-auto shrink-0">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-3 text-left text-sm font-medium transition-colors ${
                !selectedCategory
                  ? 'bg-amber-50 text-amber-700 border-r-2 border-amber-500'
                  : 'text-stone-600 hover:bg-stone-50'
              }`}
            >
              Todo
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-3 text-left text-sm font-medium transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-amber-50 text-amber-700 border-r-2 border-amber-500'
                    : 'text-stone-600 hover:bg-stone-50'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </aside>

          {/* ── Products grid ────────────────────────── */}
          <main className="flex-1 overflow-y-auto">
            {/* Mobile category pills */}
            <div className="sm:hidden sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-stone-100 px-3 py-2 flex gap-2 overflow-x-auto scrollbar-none">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`shrink-0 px-3.5 py-2 rounded-full text-sm font-medium transition-colors ${
                  !selectedCategory
                    ? 'bg-amber-500 text-white'
                    : 'bg-stone-100 text-stone-600'
                }`}
              >
                Todo
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`shrink-0 px-3.5 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                    selectedCategory === cat.id
                      ? 'bg-amber-500 text-white'
                      : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {filteredProducts.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-stone-400 text-sm">
                {products.length === 0
                  ? 'Sin productos en el catálogo'
                  : 'Sin productos en esta categoría'
                }
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 p-3">
                {filteredProducts.map(product => (
                  <button
                    key={product.id}
                    onPointerDown={() => onPointerDown(product)}
                    onPointerUp={() => onPointerUp(product)}
                    onPointerLeave={onPointerCancel}
                    onContextMenu={e => e.preventDefault()}
                    className="flex flex-col bg-stone-50 hover:bg-stone-100 active:bg-amber-50 rounded-2xl p-3 text-left transition-all active:scale-[0.97] select-none touch-manipulation"
                    style={{ minHeight: 100 }}
                  >
                    {product.photos[0] && (
                      <img
                        src={product.photos[0]}
                        alt=""
                        className="w-full aspect-square rounded-xl object-cover mb-2"
                        draggable={false}
                      />
                    )}
                    <span className="text-sm font-medium text-stone-800 leading-tight line-clamp-2 flex-1">
                      {product.name}
                    </span>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-sm font-semibold text-amber-600 tabular-nums">
                        ${(product.discount_price ?? product.price).toLocaleString('es-CL')}
                      </span>
                      {product.modifier_templates.some(t => t.groups.length > 0) && (
                        <span className="text-[10px] text-stone-400">⋯</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </main>

          {/* ── Desktop: Order sidebar ────────────────── */}
          <aside className="hidden sm:flex flex-col w-72 lg:w-80 border-l border-stone-100 bg-white">
            <div className="px-4 py-3 border-b border-stone-100">
              <h2 className="text-sm font-semibold text-stone-700" style={{ fontFamily: 'var(--font-display)' }}>
                Pedido actual
              </h2>
            </div>
            <OrderPanel
              items={orderItems}
              onUpdateQuantity={updateQuantity}
              onRemove={removeItem}
              onSend={handleSend}
              sending={sending}
            />
          </aside>
        </div>
      )}

      {/* ── Mobile: Order fab + slide-up ──────────── */}
      {itemCount > 0 && !showOrder && (
        <button
          onClick={() => setShowOrder(true)}
          className="sm:hidden fixed bottom-6 left-4 right-4 h-14 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white font-semibold flex items-center justify-between px-6 shadow-lg shadow-amber-500/25 transition-all z-20"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <span>Ver pedido ({itemCount})</span>
          <span className="tabular-nums">
            ${orderItems.reduce((sum, i) => {
              const modExtra = i.modifiers.reduce((s, m) => s + m.price_adjustment, 0)
              return sum + i.quantity * (i.unit_price + modExtra)
            }, 0).toLocaleString('es-CL')}
          </span>
        </button>
      )}

      {/* Mobile order panel */}
      {showOrder && (
        <div className="sm:hidden fixed inset-0 z-40 flex flex-col">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowOrder(false)} />
          <div className="relative mt-auto bg-white rounded-t-2xl max-h-[80dvh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <h2 className="text-base font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                Pedido actual
              </h2>
              <button
                onClick={() => setShowOrder(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 text-stone-400"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <OrderPanel
              items={orderItems}
              onUpdateQuantity={updateQuantity}
              onRemove={removeItem}
              onSend={handleSend}
              sending={sending}
            />
          </div>
        </div>
      )}

      {/* Modifier modal */}
      {modalProduct && (
        <ModifierModal
          product={modalProduct}
          onConfirm={handleModifierConfirm}
          onClose={() => setModalProduct(null)}
        />
      )}
    </div>
  )
}
