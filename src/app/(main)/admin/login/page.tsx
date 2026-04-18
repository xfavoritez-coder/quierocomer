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
      // Cookies are set by the server response — just redirect
      router.push("/admin");
    } catch { setError("Error de conexión"); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0D0D0D", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "20px 24px" }}>
      <div style={{ maxWidth: "380px", width: "100%", background: "rgba(45,26,8,0.9)", border: "1px solid rgba(232,168,76,0.25)", borderRadius: "20px", padding: "36px" }}>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <p style={{ fontSize: "2rem", marginBottom: "6px" }}>🧞</p>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", color: "#FFD600" }}>Panel Maestro</h1>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "0.82rem", color: "rgba(240,234,214,0.5)", marginTop: "4px" }}>Acceso para dueños de local</p>
        </div>
        {error && <p style={{ background: "rgba(255,50,50,0.1)", border: "1px solid rgba(255,50,50,0.3)", borderRadius: "8px", padding: "10px", fontFamily: "var(--font-display)", fontSize: "0.8rem", color: "#ff6b6b", marginBottom: "16px", textAlign: "center" }}>{error}</p>}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <input style={I} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <input style={I} type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} />
          <button type="submit" disabled={loading} style={{ width: "100%", padding: "14px", background: "#FFD600", color: "#0D0D0D", fontFamily: "var(--font-display)", fontSize: "0.9rem", fontWeight: 700, border: "none", borderRadius: "10px", cursor: "pointer" }}>{loading ? "..." : "Entrar"}</button>
        </form>
      </div>
    </div>
  );
}
const I: React.CSSProperties = { width: "100%", padding: "12px 14px", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(232,168,76,0.2)", borderRadius: "8px", color: "#FFFFFF", fontFamily: "var(--font-display)", fontSize: "0.9rem", outline: "none", boxSizing: "border-box" };
