"use client";

import { useState } from "react";
import {
  PLAN_FEATURES_DISPLAY,
  PLAN_INHERITS_FROM,
  PLAN_TAGLINES,
  planNetAmount,
  ivaOf,
  grossOf,
} from "@/lib/billing/plans-config";

const F = "var(--font-display)";
const FB = "var(--font-body)";

function FeatureRow({ text, tip, color }: { text: string; tip: string; color: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
        <span style={{ color, fontSize: "0.82rem", flexShrink: 0 }}>✓</span>
        <span style={{ fontFamily: FB, fontSize: "0.8rem", color: "#444", flex: 1 }}>{text}</span>
        <span style={{ width: 15, height: 15, borderRadius: "50%", background: open ? "#1a1a1a" : "#e8e3d8", color: open ? "#fff" : "#888", fontSize: "8px", fontWeight: 700, fontStyle: "italic", fontFamily: "Georgia,serif", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>i</span>
      </div>
      {open && (
        <p style={{ margin: "4px 0 2px 20px", fontSize: "0.78rem", color: "#888", lineHeight: 1.45 }}>{tip}</p>
      )}
    </div>
  );
}

interface Props {
  initialTab?: "GOLD" | "PREMIUM";
  onClose: () => void;
}

export default function PlanUpgradeModal({ initialTab = "PREMIUM", onClose }: Props) {
  const [modalTab, setModalTab] = useState<"GOLD" | "PREMIUM">(initialTab);

  const features = PLAN_FEATURES_DISPLAY[modalTab] || [];
  const net = planNetAmount(modalTab);
  const iva = ivaOf(net);
  const gross = grossOf(net);
  const fmt = (n: number) => `$${n.toLocaleString("es-CL")}`;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 24, maxWidth: 400, width: "100%",
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
      }}>
        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #f0f0f0", position: "sticky", top: 0, background: "#fff", borderRadius: "24px 24px 0 0", zIndex: 1 }}>
          {(["GOLD", "PREMIUM"] as const).map(tab => (
            <button key={tab} onClick={() => setModalTab(tab)} style={{
              flex: 1, padding: "16px 0", border: "none", cursor: "pointer",
              fontFamily: F, fontSize: "0.88rem", fontWeight: 700,
              background: "transparent",
              color: modalTab === tab ? (tab === "PREMIUM" ? "#7c3aed" : "#92400e") : "#ccc",
              borderBottom: modalTab === tab ? `3px solid ${tab === "PREMIUM" ? "#7c3aed" : "#F4A623"}` : "3px solid transparent",
            }}>
              {tab === "GOLD" ? "⭐ Gold" : "💎 Premium"}
            </button>
          ))}
        </div>

        <div style={{ padding: "20px 24px 24px" }}>
          {/* Description + Price */}
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "#555", lineHeight: 1.5, margin: "0 0 6px" }}>
              {PLAN_TAGLINES[modalTab]}
            </p>
            <div>
              <span style={{ fontFamily: F, fontSize: "2rem", fontWeight: 700, color: "#1a1a1a" }}>{fmt(net)}</span>
              <span style={{ fontFamily: FB, fontSize: "0.85rem", color: "#999", marginLeft: 4 }}>/mes neto</span>
            </div>
            <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "#666", margin: "4px 0 0" }}>
              + IVA 19% ({fmt(iva)}) = <strong style={{ color: "#1a1a1a" }}>{fmt(gross)}</strong> total mensual
            </p>
            <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "#bbb", margin: "2px 0 0" }}>Sin contratos</p>
          </div>

          {/* Features */}
          <div style={{
            background: modalTab === "PREMIUM" ? "#FAFAFE" : "#FFFCF5",
            borderRadius: 12, padding: "14px 16px", marginBottom: 18,
            border: `1px solid ${modalTab === "PREMIUM" ? "#e9d5ff" : "#fde68a"}`,
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <FeatureRow
                text={PLAN_INHERITS_FROM[modalTab]}
                tip={`Incluye todas las funciones del plan ${modalTab === "PREMIUM" ? "Gold" : "Gratis"}`}
                color={modalTab === "PREMIUM" ? "#7c3aed" : "#F4A623"}
              />
              {features.map(f => (
                <FeatureRow key={f.text} text={f.text} tip={f.tip} color={modalTab === "PREMIUM" ? "#7c3aed" : "#F4A623"} />
              ))}
            </div>
          </div>

          {/* CTA */}
          <a
            href={`https://wa.me/56999946208?text=${encodeURIComponent(`Hola! Me gustaría saber más sobre el plan ${modalTab === "PREMIUM" ? "Premium" : "Gold"} de QuieroComer para mi restaurante 🍽️`)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block", padding: "14px 20px", borderRadius: 999, textAlign: "center",
              background: modalTab === "PREMIUM" ? "#7c3aed" : "#F4A623",
              color: "#fff", fontFamily: F, fontSize: "0.92rem", fontWeight: 700,
              textDecoration: "none", marginBottom: 8,
              boxShadow: modalTab === "PREMIUM" ? "0 4px 16px rgba(124,58,237,0.3)" : "0 4px 16px rgba(244,166,35,0.3)",
            }}
          >
            Quiero el plan {modalTab === "PREMIUM" ? "Premium" : "Gold"} →
          </a>
          <button onClick={onClose} style={{ display: "block", width: "100%", background: "none", border: "none", color: "#999", fontFamily: F, fontSize: "0.82rem", cursor: "pointer", padding: "8px 0" }}>
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}
