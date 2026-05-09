"use client";

import { useState, useEffect, useRef } from "react";
import { useLang } from "@/contexts/LangContext";
import { SUPPORTED_LANGS } from "@/lib/qr/i18n";

const FLAGS: Record<string, string> = { es: "🇪🇸", en: "🇺🇸", pt: "🇧🇷", it: "🇮🇹" };
const NAMES: Record<string, string> = { es: "Español", en: "English", pt: "Português", it: "Italiano" };

export default function LangSelector({ enabledLangs }: { enabledLangs?: string[] }) {
  const lang = useLang();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  const availableLangs = enabledLangs ? SUPPORTED_LANGS.filter(l => enabledLangs.includes(l)) : [];

  useEffect(() => { setMounted(true); }, []);

  if (!mounted || availableLangs.length < 2) return null;

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    setOpen(!open);
  };

  // Build URL for each language
  const getUrl = (l: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("lang", l);
    return url.toString();
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleToggle}
        style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "none", cursor: "pointer", fontSize: "0.95rem", position: "relative", zIndex: 10,
        }}
      >
        {FLAGS[lang] || "🌐"}
      </button>

      {open && (
        <div
          style={{
            position: "fixed", top: pos.top, right: pos.right, zIndex: 9999,
            background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
            borderRadius: 12, padding: 4, minWidth: 140,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          {availableLangs.map(l => {
            const url = getUrl(l);
            return (
              <a
                key={l}
                href={url}
                onClick={(e) => {
                  localStorage.setItem("qc_lang", l);
                  // Let the <a href> do the navigation naturally
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "9px 14px", borderRadius: 8, textDecoration: "none",
                  background: l === lang ? "rgba(244,166,35,0.2)" : "transparent",
                  color: "white", fontSize: "0.85rem", fontWeight: l === lang ? 600 : 400,
                }}
              >
                <span style={{ fontSize: "1.1rem" }}>{FLAGS[l]}</span>
                {NAMES[l]}
                {l === lang && <span style={{ marginLeft: "auto", color: "#F4A623", fontSize: "0.7rem" }}>✓</span>}
              </a>
            );
          })}
          <button
            onClick={() => setOpen(false)}
            style={{
              display: "block", width: "100%", padding: "6px", marginTop: 2,
              background: "none", border: "none", color: "rgba(255,255,255,0.3)",
              fontSize: "0.7rem", cursor: "pointer", textAlign: "center",
            }}
          >
            Cerrar
          </button>
        </div>
      )}
    </>
  );
}
