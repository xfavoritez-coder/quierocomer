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
        if (defaults.length > 0) map.set(group.id, defaults)
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
          modifier_id: option.id, group_name: group.name,
          option_name: option.name, price_adjustment: option.price_adjustment,
        }
        if (group.max_select === 1) next.set(group.id, [mod])
        else if (current.length < group.max_select) next.set(group.id, [...current, mod])
      }
      return next
    })
  }, [])

  const allModifiers = Array.from(selected.values()).flat()
  const modifierExtra = allModifiers.reduce((sum, m) => sum + m.price_adjustment, 0)
  const unitPrice = (product.discount_price ?? product.price) + modifierExtra
  const total = unitPrice * quantity

  const hasTemplates = product.modifier_templates.length > 0
  const allRequiredFilled = product.modifier_templates.every(t =>
    t.groups.every(g => {
      if (!g.required) return true
      return (selected.get(g.id) || []).length >= g.min_select
    })
  )

  return (
    <div className="pos-modal" onClick={onClose}>
      <div className="pos-mod-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="pos-mod-head">
          {product.photos[0] && (
            <img src={product.photos[0]} alt="" className="pos-mod-img" />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="pos-mod-title">{product.name}</h2>
            {product.description && (
              <p className="pos-mod-desc">{product.description}</p>
            )}
            <p className="pos-mod-price">
              ${(product.discount_price ?? product.price).toLocaleString('es-CL')}
            </p>
          </div>
          <button onClick={onClose} className="pos-mod-close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="pos-mod-body">
          {product.modifier_templates.map(template =>
            template.groups.map(group => (
              <div key={group.id}>
                <div className="pos-mod-group-h">
                  <span className="pos-mod-group-name">{group.name}</span>
                  {group.required && (
                    <span className="pos-mod-req">Obligatorio</span>
                  )}
                  {group.max_select > 1 && (
                    <span className="pos-mod-max">Máx. {group.max_select}</span>
                  )}
                </div>
                <div className="pos-mod-opts">
                  {group.options.map(option => {
                    const isSelected = (selected.get(group.id) || []).some(m => m.modifier_id === option.id)
                    return (
                      <button
                        key={option.id}
                        onClick={() => toggleOption(group, option)}
                        className={`pos-mod-opt${isSelected ? ' on' : ''}`}
                      >
                        <span>{option.name}</span>
                        {option.price_adjustment > 0 && (
                          <span className="pos-mod-opt-price">
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
            <label className="pos-mod-note">Nota para cocina</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Sin cebolla, bien cocido..."
              rows={2}
              className="pos-mod-textarea"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="pos-mod-foot">
          <div className="pos-mod-qty">
            <button
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              className="pos-mod-qty-btn"
            >
              −
            </button>
            <span className="pos-mod-qty-val">{quantity}</span>
            <button
              onClick={() => setQuantity(q => q + 1)}
              className="pos-mod-qty-btn"
            >
              +
            </button>
          </div>

          <button
            onClick={() => onConfirm(allModifiers, note.trim(), quantity)}
            disabled={hasTemplates && !allRequiredFilled}
            className="pos-mod-add"
          >
            <span>Agregar</span>
            <span className="price">
              ${total.toLocaleString('es-CL')}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
