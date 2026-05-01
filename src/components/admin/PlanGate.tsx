"use client";

import { useState } from "react";
import { canAccess, requiredPlan, PLAN_INFO, type Feature, type Plan } from "@/lib/plans";

const F = "var(--font-display)";
const FB = "var(--font-body)";

const FEATURE_DESCRIPTIONS: Partial<Record<Feature, { title: string; desc: string }>> = {
  promotions: { title: "Ofertas del día", desc: "Publica promociones y descuentos que se muestran en tu carta digital." },
  announcements: { title: "Anuncios", desc: "Comunica novedades, horarios especiales o eventos a tus clientes." },
  stats_basic: { title: "Estadísticas", desc: "Ve cuántas personas visitan tu carta, qué platos ven más y cuándo." },
  stats_advanced: { title: "Estadísticas avanzadas", desc: "Recorrido de cada sesión, filtros por fecha, clima, horarios pico y más." },
  waiter: { title: "Panel de garzón", desc: "Tu cliente toca un botón y el garzón recibe notificación al instante." },
  automations: { title: "Automatizaciones", desc: "Emails automáticos de bienvenida, cumpleaños y reactivación de clientes." },
  campaigns: { title: "Campañas", desc: "Crea y envía emails con novedades y promociones a tus clientes registrados." },
  multilang: { title: "Multilenguaje", desc: "Tu carta se traduce automáticamente al idioma del cliente." },
  clients_full: { title: "Todos los clientes", desc: "Ve el listado completo de clientes registrados con sus datos." },
};

const PLAN_FEATURES_LIST: Record<string, string[]> = {
  GOLD: [
    "2 vistas de carta (lista + galería)",
    "Destacar platos estrella",
    "Ofertas y promociones",
    "Estadísticas básicas",
    "Anuncios en la carta",
    "Multilenguaje (ES · EN · PT)",
  ],
  PREMIUM: [
    "4 vistas de carta",
    "Estadísticas avanzadas",
    "Llamar al garzón",
    "Productos sugeridos",
    "Automatizaciones de email",
    "Campañas y email marketing",
    "Todos los clientes + exportar",
  ],
};

interface Props {
  plan: Plan | string | undefined | null;
  feature: Feature;
  children: React.ReactNode;
  blur?: boolean;
}

export default function PlanGate({ plan, feature, children, blur = true }: Props) {
  const [showModal, setShowModal] = useState(false);
  const hasAccess = canAccess(plan, feature);

  if (hasAccess) return <>{children}</>;

  const needed = requiredPlan(feature);
  const info = PLAN_INFO[needed];
  const featureInfo = FEATURE_DESCRIPTIONS[feature];
  const featuresList = PLAN_FEATURES_LIST[needed] || [];

  if (!blur) return null;

  return (
    <>
      <div style={{ position: "relative", cursor: "pointer", minHeight: 200 }} onClick={() => setShowModal(true)}>
        <div style={{ filter: "blur(5px)", opacity: 0.4, pointerEvents: "none", userSelect: "none" }}>
          {children}
        </div>
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 10,
          background: "rgba(255,255,255,0.6)",
          borderRadius: 16,
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: needed === "PREMIUM" ? "linear-gradient(135deg, #F3E8FF, #E9D5FF)" : "linear-gradient(135deg, #FFF8E7, #FFEDD0)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem",
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          }}>
            {needed === "PREMIUM" ? "💎" : "⭐"}
          </div>
          <p style={{ fontFamily: F, fontSize: "1rem", fontWeight: 700, color: "#1a1a1a", margin: 0 }}>
            {featureInfo?.title || `Plan ${info.label}`}
          </p>
          <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "#888", margin: 0 }}>
            Disponible en el plan {info.label}
          </p>
          <button style={{
            marginTop: 4, padding: "10px 24px", borderRadius: 999, border: "none",
            background: needed === "PREMIUM" ? "#7c3aed" : "#F4A623",
            color: "#fff", fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer",
            boxShadow: needed === "PREMIUM" ? "0 4px 14px rgba(124,58,237,0.25)" : "0 4px 14px rgba(244,166,35,0.25)",
          }}>
            Ver plan {info.label} →
          </button>
        </div>
      </div>

      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div onClick={e => e.stopPropagation()} style={{
            background: "#fff", borderRadius: 24, padding: "32px 28px", maxWidth: 400, width: "100%",
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }}>
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: needed === "PREMIUM" ? "linear-gradient(135deg, #F3E8FF, #E9D5FF)" : "linear-gradient(135deg, #FFF8E7, #FFEDD0)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 14px", fontSize: "1.4rem",
              }}>
                {needed === "PREMIUM" ? "💎" : "⭐"}
              </div>
              <h3 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 700, color: "#1a1a1a", margin: "0 0 4px" }}>
                Plan {info.label}
              </h3>
              {featureInfo && (
                <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "#666", lineHeight: 1.5, margin: 0 }}>
                  {featureInfo.desc}
                </p>
              )}
            </div>

            {/* Features list */}
            {featuresList.length > 0 && (
              <div style={{
                background: needed === "PREMIUM" ? "#FAFAFE" : "#FFFCF5",
                borderRadius: 14, padding: "16px 18px", marginBottom: 20,
                border: `1px solid ${needed === "PREMIUM" ? "#e9d5ff" : "#fde68a"}`,
              }}>
                <p style={{ fontFamily: F, fontSize: "0.72rem", fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>
                  Incluye
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {featuresList.map(f => (
                    <div key={f} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: needed === "PREMIUM" ? "#7c3aed" : "#F4A623", fontSize: "0.82rem", flexShrink: 0 }}>✓</span>
                      <span style={{ fontFamily: FB, fontSize: "0.82rem", color: "#444" }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Price hint */}
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <span style={{ fontFamily: F, fontSize: "1.8rem", fontWeight: 700, color: "#1a1a1a" }}>
                {needed === "PREMIUM" ? "$55.000" : "$35.000"}
              </span>
              <span style={{ fontFamily: FB, fontSize: "0.85rem", color: "#999", marginLeft: 4 }}>/mes</span>
            </div>

            {/* CTA */}
            <a
              href={`https://wa.me/56962530297?text=${encodeURIComponent(`Hola, me interesa el plan ${info.label} para mi restaurante en QuieroComer`)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block", padding: "14px 20px", borderRadius: 999, textAlign: "center",
                background: needed === "PREMIUM" ? "#7c3aed" : "#F4A623",
                color: "#fff", fontFamily: F, fontSize: "0.95rem", fontWeight: 700,
                textDecoration: "none", marginBottom: 10,
                boxShadow: needed === "PREMIUM" ? "0 4px 16px rgba(124,58,237,0.3)" : "0 4px 16px rgba(244,166,35,0.3)",
              }}
            >
              Quiero el plan {info.label} →
            </a>
            <button
              onClick={() => setShowModal(false)}
              style={{ display: "block", width: "100%", background: "none", border: "none", color: "#999", fontFamily: F, fontSize: "0.82rem", cursor: "pointer", padding: "10px 0" }}
            >
              Ahora no
            </button>
          </div>
        </div>
      )}
    </>
  );
}
