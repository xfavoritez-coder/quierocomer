"use client";
import { useState, useEffect } from "react";
import { X, Plus, Minus, ShoppingBag } from "lucide-react";
import type { SelectedOption } from "./OrderCartContext";

const F = "var(--font-display, 'Inter', sans-serif)";
const FB = "var(--font-body, 'Inter', sans-serif)";

interface ModifierOption {
  id: string;
  name: string;
  priceAdjustment: number;
  isDefault: boolean;
  description?: string | null;
}

interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: ModifierOption[];
}

interface ModifierTemplate {
  id: string;
  groups: ModifierGroup[];
}

export interface DishForOrder {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  discountPrice?: number | null;
  photos?: string[];
  modifierTemplates: ModifierTemplate[];
}

interface Props {
  dish: DishForOrder;
  onClose: () => void;
  onAdd: (opts: { selectedOptions: SelectedOption[]; quantity: number; notes: string }) => void;
}

function formatCLP(n: number) {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

export default function OrderItemModal({ dish, onClose, onAdd }: Props) {
  const groups: ModifierGroup[] = dish.modifierTemplates.flatMap(t => t.groups);

  // Build initial selection state: { [groupId]: Set<optionId> }
  const [selections, setSelections] = useState<Record<string, Set<string>>>(() => {
    const init: Record<string, Set<string>> = {};
    for (const g of groups) {
      const defaults = g.options.filter(o => o.isDefault).map(o => o.id);
      init[g.id] = new Set(defaults.length > 0 ? defaults : []);
    }
    return init;
  });
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  // Close on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const toggleOption = (group: ModifierGroup, optionId: string) => {
    setSelections(prev => {
      const cur = new Set(prev[group.id]);
      if (cur.has(optionId)) {
        if (!group.required || cur.size > 1) cur.delete(optionId);
      } else {
        if (group.maxSelect === 1) {
          cur.clear();
        } else if (cur.size >= group.maxSelect) {
          return prev; // max reached
        }
        cur.add(optionId);
      }
      return { ...prev, [group.id]: cur };
    });
  };

  // Validate: all required groups have >= minSelect selections
  const isValid = groups.every(g => {
    if (!g.required && g.minSelect === 0) return true;
    return (selections[g.id]?.size ?? 0) >= Math.max(g.minSelect, g.required ? 1 : 0);
  });

  // Calculate price adjustment total
  const priceAdjustment = groups.reduce((sum, g) => {
    const sel = selections[g.id] ?? new Set();
    return sum + g.options.filter(o => sel.has(o.id)).reduce((s, o) => s + o.priceAdjustment, 0);
  }, 0);
  const basePrice = dish.discountPrice != null && dish.discountPrice < dish.price ? dish.discountPrice : dish.price;
  const unitTotal = basePrice + priceAdjustment;

  const handleAdd = () => {
    if (!isValid) return;
    const selectedOptions: SelectedOption[] = [];
    for (const g of groups) {
      const sel = selections[g.id] ?? new Set();
      for (const o of g.options) {
        if (sel.has(o.id)) {
          selectedOptions.push({
            groupId: g.id,
            groupName: g.name,
            optionId: o.id,
            optionName: o.name,
            priceAdjustment: o.priceAdjustment,
          });
        }
      }
    }
    onAdd({ selectedOptions, quantity, notes });
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        padding: "0 0 env(safe-area-inset-bottom, 0)",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--carta-bg, #fff)", borderRadius: "20px 20px 0 0",
          width: "100%", maxWidth: 520, maxHeight: "92dvh",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        {/* Image / header */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          {dish.photos?.[0] ? (
            <img src={dish.photos[0]} alt={dish.name} style={{ width: "100%", height: 220, objectFit: "cover", display: "block" }} />
          ) : (
            <div style={{ width: "100%", height: 80, background: "var(--carta-surface, #f5f5f5)" }} />
          )}
          <button
            onClick={onClose}
            style={{
              position: "absolute", top: 12, right: 12,
              width: 34, height: 34, borderRadius: "50%", border: "none", cursor: "pointer",
              background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <X size={18} color="#fff" />
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 18px 0" }}>
          {/* Dish info */}
          <h2 style={{ fontFamily: F, fontSize: "1.05rem", fontWeight: 700, color: "var(--carta-text, #111)", margin: "0 0 4px" }}>
            {dish.name}
          </h2>
          {dish.description && (
            <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--carta-text2, #555)", margin: "0 0 12px", lineHeight: 1.5 }}>
              {dish.description}
            </p>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 18px" }}>
            <p style={{ fontFamily: F, fontSize: "1rem", fontWeight: 700, color: "var(--carta-accent, #F4A623)", margin: 0 }}>
              {formatCLP(basePrice)}
            </p>
            {dish.discountPrice != null && dish.discountPrice < dish.price && (
              <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--carta-text3, #999)", margin: 0, textDecoration: "line-through" }}>
                {formatCLP(dish.price)}
              </p>
            )}
          </div>

          {/* Modifier groups */}
          {groups.map(group => {
            const sel = selections[group.id] ?? new Set();
            const isMulti = group.maxSelect > 1;
            return (
              <div key={group.id} style={{ marginBottom: 22 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
                  <p style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: "var(--carta-text, #111)", margin: 0 }}>
                    {group.name}
                  </p>
                  {group.required && (
                    <span style={{ fontFamily: FB, fontSize: "0.68rem", color: "#fff", background: "var(--carta-accent, #F4A623)", borderRadius: 99, padding: "2px 7px", fontWeight: 600 }}>
                      Obligatorio
                    </span>
                  )}
                  {!group.required && (
                    <span style={{ fontFamily: FB, fontSize: "0.68rem", color: "var(--carta-text2, #777)", background: "var(--carta-surface, #f2f2f2)", borderRadius: 99, padding: "2px 7px" }}>
                      Opcional{group.maxSelect > 1 ? ` (máx. ${group.maxSelect})` : ""}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {group.options.map(opt => {
                    const active = sel.has(opt.id);
                    return (
                      <button
                        key={opt.id}
                        onClick={() => toggleOption(group, opt.id)}
                        style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "11px 14px", borderRadius: 10, cursor: "pointer",
                          border: active ? "1.5px solid var(--carta-accent, #F4A623)" : "1.5px solid var(--carta-border, #e5e5e5)",
                          background: active ? "rgba(244,166,35,0.07)" : "var(--carta-surface, #fafafa)",
                          transition: "all 0.15s", textAlign: "left",
                        }}
                      >
                        {/* Checkbox / radio indicator */}
                        <span style={{
                          width: 18, height: 18, borderRadius: isMulti ? 4 : "50%", flexShrink: 0,
                          border: active ? "none" : "2px solid var(--carta-border, #ccc)",
                          background: active ? "var(--carta-accent, #F4A623)" : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 0.15s",
                        }}>
                          {active && (
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        <span style={{ flex: 1, fontFamily: FB, fontSize: "0.85rem", color: "var(--carta-text, #111)" }}>
                          {opt.name}
                          {opt.description && (
                            <span style={{ display: "block", fontSize: "0.72rem", color: "var(--carta-text2, #777)", marginTop: 1 }}>{opt.description}</span>
                          )}
                        </span>
                        {opt.priceAdjustment !== 0 && (
                          <span style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 600, color: active ? "var(--carta-accent, #F4A623)" : "var(--carta-text2, #777)", flexShrink: 0 }}>
                            {opt.priceAdjustment > 0 ? "+" : ""}{formatCLP(opt.priceAdjustment)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Notes */}
          <div style={{ marginBottom: 18 }}>
            <p style={{ fontFamily: F, fontSize: "0.78rem", fontWeight: 600, color: "var(--carta-text2, #777)", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: ".04em" }}>
              Notas del plato (opcional)
            </p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ej: Sin cebolla, bien cocido..."
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 10, resize: "none",
                border: "1.5px solid var(--carta-border, #e5e5e5)", fontFamily: FB, fontSize: "0.83rem",
                color: "var(--carta-text, #111)", background: "var(--carta-surface, #fafafa)",
                outline: "none", minHeight: 64, boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {/* Sticky footer: quantity + add */}
        <div style={{ padding: "14px 18px", borderTop: "1px solid var(--carta-border, #eee)", background: "var(--carta-bg, #fff)", flexShrink: 0, paddingBottom: "max(14px, env(safe-area-inset-bottom, 14px))" }}>
          {!isValid && (
            <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "#ef4444", margin: "0 0 10px", textAlign: "center" }}>
              Selecciona las opciones obligatorias para continuar
            </p>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Quantity stepper */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--carta-surface, #f5f5f5)", borderRadius: 10, padding: "4px 8px", flexShrink: 0 }}>
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                style={{ width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer", background: quantity > 1 ? "var(--carta-accent, #F4A623)" : "var(--carta-border, #ddd)", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <Minus size={14} color={quantity > 1 ? "#fff" : "#aaa"} />
              </button>
              <span style={{ fontFamily: F, fontWeight: 700, fontSize: "0.95rem", color: "var(--carta-text, #111)", minWidth: 20, textAlign: "center" }}>{quantity}</span>
              <button
                onClick={() => setQuantity(q => q + 1)}
                style={{ width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer", background: "var(--carta-accent, #F4A623)", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <Plus size={14} color="#fff" />
              </button>
            </div>

            {/* Add button */}
            <button
              onClick={handleAdd}
              disabled={!isValid}
              style={{
                flex: 1, padding: "13px 16px", borderRadius: 12, border: "none",
                background: isValid ? "var(--carta-accent, #F4A623)" : "var(--carta-border, #ddd)",
                color: isValid ? "#fff" : "#aaa", cursor: isValid ? "pointer" : "not-allowed",
                fontFamily: F, fontSize: "0.9rem", fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                transition: "all 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <ShoppingBag size={16} />
                Agregar al carrito
              </div>
              <span>{formatCLP(unitTotal * quantity)}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
