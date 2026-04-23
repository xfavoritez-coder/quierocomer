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
        {/* Distant walking figure */}
        <g className="lnd-walker" opacity="0.55" fill="#3a2010" transform="scale(1.6)">
          {/* Head */}
          <circle r="3" />
          {/* Body */}
          <line x1="0" y1="3" x2="0" y2="12" stroke="#5a3718" strokeWidth="1.8" strokeLinecap="round" />
          {/* Legs — slight walk pose */}
          <line x1="0" y1="12" x2="-2.5" y2="18" stroke="#5a3718" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="0" y1="12" x2="2" y2="18" stroke="#5a3718" strokeWidth="1.5" strokeLinecap="round" />
          {/* Arms */}
          <line x1="0" y1="6" x2="-3" y2="10" stroke="#5a3718" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="0" y1="6" x2="2.5" y2="9" stroke="#5a3718" strokeWidth="1.2" strokeLinecap="round" />
          {/* Hat brim */}
          <ellipse cx="0" cy="-2" rx="4.5" ry="1" />
        </g>
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
        {/* Mobile dropdown menu */}
        {mobileMenu && (
          <div className="lnd-nav-mobile" style={{ display: "none", flexDirection: "column", background: "#fff", borderBottom: "1px solid #eeeae0", padding: "4px 24px 16px" }}>
            <a href="#funcionalidades" onClick={() => setMobileMenu(false)} style={{ padding: "14px 0", fontSize: 15, color: "#333", textDecoration: "none", fontFamily: F, fontWeight: 600, borderBottom: "1px solid #f5f0e8" }}>Funcionalidades</a>
            <a href="#planes" onClick={() => setMobileMenu(false)} style={{ padding: "14px 0", fontSize: 15, color: "#333", textDecoration: "none", fontFamily: F, fontWeight: 600, borderBottom: "1px solid #f5f0e8" }}>Planes</a>
            <Link href="/panel/login" onClick={() => setMobileMenu(false)} style={{ padding: "14px 0", fontSize: 15, color: "#333", textDecoration: "none", fontFamily: F, fontWeight: 600, borderBottom: "1px solid #f5f0e8" }}>Iniciar sesion</Link>
            <a href="#contacto" onClick={() => setMobileMenu(false)} style={{ display: "block", marginTop: 12, textAlign: "center", padding: "12px 0", background: "#111", color: "#fff", borderRadius: 10, textDecoration: "none", fontFamily: F, fontWeight: 700, fontSize: 15 }}>Agendar demo</a>
          </div>
        )}
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
          <div className="lnd-logos-scroll" style={{ overflowX: "auto", padding: "6px 0", scrollbarWidth: "none" as any }}>
            <div className="lnd-logos-row" style={{ display: "flex", gap: 10, width: "max-content", paddingLeft: 24, paddingRight: 24 }}>
              {logos.map((l) => (
                <a key={l.slug} href={`/qr/${l.slug}`} target="_blank" rel="noopener noreferrer"
                  className="lnd-logo-chip"
                  style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: "1px solid #f0ebe0", borderRadius: 999, padding: "10px 20px 10px 10px", textDecoration: "none", flexShrink: 0, scrollSnapAlign: "start", transition: "all 0.2s" }}>
                  {l.logoUrl ? (
                    <img src={l.logoUrl} alt={l.name} style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: l.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: F, fontSize: 14, fontWeight: 700 }}>{l.initials}</div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
                    <span style={{ fontFamily: F, fontSize: 15, fontWeight: 700, color: "#333" }}>{l.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#d4a015" }}>Ver carta →</span>
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
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <span style={{ fontSize: 32, display: "block", marginBottom: 10 }}>🧞</span>
                <h3 style={{ fontFamily: F, fontSize: "clamp(22px, 3vw, 25px)", fontWeight: 700, color: "#111", margin: 0 }}>El Genio, tu garzón 24/7</h3>
              </div>
              <p style={{ fontSize: 16, color: "#333", lineHeight: 1.55, marginBottom: 16, fontWeight: 400, textAlign: "center" }}>
                Tus clientes le preguntan qué comer y el Genio les recomienda según sus gustos, restricciones y lo que tengas disponible. <strong style={{ color: "#111", fontWeight: 600 }}>Cada visita, mejores recomendaciones.</strong>
              </p>
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
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    {/* Tiradito Manglar */}
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#fff", border: "0.5px solid #f5e6c8", padding: "6px 10px 6px 6px", borderRadius: 8, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                      <div style={{ width: 20, height: 20, borderRadius: 4, background: "linear-gradient(135deg, #fef3c7, #fbbf24)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg width="12" height="12" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="#fff" stroke="#d4a015" strokeWidth="1" /><path d="M5 6 Q8 5 11 6 Q11 9 8 10 Q5 9 5 6Z" fill="#fca5a5" /><circle cx="7" cy="7" r="0.8" fill="#d4a015" /></svg>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#78350f", lineHeight: 1.1 }}>Tiradito Manglar</span>
                        <span style={{ fontSize: 9, color: "#999", fontWeight: 600, lineHeight: 1.1, marginTop: 1 }}>$12.899</span>
                      </div>
                    </div>
                    {/* Ceviche del día */}
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#fff", border: "0.5px solid #f5e6c8", padding: "6px 10px 6px 6px", borderRadius: 8, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                      <div style={{ width: 20, height: 20, borderRadius: 4, background: "linear-gradient(135deg, #dbeafe, #60a5fa)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg width="12" height="12" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="#fff" stroke="#2563eb" strokeWidth="1" /><path d="M4 9 Q8 6 12 9 Q11 11 8 11 Q5 11 4 9Z" fill="#60a5fa" /><circle cx="8" cy="7" r="0.6" fill="#fff" /></svg>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#78350f", lineHeight: 1.1 }}>Ceviche del día</span>
                        <span style={{ fontSize: 9, color: "#999", fontWeight: 600, lineHeight: 1.1, marginTop: 1 }}>$14.500</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Separator */}
          <div style={{ maxWidth: 520, margin: "clamp(40px, 6vw, 60px) auto 28px", textAlign: "center", padding: "0 20px" }}>
            <h3 style={{ fontFamily: F, fontSize: "clamp(22px, 3vw, 26px)", fontWeight: 700, color: "#111", letterSpacing: "-0.6px", lineHeight: 1.15, margin: "0 0 8px" }}>No es solo el Genio</h3>
            <p style={{ fontSize: "clamp(14px, 2vw, 15px)", color: "#666", lineHeight: 1.5, margin: 0 }}>Estas son otras cosas que tu carta hace por ti.</p>
          </div>

          {/* 4 Feature Cards */}
          <div className="lnd-features-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            {/* Card 1: Diseño premium */}
            <div className="lnd-feature-card" style={{ background: "#fff", border: "1px solid #eeeae0", borderRadius: 18, padding: 20, transition: "all 0.25s" }}>
              <div style={{ background: "linear-gradient(135deg, #fef3c7, #fde68a)", borderRadius: 12, height: 100, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <svg viewBox="0 0 200 100" width="180" height="80">
                  {[{ x: 10, c: "#f59e0b" }, { x: 72, c: "#dc2626" }, { x: 134, c: "#1a5f3f" }].map((card, i) => (
                    <g key={i}>
                      <rect x={card.x} y={15} width={55} height={70} rx={8} fill="#fff" stroke="#fbbf24" strokeWidth={1.5} />
                      <circle cx={card.x + 27} cy={40} r={12} fill={card.c} opacity={0.55} />
                      <rect x={card.x + 10} y={58} width={35} height={3} rx={1.5} fill="#d4a015" opacity={0.5} />
                      <rect x={card.x + 14} y={65} width={25} height={2} rx={1} fill="#d4a015" opacity={0.3} />
                    </g>
                  ))}
                  <path d="M193 46 L197 50 L193 54" stroke="#d4a015" strokeWidth={1.5} fill="none" strokeLinecap="round" opacity={0.5} />
                </svg>
              </div>
              <h4 style={{ fontFamily: F, fontSize: 15, fontWeight: 700, color: "#111", marginBottom: 6 }}>Diseño premium</h4>
              <p style={{ fontSize: "12.5px", color: "#666", lineHeight: 1.5, margin: 0 }}>Scroll horizontal por sección, swipe entre fotos, hero con tu plato estrella.</p>
            </div>

            {/* Card 2: Carta viva */}
            <div className="lnd-feature-card" style={{ background: "#fff", border: "1px solid #eeeae0", borderRadius: 18, padding: 20, transition: "all 0.25s" }}>
              <div style={{ background: "linear-gradient(135deg, #fef2f2, #fecaca)", borderRadius: 12, height: 100, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <svg viewBox="0 0 200 110" width="180" height="100">
                  {/* Morning card */}
                  <g transform="translate(20,20) rotate(-8)">
                    <rect width={45} height={65} rx={6} fill="#fff" stroke="#fca5a5" strokeWidth={1.5} />
                    <circle cx={22} cy={15} r={6} fill="#fbbf24" /><line x1={28} y1={13} x2={32} y2={11} stroke="#f59e0b" strokeWidth={1} /><line x1={28} y1={17} x2={32} y2={19} stroke="#f59e0b" strokeWidth={1} />
                    <rect x={8} y={28} width={28} height={2.5} rx={1} fill="#fca5a5" opacity={0.5} />
                    <rect x={8} y={34} width={20} height={2} rx={1} fill="#fca5a5" opacity={0.35} />
                    <rect x={8} y={40} width={24} height={2} rx={1} fill="#fca5a5" opacity={0.35} />
                  </g>
                  {/* Active card (center) */}
                  <g transform="translate(78,13)">
                    <rect width={48} height={78} rx={7} fill="#fff" stroke="#dc2626" strokeWidth={2.5} />
                    <circle cx={24} cy={18} r={8} fill="#fbbf24" />
                    <text x={24} y={42} textAnchor="middle" fontSize={6} fontWeight={700} fill="#991b1b">ALMUERZO</text>
                    <rect x={8} y={50} width={32} height={2.5} rx={1} fill="#dc2626" opacity={0.4} />
                    <rect x={8} y={56} width={24} height={2} rx={1} fill="#fca5a5" opacity={0.4} />
                    <rect x={8} y={62} width={28} height={2} rx={1} fill="#fca5a5" opacity={0.3} />
                    {/* Sparkle */}
                    <path d="M44 5 L45.5 0 L47 5 L52 6.5 L47 8 L45.5 13 L44 8 L39 6.5 Z" fill="#fbbf24" />
                  </g>
                  {/* Night card */}
                  <g transform="translate(138,20) rotate(8)">
                    <rect width={45} height={65} rx={6} fill="#fff" stroke="#fca5a5" strokeWidth={1.5} />
                    <path d="M18 11 Q12 11 12 17 Q12 23 18 23 Q15 17 18 11 Z" fill="#7c3aed" />
                    <rect x={8} y={30} width={28} height={2.5} rx={1} fill="#fca5a5" opacity={0.5} />
                    <rect x={8} y={36} width={20} height={2} rx={1} fill="#fca5a5" opacity={0.35} />
                    <rect x={8} y={42} width={24} height={2} rx={1} fill="#fca5a5" opacity={0.35} />
                  </g>
                </svg>
              </div>
              <h4 style={{ fontFamily: F, fontSize: 15, fontWeight: 700, color: "#111", marginBottom: 6 }}>Carta viva</h4>
              <p style={{ fontSize: "12.5px", color: "#666", lineHeight: 1.5, margin: 0 }}>Al mediodía sube el almuerzo. Cuando llueve, platos calientes primero.</p>
            </div>

            {/* Card 3: Llamada al garzón */}
            <div className="lnd-feature-card" style={{ background: "#fff", border: "1px solid #eeeae0", borderRadius: 18, padding: 20, transition: "all 0.25s" }}>
              <div style={{ background: "linear-gradient(135deg, #eff6ff, #bfdbfe)", borderRadius: 12, height: 100, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <svg viewBox="0 0 200 100" width="180" height="80">
                  {/* Phone */}
                  <rect x={30} y={15} width={50} height={70} rx={8} fill="#1e3a8a" />
                  <rect x={34} y={21} width={42} height={52} rx={3} fill="#dbeafe" />
                  <circle cx={55} cy={79} r={3} fill="#60a5fa" />
                  {/* Button on screen */}
                  <rect x={40} y={39} width={30} height={16} rx={3} fill="#3b82f6" />
                  <text x={55} y={50} textAnchor="middle" fontSize={5} fill="#fff" fontWeight={600}>LLAMAR</text>
                  {/* Finger */}
                  <circle cx={55} cy={47} r={5} fill="#fcd9b0" stroke="#1e3a8a" strokeWidth={1.5} />
                  {/* Signal waves */}
                  <path d="M95 47 Q102 47 102 52 Q102 57 95 57" stroke="#3b82f6" strokeWidth={2} fill="none" opacity={0.9} />
                  <path d="M95 40 Q112 40 112 52 Q112 64 95 64" stroke="#3b82f6" strokeWidth={1.8} fill="none" opacity={0.6} />
                  <path d="M95 33 Q122 33 122 52 Q122 71 95 71" stroke="#3b82f6" strokeWidth={1.5} fill="none" opacity={0.3} />
                  {/* Bell */}
                  <g transform="translate(155,45)">
                    <path d="M-10 0 Q-10 -12 0 -12 Q10 -12 10 0 L12 5 L-12 5 Z" fill="#fbbf24" />
                    <rect x={-2} y={-18} width={4} height={6} rx={1} fill="#fbbf24" />
                    <circle cx={0} cy={9} r={2.5} fill="#dc2626" />
                    <line x1={-16} y1={-2} x2={-13} y2={-2} stroke="#fbbf24" strokeWidth={1.5} strokeLinecap="round" />
                    <line x1={13} y1={-2} x2={16} y2={-2} stroke="#fbbf24" strokeWidth={1.5} strokeLinecap="round" />
                    <line x1={-15} y1={3} x2={-12} y2={3} stroke="#fbbf24" strokeWidth={1} strokeLinecap="round" opacity={0.6} />
                    <line x1={12} y1={3} x2={15} y2={3} stroke="#fbbf24" strokeWidth={1} strokeLinecap="round" opacity={0.6} />
                  </g>
                </svg>
              </div>
              <h4 style={{ fontFamily: F, fontSize: 15, fontWeight: 700, color: "#111", marginBottom: 6 }}>Llamada al garzón</h4>
              <p style={{ fontSize: "12.5px", color: "#666", lineHeight: 1.5, margin: 0 }}>El cliente toca un botón y el garzón recibe notificación al toque.</p>
            </div>

            {/* Card 4: Estadísticas avanzadas */}
            <div className="lnd-feature-card" style={{ background: "#fff", border: "1px solid #eeeae0", borderRadius: 18, padding: 20, transition: "all 0.25s" }}>
              <div style={{ background: "linear-gradient(135deg, #faf5ff, #e9d5ff)", borderRadius: 12, height: 100, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <svg viewBox="0 0 200 100" width="180" height="80">
                  <line x1={20} y1={80} x2={180} y2={80} stroke="#a78bfa" strokeWidth={1.5} opacity={0.4} />
                  {[
                    { x: 30, h: 25, c: "#c4b5fd" }, { x: 58, h: 40, c: "#a78bfa" },
                    { x: 86, h: 55, c: "#7c3aed" }, { x: 114, h: 35, c: "#a78bfa" },
                    { x: 142, h: 20, c: "#c4b5fd" },
                  ].map((b, i) => (
                    <rect key={i} x={b.x} y={80 - b.h} width={22} height={b.h} rx={3} fill={b.c} />
                  ))}
                  {/* Star on tallest */}
                  <path d="M97 18 L98.5 13 L100 18 L105 19.5 L100 21 L98.5 26 L97 21 L92 19.5 Z" fill="#fbbf24" />
                  {/* Trend line */}
                  <path d="M35 70 Q75 50 97 30 Q125 45 155 60" stroke="#7c3aed" strokeWidth={2} strokeDasharray="3,2" fill="none" />
                </svg>
              </div>
              <h4 style={{ fontFamily: F, fontSize: 15, fontWeight: 700, color: "#111", marginBottom: 6 }}>Estadísticas avanzadas</h4>
              <p style={{ fontSize: "12.5px", color: "#666", lineHeight: 1.5, margin: 0 }}>Qué platos ven más vs cuáles piden. Qué funciona los viernes de lluvia.</p>
            </div>
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
              <button type="submit" disabled={sending} style={{ padding: "12px 20px", background: "#fbbf24", color: "#111", borderRadius: 10, border: "none", fontFamily: F, fontWeight: 700, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap", boxShadow: "0 2px 10px rgba(251,191,36,0.3)" }}>
                {sending ? "..." : "Quiero probar →"}
              </button>
            </form>
          )}
          <p style={{ fontSize: 12, color: "#999", marginTop: 14 }}>Sin tarjeta. Sin compromiso.</p>
        </div>
      </section>

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
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Hecho en Chile con 💛 y mucha hambre</span>
          </div>
        </div>
      </footer>

      {/* ══════ CSS ══════ */}
      <style>{`
        @keyframes lndFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes lndWalk { 0% { transform: scale(1.6) translate(660px, 122px); } 100% { transform: scale(1.6) translate(220px, 128px); } }
        .lnd-walker { animation: lndWalk 40s linear infinite; }
        .lnd-logos-track::after { content: ''; position: absolute; right: 0; top: 0; bottom: 0; width: 40px; background: linear-gradient(to right, transparent, #faf6ee); pointer-events: none; z-index: 2; }
        .lnd-logos-scroll::-webkit-scrollbar { display: none; }
        @media (min-width: 769px) {
          .lnd-logos-track::after { display: none; }
          .lnd-logos-scroll { display: flex !important; justify-content: center; }
        }
        .lnd-logo-chip:hover { border-color: #d4a015 !important; transform: translateY(-1px); box-shadow: 0 2px 8px rgba(212,160,21,0.12); }
        .lnd-feature-card:hover { border-color: #d4a015 !important; transform: translateY(-3px); box-shadow: 0 4px 16px rgba(212,160,21,0.1); }
        @media (max-width: 768px) {
          .lnd-nav-desktop { display: none !important; }
          .lnd-nav-mobile { display: flex !important; }
          .lnd-genio-grid { grid-template-columns: 1fr !important; }
          .lnd-features-grid { grid-template-columns: 1fr !important; }
          .lnd-plans-grid { grid-template-columns: 1fr !important; }
          .lnd-cta-form { flex-direction: column !important; }
          .lnd-footer-top { flex-direction: column !important; }
          .lnd-footer-links { gap: 32px !important; }
        }
        @media (min-width: 769px) {
          .lnd-nav-mobile { display: none !important; }
        }
      `}</style>
    </div>
  );
}
