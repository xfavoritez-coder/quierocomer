"use client";

import { canAccess, requiredPlan, PLAN_INFO, type Feature, type Plan as PlanKey } from "@/lib/plans";
import { Tag, Megaphone, BarChart3, Globe, Bell, Mail, Cake, Users, UtensilsCrossed } from "lucide-react";
type Plan = PlanKey;

const F = "var(--font-display)";
const FB = "var(--font-body)";

const FEATURE_CONFIG: Partial<Record<Feature, { title: string; desc: string; icon: typeof Tag }>> = {
  promotions: { title: "Ofertas y promociones", desc: "Crea ofertas temporales que aparecen directo en la carta de tus clientes.", icon: Tag },
  announcements: { title: "Anuncios en la carta", desc: "Lo primero que ven tus clientes al abrir la carta. Novedades, eventos, horarios.", icon: Megaphone },
  stats_basic: { title: "Estadísticas", desc: "Qué platos miran, qué ignoran y a qué hora llega más gente.", icon: BarChart3 },
  stats_advanced: { title: "Estadísticas avanzadas", desc: "Cada sesión, cada plato visto. Filtra por clima, horario, dispositivo.", icon: BarChart3 },
  waiter: { title: "Llamar al garzón", desc: "Tu cliente toca un botón y el garzón lo sabe al instante.", icon: Bell },
  automations: { title: "Cumpleaños automáticos", desc: "Se envían solos, tú no haces nada.", icon: Cake },
  campaigns: { title: "Email marketing", desc: "Envía promos y novedades directo al correo de tus clientes.", icon: Mail },
  multilang: { title: "Carta en varios idiomas", desc: "Turistas leen tu menú en su idioma. Automático.", icon: Globe },
  clients_full: { title: "Clientes capturados", desc: "Emails, cumpleaños, preferencias. Exporta y usa donde quieras.", icon: Users },
  suggestions: { title: "Productos sugeridos", desc: "Sugiere acompañamientos para subir el ticket de cada mesa.", icon: UtensilsCrossed },
};

interface Props {
  plan: Plan | string | undefined | null;
  feature: Feature;
  children: React.ReactNode;
  blur?: boolean;
}

export default function PlanGate({ plan, feature, children, blur = true }: Props) {
  const hasAccess = canAccess(plan, feature);

  if (hasAccess) return <>{children}</>;

  const needed = requiredPlan(feature);
  const info = PLAN_INFO[needed];
  const cfg = FEATURE_CONFIG[feature];

  if (!blur) return null;

  const openModal = () => {
    window.dispatchEvent(new CustomEvent("show-plan-modal", { detail: { initialTab: needed } }));
  };

  const accentColor = needed === "PREMIUM" ? "#7c3aed" : needed === "GOLD" ? "#F4A623" : "#64748b";
  const Icon = cfg?.icon || Tag;

  return (
    <div>
      {/* Section header with icon — visible, not blurred */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{
          fontFamily: F, fontSize: "1.2rem", fontWeight: 700,
          color: "var(--adm-text, #1a1a1a)", margin: "0 0 4px",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <Icon size={20} color="var(--adm-text3, #888)" />
          {cfg?.title || `Plan ${info.label}`}
        </h1>
        <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2, #666)", margin: 0, lineHeight: 1.5 }}>
          {cfg?.desc || `Disponible en el plan ${info.label}`}
        </p>
      </div>

      {/* Blurred content + CTA overlay */}
      <div style={{ position: "relative", cursor: "pointer" }} onClick={openModal}>
        <div style={{ filter: "blur(3px)", opacity: 0.3, pointerEvents: "none", userSelect: "none", maxHeight: 300, overflow: "hidden" }}>
          {children}
        </div>
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 10,
          background: "var(--adm-gate-bg, rgba(255,255,255,0.5))",
          borderRadius: 12,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            background: `${accentColor}15`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem",
            border: `2px solid ${accentColor}25`,
          }}>
            {needed === "PREMIUM" ? "💎" : needed === "GOLD" ? "⭐" : "🥈"}
          </div>
          <button style={{
            padding: "10px 24px", borderRadius: 999, border: "none",
            background: accentColor, color: "#fff",
            fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer",
            boxShadow: `0 4px 16px ${accentColor}40`,
          }}>
            {`Desbloquear con ${info.label} →`}
          </button>
        </div>
      </div>
    </div>
  );
}
