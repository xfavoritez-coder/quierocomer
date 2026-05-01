"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/contexts/LangContext";
import { t } from "@/lib/qr/i18n";

export default function GlutenFreeFloatingPill() {
  const lang = useLang();
  const [scrolled, setScrolled] = useState(false);
  const [viewSelectorOpen, setViewSelectorOpen] = useState(false);
  const [isGlutenFree, setIsGlutenFree] = useState(false);

  useEffect(() => {
    const check = () => {
      try {
        const restrictions = JSON.parse(localStorage.getItem("qr_restrictions") || "[]");
        setIsGlutenFree(restrictions.includes("gluten"));
      } catch { setIsGlutenFree(false); }
    };
    check();

    const onScroll = () => setScrolled(window.scrollY > 400);
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

  if (!isGlutenFree || !scrolled || viewSelectorOpen) return null;

  return (
    <button
      onClick={() => {
        const el = document.getElementById("genio-glutenfree-carousel");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }}
      className="fixed z-40 font-[family-name:var(--font-dm)]"
      style={{
        bottom: "calc(16px + env(safe-area-inset-bottom))", left: "50%", transform: "translateX(-50%)",
        display: "flex", alignItems: "center", gap: 6,
        padding: "10px 20px", background: "rgba(255,248,238,0.95)", backdropFilter: "blur(8px)",
        border: "0.5px solid rgba(194,149,76,0.3)", borderRadius: 999,
        cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
      }}
    >
      <span style={{ fontSize: "14px" }}>🌾</span>
      <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#5C3D0E" }}>{t(lang, "gMyGlutenFreeOptions" as any) || "Mis platos sin gluten ↑"}</span>
    </button>
  );
}
