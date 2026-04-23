"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

/* ─── Types ─── */
interface Logo { slug: string; name: string; logoUrl: string | null; color: string; initials: string; }

/* ─── Tooltip ─── */
function InfoTip({ text, dark }: { text: string; dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);
  const show = () => { if (timerRef.current) clearTimeout(timerRef.current); setOpen(true); };
  const hide = () => { timerRef.current = setTimeout(() => setOpen(false), 200); };
  return (
    <span ref={ref} style={{ position: "relative", display: "inline-flex", marginLeft: 6, flexShrink: 0 }}
      onMouseEnter={show} onMouseLeave={hide}>
      <button onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        style={{ width: 15, height: 15, borderRadius: "50%", border: "none", cursor: "help", background: dark ? "rgba(255,255,255,0.12)" : "#e8e3d8", color: dark ? "#aaa" : "#888", fontFamily: "Georgia,serif", fontStyle: "italic", fontSize: "9px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, lineHeight: 1 }}>i</button>
      {open && (
        <span style={{ position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", background: dark ? "#333" : "#1a1a1a", color: "#fff", padding: "8px 12px", borderRadius: 8, fontSize: "12px", lineHeight: 1.45, width: 220, zIndex: 50, boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>
          {text}
          <span style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: `6px solid ${dark ? "#333" : "#1a1a1a"}` }} />
        </span>
      )}
    </span>
  );
}

function Check({ color = "#d4a015" }: { color?: string }) {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 2 }}><path d="M3 7.5L5.5 10L11 4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/* ─── Desert SVG (full width) ─── */
function DesertSVG() {
  return (
    <div style={{ width: "100vw", marginLeft: "calc(-50vw + 50%)", marginTop: 20 }}>
      <svg viewBox="0 0 1440 260" preserveAspectRatio="none" style={{ display: "block", width: "100%", height: "auto" }}>
        <circle cx="1150" cy="60" r="26" fill="#fcd34d" opacity="0.85" />
        <path d="M0 180 L120 100 L240 160 L360 80 L480 140 L600 70 L720 130 L840 85 L960 150 L1080 75 L1200 120 L1320 90 L1440 110 L1440 260 L0 260Z" fill="#f59e0b" opacity="0.35" />
        <path d="M0 200 L160 140 L320 185 L480 130 L640 170 L800 120 L960 160 L1120 125 L1280 155 L1440 135 L1440 260 L0 260Z" fill="#d97706" opacity="0.45" />
        <path d="M0 225 Q360 200 720 220 Q1080 200 1440 225 L1440 260 L0 260Z" fill="#b45309" opacity="0.3" />
        <rect x="245" y="180" width="5" height="35" rx="2" fill="#3d5a2e" opacity="0.6" />
        <rect x="240" y="188" width="4" height="14" rx="2" fill="#3d5a2e" opacity="0.6" transform="rotate(-22 240 188)" />
        <rect x="252" y="185" width="4" height="16" rx="2" fill="#3d5a2e" opacity="0.6" transform="rotate(18 252 185)" />
        <rect x="1045" y="190" width="6" height="40" rx="3" fill="#3d5a2e" opacity="0.5" />
        <rect x="1039" y="200" width="4" height="16" rx="2" fill="#3d5a2e" opacity="0.5" transform="rotate(-25 1039 200)" />
        <rect x="1053" y="196" width="4" height="20" rx="2" fill="#3d5a2e" opacity="0.5" transform="rotate(18 1053 196)" />
        <rect x="0" y="235" width="1440" height="25" fill="#92400e" opacity="0.25" />
      </svg>
    </div>
  );
}

/* ─── Night Footer Dunes SVG ─── */
function FooterDunesSVG() {
  return (
    <>
    {/* Moon as separate SVG to keep it round */}
    <div style={{ position: "absolute", right: "15%", bottom: 110, width: 48, height: 48, zIndex: 2 }}>
      <svg viewBox="0 0 48 48" style={{ width: "100%", height: "100%" }}>
        <circle cx="24" cy="24" r="22" fill="#fef3c7" opacity="0.95" />
        <circle cx="24" cy="24" r="22" fill="url(#moonGlow)" opacity="0.3" />
        <defs><radialGradient id="moonGlow"><stop offset="0%" stopColor="#fff" /><stop offset="100%" stopColor="transparent" /></radialGradient></defs>
      </svg>
    </div>
    <svg viewBox="0 0 800 160" preserveAspectRatio="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, width: "100%", height: 140 }}>
      <path d="M0 100 Q100 70 200 90 Q300 60 400 85 Q500 55 600 80 Q700 65 800 75 L800 160 L0 160Z" fill="#1e1b4b" opacity="0.5" />
      <path d="M0 120 Q150 90 300 110 Q450 85 600 105 Q700 90 800 100 L800 160 L0 160Z" fill="#1e1b4b" opacity="0.7" />
      <path d="M0 140 Q200 120 400 135 Q600 120 800 140 L800 160 L0 160Z" fill="#1e1b4b" opacity="0.9" />
      <rect x="120" y="95" width="4" height="30" rx="2" fill="#1e1b4b" opacity="0.85" />
      <rect x="116" y="102" width="3" height="12" rx="1" fill="#1e1b4b" opacity="0.85" transform="rotate(-20 116 102)" />
      <rect x="126" y="100" width="3" height="14" rx="1" fill="#1e1b4b" opacity="0.85" transform="rotate(15 126 100)" />
      <rect x="680" y="85" width="5" height="35" rx="2" fill="#1e1b4b" opacity="0.85" />
      <rect x="675" y="93" width="3" height="14" rx="1" fill="#1e1b4b" opacity="0.85" transform="rotate(-22 675 93)" />
      <rect x="687" y="90" width="3" height="16" rx="1" fill="#1e1b4b" opacity="0.85" transform="rotate(18 687 90)" />
    </svg>
    </>
  );
}

/* ─── Main ─── */
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
    try { await fetch("/api/landing/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }); setSubmitted(true); } catch {}
    setSending(false);
  };

  const F = "var(--font-display)";
  const B = "var(--font-body)";

  return (
    <div style={{ fontFamily: B, color: "#111", background: "#ffffff", overflowX: "hidden" }}>

      {/* ══════ NAVBAR ══════ */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: scrolled ? "rgba(255,255,255,0.95)" : "transparent", borderBottom: scrolled ? "1px solid #eeeae0" : "1px solid transparent", backdropFilter: scrolled ? "blur(12px)" : undefined, transition: "all 0.25s" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <Link href="/" style={{ textDecoration: "none", fontFamily: F, fontSize: "1.1rem", fontWeight: 800 }}>
            <span style={{ color: "#111" }}>Quiero</span><span style={{ color: "#d4a015" }}>Comer</span>
          </Link>
          <div className="lnd-nav-desktop" style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <a href="#funcionalidades" style={{ fontSize: 13, color: "#555", textDecoration: "none", fontFamily: F, fontWeight: 500 }}>Funcionalidades</a>
            <a href="#planes" style={{ fontSize: 13, color: "#555", textDecoration: "none", fontFamily: F, fontWeight: 500 }}>Planes</a>
            <Link href="/panel/login" style={{ fontSize: 13, color: "#555", textDecoration: "none", fontFamily: F, fontWeight: 500 }}>Iniciar sesion</Link>
            <a href="#contacto" style={{ fontSize: 13, color: "#fff", background: "#111", padding: "8px 16px", borderRadius: 8, textDecoration: "none", fontFamily: F, fontWeight: 600 }}>Agendar demo</a>
          </div>
          <button className="lnd-nav-mobile" onClick={() => setMobileMenu(!mobileMenu)} style={{ display: "none", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round">
              {mobileMenu ? <><line x1="6" y1="6" x2="18" y2="18" /><line x1="6" y1="18" x2="18" y2="6" /></> : <><line x1="3" y1="7" x2="21" y2="7" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="17" x2="21" y2="17" /></>}
            </svg>
          </button>
        </div>
        {/* Mobile slide-in menu */}
        {mobileMenu && <div onClick={() => setMobileMenu(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 98 }} />}
        <div className="lnd-nav-mobile lnd-slide-menu" style={{ display: "none", position: "fixed", top: 0, right: 0, bottom: 0, width: 260, background: "#fff", zIndex: 99, flexDirection: "column", padding: "24px 24px 40px", boxShadow: "-4px 0 20px rgba(0,0,0,0.08)", transform: mobileMenu ? "translateX(0)" : "translateX(100%)", transition: "transform 0.3s ease" }}>
          <button onClick={() => setMobileMenu(false)} style={{ alignSelf: "flex-end", background: "none", border: "none", cursor: "pointer", marginBottom: 24, padding: 4 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="6" y1="18" x2="18" y2="6" /></svg>
          </button>
          <a href="#funcionalidades" onClick={() => setMobileMenu(false)} style={{ padding: "14px 0", fontSize: 15, color: "#333", textDecoration: "none", fontFamily: F, fontWeight: 600, borderBottom: "1px solid #f5f0e8" }}>Funcionalidades</a>
          <a href="#planes" onClick={() => setMobileMenu(false)} style={{ padding: "14px 0", fontSize: 15, color: "#333", textDecoration: "none", fontFamily: F, fontWeight: 600, borderBottom: "1px solid #f5f0e8" }}>Planes</a>
          <Link href="/panel/login" onClick={() => setMobileMenu(false)} style={{ padding: "14px 0", fontSize: 15, color: "#333", textDecoration: "none", fontFamily: F, fontWeight: 600, borderBottom: "1px solid #f5f0e8" }}>Iniciar sesion</Link>
          <a href="#contacto" onClick={() => setMobileMenu(false)} style={{ display: "block", marginTop: 20, textAlign: "center", padding: "12px 0", background: "#111", color: "#fff", borderRadius: 10, textDecoration: "none", fontFamily: F, fontWeight: 700, fontSize: 15 }}>Agendar demo</a>
        </div>
      </nav>

      {/* ══════ HERO ══════ */}
      <section style={{ background: "linear-gradient(180deg, #fff8e7 0%, #fef3c7 60%, #fde68a 100%)", paddingTop: 56 }}>
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "60px 24px 0", textAlign: "center" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.75)", backdropFilter: "blur(8px)", padding: "6px 14px", borderRadius: 999, border: "0.5px solid rgba(120,53,15,0.15)", fontSize: "12.5px", color: "#78350f", fontWeight: 500, marginBottom: 20 }}>
            <span style={{ animation: "lndFloat 2.5s ease-in-out infinite", display: "inline-block" }}>🧞</span> Impulsado por el Genio
          </span>
          <h1 style={{ fontFamily: F, fontSize: "clamp(30px, 5vw, 42px)", fontWeight: 700, letterSpacing: "-1.5px", lineHeight: 1.05, marginBottom: 18, color: "#111" }}>
            La carta digital que <span style={{ color: "#d4a015" }}>recomienda</span> y sube tu ticket
          </h1>
          <p style={{ fontFamily: B, fontSize: "clamp(15px, 2.5vw, 16px)", color: "#555", lineHeight: 1.5, maxWidth: 520, margin: "0 auto 28px" }}>
            Un garzon inteligente que aprende de cada cliente y lo guia hacia los platos que te convienen.
          </p>
          <a href="#contacto" style={{ display: "inline-block", padding: "12px 22px", background: "#111", color: "#fff", borderRadius: 10, fontFamily: F, fontWeight: 600, fontSize: 15, textDecoration: "none" }}>Agenda tu demo →</a>
        </div>
        <DesertSVG />
      </section>

      {/* ══════ LOGOS BAR ══════ */}
      <section style={{ background: "#faf6ee", borderTop: "1px solid #f5e6c8", borderBottom: "1px solid #eeeae0", padding: "32px 0" }}>
        <p style={{ fontSize: "11.5px", fontWeight: 600, color: "#999", letterSpacing: "1.5px", textTransform: "uppercase", textAlign: "center", marginBottom: 18, padding: "0 24px", fontFamily: F }}>
          Restaurantes que ya confian en QuieroComer
        </p>
        <div className="lnd-logos-track" style={{ position: "relative" }}>
          <div className="lnd-logos-scroll" style={{ overflowX: "auto", scrollSnapType: "x mandatory", padding: "6px 24px", WebkitOverflowScrolling: "touch" as any, scrollbarWidth: "none" as any }}>
            <div className="lnd-logos-row" style={{ display: "inline-flex", gap: 10, paddingRight: 40 }}>
              {logos.map((l) => (
                <a key={l.slug} href={`/qr/${l.slug}`} target="_blank" rel="noopener noreferrer"
                  className="lnd-logo-chip"
                  style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #f0ebe0", borderRadius: 999, padding: "8px 16px 8px 8px", textDecoration: "none", flexShrink: 0, scrollSnapAlign: "start", transition: "all 0.2s" }}>
                  {l.logoUrl ? (
                    <img src={l.logoUrl} alt={l.name} style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: l.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: F, fontSize: 12, fontWeight: 700 }}>{l.initials}</div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
                    <span style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: "#333" }}>{l.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#d4a015" }}>Ver carta →</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════ FEATURES ══════ */}
      <section id="funcionalidades" style={{ background: "#fff", padding: "60px 24px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ maxWidth: 580, margin: "0 auto 36px", textAlign: "center" }}>
            <p style={{ fontSize: 12, color: "#d4a015", textTransform: "uppercase", letterSpacing: "1.2px", fontWeight: 600, fontFamily: F, marginBottom: 10 }}>¿Por que QuieroComer?</p>
            <h2 style={{ fontFamily: F, fontSize: "clamp(26px, 3.5vw, 32px)", fontWeight: 700, letterSpacing: "-0.8px", marginBottom: 12, color: "#111" }}>Una carta que vende por ti</h2>
            <p style={{ fontSize: 16, color: "#666", lineHeight: 1.55 }}>Mas que un QR: una experiencia que convierte navegacion en ventas.</p>
          </div>

          {/* Genio Card */}
          <div className="lnd-genio-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, background: "#faf3e3", border: "1px solid #f5e6c8", borderRadius: 16, padding: "clamp(24px, 4vw, 32px)", marginBottom: 14 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                <div style={{ width: 42, height: 42, borderRadius: "50%", background: "linear-gradient(135deg, #fbbf24, #f59e0b)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: "0 2px 8px rgba(245,158,11,0.3)" }}>🧞</div>
                <h3 style={{ fontFamily: F, fontSize: "clamp(20px, 3vw, 22px)", fontWeight: 700, color: "#111", margin: 0 }}>El Genio, tu garzon 24/7</h3>
              </div>
              <p style={{ fontSize: 16, color: "#333", lineHeight: 1.55, marginBottom: 16, fontWeight: 400 }}>
                Preguntale en lenguaje natural. <strong style={{ color: "#111", fontWeight: 600 }}>Recomienda los platos que te convienen</strong>, aprende de cada cliente, y sube tu ticket.
              </p>
              <span style={{ display: "inline-block", background: "#fff", color: "#d4a015", border: "0.5px solid #f5e6c8", padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, fontFamily: F }}>+18% ticket promedio</span>
            </div>
            {/* Chat mock */}
            <div style={{ background: "#fff", borderRadius: 12, padding: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 12 }}>
                <div style={{ background: "#f3f0e8", color: "#3a3937", padding: "10px 14px", borderRadius: "10px 10px 3px 10px", fontSize: "13.5px", lineHeight: 1.45, maxWidth: "75%" }}>Tengo hambre pero no quiero algo pesado</div>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#e5e0d3", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: "#888", flexShrink: 0 }}>C</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg, #fbbf24, #f59e0b)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>🧞</div>
                <div>
                  <div style={{ background: "#fff8e7", color: "#78350f", padding: "10px 14px", borderRadius: "10px 10px 10px 3px", fontSize: "13.5px", lineHeight: 1.45, border: "0.5px solid #f5e6c8" }}>Te recomiendo el tiradito o el ceviche del dia.</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    {["🥗 Tiradito Manglar", "🐟 Ceviche del dia"].map((p) => (
                      <span key={p} style={{ background: "#fff", color: "#78350f", padding: "3px 9px", borderRadius: 6, fontSize: "11.5px", fontWeight: 600, border: "0.5px solid #f5e6c8" }}>{p}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4 Feature Cards */}
          <div className="lnd-features-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              { icon: "✨", title: "Diseño premium", desc: "Scroll horizontal por seccion, swipe entre fotos, hero con tu plato estrella.", grad: "linear-gradient(135deg, #fef3c7, #fbbf24)" },
              { icon: "⚡", title: "Carta viva", desc: "Al mediodia sube el almuerzo. Cuando llueve, platos calientes primero.", grad: "linear-gradient(135deg, #fee2e2, #f87171)" },
              { icon: "🔔", title: "Llamada al garzon", desc: "El cliente toca un boton y el garzon recibe notificacion al toque.", grad: "linear-gradient(135deg, #dbeafe, #60a5fa)" },
              { icon: "📊", title: "Estadisticas avanzadas", desc: "Que platos ven mas vs cuales piden. Que funciona los viernes de lluvia.", grad: "linear-gradient(135deg, #ddd6fe, #a78bfa)" },
            ].map((f) => (
              <div key={f.title} className="lnd-feature-card" style={{ background: "#fff", border: "1px solid #eeeae0", borderRadius: 14, padding: "22px 18px", transition: "all 0.25s" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: f.grad, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 14 }}>{f.icon}</div>
                <h4 style={{ fontFamily: F, fontSize: 15, fontWeight: 700, color: "#111", marginBottom: 6 }}>{f.title}</h4>
                <p style={{ fontSize: "12.5px", color: "#666", lineHeight: 1.5, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ PLANES ══════ */}
      <section id="planes" style={{ background: "#fefaf0", padding: "70px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ maxWidth: 580, margin: "0 auto 44px", textAlign: "center" }}>
            <p style={{ fontSize: 12, color: "#d4a015", textTransform: "uppercase", letterSpacing: "1.2px", fontWeight: 600, fontFamily: F, marginBottom: 10 }}>Planes</p>
            <h2 style={{ fontFamily: F, fontSize: "clamp(26px, 3.5vw, 34px)", fontWeight: 700, letterSpacing: "-0.8px", color: "#111" }}>Parte gratis. Crece cuando quieras.</h2>
          </div>
          <div className="lnd-plans-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, maxWidth: 780, margin: "0 auto" }}>
            {/* FREE */}
            <div style={{ background: "#fff", border: "1px solid #eeeae0", borderRadius: 14, padding: 28 }}>
              <p style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: "#666", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 8 }}>Gratis</p>
              <p style={{ fontFamily: F, fontSize: 36, fontWeight: 700, letterSpacing: "-1px", color: "#111", marginBottom: 2 }}>$0</p>
              <p style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>Para siempre</p>
              <a href="#contacto" style={{ display: "block", textAlign: "center", padding: "10px 14px", background: "#f3f0e8", color: "#111", borderRadius: 9, fontFamily: F, fontWeight: 600, fontSize: 14, textDecoration: "none", marginBottom: 20 }}>Empezar gratis</a>
              <div style={{ borderTop: "1px solid #eeeae0", paddingTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { t: "Menu digital QR", tip: "Tu carta accesible con un codigo QR desde la mesa" },
                  { t: "Vista simple", tip: "Layout clasico de carta digital: fotos, nombre, precio y descripcion" },
                  { t: "El Genio incluido 🧞", tip: "Tu garzon con IA que recomienda platos en lenguaje natural" },
                  { t: "Experiencias virales", tip: "Juegos tipo 'que pizza eres' que tus clientes comparten en redes, haciendo viral tu restaurante" },
                ].map((f) => (
                  <div key={f.t} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#555" }}><Check /> <span>{f.t}</span> <InfoTip text={f.tip} /></div>
                ))}
              </div>
            </div>
            {/* PREMIUM */}
            <div style={{ background: "#111", borderRadius: 14, padding: 28, position: "relative", color: "#fff" }}>
              <span style={{ position: "absolute", top: -10, right: 20, background: "#fbbf24", color: "#111", fontFamily: F, fontSize: "10.5px", fontWeight: 700, padding: "3px 10px", borderRadius: 999, letterSpacing: "0.5px", textTransform: "uppercase" }}>Recomendado</span>
              <p style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: "#fbbf24", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 8 }}>Premium</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 2 }}>
                <span style={{ fontFamily: F, fontSize: 36, fontWeight: 700, letterSpacing: "-1px" }}>1 UF</span>
                <span style={{ fontSize: 18, color: "#aaa", fontWeight: 500 }}>/mes</span>
              </div>
              <p style={{ fontSize: 13, color: "#aaa", marginBottom: 20 }}>$39.000 CLP · $45 USD</p>
              <a href="#contacto" style={{ display: "block", textAlign: "center", padding: "10px 14px", background: "#fbbf24", color: "#111", borderRadius: 9, fontFamily: F, fontWeight: 600, fontSize: 14, textDecoration: "none", marginBottom: 20 }}>Agendar demo</a>
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#e5e5e5" }}><Check color="#fbbf24" /> Todo lo del plan gratis</div>
                {[
                  { t: "3 vistas personalizables", tip: "Elige entre 3 estilos visuales de carta segun el tipo de restaurante" },
                  { t: "Destaca tus platos estrella", tip: "Marca platos como 'nuevo' o 'recomendado' con etiquetas visuales" },
                  { t: "Publicar ofertas del dia", tip: "Crea promociones temporales que aparecen destacadas en tu carta" },
                  { t: "Estadisticas avanzadas", tip: "Datos detallados: que platos leen mas, conversion, horas peak" },
                  { t: "Automatizaciones", tip: "Acciones que se ejecutan solas segun reglas que tu defines" },
                  { t: "Llamar al garzon", tip: "Tus clientes llaman al garzon desde su celular, sin levantarse" },
                  { t: "Multilenguaje ES · EN · PT", tip: "Tu carta traducida automaticamente a ingles y portugues" },
                  { t: "Banners y promos dinamicas", tip: "Cintas de anuncios y promociones que rotan segun horario y temporada" },
                  { t: "Campanas de clientes", tip: "Reconecta con clientes que no vuelven, felicita cumpleaneros, y fideliza en automatico" },
                ].map((f) => (
                  <div key={f.t} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#e5e5e5" }}><Check color="#fbbf24" /> <span>{f.t}</span> <InfoTip text={f.tip} dark /></div>
                ))}
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#e5e5e5" }}>
                  <Check color="#fbbf24" /> <span>Integracion con Toteat y Justo</span>
                  <span style={{ background: "rgba(251,191,36,0.25)", color: "#fbbf24", padding: "1px 6px", borderRadius: 4, fontSize: "9.5px", fontWeight: 700, letterSpacing: "0.3px", textTransform: "uppercase", marginLeft: 4 }}>Proximamente</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ CTA FINAL ══════ */}
      <section id="contacto" style={{ background: "#fff", padding: "80px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <h2 style={{ fontFamily: F, fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 700, letterSpacing: "-1px", lineHeight: 1.05, marginBottom: 14, color: "#111" }}>
            ¿Listo para probar<br />la carta que sube tu ticket?
          </h2>
          <p style={{ fontSize: 16, color: "#666", maxWidth: 480, margin: "0 auto 28px", lineHeight: 1.5 }}>
            Dejanos tu correo y te contactamos en 24 horas para mostrarte una demo.
          </p>
          {submitted ? (
            <p style={{ fontSize: 15, color: "#16a34a", fontWeight: 600, fontFamily: F }}>Recibido. Te contactamos pronto.</p>
          ) : (
            <form onSubmit={handleSubmit} className="lnd-cta-form" style={{ display: "flex", gap: 8, maxWidth: 440, margin: "0 auto" }}>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@restaurante.cl" required
                style={{ flex: 1, padding: "12px 16px", border: "1px solid #e5e0d3", borderRadius: 10, fontSize: 14, fontFamily: B, outline: "none", minWidth: 0 }} />
              <button type="submit" disabled={sending} style={{ padding: "12px 20px", background: "#111", color: "#fff", borderRadius: 10, border: "none", fontFamily: F, fontWeight: 600, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" }}>
                {sending ? "..." : "Quiero probar →"}
              </button>
            </form>
          )}
          <p style={{ fontSize: 12, color: "#999", marginTop: 14 }}>Sin tarjeta. Sin compromiso. Respuesta en menos de un dia.</p>
        </div>
      </section>

      {/* ══════ TRANSITION TO NIGHT ══════ */}
      <div style={{ height: 120, background: "linear-gradient(180deg, #ffffff 0%, #f5f0e8 20%, #e8d5b8 45%, #c9a87c 65%, #8b6b3d 80%, #4a3520 90%, #1e1b4b 100%)" }} />

      {/* ══════ FOOTER NOCHE ══════ */}
      <footer style={{ background: "linear-gradient(180deg, #1e1b4b 0%, #4c1d95 40%, #7e22ce 70%, #be185d 90%, #f97316 100%)", color: "#fff", padding: "60px 24px 24px", position: "relative", overflow: "hidden" }}>
        {/* Stars */}
        {[
          { l: 80, t: 20, s: 2, o: 0.7 }, { l: 200, t: 35, s: 3, o: 0.5 }, { l: 350, t: 15, s: 2, o: 0.9 },
          { l: 500, t: 40, s: 2, o: 0.6 }, { l: 650, t: 18, s: 3, o: 0.8 }, { l: 800, t: 30, s: 2, o: 0.5 },
          { l: 950, t: 22, s: 2, o: 0.7 }, { l: 1100, t: 45, s: 3, o: 0.6 },
        ].map((s, i) => (
          <div key={i} style={{ position: "absolute", left: s.l, top: s.t, width: s.s, height: s.s, borderRadius: "50%", background: "#fff", opacity: s.o, boxShadow: s.s === 3 ? "0 0 4px rgba(255,255,255,0.8)" : "none" }} />
        ))}
        <FooterDunesSVG />
        <div style={{ position: "relative", zIndex: 3, maxWidth: 960, margin: "0 auto" }}>
          {/* Top */}
          <div className="lnd-footer-top" style={{ display: "flex", justifyContent: "space-between", gap: 40, marginBottom: 40 }}>
            <div>
              <p style={{ fontFamily: F, fontSize: 22, fontWeight: 800, marginBottom: 10 }}>
                <span style={{ color: "#fff" }}>Quiero</span><span style={{ color: "#fbbf24" }}>Comer</span>
              </p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", maxWidth: 260, lineHeight: 1.5, margin: 0 }}>La carta digital que recomienda y sube tu ticket.</p>
            </div>
            <div className="lnd-footer-links" style={{ display: "flex", gap: 48 }}>
              <div>
                <h5 style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 12 }}>Producto</h5>
                <a href="#funcionalidades" style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.85)", textDecoration: "none", padding: "4px 0" }}>Funcionalidades</a>
                <a href="#planes" style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.85)", textDecoration: "none", padding: "4px 0" }}>Planes</a>
                <a href="#contacto" style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.85)", textDecoration: "none", padding: "4px 0" }}>Demo</a>
              </div>
              <div>
                <h5 style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 12 }}>Empresa</h5>
                <a href="#contacto" style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.85)", textDecoration: "none", padding: "4px 0" }}>Contacto</a>
                <span style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.45)", padding: "4px 0" }}>Privacidad</span>
                <span style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.45)", padding: "4px 0" }}>Terminos</span>
              </div>
            </div>
          </div>
          {/* Bottom */}
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 20, flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>&copy; 2026 QuieroComer.cl</span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Hecho en Chile 🇨🇱</span>
          </div>
        </div>
      </footer>

      {/* ══════ CSS ══════ */}
      <style>{`
        @keyframes lndFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        .lnd-logos-track::after { content: ''; position: absolute; right: 0; top: 0; bottom: 0; width: 40px; background: linear-gradient(to right, transparent, #faf6ee); pointer-events: none; z-index: 2; }
        .lnd-logos-scroll::-webkit-scrollbar { display: none; }
        @media (min-width: 769px) {
          .lnd-logos-scroll { display: flex !important; justify-content: center; }
          .lnd-logos-row { padding-right: 0 !important; }
          .lnd-logos-track::after { display: none; }
        }
        @media (max-width: 768px) { .lnd-slide-menu { display: flex !important; } }
        .lnd-logo-chip:hover { border-color: #d4a015 !important; transform: translateY(-1px); box-shadow: 0 2px 8px rgba(212,160,21,0.12); }
        .lnd-feature-card:hover { border-color: #d4a015 !important; transform: translateY(-3px); box-shadow: 0 4px 16px rgba(212,160,21,0.1); }
        @media (max-width: 768px) {
          .lnd-nav-desktop { display: none !important; }
          .lnd-nav-mobile { display: flex !important; }
          .lnd-genio-grid { grid-template-columns: 1fr !important; }
          .lnd-features-grid { grid-template-columns: 1fr 1fr !important; }
          .lnd-plans-grid { grid-template-columns: 1fr !important; }
          .lnd-cta-form { flex-direction: column !important; }
          .lnd-footer-top { flex-direction: column !important; }
          .lnd-footer-links { gap: 32px !important; }
        }
        @media (max-width: 480px) {
          .lnd-features-grid { grid-template-columns: 1fr !important; }
        }
        @media (min-width: 769px) {
          .lnd-nav-mobile { display: none !important; }
        }
      `}</style>
    </div>
  );
}
