"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/contexts/LangContext";
import { t } from "@/lib/qr/i18n";

export default function VeganFloatingPill() {
  const lang = useLang();
  const [scrolled, setScrolled] = useState(false);
  const [viewSelectorOpen, setViewSelectorOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });

    const onViewToggle = (e: Event) => {
      setViewSelectorOpen((e as CustomEvent).detail?.open ?? false);
    };
    window.addEventListener("view-selector-toggle", onViewToggle);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("view-selector-toggle", onViewToggle);
    };
  }, []);

  if (!scrolled || viewSelectorOpen) return null;

  return (
    <button
      onClick={() => {
        const el = document.getElementById("genio-vegan-carousel");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }}
      className="fixed z-40 font-[family-name:var(--font-dm)]"
      style={{
        bottom: "calc(16px + env(safe-area-inset-bottom))", left: "50%", transform: "translateX(-50%)",
        display: "flex", alignItems: "center", gap: 6,
        padding: "10px 20px", background: "rgba(234,243,222,0.95)", backdropFilter: "blur(8px)",
        border: "0.5px solid rgba(99,153,34,0.3)", borderRadius: 999,
        cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
      }}
    >
      <span style={{ fontSize: "14px" }}>🌿</span>
      <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#173404" }}>{t(lang, "gMyVeganOptions")}</span>
    </button>
  );
}
