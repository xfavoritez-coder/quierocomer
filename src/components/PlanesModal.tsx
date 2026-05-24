"use client";

import { useState } from "react";
import { PLANS, PLAN_ORDER, type PlanKey } from "@/lib/billing/plans-central";

const PLAN_CSS = `
.pm-overlay{position:fixed;inset:0;z-index:999;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.pm-box{background:#131110;border:1px solid #3A342D;max-width:1100px;width:100%;max-height:90vh;display:flex;flex-direction:column;position:relative;border-radius:12px;overflow:hidden}
.pm-scroll{overflow-y:auto;padding:40px}
.pm-close{position:absolute;top:12px;right:12px;background:rgba(232,163,61,.12);border:1px solid rgba(232,163,61,.25);color:#E8A33D;font-size:18px;width:32px;height:32px;cursor:pointer;border-radius:50%;display:flex;align-items:center;justify-content:center;z-index:10}
.pm-eyebrow{font-size:12px;letter-spacing:.3em;text-transform:uppercase;color:#E8A33D;font-weight:600;margin-bottom:22px}
.pm-toggle-label{position:relative;display:inline-block;width:48px;height:26px;cursor:pointer}
.pm-toggle-input{opacity:0;width:0;height:0}
.pm-toggle-track{position:absolute;inset:0;background:#3A342D;border-radius:26px;transition:.3s}
.pm-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.pm-card{background:#0A0908;border:1px solid #3A342D;padding:24px 20px;display:flex;flex-direction:column;position:relative}
.pm-featured{border-color:#E8A33D;box-shadow:0 0 70px rgba(232,163,61,.08)}
.pm-badge{position:absolute;top:-11px;left:50%;transform:translateX(-50%);background:#E8A33D;color:#0A0908;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;padding:6px 12px}
.pm-name{font-family:'Cormorant Garamond',serif;font-size:22px;font-style:italic;color:#E8A33D;margin-bottom:8px}
.pm-price{font-family:'Cormorant Garamond',serif;font-size:34px;color:#E8DDC8;line-height:1}
.pm-period{font-size:12px;color:#7D7366;margin-bottom:14px}
.pm-discount{background:rgba(34,197,94,.15);color:#4ade80;font-size:11px;font-weight:700;padding:3px 8px;border-radius:50px}
.pm-desc{font-size:13px;color:#C9BBA0;padding-bottom:16px;border-bottom:1px solid #3A342D;min-height:50px}
.pm-inherits{font-size:12px;color:#7D7366;margin-top:14px;font-style:italic}
.pm-features{list-style:none;margin-top:12px;display:grid;gap:8px;padding:0}
.pm-features li{font-size:12px;color:#C9BBA0;padding-left:18px;position:relative}
.pm-check{position:absolute;left:0;color:#E8A33D;font-weight:800}
.pm-btn,.pm-btn-primary{display:block;text-align:center;margin-top:auto;padding:12px;font-size:13px;font-weight:600;text-decoration:none;transition:.25s;cursor:pointer;border:none;padding-top:18px}
.pm-btn{background:rgba(232,163,61,.12);border:1px solid rgba(232,163,61,.25);color:#E8DDC8}
.pm-btn-primary{background:#E8A33D;color:#0A0908;font-weight:700}
.pm-tip{display:inline-block;width:14px;height:14px;border-radius:50%;background:rgba(232,163,61,.15);color:#E8A33D;font-size:9px;text-align:center;line-height:14px;margin-left:4px;cursor:help;font-style:normal;font-weight:700;vertical-align:middle}
@media(max-width:960px){.pm-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:560px){.pm-grid{grid-template-columns:1fr}.pm-scroll{padding:28px 16px}}
`;

function formatPrice(amount: number): string {
  if (amount === 0) return "$0";
  return `$${amount.toLocaleString("es-CL")}`;
}

function discountPct(monthly: number, annual: number): string | undefined {
  if (monthly === 0 || annual === 0) return undefined;
  const pct = Math.round((1 - annual / monthly) * 100);
  return pct > 0 ? `-${pct}%` : undefined;
}

function PlanCard({ planKey, anual }: { planKey: PlanKey; anual: boolean }) {
  const plan = PLANS[planKey];
  const price = anual ? plan.priceAnnualMonthly : plan.priceMonthly;
  const discount = anual ? discountPct(plan.priceMonthly, plan.priceAnnualMonthly) : undefined;
  const annualTotal = plan.priceAnnualMonthly * 12;

  return (
    <div className={`pm-card${plan.isFeatured ? " pm-featured" : ""}`}>
      {plan.isFeatured && <div className="pm-badge">Popular</div>}
      <div className="pm-name">{plan.label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-start" }}>
        <div className="pm-price">{formatPrice(price)}</div>
        {discount && <span className="pm-discount">{discount}</span>}
      </div>
      <div className="pm-period">
        {price === 0
          ? "para siempre"
          : anual
            ? `/mes + IVA · $${annualTotal.toLocaleString("es-CL")}/año`
            : "/mes + IVA"}
      </div>
      {plan.tagline && <p className="pm-desc">{plan.tagline}</p>}
      {plan.inheritsFrom && <div className="pm-inherits">{plan.inheritsFrom}</div>}
      <ul className="pm-features">
        {plan.featureDisplay.map(({ text, tip }, i) => (
          <li key={i}>
            <span className="pm-check">✓</span>
            {text}
            <i className="pm-tip" data-tip={tip}>i</i>
          </li>
        ))}
      </ul>
      <a href="#" className={plan.isFeatured ? "pm-btn-primary" : "pm-btn"}>{plan.ctaText}</a>
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
              <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "clamp(26px,4vw,44px)", color: "#E8DDC8", fontWeight: 400 }}>
                Empieza gratis. <span style={{ color: "#E8A33D", fontStyle: "italic" }}>Crece cuando quieras.</span>
              </h2>
              <p style={{ color: "#C9BBA0", fontSize: 14, marginTop: 8 }}>14 dias de prueba en planes pagados · Cancela cuando quieras</p>
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
              {PLAN_ORDER.map((key) => (
                <PlanCard key={key} planKey={key} anual={anual} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
