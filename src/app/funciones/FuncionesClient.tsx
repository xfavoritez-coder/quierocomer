"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Footer from "@/components/Footer";
import NavHamburger from "@/components/NavHamburger";

const heroes: Record<
  string,
  {
    bg: string;
    pill: string;
    title: string;
    titleHighlight: string;
    text: string;
    card: string;
    bullets: string[];
  }
> = {
  garzon: {
    bg: "/funciones/garzon.jpg",
    pill: "Atención desde la mesa",
    title: "Tus clientes no deberían",
    titleHighlight: "esperar al garzón.",
    text: "Permite que tus clientes llamen al garzón, pidan la cuenta o soliciten ayuda directamente desde tu carta QR.",
    card: "Llamado al garzón desde la mesa",
    bullets: ["Pedir otro trago", "Solicitar postre", "Pedir la cuenta"],
  },
  sugerencias: {
    bg: "/funciones/sugerencias.jpg",
    pill: "Venta inteligente",
    title: "Tu carta puede",
    titleHighlight: "vender más por ti.",
    text: "Recomienda entradas, tragos, acompañamientos y postres justo cuando el cliente está decidiendo.",
    card: "Sugerencias inteligentes",
    bullets: ["Combina con…", "Los más pedidos", "Aumenta el ticket promedio"],
  },
  clientes: {
    bg: "/funciones/clientes.jpg",
    pill: "Captación de clientes",
    title: "Tus clientes se van.",
    titleHighlight: "Sus datos no.",
    text: "Captura nombre, correo y cumpleaños para crear tu propia base de clientes y volver a traerlos.",
    card: "Base de clientes propia",
    bullets: ["Nombre y correo", "Fecha de cumpleaños", "Promociones futuras"],
  },
  cumpleanos: {
    bg: "/funciones/cumpleanos.jpg",
    pill: "Fidelización automática",
    title: "Haz que tus clientes",
    titleHighlight: "vuelvan en su cumpleaños.",
    text: "Envía automáticamente regalos, descuentos o promociones de cumpleaños.",
    card: "Emails automáticos",
    bullets: [
      "Correos automáticos",
      "Cupones personalizados",
      "Más clientes volviendo",
    ],
  },
  promos: {
    bg: "/funciones/promos.jpg",
    pill: "Promociones",
    title: "Destaca lo que más te conviene",
    titleHighlight: "vender hoy.",
    text: "Muestra promociones, productos nuevos o platos estratégicos directamente en tu carta QR.",
    card: "Promociones dentro de la carta",
    bullets: ["Promos del día", "Lanzamientos", "Mayor visibilidad"],
  },
};

const features = [
  {
    num: "01",
    title: "Llamar al garzón",
    desc: "El cliente puede pedir atención desde la mesa sin levantar la mano ni esperar a ser visto.",
    tags: ["Pedir ayuda", "Pedir cuenta", "Menos espera"],
    img: "/funciones/garzon.jpg",
    imgPos: "center 30%",
    wide: true,
  },
  {
    num: "02",
    title: "Sugerencias inteligentes",
    desc: "Recomienda entradas, tragos, acompañamientos o postres mientras el cliente decide.",
    tags: ["Combina con", "Más vendidos"],
    img: "/funciones/sugerencias.jpg",
    imgPos: "center 30%",
  },
  {
    num: "03",
    title: "Fotos que venden",
    desc: "Convierte tu carta en una experiencia visual que hace más fácil elegir.",
    tags: ["Fotos grandes", "Platos destacados"],
    img: "/funciones/fotos.jpg",
    imgPos: "center 30%",
  },
  {
    num: "06",
    title: "Promociones visibles",
    desc: "Destaca productos nuevos, ofertas del día o platos con mejor margen.",
    tags: ["Promos", "Lanzamientos"],
    img: "/funciones/promos.jpg",
    imgPos: "center 30%",
  },
  {
    num: "07",
    title: "Analítica de la carta",
    desc: "Descubre qué miran tus clientes, qué platos llaman más la atención y qué productos necesitan impulso.",
    tags: ["Platos vistos", "Horarios", "Datos reales"],
    img: "/funciones/analitica.jpg",
    imgPos: "center center",
    wide: true,
  },
  {
    num: "08",
    title: "Varios idiomas",
    desc: "Facilita la experiencia de turistas y clientes extranjeros.",
    tags: ["Español", "Inglés"],
    img: "/funciones/idiomas.jpg",
    imgPos: "center 20%",
  },
  {
    num: "09",
    title: "Complementa tu carta física",
    desc: "No reemplaza tu carta impresa. La potencia con funciones inteligentes.",
    tags: ["Física + QR", "Mejor experiencia"],
    img: "/funciones/carta-fisica.jpg",
    imgPos: "center center",
  },
];

