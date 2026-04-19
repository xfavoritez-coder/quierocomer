"use client";

import { useState, useEffect, useRef } from "react";
import { Layers, List, BookOpen, Rocket, Check } from "lucide-react";
import { useCartaView, type CartaView } from "./hooks/useCartaView";
import { showViewTransition } from "./hooks/useViewTransition";
import GenioTip from "../genio/GenioTip";

const TOOLTIP_KEY = "quierocomer_carta_view_tooltip_shown";

const OPTIONS: { value: CartaView; label: string; Icon: typeof List }[] = [
  { value: "lista", label: "Lista", Icon: List },
  { value: "premium", label: "Clásica", Icon: BookOpen },
  { value: "viaje", label: "Espacial", Icon: Rocket },
];

interface Props {
  restaurantId: string;
}

export default function ViewSelector({ restaurantId }: Props) {
  const { view, setView } = useCartaView();
  const [open, setOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click/touch
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    document.addEventListener("touchstart", handle);
    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("touchstart", handle);
    };
  }, [open]);

  // First-time tooltip with attention pulse
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!localStorage.getItem(TOOLTIP_KEY)) {
      const timer = setTimeout(() => setShowTooltip(true), 1800);
      return () => clearTimeout(timer);
    }
  }, []);

  // Recurring bounce every 10s while tooltip is visible
  useEffect(() => {
    if (!showTooltip) return;
    const interval = setInterval(() => {
      const el = document.getElementById("genio-tip-container");
      if (el) {
        el.style.animation = "none";
        void el.offsetHeight;
        el.style.animation = "genioTipBounce 0.4s ease-in-out";
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [showTooltip]);

  const dismissTooltip = () => {
    setShowTooltip(false);
    localStorage.setItem(TOOLTIP_KEY, "1");
  };

  const handleSelect = (next: CartaView) => {
    setOpen(false);
    if (next === view) return;
    const option = OPTIONS.find((o) => o.value === next);
    // Show overlay IMMEDIATELY before React re-renders
    showViewTransition(option?.label || "", next);
    setView(next);
    import("./utils/cartaAnalytics").then(({ trackCartaViewSelected }) => {
      trackCartaViewSelected(restaurantId, next, view);
    }).catch(() => {});
  };

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      {/* Options panel — slides left */}
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            right: 62,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderRadius: 50,
            padding: "6px 8px",
            boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
            border: "1px solid rgba(255,255,255,0.1)",
            animation: "vsSlideIn 0.25s cubic-bezier(0.16,1,0.3,1)",
            whiteSpace: "nowrap",
          }}
        >
          {OPTIONS.map(({ value, label, Icon }) => {
            const isActive = view === value;
            return (
              <button
                key={value}
                role="menuitem"
                onClick={() => handleSelect(value)}
                className="flex items-center active:scale-95 transition-transform"
                style={{
                  gap: 5,
                  padding: "8px 14px",
                  borderRadius: 50,
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  transition: "all 0.15s",
                  background: isActive ? "white" : "transparent",
                  color: isActive ? "#0e0e0e" : "rgba(255,255,255,0.75)",
                }}
              >
                <Icon size={14} strokeWidth={1.75} />
                {label}
              </button>
            );
          })}

          {/* Arrow pointing right to the trigger button */}
          <div style={{
            position: "absolute",
            right: -5,
            top: "50%",
            transform: "translateY(-50%) rotate(45deg)",
            width: 10,
            height: 10,
            background: "rgba(0,0,0,0.75)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderLeft: "none",
            borderBottom: "none",
          }} />
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={() => { setOpen(!open); dismissTooltip(); }}
        aria-label="Cambiar vista"
        aria-expanded={open}
        className="flex items-center justify-center active:scale-90 transition-all duration-200"
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: open ? "rgba(244,166,35,0.2)" : "rgba(0,0,0,0.55)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: open ? "1px solid rgba(244,166,35,0.4)" : "1px solid rgba(255,255,255,0.12)",
          color: "white",
          cursor: "pointer",
          boxShadow: open ? "0 0 16px rgba(244,166,35,0.2)" : "0 4px 18px rgba(0,0,0,0.25)",
        }}
      >
        <Layers size={22} strokeWidth={1.75} />
      </button>

      {/* First-time tip del Genio */}
      {showTooltip && !open && (
        <GenioTip
          id="genio-tip-container"
          onClose={dismissTooltip}
          arrow="bottom-right"
          style={{ position: "absolute", right: 0, bottom: 64, width: 260, zIndex: 40 }}
        >
          Hay más de una forma de explorar. Toca aquí para cambiar la vista.
        </GenioTip>
      )}

      <style>{`
        @keyframes vsSlideIn {
          from { opacity: 0; transform: translateX(10px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
