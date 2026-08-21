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
      <div className="flex-1 flex items-center justify-center text-stone-400 text-sm p-4">
        Toca un producto para agregarlo
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {items.map(item => {
          const modExtra = item.modifiers.reduce((s, m) => s + m.price_adjustment, 0)
          const lineTotal = item.quantity * (item.unit_price + modExtra)

          return (
            <div key={item.item_id} className="bg-stone-50 rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-800 leading-tight">{item.dish_name}</p>
                  {item.modifiers.length > 0 && (
                    <p className="text-xs text-stone-500 mt-0.5">
                      {item.modifiers.map(m => m.option_name).join(', ')}
                    </p>
                  )}
                  {item.note && (
                    <p className="text-xs text-amber-600 mt-0.5">
                      {item.note}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => onRemove(item.item_id)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-stone-200 text-stone-400 shrink-0"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onUpdateQuantity(item.item_id, -1)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-stone-200 text-stone-500 text-sm font-bold hover:bg-stone-100"
                  >
                    −
                  </button>
                  <span className="text-sm font-semibold tabular-nums w-5 text-center">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => onUpdateQuantity(item.item_id, 1)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-stone-200 text-stone-500 text-sm font-bold hover:bg-stone-100"
                  >
                    +
                  </button>
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  ${lineTotal.toLocaleString('es-CL')}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-stone-100">
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-sm text-stone-500">Subtotal</span>
          <span className="text-lg font-bold tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>
            ${subtotal.toLocaleString('es-CL')}
          </span>
        </div>
        <button
          onClick={onSend}
          disabled={sending}
          className="w-full h-14 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100 text-white font-semibold text-base transition-all"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {sending ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Enviando...
            </div>
          ) : (
            `Enviar a cocina (${items.length} ${items.length === 1 ? 'ítem' : 'ítems'})`
          )}
        </button>
      </div>
    </div>
  )
}
