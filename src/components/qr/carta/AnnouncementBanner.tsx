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

  // Auto-rotate if multiple
  useEffect(() => {
    if (announcements.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % announcements.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [announcements.length]);

  if (dismissed || announcements.length === 0) return null;

  const ann = announcements[current];

  const inner = (
    <p
      className="font-[family-name:var(--font-dm)]"
      style={{
        margin: 0,
        fontSize: "0.85rem",
        fontWeight: 600,
        color: "rgba(255,255,255,0.92)",
        textAlign: "center",
        lineHeight: 1.4,
      }}
    >
      {ann.text}
    </p>
  );

  return (
    <div style={{ padding: "12px 12px 0", position: "relative", zIndex: 15 }}>
      <style>{`
        @keyframes annNeonPulse {
          0%, 100% { box-shadow: 0 0 6px var(--carta-accent, #F4A623), 0 0 18px var(--carta-accent, #F4A623); opacity: 0.85; }
          50%       { box-shadow: 0 0 12px var(--carta-accent, #F4A623), 0 0 28px var(--carta-accent, #F4A623); opacity: 1; }
        }
      `}</style>

      <div
        style={{
          background: "rgba(10,10,12,0.92)",
          border: "1.5px solid var(--carta-accent, #F4A623)",
          borderRadius: 16,
          animation: "annNeonPulse 3s ease-in-out infinite",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {ann.linkUrl ? (
          <a
            href={ann.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "none", display: "block", padding: "14px 40px 14px 16px" }}
          >
            {inner}
          </a>
        ) : (
          <div style={{ padding: "14px 40px 14px 16px" }}>
            {inner}
          </div>
        )}

        {/* Dismiss button */}
        <button
          onClick={() => setDismissed(true)}
          style={{
            position: "absolute",
            top: "50%",
            right: 10,
            transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.08)",
            border: "none",
            borderRadius: "50%",
            width: 22,
            height: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
            zIndex: 2,
          }}
        >
          <X size={12} color="rgba(255,255,255,0.6)" />
        </button>

        {/* Dots indicator */}
        {announcements.length > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 4, paddingBottom: 10 }}>
            {announcements.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === current ? 12 : 4,
                  height: 4,
                  borderRadius: 2,
                  background: i === current ? "var(--carta-accent, #F4A623)" : "rgba(255,255,255,0.2)",
                  transition: "all 0.3s ease",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
