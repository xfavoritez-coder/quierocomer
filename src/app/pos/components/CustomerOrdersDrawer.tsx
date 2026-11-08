'use client'

import { useEffect, useState } from 'react'
import DelifastTracking from './DelifastTracking'

// ── Helpers (mismos que PosHistorialPanel) ────────────────────────────
const clp = (n: number) => '$' + (Math.round(n) || 0).toLocaleString('es-CL')
const toName = (s: string) => s.trim().replace(/\S+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase())
const displayName = (s: string) => {
  const m = s.trim().match(/^(Venta\s+)?[Rr][aá]pida\s+#(\d+)$/i)
  if (m) return `Venta rápida #${m[2]}`
  return toName(s)
}
function cleanAddr(a: string) {
  return a.replace(/,?\s*chile\b/gi, '').replace(/\s{2,}/g, ' ').replace(/,\s*$/g, '').trim()
}
function chip(color: string): React.CSSProperties {
  return { fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, letterSpacing: '.04em',
    textTransform: 'uppercase', padding: '3px 6px', borderRadius: 5,
    background: color + '20', color }
}
function itemLines(items: unknown): { name: string; qty: number; price: number }[] {
  if (!Array.isArray(items)) return []
  return items.map((it) => {
    const o = (it || {}) as Record<string, unknown>
    const qty = Number(o.quantity ?? o.qty ?? o.cantidad ?? 1) || 1
    let price = 0
    if (Number(o.unitPriceAfterTax) > 0) price = Number(o.unitPriceAfterTax)
    else if (Number(o.unitPrice) > 0) price = Number(o.unitPrice)
    else if (Number(o.unit_price) > 0) price = Number(o.unit_price)
    else if (Number(o.price) > 0) price = Number(o.price)
    else if (Number(o.amountAfterTax) > 0) price = Math.round(Number(o.amountAfterTax) / qty)
    else if (Number(o.netPrice) > 0) price = Math.round(Number(o.netPrice) / qty)
    else if (Number(o.unitTotal) > 0) price = Number(o.unitTotal)
    else if (Number(o.amount) > 0) price = Math.round(Number(o.amount) / qty)
    else if (Number(o.total) > 0) price = Math.round(Number(o.total) / qty)
    return { name: String(o.name ?? o.productName ?? o.dishName ?? o.title ?? 'Ítem'), qty, price }
  })
}
function fmt(d: string) {
  return new Date(d).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}
function fmtTimeAmPm(d: string) {
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(new Date(d))
    .toLowerCase()
    .replace(/\s*p\.\s*m\.?/i, ' p.m.')
    .replace(/\s*a\.\s*m\.?/i, ' a.m.')
}
function diffMin(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)
}

// ── Tipos ─────────────────────────────────────────────────────────────
interface CustomerOrder {
  id: string
  orderReference?: string | null
  customerName: string
  customerPhone: string
  addressLine: string
  saleType: string
  isDelivery: boolean
  opsStage: string
  opsReadyForDeliveryAt?: string | null
  opsDispatchedAt?: string | null
  opsDeliveredAt?: string | null
  totalAmount: number
  paidAmount: number
  tipAmount: number
  changeAmount: number
  deliveryFee: number
  items: unknown
  createdAt: string
  posStatus: string
  vendorName?: string | null
  tableLabel?: string | null
  rawPayload?: unknown
  surveySentAt?: string | null
  surveyEmailOpenedAt?: string | null
  surveyAnsweredAt?: string | null
}

