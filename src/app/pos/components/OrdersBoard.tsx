'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { setRestaurantId, setUserId, useOpenCashSession } from '@/lib/pos'
import type { PaymentMethod } from '@/lib/pos'
import { usePosNav } from '../lib/usePosNav'
import { useIsDesktop } from '../lib/useIsDesktop'

type OrderType = 'retiro' | 'delivery' | 'todos'

const TEST_USER_ID = 'pos-garzon'

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'debito', label: 'Débito' },
  { id: 'credito', label: 'Crédito' },
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'webpay', label: 'Webpay' },
]

interface PosOrderLite {
  id: string
  dailyNumber?: number | null
  orderReference?: string | null
  customerName: string
  customerPhone: string
  addressLine: string
  tableLabel?: string | null
  saleType: string
  isDelivery: boolean
  opsStage: string
  totalAmount: number
  paidAmount: number
  tipAmount: number
  changeAmount: number
  deliveryFee: number
  vendorName?: string | null
  items: unknown
  createdAt: string
  rawPayload?: unknown
}

const clp = (n: number) => '$' + (Math.round(n) || 0).toLocaleString('es-CL')

function cleanAddr(addr: string): string {
  return addr
    .replace(/,?\s*chile\b/gi, '')
    .replace(/,?\s*región metropolitana\b/gi, '')
    .replace(/,\s*\d{7}\b/g, '')   // códigos postales tipo 8301674
    .replace(/\s{2,}/g, ' ')
    .replace(/,(\s*,)+/g, ',')
    .replace(/,\s*$/g, '')
    .trim()
}

const STAGE_LABEL: Record<string, string> = {
  preparing: 'En preparación',
  ready: 'Listo',
  out_for_delivery: 'En reparto',
  delivered: 'Entregado',
}

const STAGE_COLOR: Record<string, string> = {
  preparing: '#f59e0b',
  ready: '#16a34a',
  out_for_delivery: '#3b82f6',
  delivered: '#6b7280',
}

function nextAction(stage: string, isDelivery: boolean): { label: string; stage: string } | null {
  if (stage === 'preparing') return { label: 'Listo', stage: 'ready' }
  if (stage === 'ready' && isDelivery) return { label: 'Enviar a reparto', stage: 'out_for_delivery' }
  if (stage === 'ready' && !isDelivery) return { label: 'Entregado', stage: 'delivered' }
  if (stage === 'out_for_delivery') return { label: 'Entregado', stage: 'delivered' }
  return null
}

function prevAction(stage: string): { label: string; stage: string } | null {
  if (stage === 'ready') return { label: 'Volver a preparación', stage: 'preparing' }
  if (stage === 'out_for_delivery') return { label: 'Volver a listo', stage: 'ready' }
  return null
}

const isPaid = (o: PosOrderLite) => o.totalAmount > 0 && o.paidAmount >= o.totalAmount

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

