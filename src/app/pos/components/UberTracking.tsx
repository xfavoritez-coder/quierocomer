'use client'

// Seguimiento del reparto de Uber Eats en el detalle del pedido (estilo Delifast,
// pero más liviano: lee order.courier — que el webhook /api/ubereats/webhook rellena
// desde deliveries[] — sin polling propio; se actualiza con el refresco del board).
// Uber NO entrega GPS en vivo al comercio, así que no hay mapa: solo estado +
// repartidor + ETA. El avance (en camino / entregado) viene del opsStage.
import { useState } from 'react'
import { Motorbike } from 'lucide-react'

interface UberCourier {
  source?: string
  name?: string | null
  phone?: string | null
  photo?: string | null
  status?: string | null
  eta?: string | null
  location?: { lat: number; lng: number } | null
}

// Estado del reparto a partir del opsStage (autoritativo: el webhook lo avanza).
function stageInfo(opsStage: string): { label: string; color: string } {
  switch (opsStage) {
    case 'delivered': return { label: 'Entregado', color: '#16a34a' }
    case 'out_for_delivery': return { label: 'En camino', color: '#3b82f6' }
    case 'ready': return { label: 'Listo', color: '#8b5cf6' }
    default: return { label: 'En preparación', color: '#f59e0b' }
  }
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

export default function UberTracking({ order, ribbon = false }: {
  order: { opsStage: string; courier?: unknown; vendorName?: string | null; createdAt?: string }
  ribbon?: boolean
}) {
  const [open, setOpen] = useState(false)

  const isUberEats = (order.vendorName || '').toLowerCase().includes('uber eats')
  if (!isUberEats) return null

  const c: UberCourier | null = (order.courier && typeof order.courier === 'object' && !Array.isArray(order.courier) && (order.courier as UberCourier).source === 'ubereats')
    ? (order.courier as UberCourier) : null

  const { label: stageLabel, color } = stageInfo(order.opsStage)
  const eta = etaLabel(c?.eta)
  const hasCourier = !!(c && (c.name || c.phone || c.photo))
  const rightLabel = eta && order.opsStage === 'out_for_delivery' ? `${stageLabel} · ${eta}` : stageLabel

  const px = ribbon ? '22px' : '14px'

  return (
    <div style={ribbon ? {} : { borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: `12px ${px}`, background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: ribbon ? 0 : 12 }}
      >
        <Motorbike size={17} style={{ color: '#111', flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)', flex: 1, textAlign: 'left' }}>Repartidor Uber Eats</span>
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
            {c!.photo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={c!.photo} alt="" width={44} height={44} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--line)' }} />
              : <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--sunk)', display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4" /><path d="M20 20c0-4.4-3.6-8-8-8s-8 3.6-8 8z" /></svg>
                </div>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--ink)' }}>{c!.name || 'Repartidor Uber'}</div>
              {c!.phone && <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>{c!.phone}</div>}
            </div>
            {eta && <span style={{ fontSize: 12.5, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>Entrega {eta}</span>}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
            {order.opsStage === 'delivered' ? 'Pedido entregado por Uber.' : 'Uber asignará un repartidor; aquí verás su nombre y ETA cuando lo tenga.'}
          </div>
        )}

        {/* Nota: Uber gestiona el reparto (sin GPS en vivo para el comercio). */}
        <div style={{ fontSize: 11.5, color: 'var(--ink-4)', lineHeight: 1.4 }}>
          El reparto lo gestiona Uber Eats. Uber no comparte la ubicación en vivo del repartidor con el local.
        </div>
      </div>
    </div>
  )
}
