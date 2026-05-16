"use client";

import { useState, useEffect } from "react";

interface Props {
  restaurantName: string;
}

/**
 * Educational banner shown to demo restaurant owners after 2+ minutes.
 * Explains the birthday capture feature without actually collecting data.
 */
export default function DemoBirthdayBanner({ restaurantName }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Don't show if onboarding is still active
    if (document.body.hasAttribute("data-demo-onboarding")) return;

    // Show after 2 minutes
    const timer = setTimeout(() => {
      // Double-check onboarding isn't active
      if (document.body.hasAttribute("data-demo-onboarding")) return;
      if (sessionStorage.getItem("qc_demo_bday_banner_shown")) return;
      setShow(true);
      sessionStorage.setItem("qc_demo_bday_banner_shown", "1");
    }, 120_000);

    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 90,
        left: 16,
        right: 16,
        zIndex: 55,
        maxWidth: 340,
        margin: "0 auto",
        background: "rgba(14,14,14,0.96)",
        border: "1px solid rgba(255,178,45,0.15)",
        borderRadius: 16,
        padding: "16px 18px",
        boxShadow: "0 12px 36px rgba(0,0,0,0.5)",
        animation: "demoBdaySlideIn 0.4s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span style={{ fontSize: 28, flexShrink: 0 }}>🎂</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4 style={{
            fontFamily: "var(--font-dm, sans-serif)",
            fontSize: "0.85rem",
            fontWeight: 800,
            color: "#fff",
            margin: "0 0 4px",
          }}>
            Capturamos cumpleaños
          </h4>
          <p style={{
            fontFamily: "var(--font-dm, sans-serif)",
            fontSize: "0.76rem",
            color: "rgba(255,255,255,0.5)",
            lineHeight: 1.45,
            margin: 0,
          }}>
            Le pedimos su fecha a cada cliente y tú les envías un regalo para que vuelvan. Más visitas, más ventas.
          </p>
        </div>
      </div>
      <button
        onClick={() => setShow(false)}
        style={{
          display: "block",
          width: "100%",
          marginTop: 12,
          padding: "8px 16px",
          borderRadius: 999,
          background: "rgba(255,178,45,0.08)",
          border: "1px solid rgba(255,178,45,0.18)",
          color: "#ffb22d",
          fontSize: "0.76rem",
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "var(--font-dm, sans-serif)",
        }}
      >
        Entendido
      </button>
      <style>{`
        @keyframes demoBdaySlideIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
