"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function GenieFeedback() {
  const { interactionId } = useParams<{ interactionId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [dish, setDish] = useState<{ nombre: string; imagenUrl: string | null } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Fetch interaction details to show the dish
    fetch(`/api/interaction/${interactionId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setDish(d); })
      .catch(() => {});
  }, [interactionId]);

  const submit = async (score: "LOVED" | "MEH" | "DISLIKED") => {
    setSaving(true);
    const sid = localStorage.getItem("genie_session_id") ?? "";
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        interactionId,
        score,
        userId: user?.id || null,
        sessionId: sid,
      }),
    });
    setSaving(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", background: "#0D0D0D", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <p style={{ fontSize: 48, marginBottom: 16 }}>🧞</p>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", color: "#FFD600", textAlign: "center", marginBottom: 8 }}>Guardado</h2>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.9rem", color: "#888888", textAlign: "center", marginBottom: 28 }}>El Genio ya lo sabe 🧞</p>
        <button onClick={() => router.push("/")} style={{ padding: "14px 32px", background: "#FFD600", color: "#0D0D0D", border: "none", borderRadius: 99, fontFamily: "var(--font-display)", fontSize: "0.9rem", fontWeight: 700, cursor: "pointer" }}>Volver a descubrir</button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0D0D0D", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <p style={{ fontSize: 32, marginBottom: 12 }}>🧞</p>

      {dish?.imagenUrl && (
        <img src={dish.imagenUrl} alt={dish.nombre} style={{ width: 180, height: 180, objectFit: "cover", borderRadius: 20, marginBottom: 16 }} />
      )}

      <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.1rem,3vw,1.4rem)", color: "#FFD600", textAlign: "center", marginBottom: 8 }}>
        Como estuvo{dish ? ` ${dish.nombre}` : ""}?
      </h2>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "#888888", textAlign: "center", marginBottom: 28 }}>Tu respuesta mejora las recomendaciones</p>

      <div style={{ display: "flex", gap: 12, width: "100%", maxWidth: 360 }}>
        {[
          { score: "LOVED" as const, emoji: "😍", label: "Me encanto" },
          { score: "MEH" as const, emoji: "😐", label: "Regular" },
          { score: "DISLIKED" as const, emoji: "😕", label: "No era lo mio" },
        ].map(opt => (
          <button key={opt.score} onClick={() => submit(opt.score)} disabled={saving} style={{ flex: 1, padding: "20px 8px", background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 16, cursor: saving ? "wait" : "pointer", textAlign: "center", opacity: saving ? 0.5 : 1 }}>
            <span style={{ fontSize: 36, display: "block", marginBottom: 8 }}>{opt.emoji}</span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "0.72rem", color: "#888888" }}>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
