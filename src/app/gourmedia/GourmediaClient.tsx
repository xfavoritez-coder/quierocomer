"use client";
import { useState } from "react";
import D from "./data";

const PASS = "1111";

export default function GourmediaClient() {
  const [auth, setAuth] = useState(false);
  const [pin, setPin] = useState("");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);

  if (!auth) {
    return (
      <div style={{ minHeight: "100vh", background: "#0e0e0e", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ color: "#F4A623", fontSize: 20, fontWeight: 800, marginBottom: 16 }}>Acceso restringido</h1>
          <input
            type="password"
            placeholder="Clave"
            value={pin}
            onChange={e => setPin(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && pin === PASS) setAuth(true); }}
            style={{ padding: "12px 18px", borderRadius: 12, border: "1px solid #2a2a2a", background: "#1a1a1a", color: "#fff", fontSize: 16, textAlign: "center", outline: "none", width: 200 }}
            autoFocus
          />
          <br />
          <button onClick={() => { if (pin === PASS) setAuth(true); }} style={{ marginTop: 12, padding: "10px 28px", borderRadius: 999, border: "none", background: "#F4A623", color: "#0e0e0e", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
            Entrar
          </button>
        </div>
      </div>
    );
  }

  const q = search.toLowerCase();
  const filtered = q ? D.filter(([name]) => name.toLowerCase().includes(q)) : D;

  const copyForWA = () => {
    let text = `🍽️ *Locales que usan Gourmedia*\n_${filtered.length} locales_\n\n`;
    filtered.forEach(([name, slug], i) => {
      text += `${i + 1}. *${name}*\nhttps://gour.media/${slug}/\n\n`;
    });
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0e0e0e", color: "#e0e0e0", padding: 20, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Locales Gourmedia</h1>
      <p style={{ color: "#888", fontSize: 14, marginBottom: 16 }}>
        <span style={{ color: "#F4A623", fontWeight: 700 }}>{filtered.length}</span> locales encontrados en gour.media
      </p>
      <input
        placeholder="Buscar local..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ width: "100%", maxWidth: 500, padding: "10px 16px", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, color: "#fff", fontSize: 14, outline: "none", marginBottom: 16 }}
      />
      <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "50px 1fr 1fr", padding: "12px 14px", borderBottom: "1px solid #2a2a2a", fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          <span>#</span><span>Local</span><span>URL</span>
        </div>
        <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
          {filtered.map(([name, slug], i) => (
            <div key={slug} style={{ display: "grid", gridTemplateColumns: "50px 1fr 1fr", padding: "8px 14px", borderTop: "1px solid #222", fontSize: 13 }}>
              <span style={{ color: "#555" }}>{i + 1}</span>
              <span style={{ fontWeight: 700, color: "#fff" }}>{name}</span>
              <a href={`https://gour.media/${slug}/`} target="_blank" rel="noopener noreferrer" style={{ color: "#F4A623", textDecoration: "none", fontSize: 12 }}>
                gour.media/{slug}/
              </a>
            </div>
          ))}
        </div>
      </div>
      <button
        onClick={copyForWA}
        style={{
          position: "fixed", bottom: 20, right: 20, padding: "14px 24px",
          background: copied ? "#4ade80" : "#F4A623", color: "#0e0e0e", border: "none", borderRadius: 999,
          fontWeight: 800, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 20px rgba(244,166,35,.3)", zIndex: 10,
        }}
      >
        {copied ? "✓ Copiado" : "Copiar para WhatsApp"}
      </button>
    </div>
  );
}
