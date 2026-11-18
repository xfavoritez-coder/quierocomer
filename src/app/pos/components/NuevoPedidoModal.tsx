'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { TomarPedidos } from '@/app/(panel)/panel/centro-pedidos/tomar-pedidos/page'
import { useStaff } from '@/lib/pos'
import type { StorefrontData } from '@/lib/ecommerce/storefront-data'

const F = "var(--sans, 'Inter', system-ui, sans-serif)"

interface Props {
  restaurantId: string
  open: boolean
  onClose: () => void
  onOrderCreated: () => void
  tableLabel?: string | null
  existingOrderId?: string | null
}

// ── Pre-fetch cache ──────────────────────────────────────────
const cache = new Map<string, { data: StorefrontData | null; loading: boolean; promise: Promise<void> | null }>()

export function prefetchMenu(restaurantId: string) {
  if (!restaurantId || cache.get(restaurantId)?.data) return
  if (cache.get(restaurantId)?.loading) return
  const entry = { data: null as StorefrontData | null, loading: true, promise: null as Promise<void> | null }
  entry.promise = fetch(`/api/panel/ecommerce/menu?restaurantId=${restaurantId}`, { cache: 'no-store' })
    .then(r => r.ok ? r.json() : null)
    .then(d => { entry.data = d; entry.loading = false })
    .catch(() => { entry.loading = false })
  cache.set(restaurantId, entry)
}

function getCachedMenu(restaurantId: string): StorefrontData | null {
  return cache.get(restaurantId)?.data || null
}

// ── Component ──────────────────────────────────────────────
export default function NuevoPedidoModal({ restaurantId, open, onClose, onOrderCreated, tableLabel, existingOrderId }: Props) {
  const [minimized, setMinimized] = useState(false)
  const [key, setKey] = useState(0) // force remount on new order
  const isMesa = !!tableLabel
  const staff = useStaff(restaurantId)
  const [preloaded, setPreloaded] = useState<StorefrontData | null>(null)

  // When opening, check cache
  useEffect(() => {
    if (!open || minimized) return
    const cached = getCachedMenu(restaurantId)
    if (cached) {
      setPreloaded(cached)
    } else {
      // Start fetch if not cached
      prefetchMenu(restaurantId)
      // Poll for completion
      const iv = setInterval(() => {
        const c = getCachedMenu(restaurantId)
        if (c) { setPreloaded(c); clearInterval(iv) }
      }, 100)
      return () => clearInterval(iv)
    }
  }, [open, minimized, restaurantId])

  const handleDone = useCallback(() => {
    setMinimized(false)
    setKey(k => k + 1)
    onClose()
    onOrderCreated()
  }, [onClose, onOrderCreated])

  const handleCloseOrMinimize = useCallback(() => {
    setMinimized(true)
  }, [])

  const handleForceClose = useCallback(() => {
    setMinimized(false)
    setKey(k => k + 1)
    onClose()
  }, [onClose])

  // Escape key
  useEffect(() => {
    if (!open || minimized) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleCloseOrMinimize() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, minimized, handleCloseOrMinimize])

  if (!open && !minimized) return null

  // ── Minimized pill ──────────────────────────────────────────
  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        style={{
          position: 'fixed', bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))', right: 20, zIndex: 200,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 22px', borderRadius: 999,
          background: '#1e293b', color: '#fff',
          border: 'none', cursor: 'pointer',
          boxShadow: '0 8px 32px rgba(0,0,0,.3), 0 2px 8px rgba(0,0,0,.15)',
          fontFamily: F, fontSize: 14, fontWeight: 700,
          animation: 'npPillIn .3s ease-out',
        }}
      >
        <style>{`@keyframes npPillIn{from{transform:translateY(80px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2">
          <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 4.6A1 1 0 0 0 5.6 19H17"/>
          <circle cx="9" cy="21" r="1"/><circle cx="18" cy="21" r="1"/>
        </svg>
        <span>Pedido en curso</span>
        <span style={{ background: '#f59e0b', color: '#000', fontWeight: 900, fontSize: 11, padding: '2px 8px', borderRadius: 999 }}>
          Continuar
        </span>
      </button>
    )
  }

  // ── Full modal ──────────────────────────────────────────
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(15,23,42,.6)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'stretch', justifyContent: 'center',
        animation: 'npFadeIn .15s ease-out',
      }}
      onClick={handleCloseOrMinimize}
    >
      <style>{`
        @keyframes npFadeIn{from{opacity:0}to{opacity:1}}
        @keyframes npSlideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
      `}</style>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 1200,
          margin: '16px',
          background: '#f8fafc',
          borderRadius: 20,
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 80px rgba(0,0,0,.35)',
          animation: 'npSlideUp .2s ease-out',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 18px', background: '#fff',
          borderBottom: '1px solid #e5e7eb', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </div>
            <span style={{ fontFamily: F, fontSize: 16, fontWeight: 800, color: '#111827' }}>
              {isMesa ? `Mesa ${tableLabel}` : 'Nuevo pedido'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={handleCloseOrMinimize} title="Minimizar"
              style={{ background: '#f3f4f6', border: 'none', cursor: 'pointer', padding: '6px 8px', color: '#6b7280', display: 'flex', borderRadius: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 12h14"/></svg>
            </button>
            <button onClick={handleForceClose} title="Cerrar"
              style={{ background: '#f3f4f6', border: 'none', cursor: 'pointer', padding: '6px 8px', color: '#6b7280', display: 'flex', borderRadius: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <TomarPedidos
              key={key}
              restaurantId={restaurantId}
              backHref=""
              backLabel=""
              disableToteat
              tableLabel={tableLabel}
              existingOrderId={existingOrderId}
              garzones={isMesa ? (staff || []).filter(g => g.active !== false).map(g => g.name) : []}
              onDone={handleDone}
              preloadedData={preloaded}
              modalMode
            />
          </div>
        </div>
      </div>
    </div>
  )
}
