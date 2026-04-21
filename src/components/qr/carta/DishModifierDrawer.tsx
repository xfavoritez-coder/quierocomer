"use client";

import { useState, useEffect } from "react";
import { X, Check } from "lucide-react";

interface Option {
  id: string;
  name: string;
  priceAdjustment: number;
  isDefault: boolean;
}

interface Group {
  id: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: Option[];
}

interface Dish {
  id: string;
  name: string;
  price: number;
  discountPrice?: number | null;
  photos?: string[];
  description?: string | null;
  modifierGroups?: Group[];
}

interface Props {
  dish: Dish;
  onClose: () => void;
}

export default function DishModifierDrawer({ dish, onClose }: Props) {
  const [visible, setVisible] = useState(false);
  const [selections, setSelections] = useState<Record<string, string[]>>({});

  // Flatten all groups from all assigned templates
  const groups = (dish.modifierTemplates || []).flatMap((t: any) => t.groups || []) as Group[];
  // Fallback to legacy per-dish modifierGroups if no templates
  const legacyGroups = (dish as any).modifierGroups || [];
  const allGroups = groups.length > 0 ? groups : legacyGroups;

  // Initialize selections with defaults
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    document.body.style.overflow = "hidden";

    const initial: Record<string, string[]> = {};
    allGroups.forEach(g => {
      const defaults = g.options.filter(o => o.isDefault).map(o => o.id);
      initial[g.id] = defaults;
    });
    setSelections(initial);

    return () => { document.body.style.overflow = ""; };
  }, []);

  const close = () => { setVisible(false); setTimeout(onClose, 250); };

  const toggleOption = (groupId: string, optionId: string, maxSelect: number) => {
    setSelections(prev => {
      const current = prev[groupId] || [];
      if (current.includes(optionId)) {
        return { ...prev, [groupId]: current.filter(id => id !== optionId) };
      }
      if (maxSelect === 1) {
        return { ...prev, [groupId]: [optionId] };
      }
      if (current.length >= maxSelect) return prev;
      return { ...prev, [groupId]: [...current, optionId] };
    });
  };

  // Calculate total price adjustment
  const priceAdjustment = allGroups.reduce((total, g) => {
    const selected = selections[g.id] || [];
    return total + g.options
      .filter(o => selected.includes(o.id))
      .reduce((sum, o) => sum + o.priceAdjustment, 0);
  }, 0);

  const basePrice = dish.discountPrice || dish.price;
  const totalPrice = basePrice + priceAdjustment;

  // Check if all required groups are satisfied
  const allValid = allGroups.every(g => {
    if (!g.required) return true;
    const selected = selections[g.id] || [];
    return selected.length >= g.minSelect;
  });

  return (
    <div className="fixed inset-0 z-[120] flex items-end font-[family-name:var(--font-dm)]" style={{ minHeight: "100dvh" }}>
      {/* Backdrop */}
      <div
        onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.55)", opacity: visible ? 1 : 0, transition: "opacity 0.2s" }}
      />

      {/* Drawer */}
      <div style={{
        position: "relative", zIndex: 1, background: "white", width: "100%",
        borderRadius: "24px 24px 0 0", maxHeight: "85dvh", overflowY: "auto",
        transform: visible ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.15)",
      }}>
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "#e0e0e0" }} />
        </div>

        {/* Close button */}
        <button onClick={close} style={{
          position: "absolute", top: 14, right: 16, width: 32, height: 32,
          borderRadius: "50%", background: "#f5f5f5", border: "none",
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        }}>
          <X size={16} color="#999" />
        </button>

        {/* Header with dish info */}
        <div style={{ padding: "16px 20px 0" }}>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            {dish.photos?.[0] && (
              <img src={dish.photos[0]} alt="" style={{ width: 64, height: 64, borderRadius: 14, objectFit: "cover", flexShrink: 0 }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0e0e0e", margin: "0 0 4px", paddingRight: 32 }}>{dish.name}</h3>
              {dish.description && (
                <p style={{ fontSize: "0.82rem", color: "#888", margin: 0, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any, overflow: "hidden" }}>{dish.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Modifier groups */}
        <div style={{ padding: "20px 20px 0" }}>
          {allGroups.map(group => {
            const selected = selections[group.id] || [];
            const isRadio = group.maxSelect === 1;
            const isSatisfied = !group.required || selected.length >= group.minSelect;

            return (
              <div key={group.id} style={{ marginBottom: 24 }}>
                {/* Group header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div>
                    <h4 style={{ fontSize: "0.92rem", fontWeight: 700, color: "#0e0e0e", margin: 0 }}>{group.name}</h4>
                    <p style={{ fontSize: "0.72rem", color: "#aaa", margin: "2px 0 0" }}>
                      {group.required ? "Obligatorio" : "Opcional"}
                      {group.maxSelect > 1 ? ` · elige hasta ${group.maxSelect}` : ""}
                      {isRadio ? " · elige 1" : ""}
                    </p>
                  </div>
                  {group.required && !isSatisfied && (
                    <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "#F4A623", background: "rgba(244,166,35,0.1)", padding: "3px 10px", borderRadius: 50 }}>Requerido</span>
                  )}
                </div>

                {/* Options */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {group.options.map(opt => {
                    const isSelected = selected.includes(opt.id);

                    return (
                      <button
                        key={opt.id}
                        onClick={() => toggleOption(group.id, opt.id, group.maxSelect)}
                        style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "14px 16px", width: "100%", textAlign: "left",
                          background: isSelected ? "rgba(244,166,35,0.06)" : "#fafafa",
                          border: isSelected ? "1.5px solid #F4A623" : "1.5px solid #f0f0f0",
                          borderRadius: 14, cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {/* Radio/Checkbox indicator */}
                        <div style={{
                          width: 22, height: 22, borderRadius: isRadio ? "50%" : 6, flexShrink: 0,
                          border: isSelected ? "none" : "2px solid #ddd",
                          background: isSelected ? "#F4A623" : "white",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 0.15s ease",
                        }}>
                          {isSelected && <Check size={14} color="white" strokeWidth={3} />}
                        </div>

                        {/* Option name */}
                        <span style={{
                          flex: 1, fontSize: "0.88rem",
                          fontWeight: isSelected ? 600 : 400,
                          color: isSelected ? "#0e0e0e" : "#555",
                        }}>
                          {opt.name}
                        </span>

                        {/* Price adjustment */}
                        {opt.priceAdjustment !== 0 && (
                          <span style={{
                            fontSize: "0.82rem", fontWeight: 600, flexShrink: 0,
                            color: opt.priceAdjustment > 0 ? "#F4A623" : "#16a34a",
                          }}>
                            {opt.priceAdjustment > 0 ? "+" : "-"}${Math.abs(opt.priceAdjustment).toLocaleString("es-CL")}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer with price */}
        <div style={{
          position: "sticky", bottom: 0, padding: "16px 20px",
          paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
          background: "white", borderTop: "1px solid #f0f0f0",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <p style={{ fontSize: "0.72rem", color: "#aaa", margin: "0 0 2px" }}>Total</p>
            <p style={{ fontSize: "1.3rem", fontWeight: 800, color: "#0e0e0e", margin: 0 }}>
              ${totalPrice.toLocaleString("es-CL")}
            </p>
          </div>
          <button
            onClick={close}
            disabled={!allValid}
            style={{
              padding: "14px 32px", borderRadius: 50, border: "none",
              background: allValid ? "#0e0e0e" : "#e0e0e0",
              color: allValid ? "white" : "#aaa",
              fontSize: "0.92rem", fontWeight: 700, cursor: allValid ? "pointer" : "not-allowed",
              boxShadow: allValid ? "0 4px 14px rgba(0,0,0,0.15)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
