'use client'

// Seguimiento del repartidor de UBER DIRECT en el detalle del pedido del POS
// (estilo Delifast/UberTracking). Lee order.courier — que el webhook
// /api/ecommerce/uber/webhook rellena con el CourierInfo de Uber Direct
// (nombre, vehículo, teléfono, foto, ETA, PINs, tracking url, foto de entrega) —
// sin polling propio: se actualiza con el refresco del board.
//
// A diferencia de Uber Eats, Uber Direct SÍ entrega seguimiento en vivo del
// repartidor: el enlace "Ver seguimiento en vivo" (tracking_url) abre el mapa de Uber.
import { useState } from 'react'
import { Motorbike, Phone } from 'lucide-react'

// Shape del courier que guarda el webhook de Uber Direct (parseDelivery → CourierInfo).
interface UberDirectCourier {
  deliveryId?: string
  status?: string | null
  trackingUrl?: string | null
  eta?: string | null // ETA al cliente (dropoff)
  pickupEta?: string | null // ETA al local (pickup)
  courierName?: string | null
  courierPhone?: string | null
  courierVehicle?: string | null
  courierImg?: string | null
  dropoffPin?: string | null // código que da el cliente al repartidor
  pickupPin?: string | null // código para entregar el pedido al repartidor en el local
  proofPhotoUrl?: string | null
  source?: string
  provider?: string
}

/** ¿El courier del pedido es de Uber Direct? (no Uber Eats, no deliveryhandroll, no PedidosYa). */
export function isUberDirectCourier(c: unknown): boolean {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false
  const o = c as Record<string, unknown>
  const src = typeof o.source === 'string' ? o.source : ''
  if (src === 'ubereats' || src === 'deliveryhandroll') return false
  if (o.provider === 'pya') return false
  return typeof o.deliveryId === 'string' && (o.deliveryId as string).length > 0
}

// Estado de Uber Direct → etiqueta + color.
function statusInfo(status?: string | null): { label: string; color: string } {
  const s = (status || '').toLowerCase()
  if (/delivered/.test(s)) return { label: 'Entregado', color: '#16a34a' }
  if (/cancel|returned/.test(s)) return { label: /return/.test(s) ? 'Devuelto' : 'Cancelado', color: '#dc2626' }
  if (/dropoff|pickup_complete/.test(s)) return { label: 'En camino', color: '#3b82f6' }
  if (/pickup/.test(s)) return { label: 'Camino al local', color: '#8b5cf6' }
  if (/pending/.test(s)) return { label: 'Buscando repartidor', color: '#f59e0b' }
  return { label: 'Reparto', color: '#64748b' }
}

// eta puede venir como minutos ("12"), "HH:MM" o timestamp ISO. Devuelve "~N min" /
// "~HH:MM" o null si no se puede interpretar o ya pasó.
function etaLabel(eta?: string | null): string | null {
  if (!eta) return null
  const s = String(eta).trim()
  if (!s) return null
  if (/^\d+$/.test(s)) { const m = Number(s); return m > 0 ? `~${m} min` : null }
  const t = Date.parse(s.includes('T') || /[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(' ', 'T'))
  if (Number.isFinite(t)) {
    const mins = Math.round((t - Date.now()) / 60000)
    if (mins > 0 && mins < 600) {
      try { return '~' + new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Santiago' }).format(new Date(t)) } catch { return `~${mins} min` }
    }
    return null
  }
  const hm = s.match(/^(\d{1,2}):(\d{2})$/)
  return hm ? `~${hm[1].padStart(2, '0')}:${hm[2]}` : null
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', padding: '3px 9px', borderRadius: 20, background: color + '18', color, border: `1px solid ${color}40` }}>
      {label}
    </span>
  )
}

function PinBox({ label, pin }: { label: string; pin: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 18, letterSpacing: '.08em', color: 'var(--ink)', background: 'var(--sunk)', border: '1px solid var(--line)', borderRadius: 8, padding: '2px 10px' }}>{pin}</span>
    </div>
  )
}

