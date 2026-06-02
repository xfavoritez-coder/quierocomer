"use client";

import { useState } from "react";

const F = "'Space Grotesk', system-ui, sans-serif";

export default function CrearCartaPage() {
  const [url, setUrl] = useState("");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ slug: string; url: string } | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleSubmit = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/admin/crear-carta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          nombre: nombre.trim() || undefined,
          email: email.trim() || undefined,
          whatsapp: whatsapp.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setResult({ slug: data.slug, url: data.url });
    } catch (e: any) {
      setError(e.message || "Error al procesar");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: 10,
    border: "1px solid var(--adm-card-border)", background: "var(--adm-hover)",
    color: "var(--adm-text)", fontSize: 14, outline: "none", fontFamily: F,
    boxSizing: "border-box",
  };

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "40px 16px", fontFamily: F }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--adm-text)", marginBottom: 6 }}>Crear carta</h1>
      <p style={{ fontSize: 13, color: "var(--adm-text3)", marginBottom: 28 }}>
        Pega el link de la carta del local y se procesa automáticamente.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--adm-text3)", display: "block", marginBottom: 4 }}>Link de la carta *</label>
          <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://menu.fu.do/local o link de PDF" style={inputStyle} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--adm-text3)", display: "block", marginBottom: 4 }}>Nombre del local</label>
          <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Sushi Austral" style={inputStyle} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--adm-text3)", display: "block", marginBottom: 4 }}>Email del dueño</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="dueño@email.com" style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--adm-text3)", display: "block", marginBottom: 4 }}>WhatsApp</label>
            <input type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+56 9 1234 5678" style={inputStyle} />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !url.trim()}
          style={{
            width: "100%", padding: 14, borderRadius: 10, border: "none",
            background: loading ? "var(--adm-hover)" : "var(--adm-accent, #F4A623)",
            color: loading ? "var(--adm-text3)" : "#0a0a0a",
            fontSize: 15, fontWeight: 800, cursor: loading ? "wait" : "pointer",
            fontFamily: F, marginTop: 4,
          }}
        >
          {loading ? "Procesando carta..." : "Crear carta"}
        </button>

        {error && (
          <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 13 }}>
            {error}
          </div>
        )}

        {result && (
          <div style={{ padding: "16px", borderRadius: 12, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#22c55e", margin: "0 0 10px" }}>Carta lista</p>
            <a href={result.url} target="_blank" rel="noopener" style={{ fontSize: 14, color: "var(--adm-accent, #F4A623)", fontWeight: 600, wordBreak: "break-all" }}>
              {result.url}
            </a>
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button
                onClick={() => { navigator.clipboard.writeText(result.url); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                style={{
                  padding: "8px 16px", borderRadius: 8, border: "1px solid var(--adm-card-border)",
                  background: copied ? "rgba(34,197,94,0.15)" : "var(--adm-hover)",
                  color: copied ? "#22c55e" : "var(--adm-text)", fontSize: 12, fontWeight: 600,
                  cursor: "pointer", fontFamily: F,
                }}
              >
                {copied ? "Copiado" : "Copiar link"}
              </button>
              <button
                onClick={() => { setUrl(""); setNombre(""); setEmail(""); setWhatsapp(""); setResult(null); }}
                style={{
                  padding: "8px 16px", borderRadius: 8, border: "1px solid var(--adm-card-border)",
                  background: "transparent", color: "var(--adm-text3)", fontSize: 12, fontWeight: 600,
                  cursor: "pointer", fontFamily: F,
                }}
              >
                Crear otra
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
