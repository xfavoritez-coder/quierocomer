'use client'

import { useState } from 'react'
import { clp } from '@/lib/ecommerce/format'

export interface OpenOrderLite {
  id: string
  customerName?: string | null
  tableLabel?: string | null
  saleType?: string | null
  orderReference?: string | null
  opsStage?: string | null
  totalAmount?: number | null
  isDelivery?: boolean
}

// Modal que aparece al cerrar la caja (si el local activó "Avisar pedidos abiertos
// al cerrar caja"): lista los pedidos sin entregar y deja entregarlos ahí mismo, o
// cerrar de todas formas. Compartido por las dos UIs de caja (PosCajaPanel + /pos/caja).
export default function CloseOpenOrdersModal({
  restaurantId, initialOrders, onCancel, onProceed,
}: {
  restaurantId: string
  initialOrders: OpenOrderLite[]
  onCancel: () => void
  onProceed: () => void
}) {
  const [orders, setOrders] = useState<OpenOrderLite[]>(initialOrders)
  const [busyId, setBusyId] = useState<string | null>(null)

  const refetch = async () => {
    try {
      const r = await fetch(`/api/panel/ecommerce/pos-orders?restaurantId=${restaurantId}&scope=activos`, { cache: 'no-store' })
      const d = await r.json()
      const list = Array.isArray(d.orders) ? d.orders : []
      setOrders(list.filter((o: OpenOrderLite & { posStatus?: string }) => o.opsStage !== 'delivered' && (o as { posStatus?: string }).posStatus !== 'canceled'))
    } catch { /* noop */ }
  }

  const deliver = async (o: OpenOrderLite) => {
    setBusyId(o.id)
    try {
      await fetch('/api/panel/ecommerce/pos-orders', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, id: o.id, opsStage: 'delivered' }),
      })
    } catch { /* noop */ }
    setBusyId(null)
    await refetch()
  }

  const label = (o: OpenOrderLite) =>
    o.tableLabel ? `Mesa ${o.tableLabel}` : o.orderReference ? `#${o.orderReference}` : (o.customerName || 'Pedido')
  const typeLabel = (o: OpenOrderLite) =>
    (o.saleType === 'dine-in' || o.saleType === 'dinein') ? 'Mesa'
      : (o.isDelivery || o.saleType === 'delivery') ? 'Delivery' : 'Retiro'

  return (
    <div className="pos-modal-overlay" onClick={onCancel}>
      <div className="pos-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440, width: '100%', display: 'flex', flexDirection: 'column', maxHeight: '85dvh' }}>
        <div className="pos-modal-title">Pedidos abiertos</div>
        <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, margin: '0 0 14px' }}>
          {orders.length > 0
            ? `Hay ${orders.length} pedido${orders.length !== 1 ? 's' : ''} sin entregar. Puedes entregarlos aquí o cerrar la caja de todas formas.`
            : 'Ya no hay pedidos sin entregar.'}
        </p>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {orders.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--jade)', fontWeight: 700, fontSize: 14, padding: '18px 0' }}>✓ Todos entregados</div>
          ) : orders.map((o) => (
            <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--sunk)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label(o)}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>{typeLabel(o)} · {clp(o.totalAmount || 0)}</div>
              </div>
              <button
                onClick={() => deliver(o)}
                disabled={busyId === o.id}
                style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 9, border: '1px solid var(--jade)', background: 'none', color: 'var(--jade)', fontWeight: 700, fontSize: 12, cursor: busyId === o.id ? 'wait' : 'pointer', fontFamily: 'var(--sans)' }}
              >
                {busyId === o.id ? '…' : (<><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>Entregar</>)}
              </button>
            </div>
          ))}
        </div>

        <div className="pos-modal-actions">
          <button className="pos-modal-cancel" onClick={onCancel}>Cancelar</button>
          <button className="pos-modal-ok" onClick={onProceed}>Cerrar caja</button>
        </div>
      </div>
    </div>
  )
}
