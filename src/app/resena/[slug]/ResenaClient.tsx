"use client";
import { useState } from "react";
import { CheckCircle } from "lucide-react";

const GOLD = "#F4A623";

interface Props {
  restaurant: { id: string; slug: string; name: string; logoUrl: string | null; reviewReward: string | null };
}

function Stars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center", margin: "20px 0" }}>
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, fontSize: 36, lineHeight: 1, opacity: i <= (hover || value) ? 1 : 0.22, transition: "opacity .15s, transform .1s", transform: i <= (hover || value) ? "scale(1.12)" : "scale(1)" }}
        >
          ⭐
        </button>
      ))}
    </div>
  );
}

export default function ResenaClient({ restaurant }: Props) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const initials = restaurant.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  const handleSubmit = async () => {
    if (rating === 0) { setError("Selecciona una puntuación"); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/resenas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: restaurant.id, rating, comment: comment.trim() || null, authorName: authorName.trim() || null }),
      });
      if (!res.ok) throw new Error();
      setDone(true);
    } catch {
      setError("Hubo un error, intenta de nuevo");
    }
    setSubmitting(false);
  };

  return (
    <main style={{
      minHeight: "100svh",
      background: "linear-gradient(160deg, #111 0%, #1c1c1c 60%, #0e0e0e 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "40px 20px", fontFamily: "system-ui, -apple-system, sans-serif",
      position: "relative",
    }}>
      {/* Botón volver */}
      <a
        href={`/${restaurant.slug}`}
        style={{
          position: "absolute", top: 16, left: 16,
          display: "flex", alignItems: "center", gap: 6,
          color: "rgba(255,255,255,0.45)", fontSize: "0.82rem",
          textDecoration: "none", fontWeight: 600,
        }}
      >
        ← Volver
      </a>

      {/* Logo */}
      <div style={{ marginBottom: 16 }}>
        {restaurant.logoUrl
          ? <img src={restaurant.logoUrl} alt={restaurant.name} style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "3px solid rgba(255,255,255,0.12)" }} />
          : <div style={{ width: 72, height: 72, borderRadius: "50%", background: `linear-gradient(135deg, ${GOLD}, #e8920f)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, color: "#0a0a0a" }}>{initials}</div>
        }
      </div>

      <div style={{ width: "100%", maxWidth: 360 }}>
        {done ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <CheckCircle size={48} color="#4ade80" style={{ marginBottom: 16 }} />
            <h2 style={{ color: "#fff", fontSize: "1.2rem", fontWeight: 800, margin: "0 0 8px" }}>¡Gracias por tu opinión!</h2>
            {restaurant.reviewReward && (
              <div style={{ marginTop: 16, background: `${GOLD}18`, border: `1px solid ${GOLD}44`, borderRadius: 14, padding: "14px 18px" }}>
                <p style={{ color: GOLD, fontSize: "0.88rem", fontWeight: 700, margin: "0 0 4px" }}>🎁 Tu premio</p>
                <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.85rem", margin: 0 }}>{restaurant.reviewReward}</p>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.75rem", margin: "6px 0 0" }}>Preséntalo en el local</p>
              </div>
            )}
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.78rem", marginTop: 20 }}>
              {restaurant.name} recibirá tu mensaje.
            </p>
          </div>
        ) : (
          <>
            <h1 style={{ color: "#fff", fontSize: "1.1rem", fontWeight: 800, textAlign: "center", margin: "0 0 4px" }}>
              {restaurant.name}
            </h1>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.82rem", textAlign: "center", margin: "0 0 4px" }}>
              ¿Cómo fue tu experiencia?
            </p>
            {restaurant.reviewReward && (
              <p style={{ color: GOLD, fontSize: "0.8rem", textAlign: "center", margin: "0 0 4px", fontWeight: 600 }}>
                🎁 {restaurant.reviewReward}
              </p>
            )}

            <Stars value={rating} onChange={setRating} />

            <style>{`
              .resena-input::placeholder, .resena-input::-webkit-input-placeholder,
              .resena-textarea::placeholder, .resena-textarea::-webkit-input-placeholder,
              .resena-input::-moz-placeholder, .resena-textarea::-moz-placeholder
              { color: rgba(255,255,255,0.28) !important; opacity: 1 !important; }
            `}</style>

            <div style={{ marginBottom: 12 }}>
              <span style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Tu comentario <span style={{ fontWeight: 400, opacity: 0.7 }}>(opcional)</span>
              </span>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Cuéntanos qué te pareció…"
                rows={4}
                className="resena-textarea"
                style={{
                  width: "100%", boxSizing: "border-box", padding: "14px 16px",
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.13)",
                  borderRadius: 14, color: "#fff", fontFamily: "system-ui, sans-serif", fontSize: "0.88rem",
                  outline: "none", resize: "vertical", minHeight: 100,
                }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <span style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Tu nombre <span style={{ fontWeight: 400, opacity: 0.7 }}>(opcional)</span>
              </span>
              <input
                value={authorName}
                onChange={e => setAuthorName(e.target.value)}
                placeholder="¿Cómo te llamas?"
                className="resena-input"
                style={{
                  width: "100%", boxSizing: "border-box", padding: "12px 16px",
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.13)",
                  borderRadius: 14, color: "#fff", fontFamily: "system-ui, sans-serif", fontSize: "0.88rem",
                  outline: "none",
                }}
              />
            </div>

            {error && <p style={{ color: "#f87171", fontSize: "0.8rem", textAlign: "center", margin: "0 0 10px" }}>{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={submitting || rating === 0}
              style={{
                width: "100%", padding: "14px 0", border: "none", borderRadius: 14,
                background: rating > 0 ? `linear-gradient(135deg, #ffc44f, ${GOLD})` : "rgba(255,255,255,0.1)",
                color: rating > 0 ? "#0a0a0a" : "rgba(255,255,255,0.3)",
                fontFamily: "system-ui, sans-serif", fontSize: "0.95rem", fontWeight: 800,
                cursor: rating > 0 && !submitting ? "pointer" : "default",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "Enviando..." : "Enviar opinión"}
            </button>

            <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.7rem", textAlign: "center", marginTop: 16 }}>
              Tu reseña es privada · Solo la ve el local
            </p>
          </>
        )}
      </div>
    </main>
  );
}
