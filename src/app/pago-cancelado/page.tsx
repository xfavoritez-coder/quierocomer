"use client";

import Footer from "@/components/Footer";
import NavHamburger from "@/components/NavHamburger";

export default function PagoCanceladoPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="grain" />

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

      <main className="pc-main">
        <div className="pc-glow" />

        <div className="pc-card">
          <div className="pc-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#E8A33D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 12h8" />
            </svg>
          </div>

          <h1>Pago no completado</h1>
          <p className="pc-desc">
            El proceso de pago fue cancelado o no se pudo completar. No se realizó ningún cobro.
          </p>

          <div className="pc-actions">
            <a href="/planes" className="pc-btn-primary">Ver planes</a>
            <a href="/subircarta" className="pc-btn-secondary">Subir mi carta gratis</a>
          </div>

          <p className="pc-help">
            ¿Tuviste algún problema? <a href="/contacto">Escríbenos</a> y te ayudamos.
          </p>
        </div>
      </main>

      <Footer />
    </>
  );
}

const CSS = `
:root { --black:#0A0908; --amber:#E8A33D; --cream:#E8DDC8; --cream-soft:#C9BBA0; }
* { margin:0; padding:0; box-sizing:border-box; }
body { background:var(--black)!important; color:var(--cream)!important; font-family:Inter,-apple-system,sans-serif!important; }
.grain{position:fixed;inset:0;pointer-events:none;z-index:30;opacity:.13;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.6'/%3E%3C/svg%3E")}
.pc-main { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:100px 20px 60px; position:relative; }
.pc-glow { position:absolute; top:30%; left:50%; transform:translateX(-50%); width:400px; height:400px; background:radial-gradient(circle,rgba(232,163,61,.07),transparent 60%); pointer-events:none; }
.pc-card { position:relative; width:min(100%,420px); text-align:center; }
.pc-icon { width:72px; height:72px; margin:0 auto 20px; border-radius:50%; background:rgba(232,163,61,.08); border:1px solid rgba(232,163,61,.18); display:grid; place-items:center; }
.pc-card h1 { font-family:Georgia,serif; font-size:clamp(26px,5vw,34px); font-weight:400; margin-bottom:12px; }
.pc-desc { color:var(--cream-soft); font-size:15px; line-height:1.5; margin-bottom:28px; }
.pc-actions { display:flex; flex-direction:column; gap:10px; }
.pc-btn-primary { display:block; padding:15px; background:linear-gradient(135deg,#ffc44f,#f3a333); color:#100b03; font-size:15px; font-weight:900; text-decoration:none; text-align:center; border-radius:999px; box-shadow:0 12px 28px rgba(245,164,51,.18); }
.pc-btn-secondary { display:block; padding:13px; background:transparent; border:1px solid rgba(255,255,255,.15); color:var(--cream-soft); font-size:14px; font-weight:600; text-decoration:none; text-align:center; border-radius:999px; }
.pc-btn-secondary:hover { border-color:var(--amber); color:var(--amber); }
.pc-help { margin-top:24px; font-size:13px; color:var(--cream-soft); opacity:.6; }
.pc-help a { color:var(--amber); text-decoration:none; font-weight:600; }
`;
