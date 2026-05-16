"use client";

import { useState, useEffect } from "react";

interface Props {
  restaurantName: string;
  restaurantSlug: string;
  restaurantLogo?: string | null;
  /** "carta" shows "Ver mi panel", "panel" shows "Ver mi carta" */
  context: "carta" | "panel";
  onActivate?: () => void;
}

/**
 * Slim banner for demo restaurants. Always visible at the top.
 * Shows in both carta and panel views when restaurant.isDemo is true.
 */
export default function DemoBanner({ restaurantName, restaurantSlug, restaurantLogo, context, onActivate }: Props) {
  const [showTip, setShowTip] = useState(false);
  const [highlight, setHighlight] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Show restaurant name when scrolled past hero
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Listen for onboarding highlight
  useEffect(() => {
    const on = () => setHighlight(true);
    const off = () => setHighlight(false);
    window.addEventListener("demo-onboarding-highlight-activate", on);
    window.addEventListener("demo-onboarding-stop-highlight", off);
    return () => {
      window.removeEventListener("demo-onboarding-highlight-activate", on);
      window.removeEventListener("demo-onboarding-stop-highlight", off);
    };
  }, []);

  return (
    <div
      className="font-[family-name:var(--font-dm)]"
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 60,
        transform: "translate3d(0,0,0)", WebkitTransform: "translate3d(0,0,0)",
        padding: "18px 14px 18px",
        background: "rgba(7,7,7,.88)",
        backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
        boxShadow: "0 12px 30px rgba(0,0,0,.35)",
        overflow: "visible",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Left — DEMO badge + info tooltip */}
        <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 10 }}>
          <div
            onClick={() => setShowTip(s => !s)}
            style={{
              flex: "0 0 auto", padding: "7px 10px", borderRadius: 999,
              background: "rgba(255,178,45,.12)", border: "1px solid rgba(255,178,45,.2)",
              color: "#ffb22d", fontSize: 11, fontWeight: 950, letterSpacing: ".8px",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 5, position: "relative",
            }}
          >
            <span style={{ width: 14, height: 14, borderRadius: "50%", background: "rgba(255,178,45,.25)", display: "inline-grid", placeItems: "center", fontFamily: "Georgia, serif", fontSize: 9, fontWeight: 700, color: "#ffb22d" }}>i</span>
            DEMO
            {showTip && (
              <>
                <div onClick={(e) => { e.stopPropagation(); setShowTip(false); }} style={{ position: "fixed", inset: 0, zIndex: 69 }} />
                <div style={{
                  position: "absolute", top: "calc(100% + 8px)", left: 0,
                  background: "#1a1a1a", border: "1px solid rgba(255,178,45,0.3)", borderRadius: 10,
                  padding: "10px 14px", width: 220, zIndex: 70,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                }}>
                  <div style={{
                    position: "absolute", top: -5, left: 16,
                    width: 10, height: 10, background: "#1a1a1a", borderTop: "1px solid rgba(255,178,45,0.3)", borderLeft: "1px solid rgba(255,178,45,0.3)",
                    transform: "rotate(45deg)",
                  }} />
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", margin: 0, lineHeight: 1.5, fontWeight: 400, letterSpacing: 0 }}>
                    Esta es una vista previa de cómo se verá tu carta digital. Actívala para que tus clientes puedan verla.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Center — Crossfade: "Tu carta está lista" ↔ logo + name */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", position: "relative", minHeight: 20 }}>
          <span style={{
            color: "rgba(255,255,255,0.3)", fontSize: 16, fontWeight: 400,
            whiteSpace: "nowrap",
            opacity: scrolled ? 0 : 1, transition: "opacity 0.15s ease",
          }}>
            Tu carta está lista
          </span>
          <div style={{
            position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", height: "100%",
            display: "flex", alignItems: "center", gap: 6,
            opacity: scrolled ? 1 : 0, transition: "opacity 0.15s ease",
            pointerEvents: scrolled ? "auto" : "none",
          }}>
            {restaurantLogo && (
              <img src={restaurantLogo} alt="" style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
            )}
            <span style={{
              color: "rgba(255,255,255,0.45)", fontSize: 15, fontWeight: 600,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              maxWidth: 100,
            }}>
              {restaurantName}
            </span>
          </div>
        </div>

        {/* Right — Actions */}
        <div style={{ flex: "0 0 auto", display: "flex", gap: 7 }}>
          {context === "carta" ? (
            <a
              href={`/panel?slug=${restaurantSlug}`}
              style={{
                border: "1px solid rgba(255,255,255,.11)", borderRadius: 999,
                height: 38, padding: "0 14px", fontSize: 13, fontWeight: 900,
                background: "rgba(255,255,255,.07)", color: "rgba(255,255,255,.88)",
                display: "flex", alignItems: "center", textDecoration: "none", whiteSpace: "nowrap",
              }}
            >Ver panel</a>
          ) : (
            <a
              href={`/qr/${restaurantSlug}`}
              style={{
                border: "1px solid rgba(255,255,255,.11)", borderRadius: 999,
                height: 38, padding: "0 14px", fontSize: 13, fontWeight: 900,
                background: "rgba(255,255,255,.07)", color: "rgba(255,255,255,.88)",
                display: "flex", alignItems: "center", textDecoration: "none", whiteSpace: "nowrap",
              }}
            >Mi carta</a>
          )}
          <a
            href={`/activar/${restaurantSlug}`}
            style={{
              border: 0, borderRadius: 999, height: 38, padding: "0 13px",
              fontSize: 13, fontWeight: 900,
              background: "linear-gradient(135deg, #ffc44f, #f3a333)", color: "#100b03",
              display: "flex", alignItems: "center", textDecoration: "none", whiteSpace: "nowrap",
              boxShadow: highlight
                ? "0 0 0 3px rgba(255,178,45,0.4), 0 10px 24px rgba(255,178,45,.35)"
                : "0 10px 24px rgba(255,178,45,.22)",
              animation: highlight ? "activatePulse 1.5s ease-in-out infinite" : undefined,
              transition: "box-shadow 0.3s ease",
            }}
          >Activar →</a>
          {highlight && (
            <style>{`
              @keyframes activatePulse {
                0%, 100% { transform: scale(1); box-shadow: 0 0 0 3px rgba(255,178,45,0.4), 0 10px 24px rgba(255,178,45,.35); }
                50% { transform: scale(1.08); box-shadow: 0 0 0 6px rgba(255,178,45,0.2), 0 14px 30px rgba(255,178,45,.45); }
              }
            `}</style>
          )}
        </div>
      </div>

      {/* Amber ribbon below */}
      <div style={{
        position: "absolute",
        bottom: 0, left: 0, right: 0,
        transform: "translateY(100%)",
        padding: "9px 14px",
        background: "linear-gradient(135deg, #ffb833, #f5a623)",
        textAlign: "center",
      }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#1a0800" }}>
          Actívala y muéstrasela al mundo
        </span>
      </div>
    </div>
  );
}