function timeSince(iso: string) {
  const d = Date.now() - new Date(iso).getTime()
  const m = Math.floor(d / 60000)
  if (m < 1) return '< 1 min'
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

// ── Order card ──────────────────────────────────────────────────────

function OrderCard({
  order, isSelected, showTypeChip, stageBusy,
  onSelect, onStageChange,
}: {
  order: PosOrderLite
  isSelected: boolean
  showTypeChip: boolean
  stageBusy: string | null
  onSelect: () => void
  onStageChange: (o: PosOrderLite, stage: string) => void
}) {
  const isDesktop = useIsDesktop()
  const paid = isPaid(order)
  const lines = itemLines(order.items)
  const qty = lines.reduce((s, l) => s + l.qty, 0)
  const isDelivery = order.isDelivery || order.saleType === 'delivery'
  const isDineIn = !isDelivery && (order.saleType === 'dine-in' || order.saleType === 'dinein')
  const typeLabel = isDelivery ? 'Delivery' : isDineIn ? 'Salón' : 'Retiro'
  const typeColor = isDelivery ? '#f59e0b' : isDineIn ? '#8b5cf6' : '#64748b'
  const next = nextAction(order.opsStage, isDelivery)
  const busy = stageBusy === order.id

  return (
    <div
      style={{
        border: `1.5px solid ${isSelected ? 'var(--ink-2)' : 'var(--line)'}`,
        borderLeft: `4px solid ${typeColor}`,
        borderRadius: 14, cursor: 'pointer', overflow: 'hidden',
        boxShadow: isSelected ? 'var(--sh-2)' : 'var(--sh-1)',
        fontFamily: 'var(--sans)',
        transition: 'border-color .12s, box-shadow .12s',
      }}
      onClick={onSelect}
    >
      {/* Body: nombre + info secundaria */}
      <div style={{
        padding: '16px 18px 14px',
        background: isSelected ? 'var(--sunk)' : 'var(--surface)',
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        {/* Nombre (izq) + total y chips (der) */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--ink)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {(order.orderReference || order.dailyNumber != null) && <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, color: 'var(--ink-3)', marginRight: 7 }}>#{order.orderReference ?? order.dailyNumber}</span>}
              {order.customerName || 'Cliente'}
              {qty > 0 && <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--ink-3)', marginLeft: 7 }}>{qty} ítem{qty !== 1 ? 's' : ''}</span>}
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span>{new Date(order.createdAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
              {(isDelivery && order.addressLine) ? (
                <span>{isDesktop ? '· ' : ''}{cleanAddr(order.addressLine)}</span>
              ) : isDineIn && order.tableLabel ? (
                <span>{order.tableLabel}</span>
              ) : !isDelivery && !isDineIn ? (
                <span>Retiro en local</span>
              ) : null}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 18, color: 'var(--ink)' }}>
              {clp(order.totalAmount)}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              {showTypeChip && <span style={chip(typeColor)}>{typeLabel}</span>}
              <span style={chip(paid ? '#16a34a' : '#f59e0b')}>{paid ? 'Pagado' : 'Por cobrar'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer coloreado: estado + botón acción */}
      <div
        style={{
          padding: '11px 18px',
          background: (STAGE_COLOR[order.opsStage] ?? '#aaa') + '14',
          borderTop: `1px solid ${(STAGE_COLOR[order.opsStage] ?? '#aaa')}28`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}
        onClick={e => e.stopPropagation()}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13.5, color: STAGE_COLOR[order.opsStage] ?? 'var(--ink-2)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: STAGE_COLOR[order.opsStage] ?? '#aaa', flexShrink: 0 }} />
          {STAGE_LABEL[order.opsStage] ?? order.opsStage}
        </span>
        {next && (
          <button
            onClick={() => onStageChange(order, next.stage)}
            disabled={busy}
            style={{
              fontSize: 13, fontWeight: 700, padding: '7px 16px', borderRadius: 8, border: 'none',
              background: STAGE_COLOR[next.stage] ?? 'var(--amber)', color: '#fff',
              cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
              fontFamily: 'var(--sans)', flexShrink: 0,
            }}
          >
            {busy ? '…' : next.label + ' →'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Order detail panel ──────────────────────────────────────────────

function OrderDetailPanel({
  order, restaurantId, cajaOpen, stageBusy, onStageChange, onCobro, onClose, onPaid, navigate,
}: {
  order: PosOrderLite
  restaurantId: string
  cajaOpen: boolean
  stageBusy: string | null
  onStageChange: (o: PosOrderLite, stage: string) => void
  onCobro: () => void
  onClose: () => void
  onPaid: () => void
  navigate: (path: string) => void
}) {
  const paid = isPaid(order)
  const isDelivery = order.isDelivery || order.saleType === 'delivery'
  const isDineIn = !isDelivery && (order.saleType === 'dine-in' || order.saleType === 'dinein')
  const next = nextAction(order.opsStage, isDelivery)
  const lines = itemLines(order.items)
  const busy = stageBusy === order.id
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [canceling, setCanceling] = useState(false)
  const [finalizing, setFinalizing] = useState(false)

  const handleCancel = async () => {
    setCanceling(true)
    try {
      const r = await fetch('/api/panel/ecommerce/pos-orders', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, id: order.id, action: 'cancel', reason: cancelReason.trim() }),
      })
      if (r.ok) onPaid()
    } catch { }
    setCanceling(false)
  }

  const handleFinalize = async () => {
    setFinalizing(true)
    try {
      const r = await fetch('/api/panel/ecommerce/pos-orders', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, id: order.id, opsStage: 'delivered' }),
      })
      if (r.ok) onPaid()
    } catch { }
    setFinalizing(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 22px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--ink)', lineHeight: 1.2 }}>
            {order.orderReference && <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink-3)', marginRight: 8 }}>#{order.orderReference}</span>}
            {order.customerName || 'Cliente'}
          </div>
          <div style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>{isDelivery ? 'Delivery' : isDineIn ? (order.tableLabel || 'Salón') : 'Retiro'} · hace {timeSince(order.createdAt)}</span>
            {paid && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#16a34a18', border: '1px solid #16a34a40', color: '#16a34a', fontWeight: 700, fontSize: 12, borderRadius: 20, padding: '2px 9px' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                Pagado
              </span>
            )}
          </div>
        </div>
        <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'var(--sunk)', color: 'var(--ink-2)', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Customer info */}
        {(order.customerPhone || (isDelivery && order.addressLine)) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {order.customerPhone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, color: 'var(--ink-2)' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                {order.customerPhone}
              </div>
            )}
            {isDelivery && order.addressLine && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 15, color: 'var(--ink-2)' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginTop: 2, flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {cleanAddr(order.addressLine)}
              </div>
            )}
          </div>
        )}

        {/* Items */}
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-3)', marginBottom: 10 }}>Ítems</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {lines.length > 0 ? lines.map((l, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, fontSize: 15 }}>
                <span style={{ color: 'var(--ink)', fontWeight: 500 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--amber-press)', marginRight: 6 }}>{l.qty}×</span>
                  {l.name}
                </span>
                {l.price > 0 && <span style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--ink-2)', flexShrink: 0 }}>{clp(l.price * l.qty)}</span>}
              </div>
            )) : (
              <div style={{ fontSize: 14, color: 'var(--ink-3)' }}>Sin detalle de ítems</div>
            )}
          </div>
        </div>

        {/* Totals */}
        <div style={{ borderTop: '1px dashed var(--line)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {order.deliveryFee > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--ink-2)' }}>
              <span>Despacho</span>
              <span style={{ fontFamily: 'var(--mono)' }}>{clp(order.deliveryFee)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>
            <span>Total</span>
            <span style={{ fontFamily: 'var(--mono)' }}>{clp(order.totalAmount)}</span>
          </div>
          {paid && order.tipAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#16a34a' }}>
              <span>Propina</span>
              <span style={{ fontFamily: 'var(--mono)' }}>{clp(order.tipAmount)}</span>
            </div>
          )}
        </div>

        {/* Stage */}
        {(() => {
          const prev = prevAction(order.opsStage)
          return (
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-3)', marginBottom: 10 }}>Etapa</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: (next || prev) ? 12 : 0 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: STAGE_COLOR[order.opsStage] ?? '#aaa', flexShrink: 0 }} />
                <span style={{ fontSize: 16, fontWeight: 700, color: STAGE_COLOR[order.opsStage] ?? 'var(--ink-2)' }}>
                  {STAGE_LABEL[order.opsStage] ?? order.opsStage}
                </span>
              </div>
              {next && (
                <button
                  onClick={() => onStageChange(order, next.stage)}
                  disabled={busy}
                  style={{
                    width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                    background: STAGE_COLOR[next.stage] ?? 'var(--amber)', color: '#fff',
                    fontWeight: 700, fontSize: 16, cursor: busy ? 'default' : 'pointer',
                    opacity: busy ? 0.6 : 1, fontFamily: 'var(--sans)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  {busy ? 'Actualizando…' : `${next.label} →`}
                </button>
              )}
              {prev && (
                <button
                  onClick={() => onStageChange(order, prev.stage)}
                  disabled={busy}
                  style={{
                    width: '100%', marginTop: 8, padding: '10px 14px', borderRadius: 12,
                    border: '1px solid var(--line)', background: 'transparent',
                    color: 'var(--ink-3)', fontWeight: 600, fontSize: 14,
                    cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
                    fontFamily: 'var(--sans)',
                  }}
                >
                  ← {prev.label}
                </button>
              )}
            </div>
          )
        })()}

        {/* Cobrar — solo si no está pagado */}
        {!paid && (
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
            <button
              onClick={() => { if (!cajaOpen) { navigate('/pos/caja'); return } onCobro() }}
              style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: 'var(--amber)', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'var(--sans)' }}
            >
              {cajaOpen ? 'Cobrar →' : 'Abrir caja →'}
            </button>
          </div>
        )}

        {/* Anular */}
        <AnularPedido confirm={confirmCancel} setConfirm={setConfirmCancel} reason={cancelReason} setReason={setCancelReason} canceling={canceling} onConfirm={handleCancel} />
      </div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────

