'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { PREP_DEFAULT_MIN, PREP_SNOOZE_MS, isRetiroOrder, prepSnooze, prepSnoozedUntil, fmtElapsedMin, type PrepAlertOrder } from '../lib/prepAlert'

const toName = (s: string) => s.trim().replace(/\S+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase())

/**
 * Vigilante GLOBAL (montado en el POS, corre en TODAS las pestañas, incluida
 * Mesas) que avisa con un modal cuando un pedido de RETIRO lleva demasiado
 * tiempo en "En preparación". El umbral (minutos) es configurable por local
 * (centroPedidosConfig.prepAlertMinutes; 0 = desactivado).
 */
export default function PrepAlertWatcher({
  restaurantId, orders, prepAlertMinutes, onChanged,
}: {
  restaurantId: string
  orders: PrepAlertOrder[]
  prepAlertMinutes?: number | null
  onChanged?: () => void
}) {
  const [alertId, setAlertId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const ordersRef = useRef<PrepAlertOrder[]>([])
  ordersRef.current = orders

  const thresholdMin = typeof prepAlertMinutes === 'number' ? prepAlertMinutes : PREP_DEFAULT_MIN
  const thresholdMs = thresholdMin * 60 * 1000

  const evalAlerts = useCallback(() => {
    if (thresholdMin <= 0) { setAlertId(null); return } // desactivado
    const now = Date.now()
    setAlertId(prev => {
      if (prev) {
        const o = ordersRef.current.find(x => x.id === prev)
        if (o && isRetiroOrder(o) && o.opsStage === 'preparing') return prev
      }
      const cand = ordersRef.current.find(o =>
        isRetiroOrder(o) && o.opsStage === 'preparing' &&
        now - new Date(o.createdAt).getTime() >= thresholdMs &&
        prepSnoozedUntil(o.id) < now,
      )
      return cand ? cand.id : null
    })
  }, [thresholdMin, thresholdMs])

  useEffect(() => {
    evalAlerts()
    const t = setInterval(evalAlerts, 20_000)
    return () => clearInterval(t)
  }, [evalAlerts, orders])

  const order = alertId ? orders.find(o => o.id === alertId) ?? null : null
  if (!order) return null

  const markReady = async () => {
    if (busy) return
    setBusy(true)
    try {
      await fetch('/api/panel/ecommerce/pos-orders', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, id: order.id, opsStage: 'ready' }),
      })
      onChanged?.()
    } catch { }
    setBusy(false)
    setAlertId(null)
  }
  const postpone = () => { prepSnooze(order.id, PREP_SNOOZE_MS); setAlertId(null) }

  const label = `#${order.orderReference ?? order.dailyNumber ?? ''} ${toName(order.customerName || 'Cliente')}`.trim()
  const elapsed = fmtElapsedMin(Date.now() - new Date(order.createdAt).getTime())

  return (
    <div className="pos-modal-overlay" onClick={postpone}>
      <div className="pos-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--amber-tint)', color: 'var(--amber-press)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
          </span>
          <div className="pos-modal-title" style={{ margin: 0 }}>Pedido en preparación</div>
        </div>
        <p style={{ fontSize: 14.5, color: 'var(--ink-2)', lineHeight: 1.5, margin: '0 0 18px' }}>
          El pedido <b>{label}</b> lleva <b>{elapsed}</b> en preparación. ¿Marcarlo como listo?
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="pos-modal-ok" style={{ width: '100%', opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={markReady}>
            {busy ? 'Marcando…' : 'Marcar listo'}
          </button>
          <button className="pos-modal-cancel" style={{ width: '100%' }} onClick={postpone}>
            Posponer 1 hora más
          </button>
        </div>
      </div>
    </div>
  )
}
