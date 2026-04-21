"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { resetPanelSession } from "@/lib/admin/usePanelSession";

function OasisBackground() {
  return (
    <svg aria-hidden="true" viewBox="0 0 360 720" preserveAspectRatio="xMidYMid slice" style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 0 }}>
      <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#A8DEEF" /><stop offset="55%" stopColor="#C8E8D8" /><stop offset="100%" stopColor="#F2C571" /></linearGradient></defs>
      <rect width="360" height="720" fill="url(#sky)" />
      <circle cx="290" cy="85" r="34" fill="#FFD86B" />
      <g opacity="0.9"><ellipse cx="55" cy="145" rx="28" ry="10" fill="white" /><ellipse cx="75" cy="140" rx="22" ry="12" fill="white" /><ellipse cx="90" cy="147" rx="18" ry="8" fill="white" /></g>
      <g opacity="0.8"><ellipse cx="230" cy="68" rx="22" ry="8" fill="white" /><ellipse cx="250" cy="63" rx="18" ry="10" fill="white" /><ellipse cx="265" cy="69" rx="14" ry="7" fill="white" /></g>
      <path d="M0 340 Q90 280 180 310 Q270 280 360 330 L360 420 L0 420Z" fill="#F2C571" />
      <path d="M0 390 Q120 320 200 370 Q280 340 360 380 L360 500 L0 500Z" fill="#E8A942" />
      <path d="M0 450 Q100 400 180 430 Q260 400 360 440 L360 580 L0 580Z" fill="#C78A2E" />
      <rect x="23" y="415" width="4" height="60" rx="2" fill="#5A3718" />
      <g transform="translate(25, 415)"><path d="M0 0 Q-20 -15 -30 -5" stroke="#2E5010" strokeWidth="3" fill="none" strokeLinecap="round" /><path d="M0 0 Q-18 -22 -25 -15" stroke="#3D6B1C" strokeWidth="2.5" fill="none" strokeLinecap="round" /><path d="M0 0 Q15 -20 28 -8" stroke="#2E5010" strokeWidth="3" fill="none" strokeLinecap="round" /><path d="M0 0 Q12 -25 22 -18" stroke="#4A7C1C" strokeWidth="2.5" fill="none" strokeLinecap="round" /><path d="M0 0 Q-5 -28 -2 -30" stroke="#3D6B1C" strokeWidth="2" fill="none" strokeLinecap="round" /></g>
      <rect x="48" y="425" width="5" height="70" rx="2" fill="#6B4423" />
      <g transform="translate(50, 425)"><path d="M0 0 Q-25 -18 -38 -6" stroke="#3D6B1C" strokeWidth="4" fill="none" strokeLinecap="round" /><path d="M0 0 Q-22 -28 -32 -18" stroke="#4A7C1C" strokeWidth="3.5" fill="none" strokeLinecap="round" /><path d="M0 0 Q20 -25 35 -10" stroke="#3D6B1C" strokeWidth="4" fill="none" strokeLinecap="round" /><path d="M0 0 Q15 -30 28 -20" stroke="#5A8E2A" strokeWidth="3.5" fill="none" strokeLinecap="round" /><path d="M0 0 Q-6 -34 -3 -38" stroke="#4A7C1C" strokeWidth="3" fill="none" strokeLinecap="round" /><path d="M0 0 Q4 -32 6 -36" stroke="#5A8E2A" strokeWidth="2.5" fill="none" strokeLinecap="round" /></g>
      <rect x="308" y="450" width="5" height="65" rx="2" fill="#6B4423" />
      <g transform="translate(310, 450)"><path d="M0 0 Q-22 -20 -32 -8" stroke="#3D6B1C" strokeWidth="3.5" fill="none" strokeLinecap="round" /><path d="M0 0 Q-18 -26 -28 -16" stroke="#5A8E2A" strokeWidth="3" fill="none" strokeLinecap="round" /><path d="M0 0 Q18 -22 30 -8" stroke="#4A7C1C" strokeWidth="3.5" fill="none" strokeLinecap="round" /><path d="M0 0 Q14 -28 24 -18" stroke="#3D6B1C" strokeWidth="3" fill="none" strokeLinecap="round" /><path d="M0 0 Q-3 -30 0 -34" stroke="#5A8E2A" strokeWidth="2.5" fill="none" strokeLinecap="round" /></g>
      <rect x="336" y="435" width="4" height="55" rx="2" fill="#5A3718" />
      <g transform="translate(338, 435)"><path d="M0 0 Q-18 -14 -26 -4" stroke="#2E5010" strokeWidth="2.5" fill="none" strokeLinecap="round" /><path d="M0 0 Q-14 -22 -20 -14" stroke="#3D6B1C" strokeWidth="2" fill="none" strokeLinecap="round" /><path d="M0 0 Q12 -18 22 -6" stroke="#4A7C1C" strokeWidth="2.5" fill="none" strokeLinecap="round" /><path d="M0 0 Q-3 -24 0 -26" stroke="#2E5010" strokeWidth="2" fill="none" strokeLinecap="round" /></g>
      <ellipse cx="180" cy="545" rx="155" ry="30" fill="#3A9AB0" />
      <ellipse cx="180" cy="543" rx="150" ry="28" fill="#5BB5C8" />
      <ellipse cx="180" cy="541" rx="148" ry="26" fill="none" stroke="#A8E0E8" strokeWidth="1" opacity="0.5" />
      <path d="M110 538 Q130 535 150 538" stroke="white" strokeWidth="1" fill="none" opacity="0.4" />
      <path d="M160 545 Q185 542 210 545" stroke="white" strokeWidth="1.2" fill="none" opacity="0.35" />
      <path d="M130 550 Q155 547 180 550" stroke="white" strokeWidth="0.8" fill="none" opacity="0.3" />
      <path d="M200 535 Q220 532 240 535" stroke="white" strokeWidth="1" fill="none" opacity="0.25" />
      <rect x="0" y="570" width="360" height="150" fill="#A06818" />
      <path d="M0 570 Q90 560 180 568 Q270 560 360 572 L360 580 L0 580Z" fill="#B87A20" />
    </svg>
  );
}

