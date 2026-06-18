"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface Announcement {
  id: string;
  text: string;
  linkUrl: string | null;
}

interface Props {
  announcements: Announcement[];
}

export default function AnnouncementBanner({ announcements }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (announcements.length <= 1) return;
    const timer = setInterval(() => setCurrent((c) => (c + 1) % announcements.length), 5000);
    return () => clearInterval(timer);
  }, [announcements.length]);

  if (dismissed || announcements.length === 0) return null;

  const ann = announcements[current];

  const textContent = (
    <span
      className="font-[family-name:var(--font-dm)]"
      style={{
        display: "block",
        fontSize: "0.92rem",
        fontWeight: 750,
        color: "#fff",
        lineHeight: 1.35,
        letterSpacing: "0.01em",
      }}
    >
      {ann.text}
    </span>
  );

  return (
    <div style={{ padding: "12px 12px 0", position: "relative", zIndex: 15 }}>
      <div
        className="font-[family-name:var(--font-dm)]"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 14px",
          border: "1px solid color-mix(in srgb, var(--carta-accent, #F4A623) 65%, transparent)",
          borderRadius: 18,
          background: `
            radial-gradient(circle at left, color-mix(in srgb, var(--carta-accent, #F4A623) 18%, transparent), transparent 40%),
            linear-gradient(135deg, #15100b, #080808)
          `,
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          position: "relative",
        }}
      >
        {/* Icon */}
        <div style={{
          width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
          background: "color-mix(in srgb, var(--carta-accent, #F4A623) 14%, transparent)",
          display: "grid", placeItems: "center",
          fontSize: "1.2rem",
        }}>
          📢
        </div>

        {/* Copy */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {ann.linkUrl ? (
            <a
              href={ann.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "none", display: "block" }}
            >
              {textContent}
            </a>
          ) : (
            textContent
          )}

          {announcements.length > 1 && (
            <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
              {announcements.map((_, i) => (
                <div key={i} style={{
                  width: i === current ? 14 : 4, height: 4, borderRadius: 2,
                  background: i === current ? "var(--carta-accent, #F4A623)" : "rgba(255,255,255,0.18)",
                  transition: "all 0.3s ease",
                }} />
              ))}
            </div>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={() => setDismissed(true)}
          style={{
            flexShrink: 0,
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "50%", width: 26, height: 26,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", padding: 0,
          }}
        >
          <X size={13} color="rgba(255,255,255,0.5)" />
        </button>
      </div>
    </div>
  );
}
