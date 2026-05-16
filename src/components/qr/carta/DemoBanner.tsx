"use client";

import { useState } from "react";

interface Props {
  restaurantName: string;
  restaurantSlug: string;
  /** "carta" shows "Ver mi panel", "panel" shows "Ver mi carta" */
  context: "carta" | "panel";
  onActivate?: () => void;
}

/**
 * Slim banner for demo restaurants. Always visible at the top.
 * Shows in both carta and panel views when restaurant.isDemo is true.
 */
export default function DemoBanner({ restaurantName, restaurantSlug, context, onActivate }: Props) {
  return (
    <div
      className="font-[family-name:var(--font-dm)]"
      style={{
        position: "sticky", top: 0, zIndex: 60,
        background: "linear-gradient(135deg, #F4A623, #e8913a)",
        padding: "8px 14px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#0e0e0e", opacity: 0.5 }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: "#0e0e0e", letterSpacing: "0.05em" }}>
          DEMO
        </span>
        <span style={{ fontSize: 11, color: "rgba(14,14,14,0.6)" }}>·</span>
        <span style={{ fontSize: 11, color: "rgba(14,14,14,0.7)" }}>
          {restaurantName}
        </span>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {context === "carta" ? (
          <a
            href={`/panel?slug=${restaurantSlug}`}
            style={{
              fontSize: 10, fontWeight: 700, color: "#0e0e0e",
              background: "rgba(0,0,0,0.1)", border: "none", borderRadius: 50,
              padding: "5px 12px", cursor: "pointer", textDecoration: "none",
            }}
          >Ver mi panel</a>
        ) : (
          <a
            href={`/qr/${restaurantSlug}`}
            style={{
              fontSize: 10, fontWeight: 700, color: "#0e0e0e",
              background: "rgba(0,0,0,0.1)", border: "none", borderRadius: 50,
              padding: "5px 12px", cursor: "pointer", textDecoration: "none",
            }}
          >Ver mi carta</a>
        )}
        <button
          onClick={onActivate}
          style={{
            fontSize: 10, fontWeight: 800, color: "white",
            background: "#0e0e0e", border: "none", borderRadius: 50,
            padding: "5px 14px", cursor: "pointer",
          }}
        >Activar carta →</button>
      </div>
    </div>
  );
}
