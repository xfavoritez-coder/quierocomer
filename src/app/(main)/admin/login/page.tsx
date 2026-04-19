"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/* ── Oasis SVG Background ── */
function OasisBackground() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 360 720"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 0 }}
    >
      {/* Sky */}
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A8DEEF" />
          <stop offset="55%" stopColor="#C8E8D8" />
          <stop offset="100%" stopColor="#F2C571" />
        </linearGradient>
      </defs>
      <rect width="360" height="720" fill="url(#sky)" />

      {/* Sun */}
      <circle cx="290" cy="85" r="34" fill="#FFD86B" />

      {/* Clouds */}
      <g opacity="0.9">
        <ellipse cx="55" cy="145" rx="28" ry="10" fill="white" />
        <ellipse cx="75" cy="140" rx="22" ry="12" fill="white" />
        <ellipse cx="90" cy="147" rx="18" ry="8" fill="white" />
      </g>
      <g opacity="0.8">
        <ellipse cx="230" cy="68" rx="22" ry="8" fill="white" />
        <ellipse cx="250" cy="63" rx="18" ry="10" fill="white" />
        <ellipse cx="265" cy="69" rx="14" ry="7" fill="white" />
      </g>

      {/* Dune layer 1 */}
      <path d="M0 340 Q90 280 180 310 Q270 280 360 330 L360 420 L0 420Z" fill="#F2C571" />
      {/* Dune layer 2 */}
      <path d="M0 390 Q120 320 200 370 Q280 340 360 380 L360 500 L0 500Z" fill="#E8A942" />
      {/* Dune layer 3 */}
      <path d="M0 450 Q100 400 180 430 Q260 400 360 440 L360 580 L0 580Z" fill="#C78A2E" />

      {/* Palm - left back (small, muted) */}
      <rect x="23" y="415" width="4" height="60" rx="2" fill="#5A3718" />
      <g transform="translate(25, 415)">
        <path d="M0 0 Q-20 -15 -30 -5" stroke="#2E5010" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M0 0 Q-18 -22 -25 -15" stroke="#3D6B1C" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M0 0 Q15 -20 28 -8" stroke="#2E5010" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M0 0 Q12 -25 22 -18" stroke="#4A7C1C" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M0 0 Q-5 -28 -2 -30" stroke="#3D6B1C" strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>

      {/* Palm - left front (big, vivid) */}
      <rect x="48" y="425" width="5" height="70" rx="2" fill="#6B4423" />
      <g transform="translate(50, 425)">
        <path d="M0 0 Q-25 -18 -38 -6" stroke="#3D6B1C" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M0 0 Q-22 -28 -32 -18" stroke="#4A7C1C" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <path d="M0 0 Q20 -25 35 -10" stroke="#3D6B1C" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M0 0 Q15 -30 28 -20" stroke="#5A8E2A" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <path d="M0 0 Q-6 -34 -3 -38" stroke="#4A7C1C" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M0 0 Q4 -32 6 -36" stroke="#5A8E2A" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </g>

      {/* Palm - right front (medium, vivid) */}
      <rect x="308" y="450" width="5" height="65" rx="2" fill="#6B4423" />
      <g transform="translate(310, 450)">
        <path d="M0 0 Q-22 -20 -32 -8" stroke="#3D6B1C" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <path d="M0 0 Q-18 -26 -28 -16" stroke="#5A8E2A" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M0 0 Q18 -22 30 -8" stroke="#4A7C1C" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <path d="M0 0 Q14 -28 24 -18" stroke="#3D6B1C" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M0 0 Q-3 -30 0 -34" stroke="#5A8E2A" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </g>

      {/* Palm - right back (small, muted) */}
      <rect x="336" y="435" width="4" height="55" rx="2" fill="#5A3718" />
      <g transform="translate(338, 435)">
        <path d="M0 0 Q-18 -14 -26 -4" stroke="#2E5010" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M0 0 Q-14 -22 -20 -14" stroke="#3D6B1C" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M0 0 Q12 -18 22 -6" stroke="#4A7C1C" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M0 0 Q-3 -24 0 -26" stroke="#2E5010" strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>

      {/* Oasis water */}
      <ellipse cx="180" cy="545" rx="155" ry="30" fill="#3A9AB0" />
      <ellipse cx="180" cy="543" rx="150" ry="28" fill="#5BB5C8" />
      <ellipse cx="180" cy="541" rx="148" ry="26" fill="none" stroke="#A8E0E8" strokeWidth="1" opacity="0.5" />
      {/* Water reflections */}
      <path d="M110 538 Q130 535 150 538" stroke="white" strokeWidth="1" fill="none" opacity="0.4" />
      <path d="M160 545 Q185 542 210 545" stroke="white" strokeWidth="1.2" fill="none" opacity="0.35" />
      <path d="M130 550 Q155 547 180 550" stroke="white" strokeWidth="0.8" fill="none" opacity="0.3" />
      <path d="M200 535 Q220 532 240 535" stroke="white" strokeWidth="1" fill="none" opacity="0.25" />

      {/* Foreground sand */}
      <rect x="0" y="570" width="360" height="150" fill="#A06818" />
      <path d="M0 570 Q90 560 180 568 Q270 560 360 572 L360 580 L0 580Z" fill="#B87A20" />
    </svg>
  );
}

