"use client";

import { useState } from "react";
import Link from "next/link";

function OasisHero() {
  return (
    <svg aria-hidden="true" viewBox="0 0 1440 600" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0 }}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A8DEEF" />
          <stop offset="50%" stopColor="#C8E8D8" />
          <stop offset="100%" stopColor="#F2C571" />
        </linearGradient>
      </defs>
      <rect width="1440" height="600" fill="url(#sky)" />
      {/* Sun */}
      <circle cx="1150" cy="100" r="50" fill="#FFD86B" opacity="0.9" />
      {/* Clouds */}
      <g opacity="0.85">
        <ellipse cx="200" cy="120" rx="50" ry="16" fill="white" />
        <ellipse cx="240" cy="112" rx="40" ry="20" fill="white" />
        <ellipse cx="270" cy="120" rx="30" ry="12" fill="white" />
      </g>
      <g opacity="0.7">
        <ellipse cx="900" cy="80" rx="40" ry="14" fill="white" />
        <ellipse cx="935" cy="72" rx="32" ry="16" fill="white" />
        <ellipse cx="960" cy="80" rx="24" ry="10" fill="white" />
      </g>
      <g opacity="0.5">
        <ellipse cx="600" cy="150" rx="35" ry="12" fill="white" />
        <ellipse cx="630" cy="144" rx="28" ry="14" fill="white" />
      </g>
      {/* Sand dunes */}
      <path d="M0 380 Q360 300 720 350 Q1080 300 1440 370 L1440 480 L0 480Z" fill="#F2C571" />
      <path d="M0 430 Q480 350 800 410 Q1120 370 1440 420 L1440 540 L0 540Z" fill="#E8A942" />
      <path d="M0 480 Q400 430 720 470 Q1040 430 1440 475 L1440 600 L0 600Z" fill="#C78A2E" />
      {/* Palm trees */}
      <rect x="120" y="400" width="6" height="80" rx="3" fill="#5A3718" />
      <g transform="translate(123,400)">
        <path d="M0 0 Q-30 -20 -45 -8" stroke="#2E5010" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M0 0 Q-25 -30 -35 -20" stroke="#3D6B1C" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <path d="M0 0 Q22 -28 38 -10" stroke="#2E5010" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M0 0 Q18 -32 30 -22" stroke="#4A7C1C" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <path d="M0 0 Q-4 -35 0 -38" stroke="#3D6B1C" strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>
      <rect x="160" y="410" width="7" height="90" rx="3" fill="#6B4423" />
      <g transform="translate(163,410)">
        <path d="M0 0 Q-35 -22 -50 -8" stroke="#3D6B1C" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M0 0 Q-28 -32 -42 -20" stroke="#4A7C1C" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M0 0 Q28 -28 45 -10" stroke="#3D6B1C" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M0 0 Q22 -35 35 -22" stroke="#5A8E2A" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M0 0 Q-5 -40 -2 -44" stroke="#4A7C1C" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      </g>
      <rect x="1260" y="420" width="6" height="75" rx="3" fill="#6B4423" />
      <g transform="translate(1263,420)">
        <path d="M0 0 Q-28 -18 -40 -6" stroke="#3D6B1C" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M0 0 Q-22 -28 -32 -18" stroke="#5A8E2A" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <path d="M0 0 Q24 -22 38 -8" stroke="#4A7C1C" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M0 0 Q-3 -32 0 -36" stroke="#3D6B1C" strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>
      <rect x="1310" y="405" width="5" height="65" rx="2" fill="#5A3718" />
      <g transform="translate(1312,405)">
        <path d="M0 0 Q-20 -16 -30 -5" stroke="#2E5010" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M0 0 Q15 -20 26 -8" stroke="#4A7C1C" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M0 0 Q-3 -26 0 -28" stroke="#2E5010" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </g>
      {/* Water/oasis */}
      <ellipse cx="720" cy="560" rx="320" ry="35" fill="#3A9AB0" />
      <ellipse cx="720" cy="557" rx="310" ry="32" fill="#5BB5C8" />
      <path d="M550 552 Q600 548 650 552" stroke="white" strokeWidth="1.5" fill="none" opacity="0.35" />
      <path d="M700 558 Q750 554 800 558" stroke="white" strokeWidth="1.8" fill="none" opacity="0.3" />
      <path d="M620 564 Q670 560 720 564" stroke="white" strokeWidth="1.2" fill="none" opacity="0.25" />
      {/* Ground */}
      <rect x="0" y="580" width="1440" height="20" fill="#A06818" />
    </svg>
  );
}

