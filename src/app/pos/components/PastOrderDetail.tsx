'use client'

import { useEffect, useState } from 'react'
import DelifastTracking from './DelifastTracking'
import CustomerOrdersDrawer from './CustomerOrdersDrawer'
import { deliveryPlatformLabel } from '@/lib/pos'
import { fmtElapsed } from './OrderClock'

// ── Interfaz pública ───────────────────────────────────────────────────
export interface PastOrder {
  id: string
  orderReference?: string | null
  dailyNumber?: number | null
  customerName: string
  customerPhone?: string | null
  customerEmail?: string | null
  addressLine?: string | null
  saleType: string
  isDelivery: boolean
  provider?: string | null
  vendorName?: string | null
  posStatus: string
  totalAmount: number
  paidAmount: number
  deliveryFee: number
  tipAmount?: number | null
  items: unknown
  createdAt: string
  opsReadyForDeliveryAt?: string | null
  opsDispatchedAt?: string | null
  opsDeliveredAt?: string | null
  completedAt?: string | null
  updatedAt?: string | null
  rawPayload?: unknown
  surveySentAt?: string | null
  surveyEmailOpenedAt?: string | null
  surveyAnsweredAt?: string | null
  prepMin?: number | null
  transitMin?: number | null
  totalMin?: number | null
}

