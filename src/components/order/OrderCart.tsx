"use client";
import { X, Plus, Minus, Trash2, ShoppingCart } from "lucide-react";
import { useCart } from "./OrderCartContext";

const F = "var(--font-display, 'Inter', sans-serif)";
const FB = "var(--font-body, 'Inter', sans-serif)";

function formatCLP(n: number) {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

interface Props {
  onClose: () => void;
  onCheckout: () => void;
}

export default function OrderCart({ onClose, onCheckout }: Props) {
  const { items, updateQuantity, removeItem, total } = useCart();

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 900,
        background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)",
        display: "flex", justifyContent: "center", alignItems: "flex-end",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--carta-bg, #fff)", borderRadius: "20px 20px 0 0",
          width: "100%", maxWidth: 520, maxHeight: "80dvh",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid var(--carta-border, #eee)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShoppingCart size={18} color="var(--carta-accent, #F4A623)" />
            <span style={{ fontFamily: F, fontWeight: 700, fontSize: "0.95rem", color: "var(--carta-text, #111)" }}>
              Mi pedido
            </span>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: "50%", border: "none", cursor: "pointer", background: "var(--carta-surface, #f5f5f5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={16} color="var(--carta-text2, #666)" />
          </button>
        </div>

        {/* Items list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 18px" }}>
          {items.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <ShoppingCart size={36} color="var(--carta-border, #ddd)" style={{ margin: "0 auto 12px", display: "block" }} />
              <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--carta-text2, #777)", margin: 0 }}>
                Tu carrito está vacío
              </p>
            </div>
          ) : (
            items.map(item => (
              <div key={item.key} style={{ display: "flex", gap: 12, marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid var(--carta-border, #eee)" }}>
                {item.imageUrl && (
                  <img src={item.imageUrl} alt={item.dishName} style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: F, fontWeight: 600, fontSize: "0.88rem", color: "var(--carta-text, #111)", margin: "0 0 3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.dishName}
                  </p>
                  {item.selectedOptions.length > 0 && (
                    <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--carta-text2, #777)", margin: "0 0 4px", lineHeight: 1.4 }}>
                      {item.selectedOptions.map(o => o.optionName).join(", ")}
                    </p>
                  )}
                  {item.notes && (
                    <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--carta-text2, #999)", margin: "0 0 4px", fontStyle: "italic" }}>
                      "{item.notes}"
                    </p>
                  )}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button
                        onClick={() => updateQuantity(item.key, item.quantity - 1)}
                        style={{ width: 24, height: 24, borderRadius: 6, border: "none", cursor: "pointer", background: "var(--carta-surface, #f2f2f2)", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <Minus size={12} color="var(--carta-text2, #666)" />
                      </button>
                      <span style={{ fontFamily: F, fontWeight: 700, fontSize: "0.85rem", color: "var(--carta-text, #111)", minWidth: 16, textAlign: "center" }}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.key, item.quantity + 1)}
                        style={{ width: 24, height: 24, borderRadius: 6, border: "none", cursor: "pointer", background: "var(--carta-accent, #F4A623)", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <Plus size={12} color="var(--carta-accent-fg, #fff)" />
                      </button>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontFamily: F, fontWeight: 700, fontSize: "0.88rem", color: "var(--carta-text, #111)" }}>
                        {formatCLP(item.unitTotal * item.quantity)}
                      </span>
                      <button
                        onClick={() => removeItem(item.key)}
                        style={{ border: "none", background: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}
                      >
                        <Trash2 size={14} color="#ef4444" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div style={{ padding: "14px 18px", borderTop: "1px solid var(--carta-border, #eee)", background: "var(--carta-bg, #fff)", flexShrink: 0, paddingBottom: "max(14px, env(safe-area-inset-bottom, 14px))" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--carta-text2, #666)" }}>Total del pedido</span>
              <span style={{ fontFamily: F, fontWeight: 700, fontSize: "1rem", color: "var(--carta-text, #111)" }}>{formatCLP(total)}</span>
            </div>
            <button
              onClick={onCheckout}
              style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "none", background: "var(--carta-accent, #F4A623)", color: "var(--carta-accent-fg, #fff)", fontFamily: F, fontSize: "0.9rem", fontWeight: 700, cursor: "pointer" }}
            >
              Ir al checkout →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
