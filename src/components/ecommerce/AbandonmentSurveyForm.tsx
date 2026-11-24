"use client";
import { useState } from "react";

const REASONS = [
  { id: "price", label: "Los precios me parecen altos", emoji: "💰" },
  { id: "quality", label: "La calidad no fue la esperada", emoji: "😕" },
  { id: "delivery_slow", label: "El delivery demora mucho", emoji: "🕐" },
  { id: "delivery_expensive", label: "El delivery es muy caro", emoji: "🚗" },
  { id: "bad_service", label: "Mala atención", emoji: "😤" },
  { id: "competitor", label: "Encontré otro local", emoji: "🔄" },
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
  bad_service: [
    { id: "rude_staff", label: "Trato poco amable" },
    { id: "slow_service", label: "Atención muy lenta" },
    { id: "no_response", label: "No me respondieron" },
    { id: "wrong_info", label: "Información incorrecta" },
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
  preselectedReason?: string;
}

export default function AbandonmentSurveyForm({ enrollmentId, storeName, logoUrl, accent, customerName, alreadyAnswered, preselectedReason }: Props) {
  // Si viene preselected, ya se guardó en el server — mostrar pantalla de "gracias + detalle"
  const [reason, setReason] = useState<string | null>(preselectedReason || null);
  const [detail, setDetail] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(alreadyAnswered && !preselectedReason);
  const [detailSent, setDetailSent] = useState(false);
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
      if (preselectedReason) setDetailSent(true);
      else setSubmitted(true);
    } catch {
      if (preselectedReason) setDetailSent(true);
      else setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  // Pantalla final de gracias
  if (submitted || detailSent) {
    return (
      <div style={{ maxWidth: 480, width: "100%", background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,.08)", fontFamily: "'Segoe UI',system-ui,-apple-system,sans-serif" }}>
        <div style={{ background: accent, padding: "24px 28px", textAlign: "center" }}>
          {logoUrl ? <img src={logoUrl} alt={storeName} style={{ maxHeight: 52, maxWidth: 180, objectFit: "contain", display: "block", margin: "0 auto" }} /> : <span style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{storeName}</span>}
        </div>
        <div style={{ padding: "40px 28px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🙏</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111", margin: "0 0 10px" }}>Gracias por tu respuesta</h1>
          <p style={{ fontSize: 15, color: "#666", lineHeight: 1.6 }}>
            Tu opinión nos ayuda a mejorar {storeName}. Esperamos verte pronto.
          </p>
        </div>
      </div>
    );
  }

  // Pantalla intermedia: ya eligió razón desde el email, ofrecer comentario libre
  if (preselectedReason && reason) {
    const reasonLabel = REASONS.find(r => r.id === reason)?.label || reason;
    return (
      <div style={{ maxWidth: 480, width: "100%", background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,.08)", fontFamily: "'Segoe UI',system-ui,-apple-system,sans-serif" }}>
        <div style={{ background: accent, padding: "24px 28px", textAlign: "center" }}>
          {logoUrl ? <img src={logoUrl} alt={storeName} style={{ maxHeight: 52, maxWidth: 180, objectFit: "contain", display: "block", margin: "0 auto" }} /> : <span style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{storeName}</span>}
        </div>
        <div style={{ padding: "32px 28px", textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111", margin: "0 0 8px" }}>Una última cosita{firstName ? `, ${firstName}` : ""} 🙏</h1>
          <p style={{ fontSize: 14, color: "#777", margin: "0 0 20px" }}>{(() => {
            switch (reason) {
              case "price": return "¿Qué productos o precios sientes que están altos?"
              case "quality": return "¿Qué pasó con la calidad? Queremos mejorar."
              case "delivery_slow": return "¿Cuánto demoró y qué esperabas? Estamos mejorando."
              case "delivery_expensive": return "¿Cuánto pagaste de delivery y cuánto te parecería justo?"
              case "bad_service": return "¿Qué pasó con la atención? Queremos mejorar."
              case "competitor": return "¿Qué local encontraste y qué te gustó de él?"
              case "other": return "Cuéntanos qué pasó, tu opinión nos importa mucho."
              default: return "Cuéntanos un poco más para poder mejorar."
            }
          })()}</p>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Cuéntanos con más detalle para que podamos mejorar (opcional)"
            rows={4}
            maxLength={500}
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 12,
              border: "1.5px solid #e5e7eb", fontSize: 14, fontFamily: "inherit",
              resize: "vertical", outline: "none", boxSizing: "border-box", color: "#333",
            }}
          />

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              onClick={() => setDetailSent(true)}
              style={{ flex: 1, padding: "13px", borderRadius: 12, border: "1.5px solid #e5e7eb", background: "#fff", color: "#666", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
            >
              Listo
            </button>
            {comment.trim() && (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  flex: 1, padding: "13px", borderRadius: 12, border: "none",
                  background: accent, color: "#fff", fontSize: 14, fontWeight: 800,
                  cursor: submitting ? "default" : "pointer", fontFamily: "inherit",
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                {submitting ? "Enviando..." : "Enviar"}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, width: "100%", background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,.08)", fontFamily: "'Segoe UI',system-ui,-apple-system,sans-serif" }}>
      {/* Header branded — mismo estilo que surveyEmail */}
      <div style={{ background: accent, padding: "24px 28px", textAlign: "center" }}>
        {logoUrl ? <img src={logoUrl} alt={storeName} style={{ maxHeight: 52, maxWidth: 180, objectFit: "contain", display: "block", margin: "0 auto" }} /> : <span style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{storeName}</span>}
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
