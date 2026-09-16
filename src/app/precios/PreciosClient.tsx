"use client";
import { Check, User } from "lucide-react";
import LandingFooter from "@/components/landing/LandingFooter";

const FREE_FEATURES = [
  "Carta QR digital",
  "1 diseño de carta",
  "Panel autoadministrable",
  "Edita platos, precios y fotos desde tu celular",
];

const PREMIUM_FEATURES = [
  "3 diseños de carta (Galería, Lista e Impact)",
  "Dark / Light mode",
  "Destacar platos estrella ilimitados",
  "Ofertas y promociones",
  "Página web de pedidos online — sin comisiones",
  "Cross-selling entre platos",
  "Estadísticas avanzadas",
  "Anuncios en carta",
  "Llamar al garzón",
  "Multiidioma ES / EN / PT",
  "Exportar carta imprimible en PDF",
  "Valoraciones y reseñas",
  "Tarjeta de fidelización digital",
  "Ver clientes ilimitados",
  "Multi-carta",
];

export default function PreciosClient() {
  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap');

        .pr-root {
          font-family: "Inter", system-ui, sans-serif;
          background: #0D0D0D;
          min-height: 100dvh;
          color: #0D0D0D;
        }

        /* NAV */
        .pr-header {
          position: sticky;
          top: 0;
          z-index: 100;
          height: 64px;
          display: flex;
          align-items: center;
          padding: 0 clamp(16px, 4vw, 48px);
          background: rgba(13,13,13,0.92);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .pr-header-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          max-width: 1080px;
          margin: 0 auto;
        }
        .pr-logo {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-size: 22px;
          font-weight: 850;
          letter-spacing: -.04em;
          text-decoration: none;
          color: #fff;
        }
        .pr-nav-ingresar {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 14px;
          font-weight: 600;
          color: rgba(255,255,255,0.8);
          text-decoration: none;
          padding: 8px 18px;
          border: 1.5px solid rgba(255,255,255,0.18);
          border-radius: 10px;
          background: transparent;
          transition: border-color .15s, background .15s;
          white-space: nowrap;
        }
        .pr-nav-ingresar:hover {
          border-color: rgba(255,255,255,0.4);
          background: rgba(255,255,255,0.07);
        }

        /* HERO */
        .pr-hero {
          position: relative;
          overflow: hidden;
          background: #0A0A0A;
          padding: 80px 24px 92px;
          text-align: center;
        }
        .pr-hero::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -60%);
          width: 800px;
          height: 500px;
          background: radial-gradient(ellipse at center, rgba(244,166,35,0.2) 0%, rgba(244,166,35,0.05) 50%, transparent 70%);
          pointer-events: none;
        }
        .pr-hero-eyebrow {
          position: relative;
          z-index: 1;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: .12em;
          text-transform: uppercase;
          color: #F4A623;
          margin-bottom: 22px;
          padding: 6px 14px;
          border: 1px solid rgba(244,166,35,0.25);
          border-radius: 20px;
          background: rgba(244,166,35,0.07);
        }
        .pr-hero h1 {
          position: relative;
          z-index: 1;
          font-family: "Space Grotesk", system-ui, sans-serif;
          font-size: clamp(34px, 6vw, 58px);
          font-weight: 800;
          letter-spacing: -.04em;
          line-height: 1.08;
          color: #fff;
          margin-bottom: 18px;
        }
        .pr-hero h1 span { color: #F4A623; }
        .pr-hero p {
          position: relative;
          z-index: 1;
          font-size: 18px;
          color: rgba(255,255,255,0.45);
          max-width: 420px;
          margin: 0 auto;
          line-height: 1.65;
        }

        /* CARDS */
        .pr-cards-wrap {
          background: #F5F2EB;
          padding: 72px 24px 88px;
        }
        .pr-cards {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          max-width: 820px;
          margin: 0 auto;
          align-items: start;
        }
        .pr-card {
          background: #fff;
          border: 1px solid #E8E5DF;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 2px 16px rgba(0,0,0,0.06);
        }
        .pr-card-header {
          padding: 32px 28px 24px;
          border-bottom: 1px solid #F0EDE7;
        }
        .pr-card-badge {
          display: inline-block;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .1em;
          text-transform: uppercase;
          padding: 4px 10px;
          border-radius: 20px;
          margin-bottom: 16px;
        }
        .pr-card-badge-free {
          background: #F0EDE7;
          color: rgba(0,0,0,0.45);
        }
        .pr-card-badge-premium {
          background: #FFF3D6;
          color: #B45309;
        }
        .pr-card-name {
          font-family: "Space Grotesk", system-ui, sans-serif;
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -.03em;
          color: #0D0D0D;
          margin-bottom: 6px;
        }
        .pr-card-desc {
          font-size: 14px;
          color: rgba(0,0,0,0.45);
          line-height: 1.55;
          margin-bottom: 24px;
        }
        .pr-price {
          display: flex;
          align-items: baseline;
          gap: 4px;
        }
        .pr-price-amount {
          font-family: "Space Grotesk", system-ui, sans-serif;
          font-size: 40px;
          font-weight: 800;
          letter-spacing: -.04em;
          color: #0D0D0D;
        }
        .pr-price-period {
          font-size: 14px;
          color: rgba(0,0,0,0.4);
        }
        .pr-card-body {
          padding: 24px 28px 32px;
        }
        .pr-features-label {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: .06em;
          text-transform: uppercase;
          color: rgba(0,0,0,0.35);
          margin-bottom: 14px;
        }
        .pr-features-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 11px;
          margin-bottom: 28px;
        }
        .pr-features-list li {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 14px;
          color: rgba(0,0,0,0.7);
          line-height: 1.45;
        }
        .pr-check {
          flex-shrink: 0;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 1px;
        }
        .pr-check-free {
          background: #F0EDE7;
          color: rgba(0,0,0,0.4);
        }
        .pr-check-premium {
          background: #FFF3D6;
          color: #D4870A;
        }
        .pr-btn {
          display: block;
          width: 100%;
          padding: 14px 0;
          border: none;
          border-radius: 14px;
          font-family: "Space Grotesk", system-ui, sans-serif;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: -.02em;
          cursor: pointer;
          text-align: center;
          text-decoration: none;
          transition: opacity .15s, transform .15s;
        }
        .pr-btn:hover { opacity: 0.88; transform: translateY(-1px); }
        .pr-btn-free {
          background: #F0EDE7;
          color: #0D0D0D;
        }
        .pr-btn-premium {
          background: #F4A623;
          color: #fff;
          box-shadow: 0 6px 24px rgba(244,166,35,0.35);
        }

        /* PREMIUM CARD HIGHLIGHT */
        .pr-card-premium {
          border: 2px solid #F4A623;
          box-shadow: 0 8px 40px rgba(244,166,35,0.15);
        }

        /* TRIAL NOTE */
        .pr-trial-note {
          text-align: center;
          font-size: 13px;
          color: rgba(0,0,0,0.4);
          margin-top: 20px;
        }
        .pr-trial-note strong { color: rgba(0,0,0,0.6); }


        @media (max-width: 640px) {
          .pr-cards { grid-template-columns: 1fr; max-width: 420px; }
          .pr-hero { padding: 56px 24px 64px; }
          .pr-cards-wrap { padding: 56px 24px 72px; }
        }
      `}</style>

      <div className="pr-root">
        {/* NAV */}
        <header className="pr-header">
          <div className="pr-header-inner">
            <a href="/" className="pr-logo" aria-label="QuieroComer">
              <img src="/logo.png" alt="" style={{ width: 30, height: 30, objectFit: "contain", flexShrink: 0 }} />
              <span>QuieroComer</span>
            </a>
            <a href="/panel" className="pr-nav-ingresar">
              <User size={15} strokeWidth={2.2} style={{ marginRight: 6 }} />
              Ingresar
            </a>
          </div>
        </header>

        {/* HERO */}
        <section className="pr-hero">
          <span className="pr-hero-eyebrow">Planes</span>
          <h1>Empieza gratis.<br /><span>Crece cuando quieras.</span></h1>
          <p>Sin contratos, sin sorpresas. Cancela cuando quieras.</p>
        </section>

        {/* CARDS */}
        <div className="pr-cards-wrap">
          <div className="pr-cards">

            {/* FREE */}
            <div className="pr-card">
              <div className="pr-card-header">
                <span className="pr-card-badge pr-card-badge-free">Gratis</span>
                <div className="pr-card-name">Plan Gratis</div>
                <div className="pr-card-desc">Para empezar a digitalizar tu carta sin costo.</div>
                <div className="pr-price">
                  <span className="pr-price-amount">$0</span>
                  <span className="pr-price-period">para siempre</span>
                </div>
              </div>
              <div className="pr-card-body">
                <div className="pr-features-label">Incluye</div>
                <ul className="pr-features-list">
                  {FREE_FEATURES.map(f => (
                    <li key={f}>
                      <span className="pr-check pr-check-free">
                        <Check size={11} strokeWidth={3} />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <a href="/subircarta" className="pr-btn pr-btn-free">Comenzar gratis</a>
              </div>
            </div>

            {/* PREMIUM */}
            <div className="pr-card pr-card-premium">
              <div className="pr-card-header">
                <span className="pr-card-badge pr-card-badge-premium">Premium</span>
                <div className="pr-card-name">Plan Premium</div>
                <div className="pr-card-desc">Todas las herramientas para vender más y fidelizar clientes.</div>
                <div className="pr-price">
                  <span className="pr-price-amount">$44.900</span>
                  <span className="pr-price-period">neto/mes</span>
                </div>
              </div>
              <div className="pr-card-body">
                <div className="pr-features-label">Todo lo del plan Gratis, más</div>
                <ul className="pr-features-list">
                  {PREMIUM_FEATURES.map(f => (
                    <li key={f}>
                      <span className="pr-check pr-check-premium">
                        <Check size={11} strokeWidth={3} />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <a href="/subircarta" className="pr-btn pr-btn-premium">Probar gratis 7 días →</a>
              </div>
            </div>

          </div>

        </div>

        <LandingFooter />
      </div>
    </>
  );
}