export default function OrdersBoard({ restaurantId, type }: { restaurantId: string; type: OrderType }) {
  const isDesktop = useIsDesktop()
  const [orders, setOrders] = useState<PosOrderLite[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PosOrderLite | null>(null)
  const [cobro, setCobro] = useState<PosOrderLite | null>(null)
  const [stageBusy, setStageBusy] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const navigate = usePosNav()
  const cashSession = useOpenCashSession(restaurantId)
  const cajaOpen = !!cashSession

  useEffect(() => {
    if (restaurantId) { setRestaurantId(restaurantId); setUserId(TEST_USER_ID) }
  }, [restaurantId])

  const fetchOrders = useCallback(async () => {
    if (!restaurantId) return
    try {
      const r = await fetch(`/api/panel/ecommerce/pos-orders?restaurantId=${restaurantId}&scope=activos`, { cache: 'no-store' })
      const d = await r.json()
      if (r.ok && Array.isArray(d.orders)) {
        setOrders(d.orders)
        // Keep selected in sync
        setSelected(prev => prev ? (d.orders.find((o: PosOrderLite) => o.id === prev.id) ?? null) : null)
      }
    } catch { }
    setLoading(false)
  }, [restaurantId])

  useEffect(() => {
    setLoading(true)
    fetchOrders()
    timerRef.current = setInterval(fetchOrders, 15_000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [fetchOrders])

  const list = useMemo(() => {
    return orders.filter((o) => {
      if (type === 'todos') return true
      const deliv = o.isDelivery || o.saleType === 'delivery'
      if (type === 'delivery') return deliv
      return !deliv && o.saleType !== 'dine-in' && o.saleType !== 'dinein'
    })
  }, [orders, type])

  const changeStage = async (order: PosOrderLite, stage: string) => {
    setStageBusy(order.id)
    try {
      const r = await fetch('/api/panel/ecommerce/pos-orders', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, id: order.id, opsStage: stage }),
      })
      if (r.ok) {
        if (stage === 'delivered') setSelected(null)
        fetchOrders()
      }
    } catch { }
    setStageBusy(null)
  }

  const newOrderLabel = type === 'delivery' ? 'Nuevo delivery' : type === 'retiro' ? 'Nuevo retiro' : 'Nuevo pedido'

  const listSection = (
    <div className="pos-scroll">
      <div className="pos-pad">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
            {type === 'delivery' ? 'Delivery' : type === 'retiro' ? 'Retiro' : 'Todos'} · {list.length}
          </div>
          <button
            onClick={() => navigate('/pos/tomar-pedido')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 9, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            {newOrderLabel}
          </button>
        </div>

        {/* List */}
        {loading && orders.length === 0 ? (
          <div className="pos-empty" style={{ minHeight: 200 }}>
            <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '3px solid var(--line)', borderTopColor: 'var(--amber)' }} />
          </div>
        ) : list.length === 0 ? (
          <div className="pos-empty" style={{ minHeight: 200 }}>
            <div className="ring">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 4.6A1 1 0 0 0 5.6 19H17"/><circle cx="9" cy="21" r="1"/><circle cx="18" cy="21" r="1"/></svg>
            </div>
            <p>Sin pedidos activos.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {list.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                isSelected={selected?.id === o.id}
                showTypeChip={type === 'todos'}
                stageBusy={stageBusy}
                onSelect={() => {
                  if (isDesktop) {
                    setSelected(prev => prev?.id === o.id ? null : o)
                  } else {
                    setSelected(o)
                  }
                }}
                onStageChange={changeStage}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )

  const detailSection = selected ? (
    <OrderDetailPanel
      order={selected}
      restaurantId={restaurantId}
      cajaOpen={cajaOpen}
      stageBusy={stageBusy}
      onStageChange={changeStage}
      onCobro={() => setCobro(selected)}
      onClose={() => setSelected(null)}
      onPaid={() => { setSelected(null); fetchOrders() }}
      navigate={navigate}
    />
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--ink-3)', height: '100%', padding: 24, textAlign: 'center' }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
        <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 4.6A1 1 0 0 0 5.6 19H17"/>
        <circle cx="9" cy="21" r="1"/><circle cx="18" cy="21" r="1"/>
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
        {cobro && (
          <CobroModal order={cobro} restaurantId={restaurantId} type={type} onClose={() => setCobro(null)} onPaid={() => { setCobro(null); fetchOrders() }} />
        )}
      </div>
    )
  }

  // Mobile: list + modal for detail
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
            <OrderDetailPanel
              order={selected}
              restaurantId={restaurantId}
              cajaOpen={cajaOpen}
              stageBusy={stageBusy}
              onStageChange={changeStage}
              onCobro={() => { setCobro(selected); setSelected(null) }}
              onClose={() => setSelected(null)}
              onPaid={() => { setSelected(null); fetchOrders() }}
              navigate={navigate}
            />
          </div>
        </div>
      )}
      {cobro && (
        <CobroModal order={cobro} restaurantId={restaurantId} type={type} onClose={() => setCobro(null)} onPaid={() => { setCobro(null); fetchOrders() }} />
      )}
    </>
  )
}

