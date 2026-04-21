"use client";

import { useState } from "react";

interface Props {
  restaurant: { slug: string; name: string };
  onClose: () => void;
}

const F = "var(--font-display)";

export default function QRGeneratorModal({ restaurant, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const link = `https://quierocomer.cl/qr/generar/${restaurant.slug}`;

  const copy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed flex items-center justify-center" style={{ inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)" }}>
      <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 20, padding: 28, maxWidth: 400, width: "90%", position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", color: "#666", fontSize: "1.1rem", cursor: "pointer" }}>✕</button>

        <h2 style={{ fontFamily: F, fontSize: "1.1rem", color: "#F4A623", margin: "0 0 4px" }}>📱 Generar QR</h2>
        <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#888", margin: "0 0 20px" }}>{restaurant.name}</p>

        <p style={{ fontFamily: F, fontSize: "0.82rem", color: "#aaa", marginBottom: 12 }}>
          Comparte este link con el dueño del local para que genere e imprima sus QR:
        </p>

        <div style={{ display: "flex", gap: 8, alignItems: "center", background: "#111", borderRadius: 10, padding: "10px 12px", border: "1px solid #2A2A2A" }}>
          <span style={{ fontFamily: F, fontSize: "0.75rem", color: "#F4A623", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{link}</span>
          <button onClick={copy} style={{ padding: "6px 14px", background: copied ? "rgba(74,222,128,0.15)" : "rgba(244,166,35,0.15)", border: "none", borderRadius: 6, color: copied ? "#4ade80" : "#F4A623", fontFamily: F, fontSize: "0.72rem", fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
            {copied ? "✓ Copiado" : "Copiar"}
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <a href={link} target="_blank" style={{ flex: 1, padding: "10px", background: "#F4A623", color: "#0a0a0a", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.85rem", fontWeight: 700, textAlign: "center", textDecoration: "none" }}>Abrir página</a>
          <button onClick={onClose} style={{ padding: "10px 16px", background: "none", border: "1px solid #2A2A2A", borderRadius: 8, color: "#888", fontFamily: F, fontSize: "0.82rem", cursor: "pointer" }}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
