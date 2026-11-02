'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { setRestaurantId, setUserId, registerExternalPayment, useOpenCashSession } from '@/lib/pos'
import type { PaymentMethod } from '@/lib/pos'
import { usePosNav } from '../lib/usePosNav'

type OrderType = 'retiro' | 'delivery'

const TEST_USER_ID = 'pos-garzon'

// Métodos de pago del POS (para que el arqueo cuadre por método)
const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'debito', label: 'Débito' },
  { id: 'credito', label: 'Crédito' },
  { id: 'transferencia', label: 'Transferencia' },
]

interface PosOrderLite {
  id: string
  customerName: string
  customerPhone: string
  addressLine: string
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

const STAGE_LABEL: Record<string, string> = {
  preparing: 'En preparación',
  ready: 'Listo',
  out_for_delivery: 'En reparto',
  delivered: 'Entregado',
}

const isPaid = (o: PosOrderLite) => o.totalAmount > 0 && o.paidAmount >= o.totalAmount

function itemLines(items: unknown): { name: string; qty: number }[] {
  if (!Array.isArray(items)) return []
  return items.map((it) => {
    const o = (it || {}) as Record<string, unknown>
    const name = String(o.name ?? o.productName ?? o.title ?? o.description ?? 'Ítem')
    const qty = Number(o.quantity ?? o.qty ?? o.cantidad ?? 1) || 1
    return { name, qty }
  })
}

export default function OrdersBoard({ restaurantId, type }: { restaurantId: string; type: OrderType }) {
  const [orders, setOrders] = useState<PosOrderLite[]>([])
  const [loading, setLoading] = useState(true)
  const [cobro, setCobro] = useState<PosOrderLite | null>(null)
  const [needCaja, setNeedCaja] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const navigate = usePosNav()
  const cashSession = useOpenCashSession()
  const cajaOpen = !!cashSession

  useEffect(() => {
    if (restaurantId) { setRestaurantId(restaurantId); setUserId(TEST_USER_ID) }
  }, [restaurantId])

  const fetchOrders = useCallback(async () => {
    if (!restaurantId) return
    try {
      const r = await fetch(`/api/panel/ecommerce/pos-orders?restaurantId=${restaurantId}&scope=activos`, { cache: 'no-store' })
      const d = await r.json()
      if (r.ok && Array.isArray(d.orders)) setOrders(d.orders)
    } catch { /* noop */ }
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
      const deliv = o.isDelivery || o.saleType === 'delivery'
      if (type === 'delivery') return deliv
      // Retiro: pickup y todo lo que no sea delivery ni consumo en local
      return !deliv && o.saleType !== 'dine-in' && o.saleType !== 'dinein'
    })
  }, [orders, type])

  const accent = type === 'delivery' ? 'var(--amber)' : 'var(--ink)'

  return (
    <div className="pos-pad">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
          {type === 'delivery' ? 'Delivery' : 'Retiro'} · {list.length}
        </div>
        <button onClick={fetchOrders} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 9, padding: '7px 12px', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--sans)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"/></svg>
          Actualizar
        </button>
      </div>

      {!cajaOpen && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', background: 'rgba(222,124,0,.08)', border: '1px solid #f0e0c0', borderRadius: 12, padding: '10px 14px', marginBottom: 14 }}>
          <span style={{ fontSize: 13, color: 'var(--amber-press)', fontWeight: 600 }}>
            Caja cerrada · abre la caja para poder cobrar y que el pago entre al arqueo.
          </span>
          <button onClick={() => navigate('/pos/caja')} style={{ flexShrink: 0, border: 0, background: 'var(--amber)', color: '#fff', borderRadius: 9, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--sans)' }}>Abrir caja</button>
        </div>
      )}

      {loading && orders.length === 0 ? (
        <div className="pos-empty" style={{ minHeight: 200 }}>
          <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '3px solid var(--line)', borderTopColor: 'var(--amber)' }} />
        </div>
      ) : list.length === 0 ? (
        <div className="pos-empty" style={{ minHeight: 200 }}>
          <div className="ring">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 4.6A1 1 0 0 0 5.6 19H17"/><circle cx="9" cy="21" r="1"/><circle cx="18" cy="21" r="1"/></svg>
          </div>
          <p>Sin pedidos de {type === 'delivery' ? 'delivery' : 'retiro'} activos.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(270px,1fr))', gap: 12 }}>
          {list.map((o) => {
            const paid = isPaid(o)
            const lines = itemLines(o.items)
            const qty = lines.reduce((s, l) => s + l.qty, 0)
            return (
              <button
                key={o.id}
                onClick={() => { if (!paid && !cajaOpen) { setNeedCaja(true); return } setCobro(o) }}
                style={{ textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--line)', borderLeft: `3px solid ${accent}`, borderRadius: 14, padding: 14, cursor: 'pointer', boxShadow: 'var(--sh-1)', display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'var(--sans)' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', lineHeight: 1.2 }}>{o.customerName || 'Cliente'}</div>
                  <span style={{ flexShrink: 0, fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', padding: '3px 7px', borderRadius: 6, background: paid ? 'rgba(22,163,74,.12)' : 'rgba(222,124,0,.12)', color: paid ? '#16a34a' : 'var(--amber-press)' }}>
                    {paid ? 'Pagado' : 'Por cobrar'}
                  </span>
                </div>
                {o.vendorName && (
                  <span style={{ alignSelf: 'flex-start', fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, letterSpacing: '.03em', color: 'var(--ink-2)', background: 'var(--sunk)', border: '1px solid var(--line)', borderRadius: 6, padding: '2px 7px' }}>{o.vendorName}</span>
                )}
                {o.customerPhone && <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{o.customerPhone}</div>}
                {type === 'delivery' && o.addressLine && <div style={{ fontSize: 12, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.addressLine}</div>}
                <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                  {lines.length > 0 ? `${qty} ítem${qty !== 1 ? 's' : ''} · ` : ''}
                  <span style={{ color: 'var(--ink-3)' }}>{STAGE_LABEL[o.opsStage] || o.opsStage}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 19, color: 'var(--ink)' }}>{clp(o.totalAmount)}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: paid ? '#16a34a' : accent }}>{paid ? 'Cerrar →' : 'Cobrar →'}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {cobro && (
        <CobroModal order={cobro} restaurantId={restaurantId} type={type} onClose={() => setCobro(null)} onPaid={() => { setCobro(null); fetchOrders() }} />
      )}

      {needCaja && (
        <div className="pos-modal-overlay" onClick={() => setNeedCaja(false)}>
          <div className="pos-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400, width: '100%' }}>
            <div className="pos-modal-title">Caja cerrada</div>
            <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 20 }}>
              Para cobrar un pedido necesitas tener la caja abierta. Así el pago queda registrado en el arqueo del turno.
            </p>
            <div className="pos-modal-actions">
              <button className="pos-modal-cancel" onClick={() => setNeedCaja(false)}>Cancelar</button>
              <button className="pos-modal-ok" onClick={() => { setNeedCaja(false); navigate('/pos/caja') }}>Abrir caja</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Modal de cobro (completo: método, recibido, vuelto, propina) ──────
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

  const handleCancel = async () => {
    setCanceling(true)
    try {
      const r = await fetch('/api/panel/ecommerce/pos-orders', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, id: order.id, action: 'cancel', reason: cancelReason.trim() }),
      })
      if (r.ok) onPaid() // refresca la lista y cierra el modal
    } catch { /* noop */ }
    setCanceling(false)
  }

  const [finalizing, setFinalizing] = useState(false)
  // Cerrar el pedido = marcarlo como entregado (sale de activos y pasa al historial).
  // Cobrar ≠ cerrar: cobrar registra el pago; cerrar finaliza el pedido.
  const handleFinalize = async () => {
    setFinalizing(true)
    try {
      const r = await fetch('/api/panel/ecommerce/pos-orders', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, id: order.id, opsStage: 'delivered' }),
      })
      if (r.ok) onPaid() // refresca la lista y cierra el modal
    } catch { /* noop */ }
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
      if (r.ok) {
        // Registrar en la caja del POS (cuenta cerrada con el pago) para el arqueo.
        await registerExternalPayment({ orderId: order.id, type, customerName: order.customerName, amount: total, tip: tipNum, method }).catch(() => {})
        onPaid()
      }
    } catch { /* noop */ }
    setSending(false)
  }

  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }
  const num: React.CSSProperties = { fontFamily: 'var(--mono)', fontVariantNumeric: 'tabular-nums' }

  // Pedido ya pagado (p.ej. online): solo lectura, no se re-cobra ni se duplica en caja.
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

        {/* Método */}
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

        {/* Efectivo: recibido + vuelto */}
        {method === 'efectivo' && (
          <>
            <label className="pos-modal-label">Con cuánto paga</label>
            {/* Doble clic en el campo = "Justo": carga el monto total. */}
            <input type="number" inputMode="numeric" value={received} onChange={(e) => setReceived(e.target.value)} onDoubleClick={() => setReceived(String(total))} placeholder={String(total)}
              style={{ width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--sunk)', fontSize: 16, fontFamily: 'var(--mono)', color: 'var(--ink)', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {BILLS.filter((b) => b >= total).slice(0, 4).map((b) => (
                <button key={b} onClick={() => setReceived(String(b))} style={chip}>{clp(b)}</button>
              ))}
            </div>
            <div style={{ ...row, marginBottom: 6 }}>
              <span style={{ color: 'var(--ink-2)', fontSize: 14 }}>Vuelto</span>
              <span style={{ ...num, fontWeight: 700, fontSize: 18, color: change > 0 ? 'var(--amber-press)' : 'var(--ink-3)' }}>{clp(change)}</span>
            </div>
          </>
        )}

        {/* Propina */}
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

