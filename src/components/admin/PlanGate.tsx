"use client";

import { useState } from "react";
import { canAccess, requiredPlan, PLAN_INFO, type Feature, type Plan } from "@/lib/plans";

const F = "var(--font-display)";

interface Props {
  plan: Plan | string | undefined | null;
  feature: Feature;
  children: React.ReactNode;
  /** If true, show children but blurred instead of hidden */
  blur?: boolean;
}

export default function PlanGate({ plan, feature, children, blur = true }: Props) {
  const [showModal, setShowModal] = useState(false);
  const hasAccess = canAccess(plan, feature);

  if (hasAccess) return <>{children}</>;

  const needed = requiredPlan(feature);
  const info = PLAN_INFO[needed];

  if (!blur) return null;

  return (
    <>
      <div style={{ position: "relative", cursor: "pointer" }} onClick={() => setShowModal(true)}>
        {/* Blurred content */}
        <div style={{ filter: "blur(6px)", opacity: 0.5, pointerEvents: "none", userSelect: "none" }}>
          {children}
        </div>
        {/* Overlay */}
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 8,
          background: "rgba(255,255,255,0.3)", backdropFilter: "blur(2px)",
          borderRadius: 12,
        }}>
          <span style={{ fontSize: "1.5rem" }}>🔒</span>
          <span style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 600, color: "#333" }}>
            Plan {info.label}
          </span>
          <span style={{ fontFamily: F, fontSize: "0.68rem", color: "#888" }}>
            Toca para saber más
          </span>
        </div>
      </div>

      {/* Upgrade modal */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div onClick={e => e.stopPropagation()} style={{
            background: "#fff", borderRadius: 20, padding: "28px 24px", maxWidth: 380, width: "100%",
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)", textAlign: "center",
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%", background: info.bg,
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px", fontSize: "1.5rem",
            }}>
              {needed === "GOLD" ? "⭐" : "💎"}
            </div>
            <h3 style={{ fontFamily: F, fontSize: "1.1rem", fontWeight: 700, color: "#1a1a1a", margin: "0 0 6px" }}>
              Función del plan {info.label}
            </h3>
            <p style={{ fontSize: "0.85rem", color: "#666", lineHeight: 1.5, margin: "0 0 20px" }}>
              Esta función está disponible en el plan {info.label}. Contáctanos para mejorar tu plan.
            </p>
            <a
              href={`https://wa.me/56912345678?text=${encodeURIComponent(`Hola, me interesa el plan ${info.label} para mi restaurante`)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block", padding: "12px 20px", borderRadius: 999,
                background: needed === "GOLD" ? "#F4A623" : "#7c3aed",
                color: "#fff", fontFamily: F, fontSize: "0.92rem", fontWeight: 700,
                textDecoration: "none", marginBottom: 10,
              }}
            >
              Quiero mejorar mi plan →
            </a>
            <button
              onClick={() => setShowModal(false)}
              style={{ background: "none", border: "none", color: "#999", fontFamily: F, fontSize: "0.82rem", cursor: "pointer", padding: "8px 16px" }}
            >
              Ahora no
            </button>
          </div>
        </div>
      )}
    </>
  );
}
