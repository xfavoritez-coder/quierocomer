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
    <div style={{ fontFamily: B, color: "#111", overflowX: "hidden" }}>

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
      <section style={{ background: BG_WARM, paddingTop: 56 }}>
        <div className="lnd-hero-grid" style={{ maxWidth: 1100, margin: "0 auto", padding: "64px 24px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }}>
          {/* Left: text */}
          <div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(239,159,39,0.1)", padding: "6px 14px", borderRadius: 999, fontSize: "12.5px", color: "#92400e", fontWeight: 600, marginBottom: 20, fontFamily: F }}>
              <span style={{ animation: "lndFloat 2.5s ease-in-out infinite", display: "inline-block" }}>🧞</span> Impulsado por el Genio
            </span>
            <h1 style={{ fontFamily: F, fontSize: "clamp(32px, 4.5vw, 48px)", fontWeight: 700, letterSpacing: "-1.5px", lineHeight: 1.05, marginBottom: 18, color: "#111" }}>
              La carta digital que sube el ticket de cada mesa
            </h1>
            <p style={{ fontFamily: B, fontSize: "clamp(15px, 2vw, 17px)", color: "#555", lineHeight: 1.6, maxWidth: 480, marginBottom: 28 }}>
              Tu carta se reordena para cada cliente según sus gustos. Sugiere acompañamientos. Llama al garzón cuando hace falta. Sin que tu equipo haga nada
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
              <a href="#contacto" style={{ display: "inline-flex", alignItems: "center", padding: "13px 24px", background: "#1a1a1a", color: "#fff", borderRadius: 999, fontFamily: F, fontWeight: 600, fontSize: 15, textDecoration: "none" }}>Contáctame →</a>
              <a href="/qr/horus" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", padding: "13px 24px", background: "transparent", color: "#1a1a1a", borderRadius: 999, fontFamily: F, fontWeight: 600, fontSize: 15, textDecoration: "none", border: "1.5px solid #ddd" }}>Ver carta de ejemplo</a>
            </div>
            <p style={{ fontSize: 13, color: "#999", fontFamily: F, fontWeight: 500 }}>Implementación gratis · Listo en 24 horas · Sin contratos</p>
          </div>
          {/* Right: phone mockup */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ width: 280, background: "#111", borderRadius: 32, padding: "12px 10px", boxShadow: "0 24px 64px rgba(0,0,0,0.15)" }}>
              <div style={{ background: "#fff", borderRadius: 22, overflow: "hidden", minHeight: 480 }}>
                {/* Phone header */}
                <div style={{ padding: "18px 16px 12px", borderBottom: "1px solid #f0ebe0" }}>
                  <p style={{ fontFamily: F, fontSize: 18, fontWeight: 700, color: "#111", margin: "0 0 2px" }}>Horus Vegan</p>
                  <p style={{ fontSize: 12, color: "#999", margin: 0 }}>Carta · ordenada para ti</p>
                </div>
                {/* Featured card */}
                <div style={{ margin: "14px 12px", background: "#FFFBF0", border: `2px solid ${BRAND}`, borderRadius: 14, padding: 12 }}>
                  <span style={{ fontFamily: F, fontSize: 9, fontWeight: 700, color: BRAND, textTransform: "uppercase", letterSpacing: "0.5px" }}>⭐ Recomendado para ti</span>
                  <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                    <img src="https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200&h=200&fit=crop" alt="" style={{ width: 64, height: 64, borderRadius: 10, objectFit: "cover" }} />
                    <div>
                      <p style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: "#111", margin: "4px 0 4px" }}>Buddha Bowl quinoa</p>
                      <p style={{ fontFamily: F, fontSize: 15, fontWeight: 700, color: "#111", margin: 0 }}>$9.990</p>
                    </div>
                  </div>
                </div>
                {/* Category: Entradas */}
                <div style={{ padding: "0 12px" }}>
                  <p style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: "#111", margin: "12px 0 8px" }}>Entradas</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <img src="https://images.unsplash.com/photo-1540420773420-3366772f4999?w=200&h=200&fit=crop" alt="" style={{ width: "100%", aspectRatio: "1", borderRadius: 10, objectFit: "cover" }} />
                    <img src="https://images.unsplash.com/photo-1543339308-d595c471b5f7?w=200&h=200&fit=crop" alt="" style={{ width: "100%", aspectRatio: "1", borderRadius: 10, objectFit: "cover" }} />
                  </div>
                </div>
                {/* Category: Fondos */}
                <div style={{ padding: "0 12px 14px" }}>
                  <p style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: "#111", margin: "12px 0 8px" }}>Fondos</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <img src="https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=200&h=200&fit=crop" alt="" style={{ width: "100%", aspectRatio: "1", borderRadius: 10, objectFit: "cover" }} />
                    <img src="https://images.unsplash.com/photo-1547592180-85f173990554?w=200&h=200&fit=crop" alt="" style={{ width: "100%", aspectRatio: "1", borderRadius: 10, objectFit: "cover" }} />
                  </div>
                </div>
                {/* Waiter button */}
                <div style={{ padding: "8px 12px 16px" }}>
                  <div style={{ background: BRAND, borderRadius: 10, padding: "10px 0", textAlign: "center" }}>
                    <span style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: "#fff" }}>🛎️ Llamar al garzón</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ LOGOS BAR ══════ */}
      <section id="casos" style={{ background: "#fff", borderTop: "1px solid #eeeae0", borderBottom: "1px solid #eeeae0", padding: "36px 0" }}>
        <p style={{ fontSize: "11.5px", fontWeight: 600, color: "#999", letterSpacing: "1.5px", textTransform: "uppercase", textAlign: "center", marginBottom: 18, padding: "0 24px", fontFamily: F }}>
          Restaurantes que ya confían en QuieroComer
        </p>
        <div className="lnd-logos-track" style={{ position: "relative" }}>
          <div className="lnd-logos-scroll" style={{ overflowX: "auto", padding: "6px 0", scrollbarWidth: "none" as any }}>
            <div className="lnd-logos-row" style={{ display: "flex", gap: 10, width: "max-content", paddingLeft: 24, paddingRight: 24 }}>
              {logos.map((l) => (
                <a key={l.slug} href={`/qr/${l.slug}`} target="_blank" rel="noopener noreferrer"
                  className="lnd-logo-chip"
                  style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: "1px solid #eeeae0", borderRadius: 999, padding: "10px 20px 10px 10px", textDecoration: "none", flexShrink: 0, scrollSnapAlign: "start", transition: "all 0.2s" }}>
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
              { emoji: "🧞", title: "Carta personalizada por cliente", desc: "Aprende los gustos de cada comensal y reordena la carta para mostrar primero lo que más le va a gustar" },
              { emoji: "📈", title: "Sube el ticket por mesa", desc: "El Genio sugiere acompañamientos y postres en el momento justo. Discreto, no invasivo" },
              { emoji: "🛎️", title: "Llamar al garzón con un toque", desc: "El cliente toca un botón y el garzón recibe notificación al instante. Adiós a esperar con el brazo en alto" },
              { emoji: "📊", title: "Estadísticas que sirven", desc: "Qué platos ven más vs cuáles piden. A qué horas. Qué funciona los viernes de lluvia" },
            ].map(f => (
              <div key={f.title} className="lnd-feature-card" style={{ background: BG_WARM, borderRadius: 16, padding: 24, transition: "all 0.2s", textAlign: "center" }}>
                <span style={{ fontSize: 24, display: "block", marginBottom: 10 }}>{f.emoji}</span>
                <p style={{ fontFamily: F, fontSize: 15, fontWeight: 600, color: "#111", marginBottom: 6 }}>{f.title}</p>
                <p style={{ fontSize: 13, color: "#666", lineHeight: 1.55, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ VENDEDOR SILENCIOSO ══════ */}
      <section id="funcionalidades" style={{ background: BG_WARM, padding: "64px 24px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: 12, color: BRAND, textTransform: "uppercase", letterSpacing: "1.2px", fontWeight: 600, fontFamily: F, marginBottom: 10 }}>Vendedor silencioso</p>
          <h3 style={{ fontFamily: F, fontSize: "clamp(24px, 3vw, 32px)", fontWeight: 700, letterSpacing: "-0.8px", marginBottom: 10, color: "#111" }}>Sugiere lo que falta. Sube el ticket sin pedir nada</h3>
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
            <h2 style={{ fontFamily: F, fontSize: "clamp(26px, 3.5vw, 34px)", fontWeight: 700, letterSpacing: "-0.8px", color: "#111" }}>Hecho para gente que cocina</h2>
          </div>
          <div className="lnd-testimonials-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {[
              { quote: "Antes pasaba que los garzones tenían que estar explicando los platos uno por uno. Ahora el cliente abre la carta, ve la foto, lee y pide. Nos liberó harto tiempo en el servicio", name: "Alfredo Morales", place: "Hand Roll", initials: "AM", color: BRAND },
              { quote: "Se nota en las ventas. Hay platos que antes pasaban desapercibidos y ahora están saliendo todos los días. La gente entra a la carta y termina pidiendo más cosas que antes", name: "Carlos Gómez", place: "Horus Vegan", initials: "CG", color: "#16a34a" },
            ].map(t => (
              <div key={t.name} style={{ background: BG_WARM, borderRadius: 16, padding: 24 }}>
                <p style={{ fontSize: 13, color: "#444", lineHeight: 1.7, margin: "0 0 20px", fontStyle: "italic" }}>&ldquo;{t.quote}&rdquo;</p>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: t.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: F, fontSize: 12, fontWeight: 700 }}>{t.initials}</div>
                  <div>
                    <p style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: "#111", margin: 0 }}>{t.name}</p>
                    <p style={{ fontSize: 12, color: "#888", margin: 0 }}>{t.place}</p>
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
            <h2 style={{ fontFamily: F, fontSize: "clamp(26px, 3.5vw, 34px)", fontWeight: 700, letterSpacing: "-0.8px", color: "#111", marginBottom: 8 }}>Parte gratis. Crece cuando quieras</h2>
            <p style={{ fontSize: 15, color: "#666" }}>Implementación gratis en los tres planes. Sin contratos</p>
          </div>
          <div className="lnd-plans-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1.15fr 1fr", gap: 16, maxWidth: 1000, margin: "0 auto" }}>
            {/* FREE */}
            <div style={{ background: "#fff", border: "1px solid #eeeae0", borderRadius: 16, padding: 28 }}>
              <p style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: "#888", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 6 }}>Gratis</p>
              <p style={{ fontFamily: F, fontSize: 36, fontWeight: 700, letterSpacing: "-1px", color: "#111", marginBottom: 2 }}>$0</p>
              <p style={{ fontSize: 13, color: "#999", marginBottom: 6 }}>Para siempre</p>
              <p style={{ fontFamily: F, fontSize: 13, color: "#888", marginBottom: 20, lineHeight: 1.4 }}>Para probar cómo se ve tu carta digital</p>
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
            <div style={{ background: "#fff", borderRadius: 16, padding: 28, position: "relative", border: `2px solid ${BRAND}` }}>
              <span style={{ position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)", background: BRAND, color: "#fff", fontFamily: F, fontSize: "10.5px", fontWeight: 700, padding: "3px 12px", borderRadius: 999, letterSpacing: "0.5px", textTransform: "uppercase" }}>Recomendado</span>
              <p style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: "#92400e", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 6 }}>Gold</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 2 }}>
                <span style={{ fontFamily: F, fontSize: 36, fontWeight: 700, letterSpacing: "-1px", color: "#111" }}>$35.000</span>
                <span style={{ fontSize: 16, color: "#999", fontWeight: 500 }}>/mes</span>
              </div>
              <p style={{ fontSize: 13, color: "#999", marginBottom: 6 }}>Neto · Sin contratos</p>
              <p style={{ fontFamily: F, fontSize: 13, color: "#888", marginBottom: 20, lineHeight: 1.4 }}>Para destacar tus platos y entender a tus clientes</p>
              <a href="#contacto" style={{ display: "block", textAlign: "center", padding: "11px 14px", background: "#1a1a1a", color: "#fff", borderRadius: 999, fontFamily: F, fontWeight: 600, fontSize: 14, textDecoration: "none", marginBottom: 20 }}>Quiero el plan Gold →</a>
              <div style={{ borderTop: "1px solid #eeeae0", paddingTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#555" }}><Check /> Todo lo del plan gratis</div>
                {[
                  { t: "3 vistas personalizables", tip: "Vista lista, vista galería con fotos grandes y vista compacta" },
                  { t: "Destaca platos estrella", tip: "Marca tus platos más vendidos para que aparezcan primero" },
                  { t: "Ofertas del día", tip: "Publica promociones que se muestran solo el día indicado" },
                  { t: "Estadísticas avanzadas", tip: "Ve qué platos se miran más, cuáles se piden y a qué horas" },
                  { t: "Multilenguaje (ES · EN · PT)", tip: "Tu carta se traduce automáticamente al idioma del cliente" },
                  { t: "Llamar al garzón", tip: "El cliente toca un botón y el garzón recibe la notificación" },
                ].map((f) => (
                  <div key={f.t} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#555" }}><Check /> <span>{f.t}</span> <InfoTip text={f.tip} /></div>
                ))}
              </div>
            </div>
            {/* PREMIUM */}
            <div style={{ background: "#fff", border: "1px solid #eeeae0", borderRadius: 16, padding: 28 }}>
              <p style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: "#888", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 6 }}>Premium</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 2 }}>
                <span style={{ fontFamily: F, fontSize: 36, fontWeight: 700, letterSpacing: "-1px", color: "#111" }}>$55.000</span>
                <span style={{ fontSize: 16, color: "#999", fontWeight: 500 }}>/mes</span>
              </div>
              <p style={{ fontSize: 13, color: "#999", marginBottom: 6 }}>Neto · Sin contratos</p>
              <p style={{ fontFamily: F, fontSize: 13, color: "#888", marginBottom: 20, lineHeight: 1.4 }}>Para vender más sin levantar un dedo</p>
              <a href="#contacto" style={{ display: "block", textAlign: "center", padding: "11px 14px", background: "transparent", color: "#1a1a1a", border: "1.5px solid #ddd", borderRadius: 999, fontFamily: F, fontWeight: 600, fontSize: 14, textDecoration: "none", marginBottom: 20 }}>Quiero el Premium</a>
              <div style={{ borderTop: "1px solid #eeeae0", paddingTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#555" }}><Check /> Todo del plan Gold</div>
                {[
                  { t: "Productos sugeridos", tip: "El Genio sugiere acompañamientos para subir el ticket de cada mesa" },
                  { t: "Automatizaciones", tip: "Reglas que se ejecutan solas: subir el almuerzo al mediodía, platos calientes cuando llueve" },
                  { t: "Campañas automáticas", tip: "Mensajes a clientes en su cumpleaños o cuando hace tiempo no vienen" },
                  { t: "Email marketing", tip: "Envía novedades de tu restaurante a tu lista de clientes" },
                ].map((f) => (
                  <div key={f.t} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#555" }}><Check /> <span>{f.t}</span> <InfoTip text={f.tip} /></div>
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
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre" required
                style={{ padding: "14px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, fontSize: 14, fontFamily: B, color: "#fff", outline: "none" }} />
              <input type="text" value={restaurante} onChange={e => setRestaurante(e.target.value)} placeholder="Nombre del restaurante" required
                style={{ padding: "14px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, fontSize: 14, fontFamily: B, color: "#fff", outline: "none" }} />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Correo" required
                style={{ padding: "14px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, fontSize: 14, fontFamily: B, color: "#fff", outline: "none" }} />
              <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Teléfono" required
                style={{ padding: "14px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, fontSize: 14, fontFamily: B, color: "#fff", outline: "none" }} />
              {formError && <p style={{ fontSize: 13, color: "#ef4444", margin: 0 }}>{formError}</p>}
              <button type="submit" disabled={sending} style={{ padding: "14px 20px", background: BRAND, color: "#fff", borderRadius: 999, border: "none", fontFamily: F, fontWeight: 700, fontSize: 15, cursor: "pointer", marginTop: 4 }}>
                {sending ? "Enviando..." : "Contáctame →"}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* ══════ FOOTER ══════ */}
      <footer style={{ background: "#0a0a0a", color: "#fff", padding: "48px 24px 24px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div className="lnd-footer-top" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 40, marginBottom: 40 }}>
            <div>
              <p style={{ fontFamily: F, fontSize: 20, fontWeight: 800, marginBottom: 10 }}>
                <span style={{ color: "#fff" }}>Quiero</span><span style={{ color: BRAND }}>Comer</span>
              </p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", maxWidth: 280, lineHeight: 1.55, margin: "0 auto", textAlign: "center" }}>La carta inteligente que recomienda por ti. Hecho en Chile con 💛 y mucha hambre</p>
            </div>
            <div>
              <h5 style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 14 }}>Producto</h5>
              <a href="#como-funciona" style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.7)", textDecoration: "none", padding: "4px 0" }}>Cómo funciona</a>
              <a href="#funcionalidades" style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.7)", textDecoration: "none", padding: "4px 0" }}>Funcionalidades</a>
              <a href="#planes" style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.7)", textDecoration: "none", padding: "4px 0" }}>Planes</a>
            </div>
            <div>
              <h5 style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 14 }}>Empresa</h5>
              <a href="#casos" style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.7)", textDecoration: "none", padding: "4px 0" }}>Casos de éxito</a>
              <span style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.35)", padding: "4px 0" }}>Privacidad</span>
              <span style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.35)", padding: "4px 0" }}>Términos</span>
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 20, textAlign: "center" }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>© 2026 QuieroComer · Santiago, Chile</span>
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
