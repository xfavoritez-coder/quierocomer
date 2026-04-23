"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

/* ─── Types ─── */
interface Logo {
  slug: string;
  name: string;
  logoUrl: string | null;
  color: string;
  initials: string;
}

/* ─── Tooltip ─── */
function InfoTip({ text, dark }: { text: string; dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  return (
    <span ref={ref} style={{ position: "relative", display: "inline-flex", marginLeft: 6, flexShrink: 0 }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        style={{
          width: 15, height: 15, borderRadius: "50%", border: "none", cursor: "help",
          background: dark ? "rgba(255,255,255,0.12)" : "#e8e3d8",
          color: dark ? "#aaa" : "#888",
          fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: "9px", fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 0, lineHeight: 1,
        }}
      >i</button>
      {open && (
        <span style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
          background: dark ? "#333" : "#1a1a1a", color: "#fff",
          padding: "8px 12px", borderRadius: 8, fontSize: "12px", lineHeight: 1.45,
          width: 220, zIndex: 50, boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
          pointerEvents: "none",
        }}>
          {text}
          <span style={{
            position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)",
            borderLeft: "6px solid transparent", borderRight: "6px solid transparent",
            borderTop: `6px solid ${dark ? "#333" : "#1a1a1a"}`,
          }} />
        </span>
      )}
    </span>
  );
}