export default function PanelLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const passRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/panel/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al iniciar sesión");
        setPassword(""); // Clear password on error, keep email
        setLoading(false);
        setTimeout(() => passRef.current?.focus(), 100);
        return;
      }
      if (remember) localStorage.setItem("qc_panel_remember", "1");
      else { localStorage.removeItem("qc_panel_remember"); sessionStorage.setItem("panel_session", "1"); }
      // Store name for welcome toast
      sessionStorage.setItem("panel_welcome", data.name || "");
      // Full page navigation ensures cookies are available for middleware
      window.location.href = "/panel";
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
      setLoading(false);
    }
  };

  const F = "var(--font-display)";
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", height: 40, boxSizing: "border-box",
    background: "#FFF9ED", border: "1px solid #E8C78A", borderRadius: 6,
    color: "#1a1a1a", fontFamily: F, fontSize: "0.88rem", outline: "none",
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, position: "relative", overflow: "hidden" }}>
      <OasisBackground />
      <div className="genie-float" style={{ position: "relative", zIndex: 2, fontSize: 58, lineHeight: 1, textAlign: "center", marginBottom: 12 }}>🧞</div>

      <div style={{ position: "relative", zIndex: 2, width: 320, maxWidth: "90%", padding: "32px 24px", background: "rgba(255,255,255,0.95)", borderRadius: 12, border: "0.5px solid rgba(244,166,35,0.5)", boxShadow: "0 12px 40px rgba(100,60,10,0.12)" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h1 style={{ fontFamily: F, fontSize: 24, fontWeight: 500, margin: "0 0 4px", color: "#1a1a1a" }}>
            Quiero<span style={{ color: "#F4A623" }}>Comer</span>
          </h1>
          <p style={{ fontFamily: F, fontSize: 10, color: "#8a7550", letterSpacing: 2, textTransform: "uppercase", margin: 0 }}>
            Panel de tu local
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "0.9rem", flexShrink: 0 }}>⚠️</span>
            <p style={{ fontFamily: F, fontSize: "0.8rem", color: "#dc2626", margin: 0, lineHeight: 1.4 }}>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontFamily: F, fontSize: 10, color: "#8a7550", letterSpacing: "1.5px", fontWeight: 500, textTransform: "uppercase", marginBottom: 5 }}>Email</label>
            <input
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={inputStyle}
              autoComplete="email"
            />
          </div>
          <div>
            <label style={{ display: "block", fontFamily: F, fontSize: 10, color: "#8a7550", letterSpacing: "1.5px", fontWeight: 500, textTransform: "uppercase", marginBottom: 5 }}>Contraseña</label>
            <div style={{ position: "relative" }}>
              <input
                ref={passRef}
                type={showPass ? "text" : "password"}
                placeholder="Tu contraseña"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ ...inputStyle, paddingRight: 40 }}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", justifyContent: "center" }}
                tabIndex={-1}
              >
                {showPass ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8a7550" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8a7550" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginTop: -2 }}>
            <div onClick={() => setRemember(!remember)} style={{
              width: 18, height: 18, borderRadius: 3, flexShrink: 0,
              background: remember ? "#F4A623" : "#FFF9ED",
              border: `1.5px solid ${remember ? "#F4A623" : "#E8C78A"}`,
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            }}>
              {remember && <span style={{ color: "white", fontSize: 11, lineHeight: 1 }}>✓</span>}
            </div>
            <span style={{ fontFamily: F, fontSize: 12, color: "#6B5435" }}>Recordar sesión</span>
          </label>

          <button type="submit" disabled={loading} style={{
            width: "100%", height: 46, marginTop: 4,
            background: loading ? "#E8A942" : "#F4A623",
            color: "white", fontFamily: F, fontSize: 15, fontWeight: 700,
            border: "none", borderRadius: 8, cursor: loading ? "wait" : "pointer",
            boxShadow: "0 4px 14px rgba(244,166,35,0.25)",
          }}>
            {loading ? "Entrando..." : "Frotar lámpara"}
          </button>

          <div style={{ textAlign: "center", marginTop: 10 }}>
            <a href="/panel/forgot-password" style={{ fontFamily: F, fontSize: "0.75rem", color: "#8a7550", textDecoration: "none" }}>
              ¿Olvidaste tu contraseña?
            </a>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes floatGenie { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-12px); } }
        .genie-float { animation: floatGenie 3s ease-in-out infinite; }
        input::placeholder { color: #b8a888 !important; }
      `}</style>
    </div>
  );
}