/* ── Easter Egg Messages ── */
const EASTER_EGGS: { trigger: string; msg: string }[] = [
  { trigger: "jaime", msg: "¡Jefe! Bienvenido de vuelta 👑" },
  { trigger: "genio", msg: "¿Llamaste? Tu deseo es mi comando ✨" },
  { trigger: "deseo", msg: "Solo tienes 3 deseos, ¿seguro quieres gastarlo acá?" },
];

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);

  // Easter egg state
  const [bubble, setBubble] = useState<string | null>(null);
  const [genieReact, setGenieReact] = useState(false);
  const triggeredRef = useRef(new Set<string>());
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Easter egg detection
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const lower = email.toLowerCase();
      for (const egg of EASTER_EGGS) {
        if (lower.includes(egg.trigger) && !triggeredRef.current.has(egg.trigger)) {
          triggeredRef.current.add(egg.trigger);
          // Genie reaction
          setGenieReact(true);
          setTimeout(() => setGenieReact(false), 600);
          // Bubble
          if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
          setBubble(egg.msg);
          bubbleTimer.current = setTimeout(() => setBubble(null), 4000);
          break;
        }
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setLoading(false); return; }
      if (remember) {
        localStorage.setItem("qc_admin_remember", "1");
      } else {
        localStorage.removeItem("qc_admin_remember");
        sessionStorage.setItem("qc_admin_session", "1");
      }
      router.push("/admin");
    } catch { setError("Error de conexion"); }
    setLoading(false);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", height: 40, boxSizing: "border-box",
    background: "#FFF9ED", border: "1px solid #E8C78A", borderRadius: 6,
    color: "#1a1a1a", fontFamily: "var(--font-display)", fontSize: "0.88rem",
    outline: "none", transition: "border-color 0.2s",
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontFamily: "var(--font-display)", fontSize: "10px",
    color: "#8a7550", letterSpacing: "1.5px", fontWeight: 500,
    textTransform: "uppercase", marginBottom: 5,
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, position: "relative", overflow: "hidden" }}>
      <OasisBackground />

      {/* Floating Genie */}
      <div
        role="img"
        aria-label="Genio flotando"
        className={`genie-float ${genieReact ? "genie-react" : ""}`}
        style={{ position: "relative", zIndex: 2, fontSize: 58, lineHeight: 1, textAlign: "center", marginBottom: 12 }}
      >
        🧞
        {/* Speech bubble */}
        {bubble && (
          <div className="genie-bubble" style={{
            position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)",
            marginTop: 8, background: "white", border: "1.5px solid #F4A623", borderRadius: 14,
            padding: "10px 14px", whiteSpace: "nowrap", fontSize: 13, color: "#5c3d1e",
            fontFamily: "var(--font-display)", fontWeight: 500,
            boxShadow: "0 4px 16px rgba(180,130,50,0.15)", zIndex: 10,
          }}>
            {bubble}
            <div style={{
              position: "absolute", top: -6, left: "50%", transform: "translateX(-50%) rotate(45deg)",
              width: 10, height: 10, background: "white", border: "1.5px solid #F4A623",
              borderRight: "none", borderBottom: "none",
            }} />
          </div>
        )}
      </div>

      {/* Form card */}
      <div style={{
        position: "relative", zIndex: 2, width: 280, padding: "28px 20px",
        background: "rgba(255,255,255,0.95)", borderRadius: 12,
        border: "0.5px solid rgba(244,166,35,0.5)",
        boxShadow: "0 12px 40px rgba(100,60,10,0.12)",
      }}>
        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 500, margin: "0 0 4px", color: "#1a1a1a" }}>
            Quiero<span style={{ color: "#F4A623" }}>Comer</span>
          </h1>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 10, color: "#8a7550", letterSpacing: 2, textTransform: "uppercase", margin: 0 }}>
            Panel de administracion
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, padding: "8px 12px", marginBottom: 14, textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "0.78rem", color: "#dc2626", margin: 0 }}>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label htmlFor="adm-email" style={labelStyle}>Email</label>
            <input
              id="adm-email"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = "#F4A623"}
              onBlur={e => e.target.style.borderColor = "#E8C78A"}
            />
          </div>

          <div>
            <label htmlFor="adm-pass" style={labelStyle}>Contraseña</label>
            <input
              id="adm-pass"
              type="password"
              placeholder="Tu contraseña"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = "#F4A623"}
              onBlur={e => e.target.style.borderColor = "#E8C78A"}
            />
          </div>

          {/* Remember checkbox */}
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginTop: -2 }}>
            <div
              onClick={() => setRemember(!remember)}
              style={{
                width: 18, height: 18, borderRadius: 3, flexShrink: 0,
                background: remember ? "#F4A623" : "#FFF9ED",
                border: `1.5px solid ${remember ? "#F4A623" : "#E8C78A"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s", cursor: "pointer",
              }}
            >
              {remember && <span style={{ color: "white", fontSize: 11, lineHeight: 1 }}>✓</span>}
            </div>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "#6B5435" }}>Recordar sesión</span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="active:scale-[0.98] transition-transform"
            style={{
              width: "100%", height: 46, marginTop: 4,
              background: loading ? "#E8A942" : "#F4A623",
              color: "white", fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700,
              border: "none", borderRadius: 8, cursor: loading ? "wait" : "pointer",
              boxShadow: "0 4px 14px rgba(244,166,35,0.25)",
              transition: "background 0.2s",
            }}
          >
            {loading ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span className="adm-spin" style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "white", borderRadius: "50%", display: "inline-block" }} />
                Entrando...
              </span>
            ) : "Frotar la lámpara"}
          </button>
        </form>
      </div>

      {/* Footer */}
      <p style={{ position: "relative", zIndex: 2, textAlign: "center", marginTop: 20, fontFamily: "var(--font-display)", fontSize: 10, color: "#8a7550", opacity: 0.85 }}>
        Carta QR Viva — Santiago, Chile
      </p>

      <style>{`
        @keyframes floatGenie {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes genieReact {
          0% { transform: scale(1) rotate(0deg); }
          15% { transform: scale(1.8) rotate(-5deg); }
          35% { transform: scale(1.8) rotate(5deg); }
          55% { transform: scale(1.8) rotate(-5deg); }
          75% { transform: scale(1.3) rotate(0deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes bubbleIn {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes admSpin { to { transform: rotate(360deg); } }

        .genie-float { animation: floatGenie 3s ease-in-out infinite; }
        .genie-react { animation: genieReact 0.6s ease-in-out !important; }
        .genie-bubble { animation: bubbleIn 0.3s ease-out; }
        .adm-spin { animation: admSpin 0.6s linear infinite; }

        input::placeholder { color: #b8a888 !important; }
        input:focus { border-color: #F4A623 !important; }
      `}</style>
    </div>
  );
}
