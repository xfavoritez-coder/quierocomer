"use client";

import { useState } from "react";

const PLAN_CSS = `
.pm-overlay{position:fixed;inset:0;z-index:999;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.pm-box{background:#131110;border:1px solid #3A342D;max-width:1000px;width:100%;max-height:90vh;display:flex;flex-direction:column;position:relative;border-radius:12px;overflow:hidden}
.pm-scroll{overflow-y:auto;padding:40px}
.pm-close{position:absolute;top:12px;right:12px;background:rgba(232,163,61,.12);border:1px solid rgba(232,163,61,.25);color:#E8A33D;font-size:18px;width:32px;height:32px;cursor:pointer;border-radius:50%;display:flex;align-items:center;justify-content:center;z-index:10}
.pm-eyebrow{font-size:12px;letter-spacing:.3em;text-transform:uppercase;color:#E8A33D;font-weight:600;margin-bottom:22px}
.pm-toggle-label{position:relative;display:inline-block;width:48px;height:26px;cursor:pointer}
.pm-toggle-input{opacity:0;width:0;height:0}
.pm-toggle-track{position:absolute;inset:0;background:#3A342D;border-radius:26px;transition:.3s}
.pm-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.pm-card{background:#0A0908;border:1px solid #3A342D;padding:28px 24px;display:flex;flex-direction:column;position:relative}
.pm-featured{border-color:#E8A33D;box-shadow:0 0 70px rgba(232,163,61,.08)}
.pm-badge{position:absolute;top:-11px;left:50%;transform:translateX(-50%);background:#E8A33D;color:#0A0908;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;padding:6px 12px}
.pm-name{font-family:'Cormorant Garamond',serif;font-size:24px;font-style:italic;color:#E8A33D;margin-bottom:10px}
.pm-price{font-family:'Cormorant Garamond',serif;font-size:38px;color:#E8DDC8;line-height:1}
.pm-period{font-size:13px;color:#7D7366;margin-bottom:16px}
.pm-discount{background:rgba(34,197,94,.15);color:#4ade80;font-size:12px;font-weight:700;padding:3px 10px;border-radius:50px}
.pm-desc{font-size:14px;color:#C9BBA0;padding-bottom:18px;border-bottom:1px solid #3A342D;min-height:60px}
.pm-features{list-style:none;margin-top:18px;display:grid;gap:10px;padding:0}
.pm-features li{font-size:13px;color:#C9BBA0;padding-left:20px;position:relative}
.pm-check{position:absolute;left:0;color:#E8A33D;font-weight:800}
.pm-btn,.pm-btn-primary{display:block;text-align:center;margin-top:22px;padding:14px;font-size:14px;font-weight:600;text-decoration:none;transition:.25s;cursor:pointer;border:none}
.pm-btn{background:rgba(232,163,61,.12);border:1px solid rgba(232,163,61,.25);color:#E8DDC8}
.pm-btn-primary{background:#E8A33D;color:#0A0908;font-weight:700}
.pm-tip{display:inline-block;width:16px;height:16px;border-radius:50%;background:rgba(232,163,61,.15);color:#E8A33D;font-size:10px;text-align:center;line-height:16px;margin-left:6px;cursor:help;font-style:normal;font-weight:700;vertical-align:middle}
@media(max-width:860px){.pm-grid{grid-template-columns:1fr}.pm-scroll{padding:28px 20px}}
`;

function PlanCard({ name, price, period, desc, features, btnText, btnPrimary, featured, discount }: {
  name: string; price: string; period: string; desc: string;
  features: [string, string][]; btnText: string; btnPrimary: boolean; featured?: boolean; discount?: string;
}) {
  return (
    <div className={`pm-card${featured ? " pm-featured" : ""}`}>
      {featured && <div className="pm-badge">Popular</div>}
      <div className="pm-name">{name}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-start" }}>
        <div className="pm-price">{price}</div>
        {discount && <span className="pm-discount">{discount}</span>}
      </div>
      <div className="pm-period">{period}</div>
      <p className="pm-desc">{desc}</p>
      <ul className="pm-features">
        {features.map(([label, tip], i) => (
          <li key={i}>
            <span className="pm-check">✓</span>
            {label}
            <i className="pm-tip" data-tip={tip}>i</i>
          </li>
        ))}
      </ul>
      <a href="#" className={btnPrimary ? "pm-btn-primary" : "pm-btn"}>{btnText}</a>
    </div>
  );
}

export default function PlanesModal({ onClose }: { onClose: () => void }) {
  const [anual, setAnual] = useState(true);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PLAN_CSS }} />
      <div className="pm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="pm-box">
          <button onClick={onClose} className="pm-close">×</button>
          <div className="pm-scroll">
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <div className="pm-eyebrow">Planes</div>
              <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "clamp(30px,4vw,48px)", color: "#E8DDC8", fontWeight: 400 }}>Empieza gratis. <span style={{ color: "#E8A33D", fontStyle: "italic" }}>Crece cuando quieras.</span></h2>
              <p style={{ color: "#C9BBA0", fontSize: 15, marginTop: 8 }}>7 días de prueba en planes pagados · Cancela cuando quieras</p>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 12, marginTop: 20, fontSize: 14, color: "#C9BBA0" }}>
                <span style={{ color: anual ? "#C9BBA0" : "#E8A33D", fontWeight: anual ? 300 : 600 }}>Mensual</span>
                <label className="pm-toggle-label">
                  <input type="checkbox" checked={anual} onChange={() => setAnual(!anual)} className="pm-toggle-input" />
                  <span className="pm-toggle-track" />
                  <span style={{ position: "absolute", top: 3, left: anual ? 25 : 3, width: 20, height: 20, background: "#E8A33D", borderRadius: "50%", transition: ".3s" }} />
                </label>
                <span style={{ color: anual ? "#E8A33D" : "#C9BBA0", fontWeight: anual ? 600 : 300 }}>Anual</span>
              </div>
            </div>
            <div className="pm-grid">
              <PlanCard name="Gratis" price="$0" period="para siempre" desc="Carta QR digital para empezar a vender" features={[
                ["Carta QR digital", "Tu carta lista para escanear con QR"],
                ["2 vistas de carta", "Muestra tu carta en 2 distintas vistas para que elijas la que mejor represente tu local"],
                ["Panel autoadministrable", "Edita platos, precios y fotos desde tu panel sin depender de nadie"],
              ]} btnText="Comenzar gratis" btnPrimary={false} />
              <PlanCard name="Gold" price={anual ? "$29.900" : "$35.000"} period={anual ? "/mes + IVA · $358.800/año" : "/mes + IVA"} discount={anual ? "-15%" : undefined} desc="Gratis + herramientas para destacar tus platos y mejorar la experiencia de tus clientes" featured features={[
                ["El Genio (IA) incluido", "Asistente inteligente que recomienda platos según el perfil y preferencias del cliente"],
                ["Destaca platos estrella", "Resalta visualmente los platos que más te conviene vender"],
                ["Ofertas y promociones", "Crea ofertas temporales y promos visibles en la carta"],
                ["Estadísticas básicas", "Ve cuántas visitas tiene tu carta y qué platos se miran más"],
                ["Anuncios en carta", "Muestra anuncios o destacados dentro de tu propia carta"],
              ]} btnText="Comenzar 7 días gratis" btnPrimary />
              <PlanCard name="Premium" price={anual ? "$39.900" : "$49.900"} period={anual ? "/mes + IVA · $478.800/año" : "/mes + IVA"} discount={anual ? "-20%" : undefined} desc="Gold + herramientas automatizadas de venta y retención" features={[
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
      </div>
    </>
  );
}
