"use client";

import type { CSSProperties, ReactNode } from "react";

// Maquetas de dispositivo en CSS: el contenido real del local se renderiza adentro.

export function PhoneFrame({ children, width = 300, style }: { children: ReactNode; width?: number; style?: CSSProperties }) {
  const h = Math.round(width * 2.05);
  return (
    <div style={{ width, height: h, borderRadius: width * 0.16, padding: width * 0.035, background: "linear-gradient(145deg, #2b2b2e, #0c0c0d)", boxShadow: "0 0 0 1.5px #3a3a3d, 0 40px 90px -20px rgba(0,0,0,.55), inset 0 0 0 1px rgba(255,255,255,.06)", position: "relative", flexShrink: 0, ...style }}>
      <div style={{ width: "100%", height: "100%", borderRadius: width * 0.13, overflow: "hidden", background: "#fff", position: "relative" }}>
        {/* Dynamic Island */}
        <div style={{ position: "absolute", top: width * 0.03, left: "50%", transform: "translateX(-50%)", width: width * 0.3, height: width * 0.085, borderRadius: 99, background: "#000", zIndex: 5 }} />
        {children}
      </div>
    </div>
  );
}

export function LaptopFrame({ children, width = 760, style }: { children: ReactNode; width?: number; style?: CSSProperties }) {
  const screenH = Math.round(width * 0.62);
  return (
    <div style={{ width, flexShrink: 0, ...style }}>
      <div style={{ height: screenH, borderRadius: "16px 16px 0 0", padding: 12, background: "linear-gradient(180deg, #1d1d1f, #0a0a0b)", boxShadow: "0 0 0 1.5px #3a3a3d, 0 30px 80px -24px rgba(0,0,0,.6)" }}>
        <div style={{ width: "100%", height: "100%", borderRadius: 6, overflow: "hidden", background: "#fff", position: "relative" }}>{children}</div>
      </div>
      <div style={{ height: width * 0.028, margin: "0 -4%", borderRadius: "0 0 14px 14px", background: "linear-gradient(180deg, #d8d8dc, #9a9aa0)", boxShadow: "0 12px 30px -10px rgba(0,0,0,.45)", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "14%", height: "45%", borderRadius: "0 0 8px 8px", background: "rgba(0,0,0,.18)" }} />
      </div>
    </div>
  );
}

export function TabletFrame({ children, width = 820, style }: { children: ReactNode; width?: number; style?: CSSProperties }) {
  const h = Math.round(width * 0.72);
  return (
    <div style={{ width, height: h, borderRadius: width * 0.045, padding: width * 0.022, background: "linear-gradient(145deg, #2b2b2e, #0c0c0d)", boxShadow: "0 0 0 1.5px #3a3a3d, 0 40px 100px -24px rgba(0,0,0,.55)", flexShrink: 0, ...style }}>
      <div style={{ width: "100%", height: "100%", borderRadius: width * 0.025, overflow: "hidden", background: "#F5F4F1", position: "relative" }}>{children}</div>
    </div>
  );
}
