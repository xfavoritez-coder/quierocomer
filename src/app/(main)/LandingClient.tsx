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

function Check({ color = "#EF9F27" }: { color?: string }) {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 2 }}><path d="M3 7.5L5.5 10L11 4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/* ─── FAQ Accordion ─── */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #eeeae0", overflow: "hidden" }}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "18px 22px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
        <span style={{ fontFamily: F, fontSize: 15, fontWeight: 600, color: "#111", lineHeight: 1.4 }}>{q}</span>
        <span style={{ fontSize: 18, color: "#999", transform: open ? "rotate(45deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0, lineHeight: 1 }}>+</span>
      </button>
      {open && (
        <div style={{ padding: "0 22px 18px" }}>
          <p style={{ fontFamily: B, fontSize: 14, color: "#666", lineHeight: 1.6, margin: 0 }}>{a}</p>
        </div>
      )}
    </div>
  );
}

const F = "var(--font-display)";
const B = "var(--font-body)";
const BRAND = "#EF9F27";
const BG_WARM = "#FAF9F7";

/* ─── Desert SVG (separator) ─── */
function DesertSVG() {
  return (
    <div style={{ width: "100vw", marginLeft: "calc(-50vw + 50%)", marginTop: -1, background: `linear-gradient(to bottom, ${BG_WARM} 60%, #fff 100%)` }}>
      <svg viewBox="0 0 1440 260" preserveAspectRatio="none" style={{ display: "block", width: "100%", height: "auto" }}>
        <rect width="1440" height="180" fill={BG_WARM} />
        <rect y="180" width="1440" height="80" fill="url(#desertFade)" />
        <defs><linearGradient id="desertFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={BG_WARM} /><stop offset="100%" stopColor="#ffffff" /></linearGradient></defs>
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

/* ─── Sunset Footer Dunes SVG ─── */
function FooterDunesSVG() {
  return (
    <>
      {/* Setting sun disc (sin halo) */}
      <div aria-hidden style={{ position: "absolute", right: "calc(18% + 38px)", bottom: 108, width: 64, height: 64, borderRadius: "50%", background: "radial-gradient(circle, #FFF4D6 0%, #FFC97A 70%, #FF9B4A 100%)", pointerEvents: "none", zIndex: 1 }} />
      {/* Dunes */}
      <svg viewBox="0 0 800 160" preserveAspectRatio="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, width: "100%", height: 160, zIndex: 2 }}>
        <path d="M0 100 Q100 70 200 90 Q300 60 400 85 Q500 55 600 80 Q700 65 800 75 L800 160 L0 160Z" fill="#5B1F46" opacity="0.55" />
        <path d="M0 120 Q150 90 300 110 Q450 85 600 105 Q700 90 800 100 L800 160 L0 160Z" fill="#3F1438" opacity="0.78" />
        <path d="M0 140 Q200 120 400 135 Q600 120 800 140 L800 160 L0 160Z" fill="#260B26" opacity="0.95" />
        <rect x="120" y="95" width="4" height="30" rx="2" fill="#1a0820" opacity="0.92" />
        <rect x="116" y="102" width="3" height="12" rx="1" fill="#1a0820" opacity="0.92" transform="rotate(-20 116 102)" />
        <rect x="126" y="100" width="3" height="14" rx="1" fill="#1a0820" opacity="0.92" transform="rotate(15 126 100)" />
        <rect x="680" y="85" width="5" height="35" rx="2" fill="#1a0820" opacity="0.92" />
        <rect x="675" y="93" width="3" height="14" rx="1" fill="#1a0820" opacity="0.92" transform="rotate(-22 675 93)" />
        <rect x="687" y="90" width="3" height="16" rx="1" fill="#1a0820" opacity="0.92" transform="rotate(18 687 90)" />
      </svg>
    </>
  );
}

/* ─── Main ─── */
export default function LandingClient({ logos }: { logos: Logo[] }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [nombre, setNombre] = useState("");
  const [restaurante, setRestaurante] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !restaurante || !email || !telefono) { setFormError("Completa todos los campos"); return; }
    setFormError("");
    setSending(true);
    try { await fetch("/api/landing/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, nombre: `${nombre} — ${restaurante}`, telefono }) }); setSubmitted(true); } catch {}
    setSending(false);
  };

  return (
    <div style={{ fontFamily: B, color: "#111", overflowX: "hidden", zoom: 1.08 }}>

      {/* ══════ NAVBAR ══════ */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: scrolled ? "rgba(255,255,255,0.97)" : "rgba(250,249,247,0.97)", borderBottom: scrolled ? "1px solid #eeeae0" : "1px solid transparent", backdropFilter: "blur(12px)", transition: "all 0.25s" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <Link href="/" style={{ textDecoration: "none", fontFamily: F, fontSize: "1.1rem", fontWeight: 800 }}>
            <span style={{ color: "#111" }}>Quiero</span><span style={{ color: BRAND }}>Comer</span>
          </Link>
          <div className="lnd-nav-desktop" style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <a href="#como-funciona" style={{ fontSize: 13, color: "#555", textDecoration: "none", fontFamily: F, fontWeight: 500 }}>Cómo funciona</a>
            <a href="#funcionalidades" style={{ fontSize: 13, color: "#555", textDecoration: "none", fontFamily: F, fontWeight: 500 }}>Funcionalidades</a>
            <a href="#planes" style={{ fontSize: 13, color: "#555", textDecoration: "none", fontFamily: F, fontWeight: 500 }}>Planes</a>
            <a href="#casos" style={{ fontSize: 13, color: "#555", textDecoration: "none", fontFamily: F, fontWeight: 500 }}>Casos</a>
            <Link href="/panel/login" style={{ fontSize: 13, color: "#555", textDecoration: "none", fontFamily: F, fontWeight: 500 }}>Iniciar sesión</Link>
            <a href="#contacto" style={{ fontSize: 13, color: "#fff", background: "#1a1a1a", padding: "8px 18px", borderRadius: 999, textDecoration: "none", fontFamily: F, fontWeight: 600 }}>Contáctame</a>
          </div>
          <button className="lnd-nav-mobile" onClick={() => setMobileMenu(!mobileMenu)} style={{ display: "none", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round">
              {mobileMenu ? <><line x1="6" y1="6" x2="18" y2="18" /><line x1="6" y1="18" x2="18" y2="6" /></> : <><line x1="3" y1="7" x2="21" y2="7" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="17" x2="21" y2="17" /></>}
            </svg>
          </button>
        </div>
        {mobileMenu && (
          <div className="lnd-nav-mobile" style={{ display: "none", flexDirection: "column", background: "#fff", borderBottom: "1px solid #eeeae0", padding: "4px 24px 16px" }}>
            <a href="#como-funciona" onClick={() => setMobileMenu(false)} style={{ padding: "14px 0", fontSize: 15, color: "#333", textDecoration: "none", fontFamily: F, fontWeight: 600, borderBottom: "1px solid #f5f0e8" }}>Cómo funciona</a>
            <a href="#funcionalidades" onClick={() => setMobileMenu(false)} style={{ padding: "14px 0", fontSize: 15, color: "#333", textDecoration: "none", fontFamily: F, fontWeight: 600, borderBottom: "1px solid #f5f0e8" }}>Funcionalidades</a>
            <a href="#planes" onClick={() => setMobileMenu(false)} style={{ padding: "14px 0", fontSize: 15, color: "#333", textDecoration: "none", fontFamily: F, fontWeight: 600, borderBottom: "1px solid #f5f0e8" }}>Planes</a>
            <a href="#casos" onClick={() => setMobileMenu(false)} style={{ padding: "14px 0", fontSize: 15, color: "#333", textDecoration: "none", fontFamily: F, fontWeight: 600, borderBottom: "1px solid #f5f0e8" }}>Casos</a>
            <Link href="/panel/login" onClick={() => setMobileMenu(false)} style={{ padding: "14px 0", fontSize: 15, color: "#333", textDecoration: "none", fontFamily: F, fontWeight: 600, borderBottom: "1px solid #f5f0e8" }}>Iniciar sesión</Link>
            <a href="#contacto" onClick={() => setMobileMenu(false)} style={{ display: "block", marginTop: 12, textAlign: "center", padding: "12px 0", background: "#1a1a1a", color: "#fff", borderRadius: 999, textDecoration: "none", fontFamily: F, fontWeight: 700, fontSize: 15 }}>Contáctame</a>
          </div>
        )}
      </nav>

      {/* ══════ HERO ══════ */}
      <section style={{ background: `linear-gradient(to bottom, #CFE2EC 0%, #E8E0CC 55%, ${BG_WARM} 100%)`, paddingTop: 56, position: "relative", overflow: "hidden" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", padding: "64px 24px 48px", textAlign: "center", position: "relative" }}>
          <div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(239,159,39,0.1)", padding: "6px 14px", borderRadius: 999, fontSize: "12.5px", color: "#92400e", fontWeight: 600, marginBottom: 20, fontFamily: F }}>
              <span style={{ animation: "lndFloat 2.5s ease-in-out infinite", display: "inline-block" }}>🧞</span> Impulsado por el Genio
            </span>
            <h1 style={{ fontFamily: F, fontSize: "clamp(32px, 4.5vw, 48px)", fontWeight: 700, letterSpacing: "-1.5px", lineHeight: 1.05, marginBottom: 18, color: "#111" }}>
              La carta QR con IA que aumenta tu ticket de venta
            </h1>
            <p style={{ fontFamily: B, fontSize: "clamp(15px, 2vw, 17px)", color: "#555", lineHeight: 1.6, maxWidth: 520, marginBottom: 28, marginLeft: "auto", marginRight: "auto" }}>
              Tu carta se reordena para cada cliente según sus gustos. Sugiere acompañamientos. Llama al garzón cuando hace falta. Sin que tu equipo haga nada
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16, justifyContent: "center" }}>
              <a href="#contacto" style={{ display: "inline-flex", alignItems: "center", padding: "13px 24px", background: "#1a1a1a", color: "#fff", borderRadius: 999, fontFamily: F, fontWeight: 600, fontSize: 15, textDecoration: "none" }}>Contáctame →</a>
              <a href="/qr/horusvegan" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", padding: "13px 24px", background: "transparent", color: "#1a1a1a", borderRadius: 999, fontFamily: F, fontWeight: 600, fontSize: 15, textDecoration: "none", border: "1.5px solid #ddd" }}>Ver carta de ejemplo</a>
            </div>
            <p style={{ fontSize: 13, color: "#999", fontFamily: F, fontWeight: 500 }}>Implementación gratis · Listo en 24 horas · Sin contratos</p>
          </div>
        </div>
      </section>

      {/* Desert separator */}
      <DesertSVG />

      {/* ══════ LOGOS BAR ══════ */}
      <section id="casos" style={{ background: "#FDFCFA", borderBottom: "1px solid #eeeae0", padding: "36px 0" }}>
        <p style={{ fontSize: "11.5px", fontWeight: 600, color: "#999", letterSpacing: "1.5px", textTransform: "uppercase", textAlign: "center", marginBottom: 18, padding: "0 24px", fontFamily: F }}>
          Restaurantes que ya confían en QuieroComer
        </p>
        <div className="lnd-logos-track" style={{ position: "relative" }}>
          <div className="lnd-logos-scroll" style={{ overflowX: "auto", padding: "6px 0", scrollbarWidth: "none" as any, WebkitOverflowScrolling: "touch" }}>
            <div className="lnd-logos-row" style={{ display: "flex", gap: 10, width: "max-content", paddingLeft: 24, paddingRight: 24 }}>
              {logos.map((l) => (
                <a key={l.slug} href={`/qr/${l.slug}`} target="_blank" rel="noopener noreferrer"
                  className="lnd-logo-chip"
                  style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: "1px solid #eeeae0", borderRadius: 999, padding: "10px 20px 10px 10px", textDecoration: "none", flexShrink: 0, transition: "all 0.2s", touchAction: "manipulation" }}>
                  {l.logoUrl ? (
                    <img src={l.logoUrl} alt={l.name} style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: l.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: F, fontSize: 14, fontWeight: 700 }}>{l.initials}</div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
                    <span style={{ fontFamily: F, fontSize: 15, fontWeight: 700, color: "#333" }}>{l.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: BRAND }}>Ver carta →</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════ POR QUÉ QUIEROCOMER ══════ */}
      <section id="como-funciona" style={{ background: "#fff", padding: "64px 24px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <p style={{ fontSize: 12, color: BRAND, textTransform: "uppercase", letterSpacing: "1.2px", fontWeight: 600, fontFamily: F, marginBottom: 10 }}>Por qué QuieroComer</p>
            <h2 style={{ fontFamily: F, fontSize: "clamp(26px, 3.5vw, 34px)", fontWeight: 700, letterSpacing: "-0.8px", marginBottom: 10, color: "#111" }}>Una carta que vende por ti</h2>
            <p style={{ fontSize: 16, color: "#666", lineHeight: 1.5 }}>Personalización inteligente que convierte navegación en ventas</p>
          </div>
          <div className="lnd-features-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[
              { emoji: "📈", title: "Sube el ticket por mesa", desc: "El Genio sugiere acompañamientos y postres en el momento justo. Discreto, no invasivo" },
              { emoji: "🛎️", title: "Llamar al garzón con un toque", desc: "El cliente toca un botón y el garzón recibe notificación al instante. Adiós a esperar con el brazo en alto" },
              { emoji: "📊", title: "Estadísticas avanzadas", desc: "Qué platos ven más vs cuáles piden. A qué horas. Qué funciona los viernes de lluvia" },
            ].map(f => (
              <div key={f.title} className="lnd-feature-card" style={{ background: BG_WARM, borderRadius: 16, padding: 24, transition: "all 0.2s", textAlign: "center" }}>
                <span style={{ fontSize: 28, display: "block", marginBottom: 12 }}>{f.emoji}</span>
                <p style={{ fontFamily: F, fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 8, lineHeight: 1.3 }}>{f.title}</p>
                <p style={{ fontSize: 15, color: "#555", lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ VENDEDOR SILENCIOSO ══════ */}
      <section id="funcionalidades" style={{ background: BG_WARM, padding: "64px 24px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: 12, color: BRAND, textTransform: "uppercase", letterSpacing: "1.2px", fontWeight: 600, fontFamily: F, marginBottom: 10 }}>Vendedor silencioso</p>
          <h3 style={{ fontFamily: F, fontSize: "clamp(24px, 3vw, 32px)", fontWeight: 700, letterSpacing: "-0.8px", marginBottom: 10, color: "#111" }}>Sugiere el acompañamiento perfecto en el momento justo</h3>
          <p style={{ fontSize: 15, color: "#666", lineHeight: 1.55, maxWidth: 540, margin: "0 auto 32px" }}>Cuando el cliente está mirando un plato, el Genio le muestra qué acompañamiento, postre o bebida combina mejor</p>

          {/* Cross-sell mock card */}
          <div style={{ background: "#fff", borderRadius: 18, padding: 24, maxWidth: 420, margin: "0 auto", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", textAlign: "left" }}>
            {/* Current dish */}
            <div style={{ display: "flex", gap: 14, marginBottom: 16 }}>
              <img src="https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=200&h=200&fit=crop" alt="" style={{ width: 72, height: 72, borderRadius: 12, objectFit: "cover" }} />
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <p style={{ fontFamily: F, fontSize: 16, fontWeight: 600, color: "#111", margin: "0 0 4px" }}>Tabla de sushi familiar</p>
                <p style={{ fontFamily: F, fontSize: 16, fontWeight: 700, color: "#111", margin: 0 }}>$32.990</p>
              </div>
            </div>
            {/* Suggestion label */}
            <p style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: BRAND, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>🧞 Va perfecto con</p>
            {/* Suggested products */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ background: BG_WARM, borderRadius: 12, padding: 10, display: "flex", gap: 10, alignItems: "center" }}>
                <img src="https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=100&h=100&fit=crop" alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover" }} />
                <div>
                  <p style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: "#111", margin: "0 0 2px" }}>Edamame</p>
                  <p style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: "#555", margin: 0 }}>$3.500</p>
                </div>
              </div>
              <div style={{ background: BG_WARM, borderRadius: 12, padding: 10, display: "flex", gap: 10, alignItems: "center" }}>
                <img src="https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=100&h=100&fit=crop" alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover" }} />
                <div>
                  <p style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: "#111", margin: "0 0 2px" }}>Sake del día</p>
                  <p style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: "#555", margin: 0 }}>$4.900</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ TESTIMONIOS ══════ */}
      <section style={{ background: "#fff", padding: "64px 24px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <p style={{ fontSize: 12, color: BRAND, textTransform: "uppercase", letterSpacing: "1.2px", fontWeight: 600, fontFamily: F, marginBottom: 10 }}>Lo que dicen los restaurantes</p>
            <h2 style={{ fontFamily: F, fontSize: "clamp(26px, 3.5vw, 34px)", fontWeight: 700, letterSpacing: "-0.8px", color: "#111" }}>Pensado por y para restauranteros</h2>
          </div>
          <div className="lnd-testimonials-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {[
              { quote: "Antes pasaba que los garzones tenían que estar explicando los platos uno por uno. Ahora el cliente abre la carta, ve la foto, lee y pide. Nos liberó harto tiempo en el servicio", name: "Alfredo Morales", place: "Hand Roll", initials: "AM", color: BRAND },
              { quote: "Se nota en las ventas. Hay platos que antes pasaban desapercibidos y ahora están saliendo todos los días. La gente entra a la carta y termina pidiendo más cosas que antes", name: "Carlos Gómez", place: "Horus Vegan", initials: "CG", color: "#16a34a" },
              { quote: "Los clientes nos dicen que la experiencia de ver la carta se siente premium. El local ahora tiene otro nivel y eso se nota en cómo la gente pide y disfruta", name: "Daniel Trejo", place: "Nascosto Pizzeria", initials: "DT", color: "#e85530" },
            ].map(t => (
              <div key={t.name} style={{ background: BG_WARM, borderRadius: 16, padding: 26 }}>
                <p style={{ fontSize: 15, color: "#333", lineHeight: 1.65, margin: "0 0 22px", fontStyle: "italic" }}>&ldquo;{t.quote}&rdquo;</p>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: t.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: F, fontSize: 13, fontWeight: 700 }}>{t.initials}</div>
                  <div>
                    <p style={{ fontFamily: F, fontSize: 14.5, fontWeight: 600, color: "#111", margin: 0 }}>{t.name}</p>
                    <p style={{ fontSize: 13, color: "#888", margin: 0 }}>{t.place}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ PLANES ══════ */}
      <section id="planes" style={{ background: BG_WARM, padding: "64px 24px" }}>
        <div style={{ maxWidth: 1060, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <p style={{ fontSize: 12, color: BRAND, textTransform: "uppercase", letterSpacing: "1.2px", fontWeight: 600, fontFamily: F, marginBottom: 10 }}>Planes</p>
            <h2 style={{ fontFamily: F, fontSize: "clamp(26px, 3.5vw, 34px)", fontWeight: 700, letterSpacing: "-0.8px", color: "#111", marginBottom: 8 }}>Empieza gratis. Crece cuando quieras</h2>
            <p style={{ fontSize: 15, color: "#666" }}>Implementación gratis. 7 días de prueba en planes pagos. Cancela cuando quieras</p>
          </div>
          <div className="lnd-plans-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1.15fr 1fr", gap: 16, maxWidth: 1000, margin: "0 auto" }}>
            {/* GRATIS */}
            <div style={{ background: "#fff", border: "1px solid #eeeae0", borderRadius: 16, padding: 28 }}>
              <p style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: "#888", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 6 }}>Gratis</p>
              <p style={{ fontFamily: F, fontSize: 36, fontWeight: 700, letterSpacing: "-1px", color: "#111", marginBottom: 2 }}>$0</p>
              <p style={{ fontSize: 13, color: "#999", marginBottom: 6 }}>Para siempre</p>
              <p style={{ fontFamily: F, fontSize: 13, color: "#888", marginBottom: 20, lineHeight: 1.4 }}>Carta digital con QR para empezar a vender</p>
              <a href="#contacto" style={{ display: "block", textAlign: "center", padding: "11px 14px", background: "transparent", color: "#1a1a1a", border: "1.5px solid #ddd", borderRadius: 999, fontFamily: F, fontWeight: 600, fontSize: 14, textDecoration: "none", marginBottom: 20 }}>Empezar gratis</a>
              <div style={{ borderTop: "1px solid #eeeae0", paddingTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { t: "Carta inteligente con QR", tip: "Tus clientes escanean un QR y ven tu carta digital" },
                  { t: "Vista lista", tip: "Todos los platos en formato lista limpia" },
                  { t: "El Genio incluido 🧞", tip: "El Genio reordena tu carta según los gustos de cada cliente" },
                ].map((f) => (
                  <div key={f.t} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#555" }}><Check /> <span>{f.t}</span> <InfoTip text={f.tip} /></div>
                ))}
              </div>
            </div>
            {/* GOLD */}
            <div style={{ background: "linear-gradient(180deg, #FFFDF5 0%, #FFF8E7 100%)", borderRadius: 16, padding: 28, position: "relative", border: `2px solid ${BRAND}` }}>
              <span style={{ position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)", background: BRAND, color: "#fff", fontFamily: F, fontSize: "10.5px", fontWeight: 700, padding: "3px 12px", borderRadius: 999, letterSpacing: "0.5px", textTransform: "uppercase" }}>Recomendado</span>
              <p style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: "#92400e", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 6 }}>Gold</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 2 }}>
                <span style={{ fontFamily: F, fontSize: 36, fontWeight: 700, letterSpacing: "-1px", color: "#111" }}>$29.900</span>
                <span style={{ fontSize: 16, color: "#999", fontWeight: 500 }}>/mes</span>
              </div>
              <p style={{ fontSize: 13, color: "#999", marginBottom: 6 }}>Neto · Sin contratos</p>
              <p style={{ fontFamily: F, fontSize: 13, color: "#888", marginBottom: 20, lineHeight: 1.4 }}>Para destacar tus platos y entender a tus clientes</p>
              <a href="#contacto" style={{ display: "block", textAlign: "center", padding: "11px 14px", background: "#1a1a1a", color: "#fff", borderRadius: 999, fontFamily: F, fontWeight: 600, fontSize: 14, textDecoration: "none", marginBottom: 20 }}>Empezar prueba gratis 7 días</a>
              <div style={{ borderTop: "1px solid #eeeae0", paddingTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#555" }}><Check /> Todo lo del plan Gratis</div>
                {[
                  { t: "2 vistas de carta", tip: "Vista lista y vista galería con fotos grandes" },
                  { t: "Destaca platos estrella", tip: "Marca tus platos más vendidos para que aparezcan primero" },
                  { t: "Ofertas del día", tip: "Publica promociones que se muestran solo el día indicado" },
                  { t: "Estadísticas básicas", tip: "Ve cuántas personas visitan tu carta, qué platos ven más y cuánto tiempo pasan" },
                  { t: "Multilenguaje (ES · EN · PT)", tip: "Tu carta se traduce automáticamente al idioma del cliente" },
                ].map((f) => (
                  <div key={f.t} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#555" }}><Check /> <span>{f.t}</span> <InfoTip text={f.tip} /></div>
                ))}
              </div>
            </div>
            {/* PREMIUM */}
            <div style={{ background: "linear-gradient(180deg, #F5F0FF 0%, #EDE5FF 100%)", border: "2px solid #c4b5fd", borderRadius: 16, padding: 28 }}>
              <p style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: "#6d28d9", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 6 }}>Premium</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 2 }}>
                <span style={{ fontFamily: F, fontSize: 36, fontWeight: 700, letterSpacing: "-1px", color: "#1a1a1a" }}>$49.900</span>
                <span style={{ fontSize: 16, color: "#6b7280", fontWeight: 500 }}>/mes</span>
              </div>
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 6 }}>Neto · Sin contratos</p>
              <p style={{ fontFamily: F, fontSize: 13, color: "#555", marginBottom: 20, lineHeight: 1.4 }}>Para vender más sin levantar un dedo</p>
              <a href="#contacto" style={{ display: "block", textAlign: "center", padding: "11px 14px", background: "#7c3aed", color: "#fff", borderRadius: 999, fontFamily: F, fontWeight: 600, fontSize: 14, textDecoration: "none", marginBottom: 20 }}>Empezar prueba gratis 7 días</a>
              <div style={{ borderTop: "1px solid #ddd6fe", paddingTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#444" }}><Check /> Todo del plan Gold</div>
                {[
                  { t: "4 vistas de carta", tip: "Lista, galería, feed y espacial — elige la que mejor represente tu local" },
                  { t: "Estadísticas avanzadas", tip: "Sesiones en vivo, recorrido de cada cliente, qué buscan en tu carta y estadísticas del garzón" },
                  { t: "Llamar al garzón", tip: "El cliente toca un botón y el garzón recibe la notificación al instante" },
                  { t: "Venta cruzada", tip: "El Genio sugiere acompañamientos al cliente para subir el ticket de cada mesa" },
                  { t: "Automatizaciones", tip: "Emails automáticos: bienvenida al registrarse, saludo de cumpleaños, reactivación de clientes inactivos" },
                  { t: "Campañas y email marketing", tip: "Crea y envía emails con novedades, promociones o comunicaciones a tus clientes registrados" },
                  { t: "Integración con Toteat", tip: "Si tu local ya usa Toteat, sincronizamos las ventas reales con la carta digital. Verás qué platos se ven y se piden, dashboard en vivo de tu negocio, y badges como 'lo más pedido hoy' basado en ventas reales." },
                ].map((f) => (
                  <div key={f.t} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#444" }}><Check /> <span>{f.t}</span> <InfoTip text={f.tip} /></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ FAQ ══════ */}
      <section style={{ background: BG_WARM, padding: "64px 24px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <p style={{ fontSize: 12, color: BRAND, textTransform: "uppercase", letterSpacing: "1.2px", fontWeight: 600, fontFamily: F, marginBottom: 10 }}>Preguntas frecuentes</p>
            <h2 style={{ fontFamily: F, fontSize: "clamp(24px, 3.5vw, 32px)", fontWeight: 700, letterSpacing: "-0.8px", color: "#111" }}>Lo que todos preguntan</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <FaqItem q="¿Necesito comprar algún equipo o tablet?" a="No. Solo necesitas un código QR impreso en cada mesa. Tus clientes lo escanean con su celular" />
            <FaqItem q="¿Mis clientes tienen que descargar una app?" a="No. La carta se abre directamente en el navegador del celular. Cero fricción" />
            <FaqItem q="¿Cómo actualizo mi carta cuando cambio precios o platos?" a="Desde un panel sencillo. Cambias el precio o agregas un plato y se actualiza al instante en todos los QR" />
            <FaqItem q="¿Qué pasa si me arrepiento?" a="No hay contratos ni permanencias. Cancelas cuando quieras y dejas de pagar el mes siguiente" />
            <FaqItem q="¿Funciona si mi restaurante no tiene buen wifi?" a="Tus clientes usan su propio plan de datos. No depende del wifi del local" />
          </div>
        </div>
      </section>

      {/* ══════ CTA FINAL ══════ */}
      <section id="contacto" style={{ background: "#1a1a1a", padding: "80px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <h2 style={{ fontFamily: F, fontSize: "clamp(26px, 4vw, 36px)", fontWeight: 700, letterSpacing: "-1px", lineHeight: 1.1, marginBottom: 12, color: "#fff" }}>
            ¿Listo para probar la carta que vende por ti?
          </h2>
          <p style={{ fontSize: 15, color: "#999", marginBottom: 32, lineHeight: 1.5 }}>Déjanos tus datos y te contactamos en 24 horas</p>
          {submitted ? (
            <p style={{ fontSize: 15, color: "#4ade80", fontWeight: 600, fontFamily: F }}>Recibido. Te contactamos pronto</p>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14, textAlign: "left" }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", fontFamily: F, marginBottom: 5, letterSpacing: "0.03em" }}>Tu nombre</label>
                <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: María López" required
                  style={{ width: "100%", padding: "14px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, fontSize: 14, fontFamily: B, color: "#fff", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", fontFamily: F, marginBottom: 5, letterSpacing: "0.03em" }}>Restaurante</label>
                <input type="text" value={restaurante} onChange={e => setRestaurante(e.target.value)} placeholder="Ej: La Cocina de María" required
                  style={{ width: "100%", padding: "14px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, fontSize: 14, fontFamily: B, color: "#fff", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", fontFamily: F, marginBottom: 5, letterSpacing: "0.03em" }}>Correo electrónico</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Ej: maria@mirestaurante.cl" required
                  style={{ width: "100%", padding: "14px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, fontSize: 14, fontFamily: B, color: "#fff", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", fontFamily: F, marginBottom: 5, letterSpacing: "0.03em" }}>Teléfono</label>
                <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Ej: +56 9 1234 5678" required
                  style={{ width: "100%", padding: "14px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, fontSize: 14, fontFamily: B, color: "#fff", outline: "none", boxSizing: "border-box" }} />
              </div>
              {formError && <p style={{ fontSize: 13, color: "#ef4444", margin: 0 }}>{formError}</p>}
              <button type="submit" disabled={sending} style={{ padding: "14px 20px", background: BRAND, color: "#fff", borderRadius: 999, border: "none", fontFamily: F, fontWeight: 700, fontSize: 15, cursor: "pointer", marginTop: 4 }}>
                {sending ? "Enviando..." : "Contáctame →"}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* ══════ FOOTER ══════ */}
      <footer style={{ background: "linear-gradient(to bottom, #2D1B4E 0%, #6B2B5C 35%, #C2553D 70%, #E89456 100%)", color: "#fff", padding: "56px 24px 220px", position: "relative", overflow: "hidden" }}>
        <FooterDunesSVG />
        <div style={{ maxWidth: 960, margin: "0 auto", position: "relative", zIndex: 3 }}>
          <div className="lnd-footer-top" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 40, marginBottom: 40 }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontFamily: F, fontSize: 20, fontWeight: 800, marginBottom: 10 }}>
                <span style={{ color: "#fff" }}>Quiero</span><span style={{ color: "#FFD27A" }}>Comer</span>
              </p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", maxWidth: 280, lineHeight: 1.55, margin: "0 auto" }}>La carta inteligente que recomienda por ti. Hecho en Chile con 💛 y mucha hambre</p>
            </div>
            <div>
              <h5 style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 14 }}>Producto</h5>
              <a href="#como-funciona" style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.92)", textDecoration: "none", padding: "4px 0" }}>Cómo funciona</a>
              <a href="#funcionalidades" style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.92)", textDecoration: "none", padding: "4px 0" }}>Funcionalidades</a>
              <a href="#planes" style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.92)", textDecoration: "none", padding: "4px 0" }}>Planes</a>
            </div>
            <div>
              <h5 style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 14 }}>Empresa</h5>
              <a href="#casos" style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.92)", textDecoration: "none", padding: "4px 0" }}>Casos de éxito</a>
              <span style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.7)", padding: "4px 0" }}>Privacidad</span>
              <span style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.7)", padding: "4px 0" }}>Términos</span>
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.18)", paddingTop: 20, textAlign: "center" }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.92)", fontWeight: 500 }}>© 2026 QuieroComer · Santiago, Chile</span>
          </div>
        </div>
      </footer>

      {/* ══════ CSS ══════ */}
      <style>{`
        @keyframes lndFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        .lnd-logos-track::after { content: ''; position: absolute; right: 0; top: 0; bottom: 0; width: 40px; background: linear-gradient(to right, transparent, #fff); pointer-events: none; z-index: 2; }
        .lnd-logos-scroll::-webkit-scrollbar { display: none; }
        @media (min-width: 769px) {
          .lnd-logos-track::after { display: none; }
          .lnd-logos-scroll { display: flex !important; justify-content: center; }
        }
        .lnd-logo-chip:hover { border-color: ${BRAND} !important; transform: translateY(-1px); box-shadow: 0 2px 8px rgba(239,159,39,0.15); }
        .lnd-feature-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
        input::placeholder { color: rgba(255,255,255,0.35) !important; }
        @media (max-width: 768px) {
          .lnd-nav-desktop { display: none !important; }
          .lnd-nav-mobile { display: flex !important; }
          .lnd-hero-grid { grid-template-columns: 1fr !important; text-align: center; }
          .lnd-hero-grid p, .lnd-hero-grid div:first-child { margin-left: auto; margin-right: auto; }
          .lnd-hero-grid > div:first-child > div:last-of-type { justify-content: center; }
          .lnd-features-grid { grid-template-columns: 1fr !important; }
          .lnd-testimonials-grid { grid-template-columns: 1fr !important; }
          .lnd-plans-grid { grid-template-columns: 1fr !important; }
          .lnd-impl-grid { grid-template-columns: 1fr !important; }
          .lnd-footer-top { grid-template-columns: 1fr !important; text-align: center; }
        }
        @media (min-width: 769px) {
          .lnd-nav-mobile { display: none !important; }
        }
      `}</style>
    </div>
  );
}
