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
              <span className="q">{item.quantity}&times;</span>
              <div className="n">
                {item.dish_name}
                {item.modifiers.length > 0 && (
                  <span className="mod">
                    {item.modifiers.map(m => m.option_name).join(', ')}
                  </span>
                )}
                {item.note && (
                  <span className="note">{item.note}</span>
                )}
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
