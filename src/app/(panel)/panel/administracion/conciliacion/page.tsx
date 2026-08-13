"use client";
import { Landmark } from "lucide-react";

const F = "var(--font-display, system-ui)";
const FB = "var(--font-body, system-ui)";

export default function ConciliacionPage() {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <p style={{ fontFamily: F, fontSize: "0.68rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--adm-text3,#999)", margin: "0 0 2px" }}>Administración</p>
      <h1 style={{ fontFamily: F, fontSize: "1.5rem", fontWeight: 800, color: "var(--adm-text,#111)", margin: "0 0 32px" }}>Conciliación Bancaria</h1>

      <div style={{ padding: 32, borderRadius: 16, background: "var(--adm-card,#fff)", border: "1px solid var(--adm-card-border,#f0f0f0)", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#f0f9ff", border: "1px solid #bae6fd", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <Landmark size={24} color="#0284c7" />
        </div>
        <h2 style={{ fontFamily: F, fontSize: "1rem", fontWeight: 700, color: "var(--adm-text,#111)", margin: "0 0 8px" }}>Próximamente</h2>
        <p style={{ fontFamily: FB, fontSize: "0.88rem", color: "var(--adm-text2,#666)", lineHeight: 1.6, margin: "0 0 20px", maxWidth: 360, marginLeft: "auto", marginRight: "auto" }}>
          Conectaremos tu cuenta BCI Pyme para importar movimientos automáticamente y conciliarlos con el flujo financiero.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, textAlign: "left", maxWidth: 300, margin: "0 auto" }}>
          {["Importar movimientos via CSV de BCI", "Matching automático con categorías", "Conexión directa via Fintoc (fase 2)"].map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#f0f9ff", border: "1px solid #bae6fd", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 10, color: "#0284c7", fontWeight: 700 }}>{i + 1}</span>
              </div>
              <span style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text2,#555)" }}>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
