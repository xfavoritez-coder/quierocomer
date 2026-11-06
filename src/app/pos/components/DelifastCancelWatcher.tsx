'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Motorbike } from 'lucide-react'
import { prepSnooze, prepSnoozedUntil, PREP_SNOOZE_MS } from '../lib/prepAlert'

const POLL_MS = 20_000
const snoozeKey = (id: string) => `delifast_cancel:${id}`

interface WatchOrder {
  id: string
  delifastVentaId?: string | null
  orderReference?: string | null
  customerName: string
  dailyNumber?: number | null
  opsStage: string
  isDelivery: boolean
  _branchId?: string
}

const toName = (s: string) => s.trim().replace(/\S+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase())

/** Vigía global: detecta cuando Delifast cancela el reparto de un pedido activo
 *  y muestra un modal para gestionarlo y marcarlo como entregado. */
export default function DelifastCancelWatcher({
  restaurantId, orders, onChanged,
}: {
  restaurantId: string
  orders: WatchOrder[]
  onChanged?: () => void
}) {
  const [alert, setAlert] = useState<{ id: string; branchId: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const ordersRef = useRef<WatchOrder[]>([])
  ordersRef.current = orders

  const checkOrders = useCallback(async () => {
    const now = Date.now()
    // Solo pedidos delivery con delifastVentaId que aún no estén entregados/cancelados en POS
    const candidates = ordersRef.current.filter(o =>
      o.isDelivery &&
      o.delifastVentaId &&
      o.opsStage !== 'delivered' &&
      prepSnoozedUntil(snoozeKey(o.id)) < now,
    )
    for (const order of candidates) {
      try {
        const rid = order._branchId || restaurantId
        const res = await fetch(
          `/api/pos/delivery-tracking?restaurantId=${rid}&posOrderId=${order.id}`,
          { cache: 'no-store' },
        )
        const d = await res.json()
        if (!d.configured || !d.tracking) continue
        const status = (d.tracking.status || '').toLowerCase()
        const isCancelled = /cancel|anul/.test(status) || !!d.tracking.timeline?.cancelado
        if (isCancelled && prepSnoozedUntil(snoozeKey(order.id)) < Date.now()) {
          setAlert(prev => prev ?? { id: order.id, branchId: rid })
          return // un modal a la vez
        }
      } catch { /* fail-silent */ }
    }
  }, [restaurantId])

  useEffect(() => {
    checkOrders()
    const t = setInterval(checkOrders, POLL_MS)
    return () => clearInterval(t)
  }, [checkOrders, orders])

  const order = alert ? ordersRef.current.find(o => o.id === alert.id) ?? null : null
  if (!order || !alert) return null

  const label = `#${order.orderReference ?? order.dailyNumber ?? ''} ${toName(order.customerName || 'Cliente')}`.trim()

  const markDelivered = async () => {
    if (busy) return
    setBusy(true)
    prepSnooze(snoozeKey(order.id), PREP_SNOOZE_MS)
    setAlert(null)
    try {
      await fetch('/api/panel/ecommerce/pos-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId: alert.branchId, id: order.id, opsStage: 'delivered' }),
      })
      onChanged?.()
    } catch { }
    setBusy(false)
  }

  const postpone = () => {
    prepSnooze(snoozeKey(order.id), PREP_SNOOZE_MS)
    setAlert(null)
  }

  return (
    <div className="pos-modal-overlay" onClick={postpone}>
      <div className="pos-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(220,38,38,.12)', color: '#dc2626',
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}>
            <Motorbike size={18} />
          </span>
          <div className="pos-modal-title" style={{ margin: 0 }}>Reparto cancelado en Delifast</div>
        </div>
        <p style={{ fontSize: 14.5, color: 'var(--ink-2)', lineHeight: 1.5, margin: '0 0 18px' }}>
          El reparto del pedido <b>{label}</b> fue cancelado en Delifast.
          Gestiona el envío con otro servicio y cuando llegue al cliente marca el pedido como entregado.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            className="pos-modal-ok"
            style={{ width: '100%', background: '#dc2626', opacity: busy ? 0.6 : 1 }}
            disabled={busy}
            onClick={markDelivered}
          >
            {busy ? 'Marcando…' : 'Marcar entregado'}
          </button>
          <button className="pos-modal-cancel" style={{ width: '100%' }} onClick={postpone}>
            Gestionar después
          </button>
        </div>
      </div>
    </div>
  )
}
