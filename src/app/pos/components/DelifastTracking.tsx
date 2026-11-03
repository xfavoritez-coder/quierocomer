'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

// Mapa Leaflet solo en cliente (reutiliza el del seguimiento del ecommerce).
const OrderTrackingMap = dynamic(() => import('@/components/ecommerce/OrderTrackingMap'), { ssr: false })

type Pt = { lat: number; lng: number } | null
interface Tracking {
  idViaje: string | null
  status: string | null
  provider: string | null
  vehicle: string | null
  eta: string | null
  driver: { name: string | null; photo: string | null; phone: string | null } | null
  pin: string | null
  statusUrl: string | null
  codigoOrigen: string | null
  location: { lat: number; lng: number; at: string | null } | null
  store: Pt
  customer: Pt
  timeline: {
    confirmacion: string | null; inicioPickup: string | null; llegadaLocal: string | null
    inicioDropoff: string | null; llegadaCasa: string | null; entregado: string | null; cancelado: string | null
  }
}

// Color del estado del reparto.
function statusColor(s?: string | null): string {
  const e = (s || '').toLowerCase()
  if (/entregad|delivered/.test(e)) return '#16a34a'
  if (/cancel|anul/.test(e)) return '#dc2626'
  if (/camino|reparto|ruta|dropoff|transit/.test(e)) return '#3b82f6'
  if (/local|pickup|retir/.test(e)) return '#8b5cf6'
  if (/asignad|assigned|confirmad|buscando|accept/.test(e)) return '#f59e0b'
  return '#64748b'
}

// Etiqueta en español del estado (Delifast a veces lo manda en inglés).
function statusLabel(s?: string | null): string {
  const e = (s || '').toLowerCase().trim()
  if (!e) return 'Reparto'
  if (/entregad|delivered/.test(e)) return 'Entregado'
  if (/cancel|anul/.test(e)) return 'Cancelado'
  if (/dropoff|transit|camino|ruta/.test(e)) return 'En camino'
  if (/arriving_pickup|at_pickup|pickup|en.?local|llegó.*local/.test(e)) return 'En el local'
  if (/assigned|asignad/.test(e)) return 'Asignado'
  if (/accept|confirmad/.test(e)) return 'Confirmado'
  if (/buscando|searching|pending/.test(e)) return 'Buscando repartidor'
  return e.charAt(0).toUpperCase() + e.slice(1)
}

// pickup_eta puede venir como minutos ("4") o como timestamp ("2026-11-03 18:13:33").
// Devuelve minutos hasta la hora estimada (0 si ya pasó), o null.
function etaMinutes(eta?: string | null): number | null {
  if (!eta) return null
  const s = String(eta).trim()
  if (/^\d+$/.test(s)) return Number(s)
  const t = Date.parse(s.replace(' ', 'T'))
  if (!Number.isFinite(t)) return null
  return Math.max(0, Math.round((t - Date.now()) / 60000))
}

// "YYYY-MM-DD HH:MM:SS" → "HH:MM"
function hm(ts?: string | null): string | null {
  if (!ts) return null
  const m = String(ts).match(/\b(\d{1,2}):(\d{2})/)
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null
}