const F = "var(--font-display)";
const B = "var(--font-body)";

const FEATURES_FREE = [
  "Menu digital con QR",
  "Vista simple de carta",
  "Genio recomendador con IA",
  "Experiencias interactivas",
];

const FEATURES_PREMIUM = [
  "3 vistas de carta (Clasica, Lista, Espacial)",
  "Estadisticas avanzadas de clientes",
  "Llamar al garzon desde la mesa",
  "Mailmarketing automatizado",
  "Multilenguaje (ES / EN / PT)",
  "Ofertas y etiquetas (Nuevo, Recomendado)",
  "Campanas automaticas (cumpleanos, promos)",
  "Recomendaciones inteligentes por gustos",
  "Banners y promos dinamicas",
  "Banner con cinta de anuncios",
  "Integracion con Toteat y Justo",
  "Automatizaciones por comportamiento",
];

const HIGHLIGHTS = [
  {
    icon: "🧞",
    title: "Genio con IA",
    desc: "Recomienda platos segun gustos, restricciones y preferencias de cada cliente. Aprende con cada visita.",
  },
  {
    icon: "📊",
    title: "Conoce a tu cliente",
    desc: "Cada sesion queda registrada: que vio, cuanto tiempo, que le gusto. Datos reales, no suposiciones.",
  },
  {
    icon: "🔔",
    title: "Llamar al garzon",
    desc: "Tu cliente aprieta un boton y el garzon recibe una notificacion al instante. Sin esperar.",
  },
  {
    icon: "📩",
    title: "Marketing que se envia solo",
    desc: "Emails automaticos por cumpleanos, inactividad o gustos. El sistema hace el trabajo por ti.",
  },
];

