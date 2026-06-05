"use client";

import { useState, useEffect } from "react";

interface Props {
  /** Called when the lamp button is tapped — opens the Genio */
  onLampClick?: () => void;
  /** Element pinned above the lamp — always visible (e.g. WaiterButton) */
  pinned?: React.ReactNode;
  /** Hide the lamp button (genioFabEnabled=false). Pinned elements still show. */
  hideLamp?: boolean;
}

/**
 * FAB with lamp icon that opens the Genio directly.
 * Optionally shows a pinned element above (waiter bell).
 * Hidden during demo onboarding — appears with bounce when onboarding ends.
 */
export default function FabSpeedDial({ onLampClick, pinned, hideLamp }: Props) {
  const [hidden, setHidden] = useState(false);
  const [entering, setEntering] = useState(false);

  // Hide during demo onboarding, show with bounce when it ends
  useEffect(() => {
    if (document.body.hasAttribute("data-demo-onboarding")) setHidden(true);

    const obs = new MutationObserver(() => {
      const active = document.body.hasAttribute("data-demo-onboarding");
      if (active) { setHidden(true); setEntering(false); }
    });
    obs.observe(document.body, { attributes: true, attributeFilter: ["data-demo-onboarding"] });

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

  // Open Genio programmatically (from demo onboarding)
  useEffect(() => {
    const openFab = () => onLampClick?.();
    window.addEventListener("demo-onboarding-open-fab", openFab);
    return () => window.removeEventListener("demo-onboarding-open-fab", openFab);
  }, [onLampClick]);

  if (hidden) return null;
  if (hideLamp && !pinned) return null;

  return (
    <div
      className="fixed flex flex-col items-center"
      style={{
        right: 14,
        bottom: "calc(16px + env(safe-area-inset-bottom))",
        gap: 10,
        zIndex: 50,
        transform: entering ? "scale(1)" : undefined,
        animation: entering ? "fabBounceIn 0.5s cubic-bezier(0.34,1.56,0.64,1)" : undefined,
      }}
    >
      {/* Pinned element — always visible above the lamp */}
      {pinned && <div>{pinned}</div>}

      {/* Main lamp button — opens Genio */}
      {!hideLamp && <button
        onClick={() => {
          onLampClick?.();
          window.dispatchEvent(new CustomEvent("fab-speed-dial-close"));
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
          alt="Genio"
          className="genio-lamp-icon"
          style={{
            width: 32, height: 32, objectFit: "contain",
            transition: "all 0.3s cubic-bezier(0.16,1,0.3,1)",
          }}
        />
      </button>}

      <style>{`
        @keyframes fabBounceIn {
          0% { transform: scale(0); opacity: 0; }
          40% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1) translateX(-2px); }
          60% { transform: scale(1) translateX(2px); }
          70% { transform: scale(1) translateX(-1.5px); }
          80% { transform: scale(1) translateX(1.5px); }
          90% { transform: scale(1) translateX(-0.5px); }
          100% { transform: scale(1) translateX(0); }
        }
      `}</style>
    </div>
  );
}
