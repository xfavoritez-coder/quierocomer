"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect } from "react";

function Content() {
  const params = useSearchParams();
  const name = params.get("name") || "";
  const slug = params.get("slug") || "";
  const action = params.get("action"); // "done" after API redirect
  const [enabled, setEnabled] = useState(action !== "done");
  const [toggling, setToggling] = useState(false);

  const toggle = async () => {
    if (!slug) return;
    setToggling(true);
    try {
      const next = !enabled;
      const res = await fetch("/api/email/toggle-weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, enabled: next }),
      });
      if (res.ok) setEnabled(next);
    } catch {}
    setToggling(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0e0e0e", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>{enabled ? "📬" : "📭"}</div>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 400, color: "#f0f0f0", margin: "0 0 8px" }}>
          Correo semanal {enabled ? "activo" : "desactivado"}
        </h1>
        {name && (
          <p style={{ fontSize: 14, color: "#F4A623", margin: "0 0 16px", fontWeight: 600 }}>{name}</p>
        )}
        <p style={{ fontSize: 14, color: "#888", lineHeight: 1.6, margin: "0 0 28px" }}>
          {enabled
            ? "Recibes un resumen cada lunes con las estadísticas de tu carta. Si no deseas seguir recibiéndolo, puedes desactivarlo aquí."
            : "Ya no recibirás el resumen semanal. Puedes reactivarlo en cualquier momento desde aquí o desde tu panel en Ajustes."
          }
        </p>
        <button
          onClick={toggle}
          disabled={toggling}
          style={{
            display: "inline-block", padding: "14px 32px", border: "none", borderRadius: 999, cursor: toggling ? "wait" : "pointer",
            background: enabled ? "#333" : "#F4A623",
            color: enabled ? "#ccc" : "#0e0e0e",
            fontSize: 14, fontWeight: 800,
            opacity: toggling ? 0.6 : 1,
            transition: "all 0.2s",
          }}
        >
          {toggling ? "..." : enabled ? "Desactivar correo semanal" : "Reactivar correo semanal"}
        </button>
        <div style={{ marginTop: 24 }}>
          <a href="/panel/ajustes" style={{ fontSize: 13, color: "#555", textDecoration: "none" }}>
            También puedes cambiar esto desde tu panel →
          </a>
        </div>
        <div style={{ marginTop: 32, borderTop: "1px solid #1a1a1a", paddingTop: 16 }}>
          <a href="https://quierocomer.cl" style={{ fontSize: 12, color: "#444", textDecoration: "none" }}>QuieroComer.cl</a>
          <span style={{ fontSize: 12, color: "#333" }}> · © {new Date().getFullYear()}</span>
        </div>
      </div>
    </div>
  );
}

export default function EmailUnsub() {
  return <Suspense><Content /></Suspense>;
}
