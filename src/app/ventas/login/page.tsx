"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(params.get("error") === "enlace" ? "El enlace no es válido o ya venció. Pide uno nuevo." : null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending"); setMsg(null);
    try {
      const r = await fetch("/api/ventas/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setState("error"); setMsg(d.error || "No se pudo enviar el enlace"); return; }
      setState("sent");
    } catch { setState("error"); setMsg("Error de conexión"); }
  };

  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 20 }}>
      <div className="ventas-card" style={{ width: "100%", maxWidth: 400, padding: "32px 28px" }}>
        <div className="ventas-brand" style={{ marginBottom: 22 }}><span className="mk">Q</span><span>QuieroComer Ventas</span></div>
        {state === "sent" ? (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 10px" }}>Revisa tu correo</h1>
            <p style={{ fontSize: 15, color: "var(--ink-2)", lineHeight: 1.6, margin: 0 }}>
              Si <b>{email}</b> es parte del equipo de ventas, te llegó un enlace para entrar. Vence en 15 minutos.
            </p>
            <button className="ventas-btn ghost" style={{ marginTop: 20 }} onClick={() => setState("idle")}>Usar otro correo</button>
          </>
        ) : (
          <form onSubmit={submit}>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>Entrar</h1>
            <p style={{ fontSize: 14, color: "var(--ink-3)", margin: "0 0 18px" }}>Te enviamos un enlace de acceso a tu correo. Sin contraseñas.</p>
            <input className="ventas-input" type="email" required autoFocus placeholder="tu@correo.cl" value={email} onChange={(e) => setEmail(e.target.value)} />
            {msg && <p style={{ color: "#dc2626", fontSize: 13, margin: "10px 0 0" }}>{msg}</p>}
            <button className="ventas-btn" type="submit" disabled={state === "sending"} style={{ width: "100%", marginTop: 14 }}>
              {state === "sending" ? "Enviando…" : "Enviarme el enlace"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function VentasLoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
