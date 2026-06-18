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
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % announcements.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [announcements.length]);

  if (dismissed || announcements.length === 0) return null;

  const ann = announcements[current];
  const accent = "var(--carta-accent, #F4A623)";

  const inner = (
    <p
      className="font-[family-name:var(--font-dm)]"
      style={{
        margin: 0,
        fontSize: "0.9rem",
        fontWeight: 600,
        color: "rgba(255,255,255,0.95)",
        textAlign: "center",
        lineHeight: 1.45,
        letterSpacing: "0.01em",
      }}
    >
      {ann.text}
    </p>
  );

  return (
    <div style={{ padding: "14px 14px 2px", position: "relative", zIndex: 15 }}>
      <style>{`
        @keyframes annGlow {
          0%, 100% { box-shadow: 0 0 10px ${accent}, 0 0 24px ${accent}55, inset 0 0 12px ${accent}18; }
          50%       { box-shadow: 0 0 16px ${accent}, 0 0 36px ${accent}70, inset 0 0 18px ${accent}28; }
        }
      `}</style>

      <div
        style={{
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: `2px solid ${accent}`,
          borderRadius: 22,
          animation: "annGlow 3.5s ease-in-out infinite",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {ann.linkUrl ? (
          <a
            href={ann.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "none", display: "block", padding: "16px 44px 16px 20px" }}
          >
            {inner}
          </a>
        ) : (
          <div style={{ padding: "16px 44px 16px 20px" }}>
            {inner}
          </div>
        )}

        <button
          onClick={() => setDismissed(true)}
          style={{
            position: "absolute",
            top: "50%",
            right: 12,
            transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.1)",
            border: "none",
            borderRadius: "50%",
            width: 24,
            height: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <X size={13} color="rgba(255,255,255,0.55)" />
        </button>

        {announcements.length > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 5, paddingBottom: 12 }}>
            {announcements.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === current ? 14 : 5,
                  height: 5,
                  borderRadius: 3,
                  background: i === current ? accent : "rgba(255,255,255,0.2)",
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
