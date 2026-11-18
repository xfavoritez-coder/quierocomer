'use client'

import { useCallback, useEffect, useState } from 'react'
import { useStaff } from '@/lib/pos'
import type { StorefrontData } from '@/lib/ecommerce/storefront-data'
import PosQuickOrder from './PosQuickOrder'

const F = "var(--sans, 'Inter', system-ui, sans-serif)"
const AMBER = '#f59e0b'

interface Props {
  restaurantId: string
  open: boolean
  onClose: () => void
  onOrderCreated: () => void
  tableLabel?: string | null
  existingOrderId?: string | null
}

// ── Pre-fetch cache ──────────────────────────────────────────
const cache = new Map<string, { data: StorefrontData | null; loading: boolean }>()

export function prefetchMenu(restaurantId: string) {
  if (!restaurantId || cache.get(restaurantId)?.data) return
  if (cache.get(restaurantId)?.loading) return
  const entry = { data: null as StorefrontData | null, loading: true }
  cache.set(restaurantId, entry)
  fetch(`/api/panel/ecommerce/menu?restaurantId=${restaurantId}`, { cache: 'no-store' })
    .then(r => r.ok ? r.json() : null)
    .then(d => { entry.data = d; entry.loading = false })
    .catch(() => { entry.loading = false })
}

function getCachedMenu(restaurantId: string): StorefrontData | null {
  return cache.get(restaurantId)?.data || null
}

