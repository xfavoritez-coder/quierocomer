"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Layers, List, BookOpen, Rocket, LayoutGrid } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCartaView, type CartaView } from "./hooks/useCartaView";
import { showViewTransition } from "./hooks/useViewTransition";
import { useLang } from "@/contexts/LangContext";
import { LANG_FLAGS, SUPPORTED_LANGS, t } from "@/lib/qr/i18n";
import type { Lang } from "@/lib/qr/i18n";
import GenioTip from "../genio/GenioTip";

const TOOLTIP_KEY = "quierocomer_carta_view_tooltip_shown";
const LANG_STORAGE_KEY = "qc_lang";

const VIEW_KEYS: { value: CartaView; labelKey: "viewList" | "viewGallery" | "viewSpace" | "viewFeed"; Icon: typeof List }[] = [
  { value: "lista", labelKey: "viewList", Icon: List },
  { value: "premium", labelKey: "viewGallery", Icon: BookOpen },
  { value: "feed", labelKey: "viewFeed", Icon: LayoutGrid },
  { value: "viaje", labelKey: "viewSpace", Icon: Rocket },
];

interface Props {
  restaurantId: string;
  enabledLangs?: string[];
  plan?: string;
}

export default function ViewSelector({ restaurantId, enabledLangs, plan }: Props) {
  const { view, setView } = useCartaView();
  const lang = useLang();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Notify other components when view selector opens/closes
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("view-selector-toggle", { detail: { open } }));
  }, [open]);

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

  // First-time tooltip: show once, auto-dismiss after 5s
  useEffect(() => {
    if (!localStorage.getItem(TOOLTIP_KEY)) {
      const show = setTimeout(() => setShowTooltip(true), 1800);
      const hide = setTimeout(() => { setShowTooltip(false); localStorage.setItem(TOOLTIP_KEY, "1"); }, 9800);
      return () => { clearTimeout(show); clearTimeout(hide); };
    }
  }, []);

  const dismissTooltip = () => {
    setShowTooltip(false);
    localStorage.setItem(TOOLTIP_KEY, "1");
  };

  const handleSelect = (next: CartaView) => {
    setOpen(false);
    if (next === view) return;
    const option = VIEW_KEYS.find((o) => o.value === next);
    showViewTransition(option ? t(lang, option.labelKey as any) : "", next);
    setView(next);
    import("./utils/cartaAnalytics").then(({ trackCartaViewSelected }) => {
      trackCartaViewSelected(restaurantId, next, view);
    }).catch(() => {});
  };

  const [optimisticLang, setOptimisticLang] = useState<Lang | null>(null);
  const activeLang = optimisticLang || lang;

  const handleLangChange = useCallback((next: Lang) => {
    if (next === lang && !optimisticLang) return;
    setOptimisticLang(next);
    localStorage.setItem(LANG_STORAGE_KEY, next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("lang", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [lang, optimisticLang, pathname, router, searchParams]);

  // Clear optimistic state when real lang updates
  useEffect(() => { setOptimisticLang(null); }, [lang]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      {/* Options panel — slides left */}
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            right: 62,
            bottom: 0,
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
          {/* View options grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, padding: "2px 2px" }}>
            {VIEW_KEYS.filter(v => plan !== "GOLD" || v.value === "lista" || v.value === "premium").map(({ value, labelKey, Icon }) => {
              const label = t(lang, labelKey as any);
              const isActive = view === value;
              return (
                <button
                  key={value}
                  role="menuitem"
                  onClick={() => handleSelect(value)}
                  className="flex items-center justify-center active:scale-95 transition-transform"
                  style={{
                    gap: 5,
                    padding: "8px 12px",
                    borderRadius: 50,
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    transition: "all 0.15s",
                    background: isActive ? "white" : "transparent",
                    color: isActive ? "#0e0e0e" : "rgba(255,255,255,0.75)",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Icon size={13} strokeWidth={1.75} />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.1)", margin: "4px 8px" }} />

          {/* Language selector row */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 2px" }}>
            <span style={{ marginLeft: 8, marginRight: 6, color: "rgba(255,255,255,0.4)", fontSize: "0.72rem", fontWeight: 600, flexShrink: 0, letterSpacing: "0.03em" }}>Idioma</span>
            {(enabledLangs ? SUPPORTED_LANGS.filter(l => enabledLangs.includes(l)) : SUPPORTED_LANGS).map((l) => {
              const isActive = activeLang === l;
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
          arrow="right"
          style={{ position: "absolute", right: 62, top: "50%", transform: "translateY(-50%)", width: 180, zIndex: 40 }}
        >
          Cambia de vista o idioma
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
