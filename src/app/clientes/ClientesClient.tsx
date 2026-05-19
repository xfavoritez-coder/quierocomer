"use client";

import { useEffect, useRef, useState } from "react";
import Footer from "@/components/Footer";
import NavHamburger from "@/components/NavHamburger";

const TESTIMONIALS = [
  { quote: "Subimos nuestra carta en minutos y nuestros clientes extranjeros por fin pueden leer el menú completo.", name: "Sebastián Rojas", place: "Hand Roll · Santiago", photo: "https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=120&h=120&q=80" },
  { quote: "Antes nuestros clientes no sabían qué pedir. Ahora la carta les recomienda y piden más.", name: "Carolina Vega", place: "Horus Vegan · Santiago", photo: "https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?auto=format&fit=crop&w=120&h=120&q=80" },
  { quote: "Lo mejor es que puedo actualizar precios al instante sin depender de nadie.", name: "Andrés Muñoz", place: "Juana la Brava · Santiago", photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80" },
  { quote: "Nuestros turistas ahora leen la carta en su idioma. Las ventas subieron.", name: "Marco Ricci", place: "Alleria Pizza · Santiago", photo: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=120&h=120&q=80" },
  { quote: "En 60 segundos teníamos nuestra carta digital lista. Increíble.", name: "Felipe Torres", place: "Nascosto · Santiago", photo: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=120&h=120&q=80" },
];

function TestimonialCarousel() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setCurrent(c => (c + 1) % TESTIMONIALS.length), 5000);
    return () => clearInterval(interval);
  }, []);

  const t = TESTIMONIALS[current];

  return (
    <section className="cl-clients-bg" style={{ textAlign: "center", padding: "50px 24px" }}>
      <div style={{ position: "relative", maxWidth: 540, margin: "0 auto" }}>
        <img
          key={`photo-${current}`}
          src={t.photo} alt=""
          style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(244,166,35,.2)", marginBottom: 18, display: "block", marginLeft: "auto", marginRight: "auto", animation: "clFadeIn .5s ease" }}
        />
        <p
          key={`quote-${current}`}
          style={{ fontFamily: "'Cormorant Garamond',serif", fontStyle: "italic", fontSize: "clamp(20px,3vw,26px)", lineHeight: 1.4, color: "#F1E3CB", margin: "0 0 18px", minHeight: 80, animation: "clFadeIn .5s ease" }}
        >
          &ldquo;{t.quote}&rdquo;
        </p>
        <div key={`name-${current}`} style={{ fontSize: 16, fontWeight: 700, color: "#F5EFE2", animation: "clFadeIn .5s ease" }}>{t.name}</div>
        <div style={{ fontSize: 12, color: "#9B8E7A", marginTop: 2 }}>{t.place}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 20 }}>
        {TESTIMONIALS.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            style={{
              width: i === current ? 20 : 6, height: 6, borderRadius: 3,
              background: i === current ? "#F4A623" : "rgba(255,255,255,.15)",
              border: "none", cursor: "pointer", transition: "all .3s", padding: 0,
            }}
          />
        ))}
      </div>
    </section>
  );
}

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
          <div className="cl-hero-content">
            <div className="cl-eyebrow">Clientes</div>
            <h1 className="cl-h1">Restaurantes reales, <span className="cl-italic-gold">resultados reales.</span></h1>
            <p className="cl-hero-copy">Ya confían en nosotros para que sus clientes disfruten más cada vez que abren la carta.</p>
          </div>
        </header>

        {/* Badges */}
        <div className="cl-badges">
          <div className="cl-badge-item">
            <span className="cl-badge-num">{clients.length}+</span>
            <span className="cl-badge-label">Restaurantes activos</span>
          </div>
          <div className="cl-badge-sep" />
          <div className="cl-badge-item">
            <span className="cl-badge-num">3</span>
            <span className="cl-badge-label">Idiomas</span>
          </div>
          <div className="cl-badge-sep" />
          <div className="cl-badge-item">
            <span className="cl-badge-num">60s</span>
            <span className="cl-badge-label">Para subir tu carta</span>
          </div>
        </div>

        {/* Clients */}
        <section className="cl-section cl-section-center">
          <h2 className="cl-h2">Restaurantes que ya <span className="cl-italic-gold">venden más</span></h2>
          <p className="cl-section-sub">Toca cualquier carta para ver cómo se ve QuieroComer funcionando en restaurantes reales.</p>

          <div className="cl-simple-grid">
            {clients.slice(0, 4).map((c) => (
              <a key={c.slug} href={`/qr/${c.slug}?from=clientes`} target="_blank" rel="noopener" className="cl-simple-card">
                <div className="cl-simple-logo">
                  {c.logoUrl ? <img src={c.logoUrl} alt={c.name} /> : <span>{c.name.split(" ").map(w => w[0]).join("").slice(0, 2)}</span>}
                </div>
                <div className="cl-simple-name">{c.name}</div>
                <div className="cl-simple-meta">{c.dishes} platos · {c.categories} cat.</div>
                <div className="cl-simple-link">Ver carta →</div>
              </a>
            ))}
          </div>
        </section>

        {/* Testimonials carousel */}
        <TestimonialCarousel />

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
  background:#050403!important;
  color:#F5EFE2!important;font-family:Inter,system-ui,-apple-system,sans-serif!important;overflow-x:hidden!important;-webkit-font-smoothing:antialiased;
}
body::before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.18;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.35'/%3E%3C/svg%3E");mix-blend-mode:overlay;z-index:0}

