'use client'

import { useState, useCallback } from 'react'
import type { CachedProduct, CachedModifierGroup, ItemModifier } from '@/lib/pos/types'

interface ModifierModalProps {
  product: CachedProduct
  onConfirm: (modifiers: ItemModifier[], note: string, quantity: number) => void
  onClose: () => void
}

export default function ModifierModal({ product, onConfirm, onClose }: ModifierModalProps) {
  const [quantity, setQuantity] = useState(1)
  const [note, setNote] = useState('')
  const [selected, setSelected] = useState<Map<string, ItemModifier[]>>(() => {
    // Pre-select defaults
    const map = new Map<string, ItemModifier[]>()
    for (const template of product.modifier_templates) {
      for (const group of template.groups) {
        const defaults = group.options
          .filter(o => o.is_default)
          .map(o => ({
            modifier_id: o.id,
            group_name: group.name,
            option_name: o.name,
            price_adjustment: o.price_adjustment,
          }))
        if (defaults.length > 0) {
          map.set(group.id, defaults)
        }
      }
    }
    return map
  })

  const toggleOption = useCallback((group: CachedModifierGroup, option: { id: string; name: string; price_adjustment: number }) => {
    setSelected(prev => {
      const next = new Map(prev)
      const current = next.get(group.id) || []

      const exists = current.some(m => m.modifier_id === option.id)
      if (exists) {
        const filtered = current.filter(m => m.modifier_id !== option.id)
        if (filtered.length === 0) next.delete(group.id)
        else next.set(group.id, filtered)
      } else {
        const mod: ItemModifier = {
          modifier_id: option.id,
          group_name: group.name,
          option_name: option.name,
          price_adjustment: option.price_adjustment,
        }
        if (group.max_select === 1) {
          // Radio behavior
          next.set(group.id, [mod])
        } else {
          // Multi-select
          if (current.length < group.max_select) {
            next.set(group.id, [...current, mod])
          }
        }
      }
      return next
    })
  }, [])

  const allModifiers = Array.from(selected.values()).flat()
  const modifierExtra = allModifiers.reduce((sum, m) => sum + m.price_adjustment, 0)
  const unitPrice = (product.discount_price ?? product.price) + modifierExtra
  const total = unitPrice * quantity

  // Check required groups are filled
  const hasTemplates = product.modifier_templates.length > 0
  const allRequiredFilled = product.modifier_templates.every(t =>
    t.groups.every(g => {
      if (!g.required) return true
      const sel = selected.get(g.id) || []
      return sel.length >= g.min_select
    })
  )

  const handleConfirm = () => {
    onConfirm(allModifiers, note.trim(), quantity)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg max-h-[85dvh] bg-white rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-3 p-5 pb-3 border-b border-stone-100">
          {product.photos[0] && (
            <img
              src={product.photos[0]}
              alt={product.name}
              className="w-16 h-16 rounded-xl object-cover shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <h2
              className="text-lg font-semibold leading-tight"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {product.name}
            </h2>
            {product.description && (
              <p className="text-sm text-stone-500 mt-0.5 line-clamp-2">{product.description}</p>
            )}
            <p className="text-base font-semibold text-amber-600 mt-1">
              ${(product.discount_price ?? product.price).toLocaleString('es-CL')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 text-stone-400 shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Modifier groups */}
          {product.modifier_templates.map(template =>
            template.groups.map(group => (
              <div key={group.id}>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-sm font-semibold text-stone-700">{group.name}</span>
                  {group.required && (
                    <span className="text-[10px] font-medium bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                      Obligatorio
                    </span>
                  )}
                  {group.max_select > 1 && (
                    <span className="text-[10px] text-stone-400">
                      Máx. {group.max_select}
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  {group.options.map(option => {
                    const isSelected = (selected.get(group.id) || []).some(m => m.modifier_id === option.id)
                    return (
                      <button
                        key={option.id}
                        onClick={() => toggleOption(group, option)}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-all ${
                          isSelected
                            ? 'bg-amber-50 border-2 border-amber-400 text-stone-900'
                            : 'bg-stone-50 border-2 border-transparent text-stone-700 hover:bg-stone-100'
                        }`}
                      >
                        <span>{option.name}</span>
                        {option.price_adjustment > 0 && (
                          <span className={`text-xs ${isSelected ? 'text-amber-600' : 'text-stone-400'}`}>
                            +${option.price_adjustment.toLocaleString('es-CL')}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}

          {/* Kitchen note */}
          <div>
            <label className="text-sm font-semibold text-stone-700 block mb-2">
              Nota para cocina
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Sin cebolla, bien cocido..."
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-sm placeholder:text-stone-400 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-100 bg-white">
          {/* Quantity */}
          <div className="flex items-center justify-center gap-4 mb-3">
            <button
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 text-lg font-bold transition-colors"
            >
              −
            </button>
            <span className="text-xl font-bold tabular-nums w-8 text-center">{quantity}</span>
            <button
              onClick={() => setQuantity(q => q + 1)}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 text-lg font-bold transition-colors"
            >
              +
            </button>
          </div>

          <button
            onClick={handleConfirm}
            disabled={hasTemplates && !allRequiredFilled}
            className="w-full h-14 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 text-white font-semibold text-base transition-all flex items-center justify-between px-6"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <span>Agregar</span>
            <span className="tabular-nums">${total.toLocaleString('es-CL')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