export default function DelifastTracking({ restaurantId, posOrderId }: { restaurantId: string; posOrderId: string }) {
  const [state, setState] = useState<'loading' | 'off' | 'pending' | 'error' | 'ok'>('loading')
  const [t, setT] = useState<Tracking | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/pos/delivery-tracking?restaurantId=${restaurantId}&posOrderId=${posOrderId}`, { cache: 'no-store' })
        const d = await res.json()
        if (cancelled) return
        if (!d.configured) { setState('off'); return }
        if (d.pending) { setState('pending'); return }
        if (d.error || !d.tracking) { setState(prev => prev === 'ok' ? 'ok' : 'error'); return }
        setT(d.tracking); setState('ok')
      } catch { if (!cancelled) setState(prev => prev === 'ok' ? 'ok' : 'error') }
    }
    load()
    timer.current = setInterval(load, 15000) // refresco en vivo mientras el panel está abierto
    return () => { cancelled = true; if (timer.current) clearInterval(timer.current) }
  }, [restaurantId, posOrderId])

  // No mostrar nada si Delifast no está configurado para el local.
  if (state === 'off') return null

  const Box = ({ children }: { children: React.ReactNode }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/></svg>
        <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--ink)' }}>Reparto Delifast</span>
      </div>
      {children}
    </div>
  )

  if (state === 'loading') return <Box><span style={{ fontSize: 13, color: 'var(--ink-3)' }}>Cargando seguimiento…</span></Box>
  if (state === 'pending') return <Box><span style={{ fontSize: 13, color: 'var(--ink-3)' }}>Aún sin repartidor asignado en Delifast.</span></Box>
  if (state === 'error' || !t) return <Box><span style={{ fontSize: 13, color: 'var(--ink-3)' }}>No se pudo leer el seguimiento de Delifast.</span></Box>

  const sc = statusColor(t.status)
  // ETA al local: solo tiene sentido antes de que el repartidor llegue al local.
  const etaMin = !t.timeline.llegadaLocal ? etaMinutes(t.eta) : null
  const steps: { label: string; ts: string | null }[] = [
    { label: 'Confirmada', ts: t.timeline.confirmacion },
    { label: 'Pickup iniciado', ts: t.timeline.inicioPickup },
    { label: 'Llegó al local', ts: t.timeline.llegadaLocal },
    { label: 'En camino', ts: t.timeline.inicioDropoff },
    { label: 'Llegó al cliente', ts: t.timeline.llegadaCasa },
    { label: 'Entregado', ts: t.timeline.entregado },
  ]
  if (t.timeline.cancelado) steps.push({ label: 'Cancelado', ts: t.timeline.cancelado })

  return (
    <Box>
      {/* Estado + ETA */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: sc + '18', color: sc, border: `1px solid ${sc}40`, fontWeight: 700, fontSize: 12.5, borderRadius: 20, padding: '3px 10px' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: sc }} />
          {statusLabel(t.status)}
        </span>
        {etaMin != null && <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>Llega al local en <b>{etaMin} min</b></span>}
        {(t.provider || t.vehicle) && <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{[t.provider, t.vehicle].filter(Boolean).join(' · ')}</span>}
      </div>

      {/* Repartidor */}
      {t.driver && (t.driver.name || t.driver.phone) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {t.driver.photo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={t.driver.photo} alt="" width={44} height={44} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--line)' }} />
            : <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--sunk)', display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M20 20c0-4.4-3.6-8-8-8s-8 3.6-8 8z"/></svg>
              </div>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--ink)' }}>{t.driver.name || 'Repartidor'}</div>
            {t.driver.phone && <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>{t.driver.phone}</div>}
          </div>
          {t.driver.phone && (
            <a href={`tel:${t.driver.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11 11 0 0 0 3.5.56 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.3a1 1 0 0 1 1 1 11 11 0 0 0 .56 3.5 1 1 0 0 1-.25 1z"/></svg>
              Llamar
            </a>
          )}
        </div>
      )}

      {/* PIN de entrega */}
      {t.pin && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>PIN de entrega</span>
          <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 18, letterSpacing: '.08em', color: 'var(--ink)', background: 'var(--sunk)', border: '1px solid var(--line)', borderRadius: 8, padding: '2px 10px' }}>{t.pin}</span>
        </div>
      )}

      {/* Mapa en vivo */}
      {(t.location || t.store || t.customer) && (
        <div style={{ height: 180, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--line)' }}>
          <OrderTrackingMap driver={t.location} customer={t.customer} store={t.store} />
        </div>
      )}

      {/* Timeline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {steps.map((s, i) => {
          const done = !!s.ts
          const isCancel = s.label === 'Cancelado'
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '3px 0' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', flexShrink: 0, background: done ? (isCancel ? '#dc2626' : '#16a34a') : 'var(--line-strong)' }} />
              <span style={{ flex: 1, fontSize: 13, color: done ? 'var(--ink)' : 'var(--ink-4)' }}>{s.label}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12.5, color: 'var(--ink-3)' }}>{hm(s.ts) || '—'}</span>
            </div>
          )
        })}
      </div>

      {/* Link público */}
      {t.statusUrl && (
        <a href={t.statusUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600, textDecoration: 'none' }}>
          Ver seguimiento en vivo ↗
        </a>
      )}
    </Box>
  )
}
