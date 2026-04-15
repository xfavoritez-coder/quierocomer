"use client";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function GenieFeedback() {
  const { interactionId } = useParams<{ interactionId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [dish, setDish] = useState<{ nombre: string; imagenUrl: string | null; menuItemId?: string } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Fetch interaction details to show the dish
    fetch(`/api/genie/interaction/${interactionId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setDish(d); })
      .catch(() => {});
  }, [interactionId]);

  const submit = async (score: "LOVED" | "MEH" | "DISLIKED") => {
    setSaving(true);
    const sid = localStorage.getItem("genie_session_id") ?? "";
    await fetch("/api/genie/feedback", {
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
      <div style={{ minHeight: "100vh", background: "#FFFFFF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <p style={{ fontSize: 48, marginBottom: 16 }}>🧞</p>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", color: "#0D0D0D", textAlign: "center", marginBottom: 8 }}>Guardado</h2>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.9rem", color: "#666666", textAlign: "center", marginBottom: 28 }}>El Genio ya lo sabe 🧞</p>
        {dish && !dish.imagenUrl && !photoUploaded && (
          <div style={{ marginTop: 20, textAlign: "center" }}>
            <p className="font-body" style={{ fontSize: "0.82rem", color: "#666", marginBottom: 10 }}>¿Tienes una foto del plato? Ayuda a otros 🧞</p>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploading(true);
              const fd = new FormData();
              fd.append("file", file);
              fd.append("menuItemId", dish.menuItemId || "");
              fd.append("sessionId", localStorage.getItem("genie_session_id") ?? "");
              try {
                const res = await fetch("/api/dishes/upload-user-photo", { method: "POST", body: fd });
                if (res.ok) setPhotoUploaded(true);
              } catch {}
              setUploading(false);
            }} style={{ display: "none" }} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ padding: "10px 24px", background: "#F5F5F5", border: "1px solid #E0E0E0", borderRadius: 99, fontSize: "0.82rem", color: "#0D0D0D", cursor: "pointer" }}>
              {uploading ? "Subiendo..." : "Subir foto"}
            </button>
          </div>
        )}
        {photoUploaded && (
          <p className="font-body" style={{ marginTop: 16, fontSize: "0.82rem", color: "#3db89e", textAlign: "center" }}>¡Gracias! Tu foto ya aparece en QuieroComer 🧞</p>
        )}
        <button onClick={() => router.push("/")} style={{ padding: "14px 32px", background: "#0D0D0D", color: "#FFD600", border: "none", borderRadius: 99, fontFamily: "var(--font-display)", fontSize: "0.9rem", fontWeight: 700, cursor: "pointer", marginTop: 16 }}>Volver a descubrir</button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#FFFFFF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <p style={{ fontSize: 32, marginBottom: 12 }}>🧞</p>

      {dish?.imagenUrl && (
        <img src={dish.imagenUrl} alt={dish.nombre} style={{ width: 180, height: 180, objectFit: "cover", borderRadius: 20, marginBottom: 16 }} />
      )}

      <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.1rem,3vw,1.4rem)", color: "#0D0D0D", textAlign: "center", marginBottom: 8 }}>
        Como estuvo{dish ? ` ${dish.nombre}` : ""}?
      </h2>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "#666666", textAlign: "center", marginBottom: 28 }}>Tu respuesta mejora las recomendaciones</p>

      <div style={{ display: "flex", gap: 12, width: "100%", maxWidth: 360 }}>
        {[
          { score: "LOVED" as const, emoji: "😍", label: "Me encanto" },
          { score: "MEH" as const, emoji: "😐", label: "Regular" },
          { score: "DISLIKED" as const, emoji: "😕", label: "No era lo mio" },
        ].map(opt => (
          <button key={opt.score} onClick={() => submit(opt.score)} disabled={saving} style={{ flex: 1, padding: "20px 8px", background: "#F5F5F5", border: "1px solid #E0E0E0", borderRadius: 16, cursor: saving ? "wait" : "pointer", textAlign: "center", opacity: saving ? 0.5 : 1 }}>
            <span style={{ fontSize: 36, display: "block", marginBottom: 8 }}>{opt.emoji}</span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "0.72rem", color: "#666666" }}>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
