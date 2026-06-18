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
          background: "#080808",
          overflow: "hidden",
        }}
      >
        {/* Content */}
        <div style={{ padding: "13px 40px 13px 16px", textAlign: "center" }}>
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

        {/* Close */}
        <button
          onClick={() => setDismissed(true)}
          style={{
            position: "absolute", top: "50%", right: 10,
            transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "50%", width: 24, height: 24,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", padding: 0,
          }}
        >
          <X size={12} color="rgba(255,255,255,0.5)" />
        </button>
      </div>
    </div>
  );
}
