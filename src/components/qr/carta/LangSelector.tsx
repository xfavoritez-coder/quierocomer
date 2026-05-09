"use client";

import { useState, useEffect, useRef } from "react";
import { useLang } from "@/contexts/LangContext";
import { SUPPORTED_LANGS } from "@/lib/qr/i18n";

const FLAGS: Record<string, string> = {
  es: "🇪🇸",
  en: "🇺🇸",
  pt: "🇧🇷",
  it: "🇮🇹",
};

const NAMES: Record<string, string> = {
  es: "Español",
  en: "English",
  pt: "Português",
  it: "Italiano",
};

interface Props {
  enabledLangs?: string[];
}

export default function LangSelector({ enabledLangs }: Props) {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const availableLangs = enabledLangs
    ? SUPPORTED_LANGS.filter(l => enabledLangs.includes(l))
    : [];

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [open]);

  // Don't render until mounted (avoids hydration mismatch)
  // Don't render if less than 2 languages
  if (!mounted || availableLangs.length < 2) return null;

  const handleChange = (next: string) => {
    if (next === lang) { setOpen(false); return; }
    localStorage.setItem("qc_lang", next);
    setOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.set("lang", next);
    window.location.assign(url.toString());
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "none", cursor: "pointer", fontSize: "0.95rem",
        }}
      >
        {FLAGS[lang] || "🌐"}
      </button>
      {open && (
        <div style={{
          position: "absolute", top: 38, right: 0, zIndex: 50,
          background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          borderRadius: 12, padding: 4, display: "flex", flexDirection: "column", gap: 2, minWidth: 130,
        }}>
          {availableLangs.map(l => (
            <button
              key={l}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleChange(l); }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 12px", border: "none", borderRadius: 8, cursor: "pointer",
                background: l === lang ? "rgba(244,166,35,0.2)" : "transparent",
                color: "white", fontSize: "0.82rem", fontWeight: l === lang ? 600 : 400,
              }}
            >
              <span style={{ fontSize: "1.1rem" }}>{FLAGS[l]}</span>
              {NAMES[l]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
