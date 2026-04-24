"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Layers, List, BookOpen, Rocket, Globe } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCartaView, type CartaView } from "./hooks/useCartaView";
import { showViewTransition } from "./hooks/useViewTransition";
import { useLang } from "@/contexts/LangContext";
import { LANG_FLAGS, SUPPORTED_LANGS, t } from "@/lib/qr/i18n";
import type { Lang } from "@/lib/qr/i18n";
import GenioTip from "../genio/GenioTip";

const TOOLTIP_KEY = "quierocomer_carta_view_tooltip_shown";
const LANG_STORAGE_KEY = "qc_lang";

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
  const lang = useLang();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
  useEffect(() => {
    if (!localStorage.getItem(TOOLTIP_KEY)) {
      const timer = setTimeout(() => setShowTooltip(true), 1800);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismissTooltip = () => {
    setShowTooltip(false);
    localStorage.setItem(TOOLTIP_KEY, "1");
  };

  const handleSelect = (next: CartaView) => {
    setOpen(false);
    if (next === view) return;
    const option = OPTIONS.find((o) => o.value === next);
    showViewTransition(option?.label || "", next);
    setView(next);
    import("./utils/cartaAnalytics").then(({ trackCartaViewSelected }) => {
      trackCartaViewSelected(restaurantId, next, view);
    }).catch(() => {});
  };

  const handleLangChange = useCallback((next: Lang) => {
    if (next === lang) return;
    localStorage.setItem(LANG_STORAGE_KEY, next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("lang", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [lang, pathname, router, searchParams]);

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
            flexDirection: "column",
            gap: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderRadius: 20,
            padding: "6px 6px",
            boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
            border: "1px solid rgba(255,255,255,0.1)",
            animation: "vsSlideIn 0.25s cubic-bezier(0.16,1,0.3,1)",
            whiteSpace: "nowrap",
          }}
        >
          {/* View options row */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 2px" }}>
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
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.1)", margin: "4px 8px" }} />

          {/* Language selector row */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 2px" }}>
            <Globe size={12} style={{ marginLeft: 8, color: "rgba(255,255,255,0.4)", flexShrink: 0 }} />
            {SUPPORTED_LANGS.map((l) => {
              const isActive = lang === l;
              return (
                <button
                  key={l}
                  onClick={() => handleLangChange(l)}
                  className="active:scale-95 transition-transform"
                  style={{
                    padding: "6px 12px",
                    borderRadius: 50,
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    letterSpacing: "0.05em",
                    transition: "all 0.15s",
                    background: isActive ? "rgba(244,166,35,0.2)" : "transparent",
                    color: isActive ? "#F4A623" : "rgba(255,255,255,0.5)",
                  }}
                >
                  {LANG_FLAGS[l]}
                </button>
              );
            })}
          </div>

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
        className="flex items-center justify-center active:scale-90"
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: open ? "rgba(244,166,35,0.2)" : "rgba(0,0,0,0.4)",
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
          arrow="right"

          style={{ position: "absolute", right: 62, top: "50%", transform: "translateY(-50%)", width: 180, zIndex: 40 }}
        >
          Cambia de vista o idioma.
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
