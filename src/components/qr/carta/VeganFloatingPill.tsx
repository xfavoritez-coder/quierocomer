"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/contexts/LangContext";
import { t } from "@/lib/qr/i18n";

export default function VeganFloatingPill() {
  const lang = useLang();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => {
        const el = document.getElementById("genio-vegan-carousel");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }}
      className="fixed z-40 font-[family-name:var(--font-dm)]"
      style={{
        bottom: "calc(120px + env(safe-area-inset-bottom))", left: "50%", transform: "translateX(-50%)",
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
