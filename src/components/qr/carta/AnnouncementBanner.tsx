"use client";

import { useState, useEffect, useRef } from "react";

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
}

/** Returns true when the accent color is light enough to need dark text. */
function isLightColor(el: HTMLElement): boolean {
  const accent = getComputedStyle(el).getPropertyValue("--carta-accent").trim();
  if (!accent) return false;
  // Parse hex
  const hex = accent.replace("#", "");
  if (hex.length < 6) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  // Relative luminance
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6;
}

export default function AnnouncementBanner({ announcements, variant = "solid" }: Props) {
  const [current, setCurrent] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [darkText, setDarkText] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (announcements.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % announcements.length);
      setExpanded(false);
    }, 7000);
    return () => clearInterval(timer);
  }, [announcements.length]);

  // Detect if accent color is light → use dark text
  useEffect(() => {
    if (variant === "glass" || !ref.current) return;
    setDarkText(isLightColor(ref.current));
  }, [variant]);

  if (announcements.length === 0) return null;

  const ann = announcements[current];
  const needsClamp = ann.text.length > 90;
  const isGlass = variant === "glass";

  const textColor = isGlass ? "#fff" : darkText ? "#1a1a1a" : "#fff";
  const subtleColor = isGlass ? "rgba(255,255,255,0.6)" : darkText ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.7)";

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
      <div style={{ padding: "calc(8px + env(safe-area-inset-top)) 12px 0", position: "relative", zIndex: 15 }}>
        <div style={{
          borderRadius: 16,
          border: "1px solid color-mix(in srgb, var(--carta-accent, #F4A623) 55%, transparent)",
          background: "rgba(8,8,8,0.28)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          overflow: "hidden",
          padding: "13px 16px",
          textAlign: "center",
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
      </div>
    );
  }

  // ── Solid variant — full-width ribbon ──
  return (
    <div ref={ref} style={{
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
