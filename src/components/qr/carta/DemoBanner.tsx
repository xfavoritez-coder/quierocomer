"use client";

import { useState, useEffect, useRef } from "react";

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
  plan?: string;
  defaultView?: string | null;
  enabledLangs?: string[];
  hasReferentialPhotos?: boolean;
}

export default function DemoBanner({ restaurantName, restaurantSlug, restaurantLogo, restaurantId, context, leadName, leadEmail, leadWhatsapp, onActivate, plan, defaultView, enabledLangs, hasReferentialPhotos }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState(leadName || "");
  const [email, setEmail] = useState(leadEmail || "");
  const [whatsapp, setWhatsapp] = useState(leadWhatsapp || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const LANG_FLAGS: Record<string, string> = {
    es: "https://purecatamphetamine.github.io/country-flag-icons/3x2/ES.svg",
    en: "https://purecatamphetamine.github.io/country-flag-icons/3x2/GB.svg",
    pt: "https://purecatamphetamine.github.io/country-flag-icons/3x2/PT.svg",
    it: "https://purecatamphetamine.github.io/country-flag-icons/3x2/IT.svg",
    th: "https://purecatamphetamine.github.io/country-flag-icons/3x2/TH.svg",
  };

  // Detect when carta header scrolls out of view → show view/lang controls
  const [headerGone, setHeaderGone] = useState(false);
  useEffect(() => {
    const check = () => {
      setHeaderGone(window.scrollY > 80);
    };
    window.addEventListener("scroll", check, { passive: true });
    check();
    return () => window.removeEventListener("scroll", check);
  }, []);

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
        padding: showForm ? "14px 14px 16px" : "12px 14px 12px",
        background: "rgba(7,7,7,.92)",
        backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
        boxShadow: "0 12px 30px rgba(0,0,0,.35)",
        overflow: "visible",
        transition: "padding 0.2s ease",
      }}
    >
      {/* Top row: logo + name OR view/lang controls + button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          {!headerGone || showForm ? (
            <>
              {restaurantLogo ? (
                <div style={{ width: 28, height: 28, borderRadius: 8, border: "1.5px solid rgba(244,166,35,.5)", overflow: "hidden", flexShrink: 0 }}>
                  <img src={restaurantLogo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              ) : (
                <span style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,178,45,.15)", border: "1.5px solid rgba(244,166,35,.3)", display: "inline-grid", placeItems: "center", fontSize: 12, flexShrink: 0 }}>🍽</span>
              )}
              <span style={{ fontSize: 14, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{restaurantName}</span>
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {enabledLangs && enabledLangs.length > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,.55)", whiteSpace: "nowrap" }}>Idioma:</span>
                  {enabledLangs.map(l => {
                    const isActive = typeof window !== "undefined" && (new URLSearchParams(window.location.search).get("lang") || "es") === l;
                    return (
                      <button
                        key={l}
                        onClick={() => {
                          const url = new URL(window.location.href);
                          url.searchParams.set("lang", l);
                          window.location.href = url.toString();
                        }}
                        style={{
                          width: 38, height: 38, borderRadius: "50%",
                          background: isActive ? "rgba(244,166,35,0.2)" : "rgba(255,255,255,0.08)",
                          border: isActive ? "1.5px solid " + (isActive ? "rgba(244,166,35,0.5)" : "rgba(255,255,255,0.12)") : undefined,
                          cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          overflow: "hidden", padding: 0,
                        }}
                      >
                        {LANG_FLAGS[l] ? (
                          <img src={LANG_FLAGS[l]} alt={l} style={{ width: 22, height: 16, objectFit: "cover", borderRadius: 2, opacity: isActive ? 1 : 0.5 }} />
                        ) : (
                          <span style={{ fontSize: 13, fontWeight: 700, color: isActive ? "#F4A623" : "rgba(255,255,255,0.6)", textTransform: "uppercase" }}>{l}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={() => setShowForm(f => !f)}
            className="demo-activar-btn"
            style={{
              border: 0, borderRadius: 999, height: 44, padding: "0 22px",
              fontSize: 16, fontWeight: 900,
              background: showForm ? "rgba(255,255,255,.1)" : "var(--demo-btn-bg, linear-gradient(135deg, #ffc44f, #f3a333))",
              color: showForm ? "rgba(255,255,255,.6)" : "var(--demo-btn-color, #0a0a0a)",
              display: "flex", alignItems: "center", gap: 6, textDecoration: "none", whiteSpace: "nowrap",
              boxShadow: showForm ? "none" : "var(--demo-btn-shadow, 0 8px 20px rgba(244,166,35,.2))",
              transition: "all 0.2s ease",
              cursor: "pointer",
            }}
          >
            {showForm ? "Cerrar" : "Entrar a mi panel"}
          </button>
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
          background: "var(--demo-ribbon-bg, linear-gradient(135deg, #ffc44f, #f3a333))",
          borderBottom: "var(--demo-ribbon-border, 1px solid #e89a2a)",
          textAlign: "center",
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#1a0e00", display: "inline-flex", alignItems: "center", gap: 6 }}>
            Vista previa · entra a tu panel para editar
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ animation: "arrowBounce 1.2s ease-in-out infinite" }}>
              <path d="M12 19V5M5 10l7-7 7 7" stroke="#1a0e00" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
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
