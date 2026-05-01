"use client";

import { useState } from "react";
import { canAccess, requiredPlan, PLAN_INFO, type Feature, type Plan } from "@/lib/plans";
import PlanUpgradeModal from "./PlanUpgradeModal";

const F = "var(--font-display)";
const FB = "var(--font-body)";

const FEATURE_DESCRIPTIONS: Partial<Record<Feature, { title: string; desc: string; cta: string }>> = {
  promotions: { title: "Ofertas que venden solas", desc: "Descuentos que aparecen justo cuando el cliente está decidiendo qué pedir.", cta: "Haz que tus promos se vean" },
  announcements: { title: "Habla directo con tu cliente", desc: "Lo primero que ven al abrir la carta. Novedades, eventos, horarios.", cta: "Tu mensaje en la carta" },
  stats_basic: { title: "¿Qué plato deberías empujar?", desc: "Qué miran, qué ignoran y a qué hora llega más gente. Datos reales.", cta: "Descubre qué funciona y qué no" },
  stats_advanced: { title: "El recorrido completo", desc: "Cada sesión, cada plato visto. Filtra por clima, horario, dispositivo.", cta: "Ve lo que otros no ven" },
  waiter: { title: "Sin levantar la mano", desc: "Tu cliente toca un botón y el garzón lo sabe al instante. Cero esperas.", cta: "El garzón siempre atento" },
  automations: { title: "Emails que trabajan por ti", desc: "Bienvenida, cumpleaños, reactivación. Se envían solos, tú no haces nada.", cta: "Haz que tus clientes vuelvan sin esfuerzo" },
  campaigns: { title: "Mantén a tus clientes cerca", desc: "Envía promos, novedades y lanzamientos directo al correo de quienes ya te conocen.", cta: "Llega a todos tus clientes con un click" },
  multilang: { title: "Tu carta en su idioma", desc: "Turistas leen tu menú en su idioma. Automático.", cta: "Abre tu carta al mundo" },
  clients_full: { title: "Todos tus clientes, en un lugar", desc: "Emails, cumpleaños, preferencias. Exporta y usa donde quieras.", cta: "Tu base completa" },
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

  if (!blur) return null;

  const openModal = () => setShowModal(true);

  return (
    <>
      <div style={{ position: "relative", cursor: "pointer" }} onClick={openModal}>
        <div style={{ filter: "blur(4px)", opacity: 0.5, pointerEvents: "none", userSelect: "none", maxHeight: 420, overflow: "hidden", minHeight: 340 }}>
          {children}
        </div>
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 12,
          background: "rgba(255,255,255,0.6)", borderRadius: 16, padding: 32,
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: needed === "PREMIUM" ? "linear-gradient(135deg, #F3E8FF, #E9D5FF)" : "linear-gradient(135deg, #FFF8E7, #FFEDD0)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.8rem",
            boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
          }}>
            {needed === "PREMIUM" ? "💎" : "⭐"}
          </div>
          <p style={{ fontFamily: F, fontSize: "1.1rem", fontWeight: 700, color: "#1a1a1a", margin: 0, textAlign: "center" }}>
            {featureInfo?.title || `Plan ${info.label}`}
          </p>
          <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "#666", margin: 0, textAlign: "center", maxWidth: 300, lineHeight: 1.5 }}>
            {featureInfo?.cta || `Disponible en el plan ${info.label}`}
          </p>
          <button style={{
            marginTop: 6, padding: "12px 28px", borderRadius: 999, border: "none",
            background: needed === "PREMIUM" ? "#7c3aed" : "#F4A623",
            color: "#fff", fontFamily: F, fontSize: "0.88rem", fontWeight: 700, cursor: "pointer",
            boxShadow: needed === "PREMIUM" ? "0 4px 16px rgba(124,58,237,0.3)" : "0 4px 16px rgba(244,166,35,0.3)",
          }}>
            {needed === "PREMIUM" ? "Pasarme a Premium →" : "Desbloquear con Gold →"}
          </button>
        </div>
      </div>

      {showModal && (
        <PlanUpgradeModal
          initialTab={needed === "PREMIUM" ? "PREMIUM" : "GOLD"}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