// Bloque "Anular pedido" (dos pasos: botón → confirmación con motivo).
function AnularPedido({ confirm, setConfirm, reason, setReason, canceling, onConfirm }: {
  confirm: boolean; setConfirm: (v: boolean) => void; reason: string; setReason: (v: string) => void; canceling: boolean; onConfirm: () => void;
}) {
  if (!confirm) {
    return (
      <button onClick={() => setConfirm(true)} style={{ marginTop: 12, width: '100%', background: 'transparent', border: 'none', color: '#C53030', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)' }}>
        Anular pedido
      </button>
    )
  }
  return (
    <div style={{ marginTop: 12, padding: 12, borderRadius: 10, border: '1px solid #f0c0c0', background: 'rgba(197,48,48,.05)' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#C53030', marginBottom: 8 }}>¿Anular este pedido?</div>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo (opcional)"
        style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--sunk)', fontSize: 14, color: 'var(--ink)', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setConfirm(false)} style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>No</button>
        <button onClick={onConfirm} disabled={canceling} style={{ flex: 1, padding: '10px', borderRadius: 9, border: 'none', background: '#C53030', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: canceling ? 0.6 : 1 }}>
          {canceling ? 'Anulando…' : 'Sí, anular'}
        </button>
      </div>
    </div>
  )
}

const chip: React.CSSProperties = {
  padding: '7px 11px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--sunk)',
  color: 'var(--ink-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--mono)',
}
