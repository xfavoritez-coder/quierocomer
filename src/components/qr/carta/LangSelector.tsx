"use client";

import { useState, useEffect, useRef } from "react";
import { useLang } from "@/contexts/LangContext";
import { SUPPORTED_LANGS } from "@/lib/qr/i18n";

const FLAGS: Record<string, string> = { es: "🇪🇸", en: "🇺🇸", pt: "🇧🇷", it: "🇮🇹" };
const NAMES: Record<string, string> = { es: "Español", en: "English", pt: "Português", it: "Italiano" };

function buildLangUrl(lang: string): string {
  if (typeof window === "undefined") return "#";
  const url = new URL(window.location.href);
  url.searchParams.set("lang", lang);
  return url.toString();
}

export default function LangSelector({ enabledLangs }: { enabledLangs?: string[] }) {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const availableLangs = enabledLangs ? SUPPORTED_LANGS.filter(l => enabledLangs.includes(l)) : [];

  useEffect(() => { setMounted(true); }, []);

  if (!mounted || availableLangs.length < 2) return null;

  const handleOpen = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    setOpen(!open);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
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
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 199 }} />
          <div style={{
            position: "fixed", top: pos.top, right: pos.right, zIndex: 200,
            background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
            borderRadius: 12, padding: 4, minWidth: 140,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}>
            {availableLangs.map(l => (
              <a
                key={l}
                href={buildLangUrl(l)}
                onClick={() => localStorage.setItem("qc_lang", l)}
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
            ))}
          </div>
        </>
      )}
    </>
  );
}
