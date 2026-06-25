"use client";

import { useState, useEffect } from "react";

interface Announcement {
  id: string;
  text: string;
  linkUrl: string | null;
}

interface Props {
  announcements: Announcement[];
  /** "solid" = full-width ribbon with accent color (lista/premium/feed).
   *  "glass" = original dark blur card (impact view). */
  variant?: "solid" | "glass";
  /** Hex accent color — used to determine text contrast. */
  accentColor?: string | null;
}

/** Returns true when the color is light enough to need dark text. */
function isLight(hex: string | null | undefined): boolean {
  if (!hex) return false;
  const h = hex.replace("#", "");
  if (h.length < 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
}

export default function AnnouncementBanner({ announcements, variant = "solid", accentColor }: Props) {
  const [current, setCurrent] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (announcements.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % announcements.length);
      setExpanded(false);
    }, 7000);
    return () => clearInterval(timer);
  }, [announcements.length]);

  if (announcements.length === 0) return null;

  const ann = announcements[current];
  const needsClamp = ann.text.length > 90;
  const isGlass = variant === "glass";
  const darkText = !isGlass && isLight(accentColor);

  const textColor = isGlass ? "#fff" : darkText ? "#1a1a1a" : "#fff";
  const subtleColor = isGlass ? "rgba(255,255,255,0.6)" : darkText ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.7)";

  const textNode = (
    <span
      className="font-[family-name:var(--font-dm)]"
      style={{
        display: "-webkit-box",
        WebkitBoxOrient: "vertical" as any,
        WebkitLineClamp: expanded ? "unset" : 2,
        overflow: "hidden",
        fontSize: "0.82rem",
        fontWeight: 600,
        color: textColor,
        lineHeight: 1.45,
        textAlign: "center" as const,
        letterSpacing: "-0.01em",
      }}
    >
      {ann.text}
    </span>
  );

  // ── Glass variant (Impact view — unchanged) ──
  if (isGlass) {
    return (
      <div style={{
        borderRadius: 20,
        border: "1px solid color-mix(in srgb, var(--carta-accent, #F4A623) 60%, transparent)",
        background: "rgba(8,8,8,0.32)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        overflow: "hidden",
        padding: "12px 16px",
        textAlign: "center",
        boxShadow: "0 0 12px color-mix(in srgb, var(--carta-accent, #F4A623) 25%, transparent), inset 0 0 12px rgba(255,255,255,0.03)",
      }}>
          {ann.linkUrl && !needsClamp ? (
            <a href={ann.linkUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "block" }}>
              {textNode}
            </a>
          ) : textNode}

          {needsClamp && (
            <button onClick={() => setExpanded(e => !e)} style={{
              background: "none", border: "none", cursor: "pointer", padding: "2px 0 0",
              fontSize: "0.72rem", fontWeight: 700, color: "var(--carta-accent, #F4A623)",
              display: "block", margin: "0 auto",
            }}>
              {expanded ? "Ver menos ▲" : "Ver más ▼"}
            </button>
          )}

          {announcements.length > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 4, marginTop: 6 }}>
              {announcements.map((_, i) => (
                <div key={i} style={{
                  width: i === current ? 14 : 4, height: 4, borderRadius: 2,
                  background: i === current ? "var(--carta-accent, #F4A623)" : "rgba(255,255,255,0.2)",
                  transition: "all 0.3s ease",
                }} />
              ))}
            </div>
          )}
      </div>
    );
  }

  // ── Solid variant — full-width ribbon ──
  return (
    <div style={{
      background: "var(--carta-accent, #F4A623)",
      padding: "9px 20px",
      textAlign: "center",
      position: "relative",
      zIndex: 15,
    }}>
      {ann.linkUrl && !needsClamp ? (
        <a href={ann.linkUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "block" }}>
          {textNode}
        </a>
      ) : textNode}

      {needsClamp && (
        <button onClick={() => setExpanded(e => !e)} style={{
          background: "none", border: "none", cursor: "pointer", padding: "3px 0 0",
          fontSize: "0.7rem", fontWeight: 700, color: subtleColor,
          display: "block", margin: "0 auto",
        }}>
          {expanded ? "Ver menos ▲" : "Ver más ▼"}
        </button>
      )}

      {announcements.length > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 4, marginTop: 5 }}>
          {announcements.map((_, i) => (
            <div key={i} style={{
              width: i === current ? 14 : 4, height: 4, borderRadius: 2,
              background: i === current ? (darkText ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.9)") : (darkText ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.3)"),
              transition: "all 0.3s ease",
            }} />
          ))}
        </div>
      )}
    </div>
  );
}
