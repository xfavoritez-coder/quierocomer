"use client";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

export default function GenieFeedback() {
  const { interactionId } = useParams<{ interactionId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [dish, setDish] = useState<{ nombre: string; imagenUrl: string | null; menuItemId?: string } | null>(null);
  const [step, setStep] = useState<"rating" | "stars" | "done">("rating");
  const [saving, setSaving] = useState(false);
  const [selectedScore, setSelectedScore] = useState<string>("");
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [uploading, setUploading] = useState(false);
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/genie/interaction/${interactionId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setDish(d); })
      .catch(() => {});
  }, [interactionId]);

  const submitRating = async (score: "LOVED" | "MEH" | "DISLIKED") => {
    setSaving(true);
    setSelectedScore(score);
    const sid = localStorage.getItem("genie_session_id") ?? "";
    await fetch("/api/genie/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interactionId, score, userId: user?.id || null, sessionId: sid }),
    });
    setSaving(false);
    setStep("stars");
  };

  const submitStars = async () => {
    if (stars > 0 || comment.trim()) {
      const sid = localStorage.getItem("genie_session_id") ?? "";
      await fetch("/api/genie/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interactionId,
          score: selectedScore,
          stars,
          comment: comment.trim(),
          userId: user?.id || null,
          sessionId: sid,
        }),
      }).catch(() => {});
    }
    setStep("done");
  };

  // ── DONE ──
  if (step === "done") {
    return (
      <div style={{ padding: "clamp(40px,8vw,80px) 24px" }}>
        <div style={{ maxWidth: 400, margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: 48, marginBottom: 12 }}>🧞</p>
          <h2 className="font-display" style={{ fontSize: "1.2rem", color: "#0D0D0D", marginBottom: 6 }}>Guardado</h2>
          <p className="font-body" style={{ fontSize: "0.85rem", color: "#999", marginBottom: 24 }}>El Genio ya lo sabe</p>

          {/* Registration gancho for guests */}
          {!user && (
            <div style={{ background: "#F5F5F5", borderRadius: 14, padding: "18px 20px", marginBottom: 20 }}>
              <p className="font-body" style={{ fontSize: "0.85rem", color: "#0D0D0D", lineHeight: 1.6, marginBottom: 12 }}>Regístrate para que el Genio recuerde esto y te recomiende mejor cada vez</p>
              <Link href="/registro" style={{ display: "inline-block", padding: "12px 28px", background: "#FFD600", color: "#0D0D0D", borderRadius: 99, fontWeight: 700, fontSize: "0.85rem", textDecoration: "none" }}>Crear cuenta gratis</Link>
            </div>
          )}

          {/* Photo upload if dish has no image */}
          {dish && !dish.imagenUrl && !photoUploaded && (
            <div style={{ marginBottom: 20 }}>
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
              <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ padding: "10px 24px", background: "transparent", border: "1px solid #E0E0E0", borderRadius: 99, fontSize: "0.82rem", color: "#0D0D0D", cursor: "pointer" }}>
                {uploading ? "Subiendo..." : "Subir foto"}
              </button>
            </div>
          )}
          {photoUploaded && (
            <p className="font-body" style={{ fontSize: "0.82rem", color: "#3db89e", marginBottom: 16 }}>¡Gracias! Tu foto ya aparece 🧞</p>
          )}

          <button onClick={() => router.push("/")} style={{ padding: "14px 28px", background: "#0D0D0D", color: "#FFF", border: "none", borderRadius: 99, fontWeight: 500, fontSize: "0.85rem", cursor: "pointer" }}>Volver a descubrir</button>
        </div>
      </div>
    );
  }

  // ── STARS + COMMENT ──
  if (step === "stars") {
    return (
      <div style={{ padding: "clamp(40px,8vw,80px) 24px" }}>
        <div style={{ maxWidth: 400, margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: 32, marginBottom: 8 }}>🧞</p>
          <h2 className="font-display" style={{ fontSize: "1.1rem", color: "#0D0D0D", marginBottom: 4 }}>¿Qué nota le das?</h2>
          <p className="font-body" style={{ fontSize: "0.8rem", color: "#999", marginBottom: 20 }}>Opcional — ayuda a otros a decidir</p>

          {/* Stars */}
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 20 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => setStars(n)} style={{ fontSize: 32, background: "none", border: "none", cursor: "pointer", opacity: n <= stars ? 1 : 0.2 }}>⭐</button>
            ))}
          </div>

          {/* Comment */}
          <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Deja un comentario corto (opcional)" maxLength={200} style={{ width: "100%", padding: "12px 16px", background: "#F5F5F5", border: "1px solid #E0E0E0", borderRadius: 12, color: "#0D0D0D", fontSize: "0.88rem", outline: "none", resize: "vertical", minHeight: 70, boxSizing: "border-box", marginBottom: 16 }} />

          <button onClick={submitStars} style={{ width: "100%", padding: 14, background: "#FFD600", color: "#0D0D0D", border: "none", borderRadius: 99, fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", marginBottom: 8 }}>
            {stars > 0 || comment.trim() ? "Enviar" : "Saltar"}
          </button>
        </div>
      </div>
    );
  }

  // ── RATING ──
  return (
    <div style={{ padding: "clamp(40px,8vw,80px) 24px" }}>
      <div style={{ maxWidth: 400, margin: "0 auto", textAlign: "center" }}>
        <p style={{ fontSize: 32, marginBottom: 8 }}>🧞</p>

        {dish?.imagenUrl && (
          <img src={dish.imagenUrl} alt={dish.nombre} style={{ width: 160, height: 160, objectFit: "cover", borderRadius: 20, marginBottom: 14 }} />
        )}

        <h2 className="font-display" style={{ fontSize: "clamp(1.1rem,3vw,1.3rem)", color: "#0D0D0D", marginBottom: 6 }}>
          Cómo estuvo{dish ? ` ${dish.nombre}` : ""}?
        </h2>
        <p className="font-body" style={{ fontSize: "0.82rem", color: "#999", marginBottom: 24 }}>Tu opinión mejora las recomendaciones</p>

        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          {[
            { score: "LOVED" as const, emoji: "😍", label: "Me encantó" },
            { score: "MEH" as const, emoji: "😐", label: "Regular" },
            { score: "DISLIKED" as const, emoji: "😕", label: "No era lo mío" },
          ].map(opt => (
            <button key={opt.score} onClick={() => submitRating(opt.score)} disabled={saving} style={{ flex: 1, maxWidth: 110, padding: "18px 8px", background: "#F5F5F5", border: "1px solid #E0E0E0", borderRadius: 16, cursor: saving ? "wait" : "pointer", textAlign: "center", opacity: saving ? 0.5 : 1 }}>
              <span style={{ fontSize: 32, display: "block", marginBottom: 6 }}>{opt.emoji}</span>
              <span className="font-display" style={{ fontSize: "0.68rem", color: "#666" }}>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
