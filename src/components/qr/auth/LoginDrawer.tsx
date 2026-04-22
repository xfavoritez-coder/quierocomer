"use client";

import { useState, useEffect } from "react";
import { Sparkles, Check } from "lucide-react";

interface Props {
  onClose: () => void;
}

export default function LoginDrawer({ onClose }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const close = () => { setVisible(false); setTimeout(onClose, 250); };

  const handleSubmit = async () => {
    if (!name.trim() || !email || status !== "idle") return;
    setStatus("loading");
    await fetch("/api/qr/user/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name: name.trim() }),
    });
    setStatus("success");
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end font-[family-name:var(--font-dm)]" style={{ minHeight: "100dvh" }}>
      <div onClick={(e) => { if (e.target === e.currentTarget) close(); }} className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)", opacity: visible ? 1 : 0, transition: "opacity 0.2s" }} />
      <div style={{ position: "relative", zIndex: 1, background: "white", width: "100%", borderRadius: "20px 20px 0 0", padding: "28px 24px 48px", transform: visible ? "translateY(0)" : "translateY(100%)", transition: "transform 0.25s ease-out" }}>
        <button onClick={close} className="absolute flex items-center justify-center" style={{ top: 12, right: 12, width: 32, height: 32, borderRadius: "50%", background: "#eee", border: "none", color: "#666", fontSize: "0.9rem" }}>✕</button>

        {status === "success" ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Check size={24} color="#16a34a" />
            </div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0e0e0e", marginBottom: 8 }}>Revisa tu correo 📬</h3>
            <p style={{ color: "#888", fontSize: "0.88rem" }}>Enviamos un link a <strong>{email}</strong></p>
            <p style={{ color: "#bbb", fontSize: "0.78rem", marginTop: 8 }}>El link expira en 7 días</p>
          </div>
        ) : (
          <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <Sparkles size={32} color="#F4A623" style={{ marginBottom: 16 }} />
              <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#0e0e0e" }}>Ingresa o regístrate</h3>
              <p style={{ color: "#888", fontSize: "0.88rem", marginTop: 4 }}>Te enviamos un link a tu correo. Sin contraseña.</p>
            </div>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre"
              style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "1px solid #eee", background: "#f8f8f8", fontSize: "1rem", color: "#0e0e0e", outline: "none", fontFamily: "inherit", marginBottom: 10 }} />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "1px solid #eee", background: "#f8f8f8", fontSize: "1rem", color: "#0e0e0e", outline: "none", fontFamily: "inherit" }} />
            <p style={{ color: "#bbb", fontSize: "0.75rem", marginTop: 6, textAlign: "center" }}>Si no tienes cuenta, te crearemos una automáticamente</p>
            <button onClick={handleSubmit} disabled={!name.trim() || !email}
              style={{ width: "100%", marginTop: 8, padding: 14, borderRadius: 50, background: "#0e0e0e", color: "white", fontSize: "0.95rem", fontWeight: 700, border: "none", fontFamily: "inherit", opacity: (!name.trim() || !email || status === "loading") ? 0.5 : 1 }}>
              {status === "loading" ? "Enviando..." : "Continuar →"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