// ── Modal de cobro ─────────────────────────────────────────────────
function CobroModal({ order, restaurantId, type, onClose, onPaid }: { order: PosOrderLite; restaurantId: string; type: OrderType; onClose: () => void; onPaid: () => void }) {
  const total = order.totalAmount || 0
  const paid = isPaid(order)
  const [method, setMethod] = useState<PaymentMethod>('efectivo')
  const [received, setReceived] = useState<string>('')
  const [tip, setTip] = useState<string>('')
  const [sending, setSending] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [canceling, setCanceling] = useState(false)
  const navigate = usePosNav()

  const handleCancel = async () => {
    setCanceling(true)
    try {
      const r = await fetch('/api/panel/ecommerce/pos-orders', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, id: order.id, action: 'cancel', reason: cancelReason.trim() }),
      })
      if (r.ok) onPaid()
    } catch { }
    setCanceling(false)
  }

  const [finalizing, setFinalizing] = useState(false)
  const handleFinalize = async () => {
    setFinalizing(true)
    try {
      const r = await fetch('/api/panel/ecommerce/pos-orders', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, id: order.id, opsStage: 'delivered' }),
      })
      if (r.ok) onPaid()
    } catch { }
    setFinalizing(false)
  }

  const receivedNum = parseInt(received, 10) || 0
  const tipNum = parseInt(tip, 10) || 0
  const change = method === 'efectivo' ? Math.max(0, receivedNum - total) : 0
  const canPay = method !== 'efectivo' || receivedNum >= total
  const BILLS = [1000, 2000, 5000, 10000, 20000]

  const handlePay = async () => {
    setSending(true)
    try {
      const r = await fetch('/api/panel/ecommerce/pos-orders', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, id: order.id, action: 'pay', method, received: receivedNum, tip: tipNum }),
      })
      if (r.ok) onPaid()
    } catch { }
    setSending(false)
  }

  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }
  const num: React.CSSProperties = { fontFamily: 'var(--mono)', fontVariantNumeric: 'tabular-nums' }

  if (paid) {
    const rp = (order.rawPayload && typeof order.rawPayload === 'object' && !Array.isArray(order.rawPayload)) ? (order.rawPayload as Record<string, unknown>) : {}
    const pp = (rp.posPayment as { method?: string } | undefined) || undefined
    const wp = (rp.webPayment as { method?: string } | undefined) || undefined
    const payLabel = pp?.method || wp?.method || ''
    return (
      <div className="pos-modal-overlay" onClick={onClose}>
        <div className="pos-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, width: '100%' }}>
          <div className="pos-modal-title">{order.customerName || 'Cliente'}</div>
          <div style={{ ...row, borderBottom: '1px dashed var(--line-strong)', paddingBottom: 10, marginBottom: 10 }}>
            <span style={{ color: 'var(--ink-2)', fontSize: 14 }}>Total</span>
            <span style={{ ...num, fontWeight: 800, fontSize: 22, color: 'var(--ink)' }}>{clp(total)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#16a34a', fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            Pagado{payLabel ? ` · ${payLabel}` : ''}
          </div>
          {order.tipAmount > 0 && <div style={{ ...row }}><span style={{ color: 'var(--ink-2)', fontSize: 14 }}>Propina</span><span style={num}>{clp(order.tipAmount)}</span></div>}
          <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 10, lineHeight: 1.5 }}>Este pedido ya está pagado. Al cerrarlo se marca como entregado y sale de los activos.</p>
          <div className="pos-modal-actions" style={{ marginTop: 14 }}>
            <button className="pos-modal-cancel" onClick={onClose}>Volver</button>
            <button className="pos-modal-ok" disabled={finalizing} style={{ opacity: finalizing ? 0.6 : 1 }} onClick={handleFinalize}>
              {finalizing ? 'Cerrando…' : 'Cerrar pedido'}
            </button>
          </div>
          <AnularPedido confirm={confirmCancel} setConfirm={setConfirmCancel} reason={cancelReason} setReason={setCancelReason} canceling={canceling} onConfirm={handleCancel} />
        </div>
      </div>
    )
  }

  return (
    <div className="pos-modal-overlay" onClick={onClose}>
      <div className="pos-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, width: '100%' }}>
        <div className="pos-modal-title">Cobrar · {order.customerName || 'Cliente'}</div>

        <div style={{ ...row, borderBottom: '1px dashed var(--line-strong)', paddingBottom: 10, marginBottom: 6 }}>
          <span style={{ color: 'var(--ink-2)', fontSize: 14 }}>Total</span>
          <span style={{ ...num, fontWeight: 800, fontSize: 22, color: 'var(--ink)' }}>{clp(total)}</span>
        </div>

        <label className="pos-modal-label">Método de pago</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          {METHODS.map((m) => (
            <button key={m.id} onClick={() => setMethod(m.id)} style={{
              padding: '10px 6px', borderRadius: 10, cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 13,
              border: method === m.id ? '2px solid var(--amber)' : '1px solid var(--line)',
              background: method === m.id ? 'var(--amber-tint)' : 'var(--sunk)',
              color: method === m.id ? 'var(--amber-press)' : 'var(--ink-2)',
            }}>{m.label}</button>
          ))}
        </div>

        {method === 'efectivo' && (
          <>
            <label className="pos-modal-label">Con cuánto paga</label>
            <input type="number" inputMode="numeric" value={received} onChange={(e) => setReceived(e.target.value)} onDoubleClick={() => setReceived(String(total))} placeholder={String(total)}
              style={{ width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--sunk)', fontSize: 16, fontFamily: 'var(--mono)', color: 'var(--ink)', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {BILLS.filter((b) => b >= total).slice(0, 4).map((b) => (
                <button key={b} onClick={() => setReceived(String(b))} style={chipSmall}>{clp(b)}</button>
              ))}
            </div>
            <div style={{ ...row, marginBottom: 6 }}>
              <span style={{ color: 'var(--ink-2)', fontSize: 14 }}>Vuelto</span>
              <span style={{ ...num, fontWeight: 700, fontSize: 18, color: change > 0 ? 'var(--amber-press)' : 'var(--ink-3)' }}>{clp(change)}</span>
            </div>
          </>
        )}

        <label className="pos-modal-label">Propina (opcional)</label>
        <input type="number" inputMode="numeric" value={tip} onChange={(e) => setTip(e.target.value)} placeholder="0"
          style={{ width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--sunk)', fontSize: 16, fontFamily: 'var(--mono)', color: 'var(--ink)', outline: 'none', boxSizing: 'border-box', marginBottom: 16 }} />

        <div className="pos-modal-actions">
          <button className="pos-modal-cancel" onClick={onClose}>Cancelar</button>
          <button className="pos-modal-ok" disabled={!canPay || sending} onClick={handlePay} style={{ opacity: !canPay || sending ? 0.6 : 1 }}>
            {sending ? 'Cobrando…' : `Cobrar ${clp(total)}`}
          </button>
        </div>

        <AnularPedido confirm={confirmCancel} setConfirm={setConfirmCancel} reason={cancelReason} setReason={setCancelReason} canceling={canceling} onConfirm={handleCancel} />
      </div>
    </div>
  )
}