const CSS = `
:root{
  --black:#0A0908;--black-soft:#131110;--black-warm:#1A1714;
  --amber:#E8A33D;--amber-bright:#F4B962;--amber-deep:#B8801A;
  --cream:#E8DDC8;--cream-soft:#C9BBA0;--gray-warm:#7D7366;--gray-deep:#3A342D;
  --white:#FFF7EA;
  --font-display:'Cormorant Garamond',serif;--font-body:'Inter',sans-serif;
}
*{margin:0;padding:0;box-sizing:border-box}
html,body{scroll-behavior:smooth;overflow-x:hidden;max-width:100vw}
body{background:var(--black);color:var(--cream);font-family:var(--font-body);font-weight:300;line-height:1.6;-webkit-font-smoothing:antialiased}
body:before{content:'';position:fixed;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3CfeColorMatrix values='0 0 0 0 0.91 0 0 0 0 0.64 0 0 0 0 0.24 0 0 0 0.06 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");opacity:.25;pointer-events:none;z-index:999;mix-blend-mode:overlay}
h1,h2,h3{font-family:var(--font-display);font-weight:400;color:var(--cream);letter-spacing:-.01em}
a{text-decoration:none;color:inherit}
img{max-width:100%;display:block}
section{position:relative}

.fn-container{max-width:1220px;margin:0 auto;padding:0 clamp(22px,4vw,64px);position:relative}

/* Nav */
.fn-nav{position:fixed;top:0;left:0;right:0;z-index:100;padding:20px clamp(22px,4vw,64px);display:flex;justify-content:space-between;align-items:center;background:linear-gradient(180deg,rgba(10,9,8,.92),rgba(10,9,8,.15));backdrop-filter:blur(8px)}
.fn-logo{font-family:var(--font-display);font-size:21px;font-weight:600;color:var(--cream);display:flex;align-items:center;gap:10px;letter-spacing:.02em;text-decoration:none}
.fn-lamp{height:20px;width:auto;margin-right:-8px;object-fit:contain}

/* Hero */
.fn-hero{min-height:100vh;display:flex;align-items:center;position:relative;overflow:hidden;padding:140px 0 100px}
.fn-hero-bg{position:absolute;inset:0;background-size:cover;background-position:center top}
.fn-hero-overlay{position:absolute;inset:0;background:linear-gradient(90deg,rgba(10,9,8,.94) 0%,rgba(10,9,8,.78) 42%,rgba(10,9,8,.55) 100%)}
.fn-hero-glow{position:absolute;inset:auto -15% -30% -15%;height:55%;background:radial-gradient(ellipse at 65% 80%,rgba(232,163,61,.22),transparent 55%)}
.fn-hero-grid{position:relative;z-index:2;display:grid;grid-template-columns:1fr .65fr;gap:56px;align-items:center}
.fn-eyebrow{font-size:13px;letter-spacing:.3em;text-transform:uppercase;color:var(--amber);font-weight:400;margin-bottom:24px}
.fn-hero h1{font-size:clamp(42px,6.5vw,82px);line-height:1;margin-bottom:28px;font-weight:600}
.fn-hero h1 span{color:var(--amber);font-style:italic}
.fn-hero-sub{font-size:clamp(17px,2vw,20px);color:var(--cream-soft);line-height:1.55;max-width:580px;margin-bottom:38px}
.fn-actions{display:flex;gap:14px;flex-wrap:wrap}
.fn-btn-primary{display:inline-flex;align-items:center;gap:14px;padding:20px 34px;background:var(--amber);color:var(--black);font-size:16px;font-weight:700;text-decoration:none;border:none;cursor:pointer;transition:.3s;box-shadow:0 20px 60px -20px rgba(232,163,61,.7)}
.fn-btn-primary:hover{background:var(--amber-bright);transform:translateY(-2px)}
.fn-btn-secondary{display:inline-flex;align-items:center;padding:16px 28px;background:transparent;border:1px solid rgba(232,163,61,.3);color:var(--cream-soft);font-size:14px;font-weight:600;text-decoration:none;transition:.25s;letter-spacing:.02em}
.fn-btn-secondary:hover{border-color:var(--amber);color:var(--cream)}

/* Hero preview card */
.fn-preview{background:rgba(14,12,10,.72);border:1px solid var(--gray-deep);border-radius:16px;padding:14px;backdrop-filter:blur(16px)}
.fn-preview-img{height:310px;border-radius:12px;background-size:cover;background-position:center top;margin-bottom:16px}
.fn-preview h3{font-family:var(--font-display);font-size:24px;margin:0 0 12px;font-weight:400;color:var(--cream)}
.fn-preview ul{list-style:none;padding:0;margin:0;display:grid;gap:9px;color:var(--cream-soft);font-size:14px}
.fn-preview li{display:flex;align-items:center;gap:10px}
.fn-preview li::before{content:'';width:7px;height:7px;background:var(--amber);border-radius:50%;flex-shrink:0}

/* Divider */
.fn-divider{height:1px;background:rgba(232,163,61,.1);position:relative}
.fn-divider-icon{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:36px;height:36px;border-radius:50%;border:1.5px solid var(--amber);background:rgba(10,9,8,.9);display:flex;align-items:center;justify-content:center;color:var(--amber);z-index:4}

/* Section */
.fn-section{padding:80px 0 40px;background:var(--black)}
.fn-section-eyebrow{font-size:13px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--amber);margin-bottom:18px;text-align:center}
.fn-section-title{font-family:var(--font-display);font-size:clamp(33px,5.5vw,59px);line-height:1.08;margin-bottom:48px;font-weight:500;max-width:760px;text-align:center;margin-left:auto;margin-right:auto}

/* Cards grid */
.fn-grid{display:grid;gap:18px;grid-template-columns:1fr}
.fn-card{background:rgba(20,18,16,.5);border:1px solid var(--gray-deep);border-radius:16px;overflow:hidden;transition:border-color .25s,transform .25s}
.fn-card:hover{border-color:rgba(232,163,61,.35);transform:translateY(-3px)}
.fn-card-img{height:220px;background-size:cover;background-position:center top}
.fn-card-body{padding:24px}
.fn-card-num{font-family:var(--font-display);font-style:italic;font-size:28px;color:var(--amber);opacity:.7;display:block;margin-bottom:8px}
.fn-card h3{font-family:var(--font-display);font-size:27px;line-height:1.08;margin:0 0 12px;font-weight:700;color:var(--cream)}
.fn-card p{margin:0 0 18px;color:var(--cream-soft);font-size:15px;line-height:1.5}
.fn-tags{display:flex;flex-wrap:wrap;gap:8px}
.fn-tags span{background:rgba(232,163,61,.08);border:1px solid rgba(232,163,61,.18);padding:7px 12px;border-radius:8px;font-size:12px;color:var(--cream-soft);font-weight:500;letter-spacing:.02em}

/* Final CTA */
.fn-final{padding:80px 0 80px;text-align:center;background:radial-gradient(circle at center,rgba(232,163,61,.15),transparent 48%),var(--black-soft)}
.fn-final h2{font-family:var(--font-display);font-size:clamp(32px,3.8vw,48px);line-height:1.06;margin-bottom:20px;font-weight:500}
.fn-final h2 span{color:var(--amber);font-style:italic}
.fn-final p{font-family:var(--font-display);font-style:italic;font-size:21px;color:var(--cream-soft);margin-bottom:28px;max-width:620px;margin-left:auto;margin-right:auto;line-height:1.4}
.fn-btn-cta{display:inline-flex;align-items:center;padding:14px 32px;background:rgba(232,163,61,.12);border:1px solid rgba(232,163,61,.3);color:var(--cream);font-size:15px;font-weight:600;text-decoration:none;transition:.25s;letter-spacing:.02em}
.fn-btn-cta:hover{background:var(--amber);color:var(--black);border-color:var(--amber)}

/* Desktop */
@media(min-width:900px){
  .fn-grid{grid-template-columns:repeat(3,1fr)}
  .fn-card-wide{grid-column:span 2}
  .fn-card-img{height:280px}
  .fn-preview-img{height:360px}
}

/* Mobile */
@media(max-width:900px){
  .fn-nav{padding:16px 20px}
  .fn-logo{font-size:20px}
  .fn-hero{padding:90px 0 70px}
  .fn-hero-grid{grid-template-columns:1fr;gap:28px;text-align:center}
  .fn-hero-sub{margin-left:auto;margin-right:auto}
  .fn-actions{justify-content:center}
  .fn-preview{display:none}
  .fn-section{padding:60px 0 30px}
  .fn-final{padding:60px 0 60px}
  .fn-btn-primary{padding:18px 28px;font-size:15px}
  .fn-btn-secondary{}
}
`;

