"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface Logo {
  slug: string;
  name: string;
  logoUrl: string | null;
  color: string;
  initials: string;
}

const RESTAURANTS: [string, string][] = [
  ["hand-roll", "Hand Roll"],
  ["horusvegan", "Horus Vegan"],
  ["juana-la-brava", "Juana la Brava"],
  ["alleria-pizza", "Alleria Pizza"],
  ["nascosto-pizzeria", "Nascosto Pizzeria"],
];

const AB_DEFAULTS = {
  titleText: "Tu carta puede vender mucho m\u00e1s",
  subtitleText: "Transformamos tu carta actual en una experiencia visual que despierta antojo y aumenta tus ventas",
  ctaText: "Sube tu carta \u00b7 60 segundos \u2192",
};

export default function LandingNew({ logos }: { logos: Logo[] }) {
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [planesOpen, setPlanesOpen] = useState(false);
  const [anual, setAnual] = useState(false);

  // A/B testing state
  const [abTitle, setAbTitle] = useState(AB_DEFAULTS.titleText);
  const [abSubtitle, setAbSubtitle] = useState(AB_DEFAULTS.subtitleText);
  const [abCta, setAbCta] = useState(AB_DEFAULTS.ctaText);
  const abIds = useRef<{ titleId: string | null; subtitleId: string | null; ctaId: string | null }>({ titleId: null, subtitleId: null, ctaId: null });
  const impressionSent = useRef(false);

  const openCarta = useCallback((slug: string) => {
    window.open(`/qr/${slug}?from=landing`, "_blank");
  }, []);

  const openRandomCarta = useCallback(() => {
    const r = RESTAURANTS[Math.floor(Math.random() * RESTAURANTS.length)];
    openCarta(r[0]);
  }, [openCarta]);

  // Fetch A/B variants on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const forced = params.get("v");
    const url = forced ? `/api/landing/ab?v=${forced}` : "/api/landing/ab";

    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (d.titleText) setAbTitle(d.titleText);
        if (d.subtitleText) setAbSubtitle(d.subtitleText);
        if (d.ctaText) setAbCta(d.ctaText);
        abIds.current = { titleId: d.titleId || null, subtitleId: d.subtitleId || null, ctaId: d.ctaId || null };

        // Track impression
        if (!impressionSent.current) {
          impressionSent.current = true;
          fetch("/api/qr/stat-events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventType: "LANDING_VIEWED",
              metadata: { abExperiment: "landing-hero", titleId: d.titleId, subtitleId: d.subtitleId, ctaId: d.ctaId },
            }),
          }).catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  const trackCtaClick = useCallback(() => {
    fetch("/api/qr/stat-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: "LANDING_CTA_CLICK",
        metadata: { abExperiment: "landing-hero", ...abIds.current },
      }),
    }).catch(() => {});
  }, []);

  // Close modals on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPlanesOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const logoChips = logos.length > 0 ? logos : RESTAURANTS.map(([slug, name]) => ({
    slug,
    name,
    logoUrl: null,
    color: "#666",
    initials: name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2),
  }));

  const duplicatedLogos = [...logoChips, ...logoChips];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />

      {/* NAV */}
      <nav>
        <div className="logo">
          <img src="/landing/logo.png" alt="" className="lamp-icon" />
          QuieroComer
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <a href="#" onClick={(e) => { e.preventDefault(); openRandomCarta(); }} className="nav-link">Carta ejemplo</a>
          <a href="#" onClick={(e) => { e.preventDefault(); setPlanesOpen(true); }} className="nav-link">Planes</a>
          <a href="/subircarta" className="nav-cta">Subir carta</a>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-glow" />
        <div className="container hero-grid">
          <div>
            <div className="eyebrow">Para dueños de restaurantes</div>
            <h1 dangerouslySetInnerHTML={{ __html: abTitle.replace(/(mucho más|vendiera sola\?|Cómo la muestras, sí\.)/i, '<span class="accent">$1</span>') }} />
            <p className="hero-sub-text" dangerouslySetInnerHTML={{ __html: abSubtitle.replace(/(aumenta tus ventas)/i, '<span class="accent">$1</span>') }} />
            <a href="/subircarta" className="btn-primary" onClick={trackCtaClick}>{abCta}</a>
            <div className="microcopy">Foto o link · Te mostramos gratis como queda</div>
          </div>
          <div className="phone-demo" aria-label="Vista previa de Carta Viva">
            <div className="phone-frame">
              <img src="/landing/iphone2.png" alt="Carta Viva de restaurante real — QuieroComer" />
            </div>
          </div>
        </div>
      </section>

      {/* LOGOS */}
      <section className="logos-band">
        <div className="logos-eyebrow">Los que ya la usan</div>
        <div className="logos-scroller">
          <div className="logos-track">
            {duplicatedLogos.map((l, i) => (
              <a key={i} href="#" onClick={(e) => { e.preventDefault(); openCarta(l.slug); }} className="logo-chip">
                {l.logoUrl ? (
                  <img src={l.logoUrl} alt={l.name} />
                ) : (
                  <div className="logo-init" style={{ background: l.color }}>{l.initials}</div>
                )}
                <span>{l.name}</span>
                <span>→</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="problem">
        <div className="container">
          <h2>Transformamos tu carta en una experiencia diseñada para <span className="accent">despertar antojo y aumentar ventas</span></h2>
        </div>
      </section>

      {/* PAINS */}
      <section className="pains">
        <div className="container">
          <div className="section-head">
            <div style={{ display: "flex", alignItems: "center", gap: 20, justifyContent: "center", marginBottom: 40 }}>
              <div style={{ flex: 1, maxWidth: 120, height: 1, background: "linear-gradient(90deg,transparent,var(--amber))" }} />
              <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(31px,4vw,45px)", fontStyle: "italic", color: "var(--cream)", lineHeight: 1.2 }}>
                Pero antes, ¿te suena alguno de estos?
              </div>
              <div style={{ flex: 1, maxWidth: 120, height: 1, background: "linear-gradient(270deg,transparent,var(--amber))" }} />
            </div>
          </div>
          <div className="pain-grid">
            {[
              { img: "/landing/1.png", alt: "Cuenta del restaurante", num: "01", title: "Tu ticket de venta ya no aumenta", desc: "Sigues trabajando igual, pero sin una carta que sugiera entradas, té, café, postres.", quote: "No entiendo por qué ese plato casi no sale" },
              { img: "/landing/3.png", alt: "Garzón corriendo", num: "02", title: "No siempre un garzón es vendedor", desc: "Tiene varias mesas, corre de un lado a otro y termina recomendando lo de siempre.", quote: "Mis garzones no son vendedores" },
              { img: "/landing/333.png", alt: "Cliente yéndose", num: "03", title: "Y no retienes clientes", desc: "Te visitan una vez y no vuelven más, no captaste sus datos.", quote: "La carta no transmite lo bueno que realmente es el restaurante" },
            ].map((p, i) => (
              <div key={i} className="pain-card">
                <img className="pain-img" src={p.img} alt={p.alt} />
                <div className="pain-text">
                  {p.quote && <p className="pain-quote">&ldquo;{p.quote}&rdquo;</p>}
                  <h3>{p.title}</h3>
                  <p>{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRODUCT PROOF */}
      <section className="product-proof">
        <div className="container">
          <div className="product-copy">
            <div className="nace-banner">
              <p>Por esto nace <span>QuieroComer</span></p>
            </div>
            <div className="product-grid">
              <img src="/landing/555.png" alt="QuieroComer en acción" className="product-img" />
              <div className="product-text">
                <h2>Una poderosa arma de ventas que <strong>no reemplaza</strong> a tu equipo. <span className="accent">Lo potencia.</span></h2>
                <img src="/landing/555.png" alt="QuieroComer en acción" className="product-img-mobile" />
                <div className="capabilities-grid">
                  <div className="capability">
                    <div className="capability-circle"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/></svg></div>
                    <div><p className="capability-verb">Recomienda</p><p className="capability-detail">platos a cada mesa</p></div>
                  </div>
                  <div className="capability">
                    <div className="capability-circle"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></div>
                    <div><p className="capability-verb">Sugiere</p><p className="capability-detail">entradas, postres, café</p></div>
                  </div>
                  <div className="capability">
                    <div className="capability-circle"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/></svg></div>
                    <div><p className="capability-verb">Traduce</p><p className="capability-detail">tu carta al instante</p></div>
                  </div>
                  <div className="capability">
                    <div className="capability-circle"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div>
                    <div><p className="capability-verb">Entrega</p><p className="capability-detail">datos de qué miran</p></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STEPS */}
      <section className="steps">
        <div className="container">
          <div className="section-head">
            <div style={{ display: "flex", alignItems: "center", gap: 20, justifyContent: "center" }}>
              <div style={{ flex: 1, maxWidth: 100, height: 1, background: "linear-gradient(90deg,transparent,var(--amber))" }} />
              <h2>Pruébalo <span className="accent">tú mismo</span></h2>
              <div style={{ flex: 1, maxWidth: 100, height: 1, background: "linear-gradient(270deg,transparent,var(--amber))" }} />
            </div>
          </div>
          <div className="steps-grid">
            <div className="step">
              <img className="step-img" src="/landing/111.png" alt="Sube tu carta" />
              <div className="step-text"><h3><span className="step-num">01</span> Sube tu carta</h3><p>Una foto de tu carta o el link de tu QR actual.</p></div>
            </div>
            <div className="step reverse">
              <div className="step-text"><h3><span className="step-num">02</span> Nuestra IA analiza</h3><p>Automáticamente identificamos todos tus platos, precios y categorías.</p></div>
              <img className="step-img" src="/landing/fondosec2.png" alt="La analizamos" />
            </div>
            <div className="step">
              <img className="step-img" src="/landing/persona.png" alt="Te la entregamos" />
              <div className="step-text"><h3><span className="step-num">03</span> Creamos tu nueva carta visual</h3><p>Diseñada para despertar antojos y aumentar ventas.</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="faq">
        <div className="container">
          <div className="section-head"><h2><strong>Preguntas más frecuentes</strong></h2></div>
          <div className="faq-list">
            {[
              { q: "¿Qué es QuieroComer?", a: "Transforma tu carta, ya sea física o digital, en una experiencia visual que recomienda platos, sugiere entradas, postres, café. Traduce tu carta en varios idiomas y te entrega datos para saber qué miran tus clientes." },
              { q: "¿Para qué tengo que subir mi carta?", a: "Nuestra IA analiza tu carta, física o QR, y en segundos te deja una Carta Viva lista para usar." },
              { q: "Ya tengo una carta QR. ¿Sirve igual?", a: "Sí. Puedes subir el link de tu QR actual y te mostramos cómo se vería mejorada con QuieroComer." },
              { q: "¿Tengo que dejar de usar cartas físicas?", a: "No. Puedes seguir usando cartas físicas. QuieroComer funciona como complemento digital para mostrar fotos, recomendaciones, traducciones y datos." },
              { q: "¿Es gratis?", a: "plan_link" },
            ].map((item, i) => (
              <div key={i} className={`faq-item${faqOpen === i ? " open" : ""}`}>
                <div className="faq-q" onClick={() => setFaqOpen(faqOpen === i ? null : i)}>{item.q}</div>
                <div className="faq-a">{item.a === "plan_link" ? <>Sí. Puedes empezar gratis y cuando quieras, ver nuestros <a href="#" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPlanesOpen(true); }} style={{ color: "var(--amber)", textDecoration: "underline", cursor: "pointer" }}>planes</a>.</> : item.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="final-cta" id="cta">
        <div className="container">
          <h2>Tu restaurante puede vender más.<br /><span className="accent" style={{textDecoration:"underline",textUnderlineOffset:"6px"}}>Empieza hoy</span></h2>
          <p>Sube tu carta. Lo demás, lo hacemos nosotros.</p>
          <a href="/subircarta" className="btn-primary" onClick={trackCtaClick}>{abCta}</a>
          <div className="fine">Te mostramos gratis como queda</div>
        </div>
      </section>


      {/* PLANES MODAL */}
      {planesOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(6px)" }} onClick={(e) => { if (e.target === e.currentTarget) setPlanesOpen(false); }}>
          <div style={{ background: "var(--black-soft)", border: "1px solid var(--gray-deep)", maxWidth: 1000, width: "100%", maxHeight: "90vh", overflowY: "auto", padding: 40, position: "relative" }}>
            <button onClick={() => setPlanesOpen(false)} style={{ position: "sticky", top: 0, float: "right", background: "rgba(232,163,61,.12)", border: "1px solid rgba(232,163,61,.25)", color: "var(--amber)", fontSize: 24, width: 40, height: 40, cursor: "pointer", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>×</button>
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <div className="eyebrow">Planes</div>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(30px,4vw,48px)", color: "var(--cream)" }}>Empieza gratis. <span className="accent">Crece cuando quieras.</span></h2>
              <p style={{ color: "var(--cream-soft)", fontSize: 15, marginTop: 8 }}>7 días de prueba en planes pagados · Cancela cuando quieras</p>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 12, marginTop: 20, fontSize: 14, color: "var(--cream-soft)" }}>
                <span style={{ color: anual ? "var(--cream-soft)" : "var(--amber)", fontWeight: anual ? 300 : 600 }}>Mensual</span>
                <label style={{ position: "relative", display: "inline-block", width: 48, height: 26, cursor: "pointer" }}>
                  <input type="checkbox" checked={anual} onChange={() => setAnual(!anual)} style={{ opacity: 0, width: 0, height: 0 }} />
                  <span style={{ position: "absolute", inset: 0, background: "var(--gray-deep)", borderRadius: 26, transition: ".3s" }} />
                  <span style={{ position: "absolute", top: 3, left: anual ? 25 : 3, width: 20, height: 20, background: "var(--amber)", borderRadius: "50%", transition: ".3s" }} />
                </label>
                <span style={{ color: anual ? "var(--amber)" : "var(--cream-soft)", fontWeight: anual ? 600 : 300 }}>Anual</span>
              </div>
            </div>
            <div className="planes-grid">
              <PlanCard name="Gratis" price="$0" period="para siempre" desc="Carta QR digital para empezar a vender" features={[
                ["Carta QR digital", "Tu carta lista para escanear con QR"],
                ["Panel autoadministrable", "Edita platos, precios y fotos desde tu panel sin depender de nadie"],
              ]} btnText="Comenzar gratis" btnPrimary={false} />
              <PlanCard name="Gold" price={anual ? "$29.900" : "$35.000"} period={anual ? "/mes + IVA · $358.800/año" : "/mes + IVA"} discount={anual ? "-15%" : undefined} desc="Gratis + herramientas para destacar tus platos y mejorar la experiencia de tus clientes" featured features={[
                ["El Genio (IA) incluido", "Asistente inteligente que recomienda platos según el perfil y preferencias del cliente"],
                ["2 vistas de carta", "Muestra tu carta en formato lista o grilla con fotos"],
                ["Destaca platos estrella", "Resalta visualmente los platos que más te conviene vender"],
                ["Ofertas y promociones", "Crea ofertas temporales y promos visibles en la carta"],
                ["Estadísticas básicas", "Ve cuántas visitas tiene tu carta y qué platos se miran más"],
                ["Anuncios en carta", "Muestra anuncios o destacados dentro de tu propia carta"],
              ]} btnText="Comenzar 7 días gratis" btnPrimary />
              <PlanCard name="Premium" price={anual ? "$39.900" : "$49.900"} period={anual ? "/mes + IVA · $478.800/año" : "/mes + IVA"} discount={anual ? "-20%" : undefined} desc="Gold + herramientas automatizadas de venta y retención" features={[
                ["4 vistas de carta", "Lista, grilla, destacados y vista por categorías"],
                ["Estadísticas avanzadas", "Métricas detalladas: platos más vistos, horarios pico, conversión y tendencias"],
                ["Botón llamar garzón", "El cliente puede llamar al garzón directo desde la carta digital"],
                ["Productos sugeridos", "Sugiere acompañamientos, bebidas o postres junto a cada plato"],
                ["Multiidioma (ES, EN, PT)", "Tu carta se traduce automáticamente a español, inglés y portugués"],
                ["Cumpleaños automáticos", "Enviamos invitaciones especiales a clientes de cumpleaños para que lo celebren en tu restaurante"],
                ["Clientes ilimitados", "Sin límite de clientes registrados"],
                ["Email marketing", "Envía campañas de email a tu base de clientes registrados"],
                ["Integración Toteat", "Sincroniza tu carta con el POS Toteat y cruza datos reales de venta con comportamiento de usuario"],
              ]} btnText="Comenzar 7 días gratis" btnPrimary={false} />
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer>
        <div className="container footer-content">
          <div>
            <div className="footer-copy">© 2026 QuieroComer® · Todos los derechos reservados · Santiago, Chile</div>
          </div>
          <div className="footer-links">
            <a href="#" onClick={(e) => { e.preventDefault(); openRandomCarta(); }}>Carta ejemplo</a>
            <a href="#" onClick={(e) => { e.preventDefault(); setPlanesOpen(true); }}>Planes</a>
            <a href="#">Términos</a>
            <a href="#">Privacidad</a>
            <a href="mailto:hola@quierocomer.cl">hola@quierocomer.cl</a>
          </div>
        </div>
      </footer>
    </>
  );
}

function PlanCard({ name, price, period, desc, features, btnText, btnPrimary, featured, discount }: {
  name: string; price: string; period: string; desc: string;
  features: [string, string][]; btnText: string; btnPrimary: boolean; featured?: boolean; discount?: string;
}) {
  return (
    <div className={`plan-card${featured ? " plan-featured" : ""}`}>
      {featured && <div className="plan-badge">Popular</div>}
      <div className="plan-name">{name}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-start" }}>
        <div className="plan-price">{price}</div>
        {discount && <span className="plan-discount">{discount}</span>}
      </div>
      <div className="plan-period">{period}</div>
      <p className="plan-desc">{desc}</p>
      <ul className="plan-features">
        {features.map(([label, tip], i) => (
          <li key={i}>
            <span className="plan-check">✓</span>
            {label}
            <i className="tip" data-tip={tip}>i</i>
          </li>
        ))}
      </ul>
      <a href="#" className={btnPrimary ? "plan-btn-primary" : "plan-btn"}>{btnText}</a>
    </div>
  );
}

const LANDING_CSS = `
:root{
  --black:#0A0908;--black-soft:#131110;--black-warm:#1A1714;
  --amber:#E8A33D;--amber-bright:#F4B962;--amber-deep:#B8801A;
  --cream:#E8DDC8;--cream-soft:#C9BBA0;--gray-warm:#7D7366;--gray-deep:#3A342D;
  --white:#FFF7EA;--green:#8ECF8E;
  --font-display:'Cormorant Garamond',serif;--font-body:'Inter',sans-serif;
}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth;overflow-x:hidden;max-width:100vw}
body{background:var(--black);color:var(--cream);font-family:var(--font-body);font-weight:300;line-height:1.6;overflow-x:hidden;-webkit-font-smoothing:antialiased}
body:before{content:'';position:fixed;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3CfeColorMatrix values='0 0 0 0 0.91 0 0 0 0 0.64 0 0 0 0 0.24 0 0 0 0.06 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");opacity:.25;pointer-events:none;z-index:999;mix-blend-mode:overlay}
h1,h2,h3{font-family:var(--font-display);font-weight:400;color:var(--cream);letter-spacing:-.01em}
.container{max-width:1220px;margin:0 auto;padding:0 clamp(22px,4vw,64px);position:relative}
.accent{color:var(--amber);font-style:italic}
nav{position:fixed;top:0;left:0;right:0;z-index:100;padding:20px clamp(22px,4vw,64px);display:flex;justify-content:space-between;align-items:center;background:linear-gradient(180deg,rgba(10,9,8,.92),rgba(10,9,8,.15));backdrop-filter:blur(8px)}
.logo{font-family:var(--font-display);font-size:21px;font-weight:600;color:var(--cream);display:flex;align-items:center;gap:10px;letter-spacing:.02em}
.lamp-icon{height:26px;width:auto;margin-right:-2px;object-fit:contain}
.nav-link{color:var(--cream-soft);font-size:13px;text-decoration:none;letter-spacing:.04em;transition:.25s}
.nav-link:hover{color:var(--amber)}
.nav-cta{padding:11px 20px;background:rgba(232,163,61,.12);border:1px solid rgba(232,163,61,.25);color:var(--cream);font-size:13px;font-weight:700;text-decoration:none;letter-spacing:.04em;transition:.25s}
.nav-cta:hover{background:var(--amber);color:var(--black)}
.hero{min-height:100vh;display:flex;align-items:center;position:relative;overflow:hidden;padding:120px 0 80px}
.hero-bg{position:absolute;inset:0;background-image:linear-gradient(90deg,rgba(10,9,8,.94) 0%,rgba(10,9,8,.72) 42%,rgba(10,9,8,.26) 100%),url('/landing/hero-restaurante.jpg');background-size:cover;background-position:center;transform:scale(1.03)}
.hero-glow{position:absolute;inset:auto -15% -30% -15%;height:55%;background:radial-gradient(ellipse at 65% 80%,rgba(232,163,61,.22),transparent 55%),radial-gradient(ellipse at 80% 60%,rgba(200,140,40,.1),transparent 45%)}
.hero-grid{position:relative;z-index:2;display:grid;grid-template-columns:1.1fr .9fr;gap:0;max-width:1200px;margin:0 auto;align-items:center}.hero-grid>div:first-child{text-align:center}
.eyebrow{font-size:12px;letter-spacing:.3em;text-transform:uppercase;color:var(--amber);font-weight:600;margin-bottom:22px}
.hero h1{font-size:clamp(38px,5vw,68px);line-height:1.02;max-width:820px;margin-bottom:28px}
.btn-primary{display:inline-flex;align-items:center;gap:14px;padding:20px 34px;margin-top:6px;margin-bottom:8px;background:var(--amber);color:var(--black);font-size:16px;font-weight:700;text-decoration:none;border:none;cursor:pointer;transition:.3s;box-shadow:0 20px 60px -20px rgba(232,163,61,.7)}
.btn-primary:hover{background:var(--amber-bright);transform:translateY(-2px)}
.hero-ia-text{font-family:var(--font-display);font-style:italic;font-size:clamp(18px,2vw,22px);color:var(--cream-soft);margin-bottom:28px;max-width:540px;line-height:1.4}
.hero-sub-text{font-size:clamp(17px,2vw,20px);color:var(--cream-soft);margin-bottom:24px;line-height:1.5;max-width:540px}
.microcopy{font-size:clamp(16px,2vw,16px);opacity:.5;color:var(--cream-soft);margin-top:14px;opacity:.8}
.phone-demo{width:260px;margin-left:-60px;margin:0 auto;position:relative}
.phone-frame{background:#0a0908;border-radius:36px;padding:8px;aspect-ratio:9/19;box-shadow:0 40px 100px rgba(0,0,0,.7),0 0 80px rgba(232,163,61,.12);border:2px solid rgba(232,163,61,.15);position:relative;overflow:hidden}
.phone-frame::before{content:'';position:absolute;top:8px;left:50%;transform:translateX(-50%);width:80px;height:22px;background:#0a0908;border-radius:0 0 14px 14px;z-index:2}
.phone-frame img{width:100%;height:100%;display:block;border-radius:28px;object-fit:cover;object-position:top}
.logos-band{background:var(--black-soft);border-top:1px solid rgba(232,163,61,.1);border-bottom:1px solid rgba(232,163,61,.1);padding:44px 0;text-align:center;overflow:hidden;max-width:100vw}
.logos-eyebrow{font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:var(--amber);font-weight:600;margin-bottom:22px}
.logos-track{display:flex;gap:14px;width:max-content;animation:scroll 32s linear infinite}.logos-track:hover{animation-play-state:paused}
.logos-scroller{overflow:hidden;mask-image:linear-gradient(90deg,transparent,black 12%,black 88%,transparent)}
.logo-chip{display:inline-flex;align-items:center;gap:14px;padding:17px 28px;border:1px solid var(--gray-deep);background:rgba(20,18,16,.7);text-decoration:none;color:var(--cream-soft);cursor:pointer}
.logo-chip img,.logo-chip .logo-init{width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0}
.logo-init{display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff}
.logo-chip span{font-family:var(--font-display);font-size:20px;font-style:italic;white-space:nowrap}
.logo-chip span:last-child{color:var(--amber)}
@keyframes scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
section{position:relative}
.problem{padding:130px 0;text-align:center;background:linear-gradient(rgba(10,9,8,.75),rgba(10,9,8,.75)),url('/landing/444.png');background-size:cover;background-position:center}
.problem h2{font-size:clamp(41px,6vw,56px);line-height:1.12;max-width:900px;margin:0 auto 22px}
.problem p{max-width:650px;margin:0 auto;color:var(--cream-soft);font-size:18px}
.pains{padding:120px 0;background:var(--black-soft)}
.section-head{text-align:center;margin-bottom:70px}
.section-head h2{font-size:clamp(38px,4.5vw,50px);line-height:1.12;margin-bottom:16px}
.section-head p{max-width:620px;margin:0 auto;color:var(--cream-soft);font-size:17px}
.transition-narrative{padding:4rem 1rem 3rem;text-align:center;background:var(--black-soft)}
.hook{display:flex;align-items:center;justify-content:center;gap:14px;max-width:420px;margin:0 auto}
.hook-line{flex:1;height:1px;background:rgba(232,163,61,.3)}
.hook-text{font-family:var(--font-display);font-style:italic;font-size:clamp(18px,2.2vw,22px);color:var(--cream-soft);white-space:nowrap}
.hook-subtitle{font-family:var(--font-body);font-size:11px;letter-spacing:.32em;text-transform:uppercase;color:rgba(232,163,61,.45);margin:14px 0 0}
.hook-subtitle strong{color:var(--cream-soft)}
.restaurant-quote{margin:3.5rem auto 0;max-width:800px;padding:0 1.5rem}
.quote-mark{display:block;font-family:var(--font-display);font-size:64px;line-height:.4;color:rgba(232,163,61,.35);text-align:center;height:28px;margin-bottom:8px}
.quote-text{font-family:var(--font-display);font-style:italic;font-size:clamp(26px,4vw,36px);line-height:1.25;color:var(--cream);margin:0 0 16px;font-weight:500}
.quote-attr{font-family:var(--font-body);font-style:normal;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--amber);display:block}
@media(max-width:640px){.transition-narrative{padding:3.5rem 1rem 2.5rem}.restaurant-quote{margin-top:2.5rem}.quote-text{font-size:clamp(26px,7vw,36px)}}
.pain-grid{display:grid;grid-template-columns:1fr;gap:32px}
.pain-card{display:grid;grid-template-columns:280px 1fr;gap:32px;align-items:center;background:rgba(10,9,8,.7);border:1px solid var(--gray-deep);padding:0;overflow:hidden;transition:.3s;min-height:280px}
.pain-card:hover{border-color:rgba(232,163,61,.45);transform:translateY(-4px)}
.pain-img{width:100%;height:280px;object-fit:cover;display:block}
.pain-text{padding:32px 32px 32px 0}
.pain-num{font-family:var(--font-display);font-size:44px;font-style:italic;color:var(--amber);opacity:.7;display:block;margin-bottom:6px}
.pain-card h3{font-size:30px;line-height:1.1;margin-bottom:14px;display:inline;font-weight:700}
.pain-card p{color:var(--cream-soft);font-size:17px}
.pain-quote{font-family:var(--font-display);font-style:italic;color:#D4782A!important;font-size:24px!important;line-height:1.2;margin:0 0 10px}
.nace-banner{background:rgba(232,163,61,.08)!important;border-top:1px solid rgba(232,163,61,.15)!important;border-bottom:1px solid rgba(232,163,61,.15)!important;padding:14px 16px!important;margin-bottom:28px!important;text-align:center!important}
.nace-banner p{font-family:var(--font-display)!important;font-size:clamp(24px,3.5vw,34px)!important;font-style:italic!important;color:var(--cream)!important;letter-spacing:.01em!important;margin:0 auto!important;padding:0!important;text-align:center!important}
.nace-banner span{color:var(--cream)!important;text-decoration:underline!important;text-decoration-color:var(--amber)!important;text-underline-offset:4px!important}
.product-grid{display:grid;grid-template-columns:1fr 1fr;gap:50px;align-items:center;max-width:1100px;margin:0 auto;text-align:left}
.product-img{width:100%;border-radius:12px;border:1px solid rgba(232,163,61,.1)}
.product-img-mobile{display:none}
.product-proof{padding:120px 0;background:var(--black);position:relative;overflow:hidden}
.product-copy{text-align:center}
.product-copy h2{font-size:clamp(40px,5.5vw,64px);line-height:1.1;margin-bottom:24px}
.capabilities-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px 16px;margin-top:24px}
.capability{display:flex;align-items:center;gap:12px;text-align:left}
.capability-circle{width:44px;height:44px;border-radius:50%;flex-shrink:0;background:linear-gradient(135deg,rgba(232,163,61,.12),rgba(232,163,61,.04));border:.5px solid rgba(232,163,61,.35);display:flex;align-items:center;justify-content:center;color:var(--amber)}
.capability-verb{font-family:var(--font-display);font-style:italic;font-size:15px;color:var(--amber);font-weight:500;line-height:1.2;margin:0}
.capability-detail{font-family:var(--font-body);font-size:11px;line-height:1.3;color:rgba(232,221,200,.6);margin:2px 0 0}
.product-copy p{font-size:clamp(19px,2.5vw,17px);color:var(--cream-soft);margin-bottom:24px;max-width:700px;margin-left:auto;margin-right:auto}
.steps{padding:120px 0;background:var(--black)}
.steps-grid{display:grid;grid-template-columns:1fr;gap:32px}
.step{display:grid;grid-template-columns:280px 1fr;gap:0;align-items:center;background:var(--black-soft);border:1px solid var(--gray-deep);overflow:hidden}
.step.reverse{grid-template-columns:1fr 280px}
.step-img{width:100%;height:320px;object-fit:cover;display:block}
.step-text{padding:36px 32px;text-align:center}
.step-num{font-family:var(--font-display);font-size:40px;font-style:italic;color:var(--amber);opacity:.75;display:inline}
.step h3{font-size:32px;display:inline;font-weight:700;margin-bottom:14px}
.step p{color:var(--cream-soft);font-size:22px;margin-top:18px}
.faq{padding:100px 0;background:var(--black)}
.faq .section-head{text-align:center}
.faq-list{max-width:760px;margin:0 auto}
.faq-item{border-bottom:1px solid var(--gray-deep)}
.faq-q{font-family:var(--font-display);font-size:24px;color:var(--cream);padding:22px 0;cursor:pointer;display:flex;justify-content:center;align-items:center;gap:16px;text-align:center}
.faq-q::after{content:'+';font-size:28px;color:var(--amber);transition:.3s;flex-shrink:0}
.faq-item.open .faq-q::after{content:'−';transform:rotate(180deg)}
.faq-a{color:var(--cream-soft);font-size:16px;line-height:1.7;max-height:0;overflow:hidden;transition:max-height .35s ease,padding .35s ease;padding:0;text-align:center}
.faq-item.open .faq-a{max-height:200px;padding:0 0 22px}
.final-cta{padding:150px 0;text-align:center;background:radial-gradient(circle at center,rgba(232,163,61,.15),transparent 48%),var(--black-soft)}
.final-cta h2{font-size:clamp(42px,6vw,68px);line-height:1.06;margin-bottom:34px}
.final-cta p{font-family:var(--font-display);font-style:italic;font-size:24px;color:var(--cream-soft);margin-bottom:34px}
.fine{font-size:17px;color:var(--cream-soft);margin-top:16px;letter-spacing:.03em}
.btn-secondary{display:inline-block;margin-top:18px;padding:12px 28px;background:transparent;border:1px solid rgba(232,163,61,.3);color:var(--cream-soft);font-size:14px;text-decoration:none;transition:.25s;letter-spacing:.02em}
.btn-secondary:hover{border-color:var(--amber);color:var(--cream)}
.tip{display:inline-block;width:16px;height:16px;border-radius:50%;background:rgba(232,163,61,.15);color:var(--amber);font-size:10px;text-align:center;line-height:16px;margin-left:6px;cursor:help;position:relative;font-style:normal;font-weight:700;vertical-align:middle}
.tip:hover::after{content:attr(data-tip);position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);background:var(--black);border:1px solid var(--amber);color:var(--cream-soft);font-size:12px;font-weight:400;padding:8px 12px;border-radius:6px;width:200px;white-space:normal;z-index:10;line-height:1.4;pointer-events:none}
footer{padding:44px 0;background:var(--black);border-top:1px solid var(--gray-deep)}
.footer-content{display:flex;justify-content:space-between;gap:20px;align-items:center;flex-wrap:wrap}
.footer-copy{font-size:14px;color:var(--gray-warm);margin-top:6px}
.footer-links{display:flex;gap:24px}
.footer-links a{color:var(--gray-warm);text-decoration:none;font-size:13px;cursor:pointer}
.footer-links a:hover{color:var(--amber)}
.planes-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.plan-card{background:var(--black);border:1px solid var(--gray-deep);padding:28px 24px;display:flex;flex-direction:column;position:relative}
.plan-featured{border-color:var(--amber);box-shadow:0 0 70px rgba(232,163,61,.08)}
.plan-badge{position:absolute;top:-11px;left:50%;transform:translateX(-50%);background:var(--amber);color:var(--black);font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;padding:6px 12px}
.plan-name{font-family:var(--font-display);font-size:24px;font-style:italic;color:var(--amber);margin-bottom:10px}
.plan-price{font-family:var(--font-display);font-size:38px;color:var(--cream);line-height:1}
.plan-period{font-size:13px;color:var(--gray-warm);margin-bottom:16px}
.plan-discount{background:rgba(142,207,142,.15);color:#8ECF8E;font-size:12px;font-weight:700;padding:4px 8px;border-radius:4px;border:1px solid rgba(142,207,142,.25)}
.plan-desc{font-size:14px;color:var(--cream-soft);padding-bottom:18px;border-bottom:1px solid var(--gray-deep);min-height:60px}
.plan-features{list-style:none;margin-top:18px;display:grid;gap:10px}
.plan-features li{font-size:13px;color:var(--cream-soft);padding-left:20px;position:relative}
.plan-check{position:absolute;left:0;color:var(--amber);font-weight:800}
.plan-btn,.plan-btn-primary{display:block;text-align:center;margin-top:22px;padding:14px;font-size:14px;font-weight:600;text-decoration:none;transition:.25s}
.plan-btn{background:rgba(232,163,61,.12);border:1px solid rgba(232,163,61,.25);color:var(--cream)}
.plan-btn-primary{background:var(--amber);color:var(--black);font-weight:700;border:none}
@media(max-width:900px){
  nav{padding:16px 20px}.logo{font-size:20px}.nav-link{display:none}.nav-cta{font-size:12px;padding:9px 14px;background:var(--amber);color:var(--black)}
  .hero{padding:110px 0 70px}.hero-grid{grid-template-columns:1fr}.hero-grid>div:first-child{text-align:center}.hero h1{font-size:clamp(44px,12vw,58px)}.phone-demo{display:none}
  .problem,.pains,.product-proof,.steps{padding:82px 0}.section-head{margin-bottom:42px}.product-grid{grid-template-columns:1fr;text-align:center}.capabilities-grid{grid-template-columns:1fr;gap:14px}.product-img{display:none}.product-img-mobile{display:block;width:100%;border-radius:12px;border:1px solid rgba(232,163,61,.1);margin:20px 0}
  .pain-card{grid-template-columns:35% 1fr;gap:12px}.pain-img{height:100%;min-height:200px}.pain-text{padding:16px 16px 16px 0;display:flex;flex-direction:column;justify-content:center;text-align:center}.pain-num{font-size:26px;display:inline}.pain-card h3{font-size:30px;margin-bottom:12px;display:inline;font-weight:700}.pain-card p{font-size:17px}
  .step{grid-template-columns:35% 1fr;gap:0}.step.reverse{grid-template-columns:1fr 35%}.step-img{height:220px}.step-text{padding:16px}.step-num{font-size:32px}.step h3{font-size:26px}.step p{font-size:16px}
  .planes-grid{grid-template-columns:1fr}
  .footer-content{flex-direction:column;text-align:center}.footer-links{justify-content:center}
  .btn-primary{padding:18px 28px;font-size:17px}.final-cta{padding:100px 0}
}
`;