/* ─── Check Icon ─── */
function Check({ color = "#d4a015" }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
      <path d="M3 7.5L5.5 10L11 4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── Desert SVG ─── */
function DesertSVG() {
  return (
    <svg viewBox="0 0 800 200" preserveAspectRatio="xMidYMid slice" style={{ width: "100%", display: "block" }}>
      <circle cx="640" cy="50" r="22" fill="#fcd34d" opacity="0.8" />
      <path d="M0 140 L80 80 L160 130 L240 70 L320 120 L400 60 L480 110 L560 75 L640 125 L720 65 L800 100 L800 200 L0 200Z" fill="#f59e0b" opacity="0.35" />
      <path d="M0 160 L100 120 L200 150 L300 110 L400 140 L500 100 L600 135 L700 105 L800 130 L800 200 L0 200Z" fill="#d97706" opacity="0.45" />
      <path d="M0 175 Q200 155 400 170 Q600 155 800 175 L800 200 L0 200Z" fill="#b45309" opacity="0.3" />
      {/* Cactus left */}
      <rect x="90" y="125" width="5" height="40" rx="2" fill="#3d5a2e" opacity="0.6" />
      <rect x="85" y="135" width="4" height="15" rx="2" fill="#3d5a2e" opacity="0.6" transform="rotate(-20 85 135)" />
      <rect x="97" y="130" width="4" height="18" rx="2" fill="#3d5a2e" opacity="0.6" transform="rotate(15 97 130)" />
      {/* Cactus right */}
      <rect x="700" y="115" width="6" height="50" rx="3" fill="#3d5a2e" opacity="0.5" />
      <rect x="694" y="128" width="4" height="18" rx="2" fill="#3d5a2e" opacity="0.5" transform="rotate(-25 694 128)" />
      <rect x="708" y="122" width="4" height="22" rx="2" fill="#3d5a2e" opacity="0.5" transform="rotate(18 708 122)" />
      <rect x="0" y="185" width="800" height="15" fill="#92400e" opacity="0.25" />
    </svg>
  );
}

/* ─── Main Component ─── */
export default function LandingClient({ logos }: { logos: Logo[] }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || sending) return;
    setSending(true);
    try {
      await fetch("/api/landing/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSubmitted(true);
    } catch {}
    setSending(false);
  };

  const F = "var(--font-display)";
  const B = "var(--font-body)";

  return (
    <div style={{ fontFamily: B, color: "#111", background: "#ffffff" }}>

      {/* ── NAVBAR ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: scrolled ? "rgba(255,255,255,0.95)" : "transparent",
        borderBottom: scrolled ? "1px solid #eeeae0" : "1px solid transparent",
        backdropFilter: scrolled ? "blur(12px)" : undefined,
        transition: "all 0.25s",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <Link href="/" style={{ textDecoration: "none", fontFamily: F, fontSize: "1.1rem", fontWeight: 800 }}>
            <span style={{ color: "#111" }}>Quiero</span><span style={{ color: "#d4a015" }}>Comer</span>
          </Link>

          {/* Desktop links */}
          <div className="landing-nav-desktop" style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <a href="#funcionalidades" style={{ fontSize: "13px", color: "#555", textDecoration: "none", fontFamily: F, fontWeight: 500 }}>Funcionalidades</a>
            <a href="#planes" style={{ fontSize: "13px", color: "#555", textDecoration: "none", fontFamily: F, fontWeight: 500 }}>Planes</a>
            <Link href="/panel/login" style={{ fontSize: "13px", color: "#555", textDecoration: "none", fontFamily: F, fontWeight: 500 }}>Iniciar sesion</Link>
            <a href="#contacto" style={{ fontSize: "13px", color: "#fff", background: "#111", padding: "8px 16px", borderRadius: 8, textDecoration: "none", fontFamily: F, fontWeight: 600 }}>Agendar demo</a>
          </div>

          {/* Mobile hamburger */}
          <button className="landing-nav-mobile" onClick={() => setMobileMenu(!mobileMenu)} style={{ display: "none", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round">
              {mobileMenu ? <><line x1="6" y1="6" x2="18" y2="18" /><line x1="6" y1="18" x2="18" y2="6" /></> : <><line x1="3" y1="7" x2="21" y2="7" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="17" x2="21" y2="17" /></>}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenu && (
          <div className="landing-nav-mobile" style={{ display: "none", flexDirection: "column", gap: 0, background: "#fff", borderBottom: "1px solid #eeeae0", padding: "8px 24px 16px" }}>
            <a href="#funcionalidades" onClick={() => setMobileMenu(false)} style={{ padding: "12px 0", fontSize: "14px", color: "#333", textDecoration: "none", fontFamily: F, fontWeight: 500, borderBottom: "1px solid #f5f0e8" }}>Funcionalidades</a>
            <a href="#planes" onClick={() => setMobileMenu(false)} style={{ padding: "12px 0", fontSize: "14px", color: "#333", textDecoration: "none", fontFamily: F, fontWeight: 500, borderBottom: "1px solid #f5f0e8" }}>Planes</a>
            <Link href="/panel/login" style={{ padding: "12px 0", fontSize: "14px", color: "#333", textDecoration: "none", fontFamily: F, fontWeight: 500, borderBottom: "1px solid #f5f0e8" }}>Iniciar sesion</Link>
            <a href="#contacto" onClick={() => setMobileMenu(false)} style={{ display: "block", marginTop: 8, textAlign: "center", padding: "10px 0", background: "#111", color: "#fff", borderRadius: 8, textDecoration: "none", fontFamily: F, fontWeight: 600, fontSize: "14px" }}>Agendar demo</a>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section style={{ background: "linear-gradient(180deg, #fff8e7 0%, #fef3c7 60%, #fde68a 100%)", paddingTop: 56 }}>
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "60px 24px 0", textAlign: "center" }}>
          {/* Badge */}
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.75)", backdropFilter: "blur(8px)",
            padding: "6px 14px", borderRadius: 999,
            border: "0.5px solid rgba(120,53,15,0.15)",
            fontSize: "12.5px", color: "#78350f", fontWeight: 500, marginBottom: 20,
          }}>
            🧞 Impulsado por el Genio
          </span>

          {/* H1 */}
          <h1 style={{
            fontFamily: F, fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 700,
            letterSpacing: "-1.5px", lineHeight: 1.05, marginBottom: 18, color: "#111",
          }}>
            La carta digital que{" "}<span style={{ color: "#d4a015" }}>recomienda</span>{" "}y sube tu ticket promedio
          </h1>

          {/* Subtitle */}
          <p style={{
            fontFamily: B, fontSize: "clamp(15px, 2.5vw, 17px)", color: "#555",
            lineHeight: 1.5, maxWidth: 520, margin: "0 auto 28px",
          }}>
            Carta QR Viva no es un PDF con QR. Es un garzon inteligente que aprende de cada cliente y lo guia hacia los platos que te convienen.
          </p>

          {/* CTAs */}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 40 }}>
            <a href="#contacto" style={{
              display: "inline-block", padding: "12px 22px", background: "#111", color: "#fff",
              borderRadius: 10, fontFamily: F, fontWeight: 600, fontSize: "15px", textDecoration: "none",
            }}>Agenda tu demo →</a>
            <a href="#funcionalidades" style={{
              display: "inline-block", padding: "12px 20px", background: "transparent", color: "#111",
              borderRadius: 10, fontFamily: F, fontWeight: 600, fontSize: "15px", textDecoration: "none",
              border: "1px solid rgba(17,17,17,0.2)",
            }}>Ver como funciona</a>
          </div>
        </div>

        {/* Desert SVG */}
        <DesertSVG />
      </section>

      {/* ── SOCIAL PROOF BAR ── */}
      <section style={{ background: "#fff", borderTop: "1px solid #f5e6c8", borderBottom: "1px solid #f5e6c8", padding: "40px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: "11.5px", fontWeight: 600, color: "#999", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 20, fontFamily: F }}>
            Restaurantes que ya confian en QuieroComer
          </p>
          <div style={{ display: "flex", gap: 40, justifyContent: "center", flexWrap: "wrap", alignItems: "center" }}>
            {logos.map((l) => (
              <a
                key={l.slug}
                href={`/qr/${l.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", opacity: 0.75, transition: "opacity 0.2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.75")}
              >
                {l.logoUrl ? (
                  <img src={l.logoUrl} alt={l.name} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: l.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: F, fontSize: "12px", fontWeight: 700 }}>
                    {l.initials}
                  </div>
                )}
                <span style={{ fontFamily: F, fontSize: "15px", fontWeight: 700, color: "#333" }}>{l.name}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="funcionalidades" style={{ background: "#fff", padding: "70px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          {/* Header */}
          <div style={{ maxWidth: 580, margin: "0 auto 44px", textAlign: "center" }}>
            <p style={{ fontSize: "12px", color: "#d4a015", textTransform: "uppercase", letterSpacing: "1.2px", fontWeight: 600, fontFamily: F, marginBottom: 10 }}>¿Por que QuieroComer?</p>
            <h2 style={{ fontFamily: F, fontSize: "clamp(26px, 3.5vw, 34px)", fontWeight: 700, letterSpacing: "-0.8px", marginBottom: 12, color: "#111" }}>Una carta que vende por ti</h2>
            <p style={{ fontSize: "16px", color: "#666", lineHeight: 1.55 }}>Mientras otros QR solo muestran tu menu, el nuestro entiende al cliente y lo guia al plato indicado.</p>
          </div>

          {/* Genio Card */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, background: "#faf3e3", border: "1px solid #f5e6c8", borderRadius: 16, padding: "clamp(24px, 4vw, 36px)", marginBottom: 20 }} className="landing-genio-grid">
            {/* Left */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                <div style={{ width: 42, height: 42, borderRadius: "50%", background: "linear-gradient(135deg, #fbbf24, #f59e0b)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", boxShadow: "0 2px 8px rgba(245,158,11,0.3)" }}>🧞</div>
                <h3 style={{ fontFamily: F, fontSize: "clamp(20px, 3vw, 24px)", fontWeight: 700, color: "#111", margin: 0 }}>El Genio, tu garzon 24/7</h3>
              </div>
              <p style={{ fontSize: "14.5px", color: "#555", lineHeight: 1.55, marginBottom: 16 }}>
                Tus clientes le preguntan en lenguaje natural. Aprende de sus preferencias, restricciones y antojos. Sube el ticket promedio recomendando los platos que mas te convienen.
              </p>
              <span style={{ display: "inline-block", background: "#fff", color: "#d4a015", border: "0.5px solid #f5e6c8", padding: "4px 10px", borderRadius: 6, fontSize: "12px", fontWeight: 600, fontFamily: F }}>+18% ticket promedio</span>
            </div>
            {/* Right — Chat mock */}
            <div style={{ background: "#fff", borderRadius: 12, padding: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              {/* User message */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 12 }}>
                <div style={{ background: "#f3f0e8", color: "#3a3937", padding: "10px 14px", borderRadius: "10px 10px 3px 10px", fontSize: "13.5px", lineHeight: 1.45, maxWidth: "75%" }}>
                  Tengo hambre pero no quiero algo pesado
                </div>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#e5e0d3", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: "#888", flexShrink: 0 }}>C</div>
              </div>
              {/* Genio message */}
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg, #fbbf24, #f59e0b)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", flexShrink: 0 }}>🧞</div>
                <div>
                  <div style={{ background: "#fff8e7", color: "#78350f", padding: "10px 14px", borderRadius: "10px 10px 10px 3px", fontSize: "13.5px", lineHeight: 1.45, border: "0.5px solid #f5e6c8" }}>
                    Para algo liviano y sabroso, te recomiendo el tiradito o el ceviche del dia.
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    {["🥗 Tiradito Manglar", "🐟 Ceviche del dia"].map((p) => (
                      <span key={p} style={{ background: "#fff", color: "#78350f", padding: "3px 9px", borderRadius: 6, fontSize: "11.5px", fontWeight: 600, border: "0.5px solid #f5e6c8" }}>{p}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3 Feature Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }} className="landing-features-grid">
            {[
              { icon: "📊", title: "Estadisticas reales", desc: "Mira que platos leen mas, cuales convierten, y en que horas tienes mas consultas." },
              { icon: "🌎", title: "Multilenguaje", desc: "Español, ingles y portugues automatico. Nunca mas traduces cartas a mano." },
              { icon: "🎉", title: "Experiencias virales", desc: "Juegos como '¿que pizza eres?' que tus clientes comparten en redes." },
            ].map((f) => (
              <div key={f.title} style={{ background: "#fff", border: "1px solid #eeeae0", borderRadius: 12, padding: 22 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", marginBottom: 12 }}>{f.icon}</div>
                <h4 style={{ fontFamily: F, fontSize: "15px", fontWeight: 700, color: "#111", marginBottom: 6 }}>{f.title}</h4>
                <p style={{ fontSize: "13px", color: "#666", lineHeight: 1.5, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLANES ── */}
      <section id="planes" style={{ background: "#fefaf0", padding: "70px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ maxWidth: 580, margin: "0 auto 44px", textAlign: "center" }}>
            <p style={{ fontSize: "12px", color: "#d4a015", textTransform: "uppercase", letterSpacing: "1.2px", fontWeight: 600, fontFamily: F, marginBottom: 10 }}>Planes</p>
            <h2 style={{ fontFamily: F, fontSize: "clamp(26px, 3.5vw, 34px)", fontWeight: 700, letterSpacing: "-0.8px", color: "#111" }}>Parte gratis. Crece cuando quieras.</h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, maxWidth: 780, margin: "0 auto" }} className="landing-plans-grid">
            {/* FREE */}
            <div style={{ background: "#fff", border: "1px solid #eeeae0", borderRadius: 14, padding: 28 }}>
              <p style={{ fontFamily: F, fontSize: "14px", fontWeight: 700, color: "#666", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 8 }}>Gratis</p>
              <p style={{ fontFamily: F, fontSize: "36px", fontWeight: 700, letterSpacing: "-1px", color: "#111", marginBottom: 2 }}>$0</p>
              <p style={{ fontSize: "13px", color: "#888", marginBottom: 20 }}>Para siempre</p>
              <a href="#contacto" style={{ display: "block", textAlign: "center", padding: "10px 14px", background: "#f3f0e8", color: "#111", borderRadius: 9, fontFamily: F, fontWeight: 600, fontSize: "14px", textDecoration: "none", marginBottom: 20 }}>Empezar gratis</a>
              <div style={{ borderTop: "1px solid #eeeae0", paddingTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { t: "Menu digital QR", tip: "Tu carta accesible con un codigo QR desde la mesa" },
                  { t: "Vista simple", tip: "Layout clasico de carta digital: fotos, nombre, precio y descripcion" },
                  { t: "El Genio incluido 🧞", tip: "Tu garzon con IA que recomienda platos en lenguaje natural" },
                  { t: "Experiencias virales", tip: "Juegos tipo 'que pizza eres' que tus clientes comparten en redes, haciendo viral tu restaurante" },
                ].map((f) => (
                  <div key={f.t} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "14px", color: "#555" }}>
                    <Check /> <span>{f.t}</span> <InfoTip text={f.tip} />
                  </div>
                ))}
              </div>
            </div>

            {/* PREMIUM */}
            <div style={{ background: "#111", borderRadius: 14, padding: 28, position: "relative", color: "#fff" }}>
              <span style={{ position: "absolute", top: -10, right: 20, background: "#fbbf24", color: "#111", fontFamily: F, fontSize: "10.5px", fontWeight: 700, padding: "3px 10px", borderRadius: 999, letterSpacing: "0.5px", textTransform: "uppercase" }}>Recomendado</span>
              <p style={{ fontFamily: F, fontSize: "14px", fontWeight: 700, color: "#fbbf24", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 8 }}>Premium</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 2 }}>
                <span style={{ fontFamily: F, fontSize: "36px", fontWeight: 700, letterSpacing: "-1px" }}>1 UF</span>
                <span style={{ fontSize: "18px", color: "#aaa" }}>/mes</span>
              </div>
              <p style={{ fontSize: "13px", color: "#aaa", marginBottom: 20 }}>$39.000 CLP · $45 USD</p>
              <a href="#contacto" style={{ display: "block", textAlign: "center", padding: "10px 14px", background: "#fbbf24", color: "#111", borderRadius: 9, fontFamily: F, fontWeight: 600, fontSize: "14px", textDecoration: "none", marginBottom: 20 }}>Agendar demo</a>
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "14px", color: "#e5e5e5" }}><Check color="#fbbf24" /> Todo lo del plan gratis</div>
                {[
                  { t: "3 vistas personalizables", tip: "Elige entre 3 estilos visuales de carta segun el tipo de restaurante" },
                  { t: "Destaca tus platos estrella", tip: "Marca platos como 'nuevo' o 'recomendado' con etiquetas visuales que captan la atencion al toque" },
                  { t: "Publicar ofertas del dia", tip: "Crea promociones temporales que aparecen destacadas en tu carta" },
                  { t: "Estadisticas avanzadas", tip: "Datos detallados de comportamiento: que platos leen mas, conversion, horas peak" },
                  { t: "Automatizaciones", tip: "Acciones que se ejecutan solas segun reglas que tu defines" },
                  { t: "Llamar al garzon", tip: "Tus clientes pueden llamar al garzon desde su celular, sin levantarse" },
                  { t: "Multilenguaje ES · EN · PT", tip: "Tu carta traducida automaticamente a ingles y portugues" },
                  { t: "Banners y promos dinamicas", tip: "Cintas de anuncios y promociones que rotan en la carta segun horario y temporada" },
                  { t: "Campanas de clientes", tip: "Reconecta con clientes que no vuelven, felicita cumpleañeros, y fideliza en automatico" },
                ].map((f) => (
                  <div key={f.t} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "14px", color: "#e5e5e5" }}>
                    <Check color="#fbbf24" /> <span>{f.t}</span> <InfoTip text={f.tip} dark />
                  </div>
                ))}
                {/* Toteat */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "14px", color: "#e5e5e5" }}>
                  <Check color="#fbbf24" /> <span>Integracion con Toteat y Justo</span>
                  <span style={{ background: "rgba(251,191,36,0.25)", color: "#fbbf24", padding: "1px 6px", borderRadius: 4, fontSize: "9.5px", fontWeight: 700, letterSpacing: "0.3px", textTransform: "uppercase", marginLeft: 4 }}>Proximamente</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section id="contacto" style={{ background: "#fff", padding: "80px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <h2 style={{ fontFamily: F, fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 700, letterSpacing: "-1px", lineHeight: 1.05, marginBottom: 14, color: "#111" }}>
            ¿Listo para probar la carta<br />que sube tu ticket?
          </h2>
          <p style={{ fontSize: "16px", color: "#666", maxWidth: 480, margin: "0 auto 28px", lineHeight: 1.5 }}>
            Dejanos tu correo y te contactamos en 24 horas para mostrarte una demo.
          </p>
          {submitted ? (
            <p style={{ fontSize: "15px", color: "#16a34a", fontWeight: 600, fontFamily: F }}>Recibido. Te contactamos pronto.</p>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, maxWidth: 440, margin: "0 auto" }} className="landing-cta-form">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@restaurante.cl"
                required
                style={{ flex: 1, padding: "12px 16px", border: "1px solid #e5e0d3", borderRadius: 10, fontSize: "14px", fontFamily: B, outline: "none", minWidth: 0 }}
              />
              <button type="submit" disabled={sending} style={{ padding: "12px 20px", background: "#111", color: "#fff", borderRadius: 10, border: "none", fontFamily: F, fontWeight: 600, fontSize: "14px", cursor: "pointer", whiteSpace: "nowrap" }}>
                {sending ? "..." : "Quiero probar →"}
              </button>
            </form>
          )}
          <p style={{ fontSize: "12px", color: "#999", marginTop: 14 }}>Sin tarjeta. Sin compromiso. Respuesta en menos de un dia.</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: "#fefaf0", padding: "40px 24px", borderTop: "1px solid #f5e6c8" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <span style={{ fontFamily: F, fontWeight: 800, fontSize: "0.95rem" }}>
            <span style={{ color: "#111" }}>Quiero</span><span style={{ color: "#d4a015" }}>Comer</span>
          </span>
          <p style={{ fontSize: "12px", color: "#999", margin: 0 }}>&copy; {new Date().getFullYear()} QuieroComer.cl · Hecho en Chile</p>
        </div>
      </footer>

      {/* ── RESPONSIVE CSS ── */}
      <style>{`
        @media (max-width: 768px) {
          .landing-nav-desktop { display: none !important; }
          .landing-nav-mobile { display: flex !important; }
          .landing-genio-grid { grid-template-columns: 1fr !important; }
          .landing-features-grid { grid-template-columns: 1fr !important; }
          .landing-plans-grid { grid-template-columns: 1fr !important; }
          .landing-cta-form { flex-direction: column !important; }
        }
        @media (min-width: 769px) {
          .landing-nav-mobile { display: none !important; }
        }
      `}</style>
    </div>
  );
}
