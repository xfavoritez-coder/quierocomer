"use client";
import { useState } from "react";

const REASONS = [
  { id: "price", label: "Los precios me parecen altos", emoji: "💰" },
  { id: "quality", label: "La calidad no fue la esperada", emoji: "😕" },
  { id: "delivery_time", label: "El delivery demora o es caro", emoji: "🚗" },
  { id: "moved", label: "Me mudé de zona", emoji: "🏠" },
  { id: "competitor", label: "Encontré otro local", emoji: "🔄" },
  { id: "no_occasion", label: "No he tenido la ocasión", emoji: "⏰" },
  { id: "other", label: "Otro motivo", emoji: "💬" },
] as const;

const DETAILS: Record<string, { id: string; label: string }[]> = {
  price: [
    { id: "products", label: "Los productos son caros" },
    { id: "delivery_fee", label: "El costo de envío es alto" },
    { id: "portion", label: "Poca cantidad por el precio" },
    { id: "competition", label: "Otros locales son más baratos" },
  ],
  quality: [
    { id: "food_quality", label: "Problema con la comida" },
    { id: "wrong_order", label: "Error en el pedido" },
    { id: "bad_condition", label: "Llegó en malas condiciones" },
    { id: "attention", label: "Mala atención" },
  ],
  delivery_time: [
    { id: "too_slow", label: "Demoró demasiado" },
    { id: "expensive", label: "Delivery muy caro" },
    { id: "no_coverage", label: "No llega a mi zona" },
    { id: "driver_issue", label: "Problema con el repartidor" },
  ],
  competitor: [
    { id: "better_price", label: "Mejores precios" },
    { id: "better_food", label: "Mejor comida" },
    { id: "better_experience", label: "Mejor experiencia" },
    { id: "convenience", label: "Más cómodo/cercano" },
  ],
};

interface Props {
  enrollmentId: string;
  storeName: string;
  logoUrl: string | null;
  accent: string;
  customerName: string | null;
  alreadyAnswered: boolean;
}

export default function AbandonmentSurveyForm({ enrollmentId, storeName, logoUrl, accent, customerName, alreadyAnswered }: Props) {
  const [reason, setReason] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(alreadyAnswered);
  const [submitting, setSubmitting] = useState(false);

  const firstName = (customerName || "").trim().split(/\s+/)[0] || "";
  const detailOptions = reason ? DETAILS[reason] || [] : [];

  const handleSubmit = async () => {
    if (!reason || submitting) return;
    setSubmitting(true);
    try {
      await fetch("/api/recovery/abandonment-survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId, reason, detail, comment: comment.trim() || null }),
      });
      setSubmitted(true);
    } catch {
      // best effort
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ maxWidth: 480, width: "100%", background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,.08)" }}>
        <div style={{ background: accent, padding: "22px 28px", textAlign: "center" }}>
          {logoUrl ? <img src={logoUrl} alt={storeName} style={{ maxHeight: 48, maxWidth: 160, objectFit: "contain" }} /> : <span style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{storeName}</span>}
        </div>
        <div style={{ padding: "40px 28px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🙏</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111", margin: "0 0 10px" }}>Gracias por tu respuesta</h1>
          <p style={{ fontSize: 15, color: "#666", lineHeight: 1.6 }}>
            Tu opinión nos ayuda a mejorar {storeName}. Esperamos verte pronto.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, width: "100%", background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,.08)" }}>
      {/* Header branded */}
      <div style={{ background: accent, padding: "22px 28px", textAlign: "center" }}>
        {logoUrl ? <img src={logoUrl} alt={storeName} style={{ maxHeight: 48, maxWidth: 160, objectFit: "contain" }} /> : <span style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{storeName}</span>}
      </div>

      <div style={{ padding: "28px 24px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111", margin: "0 0 6px", textAlign: "center" }}>
          {firstName ? `${firstName}, nos gustaría escucharte` : "Nos gustaría escucharte"}
        </h1>
        <p style={{ fontSize: 14, color: "#777", textAlign: "center", lineHeight: 1.5, margin: "0 0 24px" }}>
          ¿Hubo algún motivo por el que dejaste de pedir?
        </p>

        {/* Razones principales */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {REASONS.map(r => (
            <button
              key={r.id}
              onClick={() => { setReason(r.id); setDetail(null); }}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 16px", borderRadius: 12,
                border: reason === r.id ? `2px solid ${accent}` : "2px solid #e5e7eb",
                background: reason === r.id ? `${accent}08` : "#fff",
                cursor: "pointer", textAlign: "left", fontFamily: "inherit", fontSize: 14, fontWeight: 600,
                color: reason === r.id ? "#111" : "#555",
                transition: "all .15s",
              }}
            >
              <span style={{ fontSize: 20 }}>{r.emoji}</span>
              {r.label}
            </button>
          ))}
        </div>

        {/* Sub-detalle */}
        {detailOptions.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#555", marginBottom: 10 }}>¿Puedes decirnos un poco más?</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {detailOptions.map(d => (
                <button
                  key={d.id}
                  onClick={() => setDetail(d.id)}
                  style={{
                    padding: "8px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600,
                    border: detail === d.id ? `2px solid ${accent}` : "1.5px solid #e5e7eb",
                    background: detail === d.id ? `${accent}10` : "#fafafa",
                    color: detail === d.id ? "#111" : "#666",
                    cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Comentario libre */}
        {reason && (
          <div style={{ marginTop: 20 }}>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="¿Algo más que quieras contarnos? (opcional)"
              rows={3}
              maxLength={500}
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 12,
                border: "1.5px solid #e5e7eb", fontSize: 14, fontFamily: "inherit",
                resize: "vertical", outline: "none", boxSizing: "border-box",
                color: "#333",
              }}
            />
          </div>
        )}

        {/* CTA */}
        {reason && (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              marginTop: 20, width: "100%", padding: "14px 24px", borderRadius: 12,
              background: accent, color: "#fff", fontSize: 15, fontWeight: 800,
              border: "none", cursor: submitting ? "default" : "pointer",
              opacity: submitting ? 0.6 : 1, fontFamily: "inherit", transition: "opacity .15s",
            }}
          >
            {submitting ? "Enviando..." : "Enviar mi respuesta"}
          </button>
        )}
      </div>
    </div>
  );
}
