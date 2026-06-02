"use client";

import { useState, useEffect, useRef } from "react";
import { List, Rocket, LayoutGrid, Sun, Moon } from "lucide-react";
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
  plan?: string;
  defaultView?: string | null;
}

export default function ViewSelectorCompact({ restaurantId, plan, defaultView }: Props) {
  const { view, setView } = useCartaView(defaultView);
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    const container = document.querySelector(".carta-dark, .carta-light");
    setIsDark(container?.classList.contains("carta-dark") || false);
  }, []);

  const toggleTheme = () => {
    const container = document.querySelector(".carta-dark, .carta-light");
    if (!container) return;
    const newDark = !isDark;
    container.classList.toggle("carta-dark", newDark);
    container.classList.toggle("carta-light", !newDark);
    setIsDark(newDark);
    localStorage.setItem("qc_theme_override", newDark ? "dark" : "light");
  };

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

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    setOpen(!open);
  };

  const ActiveIcon = VIEWS.find(v => v.value === view)?.Icon || List;

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleToggle}
        aria-label="Cambiar vista"
        style={{
          width: 38, height: 38, borderRadius: "50%",
          background: "var(--carta-search-bg)",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "none", cursor: "pointer", position: "relative", zIndex: 10,
          color: "var(--carta-text2, rgba(255,255,255,0.7))",
        }}
      >
        <ActiveIcon size={15} strokeWidth={1.75} />
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 9998 }} />
          <div
            style={{
              position: "fixed", top: pos.top, right: pos.right, zIndex: 9999,
              background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
              borderRadius: 14, padding: 4, minWidth: 150,
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              animation: "vscDropIn 0.2s ease-out",
            }}
          >
            {/* Vista options */}
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

            {/* Divider */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.1)", margin: "2px 10px" }} />

            {/* Theme toggle */}
            <button
              onClick={() => { toggleTheme(); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "10px 14px", borderRadius: 10, border: "none", cursor: "pointer",
                background: "transparent", color: "rgba(255,255,255,0.8)",
                fontSize: "0.82rem", fontWeight: 500, fontFamily: "inherit", textAlign: "left",
              }}
            >
              {isDark ? <Sun size={14} strokeWidth={1.75} /> : <Moon size={14} strokeWidth={1.75} />}
              {isDark ? "Modo claro" : "Modo oscuro"}
            </button>
          </div>
        </>
      )}

      <style>{`
        @keyframes vscDropIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
