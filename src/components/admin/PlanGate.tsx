"use client";

import { canAccess, requiredPlan, PLAN_INFO, type Feature, type Plan as PlanKey } from "@/lib/plans";
type Plan = PlanKey;

const F = "var(--font-display)";
const FB = "var(--font-body)";

const FEATURE_DESCRIPTIONS: Partial<Record<Feature, { title: string; desc: string; cta: string }>> = {
  promotions: { title: "Ofertas y promociones", desc: "Crea ofertas temporales que aparecen directo en la carta de tus clientes.", cta: "Haz que tus promos se vean" },
  announcements: { title: "Anuncios en la carta", desc: "Lo primero que ven tus clientes al abrir la carta. Novedades, eventos, horarios.", cta: "Tu mensaje en la carta" },
  stats_basic: { title: "Estadisticas de tu carta", desc: "Qué platos miran, qué ignoran y a qué hora llega más gente. Datos reales.", cta: "Descubre qué funciona y qué no" },
  stats_advanced: { title: "Estadisticas avanzadas", desc: "Cada sesión, cada plato visto. Filtra por clima, horario, dispositivo.", cta: "Ve lo que otros no ven" },
  waiter: { title: "Llamar al garzon", desc: "Tu cliente toca un botón y el garzón lo sabe al instante. Cero esperas.", cta: "El garzón siempre atento" },
  automations: { title: "Cumpleaños automaticos", desc: "Bienvenida, cumpleaños, reactivación. Se envían solos, tú no haces nada.", cta: "Haz que tus clientes vuelvan sin esfuerzo" },
  campaigns: { title: "Email marketing", desc: "Envía promos, novedades y lanzamientos directo al correo de quienes ya te conocen.", cta: "Llega a todos tus clientes con un click" },
  multilang: { title: "Carta en varios idiomas", desc: "Turistas leen tu menú en su idioma. Automático.", cta: "Abre tu carta al mundo" },
  clients_full: { title: "Clientes capturados", desc: "Emails, cumpleaños, preferencias. Exporta y usa donde quieras.", cta: "Tu base completa" },
  suggestions: { title: "Productos sugeridos", desc: "Sugiere acompañamientos para subir el ticket de cada mesa.", cta: "Venta cruzada automatica" },
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
  const featureInfo = FEATURE_DESCRIPTIONS[feature];

  if (!blur) return null;

  const openModal = () => {
    window.dispatchEvent(new CustomEvent("show-plan-modal", { detail: { initialTab: needed } }));
  };

  const accentColor = needed === "PREMIUM" ? "#7c3aed" : needed === "GOLD" ? "#F4A623" : "#64748b";

  return (
    <div>
      {/* Visible header */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontFamily: F, fontSize: "1.1rem", fontWeight: 700, color: "var(--adm-text, #1a1a1a)", margin: "0 0 4px" }}>
          {featureInfo?.title || `Plan ${info.label}`}
        </h2>
        <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2, #666)", margin: 0, lineHeight: 1.5 }}>
          {featureInfo?.desc || `Disponible en el plan ${info.label}`}
        </p>
      </div>

      {/* Blurred content + CTA overlay */}
      <div style={{ position: "relative", cursor: "pointer" }} onClick={openModal}>
        <div style={{ filter: "blur(4px)", opacity: 0.3, pointerEvents: "none", userSelect: "none", maxHeight: 300, overflow: "hidden" }}>
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
