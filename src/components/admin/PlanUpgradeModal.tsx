"use client";

import { useState } from "react";

const F = "var(--font-display)";
const FB = "var(--font-body)";

const PLAN_FEATURES_WITH_TIPS: Record<string, { text: string; tip: string }[]> = {
  GOLD: [
    { text: "2 vistas de carta", tip: "Vista lista y vista galería con fotos grandes" },
    { text: "Destacar platos estrella", tip: "Marca tus mejores platos para que aparezcan primero en el hero" },
    { text: "Ofertas y promociones", tip: "Publica descuentos que se muestran automáticamente en la carta" },
    { text: "Estadísticas básicas", tip: "Visitantes, sesiones, platos más vistos y duración promedio" },
    { text: "Anuncios en la carta", tip: "Banner de novedades visible al abrir la carta" },
    { text: "Multilenguaje", tip: "Carta traducida automáticamente a inglés y portugués" },
  ],
  PREMIUM: [
    { text: "Todo del plan Gold", tip: "Incluye todas las funciones del plan Gold" },
    { text: "4 vistas de carta", tip: "Lista, galería, feed y espacial" },
    { text: "Estadísticas avanzadas", tip: "Sesiones en vivo, recorrido de cada cliente, búsquedas y estadísticas del garzón" },
    { text: "Llamar al garzón", tip: "El cliente toca un botón y el garzón recibe notificación push" },
    { text: "Productos sugeridos", tip: "El Genio sugiere acompañamientos para subir el ticket" },
    { text: "Automatizaciones", tip: "Emails automáticos de bienvenida, cumpleaños y reactivación" },
    { text: "Campañas y email marketing", tip: "Envía comunicaciones masivas a tus clientes" },
    { text: "Clientes ilimitados + CSV", tip: "Ve todos los registrados y exporta la lista" },
  ],
};

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
              {modalTab === "PREMIUM" ? "Para vender más sin levantar un dedo" : "Destaca tu carta y entiende mejor a tus clientes"}
            </p>
            <div>
              <span style={{ fontFamily: F, fontSize: "2rem", fontWeight: 700, color: "#1a1a1a" }}>
                {modalTab === "PREMIUM" ? "$55.000" : "$35.000"}
              </span>
              <span style={{ fontFamily: FB, fontSize: "0.85rem", color: "#999", marginLeft: 4 }}>/mes</span>
            </div>
            <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "#bbb", margin: "-2px 0 0" }}>Neto · Sin contratos</p>
          </div>

          {/* Features */}
          <div style={{
            background: modalTab === "PREMIUM" ? "#FAFAFE" : "#FFFCF5",
            borderRadius: 12, padding: "14px 16px", marginBottom: 18,
            border: `1px solid ${modalTab === "PREMIUM" ? "#e9d5ff" : "#fde68a"}`,
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(PLAN_FEATURES_WITH_TIPS[modalTab] || []).map(f => (
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