// ── Mesa Modal ──────────────────────────────────────────────
function MesaSetupModal({ garzones, onConfirm, onClose }: {
  garzones: string[]
  onConfirm: (covers: number, garzon: string) => void
  onClose: () => void
}) {
  const [covers, setCovers] = useState(2)
  const [garzon, setGarzon] = useState(garzones[0] || '')

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(15,23,42,.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 340, background: '#fff', borderRadius: 20, padding: '28px 24px', boxShadow: '0 20px 60px rgba(0,0,0,.2)', animation: 'npSlideUp .2s ease-out' }}>
        {/* Icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: `${AMBER}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={AMBER} strokeWidth="2"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v10"/><path d="M19 8v10"/><path d="M3 18h18"/></svg>
          </div>
        </div>
        <h3 style={{ fontFamily: F, fontSize: 18, fontWeight: 800, color: '#111', textAlign: 'center', margin: '0 0 20px' }}>Abrir mesa</h3>

        {/* Covers */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>Comensales</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setCovers(Math.max(1, covers - 1))}
              style={{ width: 38, height: 38, borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: 18, fontWeight: 700 }}>−</button>
            <input type="number" value={covers} min={1} max={50}
              onChange={e => setCovers(Math.max(1, parseInt(e.target.value) || 1))}
              style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontFamily: F, fontSize: 18, fontWeight: 800, color: '#111', outline: 'none', boxSizing: 'border-box' }} />
            <button onClick={() => setCovers(covers + 1)}
              style={{ width: 38, height: 38, borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: 18, fontWeight: 700 }}>+</button>
          </div>
        </div>

        {/* Garzon */}
        {garzones.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>Garzon</label>
            <select value={garzon} onChange={e => setGarzon(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontFamily: F, fontSize: 14, color: '#111', outline: 'none', background: '#fff', cursor: 'pointer', boxSizing: 'border-box' }}>
              {garzones.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6b7280', fontFamily: F, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={() => onConfirm(covers, garzon)}
            style={{ flex: 2, padding: '12px', borderRadius: 12, border: 'none', background: AMBER, color: '#fff', fontFamily: F, fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
            Abrir mesa
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Modal ──────────────────────────────────────────────
export default function NuevoPedidoModal({ restaurantId, open, onClose, onOrderCreated, tableLabel, existingOrderId }: Props) {
  const [minimized, setMinimized] = useState(false)
  const [key, setKey] = useState(0)
  const isMesa = !!tableLabel
  const staff = useStaff(restaurantId)
  const garzones = (staff || []).filter(g => g.active !== false).map(g => g.name)
  const [preloaded, setPreloaded] = useState<StorefrontData | null>(null)
  const [mesaSetup, setMesaSetup] = useState<{ show: boolean; covers: number; garzon: string }>({ show: isMesa && !existingOrderId, covers: 2, garzon: '' })

  useEffect(() => {
    if (isMesa && !existingOrderId) setMesaSetup({ show: true, covers: 2, garzon: garzones[0] || '' })
    else setMesaSetup(prev => ({ ...prev, show: false }))
  }, [isMesa, existingOrderId, open])

  // Load cached menu
  useEffect(() => {
    if (!open || minimized) return
    const cached = getCachedMenu(restaurantId)
    if (cached) { setPreloaded(cached); return }
    prefetchMenu(restaurantId)
    const iv = setInterval(() => {
      const c = getCachedMenu(restaurantId)
      if (c) { setPreloaded(c); clearInterval(iv) }
    }, 100)
    return () => clearInterval(iv)
  }, [open, minimized, restaurantId])

  const handleDone = useCallback(() => {
    setMinimized(false)
    setKey(k => k + 1)
    onClose()
    onOrderCreated()
  }, [onClose, onOrderCreated])

  const handleCloseOrMinimize = useCallback(() => setMinimized(true), [])
  const handleForceClose = useCallback(() => { setMinimized(false); setKey(k => k + 1); onClose() }, [onClose])

  useEffect(() => {
    if (!open || minimized) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleCloseOrMinimize() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, minimized, handleCloseOrMinimize])

  if (!open && !minimized) return null

  // ── Minimized pill ──
  if (minimized) {
    return (
      <button onClick={() => setMinimized(false)}
        style={{
          position: 'fixed', bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))', right: 20, zIndex: 200,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 22px', borderRadius: 999,
          background: '#1e293b', color: '#fff', border: 'none', cursor: 'pointer',
          boxShadow: '0 8px 32px rgba(0,0,0,.3)', fontFamily: F, fontSize: 14, fontWeight: 700,
          animation: 'npPillIn .3s ease-out',
        }}>
        <style>{`@keyframes npPillIn{from{transform:translateY(80px);opacity:0}to{transform:translateY(0);opacity:1}}@keyframes npFadeIn{from{opacity:0}to{opacity:1}}@keyframes npSlideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={AMBER} strokeWidth="2.2">
          <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 4.6A1 1 0 0 0 5.6 19H17"/>
          <circle cx="9" cy="21" r="1"/><circle cx="18" cy="21" r="1"/>
        </svg>
        Pedido en curso
        <span style={{ background: AMBER, color: '#000', fontWeight: 900, fontSize: 11, padding: '2px 8px', borderRadius: 999 }}>Continuar</span>
      </button>
    )
  }

  // ── Full modal ──
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(15,23,42,.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'stretch', justifyContent: 'center', animation: 'npFadeIn .15s ease-out' }}
      onClick={handleCloseOrMinimize}>
      <style>{`@keyframes npFadeIn{from{opacity:0}to{opacity:1}}@keyframes npSlideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 1200, margin: 16, background: '#f8fafc', borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,.35)', animation: 'npSlideUp .2s ease-out', position: 'relative' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: '#fff', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: `${AMBER}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={AMBER} strokeWidth="2.2"><path d="M12 5v14M5 12h14"/></svg>
            </div>
            <span style={{ fontFamily: F, fontSize: 16, fontWeight: 800, color: '#111827' }}>
              {isMesa ? `Mesa ${tableLabel}` : 'Nuevo pedido'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={handleCloseOrMinimize} title="Minimizar" style={{ background: '#f3f4f6', border: 'none', cursor: 'pointer', padding: '6px 8px', color: '#6b7280', display: 'flex', borderRadius: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 12h14"/></svg>
            </button>
            <button onClick={handleForceClose} title="Cerrar" style={{ background: '#f3f4f6', border: 'none', cursor: 'pointer', padding: '6px 8px', color: '#6b7280', display: 'flex', borderRadius: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0, padding: '12px 14px 8px' }}>
          {!preloaded ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 8, color: '#9ca3af', fontFamily: F, fontSize: 14 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              Cargando...
            </div>
          ) : (
            <PosQuickOrder
              key={key}
              restaurantId={restaurantId}
              data={preloaded}
              onDone={handleDone}
              isMesa={isMesa}
              tableLabel={tableLabel || undefined}
              existingOrderId={existingOrderId}
              covers={mesaSetup.covers}
              garzon={mesaSetup.garzon}
            />
          )}
        </div>

        {/* Mesa setup modal (overlay inside the modal) */}
        {isMesa && mesaSetup.show && (
          <MesaSetupModal
            garzones={garzones}
            onConfirm={(c, g) => setMesaSetup({ show: false, covers: c, garzon: g })}
            onClose={handleForceClose}
          />
        )}
      </div>
    </div>
  )
}
