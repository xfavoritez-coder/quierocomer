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
      sessionStorage.removeItem("qc_redundant_toast_dismissed");
      // Re-check after a tick (localStorage updated by Genio)
      setTimeout(() => {
        try {
          const restrictions = JSON.parse(localStorage.getItem("qr_restrictions") || "[]");
          if (restrictions.includes("_spicy")) {
            setShowSpicy(true);
          }
        } catch {}
        // Re-check redundant diet
        if (redundantDiet) {
          setShowRedundant(true);
        }
      }, 500);
    };
    window.addEventListener("genio-closed", onGenioClose);

    // Hide toast when speed dial opens
    const onDialToggle = (e: Event) => {
      if ((e as CustomEvent).detail?.open) {
        setShowNudge(false);
        setShowSpicy(false);
        setShowRedundant(false);
      }
    };
    window.addEventListener("fab-speed-dial-toggle", onDialToggle);

    return () => {
      window.removeEventListener("genio-closed", onGenioClose);
      window.removeEventListener("fab-speed-dial-toggle", onDialToggle);
    };
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

  // Render toast via portal-like approach at document level
  useEffect(() => {
    if (!toastVisible) {
      const existing = document.getElementById("genio-fab-toast");
      if (existing) existing.style.display = "none";
      return;
    }
    let container = document.getElementById("genio-fab-toast");
    if (!container) {
      container = document.createElement("div");
      container.id = "genio-fab-toast";
      document.body.appendChild(container);
    }
    container.style.display = "block";
    container.style.cssText = "position:fixed;bottom:calc(96px + env(safe-area-inset-bottom));right:14px;z-index:51;pointer-events:auto";
    container.innerHTML = `<div style="background:#FFF7E8;color:#0e0e0e;font-size:13px;font-weight:600;padding:10px 33px 10px 14px;border-radius:12px;white-space:nowrap;line-height:1.4;box-shadow:0 4px 16px rgba(0,0,0,0.18);position:relative;font-family:var(--font-dm),system-ui,sans-serif">
      ${toastText}
      <div style="position:absolute;bottom:-6px;right:20px;width:12px;height:12px;background:#FFF7E8;transform:rotate(45deg)"></div>
    </div>`;
    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = "✕";
    closeBtn.style.cssText = "position:absolute;top:6px;right:6px;background:none;border:none;cursor:pointer;padding:4px;line-height:1;font-size:14px;color:#999";
    closeBtn.onclick = () => dismiss();
    container.firstElementChild?.appendChild(closeBtn);
  }, [toastVisible, toastText]);

  // Cleanup on unmount
  useEffect(() => () => {
    const el = document.getElementById("genio-fab-toast");
    if (el) el.remove();
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => { dismiss(); onOpen(); window.dispatchEvent(new Event("fab-speed-dial-close")); }}
        className="flex items-center justify-center rounded-full active:scale-95 genio-fab-btn"
        style={{ height: 62, width: 62, borderRadius: 50, transition: "all 0.3s ease", position: "relative" }}
      >
        <span style={{ fontSize: 26, lineHeight: 1 }}>🧞</span>
        {hasCompletedGenio && <span style={{ position: "absolute", top: 1, right: 1, width: 16, height: 16, borderRadius: "50%", background: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", lineHeight: 1, color: "white", fontWeight: 700 }}>✓</span>}
      </button>
    </div>
  );
}
