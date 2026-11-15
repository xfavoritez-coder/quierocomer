'use client'

// Cuenta de una mesa ocupada (server-authoritative: PosOrder dine-in).
// Muestra los ítems acumulados + total, con "Agregar ítems" (reabre el tomador
// en modo mesa → addItems) y "Cobrar" (reutiliza el CobroModal del board → boleta).
// Al cobrar, cierra el pedido (opsStage=delivered) para liberar la mesa.
import { useState } from 'react'
import { CobroModal } from './OrdersBoard'
import { printKitchenComanda, getKitchenBridgeUrl } from '@/lib/pos/bridge'
import { usePosNav } from '../lib/usePosNav'

interface MesaItem { productName?: string; dishName?: string; name?: string; quantity?: number; unit_price?: number; options?: string[]; note?: string; courtesy?: boolean }
type MesaOrder = { id: string; tableLabel?: string | null; totalAmount?: number; paidAmount?: number; items?: MesaItem[]; createdAt?: string;[k: string]: unknown }

// CobroModal viene tipado para el board (PosOrderLite/OrderType); acá lo usamos
// con el PosOrder dine-in tal cual lo entrega la API. Lo tratamos como props sueltas.
const Cobro = CobroModal as unknown as React.FC<{ order: MesaOrder; restaurantId: string; type: string; delifastEnabled: boolean; onClose: () => void; onPaid: () => void }>

const clp = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-CL')

export default function MesaCuenta({ order, restaurantId, mesaKey, onClose, onChanged }: {
  order: MesaOrder; restaurantId: string; mesaKey: string; onClose: () => void; onChanged: () => void
}) {
  const navigate = usePosNav()
  const [cobro, setCobro] = useState(false)
  const [reprinting, setReprinting] = useState(false)
  const items = Array.isArray(order.items) ? order.items : []
  const total = order.totalAmount || 0

  // Reimprime la ÚLTIMA ronda (o todo el pedido si no hay rondas registradas) a la
  // impresora de cocina. Útil si la impresora estaba apagada al enviarla.
  const handleReprint = async () => {
    const rounds = (order.rawPayload as { rounds?: { items?: MesaItem[] }[] } | undefined)?.rounds
    const last = Array.isArray(rounds) && rounds.length ? rounds[rounds.length - 1].items : null
    const src = (Array.isArray(last) && last.length ? last : items)
    if (!src.length) return
    setReprinting(true)
    try {
      const r = await printKitchenComanda({
        jobId: Math.random().toString(36).slice(2),
        type: 'mesa',
        tableNumber: (order.tableLabel || mesaKey) || undefined,
        orderLabel: `Mesa ${order.tableLabel || mesaKey}`,
        sentBy: 'POS',
        items: src.map((it) => ({
          quantity: it.quantity || 1,
          dish_name: it.productName || it.dishName || it.name || 'Ítem',
          modifiers: (it.options || []).map((v) => ({ name: v, price_adjustment: 0 })),
          note: it.note || undefined,
        })),
      }, getKitchenBridgeUrl())
      if (!r.ok) alert('No se pudo imprimir: ' + (r.error || 'agente no disponible'))
    } catch { alert('No se pudo imprimir la comanda') }
    setReprinting(false)
  }

  const handlePaid = async () => {
    // Cobrado → cerramos el pedido (delivered): libera la mesa y va al historial.
    try {
      await fetch('/api/panel/ecommerce/pos-orders', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, id: order.id, opsStage: 'delivered' }),
      })
    } catch { /* la mesa igual se libera al refrescar (paidAmount=total) */ }
    setCobro(false); onChanged(); onClose()
  }

  return (
    <>
      <div className="pos-drawer-overlay" onClick={onClose} />
      <div className="pos-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div className="pos-sheet-header">
          <div style={{ fontWeight: 800, fontSize: 16 }}>Mesa {order.tableLabel || mesaKey}</div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: 'none', border: 0, cursor: 'pointer', padding: 8, color: 'var(--ink-3)' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
          {items.length === 0 ? (
            <p style={{ color: 'var(--ink-3)', textAlign: 'center', padding: '24px 0', fontSize: 14 }}>Sin ítems aún.</p>
          ) : items.map((it, i) => {
            const name = it.productName || it.dishName || it.name || 'Ítem'
            const qty = it.quantity || 1
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: 'var(--ink)' }}>
                    <b style={{ fontFamily: 'var(--mono)', color: 'var(--amber-press)', marginRight: 6 }}>{qty}×</b>{name}
                  </div>
                  {it.options && it.options.length > 0 && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginLeft: 22 }}>{it.options.join(' · ')}</div>}
                  {it.note && <div style={{ fontSize: 12, color: 'var(--amber-press)', marginLeft: 22 }}>!! {it.note}</div>}
                </div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{clp((it.unit_price || 0) * qty)}</span>
              </div>
            )
          })}
        </div>

        <div style={{ borderTop: '1px solid var(--line)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16, color: 'var(--ink)' }}>
            <span>Total</span><span style={{ fontFamily: 'var(--mono)' }}>{clp(total)}</span>
          </div>
          <button
            onClick={handleReprint} disabled={reprinting || items.length === 0}
            style={{ padding: '8px', borderRadius: 'var(--r-btn)', border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink-2)', fontWeight: 600, fontSize: 13, cursor: items.length === 0 ? 'default' : 'pointer', opacity: items.length === 0 ? 0.5 : 1, fontFamily: 'var(--sans)' }}
          >{reprinting ? 'Imprimiendo…' : '🖨 Reimprimir comanda de cocina'}</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => navigate(`/pos/tomar-pedido?mesa=${encodeURIComponent(mesaKey)}&order=${order.id}`)}
              style={{ flex: 1, padding: '12px', borderRadius: 'var(--r-btn)', border: '1px solid var(--line)', background: 'var(--sunk)', color: 'var(--ink)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--sans)' }}
            >+ Agregar ítems</button>
            <button
              onClick={() => setCobro(true)} disabled={total <= 0}
              style={{ flex: 1, padding: '12px', borderRadius: 'var(--r-btn)', border: 0, background: 'var(--amber)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: total <= 0 ? 'default' : 'pointer', opacity: total <= 0 ? 0.5 : 1, fontFamily: 'var(--sans)' }}
            >Cobrar {clp(total)}</button>
          </div>
        </div>
      </div>

      {cobro && (
        <Cobro order={order} restaurantId={restaurantId} type="todos" delifastEnabled={false} onClose={() => setCobro(false)} onPaid={handlePaid} />
      )}
    </>
  )
}
