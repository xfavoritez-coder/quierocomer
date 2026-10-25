"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import type { PricingConfig, PricePlan } from "@/lib/pricing";

// Paleta de la presentación (independiente del tema oscuro del admin).
const CREAM = "#FBF7EF", CREAM2 = "#F3EBDB", INK = "#211E18", INKSOFT = "#6B6153";
const GOLD = "#D98A1F", GOLDB = "#E8A33A", GOLDT = "#9A5E12";
const CARD = "#FFFDF7", CARDB = "#EADFC9";
const DISP = "'Fraunces', Georgia, serif";
const SANS = "'DM Sans', system-ui, -apple-system, sans-serif";

const fmt = (n: number) => `$${(Number(n) || 0).toLocaleString("es-CL")}`;

// Explicación corta por característica (match por palabra clave; robusto a ediciones menores).
const RULES: [string, string][] = [
  ["whatsapp automático", "Link y estado del pedido."],
  ["pedidos online por whatsapp", "El cliente pide por WhatsApp."],
  ["pedidos por whatsapp", "El cliente pide por WhatsApp."],
  ["seguimiento", "Tu cliente ve al repartidor en vivo."],
  ["tracking", "Tu cliente ve al repartidor en vivo."],
  ["sitio web", "Tu tienda online con tu marca."],
  ["comandador", "Gestiona cada pedido en vivo."],
  ["pasarela", "Cobra online directo a tu cuenta."],
  ["repartidor", "Uber o PedidosYa en un clic."],
  ["soporte", "Te acompañamos por WhatsApp."],
  ["comanda", "Imprime en cocina al instante."],
  ["impresión", "Imprime en cocina al instante."],
  ["cupon", "Descuentos y promociones."],
  ["cupón", "Descuentos y promociones."],
  ["encuesta", "Mide la satisfacción real."],
  ["reporte", "Ventas y clientes con datos."],
  ["kds", "Pantalla de cocina sin papeles."],
  ["ilimitado", "Sin tope de pedidos al mes."],
  ["100 pedidos", "Hasta 100 pedidos al mes."],
  ["400 pedidos", "Hasta 400 pedidos al mes."],
  ["punto de venta", "Vende también en el mostrador."],
  ["pos propio", "Vende también en el mostrador."],
  ["bodega", "Insumos, compras y costos."],
  ["inventario", "Insumos, compras y costos."],
  ["membres", "Fidelidad digital en la billetera."],
  ["cumpleaños", "Saludo automático de cumpleaños."],
  ["notificaciones", "Avisos directos a tus clientes."],
  ["carta qr", "Carta digital siempre al día."],
  ["valoracion", "Reseñas de tus platos."],
  ["valoración", "Reseñas de tus platos."],
  ["multilenguaje", "Carta en varios idiomas."],
  ["garz", "El cliente llama con un toque."],
  ["imprimible", "Versión imprimible de tu carta."],
  ["fila", "Turnos sin aglomeración."],
  ["loyalty", "Fidelización incluida."],
];
const blurbFor = (f: string) => {
  const l = f.toLowerCase();
  for (const [k, v] of RULES) if (l.includes(k)) return v;
  return "";
};
const taglineFor = (name: string) => {
  const l = name.toLowerCase();
  if (l.includes("futuro")) return "Tu operación completa: delivery, POS e inventario.";
  if (l.includes("premium")) return "Sin límites de pedidos, para alto volumen.";
  if (l.includes("avanzado")) return "Para locales que ya venden y quieren crecer.";
  if (l.includes("básico") || l.includes("basico")) return "Para empezar a vender online con tu marca.";
  return "Plan de QuieroComer.";
};

type Slide =
  | { type: "cover" } | { type: "intro" } | { type: "panorama" }
  | { type: "plan"; plan: PricePlan; i: number; total: number }
  | { type: "addons" } | { type: "costos" } | { type: "cierre" };

