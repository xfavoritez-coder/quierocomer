'use client'

import { useEffect, useState } from 'react'
import { useIsDesktop } from '../../lib/useIsDesktop'
import { fmtElapsed } from '../OrderClock'
import DelifastTracking from '../DelifastTracking'
import { deliveryPlatformLabel } from '@/lib/pos'

// Origen del pedido (por dónde entró): plataforma de delivery, Uber Eats directo,
// Toteat, tienda ecommerce o tomado a mano en el POS.
function sourceTag(o: { provider?: string | null; vendorName?: string | null }): { label: string; color: string } {
  const vn = o.vendorName || ''
  const plat = deliveryPlatformLabel(vn) // Uber Eats, PedidosYa, Rappi, Didi, Justo
  if (plat) return { label: plat, color: plat === 'Uber Eats' ? '#0f0f0f' : plat === 'PedidosYa' ? '#e11d48' : plat === 'Rappi' ? '#ff4f00' : '#6366f1' }
  if (o.provider === 'ubereats') return { label: 'Uber Eats', color: '#0f0f0f' }
  if (o.provider === 'toteat') return { label: 'Toteat', color: '#ea580c' }
  // Espejo del ecommerce: "-Web" = tienda pública; sin sufijo = tomado en el POS.
  if (/-web$/i.test(vn)) return { label: 'Ecommerce', color: '#0d9488' }
  return { label: 'Manual', color: '#2563eb' }
}

interface HistorialOrder {
  id: string
  dailyNumber?: number | null
  orderReference?: string | null
  customerName: string
  customerPhone: string
  addressLine: string
  saleType: string
  isDelivery: boolean
  provider?: string | null
  vendorName?: string | null
  opsStage: string
  posStatus: string
  totalAmount: number
  paidAmount: number
  deliveryFee: number
  items: unknown
  createdAt: string
  opsReadyForDeliveryAt?: string | null
  opsDeliveredAt?: string | null
  completedAt?: string | null
  updatedAt?: string | null
  rawPayload?: unknown
}

// Tiempo total (congelado) que tomó el pedido. En retiro el tiempo se detiene
// cuando queda "listo" (el cliente lo pasa a buscar cuando quiere); en el resto,
// cuando se entrega/finaliza. null si no hay un cierre válido.
function frozenElapsedMs(o: HistorialOrder): number | null {
  const isDelivery = o.isDelivery || o.saleType === 'delivery'
  const isDineIn = !isDelivery && (o.saleType === 'dine-in' || o.saleType === 'dinein')
  const isRetiro = !isDelivery && !isDineIn
  const end = isRetiro
    ? (o.opsReadyForDeliveryAt || o.opsDeliveredAt || o.completedAt || o.updatedAt)
    : (o.opsDeliveredAt || o.completedAt || o.updatedAt)
  if (!end) return null
  const ms = new Date(end).getTime() - new Date(o.createdAt).getTime()
  return ms >= 0 ? ms : null
}

const clp = (n: number) => '$' + (Math.round(n) || 0).toLocaleString('es-CL')

function cleanAddr(addr: string): string {
  return addr.replace(/,?\s*chile\b/gi, '').replace(/\s{2,}/g, ' ').replace(/,\s*$/g, '').trim()
}

function chip(color: string): React.CSSProperties {
  return {
    fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, letterSpacing: '.04em',
    textTransform: 'uppercase', padding: '3px 6px', borderRadius: 5,
    background: color + '20', color,
  }
}

function itemLines(items: unknown): { name: string; qty: number; price: number }[] {
  if (!Array.isArray(items)) return []
  return items.map((it) => {
    const o = (it || {}) as Record<string, unknown>
    return {
      name: String(o.name ?? o.productName ?? o.title ?? o.description ?? 'Ítem'),
      qty: Number(o.quantity ?? o.qty ?? o.cantidad ?? 1) || 1,
      price: Number(o.price ?? o.unitPrice ?? o.unit_price ?? o.precio ?? 0) || 0,
    }
  })
}

