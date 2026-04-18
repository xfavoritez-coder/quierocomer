"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setLoading(false); return; }
      router.push("/admin");
    } catch { setError("Error de conexion"); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", position: "relative", overflow: "hidden" }}>
      {/* Ambient glow */}
      <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translate(-50%, -50%)", width: 500, height: 500, background: "radial-gradient(circle, rgba(244,166,35,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "20%", right: "20%", width: 300, height: 300, background: "radial-gradient(circle, rgba(200,80,40,0.04) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 400, width: "100%" }}>
        {/* Logo area */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{
            width: 80, height: 80, margin: "0 auto 20px",
            background: "linear-gradient(135deg, rgba(244,166,35,0.12) 0%, rgba(244,166,35,0.04) 100%)",
            border: "1px solid rgba(244,166,35,0.15)",
            borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "2.4rem",
            boxShadow: "0 0 60px rgba(244,166,35,0.08)",
          }}>
            🧞
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", fontWeight: 300, color: "white", letterSpacing: "-0.02em", marginBottom: 6 }}>
            Quiero<span style={{ color: "#F4A623", fontWeight: 600 }}>Comer</span>
          </h1>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "0.78rem", color: "rgba(255,255,255,0.3)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
            Panel de administracion
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 20,
          padding: "32px 28px",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}>
          {error && (
            <div style={{
              background: "rgba(255,60,60,0.08)", border: "1px solid rgba(255,60,60,0.2)",
              borderRadius: 10, padding: "10px 14px", marginBottom: 18, textAlign: "center",
            }}>
              <p style={{ fontFamily: "var(--font-display)", fontSize: "0.82rem", color: "#ff6b6b", margin: 0 }}>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontFamily: "var(--font-display)", fontSize: "0.7rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                Email
              </label>
              <input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{
                  width: "100%", padding: "13px 16px",
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10, color: "white", fontFamily: "var(--font-display)", fontSize: "0.92rem",
                  outline: "none", boxSizing: "border-box", transition: "border-color 0.2s",
                }}
                onFocus={e => e.target.style.borderColor = "rgba(244,166,35,0.4)"}
                onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
              />
            </div>

            <div>
              <label style={{ display: "block", fontFamily: "var(--font-display)", fontSize: "0.7rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                Contrasena
              </label>
              <input
                type="password"
                placeholder="Tu contrasena"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{
                  width: "100%", padding: "13px 16px",
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10, color: "white", fontFamily: "var(--font-display)", fontSize: "0.92rem",
                  outline: "none", boxSizing: "border-box", transition: "border-color 0.2s",
                }}
                onFocus={e => e.target.style.borderColor = "rgba(244,166,35,0.4)"}
                onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", padding: "14px", marginTop: 6,
                background: loading ? "rgba(244,166,35,0.5)" : "linear-gradient(135deg, #F4A623 0%, #e8960f 100%)",
                color: "#0a0a0a", fontFamily: "var(--font-display)", fontSize: "0.92rem", fontWeight: 700,
                border: "none", borderRadius: 50, cursor: loading ? "wait" : "pointer",
                boxShadow: "0 4px 20px rgba(244,166,35,0.2)",
                transition: "all 0.2s",
              }}
            >
              {loading ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 14, height: 14, border: "2px solid rgba(10,10,10,0.3)", borderTopColor: "#0a0a0a", borderRadius: "50%", animation: "admSpin 0.6s linear infinite", display: "inline-block" }} />
                  Entrando
                </span>
              ) : "Entrar"}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p style={{ textAlign: "center", marginTop: 24, fontFamily: "var(--font-display)", fontSize: "0.7rem", color: "rgba(255,255,255,0.15)" }}>
          Carta QR Viva — Santiago, Chile
        </p>
      </div>

      <style>{`
        @keyframes admSpin { to { transform: rotate(360deg); } }
        input::placeholder { color: rgba(255,255,255,0.2) !important; }
      `}</style>
    </div>
  );
}
