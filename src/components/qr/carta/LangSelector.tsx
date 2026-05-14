"use client";

import { useState, useEffect, useRef } from "react";
import { useLang } from "@/contexts/LangContext";
import { SUPPORTED_LANGS } from "@/lib/qr/i18n";

const FLAG_EMOJI: Record<string, string> = { es: "🇪🇸", en: "🇺🇸", pt: "🇧🇷", it: "🇮🇹" };

function FlagSvg({ code, size = 20 }: { code: string; size?: number }) {
  const id = `f${code}${Math.random().toString(36).slice(2, 6)}`;
  const flags: Record<string, React.ReactNode> = {
    es: <svg viewBox="0 0 100 100" width={size} height={size}><defs><clipPath id={id}><circle cx="50" cy="50" r="50"/></clipPath></defs><g clipPath={`url(#${id})`}><rect y="0" width="100" height="25" fill="#c60b1e"/><rect y="25" width="100" height="50" fill="#ffc400"/><rect y="75" width="100" height="25" fill="#c60b1e"/></g></svg>,
    en: <svg viewBox="0 0 100 100" width={size} height={size}><defs><clipPath id={id}><circle cx="50" cy="50" r="50"/></clipPath></defs><g clipPath={`url(#${id})`}><rect width="100" height="100" fill="#002868"/><rect y="0" width="100" height="8" fill="#bf0a30"/><rect y="15" width="100" height="8" fill="white"/><rect y="30" width="100" height="8" fill="#bf0a30"/><rect y="45" width="100" height="8" fill="white"/><rect y="60" width="100" height="8" fill="#bf0a30"/><rect y="75" width="100" height="8" fill="white"/><rect y="90" width="100" height="10" fill="#bf0a30"/><rect width="45" height="55" fill="#002868"/></g></svg>,
    pt: <svg viewBox="0 0 100 100" width={size} height={size}><defs><clipPath id={id}><circle cx="50" cy="50" r="50"/></clipPath></defs><g clipPath={`url(#${id})`}><rect width="100" height="100" fill="#009739"/><rect width="40" height="100" fill="#002776"/><circle cx="40" cy="50" r="16" fill="#fedd00"/></g></svg>,
    it: <svg viewBox="0 0 100 100" width={size} height={size}><defs><clipPath id={id}><circle cx="50" cy="50" r="50"/></clipPath></defs><g clipPath={`url(#${id})`}><rect x="0" width="33" height="100" fill="#009246"/><rect x="33" width="34" height="100" fill="white"/><rect x="67" width="33" height="100" fill="#ce2b37"/></g></svg>,
  };
  return <span style={{ display: "inline-flex", borderRadius: "50%", overflow: "hidden", width: size, height: size, flexShrink: 0 }}>{flags[code] || <span>{FLAG_EMOJI[code] || "🌐"}</span>}</span>;
}
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
          background: "var(--carta-search-bg)",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "none", cursor: "pointer", fontSize: "0.95rem", position: "relative", zIndex: 10,
        }}
      >
        <FlagSvg code={lang} size={20} />
      </button>

      {open && (
        <>
          {/* Backdrop — closes on tap outside */}
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 9998 }} />
          {/* Dropdown */}
          <div
            style={{
              position: "fixed", top: pos.top, right: pos.right, zIndex: 9999,
              background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
              borderRadius: 12, padding: 4, minWidth: 140,
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            }}
          >
            {availableLangs.map(l => (
              <a
                key={l}
                href={getUrl(l)}
                onClick={() => localStorage.setItem("qc_lang", l)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "9px 14px", borderRadius: 8, textDecoration: "none",
                  background: l === lang ? "rgba(244,166,35,0.2)" : "transparent",
                  color: "white", fontSize: "0.85rem", fontWeight: l === lang ? 600 : 400,
                }}
              >
                <FlagSvg code={l} size={18} />
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
