"use client";

import { useState, useEffect } from "react";

interface Props {
  hasCompletedGenio: boolean;
  onOpen: () => void;
}

/**
 * Genio floating action button with first-visit nudge tooltip.
 * Shows "Ordeno la carta especialmente para ti" on first visit until dismissed.
 */
export default function GenioFab({ hasCompletedGenio, onOpen }: Props) {
  const [showNudge, setShowNudge] = useState(false);

  useEffect(() => {
    if (hasCompletedGenio) return;
    if (localStorage.getItem("qc_genio_nudge_shown")) return;
    const timer = setTimeout(() => setShowNudge(true), 8_000);
    return () => clearTimeout(timer);
  }, [hasCompletedGenio]);

  const dismiss = () => {
    setShowNudge(false);
    localStorage.setItem("qc_genio_nudge_shown", "1");
  };

  return (
    <div style={{ position: "relative" }}>
      {showNudge && (
        <div className="font-[family-name:var(--font-dm)]" style={{ position: "absolute", bottom: "100%", right: 0, marginBottom: 16, background: "#FFF7E8", color: "#0e0e0e", fontSize: "14px", fontWeight: 600, padding: "8px 36px 8px 14px", borderRadius: 10, whiteSpace: "nowrap", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", animation: "fadeToast 0.3s ease-out" }}>
          Ordeno la carta especialmente para ti
          <button
            onClick={(e) => { e.stopPropagation(); dismiss(); }}
            style={{ position: "absolute", top: 4, right: 6, background: "none", border: "none", cursor: "pointer", padding: 4, lineHeight: 1, fontSize: "16px", color: "#999" }}
          >
            ✕
          </button>
          <div style={{ position: "absolute", bottom: -6, right: 20, width: 12, height: 12, background: "#FFF7E8", transform: "rotate(45deg)" }} />
        </div>
      )}
      <button
        onClick={() => { dismiss(); onOpen(); }}
        className="flex items-center justify-center rounded-full active:scale-95"
        style={{ height: 52, width: 52, background: "#F4A623", boxShadow: showNudge ? "0 0 0 4px rgba(244,166,35,0.3), 0 4px 18px rgba(244,166,35,0.35)" : "0 4px 18px rgba(244,166,35,0.35)", borderRadius: 50, transition: "all 0.3s ease", position: "relative" }}
      >
        <span style={{ fontSize: "22px", lineHeight: 1, flexShrink: 0, animation: showNudge ? "genioNudgePulse 1s ease-in-out infinite" : "genioFabFloat 1.5s ease-in-out infinite" }}>🧞</span>
        {hasCompletedGenio && <span style={{ position: "absolute", top: 2, right: 2, width: 16, height: 16, borderRadius: "50%", background: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", lineHeight: 1, color: "white", fontWeight: 700 }}>✓</span>}
      </button>
    </div>
  );
}