.cl-page{position:relative;z-index:1}
.cl-italic-gold{font-style:italic;color:#FFC766}

.cl-hero{position:relative;min-height:580px;padding:140px 0 140px;display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden}
.cl-hero-bg{position:absolute;inset:0;background:url('/landing/clientes2.webp') center 40%/cover;z-index:-3}
.cl-hero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,4,3,.15) 0%,rgba(5,4,3,.4) 30%,rgba(5,4,3,.8) 55%,rgba(5,4,3,.95) 75%,rgba(5,4,3,1) 100%),linear-gradient(90deg,rgba(5,4,3,.7) 0%,rgba(5,4,3,.2) 50%,transparent 100%);z-index:-2}
.cl-hero-content{max-width:900px;margin:0 auto;padding:0 clamp(22px,4vw,64px);text-align:left;display:flex;flex-direction:column;align-items:flex-start}
.cl-hero-glow{position:absolute;width:240px;height:240px;right:-70px;top:110px;border-radius:50%;background:rgba(244,166,35,.18);filter:blur(80px);z-index:-1}
.cl-eyebrow{color:#F4A623;font-size:11px;font-weight:800;letter-spacing:.32em;text-transform:uppercase;margin-bottom:16px}
.cl-h1{font-family:'Cormorant Garamond',serif;font-size:clamp(38px,8vw,62px);line-height:.98;font-weight:400;letter-spacing:-.04em;max-width:520px;text-shadow:0 4px 28px rgba(0,0,0,.45);margin:0 0 20px}
.cl-hero-copy{max-width:420px;color:#B7A993;font-size:16px;line-height:1.55;margin:0}

.cl-metrics{margin:-14px clamp(18px,4vw,64px) 58px;position:relative;z-index:5;border:1px solid rgba(244,166,35,.18);border-radius:26px;background:linear-gradient(135deg,rgba(244,166,35,.08),rgba(255,255,255,.035));backdrop-filter:blur(18px);box-shadow:0 22px 60px rgba(0,0,0,.46),inset 0 0 0 1px rgba(255,255,255,.03);overflow:hidden;max-width:980px;margin-left:auto;margin-right:auto}
.cl-metric{display:grid;grid-template-columns:52px 1fr;gap:14px;padding:18px;border-bottom:1px solid rgba(255,255,255,.07);align-items:center}
.cl-metric:last-child{border-bottom:0}
.cl-metric-icon{width:52px;height:52px;border-radius:18px;display:grid;place-items:center;border:1px solid rgba(244,166,35,.22);background:rgba(244,166,35,.05);color:#F4A623}
.cl-metric strong{display:block;font-family:'Cormorant Garamond',serif;font-size:34px;line-height:1;font-weight:400;letter-spacing:-.04em}
.cl-metric span{display:block;margin-top:5px;color:#9B8E7A;font-size:12px;line-height:1.35}

.cl-badges{display:flex;align-items:center;justify-content:center;gap:0;margin:-60px auto 80px;position:relative;z-index:5;max-width:680px;padding:18px 28px;border-radius:20px;border:1px solid rgba(244,166,35,.15);background:rgba(10,8,5,.85);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:0 16px 48px rgba(0,0,0,.4)}
.cl-badge-item{flex:1;text-align:center}
.cl-badge-num{display:block;font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:400;color:#F5EFE2;line-height:1}
.cl-badge-label{display:block;font-size:11px;color:#9B8E7A;margin-top:4px;letter-spacing:.02em}
.cl-badge-sep{width:1px;height:36px;background:rgba(255,255,255,.08);flex-shrink:0}
@keyframes clFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.cl-clients-bg{background:rgba(255,255,255,.06);border-top:1px solid rgba(255,255,255,.08);border-bottom:1px solid rgba(255,255,255,.08)}
.cl-simple-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-top:30px}
.cl-simple-card{display:flex;flex-direction:column;align-items:center;padding:24px 16px;border-radius:18px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);text-decoration:none;color:#F5EFE2;transition:all .3s}
.cl-simple-card:hover{border-color:rgba(244,166,35,.25);transform:translateY(-3px)}
.cl-simple-logo{width:52px;height:52px;border-radius:14px;overflow:hidden;margin-bottom:12px;background:rgba(244,166,35,.1);display:grid;place-items:center}
.cl-simple-logo img{width:100%;height:100%;object-fit:cover}
.cl-simple-logo span{color:#F4A623;font-size:16px;font-weight:700}
.cl-simple-name{font-size:15px;font-weight:600;margin-bottom:4px}
.cl-simple-meta{font-size:11px;color:#9B8E7A;margin-bottom:10px}
.cl-simple-link{font-size:12px;color:#F4A623;font-weight:600;opacity:.7;transition:opacity .2s}
.cl-simple-card:hover .cl-simple-link{opacity:1}
.cl-section{padding:0 clamp(18px,4vw,64px) 80px;max-width:900px;margin:0 auto}
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
.cl-owner-photo{height:180px;background:linear-gradient(180deg,rgba(0,0,0,.02),rgba(0,0,0,.76)),url('https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=80') center/cover;position:relative}
.cl-mini-phone{position:absolute;right:18px;bottom:-34px;width:86px;height:160px;border-radius:18px;background:#080706;border:1px solid rgba(255,255,255,.16);box-shadow:0 18px 42px rgba(0,0,0,.65);transform:rotate(5deg)}
.cl-quote-box{padding:48px 22px 24px}
.cl-quote-mark{color:#F4A623;font-family:'Cormorant Garamond',serif;font-size:58px;line-height:.7;margin-bottom:10px}
.cl-quote-text{font-family:'Cormorant Garamond',serif;font-style:italic;font-size:21px;line-height:1.45;color:#F1E3CB;letter-spacing:-.02em;margin:0}
.cl-stars{color:#F4A623;letter-spacing:.18em;margin-top:18px;font-size:14px}
.cl-author{display:flex;align-items:center;gap:12px;margin-top:20px}
.cl-avatar{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:rgba(244,166,35,.18);color:#F4A623;font-weight:800}
.cl-author strong{display:block;font-size:14px}
.cl-author span{color:#9B8E7A;font-size:12px}

.cl-cta{text-align:center;padding:60px clamp(22px,4vw,64px) 76px;max-width:1080px;margin:0 auto}
.cl-cta p{color:#9B8E7A;margin:14px 0 0;font-size:15px}
.cl-primary-btn{margin-top:28px;display:inline-flex;align-items:center;justify-content:center;min-width:200px;height:48px;border-radius:14px;border:0;background:linear-gradient(135deg,#FFC35B,#F4A623 55%,#D98712);color:#120C04;font-weight:800;font-size:14px;box-shadow:0 18px 60px rgba(244,166,35,.34),inset 0 1px 0 rgba(255,255,255,.38);text-decoration:none;transition:.2s}
.cl-primary-btn:hover{transform:translateY(-2px);box-shadow:0 24px 72px rgba(244,166,35,.4)}
.cl-benefits{display:grid;gap:13px;margin-top:32px}
.cl-benefit{display:flex;align-items:center;gap:8px;color:#C2B29A;font-size:13px;justify-content:center}
.cl-benefit-icon{font-size:15px}

@media(max-width:699px){.cl-h1{max-width:320px}.cl-cta .cl-h2{max-width:260px;margin-left:auto;margin-right:auto}}
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
