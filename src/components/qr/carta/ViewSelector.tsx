"use client";

import { useEffect, useState } from "react";
import { List, Sparkles, Compass } from "lucide-react";
import { useCartaView, type CartaView } from "./hooks/useCartaView";

const TOOLTIP_KEY = "quierocomer_carta_view_tooltip_shown";

const OPTIONS: { value: CartaView; label: string; Icon: typeof List; disabled?: boolean }[] = [
  { value: "lista", label: "Lista", Icon: List },
  { value: "premium", label: "Premium", Icon: Sparkles },
  { value: "viaje", label: "Viaje", Icon: Compass },
];

interface Props {
  restaurantId: string;
  variant?: "light" | "dark";
}

export default function ViewSelector({ restaurantId, variant = "light" }: Props) {
  const { view, setView } = useCartaView();
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(TOOLTIP_KEY)) {
      const timer = setTimeout(() => {
        setShowTooltip(true);
        setTimeout(() => {
          setShowTooltip(false);
          localStorage.setItem(TOOLTIP_KEY, "1");
        }, 4000);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleSelect = (next: CartaView) => {
    if (next === view) return;
    setView(next);
    import("./utils/cartaAnalytics").then(({ trackCartaViewSelected }) => {
      trackCartaViewSelected(restaurantId, next, view);
    }).catch(() => {});
  };

  const isDark = variant === "dark";

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <div
        role="tablist"
        aria-label="Elige cómo ver la carta"
        style={{
          display: "inline-flex",
          borderRadius: 50,
          padding: 2,
          gap: 2,
          background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.04)",
          backdropFilter: isDark ? "blur(12px)" : "none",
          WebkitBackdropFilter: isDark ? "blur(12px)" : "none",
          border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)"}`,
        }}
      >
        {OPTIONS.map(({ value, label, Icon, disabled }) => {
          const isActive = view === value;
          return (
            <button
              key={value}
              role="tab"
              aria-selected={isActive}
              disabled={disabled}
              onClick={() => !disabled && handleSelect(value)}
              title={disabled ? "Próximamente" : label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "5px 10px",
                borderRadius: 50,
                fontSize: "0.68rem",
                fontWeight: 500,
                letterSpacing: "0.02em",
                border: "none",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.35 : 1,
                transition: "all 0.2s",
                background: isActive
                  ? isDark ? "white" : "#0e0e0e"
                  : "transparent",
                color: isActive
                  ? isDark ? "#0e0e0e" : "white"
                  : isDark ? "rgba(255,255,255,0.6)" : "rgba(14,14,14,0.5)",
                boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                fontFamily: "inherit",
              }}
            >
              <Icon size={12} strokeWidth={1.75} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
      {showTooltip && (
        <div
          className="font-[family-name:var(--font-dm)]"
          style={{
            position: "absolute",
            top: "100%",
            marginTop: 8,
            right: 0,
            background: "#0e0e0e",
            color: "white",
            fontSize: "0.72rem",
            padding: "8px 12px",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            whiteSpace: "nowrap",
            zIndex: 50,
            animation: "fadeInDown 0.25s ease-out",
          }}
        >
          Elige cómo ver la carta
          <div style={{
            position: "absolute",
            top: -4,
            right: 16,
            width: 8,
            height: 8,
            background: "#0e0e0e",
            transform: "rotate(45deg)",
          }} />
        </div>
      )}
      <style>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
