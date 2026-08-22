'use client'

import type { RoundItem } from '@/lib/pos/types'

interface OrderPanelProps {
  items: RoundItem[]
  onUpdateQuantity: (itemId: string, delta: number) => void
  onRemove: (itemId: string) => void
  onSend: () => void
  sending: boolean
}

export default function OrderPanel({ items, onUpdateQuantity, onRemove, onSend, sending }: OrderPanelProps) {
  const subtotal = items.reduce((sum, item) => {
    const modExtra = item.modifiers.reduce((s, m) => s + m.price_adjustment, 0)
    return sum + item.quantity * (item.unit_price + modExtra)
  }, 0)

  if (items.length === 0) {
    return (
      <div className="pos-empty">
        <div className="ring">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </div>
        <p>Toca un producto para agregarlo a la comanda</p>
      </div>
    )
  }

  return (
    <>
      <div className="pos-order-list">
        {items.map(item => {
          const modExtra = item.modifiers.reduce((s, m) => s + m.price_adjustment, 0)
          const lineTotal = item.quantity * (item.unit_price + modExtra)

          return (
            <div key={item.item_id} className="pos-oi">
              {/* Quantity stepper */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <button
                  onClick={() => item.quantity <= 1 ? onRemove(item.item_id) : onUpdateQuantity(item.item_id, -1)}
                  style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--sunk)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: item.quantity <= 1 ? '#e05252' : 'var(--ink-2)', flexShrink: 0 }}
                >
                  {item.quantity <= 1
                    ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14"/></svg>
                  }
                </button>
                <span className="q" style={{ minWidth: 18, textAlign: 'center' }}>{item.quantity}</span>
                <button
                  onClick={() => onUpdateQuantity(item.item_id, 1)}
                  style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--sunk)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--ink-2)', flexShrink: 0 }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                </button>
              </div>
              <div className="n">
                {item.dish_name}
                {item.modifiers.length > 0 && (
                  <span className="mod">{item.modifiers.map(m => m.option_name).join(', ')}</span>
                )}
                {item.note && <span className="note">{item.note}</span>}
              </div>
              <span className="p">${lineTotal.toLocaleString('es-CL')}</span>
            </div>
          )
        })}
      </div>

      <div className="pos-order-f">
        <div className="pos-sumrow">
          <span className="l">Total</span>
          <span className="v">${subtotal.toLocaleString('es-CL')}</span>
        </div>

        <button
          className="pos-send"
          onClick={onSend}
          disabled={sending || items.length === 0}
        >
          {sending ? (
            <>
              <span className="w-4 h-4 rounded-full animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                <path d="M4 4h16v5H4zM4 13h16v7H4zM8 17h4"/>
              </svg>
              Enviar a cocina
            </>
          )}
        </button>
      </div>
    </>
  )
}
