"use client";

import { useState, useEffect } from "react";
import Footer from "@/components/Footer";

interface Props {
  restaurant: { name: string; slug: string; logoUrl: string | null };
  plan: string;
  stillProcessing: boolean;
}

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

const PLAN_NAMES: Record<string, string> = { FREE: "Gratis", GOLD: "Gold", PREMIUM: "Premium" };

const STEPS = [
  { icon: "📸", title: "Sube tus fotos reales", desc: "Reemplaza las fotos de referencia con fotos reales de tus platos." },
  { icon: "✏️", title: "Personaliza tu carta", desc: "Ajusta precios, descripciones y categorías desde el panel." },
  { icon: "🖨️", title: "Imprime tu QR", desc: "Descarga e imprime el código QR para las mesas de tu local." },
];

export default function ExitoClient({ restaurant, plan, stillProcessing }: Props) {
  const [show, setShow] = useState(false);
  const isPaid = plan === "GOLD" || plan === "PREMIUM";

  useEffect(() => { setTimeout(() => setShow(true), 100); }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <nav className="exito-nav">
        <a className="exito-logo" href="/">
          <img src="/landing/logo.png" alt="" style={{ height: 16 }} />
          QuieroComer
        </a>
      </nav>

      <main className="exito-main">
        <div className="exito-glow" />

        <div className={`exito-card${show ? " show" : ""}`}>
          {/* Logo */}
          <div className="exito-resto-logo">
            {restaurant.logoUrl
              ? <img src={restaurant.logoUrl} alt={restaurant.name} />
              : getInitials(restaurant.name)
            }
          </div>

          {/* Check animado */}
          <div className="exito-check">
            <svg width="48" height="48" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="22" fill="none" stroke="rgba(232,163,61,.2)" strokeWidth="2" />
              <circle cx="24" cy="24" r="22" fill="none" stroke="#E8A33D" strokeWidth="2.5"
                strokeDasharray="138" strokeDashoffset={show ? "0" : "138"}
                style={{ transition: "stroke-dashoffset 0.8s ease 0.3s" }} />
              <path d="M15 24l6 6 12-12" fill="none" stroke="#E8A33D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray="30" strokeDashoffset={show ? "0" : "30"}
                style={{ transition: "stroke-dashoffset 0.5s ease 0.9s" }} />
            </svg>
          </div>

          {/* Titulo */}
          <h1 className="exito-title">
            {isPaid
              ? <>Tu plan <em>{PLAN_NAMES[plan] || plan}</em> está activo</>
              : <>Tu carta está <em>activa</em></>
            }
          </h1>

          <p className="exito-subtitle">
            {restaurant.name} ya tiene su carta digital funcionando.
            {isPaid && plan === "PREMIUM" && <><br /><span style={{ fontSize: 12, opacity: 0.5 }}>Próximo cobro en 30 días · $49.900 + IVA/mes</span></>}
            {isPaid && plan === "GOLD" && <><br /><span style={{ fontSize: 12, opacity: 0.5 }}>Próximo cobro en 30 días · $35.000 + IVA/mes</span></>}
          </p>

          {/* Próximos pasos */}
          <div className="exito-steps">
            <div className="exito-steps-title">Próximos pasos</div>
            {STEPS.map((s, i) => (
              <div key={i} className="exito-step">
                <div className="exito-step-icon">{s.icon}</div>
                <div>
                  <strong>{s.title}</strong>
                  <p>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <a href={`/api/panel/demo-auth?slug=${restaurant.slug}`} className="exito-cta-primary">
            Ir a mi panel
          </a>
          <a href={`/qr/${restaurant.slug}`} className="exito-cta-secondary">
            Ver mi carta
          </a>
        </div>
      </main>

      <Footer />
    </>
  );
}

const CSS = `
:root { --cream:#E8DDC8; --cream-soft:#C9BBA0; --amber:#E8A33D; --black:#0A0908; --gray-warm:#7D7366; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--black) !important; color: var(--cream) !important; font-family: Inter, -apple-system, sans-serif !important; overflow-x: hidden !important; }
.exito-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; padding: 16px clamp(18px,4vw,64px); display: flex; align-items: center; background: rgba(10,9,8,.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
.exito-logo { font-family: Georgia, serif; font-size: 17px; font-weight: 400; color: var(--cream); display: flex; align-items: center; gap: 8px; text-decoration: none; }
.exito-main { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 80px 16px 60px; position: relative; }
.exito-glow { position: absolute; top: 25%; left: 50%; transform: translateX(-50%); width: min(500px, 100vw); height: 500px; background: radial-gradient(circle, rgba(232,163,61,.1), transparent 60%); pointer-events: none; }
.exito-card { position: relative; width: min(100%, 440px); text-align: center; opacity: 0; transform: translateY(20px); transition: all .6s ease; }
.exito-card.show { opacity: 1; transform: translateY(0); }
.exito-resto-logo { width: 68px; height: 68px; margin: 0 auto 20px; border-radius: 20px; border: 1px solid rgba(255,255,255,.14); display: grid; place-items: center; font-weight: 950; font-size: 18px; color: var(--amber); overflow: hidden; background: #111; box-shadow: 0 12px 30px rgba(0,0,0,.4); }
.exito-resto-logo img { width: 100%; height: 100%; object-fit: cover; }
.exito-check { margin: 0 auto 18px; width: 48px; height: 48px; }
.exito-title { font-family: Georgia, serif; font-size: clamp(28px,6vw,38px); font-weight: 400; line-height: 1.1; margin-bottom: 12px; }
.exito-title em { color: var(--amber); font-style: italic; }
.exito-subtitle { color: var(--cream-soft); font-size: 15px; line-height: 1.5; margin-bottom: 28px; }
.exito-steps { text-align: left; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.07); border-radius: 20px; padding: 20px; margin-bottom: 24px; }
.exito-steps-title { font-size: 11px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; color: var(--amber); margin-bottom: 14px; text-align: center; }
.exito-step { display: flex; gap: 12px; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,.05); }
.exito-step:last-child { border-bottom: none; }
.exito-step-icon { width: 36px; height: 36px; border-radius: 10px; background: rgba(232,163,61,.1); display: grid; place-items: center; font-size: 18px; flex-shrink: 0; }
.exito-step strong { display: block; font-size: 14px; margin-bottom: 3px; }
.exito-step p { font-size: 12px; color: var(--cream-soft); line-height: 1.4; }
.exito-cta-primary { display: block; width: 100%; padding: 15px; background: linear-gradient(135deg, #ffc44f, #f3a333); color: #100b03; font-size: 15px; font-weight: 900; text-decoration: none; text-align: center; border-radius: 999px; margin-bottom: 10px; box-shadow: 0 12px 28px rgba(245,164,51,.2); }
.exito-cta-secondary { display: block; width: 100%; padding: 13px; background: transparent; border: 1px solid rgba(255,255,255,.15); color: var(--cream-soft); font-size: 14px; font-weight: 600; text-decoration: none; text-align: center; border-radius: 999px; }
.exito-cta-secondary:hover { border-color: var(--amber); color: var(--amber); }
`;
