"use client";

import { useState } from "react";
import { canAccess, requiredPlan, PLAN_INFO, type Feature, type Plan } from "@/lib/plans";

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

const PLAN_FEATURES_WITH_TIPS: Record<string, { text: string; tip: string }[]> = {
  GOLD: [
    { text: "2 vistas de carta", tip: "Vista lista y vista galería con fotos grandes" },
    { text: "Destacar platos estrella", tip: "Marca tus mejores platos para que aparezcan primero en el hero" },
    { text: "Ofertas y promociones", tip: "Publica descuentos que se muestran automáticamente en la carta" },
    { text: "Estadísticas básicas", tip: "Visitas, platos más vistos, horarios de mayor tráfico" },
    { text: "Anuncios en la carta", tip: "Banner de novedades visible al abrir la carta" },
    { text: "Multilenguaje", tip: "Carta traducida automáticamente a inglés y portugués" },
  ],
  PREMIUM: [
    { text: "Todo del plan Gold", tip: "Incluye todas las funciones del plan Gold" },
    { text: "4 vistas de carta", tip: "Lista, galería, feed y espacial" },
    { text: "Estadísticas avanzadas", tip: "Recorrido por sesión, filtros por clima, horarios pico" },
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
  plan: Plan | string | undefined | null;
  feature: Feature;
  children: React.ReactNode;
  blur?: boolean;
}

export default function PlanGate({ plan, feature, children, blur = true }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState<"GOLD" | "PREMIUM">("GOLD");
  const hasAccess = canAccess(plan, feature);

  if (hasAccess) return <>{children}</>;

  const needed = requiredPlan(feature);
  const info = PLAN_INFO[needed];
  const featureInfo = FEATURE_DESCRIPTIONS[feature];

  if (!blur) return null;

  const openModal = () => {
    setModalTab(needed === "PREMIUM" ? "PREMIUM" : "GOLD");
    setShowModal(true);
  };

  return (
    <>
      <div style={{ position: "relative", cursor: "pointer" }} onClick={openModal}>
        <div style={{ filter: "blur(4px)", opacity: 0.5, pointerEvents: "none", userSelect: "none", maxHeight: 420, overflow: "hidden" }}>
          {children}
        </div>
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "100%", maxHeight: 420,
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
            Ver planes →
          </button>
        </div>
      </div>

      {/* Modal with tabs */}
      {showModal && (
        <div onClick={() => setShowModal(false)} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#fff", borderRadius: 24, maxWidth: 400, width: "100%",
            maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
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
                <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "#555", lineHeight: 1.5, margin: "0 0 12px" }}>
                  {modalTab === "PREMIUM" ? "Todo lo que necesitas para vender más sin mover un dedo" : "Destaca tu carta y entiende mejor a tus clientes"}
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
              <button onClick={() => setShowModal(false)} style={{ display: "block", width: "100%", background: "none", border: "none", color: "#999", fontFamily: F, fontSize: "0.82rem", cursor: "pointer", padding: "8px 0" }}>
                Ahora no
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
