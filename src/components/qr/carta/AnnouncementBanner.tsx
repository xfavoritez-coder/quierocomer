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

  const inner = (
    <p
      className="font-[family-name:var(--font-dm)]"
      style={{
        margin: 0,
        fontSize: "0.95rem",
        fontWeight: 700,
        color: "#fff",
        textAlign: "center",
        lineHeight: 1.45,
        letterSpacing: "0.01em",
        textShadow: "0 0 12px rgba(255,255,255,0.45), 0 0 28px var(--carta-accent, #F4A623)",
      }}
    >
      {ann.text}
    </p>
  );

  return (
    <div style={{ padding: "12px 12px 0", position: "relative", zIndex: 15 }}>
      <style>{`
        @keyframes annAtmo {
          0%, 100% { opacity: 0.22; transform: scale(1); }
          50%       { opacity: 0.42; transform: scale(1.04); }
        }
        @keyframes annBorder {
          0%, 100% { box-shadow: 0 0 6px var(--carta-accent,#F4A623), 0 0 18px var(--carta-accent,#F4A623), inset 0 0 22px rgba(0,0,0,0.65); }
          50%       { box-shadow: 0 0 12px var(--carta-accent,#F4A623), 0 0 32px var(--carta-accent,#F4A623), inset 0 0 22px rgba(0,0,0,0.65); }
        }
      `}</style>

      <div style={{ position: "relative" }}>
        {/* Atmospheric glow behind card */}
        <div style={{
          position: "absolute",
          inset: 2,
          background: "var(--carta-accent, #F4A623)",
          borderRadius: 22,
          filter: "blur(22px)",
          animation: "annAtmo 3s ease-in-out infinite",
          pointerEvents: "none",
          zIndex: 0,
        }} />

        {/* Card */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            background: "linear-gradient(145deg, rgba(10,8,16,0.97) 0%, rgba(18,12,24,0.95) 100%)",
            border: "1.5px solid var(--carta-accent, #F4A623)",
            borderRadius: 20,
            animation: "annBorder 3s ease-in-out infinite",
            overflow: "hidden",
          }}
        >
          {ann.linkUrl ? (
            <a
              href={ann.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "none", display: "block", padding: "18px 48px 18px 20px" }}
            >
              {inner}
            </a>
          ) : (
            <div style={{ padding: "18px 48px 18px 20px" }}>
              {inner}
            </div>
          )}

          <button
            onClick={() => setDismissed(true)}
            style={{
              position: "absolute", top: "50%", right: 12,
              transform: "translateY(-50%)",
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "50%", width: 26, height: 26,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", padding: 0,
            }}
          >
            <X size={13} color="rgba(255,255,255,0.5)" />
          </button>

          {announcements.length > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 5, paddingBottom: 14 }}>
              {announcements.map((_, i) => (
                <div key={i} style={{
                  width: i === current ? 16 : 5, height: 5, borderRadius: 3,
                  background: i === current ? "var(--carta-accent, #F4A623)" : "rgba(255,255,255,0.15)",
                  boxShadow: i === current ? "0 0 6px var(--carta-accent, #F4A623)" : "none",
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
