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
        position: "relative",
        margin: 0,
        fontSize: "0.82rem",
        fontWeight: 700,
        color: "white",
        textAlign: "center",
        lineHeight: 1.35,
        textShadow: "0 1px 3px rgba(0,0,0,0.15)",
      }}
    >
      {ann.text}
    </p>
  );

  return (
    <div
      style={{
        background: "var(--carta-accent, #F4A623)",
        position: "relative",
        zIndex: 15,
        overflow: "hidden",
      }}
    >
      {/* Animated shimmer */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.15) 50%, transparent 65%)",
        backgroundSize: "250% 100%",
        animation: "annShimmer 4s ease-in-out infinite",
      }} />
      <style>{`@keyframes annShimmer { 0%,100% { background-position: 250% 0 } 50% { background-position: -250% 0 } }`}</style>

      {ann.linkUrl ? (
        <a
          href={ann.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "none", display: "block", padding: "10px 36px 10px 16px", position: "relative" }}
        >
          {inner}
        </a>
      ) : (
        <div style={{ padding: "10px 36px 10px 16px", position: "relative" }}>
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
          background: "rgba(255,255,255,0.18)",
          backdropFilter: "blur(4px)",
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
        <X size={12} color="white" />
      </button>

      {/* Dots indicator */}
      {announcements.length > 1 && (
        <div style={{ position: "relative", display: "flex", justifyContent: "center", gap: 4, paddingBottom: 6 }}>
          {announcements.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === current ? 12 : 4,
                height: 4,
                borderRadius: 2,
                background: i === current ? "white" : "rgba(255,255,255,0.35)",
                transition: "all 0.3s ease",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
