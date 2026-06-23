"use client";

import { useState, useEffect } from "react";

interface Announcement {
  id: string;
  text: string;
  linkUrl: string | null;
}

interface Props {
  announcements: Announcement[];
}

const LINE_CLAMP = 2;

export default function AnnouncementBanner({ announcements }: Props) {
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
  // Estimate if text needs clamping: ~45 chars per line at this font size
  const needsClamp = ann.text.length > 90;

  const textNode = (
    <span
      className="font-[family-name:var(--font-dm)]"
      style={{
        display: "-webkit-box",
        WebkitBoxOrient: "vertical" as any,
        WebkitLineClamp: expanded ? "unset" : LINE_CLAMP,
        overflow: "hidden",
        fontSize: "0.88rem",
        fontWeight: 700,
        color: "#fff",
        lineHeight: 1.4,
        textAlign: "center",
      }}
    >
      {ann.text}
    </span>
  );

  return (
    <div style={{ padding: "calc(8px + env(safe-area-inset-top)) 12px 0", position: "relative", zIndex: 15 }}>
      <div
        style={{
          position: "relative",
          borderRadius: 16,
          border: "1px solid color-mix(in srgb, var(--carta-accent, #F4A623) 55%, transparent)",
          background: "rgba(8,8,8,0.28)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "13px 16px", textAlign: "center" }}>
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
                fontSize: "0.75rem", fontWeight: 700,
                color: "var(--carta-accent, #F4A623)",
                display: "block", margin: "0 auto",
              }}
            >
              {expanded ? "Ver menos ▲" : "Ver más ▼"}
            </button>
          )}

          {announcements.length > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 4, marginTop: 8 }}>
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
    </div>
  );
}
