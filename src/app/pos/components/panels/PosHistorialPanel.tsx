'use client'

import { useEffect, useState } from 'react'

interface HistorialOrder {
  id: string
  dailyNumber?: number | null
  orderReference?: string | null
  customerName: string
  customerPhone: string
  addressLine: string
  saleType: string
  isDelivery: boolean
  opsStage: string
  posStatus: string
  totalAmount: number
  paidAmount: number
  deliveryFee: number
  items: unknown
  createdAt: string
  rawPayload?: unknown
}

const clp = (n: number) => '$' + (Math.round(n) || 0).toLocaleString('es-CL')

function itemLines(items: unknown): { name: string; qty: number; price: number }[] {
  if (!Array.isArray(items)) return []
  return items.map((it) => {
    const o = (it || {}) as Record<string, unknown>
    const name = String(o.name ?? o.productName ?? o.title ?? o.description ?? 'Ítem')
    const qty = Number(o.quantity ?? o.qty ?? o.cantidad ?? 1) || 1
    const price = Number(o.price ?? o.unitPrice ?? o.unit_price ?? o.precio ?? 0) || 0
    return { name, qty, price }
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

function fmtDate(ymd: string): string {
  const [y, m, dd] = ymd.split('-').map(Number)
  const d = new Date(y, m - 1, dd)
  const today = todayYmd()
  const yesterday = ymd === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate() - 1).padStart(2, '0')}`
  if (ymd === today) return 'Hoy'
  if (yesterday) return 'Ayer'
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
}

export default function PosHistorialPanel({ restaurantId, title }: { restaurantId: string; title?: string; onDone?: () => void }) {
  const [date, setDate] = useState(todayYmd())
  const [orders, setOrders] = useState<HistorialOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    if (!restaurantId) return
    setLoading(true)
    setExpanded(null)
    fetch(`/api/panel/ecommerce/pos-orders?restaurantId=${restaurantId}&scope=historial&from=${date}&to=${date}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.orders)) setOrders(d.orders) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [restaurantId, date])

  const isCanceled = (o: HistorialOrder) => o.posStatus === 'canceled'
  const isPaid = (o: HistorialOrder) => o.paidAmount >= o.totalAmount && o.totalAmount > 0

  return (
    <div className="pos-scroll">
      <div className="pos-pad">
        {title && <p className="pos-inner-title">{title}</p>}

        {/* Selector de fecha */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          {[0, -1, -2].map(offset => {
            const d = ymd(offset)
            const label = offset === 0 ? 'Hoy' : offset === -1 ? 'Ayer' : new Date(d + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
            const active = date === d
            return (
              <button
                key={d}
                onClick={() => setDate(d)}
                style={{
                  padding: '7px 14px', borderRadius: 10, border: '1px solid var(--line)',
                  background: active ? 'var(--amber)' : 'var(--sunk)',
                  color: active ? '#fff' : 'var(--ink-2)',
                  fontWeight: 600, fontSize: 13, fontFamily: 'var(--sans)',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            )
          })}
          <input
            type="date"
            value={date}
            onChange={e => e.target.value && setDate(e.target.value)}
            style={{
              padding: '6px 10px', borderRadius: 10, border: '1px solid var(--line)',
              background: 'var(--sunk)', color: 'var(--ink)', fontSize: 13,
              fontFamily: 'var(--sans)', cursor: 'pointer', outline: 'none',
            }}
          />
        </div>

        {loading ? (
          <div className="pos-empty" style={{ minHeight: 200 }}>
            <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '3px solid var(--line)', borderTopColor: 'var(--amber)' }} />
          </div>
        ) : orders.length === 0 ? (
          <div className="pos-empty" style={{ minHeight: 200 }}>
            <p>Sin pedidos para esta fecha.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {orders.map(o => {
              const canceled = isCanceled(o)
              const paid = isPaid(o)
              const lines = itemLines(o.items)
              const qty = lines.reduce((s, l) => s + l.qty, 0)
              const isDelivery = o.isDelivery || o.saleType === 'delivery'
              const isOpen = expanded === o.id
              const statusColor = canceled ? '#6b7280' : '#16a34a'
              const statusLabel = canceled ? 'Anulado' : 'Entregado'
              const typeLabel = isDelivery ? 'Delivery' : (o.saleType === 'dine-in' || o.saleType === 'dinein') ? 'Salón' : 'Retiro'
              const cancelReason = canceled && o.rawPayload && typeof o.rawPayload === 'object'
                ? (o.rawPayload as any)?.posCancel?.reason : null
              const payMethod = o.rawPayload && typeof o.rawPayload === 'object'
                ? (o.rawPayload as any)?.posPayment?.method : null

              return (
                <div
                  key={o.id}
                  style={{ border: '1.5px solid var(--line)', borderRadius: 14, overflow: 'hidden', fontFamily: 'var(--sans)', opacity: canceled ? 0.75 : 1 }}
                >
                  {/* Header row */}
                  <div
                    style={{ padding: '13px 16px', background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                    onClick={() => setExpanded(isOpen ? null : o.id)}
                  >
                    {/* Número + nombre */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(o.orderReference || o.dailyNumber != null) && (
                          <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, color: 'var(--ink-3)', marginRight: 6 }}>#{o.orderReference ?? o.dailyNumber}</span>
                        )}
                        {o.customerName || 'Cliente'}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3, display: 'flex', gap: 8 }}>
                        <span>{new Date(o.createdAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>{typeLabel}</span>
                        {qty > 0 && <span>{qty} ítem{qty !== 1 ? 's' : ''}</span>}
                      </div>
                    </div>

                    {/* Total + estado */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 16, color: canceled ? 'var(--ink-3)' : 'var(--ink)', textDecoration: canceled ? 'line-through' : 'none' }}>
                        {clp(o.totalAmount)}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, fontSize: 11.5, color: statusColor, background: statusColor + '14', padding: '3px 8px', borderRadius: 6 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor }} />
                        {statusLabel}
                      </span>
                    </div>

                    {/* Chevron */}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--ink-3)', flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  </div>

                  {/* Detalle expandido */}
                  {isOpen && (
                    <div style={{ padding: '12px 16px 14px', borderTop: '1px solid var(--line)', background: 'var(--sunk)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {/* Items */}
                      {lines.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {lines.map((l, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: 'var(--ink)' }}>
                              <span>{l.qty > 1 && <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, marginRight: 4, color: 'var(--ink-2)' }}>{l.qty}×</span>}{l.name}</span>
                              {l.price > 0 && <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink-2)', flexShrink: 0 }}>{clp(l.price * l.qty)}</span>}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Datos extras */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13, color: 'var(--ink-2)', borderTop: '1px dashed var(--line)', paddingTop: 8 }}>
                        {o.customerPhone && <span>{o.customerPhone}</span>}
                        {isDelivery && o.addressLine && <span>{o.addressLine}</span>}
                        {o.deliveryFee > 0 && <span>Despacho: {clp(o.deliveryFee)}</span>}
                        {payMethod && <span style={{ textTransform: 'capitalize' }}>Pago: {payMethod}</span>}
                        {canceled && cancelReason && <span style={{ color: '#ef4444' }}>Motivo: {cancelReason}</span>}
                        {!canceled && (
                          <span style={{ fontWeight: 700, color: paid ? '#16a34a' : '#f59e0b' }}>
                            {paid ? `Cobrado ${clp(o.paidAmount)}` : 'Sin cobro registrado'}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
