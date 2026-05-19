"use client";

import { useEffect, useRef, useState } from "react";
import Footer from "@/components/Footer";
import NavHamburger from "@/components/NavHamburger";

interface Client {
  name: string;
  slug: string;
  logoUrl: string | null;
  dishes: number;
  categories: number;
}

export default function ClientesClient({ clients, totalDishes, totalCategories }: { clients: Client[]; totalDishes: number; totalCategories: number }) {
  // Animate counters on mount
  const [countDishes, setCountDishes] = useState(0);
  const [countCats, setCountCats] = useState(0);
  const [countLangs, setCountLangs] = useState(0);
  const animated = useRef(false);

  useEffect(() => {
    if (animated.current) return;
    animated.current = true;
    const duration = 1800;
    const start = Date.now();
    const tick = () => {
      const t = Math.min((Date.now() - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setCountDishes(Math.round(ease * totalDishes));
      setCountCats(Math.round(ease * totalCategories));
      setCountLangs(Math.round(ease * 3));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [totalDishes, totalCategories]);

  // Duplicate for carousel
  const carousel = [...clients, ...clients, ...clients];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
        padding: "20px clamp(22px,4vw,64px)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "rgba(10,9,8,.85)", backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}>
        <a href="/" style={{
          fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 600,
          color: "#E8DDC8", display: "flex", alignItems: "center", gap: 10,
          letterSpacing: ".02em", textDecoration: "none",
        }}>
          <img src="/landing/logo.png" alt="" style={{ height: 20, marginRight: -8 }} />
          QuieroComer
        </a>
        <NavHamburger />
      </nav>

      <main>
        {/* Hero */}
        <section className="cl-hero">
          <div className="cl-hero-glow" />
          <div className="cl-hero-glow2" />
          <p className="cl-eyebrow">Clientes</p>
          <h1 className="cl-title">Restaurantes que ya <span>venden más</span></h1>
          <p className="cl-sub">Cartas reales funcionando hoy. Toca cualquiera para verla en vivo.</p>

          {/* Stats */}
          <div className="cl-stats">
            <div className="cl-stat">
              <div className="cl-stat-num">{countDishes.toLocaleString("es-CL")}+</div>
              <div className="cl-stat-label">platos digitalizados</div>
            </div>
            <div className="cl-stat-div" />
            <div className="cl-stat">
              <div className="cl-stat-num">{countCats}</div>
              <div className="cl-stat-label">categorías creadas</div>
            </div>
            <div className="cl-stat-div" />
            <div className="cl-stat">
              <div className="cl-stat-num">{countLangs}</div>
              <div className="cl-stat-label">idiomas activos</div>
            </div>
          </div>
        </section>

        {/* Carousel */}
        <section className="cl-carousel-section">
          <div className="cl-carousel-mask">
            <div className="cl-carousel">
              {carousel.map((c, i) => (
                <a key={i} href={`/qr/${c.slug}?from=clientes`} target="_blank" rel="noopener" className="cl-card">
                  <div className="cl-card-top">
                    {c.logoUrl ? (
                      <img src={c.logoUrl} alt={c.name} className="cl-card-logo" />
                    ) : (
                      <div className="cl-card-avatar">{c.name.charAt(0)}</div>
                    )}
                    <div className="cl-card-live">
                      <span className="cl-card-dot" />
                      En vivo
                    </div>
                  </div>
                  <h3 className="cl-card-name">{c.name}</h3>
                  <div className="cl-card-meta">
                    <span>{c.dishes} platos</span>
                    <span className="cl-card-sep" />
                    <span>{c.categories} categorías</span>
                  </div>
                  <div className="cl-card-cta">Ver carta →</div>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonial */}
        <section className="cl-testimonial">
          <div className="cl-quote-mark">&ldquo;</div>
          <p className="cl-quote-text">Subimos nuestra carta en un minuto y nuestros clientes extranjeros por fin pueden leer el menú completo.</p>
          <div className="cl-quote-author">
            <div className="cl-quote-avatar">H</div>
            <div>
              <div className="cl-quote-name">Hand Roll</div>
              <div className="cl-quote-loc">Santiago, Chile</div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="cl-cta-section">
          <div className="cl-cta-glow" />
          <h2 className="cl-cta-title">¿Listo para unirte?</h2>
          <p className="cl-cta-sub">Sube tu carta en 60 segundos. Gratis.</p>
          <a href="/subircarta" className="cl-cta-btn">Subir mi carta →</a>
        </section>
      </main>

      <Footer />
    </>
  );
}

const STYLES = `
body{background:#0A0908!important;color:#E8DDC8!important;font-family:'Inter',sans-serif!important;-webkit-font-smoothing:antialiased;overflow-x:hidden!important}

.cl-hero{text-align:center;padding:140px 24px 60px;position:relative;overflow:hidden}
.cl-hero-glow{position:absolute;top:-10%;left:50%;transform:translateX(-50%);width:700px;height:500px;background:radial-gradient(ellipse,rgba(232,163,61,.1),transparent 65%);pointer-events:none}
.cl-hero-glow2{position:absolute;bottom:-20%;left:30%;width:400px;height:400px;background:radial-gradient(circle,rgba(232,163,61,.05),transparent 60%);pointer-events:none}
.cl-eyebrow{font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:#E8A33D;font-weight:600;margin-bottom:16px}
.cl-title{font-family:'Cormorant Garamond',serif;font-size:clamp(36px,6vw,62px);line-height:1.05;font-weight:400;margin-bottom:16px}
.cl-title span{color:#E8A33D;font-style:italic}
.cl-sub{font-size:16px;color:#C9BBA0;opacity:.7;max-width:440px;margin:0 auto 48px;line-height:1.5}

.cl-stats{display:flex;justify-content:center;align-items:center;gap:0;flex-wrap:wrap}
.cl-stat{padding:0 clamp(20px,4vw,48px)}
.cl-stat-num{font-family:'Cormorant Garamond',serif;font-size:clamp(38px,6vw,56px);font-weight:400;color:#E8DDC8;line-height:1}
.cl-stat-label{font-size:12px;color:#C9BBA0;opacity:.5;margin-top:6px;letter-spacing:.03em}
.cl-stat-div{width:1px;height:48px;background:rgba(255,255,255,.06)}

.cl-carousel-section{padding:60px 0;overflow:hidden}
.cl-carousel-mask{mask-image:linear-gradient(90deg,transparent,black 8%,black 92%,transparent);-webkit-mask-image:linear-gradient(90deg,transparent,black 8%,black 92%,transparent);overflow:hidden}
.cl-carousel{display:flex;gap:16px;width:max-content;animation:clScroll 30s linear infinite;padding:8px 0}
.cl-carousel:hover{animation-play-state:paused}
@keyframes clScroll{from{transform:translateX(0)}to{transform:translateX(calc(-100% / 3))}}

.cl-card{display:flex;flex-direction:column;width:220px;padding:20px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:20px;text-decoration:none;color:#E8DDC8;transition:all .3s ease;flex-shrink:0}
.cl-card:hover{border-color:rgba(232,163,61,.3);transform:translateY(-4px);box-shadow:0 16px 40px rgba(0,0,0,.3)}
.cl-card-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.cl-card-logo{width:40px;height:40px;border-radius:12px;object-fit:cover}
.cl-card-avatar{width:40px;height:40px;border-radius:12px;background:rgba(232,163,61,.12);color:#E8A33D;display:grid;place-items:center;font-size:16px;font-weight:700}
.cl-card-live{display:flex;align-items:center;gap:5px;font-size:10px;color:rgba(142,207,142,.8);font-weight:600;letter-spacing:.04em;text-transform:uppercase}
.cl-card-dot{width:6px;height:6px;border-radius:50%;background:#8ECF8E;animation:livePulse 2s ease-in-out infinite}
@keyframes livePulse{0%,100%{opacity:.5}50%{opacity:1}}
.cl-card-name{font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:500;margin-bottom:6px}
.cl-card-meta{display:flex;align-items:center;gap:6px;font-size:12px;color:#C9BBA0;opacity:.6;margin-bottom:14px}
.cl-card-sep{width:3px;height:3px;border-radius:50%;background:currentColor;opacity:.4}
.cl-card-cta{font-size:13px;font-weight:600;color:#E8A33D;opacity:.7;transition:opacity .2s}
.cl-card:hover .cl-card-cta{opacity:1}

.cl-testimonial{text-align:center;padding:60px 24px 70px;max-width:600px;margin:0 auto}
.cl-quote-mark{font-family:'Cormorant Garamond',serif;font-size:64px;line-height:.3;color:rgba(232,163,61,.25);height:28px;margin-bottom:14px}
.cl-quote-text{font-family:'Cormorant Garamond',serif;font-style:italic;font-size:clamp(20px,3vw,28px);line-height:1.35;color:#E8DDC8;margin-bottom:24px;font-weight:400}
.cl-quote-author{display:flex;align-items:center;gap:12px;justify-content:center}
.cl-quote-avatar{width:36px;height:36px;border-radius:50%;background:rgba(232,163,61,.12);color:#E8A33D;display:grid;place-items:center;font-size:14px;font-weight:700}
.cl-quote-name{font-size:14px;font-weight:600;color:#E8DDC8}
.cl-quote-loc{font-size:12px;color:#C9BBA0;opacity:.5}

.cl-cta-section{text-align:center;padding:60px 24px 80px;position:relative;overflow:hidden}
.cl-cta-glow{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:500px;height:300px;background:radial-gradient(ellipse,rgba(232,163,61,.08),transparent 60%);pointer-events:none}
.cl-cta-title{font-family:'Cormorant Garamond',serif;font-size:clamp(28px,4vw,40px);font-weight:400;margin-bottom:10px;position:relative}
.cl-cta-sub{font-size:15px;color:#C9BBA0;opacity:.6;margin-bottom:24px;position:relative}
.cl-cta-btn{display:inline-block;padding:16px 36px;background:#E8A33D;color:#0A0908;font-size:16px;font-weight:700;text-decoration:none;border-radius:14px;transition:.2s;position:relative;box-shadow:0 16px 48px rgba(232,163,61,.25)}
.cl-cta-btn:hover{background:#F4B962;transform:translateY(-2px)}

@media(max-width:600px){
  .cl-stats{flex-direction:column;gap:20px}
  .cl-stat-div{width:40px;height:1px}
  .cl-card{width:180px;padding:16px}
}
`;
