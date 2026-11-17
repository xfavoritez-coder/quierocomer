'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { TomarPedidos } from '@/app/(panel)/panel/centro-pedidos/tomar-pedidos/page'
import { useStaff } from '@/lib/pos'

const F = "var(--sans, 'Inter', system-ui, sans-serif)"

interface Props {
  restaurantId: string
  open: boolean
  onClose: () => void
  onOrderCreated: () => void
  // Mesa mode
  tableLabel?: string | null
  existingOrderId?: string | null
}

// Pre-fetch cache: menu data stored per restaurantId to avoid re-fetch on every open
const menuCache = new Map<string, { promise: Promise<void>; ready: boolean }>()

export function prefetchMenu(restaurantId: string) {
  if (!restaurantId || menuCache.has(restaurantId)) return
  const p = fetch(`/api/panel/ecommerce/menu?restaurantId=${restaurantId}`, { cache: 'no-store' })
    .then(() => { const c = menuCache.get(restaurantId); if (c) c.ready = true })
    .catch(() => {})
  menuCache.set(restaurantId, { promise: p as any, ready: false })
}

export default function NuevoPedidoModal({ restaurantId, open, onClose, onOrderCreated, tableLabel, existingOrderId }: Props) {
  const [minimized, setMinimized] = useState(false)
  const [hasItems, setHasItems] = useState(false)
  const [itemCount, setItemCount] = useState(0)
  const [total, setTotal] = useState(0)
  const isMesa = !!tableLabel
  const staff = useStaff(restaurantId)
  const containerRef = useRef<HTMLDivElement>(null)

  // Track cart state from TomarPedidos via DOM observation
  // (TomarPedidos manages its own state, we peek at it for the pill)
  useEffect(() => {
    if (!open || minimized) return
    const iv = setInterval(() => {
      const el = containerRef.current
      if (!el) return
      // Count cart items by looking at the cart badge or items
      const badge = el.querySelector('[data-cart-count]')
      if (badge) {
        const count = parseInt(badge.textContent || '0', 10)
        setItemCount(count)
        setHasItems(count > 0)
      }
      // Get total from the summary
      const totalEl = el.querySelector('[data-cart-total]')
      if (totalEl) {
        const t = parseInt((totalEl.textContent || '0').replace(/\D/g, ''), 10)
        setTotal(t)
      }
    }, 1000)
    return () => clearInterval(iv)
  }, [open, minimized])

  const handleDone = useCallback(() => {
    setHasItems(false)
    setItemCount(0)
    setTotal(0)
    setMinimized(false)
    onClose()
    onOrderCreated()
  }, [onClose, onOrderCreated])

  const handleMinimize = useCallback(() => {
    setMinimized(true)
  }, [])

  const handleRestore = useCallback(() => {
    setMinimized(false)
  }, [])

  const handleCloseOrMinimize = useCallback(() => {
    if (hasItems) {
      // Si tiene items, minimizar en vez de cerrar
      setMinimized(true)
    } else {
      setMinimized(false)
      onClose()
    }
  }, [hasItems, onClose])

  // Escape key
  useEffect(() => {
    if (!open || minimized) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCloseOrMinimize()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, minimized, handleCloseOrMinimize])

  if (!open && !minimized) return null

  // ── Minimized pill ──────────────────────────────────────────
  if (minimized) {
    return (
      <button
        onClick={handleRestore}
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 200,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 20px', borderRadius: 999,
          background: '#1e293b', color: '#fff',
          border: 'none', cursor: 'pointer',
          boxShadow: '0 8px 32px rgba(0,0,0,.25), 0 2px 8px rgba(0,0,0,.15)',
          fontFamily: F, fontSize: 14, fontWeight: 700,
          transition: 'transform .15s',
          animation: 'slideUpPill .3s ease-out',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <style>{`@keyframes slideUpPill { from { transform: translateY(80px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }`}</style>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2">
          <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 4.6A1 1 0 0 0 5.6 19H17"/>
          <circle cx="9" cy="21" r="1"/><circle cx="18" cy="21" r="1"/>
        </svg>
        <span>Pedido en curso</span>
        {itemCount > 0 && (
          <span style={{ background: '#f59e0b', color: '#000', fontWeight: 900, fontSize: 12, padding: '2px 8px', borderRadius: 999 }}>
            {itemCount}
          </span>
        )}
        {total > 0 && (
          <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, color: '#94a3b8' }}>
            ${total.toLocaleString('es-CL')}
          </span>
        )}
      </button>
    )
  }

  // ── Full modal ──────────────────────────────────────────
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'env(safe-area-inset-top, 0px) 0 0',
        animation: 'fadeInModal .2s ease-out',
      }}
      onClick={handleCloseOrMinimize}
    >
      <style>{`
        @keyframes fadeInModal { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUpModal { from { transform: translateY(30px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        .np-modal-inner { animation: slideUpModal .25s ease-out; }
        /* Override TomarPedidos styles inside modal */
        .np-modal-inner .pos-tomar-wrap { padding: 0 !important; min-height: 0 !important; background: transparent !important; }
      `}</style>
      <div
        ref={containerRef}
        className="np-modal-inner"
        onClick={e => e.stopPropagation()}
        style={{
          width: '95vw', maxWidth: 1200,
          height: '92dvh', maxHeight: '92dvh',
          background: 'var(--surface, #fff)',
          borderRadius: 20,
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 80px rgba(0,0,0,.3)',
          position: 'relative',
        }}
      >
        {/* Header bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', borderBottom: '1px solid var(--line, #e5e7eb)',
          flexShrink: 0, background: 'var(--surface, #fff)',
        }}>
          <span style={{ fontFamily: F, fontSize: 15, fontWeight: 800, color: 'var(--ink, #111)' }}>
            {isMesa ? `Mesa ${tableLabel}` : 'Nuevo pedido'}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            {/* Minimize */}
            <button
              onClick={handleMinimize}
              title="Minimizar"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--ink-3, #999)', display: 'flex', borderRadius: 8 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 12h14"/></svg>
            </button>
            {/* Close */}
            <button
              onClick={handleCloseOrMinimize}
              title={hasItems ? 'Minimizar' : 'Cerrar'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--ink-3, #999)', display: 'flex', borderRadius: 8 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        {/* Content: TomarPedidos */}
        <div style={{ flex: 1, overflow: 'auto', background: '#f8fafc' }}>
          <div className="pos-tomar-wrap" style={{ padding: '16px 24px', minHeight: '100%' }}>
            <TomarPedidos
              restaurantId={restaurantId}
              backHref=""
              backLabel=""
              disableToteat
              tableLabel={tableLabel}
              existingOrderId={existingOrderId}
              garzones={isMesa ? (staff || []).filter(g => g.active !== false).map(g => g.name) : []}
              onDone={handleDone}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
