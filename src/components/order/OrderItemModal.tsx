"use client";
import { useState, useEffect, useRef } from "react";
import { Plus, Minus, ShoppingBag } from "lucide-react";
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
  const photos = dish.photos?.filter(Boolean) || [];

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
  const [photoIndex, setPhotoIndex] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Body scroll lock — same as DishDetail
  useEffect(() => {
    const savedScrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.overflow = "";
      window.scrollTo(0, savedScrollY);
    };
  }, []);

  // Close on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Pull-down to close
  const scrollRef = useRef<HTMLDivElement>(null);
  const pullY = useRef<number | null>(null);

  const toggleOption = (group: ModifierGroup, optionId: string) => {
    setSelections(prev => {
      const cur = new Set(prev[group.id]);
      if (cur.has(optionId)) {
        if (!group.required || cur.size > 1) cur.delete(optionId);
      } else {
        if (group.maxSelect === 1) { cur.clear(); }
        else if (cur.size >= group.maxSelect) { return prev; }
        cur.add(optionId);
      }
      return { ...prev, [group.id]: cur };
    });
  };

  const isValid = groups.every(g => {
    if (!g.required && g.minSelect === 0) return true;
    return (selections[g.id]?.size ?? 0) >= Math.max(g.minSelect, g.required ? 1 : 0);
  });

  const priceAdjustment = groups.reduce((sum, g) => {
    const sel = selections[g.id] ?? new Set();
    return sum + g.options.filter(o => sel.has(o.id)).reduce((s, o) => s + o.priceAdjustment, 0);
  }, 0);
  const basePrice = dish.discountPrice != null && dish.discountPrice < dish.price ? dish.discountPrice : dish.price;
  const discountPct = dish.discountPrice != null && dish.discountPrice < dish.price
    ? Math.round(((dish.price - dish.discountPrice) / dish.price) * 100) : 0;
  const unitTotal = basePrice + priceAdjustment;

  const handleAdd = () => {
    if (!isValid) return;
    const selectedOptions: SelectedOption[] = [];
    for (const g of groups) {
      const sel = selections[g.id] ?? new Set();
      for (const o of g.options) {
        if (sel.has(o.id)) {
          selectedOptions.push({ groupId: g.id, groupName: g.name, optionId: o.id, optionName: o.name, priceAdjustment: o.priceAdjustment });
        }
      }
    }
    onAdd({ selectedOptions, quantity, notes });
  };

  return (
    <>
      <style>{`@keyframes modalSlideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } } #order-notes::placeholder { color: var(--carta-text2, #888); opacity: 1; }`}</style>

      {/* Full-screen modal — same structure as DishDetail */}
      <div
        ref={scrollRef}
        onTouchStart={e => { pullY.current = e.touches[0].clientY; }}
        onTouchEnd={e => {
          if (pullY.current === null) return;
          const dy = e.changedTouches[0].clientY - pullY.current;
          pullY.current = null;
          const el = scrollRef.current;
          if (el && el.scrollTop <= 0 && dy > 100) onClose();
        }}
        style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "var(--carta-bg, #fff)",
          overflowY: "auto", overflowX: "hidden", scrollbarWidth: "none",
          animation: "modalSlideUp 0.22s ease-out",
        }}
      >
        {/* Photo header */}
        <div style={{ position: "relative", width: "100%", height: photos.length > 0 ? "min(55vh, 420px)" : "26vh", overflow: "hidden", background: "var(--carta-photo-bg, #f0ece6)" }}>
          {photos.length > 0 ? (
            <img
              key={photos[photoIndex]}
              src={photos[photoIndex]}
              alt={dish.name}
              loading="eager"
              onLoad={() => setImgLoaded(true)}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", opacity: imgLoaded ? 1 : 0, transition: "opacity 0.35s ease" }}
            />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "4rem", opacity: 0.25 }}>🍽️</div>
          )}
          {/* Multi-photo dots */}
          {photos.length > 1 && (
            <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 5, zIndex: 10 }}>
              {photos.map((_, i) => (
                <button key={i} onClick={() => { setPhotoIndex(i); setImgLoaded(false); }}
                  style={{ width: 6, height: 6, borderRadius: "50%", background: i === photoIndex ? "white" : "rgba(255,255,255,0.4)", border: "none", padding: 0, cursor: "pointer" }} />
              ))}
            </div>
          )}
          {/* Bottom gradient */}
          {photos.length > 0 && (
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, background: "linear-gradient(to top, var(--carta-bg, #fff), transparent)" }} />
          )}
        </div>

        {/* Close button — fixed, always visible, same as DishDetail */}
        <button
          onClick={onClose}
          style={{ position: "fixed", top: 16, right: 16, zIndex: 1010, width: 34, height: 34, borderRadius: "50%", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", border: "none", color: "white", fontSize: "1rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
        >✕</button>

        {/* Content */}
        <div style={{ padding: "20px 20px 140px", maxWidth: 640, margin: "0 auto" }}>

          {/* Name + price — same layout as DishDetail */}
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontFamily: F, fontSize: 32, fontWeight: 800, color: "var(--carta-text, #111)", lineHeight: 1.1, margin: "0 0 8px", letterSpacing: "-0.5px" }}>
              {dish.name}
            </h2>
            {discountPct > 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ background: "var(--carta-accent, #F4A623)", color: "var(--carta-accent-fg, #fff)", fontSize: "0.78rem", fontWeight: 800, padding: "5px 12px", borderRadius: 8 }}>
                  -{discountPct}% OFERTA
                </span>
                <span style={{ color: "var(--carta-text3, #999)", fontSize: 14, textDecoration: "line-through" }}>{formatCLP(dish.price)}</span>
                <span style={{ color: "var(--carta-accent, #F4A623)", fontSize: 22, fontWeight: 800 }}>{formatCLP(basePrice)}</span>
              </div>
            ) : (
              <span style={{ color: "var(--carta-accent, #F4A623)", fontSize: 18, fontWeight: 700 }}>{formatCLP(basePrice)}</span>
            )}
          </div>

          {/* Description */}
          {dish.description && (
            <p style={{ fontFamily: FB, fontSize: 17, color: "var(--carta-text2, #555)", margin: "0 0 24px", lineHeight: 1.5 }}>
              {dish.description}
            </p>
          )}

          {/* Divider before modifiers */}
          {groups.length > 0 && <div style={{ height: 1, background: "var(--carta-border, #eee)", margin: "0 0 20px" }} />}

          {/* Modifier groups */}
          {groups.map(group => {
            const sel = selections[group.id] ?? new Set();
            const isMulti = group.maxSelect > 1;
            return (
              <div key={group.id} style={{ marginBottom: 28 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <p style={{ fontFamily: F, fontSize: 15, fontWeight: 700, color: "var(--carta-text, #111)", margin: 0 }}>
                    {group.name}
                  </p>
                  {group.required ? (
                    <span style={{ fontFamily: FB, fontSize: "0.68rem", color: "var(--carta-accent-fg, #fff)", background: "var(--carta-accent, #F4A623)", borderRadius: 99, padding: "2px 8px", fontWeight: 600 }}>
                      Obligatorio
                    </span>
                  ) : (
                    <span style={{ fontFamily: FB, fontSize: "0.68rem", color: "var(--carta-text2, #777)", background: "var(--carta-surface, #f2f2f2)", borderRadius: 99, padding: "2px 8px" }}>
                      Opcional{group.maxSelect > 1 ? ` (máx. ${group.maxSelect})` : ""}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {group.options.map(opt => {
                    const active = sel.has(opt.id);
                    return (
                      <button
                        key={opt.id}
                        onClick={() => toggleOption(group, opt.id)}
                        style={{
                          display: "flex", alignItems: "center", gap: 14,
                          padding: "13px 16px", borderRadius: 12, cursor: "pointer",
                          border: active ? "1.5px solid var(--carta-accent, #F4A623)" : "1.5px solid var(--carta-border, #e5e5e5)",
                          background: active ? "color-mix(in srgb, var(--carta-accent, #F4A623) 8%, var(--carta-surface, #fafafa))" : "var(--carta-surface, #fafafa)",
                          transition: "all 0.15s", textAlign: "left",
                        }}
                      >
                        <span style={{
                          width: 20, height: 20, borderRadius: isMulti ? 5 : "50%", flexShrink: 0,
                          border: active ? "none" : "2px solid var(--carta-border, #ccc)",
                          background: active ? "var(--carta-accent, #F4A623)" : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 0.15s",
                        }}>
                          {active && (
                            <svg width="11" height="9" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4L3.5 6.5L9 1" stroke="var(--carta-accent-fg, #fff)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        <span style={{ flex: 1, fontFamily: FB, fontSize: 15, color: "var(--carta-text, #111)" }}>
                          {opt.name}
                          {opt.description && (
                            <span style={{ display: "block", fontSize: 13, color: "var(--carta-text2, #777)", marginTop: 2 }}>{opt.description}</span>
                          )}
                        </span>
                        {opt.priceAdjustment !== 0 && (
                          <span style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: active ? "var(--carta-accent, #F4A623)" : "var(--carta-text2, #777)", flexShrink: 0 }}>
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
          <div style={{ marginTop: groups.length > 0 ? 8 : 0 }}>
            <p style={{ fontFamily: F, fontSize: "0.8rem", fontWeight: 600, color: "var(--carta-text2, #777)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: ".05em" }}>
              Notas del plato (opcional)
            </p>
            <style>{`#order-notes::placeholder { color: var(--carta-text, #111); opacity: 0.38; }`}</style>
            <textarea
              id="order-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ej: Sin cebolla, bien cocido..."
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 12, resize: "none",
                border: "1.5px solid var(--carta-border, #e5e5e5)", fontFamily: FB, fontSize: 15,
                color: "var(--carta-text, #111)", background: "var(--carta-surface, #fafafa)",
                outline: "none", minHeight: 72, boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {/* Sticky footer: quantity + add — same as before but wider */}
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1005,
          padding: "12px 20px", paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))",
          background: "var(--carta-bg, #fff)", borderTop: "1px solid var(--carta-border, #eee)",
          backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        }}>
          {!isValid && (
            <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "#ef4444", margin: "0 0 10px", textAlign: "center" }}>
              Selecciona las opciones obligatorias para continuar
            </p>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 12, maxWidth: 640, margin: "0 auto" }}>
            {/* Quantity stepper */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--carta-surface, #f5f5f5)", borderRadius: 12, padding: "6px 10px", flexShrink: 0 }}>
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                style={{ width: 32, height: 32, borderRadius: 9, border: "none", cursor: "pointer", background: quantity > 1 ? "var(--carta-accent, #F4A623)" : "var(--carta-border, #ddd)", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <Minus size={15} color={quantity > 1 ? "var(--carta-accent-fg, #fff)" : "#aaa"} />
              </button>
              <span style={{ fontFamily: F, fontWeight: 700, fontSize: "1rem", color: "var(--carta-text, #111)", minWidth: 22, textAlign: "center" }}>{quantity}</span>
              <button
                onClick={() => setQuantity(q => q + 1)}
                style={{ width: 32, height: 32, borderRadius: 9, border: "none", cursor: "pointer", background: "var(--carta-accent, #F4A623)", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <Plus size={15} color="var(--carta-accent-fg, #fff)" />
              </button>
            </div>
            {/* Add button */}
            <button
              onClick={handleAdd}
              disabled={!isValid}
              style={{
                flex: 1, padding: "14px 18px", borderRadius: 14, border: "none",
                background: isValid ? "var(--carta-accent, #F4A623)" : "var(--carta-border, #ddd)",
                color: isValid ? "var(--carta-accent-fg, #fff)" : "#aaa", cursor: isValid ? "pointer" : "not-allowed",
                fontFamily: F, fontSize: "0.95rem", fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                transition: "all 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ShoppingBag size={17} />
                Agregar al carrito
              </div>
              <span>{formatCLP(unitTotal * quantity)}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
