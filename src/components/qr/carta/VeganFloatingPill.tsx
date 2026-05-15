"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/contexts/LangContext";
import { t } from "@/lib/qr/i18n";

export default function VeganFloatingPill() {
  const lang = useLang();
  const [scrolled, setScrolled] = useState(false);
  const [viewSelectorOpen, setViewSelectorOpen] = useState(false);
  const [isVegan, setIsVegan] = useState(false);

  useEffect(() => {
    const checkVegan = () => setIsVegan(localStorage.getItem("qr_diet") === "vegan");
    checkVegan();

    // Show pill only when user has scrolled PAST the genio carousel (below it)
    const checkCarousel = () => {
      const el = document.getElementById("genio-vegan-carousel");
      if (!el) { setScrolled(false); return; }
      const rect = el.getBoundingClientRect();
      // Only show when the bottom of the carousel is above the viewport
      setScrolled(rect.bottom < 0);
    };
    // Small delay to let carousel render
    setTimeout(checkCarousel, 500);
    window.addEventListener("scroll", checkCarousel, { passive: true });

    window.addEventListener("genio-updated", checkVegan);
    const onViewToggle = (e: Event) => {
      setViewSelectorOpen((e as CustomEvent).detail?.open ?? false);
    };
    window.addEventListener("view-selector-toggle", onViewToggle);

    return () => {
      window.removeEventListener("scroll", checkCarousel);
      window.removeEventListener("genio-updated", checkVegan);
      window.removeEventListener("view-selector-toggle", onViewToggle);
    };
  }, []);

  if (!isVegan || !scrolled || viewSelectorOpen) return null;

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
        padding: "10px 20px", background: "var(--carta-genio-vegan-bg)", backdropFilter: "blur(8px)",
        border: "0.5px solid var(--carta-genio-vegan-border2)", borderRadius: 999,
        cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
      }}
    >
      <span style={{ fontSize: "14px" }}>🌿</span>
      <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--carta-genio-vegan-title)" }}>{t(lang, "gMyVeganOptions")}</span>
    </button>
  );
}