export default function UberDirectTracking({ order, ribbon = false }: {
  order: { opsStage?: string; courier?: unknown }
  ribbon?: boolean
}) {
  const [open, setOpen] = useState(false)

  const c: UberDirectCourier | null = isUberDirectCourier(order.courier) ? (order.courier as UberDirectCourier) : null
  if (!c) return null

  const { label: statusLbl, color } = statusInfo(c.status)
  const delivered = /delivered/.test((c.status || '').toLowerCase())
  // ETA: hacia el cliente mientras va en camino; hacia el local antes de retirar.
  const goingToCustomer = /dropoff|pickup_complete/.test((c.status || '').toLowerCase())
  const eta = etaLabel(goingToCustomer ? c.eta : c.pickupEta)
  const rightLabel = !delivered && eta ? `${statusLbl} · ${eta}` : statusLbl
  const hasCourier = !!(c.courierName || c.courierPhone || c.courierImg)

  const px = ribbon ? '22px' : '14px'

  return (
    <div style={ribbon ? {} : { borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: `12px ${px}`, background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: ribbon ? 0 : 12 }}
      >
        <Motorbike size={17} style={{ color: '#111', flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)', flex: 1, textAlign: 'left' }}>Motorista Uber Direct</span>
        <Badge label={rightLabel} color={color} />
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          style={{ color: 'var(--ink-3)', flexShrink: 0, transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <div style={{ display: open ? 'flex' : 'none', flexDirection: 'column', gap: 12, padding: `12px ${px} 14px`, borderTop: '1px solid var(--line)' }}>
        {/* Repartidor (cuando Uber lo asigna) */}
        {hasCourier ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {c.courierImg
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={c.courierImg} alt="" width={44} height={44} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--line)' }} />
              : <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--sunk)', display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4" /><path d="M20 20c0-4.4-3.6-8-8-8s-8 3.6-8 8z" /></svg>
                </div>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--ink)' }}>{c.courierName || 'Repartidor Uber'}{c.courierVehicle ? <span style={{ fontWeight: 500, color: 'var(--ink-3)' }}> · {c.courierVehicle}</span> : null}</div>
              {c.courierPhone && <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>{c.courierPhone}</div>}
            </div>
            {c.courierPhone && (
              <a href={`tel:${c.courierPhone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, border: `1px solid ${color}`, color, textDecoration: 'none', fontSize: 12.5, fontWeight: 700, flexShrink: 0 }}>
                <Phone size={13} /> Llamar
              </a>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
            {delivered ? 'Pedido entregado por Uber Direct.' : 'Uber Direct asignará un repartidor; aquí verás su nombre, teléfono y ETA cuando lo tenga.'}
          </div>
        )}

        {/* PINs: código para entregar al repartidor en el local, y código del cliente. */}
        {c.pickupPin && <PinBox label="Código local (entregar al repartidor)" pin={c.pickupPin} />}
        {c.dropoffPin && <PinBox label="Código cliente (respaldo)" pin={c.dropoffPin} />}

        {/* Foto de la entrega */}
        {c.proofPhotoUrl && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Foto de entrega</span>
            <a href={c.proofPhotoUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.proofPhotoUrl} alt="Foto de la entrega al cliente" style={{ width: '100%', maxHeight: 280, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--line)', display: 'block' }} />
            </a>
          </div>
        )}

        {/* Seguimiento en vivo (mapa de Uber) */}
        {c.trackingUrl && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <a href={c.trackingUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600, textDecoration: 'none' }}>
              Ver seguimiento en vivo ↗
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

/** Pill compacto del estado de Uber Direct para la tarjeta del board. Lee order.courier
 *  (sin fetch; se refresca con el board). No renderiza nada si aún no hay courier. */
export function UberDirectStatusPill({ order }: { order: { courier?: unknown } }) {
  const c: UberDirectCourier | null = isUberDirectCourier(order.courier) ? (order.courier as UberDirectCourier) : null
  if (!c) return null

  const { label, color } = statusInfo(c.status)
  const delivered = /delivered/.test((c.status || '').toLowerCase())
  const goingToCustomer = /dropoff|pickup_complete/.test((c.status || '').toLowerCase())
  const eta = etaLabel(goingToCustomer ? c.eta : c.pickupEta)
  const text = !delivered && eta ? `${label} · ${eta}` : label

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: color + '18', color, border: `1px solid ${color}40`,
      fontWeight: 700, fontSize: 12, borderRadius: 20, padding: '4px 10px',
      flexShrink: 0, whiteSpace: 'nowrap',
    }}>
      <Motorbike size={13} strokeWidth={2} style={{ flexShrink: 0 }} />
      {text}
    </span>
  )
}
