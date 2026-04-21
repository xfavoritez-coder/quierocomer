"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/* Reuse the same Oasis SVG and login form but redirect to /panel */

function OasisBackground() {
  return (
    <svg aria-hidden="true" viewBox="0 0 360 720" preserveAspectRatio="xMidYMid slice" style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 0 }}>
      <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#A8DEEF" /><stop offset="55%" stopColor="#C8E8D8" /><stop offset="100%" stopColor="#F2C571" /></linearGradient></defs>
      <rect width="360" height="720" fill="url(#sky)" />
      <circle cx="290" cy="85" r="34" fill="#FFD86B" />
      <path d="M0 340 Q90 280 180 310 Q270 280 360 330 L360 420 L0 420Z" fill="#F2C571" />
      <path d="M0 390 Q120 320 200 370 Q280 340 360 380 L360 500 L0 500Z" fill="#E8A942" />
      <path d="M0 450 Q100 400 180 430 Q260 400 360 440 L360 580 L0 580Z" fill="#C78A2E" />
      <ellipse cx="180" cy="545" rx="155" ry="30" fill="#3A9AB0" />
      <ellipse cx="180" cy="543" rx="150" ry="28" fill="#5BB5C8" />
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setLoading(false); return; }
      if (remember) localStorage.setItem("qc_admin_remember", "1");
      else { localStorage.removeItem("qc_admin_remember"); sessionStorage.setItem("qc_admin_session", "1"); }
      router.push("/panel");
    } catch { setError("Error de conexión"); }
    setLoading(false);
  };

  const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 14px", height: 40, boxSizing: "border-box", background: "#FFF9ED", border: "1px solid #E8C78A", borderRadius: 6, color: "#1a1a1a", fontFamily: "var(--font-display)", fontSize: "0.88rem", outline: "none" };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, position: "relative", overflow: "hidden" }}>
      <OasisBackground />
      <div className="genie-float" style={{ position: "relative", zIndex: 2, fontSize: 58, lineHeight: 1, textAlign: "center", marginBottom: 12 }}>🧞</div>
      <div style={{ position: "relative", zIndex: 2, width: 320, maxWidth: "90%", padding: "32px 24px", background: "rgba(255,255,255,0.95)", borderRadius: 12, border: "0.5px solid rgba(244,166,35,0.5)", boxShadow: "0 12px 40px rgba(100,60,10,0.12)" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 500, margin: "0 0 4px", color: "#1a1a1a" }}>Quiero<span style={{ color: "#F4A623" }}>Comer</span></h1>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 10, color: "#8a7550", letterSpacing: 2, textTransform: "uppercase", margin: 0 }}>Panel de tu local</p>
        </div>
        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, padding: "8px 12px", marginBottom: 14, textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "0.78rem", color: "#dc2626", margin: 0 }}>{error}</p>
          </div>
        )}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 10, color: "#8a7550", letterSpacing: "1.5px", fontWeight: 500, textTransform: "uppercase", marginBottom: 5 }}>Email</label>
            <input type="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 10, color: "#8a7550", letterSpacing: "1.5px", fontWeight: 500, textTransform: "uppercase", marginBottom: 5 }}>Contraseña</label>
            <input type="password" placeholder="Tu contraseña" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginTop: -2 }}>
            <div onClick={() => setRemember(!remember)} style={{ width: 18, height: 18, borderRadius: 3, flexShrink: 0, background: remember ? "#F4A623" : "#FFF9ED", border: `1.5px solid ${remember ? "#F4A623" : "#E8C78A"}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              {remember && <span style={{ color: "white", fontSize: 11, lineHeight: 1 }}>✓</span>}
            </div>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "#6B5435" }}>Recordar sesión</span>
          </label>
          <button type="submit" disabled={loading} style={{ width: "100%", height: 46, marginTop: 4, background: loading ? "#E8A942" : "#F4A623", color: "white", fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, border: "none", borderRadius: 8, cursor: loading ? "wait" : "pointer", boxShadow: "0 4px 14px rgba(244,166,35,0.25)" }}>
            {loading ? "Entrando..." : "Entrar a mi panel"}
          </button>
          <div style={{ textAlign: "center", marginTop: 10 }}>
            <a href="/panel/forgot-password" style={{ fontFamily: "var(--font-display)", fontSize: "0.75rem", color: "#8a7550", textDecoration: "none" }}>¿Olvidaste tu contraseña?</a>
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