// ── Timeline ──────────────────────────────────────────────────────────
function OrderTimeline({ order }: { order: CustomerOrder }) {
  const isDelivery = order.isDelivery || order.saleType === 'delivery'
  const canceled = order.posStatus === 'canceled'
  type Step = { label: string; ts: string | null | undefined; color: string }
  const steps: Step[] = [
    { label: 'Recibido', ts: order.createdAt, color: 'var(--ink-3)' },
    { label: 'Listo', ts: order.opsReadyForDeliveryAt, color: 'var(--jade)' },
    ...(isDelivery ? [{ label: 'En camino', ts: order.opsDispatchedAt, color: 'var(--amber)' }] : []),
    canceled
      ? { label: 'Anulado', ts: null, color: '#ef4444' }
      : { label: isDelivery ? 'Entregado' : 'Completado', ts: order.opsDeliveredAt, color: 'var(--jade)' },
  ]
  const active = steps.filter(s => s.ts)
  if (active.length < 2) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {active.map((step, i) => {
        const prev = i > 0 ? active[i - 1] : null
        const delta = prev ? diffMin(prev.ts!, step.ts!) : null
        const isLast = i === active.length - 1
        return (
          <div key={step.label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 16, flexShrink: 0 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: step.color, flexShrink: 0, marginTop: 4 }} />
              {!isLast && <div style={{ width: 2, flex: 1, background: 'var(--line)', minHeight: 20, margin: '3px 0' }} />}
            </div>
            <div style={{ paddingBottom: isLast ? 0 : 14 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{step.label}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)' }}>{fmt(step.ts!)}</span>
                {delta !== null && delta >= 0 && (
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-4)' }}>+{delta} min</span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Detalle de un pedido anterior ─────────────────────────────────────
function OrderDetail({ order, restaurantId, onBack }: { order: CustomerOrder; restaurantId: string; onBack: () => void }) {
  const canceled = order.posStatus === 'canceled'
  const paid = order.paidAmount >= order.totalAmount && order.totalAmount > 0
  const isDelivery = order.isDelivery || order.saleType === 'delivery'
  const isDineIn = !isDelivery && (order.saleType === 'dine-in' || order.saleType === 'dinein')
  const lines = itemLines(order.items)
  const payMethod = order.rawPayload && typeof order.rawPayload === 'object'
    ? (order.rawPayload as any)?.posPayment?.method : null
  const cancelReason = canceled && order.rawPayload && typeof order.rawPayload === 'object'
    ? (order.rawPayload as any)?.posCancel?.reason : null

  const tagStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', borderRadius: 6, padding: '3px 9px', display: 'inline-flex', alignItems: 'center' }
  const typeLabel = isDelivery ? 'Delivery' : isDineIn ? 'Salón' : 'Retiro'
  const typeColors: Record<string, { bg: string; fg: string }> = {
    Delivery: { bg: '#f1f5f9', fg: '#475569' },
    Retiro:   { bg: '#f0fdf4', fg: '#4b7a5e' },
    Salón:    { bg: '#f5f3ff', fg: '#7c6fa0' },
  }
  const tc = typeColors[typeLabel]

  const fmtDate = (d: string) => new Date(d).toLocaleString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  const fmtDateShort = (d: string) => new Date(d).toLocaleString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric',
  })

  const orderLabel = order.orderReference ?? order.id.slice(-6)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontFamily: 'var(--sans)', fontWeight: 600 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Volver
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 15, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Pedido #{orderLabel}
          </div>
        </div>
        {canceled
          ? <span style={chip('#6b7280')}>Anulado</span>
          : !paid
            ? <span style={chip('#f59e0b')}>Sin cobro</span>
            : null}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Tags + dirección + hora */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Tipo + Pagado */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ ...tagStyle, background: tc.bg, color: tc.fg }}>{typeLabel}</span>
            {paid && !canceled && (
              <span style={{ ...tagStyle, background: '#f0fdf4', color: '#16a34a', gap: 4 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                Pagado
              </span>
            )}
          </div>
          {/* Dirección */}
          {isDelivery && order.addressLine && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: 'var(--ink-2)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginTop: 1, flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {cleanAddr(order.addressLine)}
            </div>
          )}
          {/* Hora — "Realizado a las HH:MM p.m." */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-3)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Realizado a las {fmtTimeAmPm(order.createdAt)}
          </div>
        </div>

        {/* Delifast — cinta full-width */}
        {isDelivery && (
          <div style={{
            margin: '0 -20px',
            borderTop: '1px solid var(--line)',
            borderBottom: '1px solid var(--line)',
            background: 'var(--sunk)',
          }}>
            <DelifastTracking restaurantId={restaurantId} posOrderId={order.id} live={false} ribbon />
          </div>
        )}

        {/* Items */}
        {lines.length > 0 && (
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-3)', marginBottom: 8 }}>Ítems</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {lines.map((l, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, fontSize: 15, color: 'var(--ink)' }}>
                  <span>
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--amber-press)', marginRight: 6 }}>{l.qty}×</span>
                    {l.name}
                  </span>
                  {l.price > 0 && <span style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--ink-2)', flexShrink: 0 }}>{clp(l.price * l.qty)}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Totales */}
        <div style={{ borderTop: '1px dashed var(--line)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {order.deliveryFee > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--ink-2)' }}>
              <span>Despacho</span>
              <span style={{ fontFamily: 'var(--mono)' }}>{clp(order.deliveryFee)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 18, fontWeight: 800, color: canceled ? 'var(--ink-3)' : 'var(--ink)', textDecoration: canceled ? 'line-through' : 'none' }}>
            <span>Total</span>
            <span style={{ fontFamily: 'var(--mono)' }}>{clp(order.totalAmount)}</span>
          </div>
          {(payMethod || canceled) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, borderTop: '1px solid var(--line)' }}>
              <span style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600 }}>
                {payMethod ? payMethod.charAt(0).toUpperCase() + payMethod.slice(1) : 'Pago'}
              </span>
              {canceled ? (
                <span style={{ ...chip('#6b7280'), fontSize: 11 }}>{cancelReason ? `Anulado · ${cancelReason}` : 'Anulado'}</span>
              ) : paid ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 800, color: 'var(--jade)', background: 'var(--jade-tint)', padding: '4px 10px', borderRadius: 8 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  {clp(order.paidAmount)}
                </span>
              ) : null}
            </div>
          )}
        </div>

        {/* Encuesta */}
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-3)', marginBottom: 2 }}>Encuesta</div>
          {([
            {
              label: 'Email enviado',
              value: order.surveySentAt ? fmtDateShort(order.surveySentAt) : null,
              yes: !!order.surveySentAt,
            },
            {
              label: 'Email abierto',
              value: order.surveyEmailOpenedAt ? fmtDateShort(order.surveyEmailOpenedAt) : null,
              yes: !!order.surveyEmailOpenedAt,
            },
            {
              label: 'Respondió',
              value: order.surveyAnsweredAt ? fmtDateShort(order.surveyAnsweredAt) : null,
              yes: !!order.surveyAnsweredAt,
            },
          ] as { label: string; value: string | null; yes: boolean }[]).map(row => (
            <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>{row.label}</span>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: row.yes ? '#16a34a' : 'var(--ink-4)' }}>
                {row.yes ? (row.value ?? 'Sí') : '—'}
              </span>
            </div>
          ))}
        </div>

        {/* Historial */}
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-3)', marginBottom: 10 }}>Historial</div>
          <OrderTimeline order={order} />
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────
export default function CustomerOrdersDrawer({
  restaurantId, customerName, customerPhone, onClose,
}: {
  restaurantId: string
  customerName: string
  customerPhone: string
  onClose: () => void
}) {
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CustomerOrder | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/panel/ecommerce/pos-orders/customer?restaurantId=${restaurantId}&phone=${encodeURIComponent(customerPhone)}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.orders) setOrders(d.orders) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [restaurantId, customerPhone])

  return (
    <div
      className="pos-modal-overlay"
      onClick={onClose}
      style={{ alignItems: 'flex-end', padding: 0 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520, height: '90dvh',
          background: 'var(--surface)', borderRadius: '20px 20px 0 0',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 -4px 32px rgba(0,0,0,.18)',
        }}
      >
        {selected ? (
          <OrderDetail order={selected} restaurantId={restaurantId} onBack={() => setSelected(null)} />
        ) : (
          <>
            {/* Header */}
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--ink)' }}>
                  {displayName(customerName || 'Cliente')}
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>
                  {loading ? 'Cargando…' : `${orders.length} pedido${orders.length !== 1 ? 's' : ''} · ${customerPhone}`}
                </div>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--ink-3)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            {/* Lista */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {loading && (
                <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 14, fontFamily: 'var(--sans)' }}>Cargando…</div>
              )}
              {!loading && orders.length === 0 && (
                <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 14, fontFamily: 'var(--sans)' }}>Sin pedidos anteriores</div>
              )}
              {orders.map(o => {
                const canceled = o.posStatus === 'canceled'
                const paid = o.paidAmount >= o.totalAmount && o.totalAmount > 0
                const isDelivery = o.isDelivery || o.saleType === 'delivery'
                const isDineIn = !isDelivery && (o.saleType === 'dine-in' || o.saleType === 'dinein')
                const lines = itemLines(o.items)
                const qty = lines.reduce((s, l) => s + l.qty, 0)
                return (
                  <div
                    key={o.id}
                    onClick={() => setSelected(o)}
                    style={{
                      border: '1.5px solid var(--line)', borderRadius: 12, padding: '12px 14px',
                      cursor: 'pointer', background: 'var(--surface)', fontFamily: 'var(--sans)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                      opacity: canceled ? 0.7 : 1,
                      transition: 'background .12s',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                        {o.orderReference && (
                          <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, color: 'var(--ink-3)', fontSize: 13 }}>#{o.orderReference}</span>
                        )}
                        <span style={{ color: 'var(--ink-3)', fontWeight: 400, fontSize: 13 }}>
                          {new Date(o.createdAt).toLocaleString('es-CL', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--ink-3)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {qty > 0 && <span>{qty} ítem{qty !== 1 ? 's' : ''}</span>}
                        {isDelivery && o.addressLine && <><span>·</span><span>{cleanAddr(o.addressLine)}</span></>}
                        {isDineIn && <><span>·</span><span>Salón</span></>}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 16, color: canceled ? 'var(--ink-3)' : 'var(--ink)', textDecoration: canceled ? 'line-through' : 'none' }}>
                        {clp(o.totalAmount)}
                      </span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {canceled
                          ? <span style={chip('#6b7280')}>Anulado</span>
                          : paid
                            ? <span style={chip('#16a34a')}>Pagado</span>
                            : <span style={chip('#f59e0b')}>Sin cobro</span>}
                        <span style={chip(isDelivery ? '#f59e0b' : isDineIn ? '#8b5cf6' : '#64748b')}>
                          {isDelivery ? 'Delivery' : isDineIn ? 'Salón' : 'Retiro'}
                        </span>
                      </div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
