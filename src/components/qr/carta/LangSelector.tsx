"use client";

import { useState, useEffect } from "react";
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

  const availableLangs = enabledLangs ? SUPPORTED_LANGS.filter(l => enabledLangs.includes(l)) : [];

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted) {
      console.log("[LangSelector] enabledLangs:", enabledLangs, "availableLangs:", availableLangs, "lang:", lang);
    }
  }, [mounted]);

  if (!mounted || availableLangs.length < 2) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
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
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "rgba(20,20,20,0.95)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
              borderRadius: 16, padding: "8px 6px", minWidth: 180,
              boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
            }}
          >
            <p style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.4)", textAlign: "center", margin: "8px 0 6px", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>Idioma</p>
            {availableLangs.map(l => (
              <a
                key={l}
                href={buildLangUrl(l)}
                onClick={() => localStorage.setItem("qc_lang", l)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%",
                  padding: "10px 16px", borderRadius: 10, textDecoration: "none",
                  background: l === lang ? "rgba(244,166,35,0.15)" : "transparent",
                  color: "white", fontSize: "0.9rem", fontWeight: l === lang ? 600 : 400,
                }}
              >
                <span style={{ fontSize: "1.2rem" }}>{FLAGS[l]}</span>
                {NAMES[l]}
                {l === lang && <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "#F4A623" }}>✓</span>}
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
