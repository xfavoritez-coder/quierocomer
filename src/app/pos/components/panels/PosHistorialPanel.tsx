'use client'

import { useEffect, useState } from 'react'
import { useIsDesktop } from '../../lib/useIsDesktop'

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

export default function PosHistorialPanel({ restaurantId, title }: { restaurantId: string; title?: string; onDone?: () => void }) {
  const isDesktop = useIsDesktop()
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
              <button key={d} onClick={() => setDate(d)} style={{
                padding: '7px 14px', borderRadius: 10, border: '1px solid var(--line)',
                background: active ? 'var(--amber)' : 'var(--sunk)',
                color: active ? '#fff' : 'var(--ink-2)',
                fontWeight: 600, fontSize: 13, fontFamily: 'var(--sans)', cursor: 'pointer',
              }}>
                {label}
              </button>
            )
          })}
          <input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} style={{
            padding: '6px 10px', borderRadius: 10, border: '1px solid var(--line)',
            background: 'var(--sunk)', color: 'var(--ink)', fontSize: 13,
            fontFamily: 'var(--sans)', cursor: 'pointer', outline: 'none',
          }} />
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {orders.map(o => {
              const canceled = o.posStatus === 'canceled'
              const paid = o.paidAmount >= o.totalAmount && o.totalAmount > 0
              const lines = itemLines(o.items)
              const qty = lines.reduce((s, l) => s + l.qty, 0)
              const isDelivery = o.isDelivery || o.saleType === 'delivery'
              const isDineIn = !isDelivery && (o.saleType === 'dine-in' || o.saleType === 'dinein')
              const typeLabel = isDelivery ? 'Delivery' : isDineIn ? 'Salón' : 'Retiro'
              const typeColor = isDelivery ? '#f59e0b' : isDineIn ? '#8b5cf6' : '#64748b'
              const statusColor = canceled ? '#6b7280' : '#16a34a'
              const statusLabel = canceled ? 'Anulado' : 'Entregado'
              const isOpen = expanded === o.id
              const payMethod = o.rawPayload && typeof o.rawPayload === 'object' ? (o.rawPayload as any)?.posPayment?.method : null
              const cancelReason = canceled && o.rawPayload && typeof o.rawPayload === 'object' ? (o.rawPayload as any)?.posCancel?.reason : null

              return (
                <div key={o.id} style={{
                  border: '1.5px solid var(--line)', borderRadius: 14, overflow: 'hidden',
                  boxShadow: 'var(--sh-1)', fontFamily: 'var(--sans)',
                  opacity: canceled ? 0.8 : 1,
                }}>
                  {/* Body — igual que OrderCard */}
                  <div
                    style={{ padding: '16px 18px 14px', background: isOpen ? 'var(--sunk)' : 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 6, cursor: 'pointer' }}
                    onClick={() => setExpanded(isOpen ? null : o.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {(o.orderReference || o.dailyNumber != null) && <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, color: 'var(--ink-3)', marginRight: 7 }}>#{o.orderReference ?? o.dailyNumber}</span>}
                          {o.customerName || 'Cliente'}
                          {qty > 0 && <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--ink-3)', marginLeft: 7 }}>{qty} ítem{qty !== 1 ? 's' : ''}</span>}
                        </div>
                        <div style={{ fontSize: 14.5, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span>{new Date(o.createdAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
                          {(isDelivery && o.addressLine) ? (
                            <>
                              {isDesktop && <span style={{ color: 'var(--ink-4)' }}>·</span>}
                              <span>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3, color: 'var(--ink-3)', position: 'relative', top: -1 }}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>{cleanAddr(o.addressLine)}
                              </span>
                            </>
                          ) : isDineIn ? (
                            <span>{o.addressLine || 'Salón'}</span>
                          ) : (
                            <span>Retiro en local</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
                        <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 18, color: canceled ? 'var(--ink-3)' : 'var(--ink)', textDecoration: canceled ? 'line-through' : 'none' }}>
                          {clp(o.totalAmount)}
                        </span>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <span style={chip(typeColor)}>{typeLabel}</span>
                          <span style={chip(paid ? '#16a34a' : '#f59e0b')}>{paid ? 'Pagado' : 'Sin cobro'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer coloreado — igual que OrderCard */}
                  <div style={{
                    padding: '11px 18px',
                    background: statusColor + '14',
                    borderTop: `1px solid ${statusColor}28`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                    cursor: 'pointer',
                  }} onClick={() => setExpanded(isOpen ? null : o.id)}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13.5, color: statusColor }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
                      {statusLabel}
                    </span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--ink-3)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  </div>

                  {/* Detalle expandido */}
                  {isOpen && (
                    <div style={{ padding: '14px 18px 16px', borderTop: '1px solid var(--line)', background: 'var(--sunk)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {lines.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {lines.map((l, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--ink)' }}>
                              <span>{l.qty > 1 && <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, marginRight: 5, color: 'var(--ink-2)' }}>{l.qty}×</span>}{l.name}</span>
                              {l.price > 0 && <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink-2)', flexShrink: 0, marginLeft: 10 }}>{clp(l.price * l.qty)}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ borderTop: '1px dashed var(--line)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13.5, color: 'var(--ink-2)' }}>
                        {o.customerPhone && <span>{o.customerPhone}</span>}
                        {isDelivery && o.addressLine && <span>{o.addressLine}</span>}
                        {o.deliveryFee > 0 && <span>Despacho: {clp(o.deliveryFee)}</span>}
                        {payMethod && <span style={{ textTransform: 'capitalize' }}>Pago: {payMethod}</span>}
                        {canceled && cancelReason && <span style={{ color: '#ef4444' }}>Motivo anulación: {cancelReason}</span>}
                        <span style={{ fontWeight: 700, color: paid ? '#16a34a' : '#f59e0b' }}>
                          {paid ? `Cobrado ${clp(o.paidAmount)}` : 'Sin cobro registrado'}
                        </span>
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