export default function LandingPage() {
  const [billingCycle] = useState<"monthly">("monthly");

  return (
    <div style={{ fontFamily: B, color: "#1a1a1a", background: "#FEFCF8" }}>

      {/* ── HERO ── */}
      <section style={{ position: "relative", minHeight: "min(600px, 85vh)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <OasisHero />
        <div style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "60px 24px 80px", maxWidth: 700 }}>
          <p style={{ fontSize: "3.2rem", marginBottom: 8, filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.15))" }}>🧞</p>
          <h1 style={{ fontFamily: F, fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 900, color: "#1a1a1a", lineHeight: 1.15, marginBottom: 16, textShadow: "0 1px 2px rgba(255,255,255,0.5)" }}>
            La carta digital que<br />entiende a tu cliente
          </h1>
          <p style={{ fontFamily: B, fontSize: "clamp(1rem, 2.5vw, 1.2rem)", color: "#4a4a4a", maxWidth: 500, margin: "0 auto 28px", lineHeight: 1.6, textShadow: "0 1px 2px rgba(255,255,255,0.4)" }}>
            Menu QR con inteligencia artificial, estadisticas de cada visita y marketing automatizado. Todo en un solo lugar.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/panel/login" style={{ display: "inline-block", padding: "14px 32px", background: "#F4A623", color: "#1a1a1a", borderRadius: 50, fontFamily: F, fontWeight: 700, fontSize: "0.95rem", textDecoration: "none", boxShadow: "0 4px 16px rgba(244,166,35,0.3)", transition: "transform 0.2s" }}>
              Empezar gratis
            </Link>
            <a href="#planes" style={{ display: "inline-block", padding: "14px 32px", background: "rgba(255,255,255,0.85)", color: "#1a1a1a", borderRadius: 50, fontFamily: F, fontWeight: 600, fontSize: "0.95rem", textDecoration: "none", border: "1px solid rgba(0,0,0,0.1)", backdropFilter: "blur(8px)" }}>
              Ver planes
            </a>
          </div>
        </div>
      </section>

      {/* ── HIGHLIGHTS ── */}
      <section style={{ padding: "80px 24px", maxWidth: 1000, margin: "0 auto" }}>
        <h2 style={{ fontFamily: F, fontSize: "clamp(1.4rem, 3vw, 2rem)", fontWeight: 800, textAlign: "center", marginBottom: 12, color: "#1a1a1a" }}>
          No es solo un menu, es un asistente
        </h2>
        <p style={{ textAlign: "center", color: "#888", fontSize: "1rem", marginBottom: 48, maxWidth: 500, margin: "0 auto 48px" }}>
          Tu carta trabaja por ti mientras tu te enfocas en la cocina.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
          {HIGHLIGHTS.map((h) => (
            <div key={h.title} style={{ padding: "28px 24px", background: "white", borderRadius: 16, border: "1px solid #f0e8d8", boxShadow: "0 1px 4px rgba(180,140,60,0.06)" }}>
              <span style={{ fontSize: "2rem", display: "block", marginBottom: 12 }}>{h.icon}</span>
              <h3 style={{ fontFamily: F, fontSize: "1.05rem", fontWeight: 700, marginBottom: 8, color: "#1a1a1a" }}>{h.title}</h3>
              <p style={{ fontSize: "0.88rem", color: "#777", lineHeight: 1.55, margin: 0 }}>{h.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── DEMO VISUAL ── */}
      <section style={{ padding: "60px 24px 80px", background: "white" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontFamily: F, fontSize: "clamp(1.3rem, 3vw, 1.8rem)", fontWeight: 800, marginBottom: 12, color: "#1a1a1a" }}>
            Asi se ve tu carta
          </h2>
          <p style={{ color: "#888", fontSize: "0.95rem", marginBottom: 32 }}>
            3 vistas para que cada cliente elija como explorar tu menu.
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            {[
              { name: "Clasica", desc: "Fotos grandes, scroll immersivo", emoji: "📸" },
              { name: "Lista", desc: "Compacta, rapida, por categorias", emoji: "📋" },
              { name: "Espacial", desc: "Experiencia 3D por categorias", emoji: "🚀" },
            ].map((v) => (
              <div key={v.name} style={{ flex: "1 1 200px", maxWidth: 240, padding: "32px 20px", background: "#FEFCF8", borderRadius: 16, border: "1px solid #f0e8d8" }}>
                <span style={{ fontSize: "2.2rem", display: "block", marginBottom: 12 }}>{v.emoji}</span>
                <h3 style={{ fontFamily: F, fontSize: "1rem", fontWeight: 700, marginBottom: 6 }}>{v.name}</h3>
                <p style={{ fontSize: "0.82rem", color: "#999", margin: 0 }}>{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLANES ── */}
      <section id="planes" style={{ padding: "80px 24px", maxWidth: 900, margin: "0 auto" }}>
        <h2 style={{ fontFamily: F, fontSize: "clamp(1.4rem, 3vw, 2rem)", fontWeight: 800, textAlign: "center", marginBottom: 8, color: "#1a1a1a" }}>
          Planes simples, sin letra chica
        </h2>
        <p style={{ textAlign: "center", color: "#888", fontSize: "0.95rem", marginBottom: 48 }}>
          Empieza gratis. Paga solo si quieres mas.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20, alignItems: "start" }}>
          {/* FREE */}
          <div style={{ padding: "32px 28px", background: "white", borderRadius: 20, border: "1px solid #e8e0d0" }}>
            <span style={{ fontFamily: F, fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#888", display: "block", marginBottom: 8 }}>Plan Gratis</span>
            <div style={{ fontFamily: F, fontSize: "2.4rem", fontWeight: 900, color: "#1a1a1a", marginBottom: 4 }}>$0</div>
            <p style={{ fontSize: "0.85rem", color: "#aaa", marginBottom: 24 }}>Para siempre</p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px" }}>
              {FEATURES_FREE.map((f) => (
                <li key={f} style={{ padding: "8px 0", fontSize: "0.9rem", color: "#555", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #f5f0e8" }}>
                  <span style={{ color: "#4ade80", fontSize: "0.8rem", flexShrink: 0 }}>&#10003;</span> {f}
                </li>
              ))}
            </ul>
            <Link href="/panel/login" style={{ display: "block", textAlign: "center", padding: "13px 0", background: "#f5f0e8", color: "#1a1a1a", borderRadius: 50, fontFamily: F, fontWeight: 700, fontSize: "0.88rem", textDecoration: "none" }}>
              Empezar gratis
            </Link>
          </div>

          {/* PREMIUM */}
          <div style={{ padding: "32px 28px", background: "linear-gradient(135deg, #FFF9ED 0%, #FFFBF5 100%)", borderRadius: 20, border: "2px solid #F4A623", position: "relative", boxShadow: "0 4px 20px rgba(244,166,35,0.12)" }}>
            <span style={{ position: "absolute", top: -12, right: 20, background: "#F4A623", color: "#1a1a1a", fontFamily: F, fontSize: "0.68rem", fontWeight: 800, padding: "4px 14px", borderRadius: 50, textTransform: "uppercase", letterSpacing: "0.08em" }}>Popular</span>
            <span style={{ fontFamily: F, fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#F4A623", display: "block", marginBottom: 8 }}>Plan Premium</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
              <span style={{ fontFamily: F, fontSize: "2.4rem", fontWeight: 900, color: "#1a1a1a" }}>1 UF</span>
              <span style={{ fontSize: "0.85rem", color: "#aaa" }}>/ mes</span>
            </div>
            <p style={{ fontSize: "0.82rem", color: "#aaa", marginBottom: 24 }}>~$39.000 CLP · ~$45 USD</p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px" }}>
              {FEATURES_PREMIUM.map((f) => (
                <li key={f} style={{ padding: "8px 0", fontSize: "0.9rem", color: "#555", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(244,166,35,0.12)" }}>
                  <span style={{ color: "#F4A623", fontSize: "0.8rem", flexShrink: 0 }}>&#10003;</span> {f}
                </li>
              ))}
            </ul>
            <Link href="/panel/login" style={{ display: "block", textAlign: "center", padding: "13px 0", background: "#F4A623", color: "#1a1a1a", borderRadius: 50, fontFamily: F, fontWeight: 700, fontSize: "0.88rem", textDecoration: "none", boxShadow: "0 2px 8px rgba(244,166,35,0.25)" }}>
              Activar Premium
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section style={{ padding: "60px 24px 80px", textAlign: "center", background: "white" }}>
        <p style={{ fontSize: "2.8rem", marginBottom: 12 }}>🧞</p>
        <h2 style={{ fontFamily: F, fontSize: "clamp(1.3rem, 3vw, 1.8rem)", fontWeight: 800, marginBottom: 12, color: "#1a1a1a" }}>
          Tu carta puede ser mucho mas
        </h2>
        <p style={{ color: "#888", fontSize: "0.95rem", marginBottom: 28, maxWidth: 400, margin: "0 auto 28px" }}>
          Empieza gratis hoy. Sin tarjeta, sin compromiso.
        </p>
        <Link href="/panel/login" style={{ display: "inline-block", padding: "14px 36px", background: "#F4A623", color: "#1a1a1a", borderRadius: 50, fontFamily: F, fontWeight: 700, fontSize: "0.95rem", textDecoration: "none", boxShadow: "0 4px 16px rgba(244,166,35,0.3)" }}>
          Crear mi carta gratis
        </Link>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ padding: "32px 24px", borderTop: "1px solid #f0e8d8", textAlign: "center" }}>
        <p style={{ fontFamily: F, fontSize: "0.82rem", color: "#bbb" }}>
          QuieroComer &copy; {new Date().getFullYear()} &middot; Hecho en Chile
        </p>
      </footer>
    </div>
  );
}
