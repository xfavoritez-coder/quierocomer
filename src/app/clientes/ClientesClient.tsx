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

  const PHOTOS = [
    "https://images.unsplash.com/photo-1611143669185-af224c5e3252?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1563612116625-3012372fccce?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80",
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
        padding: "20px clamp(22px,4vw,64px)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "rgba(5,4,3,.78)", backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        borderBottom: "1px solid rgba(255,255,255,.045)",
      }}>
        <a href="/" style={{
          fontFamily: "'Cormorant Garamond',serif", fontSize: 21, fontWeight: 600,
          color: "#F5EFE2", display: "flex", alignItems: "center", gap: 8,
          letterSpacing: "-.03em", textDecoration: "none",
        }}>
          <img src="/landing/logo.png" alt="" style={{ height: 20, marginRight: -8 }} />
          QuieroComer
        </a>
        <NavHamburger />
      </nav>

      <main className="cl-page">
        {/* Hero */}
        <header className="cl-hero">
          <div className="cl-hero-bg" />
          <div className="cl-hero-glow" />
          <div className="cl-eyebrow">Clientes</div>
          <h1 className="cl-h1">Restaurantes reales, <span className="cl-italic-gold">resultados reales.</span></h1>
          <p className="cl-hero-copy">Ya confían en nosotros para que sus clientes disfruten más cada vez que abren la carta.</p>
        </header>
        <div style={{ position: "relative", height: 100, marginTop: -35, zIndex: 3 }}>
          <svg viewBox="0 0 1440 120" preserveAspectRatio="none" style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 100 }}>
            <path d="M0,0 C360,50 1080,50 1440,0 L1440,120 L0,120 Z" fill="#050403" />
          </svg>
          <div style={{
            position: "absolute", left: "50%", top: "25%", transform: "translate(-50%,-50%)",
            width: 36, height: 36, borderRadius: "50%",
            border: "1.5px solid #F4A623", background: "rgba(5,4,3,.9)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#F4A623", zIndex: 4,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
          </div>
        </div>

        {/* Clients */}
        <section className="cl-section cl-section-center">
          <h2 className="cl-h2">Restaurantes que ya <span className="cl-italic-gold">venden más</span></h2>
          <p className="cl-section-sub">Toca cualquier carta para ver cómo se ve QuieroComer funcionando en restaurantes reales.</p>

          <div className="cl-clients-scroll">
            {clients.map((c, i) => (
              <a key={c.slug} href={`/qr/${c.slug}?from=clientes`} target="_blank" rel="noopener"
                className="cl-client-card" style={{ "--photo": `url('${PHOTOS[i % PHOTOS.length]}')` } as any}>
                <div className="cl-client-top">
                  <div className="cl-logo-dot">
                    {c.logoUrl ? <img src={c.logoUrl} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} /> : c.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                  </div>
                </div>
                <div className="cl-client-body">
                  <h3>{c.name}</h3>
                  <p className="cl-client-meta">Santiago · {c.dishes} platos · {c.categories} categorías</p>
                  <span className="cl-client-link">Ver carta →</span>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* Testimonial */}
        <section className="cl-section">
          <article className="cl-testimonial">
            <div className="cl-owner-photo">
              <div className="cl-mini-phone" />
            </div>
            <div className="cl-quote-box">
              <div className="cl-quote-mark">&ldquo;</div>
              <p className="cl-quote-text">Subimos nuestra carta en minutos y nuestros clientes extranjeros por fin pueden leer el menú completo.</p>
              <div className="cl-author">
                <div className="cl-avatar">H</div>
                <div><strong>Hand Roll</strong><span>Santiago, Chile</span></div>
              </div>
            </div>
          </article>
        </section>

        {/* CTA */}
        <section className="cl-cta">
          <h2 className="cl-h2">Tu restaurante también puede <span className="cl-italic-gold">verse así.</span></h2>
          <p>Sube tu carta. Nosotros hacemos el resto.</p>
          <a className="cl-primary-btn" href="/subircarta">Subir mi carta ahora →</a>
        </section>
      </main>

      <Footer />
    </>
  );
}

const STYLES = `
body{
  margin:0!important;
  background:radial-gradient(circle at 70% 6%,rgba(244,166,35,.16),transparent 28%),radial-gradient(circle at 12% 28%,rgba(244,166,35,.08),transparent 22%),linear-gradient(180deg,#070604 0%,#050403 48%,#030302 100%)!important;
  color:#F5EFE2!important;font-family:Inter,system-ui,-apple-system,sans-serif!important;overflow-x:hidden!important;-webkit-font-smoothing:antialiased;
}
body::before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.18;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.35'/%3E%3C/svg%3E");mix-blend-mode:overlay;z-index:0}

.cl-page{position:relative;z-index:1}
.cl-italic-gold{font-style:italic;color:#FFC766}

.cl-hero{position:relative;min-height:580px;padding:140px clamp(22px,4vw,64px) 34px;display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden;max-width:1180px;margin:0 auto}
.cl-hero-bg{position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,4,3,.1) 0%,rgba(5,4,3,.4) 35%,rgba(5,4,3,.85) 65%,rgba(5,4,3,1) 100%),url('/landing/clientes.png') center/cover;filter:saturate(.85) contrast(1.08) brightness(.82);transform:scale(1.02);z-index:-2}
.cl-hero-glow{position:absolute;width:240px;height:240px;right:-70px;top:110px;border-radius:50%;background:rgba(244,166,35,.18);filter:blur(80px);z-index:-1}
.cl-eyebrow{color:#F4A623;font-size:11px;font-weight:800;letter-spacing:.32em;text-transform:uppercase;margin-bottom:16px}
.cl-h1{font-family:'Cormorant Garamond',serif;font-size:clamp(38px,8vw,62px);line-height:.98;font-weight:400;letter-spacing:-.04em;max-width:600px;text-shadow:0 4px 28px rgba(0,0,0,.45);margin:0 0 20px}
.cl-hero-copy{max-width:420px;color:#B7A993;font-size:16px;line-height:1.55;margin:0}

.cl-metrics{margin:-14px clamp(18px,4vw,64px) 58px;position:relative;z-index:5;border:1px solid rgba(244,166,35,.18);border-radius:26px;background:linear-gradient(135deg,rgba(244,166,35,.08),rgba(255,255,255,.035));backdrop-filter:blur(18px);box-shadow:0 22px 60px rgba(0,0,0,.46),inset 0 0 0 1px rgba(255,255,255,.03);overflow:hidden;max-width:980px;margin-left:auto;margin-right:auto}
.cl-metric{display:grid;grid-template-columns:52px 1fr;gap:14px;padding:18px;border-bottom:1px solid rgba(255,255,255,.07);align-items:center}
.cl-metric:last-child{border-bottom:0}
.cl-metric-icon{width:52px;height:52px;border-radius:18px;display:grid;place-items:center;border:1px solid rgba(244,166,35,.22);background:rgba(244,166,35,.05);color:#F4A623}
.cl-metric strong{display:block;font-family:'Cormorant Garamond',serif;font-size:34px;line-height:1;font-weight:400;letter-spacing:-.04em}
.cl-metric span{display:block;margin-top:5px;color:#9B8E7A;font-size:12px;line-height:1.35}

.cl-section{padding:0 clamp(18px,4vw,64px) 70px;max-width:1080px;margin:0 auto}
.cl-section-center{text-align:center}
.cl-h2{font-family:'Cormorant Garamond',serif;font-size:clamp(30px,5vw,38px);line-height:1.08;font-weight:400;letter-spacing:-.04em;margin:0}
.cl-section-sub{color:#9B8E7A;font-size:14px;line-height:1.55;margin:12px auto 0;max-width:420px}

.cl-clients-scroll{display:grid;grid-auto-flow:column;grid-auto-columns:78%;gap:14px;overflow-x:auto;padding:30px 4px 8px;scroll-snap-type:x mandatory;scrollbar-width:none}
.cl-clients-scroll::-webkit-scrollbar{display:none}
.cl-client-card{min-height:330px;border-radius:24px;padding:18px;scroll-snap-align:center;position:relative;overflow:hidden;background:#111;border:1px solid rgba(255,255,255,.09);box-shadow:0 18px 60px rgba(0,0,0,.45);text-decoration:none;color:#F5EFE2;display:block;transition:transform .3s,border-color .3s}
.cl-client-card:hover{transform:translateY(-4px);border-color:rgba(244,166,35,.3)}
.cl-client-card::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.86)),var(--photo);background-size:cover;background-position:center;filter:saturate(.92) contrast(1.06);z-index:0}
.cl-client-card>*{position:relative;z-index:1}
.cl-client-top{display:flex;align-items:center;justify-content:space-between}
.cl-logo-dot{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:rgba(0,0,0,.56);border:1px solid rgba(255,255,255,.1);font-weight:800;color:white;font-size:13px;overflow:hidden}
.cl-live{display:inline-flex;align-items:center;gap:6px;color:#A7F0A9;background:rgba(25,80,39,.45);border:1px solid rgba(167,240,169,.18);border-radius:999px;padding:6px 10px;font-size:10px;font-weight:800;letter-spacing:.04em}
.cl-live::before{content:"";width:7px;height:7px;border-radius:50%;background:#78D985;box-shadow:0 0 10px #78D985;animation:clLivePulse 2s ease-in-out infinite}
@keyframes clLivePulse{0%,100%{opacity:.5}50%{opacity:1}}
.cl-client-body{position:absolute;left:18px;right:18px;bottom:18px}
.cl-client-body h3{font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:400;letter-spacing:-.035em;margin:0 0 6px}
.cl-client-meta{color:#B4A691;font-size:12px;line-height:1.5;margin:0 0 16px}
.cl-client-link{color:#F4A623;font-weight:800;font-size:13px}

.cl-testimonial{border:1px solid rgba(244,166,35,.18);border-radius:28px;overflow:hidden;background:linear-gradient(135deg,rgba(244,166,35,.08),rgba(255,255,255,.025));box-shadow:0 22px 70px rgba(0,0,0,.48)}
.cl-owner-photo{height:250px;background:linear-gradient(180deg,rgba(0,0,0,.02),rgba(0,0,0,.76)),url('https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=900&q=80') center/cover;position:relative}
.cl-mini-phone{position:absolute;right:18px;bottom:-34px;width:86px;height:160px;border-radius:18px;background:#080706;border:1px solid rgba(255,255,255,.16);box-shadow:0 18px 42px rgba(0,0,0,.65);transform:rotate(5deg)}
.cl-quote-box{padding:48px 22px 24px}
.cl-quote-mark{color:#F4A623;font-family:'Cormorant Garamond',serif;font-size:58px;line-height:.7;margin-bottom:10px}
.cl-quote-text{font-family:'Cormorant Garamond',serif;font-style:italic;font-size:21px;line-height:1.45;color:#F1E3CB;letter-spacing:-.02em;margin:0}
.cl-stars{color:#F4A623;letter-spacing:.18em;margin-top:18px;font-size:14px}
.cl-author{display:flex;align-items:center;gap:12px;margin-top:20px}
.cl-avatar{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:rgba(244,166,35,.18);color:#F4A623;font-weight:800}
.cl-author strong{display:block;font-size:14px}
.cl-author span{color:#9B8E7A;font-size:12px}

.cl-cta{text-align:center;padding:20px clamp(22px,4vw,64px) 76px;max-width:1080px;margin:0 auto}
.cl-cta p{color:#9B8E7A;margin:14px 0 0;font-size:15px}
.cl-primary-btn{margin-top:28px;display:inline-flex;align-items:center;justify-content:center;min-width:238px;height:58px;border-radius:18px;border:0;background:linear-gradient(135deg,#FFC35B,#F4A623 55%,#D98712);color:#120C04;font-weight:900;font-size:16px;box-shadow:0 18px 60px rgba(244,166,35,.34),inset 0 1px 0 rgba(255,255,255,.38);text-decoration:none;transition:.2s}
.cl-primary-btn:hover{transform:translateY(-2px);box-shadow:0 24px 72px rgba(244,166,35,.4)}
.cl-benefits{display:grid;gap:13px;margin-top:32px}
.cl-benefit{display:flex;align-items:center;gap:8px;color:#C2B29A;font-size:13px;justify-content:center}
.cl-benefit-icon{font-size:15px}

@media(min-width:700px){
  .cl-metrics{display:grid;grid-template-columns:repeat(3,1fr)}
  .cl-metric{border-bottom:0;border-right:1px solid rgba(255,255,255,.07)}
  .cl-metric:last-child{border-right:0}
  .cl-clients-scroll{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;overflow:visible;padding:30px 0 8px}
  .cl-testimonial{display:grid;grid-template-columns:.85fr 1.15fr}
  .cl-owner-photo{height:auto}
  .cl-quote-box{padding:44px}
}
`;
