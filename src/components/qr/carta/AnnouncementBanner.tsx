"use client";

import { useState, useEffect } from "react";

interface Announcement {
  id: string;
  text: string;
  linkUrl: string | null;
}

interface Props {
  announcements: Announcement[];
  /** "solid" uses the accent color as background (for lista/premium/feed views).
   *  "glass" uses the original dark blur style (for impact view). */
  variant?: "solid" | "glass";
}

const LINE_CLAMP = 2;

export default function AnnouncementBanner({ announcements, variant = "solid" }: Props) {
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

  const textNode = (
    <span
      className="font-[family-name:var(--font-dm)]"
      style={{
        display: "-webkit-box",
        WebkitBoxOrient: "vertical" as any,
        WebkitLineClamp: expanded ? "unset" : LINE_CLAMP,
        overflow: "hidden",
        fontSize: isGlass ? "0.88rem" : "0.82rem",
        fontWeight: 600,
        color: isGlass ? "#fff" : "var(--carta-announcement-text, #fff)",
        lineHeight: 1.45,
        textAlign: "center" as const,
        letterSpacing: "-0.01em",
      }}
    >
      {ann.text}
    </span>
  );

  const containerStyle: React.CSSProperties = isGlass
    ? {
        borderRadius: 16,
        border: "1px solid color-mix(in srgb, var(--carta-accent, #F4A623) 55%, transparent)",
        background: "rgba(8,8,8,0.28)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        overflow: "hidden",
      }
    : {
        borderRadius: 10,
        background: "var(--carta-accent, #F4A623)",
        overflow: "hidden",
      };

  const dotActiveColor = isGlass ? "var(--carta-accent, #F4A623)" : "rgba(255,255,255,0.95)";
  const dotInactiveColor = isGlass ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.35)";
  const moreColor = isGlass ? "var(--carta-accent, #F4A623)" : "rgba(255,255,255,0.8)";

  return (
    <div style={{ padding: isGlass ? "calc(8px + env(safe-area-inset-top)) 12px 0" : "8px 14px 0", position: "relative", zIndex: 15 }}>
      <div style={containerStyle}>
        <div style={{ padding: isGlass ? "13px 16px" : "10px 16px", textAlign: "center" }}>
          {ann.linkUrl && !needsClamp ? (
            <a href={ann.linkUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "block" }}>
              {textNode}
            </a>
          ) : (
            textNode
          )}

          {needsClamp && (
            <button
              onClick={() => setExpanded(e => !e)}
              style={{
                background: "none", border: "none", cursor: "pointer", padding: "2px 0 0",
                fontSize: "0.72rem", fontWeight: 700,
                color: moreColor,
                display: "block", margin: "0 auto",
              }}
            >
              {expanded ? "Ver menos ▲" : "Ver más ▼"}
            </button>
          )}

          {announcements.length > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 4, marginTop: 6 }}>
              {announcements.map((_, i) => (
                <div key={i} style={{
                  width: i === current ? 14 : 4, height: 4, borderRadius: 2,
                  background: i === current ? dotActiveColor : dotInactiveColor,
                  transition: "all 0.3s ease",
                }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