// ── Helpers ────────────────────────────────────────────────────────────
const clp = (n: number) => '$' + (Math.round(n) || 0).toLocaleString('es-CL')
const toName = (s: string) => s.trim().replace(/\S+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase())
function displayName(s: string) {
  const m = s.trim().match(/^(Venta\s+)?[Rr][aá]pida\s+#(\d+)$/i)
  if (m) return `Venta rápida #${m[2]}`
  return toName(s)
}
function cleanAddr(a: string) {
  return a.replace(/,?\s*chile\b/gi, '').replace(/\s{2,}/g, ' ').replace(/,\s*$/g, '').trim()
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
    timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(new Date(d))
    .toLowerCase()
    .replace(/\s*p\.\s*m\.?/i, ' p.m.')
    .replace(/\s*a\.\s*m\.?/i, ' a.m.')
}
function fmtDateShort(d: string) {
  return new Date(d).toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}
function diffMin(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)
}
function minLabel(m: number): string {
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)}h ${m % 60}min`
}
function sourceTag(o: { provider?: string | null; vendorName?: string | null }): { label: string; color: string } {
  const vn = o.vendorName || ''
  const plat = deliveryPlatformLabel(vn)
  if (plat) return {
    label: plat,
    color: plat === 'Uber Eats' ? '#0f0f0f' : plat === 'PedidosYa' ? '#e11d48' : plat === 'Rappi' ? '#ff4f00' : '#6366f1',
  }
  if (o.provider === 'ubereats') return { label: 'Uber Eats', color: '#0f0f0f' }
  if (o.provider === 'toteat') return { label: 'Toteat', color: '#ea580c' }
  if (/-web$/i.test(vn)) return { label: 'Ecommerce', color: '#0d9488' }
  return { label: 'Manual', color: '#2563eb' }
}
function frozenElapsedMs(order: PastOrder): number | null {
  const isDelivery = order.isDelivery || order.saleType === 'delivery'
  const isDineIn = !isDelivery && (order.saleType === 'dine-in' || order.saleType === 'dinein')
  const isRetiro = !isDelivery && !isDineIn
  const end = isRetiro
    ? (order.opsReadyForDeliveryAt || order.opsDeliveredAt || order.completedAt || order.updatedAt)
    : (order.opsDeliveredAt || order.completedAt || order.updatedAt)
  if (!end) return null
  const ms = new Date(end).getTime() - new Date(order.createdAt).getTime()
  return ms >= 0 ? ms : null
}

// ── Timeline ──────────────────────────────────────────────────────────
function PastOrderTimeline({ order }: { order: PastOrder }) {
  const isDelivery = order.isDelivery || order.saleType === 'delivery'
  const canceled = order.posStatus === 'canceled'
  type Step = { label: string; ts: string | null | undefined; color: string }
  const steps: Step[] = [
    { label: 'Recibido', ts: order.createdAt, color: 'var(--ink-3)' },
    { label: 'Listo', ts: order.opsReadyForDeliveryAt, color: 'var(--jade)' },
    ...(isDelivery ? [{ label: 'En camino', ts: order.opsDispatchedAt, color: 'var(--amber)' }] : []),
    canceled
      ? { label: 'Anulado', ts: order.updatedAt, color: '#ef4444' }
      : { label: isDelivery ? 'Entregado' : 'Completado', ts: order.opsDeliveredAt ?? order.completedAt, color: 'var(--jade)' },
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
            <div style={{ paddingBottom: isLast ? 0 : 14, minWidth: 0 }}>
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

const BLUE = '#3b82f6'
const PURPLE = '#7c3aed'
const GREEN = '#16a34a'

// ── Componente principal ───────────────────────────────────────────────
export default function PastOrderDetail({
  order, restaurantId, onClose, onRefresh, branchName, backLabel, mobileClose,
}: {
  order: PastOrder
  restaurantId: string
  onClose: () => void
  onRefresh?: () => void
  branchName?: string | null
  backLabel?: string
  /** Muestra la X sutil arriba a la derecha (para bottom sheets en mobile) */
  mobileClose?: boolean
}) {
  const canceled = order.posStatus === 'canceled'
  const paid = order.paidAmount >= order.totalAmount && order.totalAmount > 0
  const isDelivery = order.isDelivery || order.saleType === 'delivery'
  const isDineIn = !isDelivery && (order.saleType === 'dine-in' || order.saleType === 'dinein')
  const lines = itemLines(order.items)
  const payMethod = order.rawPayload && typeof order.rawPayload === 'object'
    ? (order.rawPayload as any)?.posPayment?.method : null
  const cancelReason = canceled && order.rawPayload && typeof order.rawPayload === 'object'
    ? (order.rawPayload as any)?.posCancel?.reason : null

  const [customerCount, setCustomerCount] = useState<number | null>(null)
  const [showCustomerHistory, setShowCustomerHistory] = useState(false)
  const [delifastCancelled, setDelifastCancelled] = useState(false)
  const [markingDelivered, setMarkingDelivered] = useState(false)
  const [editCustomer, setEditCustomer] = useState(false)
  const [editName, setEditName] = useState(order.customerName || '')
  const [editPhone, setEditPhone] = useState(order.customerPhone || '')
  const [editEmail, setEditEmail] = useState(order.customerEmail || '')
  const [savingCustomer, setSavingCustomer] = useState(false)

  useEffect(() => {
    if (!order.customerPhone) return
    setCustomerCount(null)
    fetch(`/api/panel/ecommerce/pos-orders/customer?restaurantId=${restaurantId}&phone=${encodeURIComponent(order.customerPhone)}&countOnly=1`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (typeof d?.count === 'number') setCustomerCount(d.count) })
      .catch(() => {})
  }, [order.id, order.customerPhone, restaurantId])

  const handleMarkDelivered = async () => {
    if (!window.confirm('¿Marcar este pedido como entregado?')) return
    setMarkingDelivered(true)
    try {
      await fetch('/api/panel/ecommerce/pos-orders', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, id: order.id, opsStage: 'delivered' }),
      })
      onRefresh?.()
    } catch { }
    setMarkingDelivered(false)
  }

  const handleSaveCustomer = async () => {
    if (!editName.trim() && !editPhone.trim() && !editEmail.trim()) return
    setSavingCustomer(true)
    try {
      const r = await fetch('/api/panel/ecommerce/pos-orders', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, id: order.id, action: 'editCustomer', customerName: editName.trim(), customerPhone: editPhone.trim(), customerEmail: editEmail.trim() }),
      })
      if (r.ok) { setEditCustomer(false); onRefresh?.() }
    } catch { }
    setSavingCustomer(false)
  }

  const tagStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase',
    borderRadius: 6, padding: '3px 9px', display: 'inline-flex', alignItems: 'center',
  }
  const typeLabel = isDelivery ? 'Delivery' : isDineIn ? 'Salón' : 'Retiro'
  const typeColors: Record<string, { bg: string; fg: string }> = {
    Delivery: { bg: '#f1f5f9', fg: '#475569' },
    Retiro:   { bg: '#f0fdf4', fg: '#4b7a5e' },
    Salón:    { bg: '#f5f3ff', fg: '#7c6fa0' },
  }
  const tc = typeColors[typeLabel]
  const src = sourceTag(order)
  const orderLabel = order.orderReference ?? (order.dailyNumber != null ? String(order.dailyNumber) : order.id.slice(-6))
  const elapsedMs = frozenElapsedMs(order)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {mobileClose && (
        <button
          onClick={onClose}
          aria-label="Cerrar"
          style={{
            position: 'absolute', top: 10, right: 12, zIndex: 20,
            background: 'var(--sunk)', border: 'none', cursor: 'pointer',
            padding: 7, borderRadius: 8,
            color: 'var(--ink-3)', lineHeight: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      )}
      {showCustomerHistory && order.customerPhone && (
        <CustomerOrdersDrawer
          restaurantId={restaurantId}
          customerName={order.customerName}
          customerPhone={order.customerPhone}
          onClose={() => setShowCustomerHistory(false)}
        />
      )}
      {editCustomer && (
        <div className="pos-modal-overlay" onClick={() => setEditCustomer(false)}>
          <div className="pos-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360, width: '100%' }}>
            <div className="pos-modal-title">Editar cliente</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', display: 'block', marginBottom: 5 }}>Nombre</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nombre del cliente" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--line)', fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--ink)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', display: 'block', marginBottom: 5 }}>Teléfono</label>
                <input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="+56 9 1234 5678" type="tel" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--line)', fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--ink)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', display: 'block', marginBottom: 5 }}>Email</label>
                <input value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="correo@ejemplo.com" type="email" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--line)', fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--ink)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="pos-modal-cancel" style={{ flex: 1 }} onClick={() => setEditCustomer(false)}>Cancelar</button>
              <button className="pos-modal-ok" style={{ flex: 1, opacity: savingCustomer ? 0.6 : 1 }} disabled={savingCustomer} onClick={handleSaveCustomer}>{savingCustomer ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: backLabel ? '10px 20px 10px' : '14px 20px 10px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        {backLabel && (
          <button
            onClick={onClose}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 13, fontWeight: 600, fontFamily: 'var(--sans)', padding: '0 0 10px 0', lineHeight: 1 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            {backLabel}
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          {/* Ref + branch + elapsed */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 14, color: 'var(--ink-3)' }}>
              #{orderLabel}
            </span>
            {branchName && (
              <span style={{ fontFamily: 'var(--sans)', fontWeight: 500, fontSize: 12, color: 'var(--ink-4)' }}>{branchName}</span>
            )}
            {elapsedMs != null && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12, color: 'var(--ink-3)' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                {fmtElapsed(elapsedMs)}
              </span>
            )}
          </div>
          {/* Customer name + N pedidos */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 800, fontSize: 19, color: 'var(--ink)', lineHeight: 1.2 }}>
              {displayName(order.customerName || 'Cliente')}
            </div>
            <button
              onClick={() => { setEditName(order.customerName || ''); setEditPhone(order.customerPhone || ''); setEditCustomer(true) }}
              title="Editar cliente"
              style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--ink-3)', lineHeight: 0 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            {order.customerPhone && customerCount !== null && (
              <button
                onClick={() => setShowCustomerHistory(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
                  fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700,
                  padding: '3px 9px', borderRadius: 20,
                  background: customerCount > 1 ? 'var(--amber-tint)' : 'var(--sunk)',
                  color: customerCount > 1 ? 'var(--amber-press)' : 'var(--ink-3)',
                  border: `1px solid ${customerCount > 1 ? 'var(--amber)' : 'var(--line)'}`,
                  cursor: 'pointer', transition: 'opacity .12s',
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                {customerCount} pedido{customerCount !== 1 ? 's' : ''}
              </button>
            )}
          </div>
          {/* Phone */}
          {order.customerPhone && (
            <div style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 3 }}>{order.customerPhone}</div>
          )}
        </div>
        {/* Status chip + close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, paddingTop: 2 }}>
          {canceled
            ? <span style={chip('#6b7280')}>Anulado</span>
            : !paid
              ? <span style={chip('#f59e0b')}>Sin cobro</span>
              : null}
          {!backLabel && !mobileClose && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--ink-3)', lineHeight: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Tags + meta */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ ...tagStyle, background: tc.bg, color: tc.fg }}>{typeLabel}</span>
            {paid && !canceled && (
              <span style={{ ...tagStyle, background: '#f0fdf4', color: '#16a34a', gap: 4 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                Pagado
              </span>
            )}
            <span style={chip(src.color)}>{src.label}</span>
          </div>
          {isDelivery && order.addressLine && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, color: 'var(--ink-2)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginTop: 1, flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {cleanAddr(order.addressLine)}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--ink-3)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Realizado a las {fmtTimeAmPm(order.createdAt)}
          </div>
        </div>

        {/* Delifast — cinta full-width */}
        {isDelivery && (
          <div style={{ margin: '0 -20px', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', background: 'var(--sunk)' }}>
            <DelifastTracking restaurantId={restaurantId} posOrderId={order.id} live={false} ribbon onCancelDetected={() => setDelifastCancelled(true)} />
          </div>
        )}
        {/* Cuando Delifast cancela y el pedido no está entregado: marcar manualmente */}
        {isDelivery && delifastCancelled && order.posStatus !== 'canceled' && !order.opsDeliveredAt && (
          <button
            disabled={markingDelivered}
            onClick={handleMarkDelivered}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
              padding: '11px 14px', borderRadius: 10, border: 'none',
              background: '#dc2626', color: '#fff', cursor: markingDelivered ? 'default' : 'pointer',
              fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 700, opacity: markingDelivered ? 0.6 : 1,
            }}
          >
            {markingDelivered ? '…' : 'Marcar como entregado'}
          </button>
        )}

        {/* Notas del pedido */}
        {(() => {
          const orderNotes = (order.rawPayload && typeof order.rawPayload === 'object')
            ? (order.rawPayload as Record<string, unknown>).orderNotes as string | undefined
            : undefined
          return orderNotes ? (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '10px 13px', borderRadius: 9, background: 'var(--amber-tint)', border: '1px solid var(--amber)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--amber-press)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span style={{ fontSize: 14, color: 'var(--ink)', fontStyle: 'italic', lineHeight: 1.45 }}>{orderNotes}</span>
            </div>
          ) : null
        })()}

        {/* Items */}
        {lines.length > 0 && (
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-3)', marginBottom: 7 }}>Ítems</div>
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
          {(order.tipAmount ?? 0) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--ink-2)' }}>
              <span>Propina</span>
              <span style={{ fontFamily: 'var(--mono)' }}>{clp(order.tipAmount!)}</span>
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

        {/* Tiempos (delivery report stats) */}
        {(order.prepMin != null || order.transitMin != null || order.totalMin != null) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { label: 'Preparación', value: order.prepMin != null ? minLabel(order.prepMin) : '—', color: BLUE },
              { label: 'Tránsito',    value: order.transitMin != null ? minLabel(order.transitMin) : '—', color: PURPLE },
              { label: 'Total',       value: order.totalMin != null ? minLabel(order.totalMin) : '—', color: order.totalMin != null ? (order.totalMin <= 30 ? GREEN : order.totalMin <= 45 ? BLUE : order.totalMin <= 60 ? '#f59e0b' : '#ef4444') : 'var(--ink-3)' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--sunk)', borderRadius: 10, padding: '10px 12px', borderLeft: `3px solid ${s.color}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Historial / Timeline */}
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-3)', marginBottom: 10 }}>Historial</div>
          <PastOrderTimeline order={order} />
        </div>

        {/* Encuesta */}
        {(order.surveySentAt || order.surveyEmailOpenedAt || order.surveyAnsweredAt) && (
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-3)', marginBottom: 2 }}>Encuesta</div>
            {([
              { label: 'Email enviado', value: order.surveySentAt ? fmtDateShort(order.surveySentAt) : null, yes: !!order.surveySentAt },
              { label: 'Email abierto', value: order.surveyEmailOpenedAt ? fmtDateShort(order.surveyEmailOpenedAt) : null, yes: !!order.surveyEmailOpenedAt },
              { label: 'Respondió',     value: order.surveyAnsweredAt ? fmtDateShort(order.surveyAnsweredAt) : null, yes: !!order.surveyAnsweredAt },
            ] as { label: string; value: string | null; yes: boolean }[]).map(row => (
              <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>{row.label}</span>
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: row.yes ? '#16a34a' : 'var(--ink-4)' }}>
                  {row.yes ? (row.value ?? 'Sí') : '—'}
                </span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
