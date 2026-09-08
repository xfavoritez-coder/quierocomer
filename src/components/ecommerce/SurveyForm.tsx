"use client";
import { useMemo, useState } from "react";

interface Q { id: string; text: string }
interface Props {
  orderId: string | null;
  preview: boolean;
  storeName: string;
  logoUrl: string | null;
  accent: string;
  questions: Q[];
  intro: string;
  thankYou: string;
  customerName: string | null;
  alreadyAnswered: boolean;
}

const FB = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export default function SurveyForm(props: Props) {
  const accent = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(props.accent) ? props.accent : "#e63946";
  const firstName = (props.customerName || "").trim().split(/\s+/)[0] || "";
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(props.alreadyAnswered);
  const [error, setError] = useState<string | null>(null);

  const allAnswered = useMemo(
    () => props.questions.length > 0 && props.questions.every((q) => ratings[q.id] >= 1),
    [props.questions, ratings],
  );

  async function submit() {
    if (!allAnswered || sending) return;
    if (props.preview) { setError("Es una vista previa — la respuesta no se guarda."); return; }
    if (!props.orderId) return;
    setSending(true); setError(null);
    try {
      const res = await fetch("/api/ecommerce/survey/respond", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: props.orderId, answers: ratings, comment: comment.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { if (data.already) setDone(true); else setError(data.error || "No se pudo enviar"); setSending(false); return; }
      setDone(true);
    } catch { setError("Error de conexión"); setSending(false); }
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f5f7", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 16px", fontFamily: FB, color: "#111" }}>
      <div style={{ width: "100%", maxWidth: 480, background: "#fff", borderRadius: 20, border: "1px solid #ececef", boxShadow: "0 10px 40px rgba(0,0,0,0.06)", padding: 28 }}>
        {/* Encabezado */}
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          {props.logoUrl
            ? <img src={props.logoUrl} alt={props.storeName} style={{ width: 60, height: 60, borderRadius: 16, objectFit: "cover", display: "block", margin: "0 auto 12px" }} />
            : <div style={{ width: 60, height: 60, borderRadius: 16, background: accent, color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 26, margin: "0 auto 12px" }}>{props.storeName.charAt(0).toUpperCase()}</div>}
          <p style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>{props.storeName}</p>
        </div>

        {done ? (
          <div style={{ textAlign: "center", padding: "24px 8px" }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>🙏</div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 6px" }}>{props.thankYou || "¡Gracias por tu respuesta!"}</h1>
            <p style={{ color: "#777", fontSize: 14, margin: 0 }}>Tu opinión nos ayuda a mejorar.</p>
          </div>
        ) : props.questions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 8px", color: "#777" }}>Esta encuesta no tiene preguntas activas.</div>
        ) : (
          <>
            <h1 style={{ fontSize: 21, fontWeight: 800, margin: "0 0 4px", textAlign: "center" }}>{firstName ? `Hola ${firstName} 👋` : "Tu opinión nos importa"}</h1>
            <p style={{ color: "#666", fontSize: 14, lineHeight: 1.5, textAlign: "center", margin: "0 0 22px" }}>{props.intro}</p>

            {props.preview && (
              <div style={{ background: `${accent}12`, border: `1px solid ${accent}44`, color: "#555", borderRadius: 12, padding: "8px 12px", fontSize: 12.5, fontWeight: 600, textAlign: "center", marginBottom: 18 }}>
                Vista previa — así verá la encuesta tu cliente.
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {props.questions.map((q) => (
                <div key={q.id}>
                  <p style={{ fontSize: 14.5, fontWeight: 700, margin: "0 0 8px" }}>{q.text}</p>
                  <Stars value={ratings[q.id] || 0} accent={accent} onPick={(v) => setRatings((r) => ({ ...r, [q.id]: v }))} />
                </div>
              ))}
            </div>

            <div style={{ marginTop: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#666", margin: "0 0 6px" }}>Comentario (opcional)</p>
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="Cuéntanos qué te pareció…"
                style={{ width: "100%", boxSizing: "border-box", resize: "vertical", borderRadius: 12, border: "1px solid #ddd", padding: "10px 12px", fontSize: 14, fontFamily: FB, outline: "none" }} />
            </div>

            {error && <p style={{ color: "#e11d2a", fontSize: 13, fontWeight: 600, margin: "12px 0 0", textAlign: "center" }}>{error}</p>}

            <button onClick={submit} disabled={!allAnswered || sending}
              style={{ marginTop: 18, width: "100%", padding: "14px", borderRadius: 999, border: "none", background: accent, color: "#fff", fontWeight: 800, fontSize: 15, cursor: allAnswered && !sending ? "pointer" : "not-allowed", opacity: allAnswered && !sending ? 1 : 0.5, fontFamily: FB }}>
              {sending ? "Enviando…" : "Enviar mi opinión"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Stars({ value, accent, onPick }: { value: number; accent: string; onPick: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div style={{ display: "flex", gap: 6 }} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" aria-label={`${n} de 5`} onClick={() => onPick(n)} onMouseEnter={() => setHover(n)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 2, lineHeight: 1, fontSize: 32, color: n <= shown ? accent : "#d9d9de", transition: "color .12s", flexShrink: 0 }}>
          ★
        </button>
      ))}
    </div>
  );
}
