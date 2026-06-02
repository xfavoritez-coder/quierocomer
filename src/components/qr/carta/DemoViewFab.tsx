"use client";

import { useState, useRef, useEffect } from "react";
import { List, Rocket, LayoutGrid } from "lucide-react";
import { useCartaView, type CartaView } from "./hooks/useCartaView";
import { showViewTransition } from "./hooks/useViewTransition";
import { useLang } from "@/contexts/LangContext";
import { t } from "@/lib/qr/i18n";

const VIEWS: { value: CartaView; labelKey: string; Icon: typeof List }[] = [
  { value: "premium", labelKey: "viewGallery", Icon: LayoutGrid },
  { value: "lista", labelKey: "viewList", Icon: List },
  { value: "impact", labelKey: "viewImpact", Icon: Rocket },
];

interface Props {
  restaurantId: string;
  defaultView?: string | null;
}

/**
 * Floating view-switcher FAB for demo mode.
 * Shows above WaiterButton in the FAB stack.
 */
export default function DemoViewFab({ restaurantId, defaultView }: Props) {
  const { view, setView } = useCartaView(defaultView);
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside tap
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const handleSelect = (next: CartaView) => {
    setOpen(false);
    if (next === view) return;
    const option = VIEWS.find(o => o.value === next);
    showViewTransition(option ? t(lang, option.labelKey as any) : "", next);
    setView(next);
    import("./utils/cartaAnalytics").then(({ trackCartaViewSelected }) => {
      trackCartaViewSelected(restaurantId, next, view);
    }).catch(() => {});
  };

  const ActiveIcon = VIEWS.find(v => v.value === view)?.Icon || Rocket;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Cambiar vista"
        style={{
          width: 62, height: 62, borderRadius: "50%",
          background: open ? "rgba(244,166,35,0.25)" : "rgba(30,30,30,0.85)",
          border: "1.5px solid rgba(244,166,35,0.4)",
          backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          color: "#F4A623",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
          transition: "all 0.2s ease",
        }}
      >
        <ActiveIcon size={18} strokeWidth={1.75} />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)", right: 0,
            background: "rgba(15,15,15,0.92)",
            backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
            borderRadius: 14, padding: 4, minWidth: 155,
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            animation: "demoViewFabIn 0.18s ease-out",
          }}
        >
          {VIEWS.map(({ value, labelKey, Icon }) => {
            const isActive = view === value;
            return (
              <button
                key={value}
                onClick={() => handleSelect(value)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%",
                  padding: "10px 14px", borderRadius: 10, border: "none", cursor: "pointer",
                  background: isActive ? "rgba(244,166,35,0.2)" : "transparent",
                  color: isActive ? "#F4A623" : "rgba(255,255,255,0.8)",
                  fontSize: "0.82rem", fontWeight: isActive ? 700 : 500,
                  fontFamily: "inherit", textAlign: "left",
                }}
              >
                <Icon size={14} strokeWidth={1.75} />
                {t(lang, labelKey as any)}
                {isActive && <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "#F4A623" }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes demoViewFabIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
