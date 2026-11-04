'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { PREP_DEFAULT_MIN, PREP_SNOOZE_MS, isRetiroOrder, prepSnooze, prepSnoozedUntil, fmtElapsedMin, type PrepAlertOrder } from '../lib/prepAlert'

const READY_DEFAULT_MIN = 30

const toName = (s: string) => s.trim().replace(/\S+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase())

type AlertKind = 'prep' | 'ready'

/**
 * Vigilante GLOBAL (montado en el POS, corre en TODAS las pestañas, incluida
 * Mesas) con dos alertas para pedidos de RETIRO:
 *  - prep:  demasiado tiempo "En preparación" → sugiere marcar listo.
 *  - ready: "Listo" pero el cliente no lo retira → sugiere llamarlo (muestra el
 *           teléfono) y permite marcar entregado.
 * Umbrales configurables por local (centroPedidosConfig.prep/readyAlertMinutes;
 * 0 = desactivado).
 */
export default function PrepAlertWatcher({
  restaurantId, orders, prepAlertMinutes, readyAlertMinutes, onChanged,
}: {
  restaurantId: string
  orders: PrepAlertOrder[]
  prepAlertMinutes?: number | null
  readyAlertMinutes?: number | null
  onChanged?: () => void
}) {
  const [alert, setAlert] = useState<{ id: string; kind: AlertKind } | null>(null)
  const [busy, setBusy] = useState(false)
  const ordersRef = useRef<PrepAlertOrder[]>([])
  ordersRef.current = orders

  const prepMin = typeof prepAlertMinutes === 'number' ? prepAlertMinutes : PREP_DEFAULT_MIN
  const readyMin = typeof readyAlertMinutes === 'number' ? readyAlertMinutes : READY_DEFAULT_MIN

  // ¿La orden sigue cumpliendo la condición de su alerta?
  const stillValid = useCallback((id: string, kind: AlertKind): boolean => {
    const o = ordersRef.current.find(x => x.id === id)
    if (!o || !isRetiroOrder(o)) return false
    return kind === 'prep' ? o.opsStage === 'preparing' : o.opsStage === 'ready'
  }, [])

  const evalAlerts = useCallback(() => {
    const now = Date.now()
    setAlert(prev => {
      if (prev && stillValid(prev.id, prev.kind)) return prev
      // Prioridad: cliente que no retira (ready) antes que demora en preparación.
      if (readyMin > 0) {
        const r = ordersRef.current.find(o =>
          isRetiroOrder(o) && o.opsStage === 'ready' && o.opsReadyForDeliveryAt &&
          now - new Date(o.opsReadyForDeliveryAt).getTime() >= readyMin * 60000 &&
          prepSnoozedUntil(`${o.id}:ready`) < now,
        )
        if (r) return { id: r.id, kind: 'ready' as const }
      }
      if (prepMin > 0) {
        const p = ordersRef.current.find(o =>
          isRetiroOrder(o) && o.opsStage === 'preparing' &&
          now - new Date(o.createdAt).getTime() >= prepMin * 60000 &&
          prepSnoozedUntil(`${o.id}:prep`) < now,
        )
        if (p) return { id: p.id, kind: 'prep' as const }
      }
      return null
    })
  }, [prepMin, readyMin, stillValid])

  useEffect(() => {
    evalAlerts()
    const t = setInterval(evalAlerts, 20_000)
    return () => clearInterval(t)
  }, [evalAlerts, orders])

  const order = alert ? orders.find(o => o.id === alert.id) ?? null : null
  if (!order || !alert) return null

  const setStage = async (stage: 'ready' | 'delivered') => {
    if (busy) return
    setBusy(true)
    try {
      await fetch('/api/panel/ecommerce/pos-orders', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, id: order.id, opsStage: stage }),
      })
      onChanged?.()
    } catch { }
    setBusy(false)
    setAlert(null)
  }
  const postpone = () => { prepSnooze(`${order.id}:${alert.kind}`, PREP_SNOOZE_MS); setAlert(null) }

  const label = `#${order.orderReference ?? order.dailyNumber ?? ''} ${toName(order.customerName || 'Cliente')}`.trim()
  const phone = (order.customerPhone || '').trim()
  const since = alert.kind === 'ready' ? order.opsReadyForDeliveryAt : order.createdAt
  const elapsed = since ? fmtElapsedMin(Date.now() - new Date(since).getTime()) : ''

  const amber = { bg: 'var(--amber-tint)', fg: 'var(--amber-press)' }

  return (
    <div className="pos-modal-overlay" onClick={postpone}>
      <div className="pos-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ width: 36, height: 36, borderRadius: '50%', background: amber.bg, color: amber.fg, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            {alert.kind === 'ready'
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
              : <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>}
          </span>
          <div className="pos-modal-title" style={{ margin: 0 }}>{alert.kind === 'ready' ? 'Pedido sin retirar' : 'Pedido en preparación'}</div>
        </div>

        {alert.kind === 'ready' ? (
          <>
            <p style={{ fontSize: 14.5, color: 'var(--ink-2)', lineHeight: 1.5, margin: '0 0 14px' }}>
              El pedido <b>{label}</b> lleva <b>{elapsed}</b> listo y el cliente no lo ha retirado. Llámalo para avisarle.
            </p>
            {phone ? (
              <a href={`tel:${phone}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, textDecoration: 'none', background: '#16a34a', color: '#fff', borderRadius: 12, padding: '12px 14px', fontWeight: 700, fontSize: 16, marginBottom: 16, fontFamily: 'var(--mono)' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11 11 0 0 0 3.5.56 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.3a1 1 0 0 1 1 1 11 11 0 0 0 .56 3.5 1 1 0 0 1-.25 1z" /></svg>
                {phone}
              </a>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: '0 0 16px' }}>El pedido no tiene teléfono registrado.</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="pos-modal-ok" style={{ width: '100%', opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => setStage('delivered')}>
                {busy ? 'Marcando…' : 'Marcar entregado'}
              </button>
              <button className="pos-modal-cancel" style={{ width: '100%' }} onClick={postpone}>
                Posponer 1 hora más
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: 14.5, color: 'var(--ink-2)', lineHeight: 1.5, margin: '0 0 18px' }}>
              El pedido <b>{label}</b> lleva <b>{elapsed}</b> en preparación. ¿Marcarlo como listo?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="pos-modal-ok" style={{ width: '100%', opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => setStage('ready')}>
                {busy ? 'Marcando…' : 'Marcar listo'}
              </button>
              <button className="pos-modal-cancel" style={{ width: '100%' }} onClick={postpone}>
                Posponer 1 hora más
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
