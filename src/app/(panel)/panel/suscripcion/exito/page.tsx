"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

const GOLD = "#F4A623";

const PLAN_LABELS: Record<string, string> = {
  SILVER: "Silver",
  GOLD: "Gold",
  PREMIUM: "Premium",
};

const PLAN_FEATURES: Record<string, string[]> = {
  SILVER: [
    "3 diseños de carta disponibles",
    "Modo oscuro y claro",
    "Destacar platos estrella",
    "Ofertas y promociones",
  ],
  GOLD: [
    "Todo lo de Silver",
    "Estadísticas de visitas",
    "Carta en inglés y portugués",
    "Anuncios en la carta",
  ],
  PREMIUM: [
    "Todo lo de Gold",
    "Botón llamar al garzón",
    "Captación de clientes",
    "Email marketing",
    "Captación de cumpleaños",
  ],
};

const PLAN_COLORS: Record<string, { accent: string; bg: string; border: string }> = {
  SILVER: { accent: "#64748b", bg: "rgba(100,116,139,0.08)", border: "rgba(100,116,139,0.2)" },
  GOLD: { accent: GOLD, bg: "rgba(244,166,35,0.08)", border: "rgba(244,166,35,0.2)" },
  PREMIUM: { accent: "#7c3aed", bg: "rgba(124,58,237,0.08)", border: "rgba(124,58,237,0.2)" },
};

const PLAN_EMOJI: Record<string, string> = {
  SILVER: "🥈",
  GOLD: "⭐",
  PREMIUM: "💎",
};

function Confetti() {
  const [pieces, setPieces] = useState<Array<{ id: number; x: number; color: string; delay: number; size: number }>>([]);

  useEffect(() => {
    const colors = [GOLD, "#7c3aed", "#22c55e", "#f87171", "#60a5fa", "#f59e0b"];
    setPieces(
      Array.from({ length: 32 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: colors[i % colors.length],
        delay: Math.random() * 1.2,
        size: 6 + Math.random() * 6,
      }))
    );
  }, []);

  return (
    <>
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-60px) rotate(0deg); opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .confetti-piece {
          position: fixed;
          top: 0;
          animation: confettiFall 2.4s ease-in forwards;
          pointer-events: none;
          z-index: 10;
          border-radius: 2px;
        }
      `}</style>
      {pieces.map(p => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size * 0.5,
            background: p.color,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </>
  );
}

function ExitoContent() {
  const searchParams = useSearchParams();
  const planKey = (searchParams.get("plan") || "SILVER").toUpperCase();
  const planLabel = PLAN_LABELS[planKey] || planKey;
  const features = PLAN_FEATURES[planKey] || PLAN_FEATURES.SILVER;
  const colors = PLAN_COLORS[planKey] || PLAN_COLORS.SILVER;
  const emoji = PLAN_EMOJI[planKey] || "🎉";

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--adm-bg, #0d0d0d)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px 16px",
      fontFamily: "var(--font-body, system-ui, sans-serif)",
    }}>
      <Confetti />

      <div style={{
        maxWidth: 440,
        width: "100%",
        textAlign: "center",
        position: "relative",
        zIndex: 20,
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 32 }}>
          <a href="/" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontFamily: "Georgia, serif", fontSize: 18, color: GOLD }}>QuieroComer</span>
          </a>
        </div>

        {/* Card */}
        <div style={{
          background: "var(--adm-card, #1a1a1a)",
          border: `1px solid ${colors.border}`,
          borderRadius: 28,
          padding: "40px 32px 32px",
          boxShadow: `0 0 60px ${colors.accent}20`,
        }}>
          {/* Emoji badge */}
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: colors.bg,
            border: `2px solid ${colors.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 36, margin: "0 auto 20px",
          }}>
            {emoji}
          </div>

          {/* Title */}
          <h1 style={{
            fontFamily: "Georgia, serif",
            fontSize: "1.75rem",
            fontWeight: 400,
            color: "var(--adm-text, #f5f5f5)",
            margin: "0 0 10px",
            lineHeight: 1.25,
          }}>
            ¡Tu plan {planLabel} está activo!
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: "0.95rem",
            color: "var(--adm-text2, #aaa)",
            lineHeight: 1.6,
            margin: "0 0 28px",
          }}>
            Tu suscripción quedó registrada. Estas son las funciones que tienes disponibles ahora:
          </p>

          {/* Features */}
          <div style={{
            background: colors.bg,
            border: `1px solid ${colors.border}`,
            borderRadius: 16,
            padding: "16px 20px",
            marginBottom: 28,
            textAlign: "left",
          }}>
            {features.map((f, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "6px 0",
                borderBottom: i < features.length - 1 ? `1px solid ${colors.border}` : undefined,
              }}>
                <span style={{ color: colors.accent, fontWeight: 800, fontSize: "0.9rem", flexShrink: 0 }}>✓</span>
                <span style={{ fontSize: "0.88rem", color: "var(--adm-text, #e0e0e0)", lineHeight: 1.4 }}>{f}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <a
            href="/panel/suscripcion"
            style={{
              display: "block",
              width: "100%",
              padding: "15px 0",
              background: colors.accent,
              color: "#fff",
              fontFamily: "var(--font-display, system-ui, sans-serif)",
              fontSize: "0.95rem",
              fontWeight: 700,
              borderRadius: 999,
              textDecoration: "none",
              boxShadow: `0 4px 20px ${colors.accent}40`,
              boxSizing: "border-box",
            }}
          >
            Ir a mi panel
          </a>

          <p style={{ fontSize: "0.75rem", color: "var(--adm-text3, #555)", marginTop: 16, marginBottom: 0 }}>
            Puedes cancelar o cambiar de plan en cualquier momento desde tu panel.
          </p>
        </div>

        {/* Footer */}
        <p style={{ fontSize: "0.72rem", color: "var(--adm-text3, #444)", marginTop: 24 }}>
          Hecho en Chile · <a href="/" style={{ color: GOLD, textDecoration: "none" }}>quierocomer.com</a>
        </p>
      </div>
    </div>
  );
}

export default function SuscripcionExitoPage() {
  return (
    <Suspense>
      <ExitoContent />
    </Suspense>
  );
}
