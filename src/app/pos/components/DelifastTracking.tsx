'use client'

import { useEffect, useRef, useState } from 'react'
import { Motorbike } from 'lucide-react'

// Keyframe para pill de cancelación pulsante — inyectado una sola vez.
let _pulseInjected = false
function injectPulse() {
  if (_pulseInjected || typeof document === 'undefined') return
  _pulseInjected = true
  const s = document.createElement('style')
  s.textContent = `@keyframes delifast-cancel-pulse{0%,100%{opacity:1}50%{opacity:.55}}`
  document.head.appendChild(s)
}

type Pt = { lat: number; lng: number } | null
interface Tracking {
  idViaje: string | null
  status: string | null
  provider: string | null
  vehicle: string | null
  eta: string | null
  dropoffEta: string | null
  driver: { name: string | null; photo: string | null; phone: string | null } | null
  pin: string | null
  statusUrl: string | null
  deliveryPhoto: string | null
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
export function statusColor(s?: string | null): string {
  const e = (s || '').toLowerCase()
  if (/entregad|delivered/.test(e)) return '#16a34a'
  if (/cancel|anul/.test(e)) return '#dc2626'
  if (/camino|reparto|ruta|dropoff|transit|at_dropoff|arriving_dropoff/.test(e)) return '#3b82f6'
  if (/local|pickup|retir/.test(e)) return '#8b5cf6'
  if (/asignad|assigned|confirmad|buscando|accept/.test(e)) return '#f59e0b'
  return '#64748b'
}

// Etiqueta en español del estado (Delifast a veces lo manda en inglés).
export function statusLabel(s?: string | null): string {
  const e = (s || '').toLowerCase().trim()
  if (!e) return 'Reparto'
  if (/entregad|delivered/.test(e)) return 'Entregado'
  if (/cancel|anul/.test(e)) return 'Cancelado'
  // "pickup" (solo o combinado "en pickup") = repartidor EN el local recogiendo.
  // Solo es "camino al local" cuando el status indica explícitamente que va en ruta.
  if (/at_pickup|arriving_pickup|en.?local|lleg[oó].*local|pickup/.test(e)) return 'Repartidor en local'
  if (/camino.*local|retir|en.?ruta.*pick|going.?pick/.test(e)) return 'Camino al local'
  if (/at_dropoff|arriving_dropoff|lleg[oó].*cas|en.?cas|lleg[oó].*cliente/.test(e)) return 'Llegó al cliente'
  if (/dropoff|transit|camino|ruta/.test(e)) return 'En camino'
  if (/assigned|asignad/.test(e)) return 'Asignado'
  if (/accept|confirmad/.test(e)) return 'Confirmado'
  if (/buscando|searching|pending/.test(e)) return 'Buscando repartidor'
  return e.charAt(0).toUpperCase() + e.slice(1)
}

// pickup_eta puede venir como minutos ("4"), timestamp ("2026-11-03 18:13:33") o
// solo hora "HH:MM" (dropoffEta de Delifast). Devuelve minutos hasta la hora
// estimada (0 si ya pasó), o null.
function etaMinutes(eta?: string | null): number | null {
  if (!eta) return null
  const s = String(eta).trim()
  if (/^\d+$/.test(s)) return Number(s)
  // "HH:MM" sin fecha: calcular minutos desde ahora hasta esa hora hoy (o mañana si ya pasó)
  const hm = s.match(/^(\d{1,2}):(\d{2})$/)
  if (hm) {
    const target = new Date()
    target.setHours(Number(hm[1]), Number(hm[2]), 0, 0)
    return Math.max(0, Math.round((target.getTime() - Date.now()) / 60000))
  }
  const t = Date.parse(s.replace(' ', 'T'))
  if (!Number.isFinite(t)) return null
  return Math.max(0, Math.round((t - Date.now()) / 60000))
}

// Convierte minutos (o timestamp "YYYY-MM-DD HH:MM:SS") a hora estimada "HH:MM".
// Devuelve null si los minutos son 0 o negativos (dato no disponible o ya pasado).
function etaToHM(eta?: string | null): string | null {
  const mins = etaMinutes(eta)
  if (mins === null || mins <= 0) return null
  const d = new Date(Date.now() + mins * 60000)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// "YYYY-MM-DD HH:MM:SS" → "HH:MM"
function hm(ts?: string | null): string | null {
  if (!ts) return null
  const m = String(ts).match(/\b(\d{1,2}):(\d{2})/)
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null
}

// Contenedor estable (a NIVEL DE MÓDULO): si se define dentro del componente,
// React lo ve como un tipo nuevo en cada render y re-monta el subárbol — eso
// reiniciaba el mapa Leaflet cada pocos segundos y perdía el marcador.
function TrackingBox({ children, eta, etaLabel = 'Llega en' }: { children: React.ReactNode; eta?: number | null; etaLabel?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Motorbike size={18} style={{ color: 'var(--ink-2)', flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>Motorista Delifast</span>
        {eta != null && eta > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
            {etaLabel} <b>{eta} min</b>
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

export default function DelifastTracking({ restaurantId, posOrderId, live = true }: { restaurantId: string; posOrderId: string; live?: boolean }) {
  const [state, setState] = useState<'loading' | 'off' | 'pending' | 'error' | 'ok'>('loading')
  const [t, setT] = useState<Tracking | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const [open, setOpen] = useState(false)

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
    // En historial (live=false) el pedido ya está entregado: no tiene sentido pollear.
    if (live) timer.current = setInterval(load, 15000)
    return () => { cancelled = true; if (timer.current) clearInterval(timer.current) }
  }, [restaurantId, posOrderId, live])

  // No mostrar nada si Delifast no está configurado para el local.
  if (state === 'off') return null

  if (state === 'loading') return (
    <div style={{ borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px' }}>
        <Motorbike size={18} style={{ color: 'var(--ink-2)', flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)', flex: 1 }}>Motorista Delifast</span>
        <span style={{ fontSize: 12.5, color: '#64748b', fontWeight: 600 }}>Cargando…</span>
      </div>
    </div>
  )
  // En historial (live=false) sin data de Delifast no se muestra nada.
  if (state === 'pending') {
    if (!live) return null
    return (
      <div style={{ borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px' }}>
          <Motorbike size={18} style={{ color: 'var(--ink-2)', flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)', flex: 1 }}>Motorista Delifast</span>
          <span style={{ fontSize: 12.5, color: '#64748b', fontWeight: 600 }}>Sin asignar</span>
        </div>
      </div>
    )
  }
  if (state === 'error' || !t) return (
    <div style={{ borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px' }}>
        <Motorbike size={18} style={{ color: 'var(--ink-2)', flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)', flex: 1 }}>Motorista Delifast</span>
        <span style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600 }}>Sin datos</span>
      </div>
    </div>
  )

  // ETA al local: solo tiene sentido antes de que el repartidor llegue al local.
  const etaMin = !t.timeline.llegadaLocal ? etaMinutes(t.eta) : null
  // ETA al cliente: solo tiene sentido mientras va al cliente (ya salió del local, aún no llegó).
  const dropoffEtaMin = t.timeline.llegadaLocal && !t.timeline.llegadaCasa ? etaMinutes(t.dropoffEta) : null
  const steps: { label: string; ts: string | null }[] = [
    { label: 'Confirmada', ts: t.timeline.confirmacion },
    { label: 'Pickup iniciado', ts: t.timeline.inicioPickup },
    { label: 'Llegó al local', ts: t.timeline.llegadaLocal },
    { label: 'En camino', ts: t.timeline.inicioDropoff },
    { label: 'Llegó al cliente', ts: t.timeline.llegadaCasa },
    { label: 'Entregado', ts: t.timeline.entregado },
  ]
  if (t.timeline.cancelado) steps.push({ label: 'Cancelado', ts: t.timeline.cancelado })

  // Right-side label for collapsed row
  const etaDisplay = dropoffEtaMin != null && dropoffEtaMin > 0
    ? `Entrega en ${dropoffEtaMin} min`
    : etaMin != null && etaMin > 0
    ? `Llega al local en ${etaMin} min`
    : null
  // Corregir status: Delifast mantiene "dropoff" aunque ya llegó al cliente
  const effectiveStatus = t.timeline.llegadaCasa && /dropoff|camino|ruta|transit/.test((t.status || '').toLowerCase())
    ? 'at_dropoff'
    : (t.status || '')
  const isPickupStatus = /pickup/.test((t.status || '').toLowerCase())
  const correctedLabel = (isPickupStatus && !t.timeline.llegadaLocal) ? 'Camino al local' : statusLabel(effectiveStatus)
  const displayStatus = etaDisplay ?? correctedLabel
  const displayColor = '#64748b'

  return (
    <div style={{ borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)' }}>
      {/* Always-visible toggle row */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 14px', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 12 }}
      >
        <Motorbike size={18} style={{ color: 'var(--ink-2)', flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)', flex: 1, textAlign: 'left' }}>Motorista Delifast</span>
        <span style={{ fontSize: 12.5, color: displayColor, fontWeight: 600, whiteSpace: 'nowrap' }}>{displayStatus}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          style={{ color: 'var(--ink-3)', flexShrink: 0, marginLeft: 4, transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {/* Expandable details — siempre en DOM, ocultado con display para evitar clipping */}
      <div style={{ display: open ? 'flex' : 'none', flexDirection: 'column', gap: 12, padding: '12px 14px 14px', borderTop: '1px solid var(--line)' }}>
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
            </div>
          )}

          {/* PIN de entrega */}
          {t.pin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>PIN de entrega</span>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 18, letterSpacing: '.08em', color: 'var(--ink)', background: 'var(--sunk)', border: '1px solid var(--line)', borderRadius: 8, padding: '2px 10px' }}>{t.pin}</span>
            </div>
          )}

          {/* Foto de la entrega */}
          {t.deliveryPhoto && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Foto de entrega</span>
              <a href={t.deliveryPhoto} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.deliveryPhoto} alt="Foto de la entrega al cliente" style={{ width: '100%', maxHeight: 280, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--line)', display: 'block' }} />
              </a>
            </div>
          )}

          {/* Timeline */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gridAutoFlow: 'column', gridTemplateRows: `repeat(${Math.ceil(steps.length / 2)}, auto)`,
            columnGap: 16, rowGap: 2,
          }}>
            {steps.map((s, i) => {
              const done = !!s.ts
              const isCancel = s.label === 'Cancelado'
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', minWidth: 0 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 12.5, color: 'var(--ink-3)', minWidth: 40, flexShrink: 0 }}>{hm(s.ts) || '—'}</span>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', flexShrink: 0, background: done ? (isCancel ? '#dc2626' : '#16a34a') : 'var(--line-strong)' }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: done ? 'var(--ink)' : 'var(--ink-4)' }}>{s.label}</span>
                </div>
              )
            })}
          </div>

          {/* Link público */}
          {t.statusUrl && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <a href={t.statusUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600, textDecoration: 'none' }}>
                Ver seguimiento en vivo ↗
              </a>
            </div>
          )}
        </div>
    </div>
  )
}

/** Pill compacto del estado Delifast para embeber en la tarjeta del board.
 *  Solo renderiza algo cuando Delifast está configurado y hay estado disponible. */
export function DelifastStatusPill({
  restaurantId, posOrderId, onCancelDetected,
}: {
  restaurantId: string
  posOrderId: string
  onCancelDetected?: () => void
}) {
  const [status, setStatus] = useState<string | null>(null)
  const [llegadaCasa, setLlegadaCasa] = useState<string | null>(null)
  const [llegadaLocal, setLlegadaLocal] = useState<string | null>(null)
  const [dropoffEta, setDropoffEta] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const cancelFiredRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/pos/delivery-tracking?restaurantId=${restaurantId}&posOrderId=${posOrderId}`, { cache: 'no-store' })
        const d = await res.json()
        if (cancelled) return
        if (!d.configured || d.pending || !d.tracking) return
        setStatus(d.tracking.status ?? null)
        setLlegadaCasa(d.tracking.timeline?.llegadaCasa ?? null)
        setLlegadaLocal(d.tracking.timeline?.llegadaLocal ?? null)
        setDropoffEta(d.tracking.dropoffEta ?? null)
      } catch { /* fail-silent */ }
    }
    load()
    timer.current = setInterval(load, 15000)
    return () => { cancelled = true; if (timer.current) clearInterval(timer.current) }
  }, [restaurantId, posOrderId])

  if (!status) return null

  // Delifast mantiene status="dropoff" aunque el motorista ya llegó al cliente.
  // Detectamos la llegada por timeline.llegadaCasa.
  const effectiveStatus = llegadaCasa && /dropoff|camino|ruta|transit/.test((status || '').toLowerCase())
    ? 'at_dropoff'
    : status
  // "pickup" en Delifast significa tanto "en camino al local" como "en el local".
  // Usamos timeline.llegadaLocal para distinguir: si no llegó → Camino al local.
  const isPickupStatus = /pickup/.test((status || '').toLowerCase())
  const label = (isPickupStatus && !llegadaLocal)
    ? 'Camino al local'
    : statusLabel(effectiveStatus)
  // Va en camino al cliente (no "ya llegó" ni entregado) → anexar la hora estimada.
  const enCamino = effectiveStatus !== 'at_dropoff' && /dropoff|camino|ruta|transit/.test((status || '').toLowerCase())
  const isCancelled = /cancel|anul/.test(effectiveStatus.toLowerCase())

  // Notificar al padre la primera vez que se detecta cancelación.
  if (isCancelled && !cancelFiredRef.current) {
    cancelFiredRef.current = true
    onCancelDetected?.()
  }

  if (isCancelled) {
    // Cuando hay callback de detección el pill es invisible (el padre maneja la UI).
    if (onCancelDetected) return null
    injectPulse()
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        background: 'rgba(220,38,38,.13)', color: '#dc2626', border: '1px solid rgba(220,38,38,.35)',
        fontWeight: 700, fontSize: 12, borderRadius: 20, padding: '4px 10px',
        flexShrink: 0, animation: 'delifast-cancel-pulse 1.6s ease-in-out infinite',
      }}>
        <Motorbike size={13} strokeWidth={2} style={{ flexShrink: 0 }} />
        Reparto cancelado
      </span>
    )
  }

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: 'var(--sunk)', color: 'var(--ink-2)', border: '1px solid var(--line-strong)',
      fontWeight: 700, fontSize: 12, borderRadius: 20, padding: '4px 10px',
      flexShrink: 0,
    }}>
      <Motorbike size={13} strokeWidth={2} style={{ flexShrink: 0 }} />
      {enCamino && dropoffEta ? (() => { const m = etaMinutes(dropoffEta); return m != null && m > 0 ? `Entrega en ${m} min` : 'Llegó al cliente' })() : label}
    </span>
  )
}
