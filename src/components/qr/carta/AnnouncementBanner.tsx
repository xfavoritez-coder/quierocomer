"use client";

import { useState, useEffect } from "react";
import { X, ExternalLink } from "lucide-react";

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

  const content = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 36px 10px 16px", minHeight: 40 }}>
      <p
        className="font-[family-name:var(--font-dm)]"
        style={{
          margin: 0,
          fontSize: "0.82rem",
          fontWeight: 600,
          color: "#713F12",
          textAlign: "center",
          lineHeight: 1.35,
        }}
      >
        {ann.text}
      </p>
      {ann.linkUrl && <ExternalLink size={13} color="#713F12" style={{ opacity: 0.5, flexShrink: 0 }} />}
    </div>
  );

  return (
    <div style={{ position: "relative", background: "#FEF9C3", overflow: "hidden" }}>
      {ann.linkUrl ? (
        <a href={ann.linkUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "block" }}>
          {content}
        </a>
      ) : (
        content
      )}

      {/* Dismiss button */}
      <button
        onClick={() => setDismissed(true)}
        style={{
          position: "absolute",
          top: "50%",
          right: 10,
          transform: "translateY(-50%)",
          background: "rgba(113,63,18,0.1)",
          border: "none",
          borderRadius: "50%",
          width: 22,
          height: 22,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <X size={12} color="#713F12" />
      </button>

      {/* Dots indicator */}
      {announcements.length > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 4, paddingBottom: 6 }}>
          {announcements.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === current ? 12 : 4,
                height: 4,
                borderRadius: 2,
                background: i === current ? "#713F12" : "rgba(113,63,18,0.25)",
                transition: "all 0.3s ease",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
