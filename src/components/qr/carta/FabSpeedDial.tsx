"use client";

import { useState, useEffect, useRef } from "react";

interface Props {
  /** Secondary buttons that expand upward (GenioFab, WaiterButton, ViewSelector) */
  children: React.ReactNode[];
}

/**
 * Speed dial FAB: shows a main lamp button. On tap, expands
 * secondary buttons upward with staggered animation.
 * Tap again or outside to close.
 */
export default function FabSpeedDial({ children }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside tap
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    document.addEventListener("touchstart", handle);
    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("touchstart", handle);
    };
  }, [open]);

  const items = children.filter(Boolean);

  return (
    <div ref={ref} className="fixed z-50 flex flex-col items-center" style={{ right: 14, bottom: "calc(16px + env(safe-area-inset-bottom))", gap: 10 }}>
      {/* Secondary buttons — expand upward */}
      {items.map((child, i) => (
        <div
          key={i}
          style={{
            opacity: open ? 1 : 0,
            transform: open ? "translateY(0) scale(1)" : "translateY(20px) scale(0.5)",
            transition: `all 0.25s cubic-bezier(0.16,1,0.3,1) ${open ? i * 60 : 0}ms`,
            pointerEvents: open ? "auto" : "none",
          }}
        >
          {child}
        </div>
      ))}

      {/* Main trigger button — lamp icon */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center rounded-full genio-fab-btn"
        style={{
          width: 62, height: 62, borderRadius: 50,
          transition: "all 0.3s cubic-bezier(0.16,1,0.3,1)",
          position: "relative",
        }}
      >
        <img
          src="/genio-lamp.png"
          alt="Menú"
          className="genio-lamp-icon"
          style={{
            width: 32, height: 32, objectFit: "contain",
            transition: "transform 0.3s cubic-bezier(0.16,1,0.3,1)",
            transform: open ? "rotate(90deg) scale(0.85)" : "rotate(0deg) scale(1)",
          }}
        />
      </button>

      {/* Backdrop when open */}
      {open && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: -1,
            background: "rgba(0,0,0,0.15)",
            transition: "opacity 0.2s ease",
          }}
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}
