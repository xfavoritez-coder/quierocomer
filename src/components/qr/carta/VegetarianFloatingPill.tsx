"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/contexts/LangContext";
import { t } from "@/lib/qr/i18n";

export default function VegetarianFloatingPill() {
  const lang = useLang();
  const [scrolled, setScrolled] = useState(false);
  const [viewSelectorOpen, setViewSelectorOpen] = useState(false);
  const [isVegetarian, setIsVegetarian] = useState(false);

  useEffect(() => {
    const check = () => setIsVegetarian(localStorage.getItem("qr_diet") === "vegetarian");
    check();

    const onScroll = () => {
      const carousel = document.getElementById("genio-vegetarian-carousel");
      if (!carousel) { setScrolled(false); return; }
      const rect = carousel.getBoundingClientRect();
      // Show pill only when carousel is above the viewport (scrolled past it)
      setScrolled(rect.bottom < 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("genio-updated", check);

    const onViewToggle = (e: Event) => {
      setViewSelectorOpen((e as CustomEvent).detail?.open ?? false);
    };
    window.addEventListener("view-selector-toggle", onViewToggle);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("genio-updated", check);
      window.removeEventListener("view-selector-toggle", onViewToggle);
    };
  }, []);

  if (!isVegetarian || !scrolled || viewSelectorOpen) return null;

  return (
    <button
      onClick={() => {
        const el = document.getElementById("genio-vegetarian-carousel");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }}
      className="fixed z-40 font-[family-name:var(--font-dm)]"
      style={{
        bottom: "calc(16px + env(safe-area-inset-bottom))", left: "50%", transform: "translateX(-50%)",
        display: "flex", alignItems: "center", gap: 6,
        padding: "10px 20px", background: "var(--carta-genio-veg-bg)", backdropFilter: "blur(8px)",
        border: "0.5px solid var(--carta-genio-veg-border2)", borderRadius: 999,
        cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
      }}
    >
      <span style={{ fontSize: "14px" }}>🥗</span>
      <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--carta-genio-veg-title)" }}>{t(lang, "gMyVegetarianOptions" as any) || "Mis platos vegetarianos ↑"}</span>
    </button>
  );
}
