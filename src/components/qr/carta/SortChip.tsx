"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, Eye, Flame, Check } from "lucide-react";
import type { SortKey } from "./hooks/useCartaSort";
import { useLang } from "@/contexts/LangContext";
import { t } from "@/lib/qr/i18n";

interface Props {
  sortKey: SortKey;
  setSortKey: (k: SortKey) => void;
  /** Set of options to enable. If salesMode is null, "Lo más pedido" is hidden. */
  salesMode: "today" | "week" | null;
}

/**
 * Round button + dropdown that mirrors the search chip in the sticky nav.
 * Sits to the right of the 🔍 search icon (and to the left of any other
 * trailing controls). Hidden in the Espacial view per spec.
 */
export default function SortChip({ sortKey, setSortKey, salesMode }: Props) {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  const options: { key: SortKey; icon: any; label: string; sub?: string }[] = [
    { key: "default", icon: null, label: t(lang, "sortDefault" as any) || "Por defecto" },
    { key: "views", icon: Eye, label: t(lang, "sortMostViewed" as any) || "Lo más visto" },
    ...(salesMode
      ? [{
          key: "sales" as SortKey,
          icon: Flame,
          label: t(lang, "sortMostOrdered" as any) || "Lo más pedido",
          sub: salesMode === "today"
            ? t(lang, "sortToday" as any) || "Hoy"
            : t(lang, "sortLast7Days" as any) || "Últimos 7 días",
        }]
      : []),
    { key: "price-asc", icon: ArrowUp, label: (t(lang, "sortPriceAsc" as any) || "Precio") + " ↑" },
    { key: "price-desc", icon: ArrowDown, label: (t(lang, "sortPriceDesc" as any) || "Precio") + " ↓" },
  ];

  const isActive = sortKey !== "default";

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t(lang, "sortBy" as any) || "Ordenar"}
        aria-expanded={open}
        className="flex items-center justify-center"
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: isActive ? "rgba(244,166,35,0.15)" : "rgba(14,14,14,0.06)",
          border: "none",
          cursor: "pointer",
          color: isActive ? "#F4A623" : "#666",
          position: "relative",
        }}
      >
        <ArrowUpDown size={17} strokeWidth={1.8} />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            background: "white",
            border: "1px solid rgba(14,14,14,0.08)",
            borderRadius: 14,
            boxShadow: "0 8px 28px rgba(0,0,0,0.12)",
            padding: 4,
            minWidth: 200,
            zIndex: 50,
            animation: "scFadeIn 0.15s ease-out",
          }}
        >
          {options.map((opt) => {
            const active = sortKey === opt.key;
            const Icon = opt.icon;
            return (
              <button
                key={opt.key}
                role="menuitem"
                onClick={() => { setSortKey(opt.key); setOpen(false); }}
                className="flex items-center font-[family-name:var(--font-dm)]"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "transparent",
                  border: "none",
                  borderRadius: 10,
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: "0.9rem",
                  color: "#0e0e0e",
                  fontWeight: active ? 600 : 400,
                  gap: 10,
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(14,14,14,0.04)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {Icon ? <Icon size={15} strokeWidth={1.8} color={active ? "#F4A623" : "#666"} /> : <span style={{ width: 15, display: "inline-block" }} />}
                <span style={{ flex: 1 }}>
                  {opt.label}
                  {opt.sub && <span style={{ display: "block", fontSize: "0.68rem", color: "#999", marginTop: 1 }}>{opt.sub}</span>}
                </span>
                {active && <Check size={15} strokeWidth={2} color="#F4A623" />}
              </button>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes scFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