function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function ymd(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Detail panel (read-only) ─────────────────────────────────────────
function HistorialDetailPanel({ order, onClose, restaurantId }: { order: HistorialOrder; onClose: () => void; restaurantId: string }) {
  const canceled = order.posStatus === 'canceled'
  const paid = order.paidAmount >= order.totalAmount && order.totalAmount > 0
  const isDelivery = order.isDelivery || order.saleType === 'delivery'
  const lines = itemLines(order.items)
  const payMethod = order.rawPayload && typeof order.rawPayload === 'object' ? (order.rawPayload as any)?.posPayment?.method : null
  const cancelReason = canceled && order.rawPayload && typeof order.rawPayload === 'object' ? (order.rawPayload as any)?.posCancel?.reason : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexShrink: 0 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 4 }}>
            {(order.orderReference || order.dailyNumber != null) && (
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, color: 'var(--ink-3)', marginRight: 8 }}>#{order.orderReference ?? order.dailyNumber}</span>
            )}
            {order.customerName || 'Cliente'}
          </div>
          {order.customerPhone && <div style={{ fontSize: 15, color: 'var(--ink-2)', marginBottom: 2 }}>{order.customerPhone}</div>}
          {isDelivery && order.addressLine && <div style={{ fontSize: 15, color: 'var(--ink-2)' }}>{order.addressLine}</div>}
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {(() => { const s = sourceTag(order); return <span style={chip(s.color)}>{s.label}</span> })()}
            <span>{new Date(order.createdAt).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            {(() => { const ms = frozenElapsedMs(order); return ms != null ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--mono)', fontWeight: 700 }} title="Tiempo total del pedido">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                {fmtElapsed(ms)}
              </span>
            ) : null })()}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--ink-3)', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Seguimiento Delifast del pedido entregado (repartidor, timeline, foto). */}
        {isDelivery && <DelifastTracking restaurantId={restaurantId} posOrderId={order.id} live={false} />}

        {/* Items */}
        {lines.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {lines.map((l, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, color: 'var(--ink)' }}>
                <span>{l.qty > 1 && <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, marginRight: 6, color: 'var(--ink-2)' }}>{l.qty}×</span>}{l.name}</span>
                {l.price > 0 && <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink-2)', flexShrink: 0, marginLeft: 12 }}>{clp(l.price * l.qty)}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Total + despacho */}
        <div style={{ borderTop: '1px dashed var(--line)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {order.deliveryFee > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--ink-2)' }}>
              <span>Despacho</span>
              <span style={{ fontFamily: 'var(--mono)' }}>{clp(order.deliveryFee)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, color: canceled ? 'var(--ink-3)' : 'var(--ink)', textDecoration: canceled ? 'line-through' : 'none' }}>
            <span>Total</span>
            <span style={{ fontFamily: 'var(--mono)' }}>{clp(order.totalAmount)}</span>
          </div>
        </div>

        {/* Estado pago / motivo anulación */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, color: 'var(--ink-2)' }}>
          {payMethod && (
            <div style={{ display: 'flex', gap: 6 }}>
              <span style={{ color: 'var(--ink-3)' }}>Método:</span>
              <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{payMethod}</span>
            </div>
          )}
          <div style={{ fontWeight: 700, color: canceled ? '#6b7280' : paid ? '#16a34a' : '#f59e0b', fontSize: 15 }}>
            {canceled ? 'Anulado' : paid ? `Cobrado ${clp(order.paidAmount)}` : 'Sin cobro registrado'}
          </div>
          {canceled && cancelReason && (
            <div style={{ fontSize: 13, color: 'var(--ink-3)', fontStyle: 'italic' }}>Motivo: {cancelReason}</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Order card ────────────────────────────────────────────────────────
function HistorialCard({ order, isSelected, onSelect }: { order: HistorialOrder; isSelected: boolean; onSelect: () => void }) {
  const isDesktop = useIsDesktop()
  const canceled = order.posStatus === 'canceled'
  const paid = order.paidAmount >= order.totalAmount && order.totalAmount > 0
  const lines = itemLines(order.items)
  const qty = lines.reduce((s, l) => s + l.qty, 0)
  const isDelivery = order.isDelivery || order.saleType === 'delivery'
  const isDineIn = !isDelivery && (order.saleType === 'dine-in' || order.saleType === 'dinein')
  const typeLabel = isDelivery ? 'Delivery' : isDineIn ? 'Salón' : 'Retiro'
  const typeColor = isDelivery ? '#f59e0b' : isDineIn ? '#8b5cf6' : '#64748b'
  const statusLabel = canceled ? 'Anulado' : 'Entregado'
  const frozenMs = frozenElapsedMs(order)

  return (
    <div
      style={{
        border: `1.5px solid var(--line)`,
        borderRadius: 14, cursor: 'pointer', overflow: 'hidden',
        boxShadow: isSelected ? '0 6px 20px rgba(0,0,0,.13), 0 2px 6px rgba(0,0,0,.07)' : 'var(--sh-1)',
        transform: isSelected ? 'translateY(-2px)' : 'none',
        fontFamily: 'var(--sans)',
        transition: 'box-shadow .15s, transform .15s',
        opacity: canceled ? 0.8 : 1,
      }}
      onClick={onSelect}
    >
      {/* Body */}
      <div style={{ padding: '16px 18px 14px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {(order.orderReference || order.dailyNumber != null) && <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, color: 'var(--ink-3)', marginRight: 7 }}>#{order.orderReference ?? order.dailyNumber}</span>}
              {order.customerName || 'Cliente'}
              {qty > 0 && <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--ink-3)', marginLeft: 7 }}>{qty} ítem{qty !== 1 ? 's' : ''}</span>}
            </div>
            <div style={{ fontSize: 14.5, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span>{new Date(order.createdAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
              {(isDelivery && order.addressLine) ? (
                <>
                  {isDesktop && <span style={{ color: 'var(--ink-4)' }}>·</span>}
                  <span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3, color: 'var(--ink-3)', position: 'relative', top: -1 }}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>{cleanAddr(order.addressLine)}
                  </span>
                </>
              ) : isDineIn ? (
                <span>Salón</span>
              ) : (
                <span>Retiro en local</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 18, color: canceled ? 'var(--ink-3)' : 'var(--ink)', textDecoration: canceled ? 'line-through' : 'none' }}>
              {clp(order.totalAmount)}
            </span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {(() => { const s = sourceTag(order); return <span style={chip(s.color)}>{s.label}</span> })()}
              <span style={chip(typeColor)}>{typeLabel}</span>
              <span style={chip(paid ? '#16a34a' : '#f59e0b')}>{paid ? 'Pagado' : 'Sin cobro'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer neutral */}
      <div style={{
        padding: '11px 18px',
        background: 'var(--sunk)',
        borderTop: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ink-3)', flexShrink: 0 }} />
          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink-3)' }}>{statusLabel}</span>
        </span>
        {frozenMs != null && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12.5, color: 'var(--ink-3)' }} title="Tiempo total del pedido">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            {fmtElapsed(frozenMs)}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────
export default function PosHistorialPanel({ restaurantId, title }: { restaurantId: string; title?: string; onDone?: () => void }) {
  const isDesktop = useIsDesktop()
  const [from, setFrom] = useState(todayYmd())
  const [to, setTo] = useState(todayYmd())
  const [orders, setOrders] = useState<HistorialOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<HistorialOrder | null>(null)

  useEffect(() => {
    if (!restaurantId) return
    setLoading(true)
    setSelected(null)
    fetch(`/api/panel/ecommerce/pos-orders?restaurantId=${restaurantId}&scope=historial&from=${from}&to=${to}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.orders)) setOrders(d.orders) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [restaurantId, from, to])

  const presets: { label: string; f: string; t: string }[] = [
    { label: 'Hoy', f: ymd(0), t: ymd(0) },
    { label: 'Ayer', f: ymd(-1), t: ymd(-1) },
    { label: '7 días', f: ymd(-6), t: ymd(0) },
    { label: '30 días', f: ymd(-29), t: ymd(0) },
  ]

  const listSection = (
    <div className="pos-scroll">
      <div className="pos-pad">
        {title && <p className="pos-inner-title">{title}</p>}

        {/* Selector de rango de fechas */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {presets.map(p => {
            const active = from === p.f && to === p.t
            return (
              <button key={p.label} onClick={() => { setFrom(p.f); setTo(p.t) }} style={{
                padding: '7px 14px', borderRadius: 10, border: '1px solid var(--line)',
                background: active ? 'var(--amber)' : 'var(--sunk)',
                color: active ? '#fff' : 'var(--ink-2)',
                fontWeight: 600, fontSize: 13, fontFamily: 'var(--sans)', cursor: 'pointer',
              }}>
                {p.label}
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-3)', fontWeight: 600 }}>
            Desde
            <input type="date" value={from} max={to} onChange={e => { const v = e.target.value; if (!v) return; setFrom(v); if (v > to) setTo(v) }} style={{
              padding: '6px 10px', borderRadius: 10, border: '1px solid var(--line)',
              background: 'var(--sunk)', color: 'var(--ink)', fontSize: 13,
              fontFamily: 'var(--sans)', cursor: 'pointer', outline: 'none',
            }} />
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-3)', fontWeight: 600 }}>
            Hasta
            <input type="date" value={to} min={from} onChange={e => { const v = e.target.value; if (!v) return; setTo(v); if (v < from) setFrom(v) }} style={{
              padding: '6px 10px', borderRadius: 10, border: '1px solid var(--line)',
              background: 'var(--sunk)', color: 'var(--ink)', fontSize: 13,
              fontFamily: 'var(--sans)', cursor: 'pointer', outline: 'none',
            }} />
          </label>
        </div>

        {loading ? (
          <div className="pos-empty" style={{ minHeight: 200 }}>
            <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '3px solid var(--line)', borderTopColor: 'var(--amber)' }} />
          </div>
        ) : orders.length === 0 ? (
          <div className="pos-empty" style={{ minHeight: 200 }}>
            <p>Sin pedidos en este rango.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {orders.map(o => (
              <HistorialCard
                key={o.id}
                order={o}
                isSelected={selected?.id === o.id}
                onSelect={() => setSelected(prev => prev?.id === o.id && isDesktop ? null : o)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )

  const detailSection = selected ? (
    <HistorialDetailPanel order={selected} onClose={() => setSelected(null)} restaurantId={restaurantId} />
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--ink-3)', height: '100%', padding: 24, textAlign: 'center' }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
        <path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/>
      </svg>
      <span style={{ fontSize: 13, fontWeight: 500 }}>Selecciona un pedido</span>
    </div>
  )

  // Desktop: split layout
  if (isDesktop) {
    return (
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 420px', overflow: 'hidden' }}>
        {listSection}
        <div className={`pos-split-right${selected ? '' : ' empty'}`}>
          {detailSection}
        </div>
      </div>
    )
  }

  // Mobile: list + bottom sheet
  return (
    <>
      {listSection}
      {selected && (
        <div className="pos-modal-overlay" onClick={() => setSelected(null)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--surface)', borderRadius: '18px 18px 0 0', maxHeight: '90dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 -4px 32px rgba(0,0,0,.18)' }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line)', margin: '10px auto 0', flexShrink: 0 }} />
            <HistorialDetailPanel order={selected} onClose={() => setSelected(null)} restaurantId={restaurantId} />
          </div>
        </div>
      )}
    </>
  )
}
