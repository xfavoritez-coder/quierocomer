"use client";

import { useState, useEffect, useRef } from "react";

interface Props {
  onSave: (name: string) => void;
}

export default function NameModal({ onSave }: Props) {
  const [visible, setVisible] = useState(false);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  const handleSave = async () => {
    if (!name.trim()) return;
    await fetch("/api/qr/user/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    onSave(name.trim());
  };

  return (
    <div className="fixed z-[120] flex items-center justify-center font-[family-name:var(--font-dm)]" style={{ top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.5)", opacity: visible ? 1 : 0, transition: "opacity 0.2s" }} />
      <div style={{
        position: "relative", zIndex: 1, background: "white", borderRadius: 20,
        padding: "32px 24px 28px", width: "85%", maxWidth: 320,
        boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
        transform: visible ? "translateY(0)" : "translateY(20px)",
        opacity: visible ? 1 : 0, transition: "all 0.25s ease-out",
      }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <span style={{ fontSize: "2.2rem", display: "block", marginBottom: 8 }}>🧞</span>
          <h3 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "1.2rem", fontWeight: 800, color: "#0e0e0e", margin: "0 0 4px" }}>
            ¿Cómo te llamas?
          </h3>
          <p style={{ fontSize: "0.82rem", color: "#999", margin: 0 }}>
            Para darte recomendaciones personalizadas
          </p>
        </div>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder="Tu nombre"
          style={{
            width: "100%", padding: "12px 16px", boxSizing: "border-box",
            background: "#f9f9f7", border: "1px solid #eee", borderRadius: 10,
            fontSize: "0.95rem", color: "#0e0e0e", outline: "none",
            fontFamily: "inherit", textAlign: "center",
          }}
        />
        <button
          onClick={handleSave}
          disabled={!name.trim()}
          className="active:scale-[0.98] transition-transform"
          style={{
            width: "100%", marginTop: 12, padding: "13px",
            background: "#F4A623", color: "white", border: "none",
            borderRadius: 50, fontSize: "0.95rem", fontWeight: 700,
            fontFamily: "inherit", cursor: name.trim() ? "pointer" : "default",
            opacity: name.trim() ? 1 : 0.4,
          }}
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
