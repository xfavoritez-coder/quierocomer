"use client";

import Footer from "@/components/Footer";
import NavHamburger from "@/components/NavHamburger";

export default function ProductosClient() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <div className="grain" />

      <nav className="productos-nav">
        <a href="/" className="productos-logo">
          <img src="/landing/logo.png" alt="" style={{ height: 20, marginRight: -8 }} />
          QuieroComer
        </a>
        <NavHamburger />
      </nav>

      <main className="productos-main">
        <div className="productos-glow" />

        <div className="productos-eyebrow">Productos</div>
        <h1 className="productos-title">
          Estamos cocinando algo <span>increíble</span>
        </h1>
        <p className="productos-sub">
          Nuevas herramientas para que tu restaurante venda más y tus clientes disfruten más.
        </p>

        {/* Blurred preview cards */}
        <div className="productos-grid">
          <div className="producto-card producto-blur">
            <div className="producto-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
            </div>
            <h3>Pedidos online</h3>
            <p>Tus clientes podrán pedir directo desde la carta digital sin intermediarios.</p>
          </div>
          <div className="producto-card producto-blur">
            <div className="producto-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
            </div>
            <h3>Reservas inteligentes</h3>
            <p>Sistema de reservas con confirmación automática y gestión de mesas en tiempo real.</p>
          </div>
          <div className="producto-card producto-blur">
            <div className="producto-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            </div>
            <h3>Analytics avanzados</h3>
            <p>Entiende qué platos generan más interés y optimiza tu carta con datos reales.</p>
          </div>
        </div>

        <div className="productos-coming">
          <div className="coming-badge">
            <span className="coming-dot" />
            Próximamente
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}

const STYLES = `
:root {
  --black:#0A0908;--amber:#E8A33D;--amber-bright:#F4B962;
  --cream:#E8DDC8;--cream-soft:#C9BBA0;--gray-warm:#7D7366;
  --font-display:'Cormorant Garamond',serif;--font-body:'Inter',sans-serif;
}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--black)!important;color:var(--cream)!important;font-family:var(--font-body)!important;-webkit-font-smoothing:antialiased}
.grain{position:fixed;inset:0;pointer-events:none;z-index:30;opacity:.13;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.6'/%3E%3C/svg%3E")}
.productos-nav{position:fixed;top:0;left:0;right:0;z-index:1000;padding:20px clamp(22px,4vw,64px);display:flex;justify-content:space-between;align-items:center;background:rgba(10,9,8,.85);backdrop-filter:blur(12px)}
.productos-logo{font-family:var(--font-display);font-size:20px;font-weight:600;color:var(--cream);display:flex;align-items:center;gap:10px;letter-spacing:.02em;text-decoration:none}
.productos-main{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:120px 24px 80px;position:relative;overflow:hidden}
.productos-glow{position:absolute;top:20%;left:50%;transform:translateX(-50%);width:600px;height:600px;background:radial-gradient(circle,rgba(232,163,61,.1),transparent 60%);pointer-events:none}
.productos-eyebrow{font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:var(--amber);font-weight:600;margin-bottom:20px;position:relative}
.productos-title{font-family:var(--font-display);font-size:clamp(36px,6vw,58px);line-height:1.05;font-weight:400;margin-bottom:18px;position:relative}
.productos-title span{color:var(--amber);font-style:italic}
.productos-sub{max-width:480px;color:var(--cream-soft);font-size:16px;line-height:1.55;margin-bottom:48px;position:relative}
.productos-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;max-width:800px;width:100%;margin-bottom:48px;position:relative}
.producto-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:20px;padding:28px 22px;text-align:left;transition:.3s}
.producto-card h3{font-family:var(--font-display);font-size:22px;font-weight:500;margin-bottom:8px;color:var(--cream)}
.producto-card p{font-size:13px;color:var(--cream-soft);line-height:1.5;opacity:.7}
.producto-icon{width:52px;height:52px;border-radius:14px;background:rgba(232,163,61,.08);border:1px solid rgba(232,163,61,.15);display:grid;place-items:center;color:var(--amber);margin-bottom:16px}
.producto-blur{filter:blur(3px);opacity:.6;pointer-events:none;user-select:none}
.productos-coming{position:relative;display:flex;flex-direction:column;align-items:center;gap:12px}
.coming-badge{display:inline-flex;align-items:center;gap:8px;padding:8px 18px;background:rgba(232,163,61,.08);border:1px solid rgba(232,163,61,.2);border-radius:999px;font-size:13px;font-weight:600;color:var(--amber);letter-spacing:.02em}
.coming-dot{width:8px;height:8px;border-radius:50%;background:var(--amber);animation:dotPulse 2s ease-in-out infinite}
@keyframes dotPulse{0%,100%{opacity:.4;transform:scale(.9)}50%{opacity:1;transform:scale(1.1)}}
.productos-coming p{font-size:14px;color:var(--cream-soft);opacity:.7}
.coming-cta{margin-top:4px;padding:12px 28px;background:rgba(232,163,61,.1);border:1px solid rgba(232,163,61,.25);color:var(--amber);font-size:14px;font-weight:600;text-decoration:none;border-radius:12px;transition:.2s}
.coming-cta:hover{background:var(--amber);color:var(--black)}
`;