function FuncionesInner() {
  const searchParams = useSearchParams();
  const key = searchParams.get("feature") || "garzon";
  const data = heroes[key] || heroes.garzon;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* NAV */}
      <nav className="fn-nav">
        <a href="/" className="fn-logo">
          <img src="/landing/logo.png" alt="" className="fn-lamp" />
          QuieroComer
        </a>
        <NavHamburger />
      </nav>

      {/* HERO */}
      <section className="fn-hero">
        <div
          className="fn-hero-bg"
          style={{ backgroundImage: `url('${data.bg}')` }}
        />
        <div className="fn-hero-overlay" />
        <div className="fn-hero-glow" />
        <div className="fn-container fn-hero-grid">
          <div>
            <div className="fn-eyebrow">{data.pill}</div>
            <h1>
              {data.title} <span>{data.titleHighlight}</span>
            </h1>
            <p className="fn-hero-sub">{data.text}</p>
            <div className="fn-actions">
              <a href="/subircarta" className="fn-btn-primary">
                Sube tu carta gratis →
              </a>
              <a href="#funciones" className="fn-btn-secondary">
                Ver funciones
              </a>
            </div>
          </div>

          <div className="fn-preview">
            <div
              className="fn-preview-img"
              style={{ backgroundImage: `url('${data.bg}')` }}
            />
            <h3>{data.card}</h3>
            <ul>
              {data.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* DIVIDER */}
      <div className="fn-divider">
        <div className="fn-divider-icon">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </div>

      {/* FEATURES GRID */}
      <section className="fn-section" id="funciones" style={{ scrollMarginTop: 40 }}>
        <div className="fn-container">
          <p className="fn-section-eyebrow">Funciones inteligentes</p>
          <h2 className="fn-section-title">
            Tu carta QR también puede{" "}
            <span style={{ color: "var(--amber)", fontStyle: "italic" }}>
              vender, atender y fidelizar.
            </span>
          </h2>

          <div className="fn-grid">
            {features.map((f) => (
              <article
                key={f.num}
                className={`fn-card ${f.wide ? "fn-card-wide" : ""}`}
              >
                <div
                  className="fn-card-img"
                  style={{ backgroundImage: `url('${f.img}')`, ...((f as any).imgPos ? { backgroundPosition: (f as any).imgPos } : {}), ...((f as any).imgSize ? { backgroundSize: (f as any).imgSize } : {}) }}
                />
                <div className="fn-card-body">
                  <span className="fn-card-num">{f.num}</span>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                  <div className="fn-tags">
                    {f.tags.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* DIVIDER */}
      <div
        style={{
          maxWidth: 250,
          height: 1,
          margin: "0 auto",
          background:
            "linear-gradient(90deg,transparent,rgba(232,163,61,.35),transparent)",
        }}
      />

      {/* FINAL CTA */}
      <section className="fn-final">
        <div className="fn-container">
          <h2>
            Transforma tu carta en una <span>carta QR inteligente.</span>
          </h2>
          <p>Sube tu carta. Lo demás, lo hacemos nosotros.</p>
          <a href="/subircarta" className="fn-btn-cta">
            Transformar mi carta gratis →
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <Footer />
    </>
  );
}

export default function FuncionesClient() {
  return (
    <Suspense>
      <FuncionesInner />
    </Suspense>
  );
}
