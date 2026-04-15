"use client";

export default function HighlightText({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-display" style={{ background: "#FFD600", color: "#0D0D0D", padding: "2px 6px", borderRadius: 3, fontWeight: 700, display: "inline" }}>
      {children}
    </span>
  );
}
