"use client";

import { useState, useEffect } from "react";

interface Props {
  hasCompletedGenio: boolean;
  onOpen: () => void;
  spicyReordered?: boolean;
  redundantDiet?: "redundant-vegan" | "redundant-vegetarian" | null;
  restaurantName?: string;
}

/**
 * Genio floating action button with first-visit nudge tooltip.
 * Shows "Ordeno la carta especialmente para ti" on first visit until dismissed.
 * Also shows spicy-reordered toast when applicable.
 */
export default function GenioFab({ hasCompletedGenio, onOpen, spicyReordered, redundantDiet, restaurantName }: Props) {
  const [showNudge, setShowNudge] = useState(false);
  const [showSpicy, setShowSpicy] = useState(false);
  const [showRedundant, setShowRedundant] = useState(false);

  useEffect(() => {
    if (hasCompletedGenio) return;
    if (localStorage.getItem("qc_genio_nudge_shown")) return;
    const timer = setTimeout(() => setShowNudge(true), 8_000);
    return () => clearTimeout(timer);
  }, [hasCompletedGenio]);

  useEffect(() => {
    if (!spicyReordered || !hasCompletedGenio) return;
    if (sessionStorage.getItem("qc_spicy_toast_dismissed") === "1") return;
    const timer = setTimeout(() => setShowSpicy(true), 1_500);
    return () => clearTimeout(timer);
  }, [spicyReordered, hasCompletedGenio]);

  useEffect(() => {
    if (!redundantDiet || !hasCompletedGenio) return;
    if (sessionStorage.getItem("qc_redundant_toast_dismissed") === "1") return;
    const timer = setTimeout(() => setShowRedundant(true), 1_500);
    return () => clearTimeout(timer);
  }, [redundantDiet, hasCompletedGenio]);

  // Re-show toast when Genio closes with new restrictions
  useEffect(() => {
    const onGenioClose = () => {
      sessionStorage.removeItem("qc_spicy_toast_dismissed");
      // Re-check spicy after a tick (localStorage updated by Genio)
      setTimeout(() => {
        try {
          const restrictions = JSON.parse(localStorage.getItem("qr_restrictions") || "[]");
          if (restrictions.includes("_spicy")) {
            setShowSpicy(true);
          }
        } catch {}
      }, 500);
    };
    window.addEventListener("genio-closed", onGenioClose);
    return () => window.removeEventListener("genio-closed", onGenioClose);
  }, []);

  const dismiss = () => {
    setShowNudge(false);
    setShowSpicy(false);
    setShowRedundant(false);
    localStorage.setItem("qc_genio_nudge_shown", "1");
    if (spicyReordered) sessionStorage.setItem("qc_spicy_toast_dismissed", "1");
    if (redundantDiet) sessionStorage.setItem("qc_redundant_toast_dismissed", "1");
  };

  const toastVisible = showNudge || showSpicy || showRedundant;
  const name = restaurantName || "este local";
  const toastText = showRedundant
    ? redundantDiet === "redundant-vegan"
      ? `¡Aquí en ${name} todo el menú es vegano, disfruta! 🌿`
      : `¡Aquí en ${name} todo el menú es vegetariano, disfruta! 🥗`
    : showSpicy
      ? "Reordené la carta para ti: los picantes quedan al final 🌶️"
      : "Ordeno la carta especialmente para ti";

  return (
    <div style={{ position: "relative" }}>
      {toastVisible && (
        <div className="font-[family-name:var(--font-dm)]" style={{ position: "absolute", bottom: "100%", right: -6, marginBottom: 16, background: "#FFF7E8", color: "#0e0e0e", fontSize: "13px", fontWeight: 600, padding: "10px 33px 10px 27px", borderRadius: 12, width: 250, lineHeight: 1.4, boxShadow: "0 4px 16px rgba(0,0,0,0.18)", animation: "fadeToast 0.3s ease-out" }}>
          {toastText}
          <button
            onClick={(e) => { e.stopPropagation(); dismiss(); }}
            style={{ position: "absolute", top: 6, right: 6, background: "none", border: "none", cursor: "pointer", padding: 4, lineHeight: 1, fontSize: "14px", color: "#999" }}
          >
            ✕
          </button>
          <div style={{ position: "absolute", bottom: -6, right: 20, width: 12, height: 12, background: "#FFF7E8", transform: "rotate(45deg)" }} />
        </div>
      )}
      <button
        onClick={() => { dismiss(); onOpen(); }}
        className="flex items-center justify-center rounded-full active:scale-95 genio-fab-btn"
        style={{ height: 58, width: 58, borderRadius: 50, transition: "all 0.3s ease", position: "relative" }}
      >
        <img src="/genio-lamp.png" alt="Genio" className="genio-lamp-icon" style={{ width: 36, height: 36, objectFit: "contain" }} />
        {hasCompletedGenio && <span style={{ position: "absolute", top: 1, right: 1, width: 16, height: 16, borderRadius: "50%", background: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", lineHeight: 1, color: "white", fontWeight: 700 }}>✓</span>}
      </button>
    </div>
  );
}