// ── Anular pedido ───────────────────────────────────────────────────
function AnularPedido({ confirm, setConfirm, reason, setReason, canceling, onConfirm }: {
  confirm: boolean; setConfirm: (v: boolean) => void; reason: string; setReason: (v: string) => void; canceling: boolean; onConfirm: () => void;
}) {
  if (!confirm) {
    return (
      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 4 }}>
        <button
          onClick={() => setConfirm(true)}
          style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 14px', width: '100%', color: 'var(--ink-3)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)' }}
        >
          Anular pedido
        </button>
      </div>
    )
  }
  return (
    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>¿Anular este pedido?</div>
      <input
        value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo (opcional)"
        style={{ width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--sunk)', fontSize: 14, color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setConfirm(false)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--sans)' }}>Cancelar</button>
        <button onClick={onConfirm} disabled={canceling} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: '#C53030', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: canceling ? 0.6 : 1, fontFamily: 'var(--sans)' }}>
          {canceling ? 'Anulando…' : 'Confirmar'}
        </button>
      </div>
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────

function chip(color: string): React.CSSProperties {
  return {
    fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, letterSpacing: '.04em',
    textTransform: 'uppercase', padding: '3px 6px', borderRadius: 5,
    background: color + '20', color,
  }
}

function stagePill(color: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '5px 10px', borderRadius: 20,
    background: color + '18', border: `1px solid ${color}40`,
    color, fontWeight: 700, fontSize: 13, fontFamily: 'var(--sans)',
  }
}

const chipSmall: React.CSSProperties = {
  padding: '7px 11px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--sunk)',
  color: 'var(--ink-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--mono)',
}
