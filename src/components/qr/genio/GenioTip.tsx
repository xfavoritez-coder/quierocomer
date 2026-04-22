"use client";

import { Sparkles } from "lucide-react";

/**
 * GenioTip — shared "Tip del Genio" card used for tooltips and contextual tips.
 *
 * Single source of truth for the warm/cream tip design across the app.
 * Change styles here to update every tip instance.
 */

/* ── Design tokens ── */
export const TIP_BG = "#FFF4E6";
export const TIP_SHADOW = "0 8px 30px rgba(180,130,50,0.18)";
export const TIP_BADGE_BG = "#D4A574";
export const TIP_TEXT_COLOR = "#5c3d1e";
export const TIP_CLOSE_COLOR = "#c4a882";
export const TIP_RADIUS = 16;

/* ── CSS animations (inject once) ── */
export const TIP_CSS = `
  @keyframes genioTipIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes genioTipBounce {
    0%, 100% { transform: translateY(0); }
    40% { transform: translateY(-6px); }
    60% { transform: translateY(-3px); }
  }
`;

/* ── Arrow component ── */
export function TipArrow({ position = "bottom-right" }: { position?: "bottom-right" | "bottom-center" | "top-center" | "right" }) {
  const base = { width: 12, height: 12, background: TIP_BG, position: "absolute" as const, transform: "rotate(45deg)" };
  if (position === "bottom-right") return <div style={{ ...base, bottom: -6, right: 20, boxShadow: "3px 3px 6px rgba(180,130,50,0.1)" }} />;
  if (position === "bottom-center") return <div style={{ ...base, bottom: -6, left: "50%", marginLeft: -6, boxShadow: "3px 3px 6px rgba(180,130,50,0.1)" }} />;
  if (position === "right") return <div style={{ ...base, right: -6, top: "50%", marginTop: -6, boxShadow: "3px -2px 6px rgba(180,130,50,0.08)" }} />;
  // top-center
  return <div style={{ ...base, top: -6, left: "50%", marginLeft: -6, boxShadow: "-2px -2px 6px rgba(180,130,50,0.08)" }} />;
}

/* ── Badge component ── */
export function TipBadge({ label = "Tip del Genio" }: { label?: string }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: TIP_BADGE_BG, borderRadius: 50,
      padding: "4px 10px 4px 8px", marginBottom: 10,
    }}>
      <Sparkles size={13} color="white" fill="white" />
      <span style={{ color: "white", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</span>
    </div>
  );
}

/* ── Close button ── */
export function TipClose({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Cerrar consejo"
      style={{
        position: "absolute", top: 8, right: 10,
        background: "none", border: "none", cursor: "pointer",
        color: TIP_CLOSE_COLOR, fontSize: "14px", lineHeight: 1, padding: 2,
      }}
    >
      ✕
    </button>
  );
}

/* ── Main card wrapper ── */
interface GenioTipProps {
  children: React.ReactNode;
  id?: string;
  style?: React.CSSProperties;
  arrow?: "bottom-right" | "bottom-center" | "top-center" | "right" | null;
  onClose?: () => void;
  badgeLabel?: string;
}

export default function GenioTip({ children, id, style, arrow = "bottom-right", onClose, badgeLabel }: GenioTipProps) {
  return (
    <>
      <style>{TIP_CSS}</style>
      <div
        id={id}
        role="status"
        className="font-[family-name:var(--font-dm)]"
        style={{
          background: TIP_BG,
          borderRadius: TIP_RADIUS,
          padding: "16px 16px 14px",
          boxShadow: TIP_SHADOW,
          animation: "genioTipIn 0.3s cubic-bezier(0.16,1,0.3,1)",
          position: "relative",
          ...style,
        }}
      >
        {onClose && <TipClose onClick={onClose} />}
        <div style={{ color: TIP_TEXT_COLOR, fontSize: "14px", lineHeight: 1.5, fontWeight: 400 }}>
          {children}
        </div>
        {arrow && <TipArrow position={arrow} />}
      </div>
    </>
  );
}
