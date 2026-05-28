"use client";

import { useState, useEffect } from "react";

interface Props {
  restaurantName: string;
  restaurantSlug: string;
  restaurantLogo?: string | null;
  restaurantId?: string;
  context: "carta" | "panel";
  leadName?: string;
  leadEmail?: string;
  leadWhatsapp?: string;
  onActivate?: () => void;
}

const TOTAL_ONBOARDING_STEPS = 6;

export default function DemoBanner({ restaurantName, restaurantSlug, restaurantLogo, restaurantId, context, leadName, leadEmail, leadWhatsapp, onActivate }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState(leadName || "");
  const [email, setEmail] = useState(leadEmail || "");
  const [whatsapp, setWhatsapp] = useState(leadWhatsapp || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [highlight, setHighlight] = useState(false);
  const [onboardingActive, setOnboardingActive] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [lockedTooltip, setLockedTooltip] = useState<string | null>(null);

  // Track onboarding active state
  useEffect(() => {
    const check = () => setOnboardingActive(document.body.hasAttribute("data-demo-onboarding"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, { attributes: true, attributeFilter: ["data-demo-onboarding"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const onStep = (e: Event) => setOnboardingStep((e as CustomEvent).detail?.step ?? 0);
    window.addEventListener("demo-onboarding-step", onStep);
    return () => window.removeEventListener("demo-onboarding-step", onStep);
  }, []);

  useEffect(() => {
    const on = () => setHighlight(true);
    const off = () => setHighlight(false);
    window.addEventListener("demo-onboarding-highlight-activate", on);
    window.addEventListener("demo-onboarding-stop-highlight", off);
    return () => {
      window.removeEventListener("demo-onboarding-highlight-activate", on);
      window.removeEventListener("demo-onboarding-stop-highlight", off);
    };
  }, []);

  useEffect(() => {
    if (!lockedTooltip) return;
    const close = () => setLockedTooltip(null);
    const autoClose = setTimeout(close, 3000);
    const t = setTimeout(() => window.addEventListener("pointerdown", close, { once: true }), 10);
    return () => { clearTimeout(t); clearTimeout(autoClose); window.removeEventListener("pointerdown", close); };
  }, [lockedTooltip]);

  useEffect(() => { setLockedTooltip(null); }, [onboardingStep]);

  const stepsLeft = Math.max(0, TOTAL_ONBOARDING_STEPS - 1 - onboardingStep);
  const lockedMsg = `Completa el tour — ${stepsLeft === 1 ? "queda 1 paso" : `quedan ${stepsLeft} pasos`}`;

  const handleLockedClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLockedTooltip(prev => prev ? null : "btn");
  };

  const handleSubmit = async () => {
    if (!email.trim() || !email.includes("@")) { setError("Ingresa un email válido"); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/activar/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          plan: "PREMIUM",
          ownerName: name.trim() || undefined,
          email: email.trim(),
          whatsapp: whatsapp.trim() || undefined,
        }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Error"); }
      window.location.href = `/activar/${restaurantSlug}/exito?plan=PREMIUM`;
    } catch (err: any) {
      setError(err?.message || "Hubo un error. Intenta de nuevo.");
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 10,
    border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.06)",
    color: "#fff", fontSize: 14, outline: "none", fontFamily: "inherit",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.45)",
    textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4, display: "block",
  };

  return (
    <div
      data-demo-banner
      className="font-[family-name:var(--font-dm)]"
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 60,
        transform: "translate3d(0,0,0)", WebkitTransform: "translate3d(0,0,0)",
        padding: showForm ? "14px 14px 16px" : "18px 14px 18px",
        background: "rgba(7,7,7,.92)",
        backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
        boxShadow: "0 12px 30px rgba(0,0,0,.35)",
        overflow: "visible",
        transition: "padding 0.2s ease",
      }}
    >
      {/* Top row: logo + name + button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          {restaurantLogo ? (
            <div style={{ width: 28, height: 28, borderRadius: 8, border: "1.5px solid rgba(244,166,35,.5)", overflow: "hidden", flexShrink: 0 }}>
              <img src={restaurantLogo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          ) : (
            <span style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,178,45,.15)", border: "1.5px solid rgba(244,166,35,.3)", display: "inline-grid", placeItems: "center", fontSize: 12, flexShrink: 0 }}>🍽</span>
          )}
          <span style={{ fontSize: 14, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{restaurantName}</span>
        </div>

        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={onboardingActive ? handleLockedClick : () => setShowForm(f => !f)}
            className="demo-activar-btn"
            style={{
              border: 0, borderRadius: 999, height: 44, padding: "0 22px",
              fontSize: 16, fontWeight: 900,
              background: showForm ? "rgba(255,255,255,.1)" : "linear-gradient(135deg, #ffc44f, #f3a333)",
              color: showForm ? "rgba(255,255,255,.6)" : "#0a0a0a",
              display: "flex", alignItems: "center", gap: 6, textDecoration: "none", whiteSpace: "nowrap",
              boxShadow: highlight ? "0 0 0 3px rgba(244,166,35,0.4), 0 10px 24px rgba(244,166,35,.35)" : showForm ? "none" : "0 8px 20px rgba(244,166,35,.2)",
              animation: highlight ? "activatePulse 1.5s ease-in-out infinite" : undefined,
              transition: "all 0.2s ease",
              cursor: onboardingActive ? "default" : "pointer",
            }}
          >
            {showForm ? "Cerrar" : "Entrar a mi panel"}
          </button>
          {lockedTooltip && (
            <div style={{
              position: "absolute", top: "calc(100% + 8px)", right: 0,
              background: "#1a1a1a", border: "1px solid rgba(255,178,45,0.25)", borderRadius: 10,
              padding: "10px 14px", width: 220, zIndex: 70,
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
              animation: "tooltipFadeIn 0.15s ease-out",
            }}>
              <div style={{
                position: "absolute", top: -5, right: 20,
                width: 10, height: 10, background: "#1a1a1a", borderTop: "1px solid rgba(255,178,45,0.25)", borderLeft: "1px solid rgba(255,178,45,0.25)",
                transform: "rotate(45deg)",
              }} />
              <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.8)", margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
                🧞 {lockedMsg}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Inline form */}
      {showForm && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,.55)", margin: 0, lineHeight: 1.4 }}>
            Confirma tus datos para acceder a tu panel. Tu carta es privada hasta que compartas el QR.
          </p>
          <div>
            <label style={labelStyle}>Nombre</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>WhatsApp</label>
            <input type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+56 9 1234 5678" style={inputStyle} />
          </div>
          {error && <p style={{ fontSize: 12, color: "#ef4444", margin: 0 }}>{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={submitting || !email.trim()}
            style={{
              width: "100%", padding: 13, borderRadius: 999, border: "none",
              background: "linear-gradient(135deg, #ffc44f, #f3a333)", color: "#0a0a0a",
              fontSize: 15, fontWeight: 900, cursor: submitting ? "wait" : "pointer",
              opacity: submitting || !email.trim() ? 0.6 : 1,
              boxShadow: "0 8px 20px rgba(244,166,35,.25)",
            }}
          >
            {submitting ? "Preparando tu panel..." : "Confirmar y entrar"}
          </button>
        </div>
      )}

      {/* Ribbon below — only when form is closed */}
      {!showForm && (
        <div style={{
          position: "absolute",
          bottom: 0, left: 0, right: 0,
          transform: "translateY(100%)",
          padding: "8px 14px",
          background: "linear-gradient(135deg, rgba(255,196,79,.18), rgba(243,163,51,.12))",
          borderBottom: "1px solid rgba(244,166,35,.18)",
          textAlign: "center",
        }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,.55)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            Vista previa
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: "arrowBounce 1.2s ease-in-out infinite" }}>
              <path d="M12 19V5M5 10l7-7 7 7" stroke="#F4A623" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        </div>
      )}

      <style>{`
        @keyframes activatePulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 3px rgba(244,166,35,0.4), 0 10px 24px rgba(244,166,35,.35); }
          50% { transform: scale(1.08); box-shadow: 0 0 0 6px rgba(244,166,35,0.2), 0 14px 30px rgba(244,166,35,.45); }
        }
        @keyframes tooltipFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .demo-activar-btn:active { transform: scale(0.93) !important; }
        @keyframes arrowBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
      `}</style>
    </div>
  );
}
