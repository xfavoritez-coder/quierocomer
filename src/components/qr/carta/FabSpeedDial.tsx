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
 * Hidden during demo onboarding — appears with bounce when onboarding ends.
 */
export default function FabSpeedDial({ children }: Props) {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [entering, setEntering] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Hide during demo onboarding, show with bounce when it ends
  useEffect(() => {
    // Check initial state
    if (document.body.hasAttribute("data-demo-onboarding")) setHidden(true);

    const obs = new MutationObserver(() => {
      const active = document.body.hasAttribute("data-demo-onboarding");
      if (active) { setHidden(true); setEntering(false); }
    });
    obs.observe(document.body, { attributes: true, attributeFilter: ["data-demo-onboarding"] });

    // Listen for show event (onboarding exit animation completed)
    const showFab = () => {
      setHidden(false);
      setEntering(true);
      setTimeout(() => setEntering(false), 500);
    };
    window.addEventListener("demo-onboarding-show-fab", showFab);

    return () => {
      obs.disconnect();
      window.removeEventListener("demo-onboarding-show-fab", showFab);
    };
  }, []);

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

  // Close when a child action triggers (genio opens, etc.)
  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener("fab-speed-dial-close", close);
    return () => window.removeEventListener("fab-speed-dial-close", close);
  }, []);

  // Open programmatically
  useEffect(() => {
    const openFab = () => {
      setOpen(true);
      window.dispatchEvent(new CustomEvent("fab-speed-dial-toggle", { detail: { open: true } }));
    };
    window.addEventListener("demo-onboarding-open-fab", openFab);
    return () => window.removeEventListener("demo-onboarding-open-fab", openFab);
  }, []);

  const items = children.filter(Boolean);

  if (hidden) return null;

  return (
    <div
      ref={ref}
      className="fixed flex flex-col items-center"
      style={{
        right: 14,
        bottom: "calc(16px + env(safe-area-inset-bottom))",
        gap: 10,
        zIndex: 50,
        // Bounce-in animation
        transform: entering ? "scale(1)" : undefined,
        animation: entering ? "fabBounceIn 0.5s cubic-bezier(0.34,1.56,0.64,1)" : undefined,
      }}
    >
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
        onClick={() => {
          const next = !open;
          setOpen(next);
          window.dispatchEvent(new CustomEvent("fab-speed-dial-toggle", { detail: { open: next } }));
        }}
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
            transition: "all 0.3s cubic-bezier(0.16,1,0.3,1)",
            transform: open ? "scale(1.15)" : "scale(1)",
          }}
        />
      </button>

      {/* Backdrop — invisible, catches taps to close */}
      <div
        style={{
          position: "fixed", inset: 0, zIndex: -1,
          background: "transparent",
          pointerEvents: open ? "auto" : "none",
        }}
        onClick={() => setOpen(false)}
      />

      <style>{`
        @keyframes fabBounceIn {
          0% { transform: scale(0) translateY(0); opacity: 0; }
          50% { transform: scale(1.15) translateY(-4px); opacity: 1; }
          75% { transform: scale(0.95) translateY(2px); }
          100% { transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