export default function PresentacionPage() {
  const { isSuper } = useAdminSession();
  const router = useRouter();
  const [cfg, setCfg] = useState<PricingConfig | null>(null);
  const [idx, setIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/admin/pricing").then((r) => (r.ok ? r.json() : null)).then((d) => d && setCfg(d)).catch(() => {});
  }, []);

  const slides: Slide[] = cfg ? [
    { type: "cover" }, { type: "intro" }, { type: "panorama" },
    ...cfg.plans.map((plan, i): Slide => ({ type: "plan", plan, i, total: cfg.plans.length })),
    ...(cfg.addons.length ? [{ type: "addons" } as Slide] : []),
    ...(cfg.extras.length || cfg.implementation.length ? [{ type: "costos" } as Slide] : []),
    { type: "cierre" },
  ] : [];

  const go = useCallback((d: number) => setIdx((i) => Math.max(0, Math.min(slides.length - 1, i + d))), [slides.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); go(-1); }
      else if (e.key === "Escape" && !document.fullscreenElement) router.push("/admin/planes");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, router]);

  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else containerRef.current?.requestFullscreen().catch(() => {});
  };

  if (!isSuper) return <div style={{ padding: 32, color: "#888" }}>Solo superadmin</div>;

  const slide = slides[idx];
  const bg = slide && (slide.type === "cover" || slide.type === "cierre") ? INK : slide && (slide.type === "panorama" || slide.type === "addons") ? CREAM2 : CREAM;

  const eyebrow = (t: string, dark = false) => <p style={{ fontFamily: SANS, fontSize: "clamp(0.8rem,1.2vw,1.1rem)", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, color: dark ? GOLDB : GOLDT, margin: 0 }}>{t}</p>;

  const featureCard = (f: string, star = false) => {
    const b = blurbFor(f);
    return (
      <div key={f} style={{ background: star ? "#FBF2DF" : CARD, border: `1px solid ${star ? "#E7C98A" : CARDB}`, borderRadius: 14, padding: "clamp(12px,1.4vw,20px)", display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: GOLD, fontWeight: 900, fontSize: "clamp(1rem,1.3vw,1.3rem)", flexShrink: 0 }}>{star ? "★" : "✓"}</span>
          <h3 style={{ fontFamily: SANS, fontSize: "clamp(0.95rem,1.25vw,1.35rem)", fontWeight: 700, color: INK, margin: 0, lineHeight: 1.15 }}>{f}</h3>
        </div>
        {b && <p style={{ fontFamily: SANS, fontSize: "clamp(0.82rem,1.05vw,1.1rem)", color: INKSOFT, margin: 0, lineHeight: 1.3, paddingLeft: 28 }}>{b}</p>}
      </div>
    );
  };

  const renderSlide = () => {
    if (!cfg || !slide) return null;
    const pad = "clamp(32px,6vw,110px)";
    const wrap: React.CSSProperties = { width: "100%", maxWidth: 1320, display: "flex", flexDirection: "column" };

    if (slide.type === "cover") return (
      <div style={{ ...wrap, gap: "clamp(20px,3vh,40px)" }}>
        {eyebrow("QuieroComer · Planes 2026", true)}
        <h1 style={{ fontFamily: DISP, fontSize: "clamp(2.6rem,7vw,6.5rem)", fontWeight: 600, lineHeight: 1.03, color: CREAM, margin: 0 }}>Tu restaurante,<br /><span style={{ color: GOLDB }}>en una sola plataforma</span></h1>
        <p style={{ fontFamily: SANS, fontSize: "clamp(1.1rem,2vw,2rem)", color: "#CFC6B4", margin: 0, lineHeight: 1.35, maxWidth: 1050 }}>Sitio propio, pedidos online, delivery con seguimiento en vivo, fidelización y punto de venta. Todo con tu marca.</p>
      </div>
    );

    if (slide.type === "intro") {
      const items = [["★", "Tu propia marca", "Tu sitio y tu carta, con tus colores y tu dominio. No un marketplace."], ["♥", "Más margen", "Cobras online directo a tu cuenta, sin las altas comisiones de las apps."], ["⚡", "Todo en un lugar", "Pedidos, delivery, cocina, fidelización y punto de venta juntos."]];
      return (
        <div style={{ ...wrap, gap: "clamp(28px,4vh,52px)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{eyebrow("Qué es QuieroComer")}<h2 style={{ fontFamily: DISP, fontSize: "clamp(2rem,5vw,4.5rem)", fontWeight: 600, lineHeight: 1.05, color: INK, margin: 0 }}>Una plataforma hecha para que tu local venda más</h2></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "clamp(16px,2vw,28px)" }}>
            {items.map(([ic, t, d]) => (
              <div key={t} style={{ background: CARD, border: `1px solid ${CARDB}`, borderRadius: 20, padding: "clamp(24px,2.6vw,40px)", display: "flex", flexDirection: "column", gap: 14 }}>
                <span style={{ color: GOLD, fontSize: "clamp(1.8rem,3vw,3rem)" }}>{ic}</span>
                <h3 style={{ fontFamily: DISP, fontSize: "clamp(1.4rem,2.2vw,2.4rem)", fontWeight: 600, color: INK, margin: 0 }}>{t}</h3>
                <p style={{ fontFamily: SANS, fontSize: "clamp(1rem,1.4vw,1.5rem)", color: INKSOFT, margin: 0, lineHeight: 1.4 }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (slide.type === "panorama") return (
      <div style={{ ...wrap, gap: "clamp(24px,3.5vh,46px)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{eyebrow("Planes Ecommerce")}<h2 style={{ fontFamily: DISP, fontSize: "clamp(2rem,4.5vw,4rem)", fontWeight: 600, lineHeight: 1.05, color: INK, margin: 0 }}>Cuatro planes, una misma plataforma</h2></div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(cfg.plans.length, 4)},1fr)`, gap: "clamp(12px,1.4vw,22px)" }}>
          {cfg.plans.map((p) => {
            const hi = /premium/i.test(p.name) && !/futuro/i.test(p.name);
            return (
              <div key={p.id} style={{ background: hi ? "#2B2620" : CARD, border: `1px solid ${hi ? GOLD : CARDB}`, borderRadius: 20, padding: "clamp(20px,2vw,34px) clamp(16px,1.6vw,28px)", display: "flex", flexDirection: "column", gap: 10 }}>
                {hi && eyebrow("Recomendado", true)}
                <h3 style={{ fontFamily: SANS, fontSize: "clamp(1rem,1.5vw,1.5rem)", fontWeight: 700, color: hi ? CREAM : INK, margin: 0 }}>{p.name}</h3>
                <p style={{ fontFamily: DISP, fontSize: "clamp(1.7rem,2.8vw,2.6rem)", fontWeight: 600, color: hi ? GOLDB : GOLD, margin: 0, lineHeight: 1 }}>{fmt(p.price)}</p>
                <p style={{ fontFamily: SANS, fontSize: "clamp(0.85rem,1.1vw,1.2rem)", color: hi ? "#F3EBDB" : INK, margin: 0, lineHeight: 1.3 }}>{taglineFor(p.name)}</p>
              </div>
            );
          })}
        </div>
      </div>
    );

    if (slide.type === "plan") {
      const { plan, i, total } = slide;
      const impl = cfg.implementation.find((l) => l.label.trim().toLowerCase() === plan.name.trim().toLowerCase())?.price ?? null;
      const starNew = (f: string) => /pos|bodega|inventario|ilimitado/i.test(f);
      return (
        <div style={{ ...wrap, gap: "clamp(18px,2.6vh,32px)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {eyebrow(`Plan ${i + 1} de ${total} · Ecommerce`)}
              <h2 style={{ fontFamily: DISP, fontSize: "clamp(2rem,4.5vw,4rem)", fontWeight: 600, lineHeight: 1, color: INK, margin: 0 }}>{plan.name}</h2>
              <p style={{ fontFamily: SANS, fontSize: "clamp(1rem,1.4vw,1.5rem)", color: INKSOFT, margin: 0 }}>{taglineFor(plan.name)}</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <p style={{ fontFamily: DISP, fontSize: "clamp(2rem,4vw,3.6rem)", fontWeight: 600, color: GOLD, margin: 0, lineHeight: 1 }}>{fmt(plan.price)}</p>
              <p style={{ fontFamily: SANS, fontSize: "clamp(0.85rem,1.1vw,1.15rem)", color: INKSOFT, margin: "4px 0 0" }}>por mes{impl != null ? ` · + ${fmt(impl)} implementación` : ""}</p>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "clamp(10px,1vw,16px)" }}>
            {plan.features.map((f) => featureCard(f, starNew(f)))}
          </div>
        </div>
      );
    }

    if (slide.type === "addons") return (
      <div style={{ ...wrap, gap: "clamp(24px,3.5vh,40px)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{eyebrow("Paquetes y add-ons")}<h2 style={{ fontFamily: DISP, fontSize: "clamp(2rem,4.5vw,4rem)", fontWeight: 600, lineHeight: 1.05, color: INK, margin: 0 }}>Súmale fidelización y carta digital</h2></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", gap: "clamp(16px,2vw,28px)" }}>
          {cfg.addons.map((p) => (
            <div key={p.id} style={{ background: CARD, border: `1px solid ${CARDB}`, borderRadius: 22, padding: "clamp(24px,2.4vw,40px)", display: "flex", flexDirection: "column", gap: "clamp(14px,1.6vw,22px)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                <h3 style={{ fontFamily: DISP, fontSize: "clamp(1.5rem,2.4vw,2.6rem)", fontWeight: 600, color: INK, margin: 0 }}>{p.name}</h3>
                <p style={{ fontFamily: DISP, fontSize: "clamp(1.5rem,2.2vw,2.4rem)", fontWeight: 600, color: GOLD, margin: 0 }}>{fmt(p.price)}<span style={{ color: INKSOFT, fontFamily: SANS, fontSize: "0.5em" }}> /mes</span></p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: p.features.length > 4 ? "1fr 1fr" : "1fr", gap: "clamp(8px,1vw,14px) clamp(16px,2vw,28px)" }}>
                {p.features.map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: GOLD, fontWeight: 900, fontSize: "clamp(1rem,1.3vw,1.3rem)" }}>✓</span>
                    <p style={{ fontFamily: SANS, fontSize: "clamp(0.95rem,1.25vw,1.4rem)", color: INK, margin: 0 }}>{f}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );

    if (slide.type === "costos") return (
      <div style={{ ...wrap, gap: "clamp(24px,3.5vh,44px)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{eyebrow("Implementación y otros cobros")}<h2 style={{ fontFamily: DISP, fontSize: "clamp(2rem,4.5vw,4rem)", fontWeight: 600, lineHeight: 1.05, color: INK, margin: 0 }}>Puesta en marcha y costos variables</h2></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(360px,1fr))", gap: "clamp(28px,4vw,56px)" }}>
          {cfg.implementation.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <h3 style={{ fontFamily: SANS, fontSize: "clamp(1rem,1.5vw,1.5rem)", fontWeight: 700, color: GOLDT, margin: "0 0 6px" }}>Implementación · pago único</h3>
              {cfg.implementation.map((l) => (
                <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `1px solid ${CARDB}`, padding: "10px 0" }}>
                  <p style={{ fontFamily: SANS, fontSize: "clamp(1rem,1.3vw,1.45rem)", color: INK, margin: 0 }}>{l.label}</p>
                  <p style={{ fontFamily: DISP, fontSize: "clamp(1.1rem,1.5vw,1.6rem)", fontWeight: 600, color: GOLD, margin: 0 }}>{fmt(l.price)}</p>
                </div>
              ))}
            </div>
          )}
          {cfg.extras.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <h3 style={{ fontFamily: SANS, fontSize: "clamp(1rem,1.5vw,1.5rem)", fontWeight: 700, color: GOLDT, margin: "0 0 6px" }}>Otros cobros</h3>
              {cfg.extras.map((l) => (
                <div key={l.id} style={{ borderBottom: `1px solid ${CARDB}`, padding: "10px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <p style={{ fontFamily: SANS, fontSize: "clamp(1rem,1.3vw,1.45rem)", color: INK, margin: 0 }}>{l.label}</p>
                    <p style={{ fontFamily: DISP, fontSize: "clamp(1.1rem,1.5vw,1.6rem)", fontWeight: 600, color: GOLD, margin: 0 }}>{fmt(l.price)}</p>
                  </div>
                  {l.note && <p style={{ fontFamily: SANS, fontSize: "clamp(0.8rem,1vw,1.1rem)", color: "#8F8575", margin: "4px 0 0" }}>{l.note}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );

    // cierre
    return (
      <div style={{ ...wrap, gap: "clamp(22px,3vh,40px)" }}>
        {eyebrow("El siguiente paso", true)}
        <h1 style={{ fontFamily: DISP, fontSize: "clamp(2.4rem,6vw,5.5rem)", fontWeight: 600, lineHeight: 1.04, color: CREAM, margin: 0 }}>Hagamos crecer<br />tu restaurante</h1>
        <p style={{ fontFamily: SANS, fontSize: "clamp(1.1rem,1.8vw,1.9rem)", color: "#CFC6B4", margin: 0, lineHeight: 1.4, maxWidth: 1000 }}>Tu marca, tus clientes, tus datos y toda tu operación en una sola plataforma. Elige el plan, nosotros lo dejamos andando.</p>
        <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 8 }}>
          <span style={{ fontFamily: SANS, fontSize: "clamp(1rem,1.4vw,1.5rem)", fontWeight: 700, color: INK, background: GOLDB, padding: "14px 30px", borderRadius: 50 }}>Conversemos hoy</span>
          <span style={{ fontFamily: SANS, fontSize: "clamp(0.95rem,1.2vw,1.3rem)", color: "#8F8575" }}>quierocomer.com</span>
        </div>
      </div>
    );
  };

  const navBtn: React.CSSProperties = { width: 46, height: 46, borderRadius: "50%", border: "1px solid rgba(0,0,0,0.12)", background: "rgba(255,255,255,0.7)", color: INK, fontSize: "1.3rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)" };
  const topBtn: React.CSSProperties = { border: "1px solid rgba(0,0,0,0.12)", background: "rgba(255,255,255,0.7)", color: INK, fontFamily: SANS, fontWeight: 700, fontSize: "0.82rem", borderRadius: 10, padding: "8px 14px", cursor: "pointer", backdropFilter: "blur(6px)" };
  const onDark = slide && (slide.type === "cover" || slide.type === "cierre");

  return (
    <div ref={containerRef} style={{ position: "fixed", inset: 0, zIndex: 9999, background: bg, transition: "background 0.35s ease", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=DM+Sans:wght@400;500;700&display=swap');@keyframes qcslide{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}`}</style>

      {/* Barra superior */}
      <div style={{ position: "absolute", top: 18, right: 18, display: "flex", gap: 10, zIndex: 2 }}>
        <button onClick={toggleFull} style={{ ...topBtn, ...(onDark ? { background: "rgba(255,255,255,0.14)", color: CREAM, border: "1px solid rgba(255,255,255,0.25)" } : {}) }}>⤢ Pantalla completa</button>
        <button onClick={() => router.push("/admin/planes")} style={{ ...topBtn, ...(onDark ? { background: "rgba(255,255,255,0.14)", color: CREAM, border: "1px solid rgba(255,255,255,0.25)" } : {}) }}>✕ Cerrar</button>
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(40px,6vw,110px)" }}>
        <div key={idx} style={{ width: "100%", display: "flex", justifyContent: "center", animation: "qcslide 0.4s ease" }}>{renderSlide()}</div>
      </div>

      {/* Navegación inferior */}
      <div style={{ position: "absolute", bottom: 20, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 18, zIndex: 2 }}>
        <button onClick={() => go(-1)} disabled={idx === 0} style={{ ...navBtn, opacity: idx === 0 ? 0.35 : 1, ...(onDark ? { background: "rgba(255,255,255,0.14)", color: CREAM, border: "1px solid rgba(255,255,255,0.25)" } : {}) }}>‹</button>
        <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
          {slides.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)} aria-label={`Slide ${i + 1}`} style={{ width: i === idx ? 26 : 9, height: 9, borderRadius: 50, border: "none", cursor: "pointer", background: i === idx ? GOLD : (onDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.18)"), transition: "width 0.25s ease" }} />
          ))}
        </div>
        <button onClick={() => go(1)} disabled={idx === slides.length - 1} style={{ ...navBtn, opacity: idx === slides.length - 1 ? 0.35 : 1, ...(onDark ? { background: "rgba(255,255,255,0.14)", color: CREAM, border: "1px solid rgba(255,255,255,0.25)" } : {}) }}>›</button>
        <span style={{ position: "absolute", right: "clamp(20px,4vw,48px)", fontFamily: SANS, fontSize: "0.85rem", fontWeight: 700, color: onDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)" }}>{idx + 1} / {slides.length}</span>
      </div>
    </div>
  );
}
