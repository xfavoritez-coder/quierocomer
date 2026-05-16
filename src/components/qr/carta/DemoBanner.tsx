"use client";

import { useState } from "react";

interface Props {
  restaurantName: string;
  restaurantSlug: string;
  /** "carta" shows "Ver mi panel", "panel" shows "Ver mi carta" */
  context: "carta" | "panel";
  onActivate?: () => void;
}

/**
 * Slim banner for demo restaurants. Always visible at the top.
 * Shows in both carta and panel views when restaurant.isDemo is true.
 */
export default function DemoBanner({ restaurantName, restaurantSlug, context, onActivate }: Props) {
  const [showTip, setShowTip] = useState(false);

  return (
    <div
      className="font-[family-name:var(--font-dm)]"
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 60,
        padding: "16px 12px",
        background: "rgba(7,7,7,.88)",
        backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
        borderBottom: "1px solid rgba(255,178,45,.18)",
        boxShadow: "0 12px 30px rgba(0,0,0,.35)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        {/* Left */}
        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
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
          <div style={{ minWidth: 0, lineHeight: 1.1 }}>
            <span style={{ display: "block", color: "#fff", fontSize: 13, fontWeight: 850, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              Tu carta está lista
            </span>
            <span style={{ display: "block", marginTop: 4, color: "rgba(255,255,255,.56)", fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              Actívala y comienza a usarla
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
                height: 38, padding: "0 13px", fontSize: 12, fontWeight: 900,
                background: "rgba(255,255,255,.07)", color: "rgba(255,255,255,.88)",
                display: "flex", alignItems: "center", textDecoration: "none", whiteSpace: "nowrap",
              }}
            >Ver panel</a>
          ) : (
            <a
              href={`/qr/${restaurantSlug}`}
              style={{
                border: "1px solid rgba(255,255,255,.11)", borderRadius: 999,
                height: 38, padding: "0 13px", fontSize: 12, fontWeight: 900,
                background: "rgba(255,255,255,.07)", color: "rgba(255,255,255,.88)",
                display: "flex", alignItems: "center", textDecoration: "none", whiteSpace: "nowrap",
              }}
            >Mi carta</a>
          )}
          <a
            href={`/activar/${restaurantSlug}`}
            style={{
              border: 0, borderRadius: 999, height: 38, padding: "0 13px",
              fontSize: 12, fontWeight: 900,
              background: "linear-gradient(135deg, #ffc44f, #f3a333)", color: "#100b03",
              display: "flex", alignItems: "center", textDecoration: "none", whiteSpace: "nowrap",
              boxShadow: "0 10px 24px rgba(255,178,45,.22)",
            }}
          >Activar →</a>
        </div>
      </div>
    </div>
  );
}
