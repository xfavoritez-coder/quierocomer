"use client";

import { useState } from "react";

const GOLD = "#e8930a";

interface Reply {
  from: string;
  text: string;
  createdAt: string;
}

interface Thread {
  id: string;
  name: string | null;
  email: string;
  message: string;
  createdAt: string;
  replies: Reply[];
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function ReplyClient({ token, thread }: { token: string; thread: Thread }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/soporte/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, text: text.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Error");
      }
      setSent(true);
    } catch (e: any) {
      setError(e.message || "Error al enviar");
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#fefefe", fontFamily: "'Segoe UI',system-ui,-apple-system,sans-serif" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #f0ede6", padding: "16px 20px", display: "flex", alignItems: "center", gap: 10 }}>
        <img src="/landing/logo.png" alt="" style={{ height: 22 }} />
        <span style={{ fontFamily: "Georgia,serif", fontSize: 16, color: GOLD }}>QuieroComer</span>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "32px 20px" }}>
        <h1 style={{ fontFamily: "Georgia,serif", fontSize: "clamp(22px,5vw,28px)", fontWeight: 400, color: "#1a1a1a", margin: "0 0 8px" }}>
          Tu conversacion con <span style={{ color: GOLD }}>soporte</span>
        </h1>
        <p style={{ fontSize: 13, color: "#b8a888", margin: "0 0 28px" }}>
          {thread.email}
        </p>

        {/* Thread */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 32 }}>
          {/* Original message */}
          <div style={{ maxWidth: "85%" }}>
            <div style={{ fontSize: 11, color: "#b8a888", marginBottom: 4, fontWeight: 600 }}>
              {thread.name || "Tu"} · {formatDate(thread.createdAt)}
            </div>
            <div style={{
              background: "#f5f2eb", borderRadius: "4px 16px 16px 16px", padding: "14px 16px",
              fontSize: 14, color: "#1a1a1a", lineHeight: 1.6, whiteSpace: "pre-wrap",
            }}>
              {thread.message}
            </div>
          </div>

          {/* Replies */}
          {thread.replies.map((r, i) => (
            <div key={i} style={{
              maxWidth: "85%",
              alignSelf: r.from === "admin" ? "flex-end" : "flex-start",
            }}>
              <div style={{
                fontSize: 11, color: r.from === "admin" ? GOLD : "#b8a888",
                marginBottom: 4, fontWeight: 600,
                textAlign: r.from === "admin" ? "right" : "left",
              }}>
                {r.from === "admin" ? "QuieroComer" : (thread.name || "Tu")} · {formatDate(r.createdAt)}
              </div>
              <div style={{
                background: r.from === "admin" ? `${GOLD}12` : "#f5f2eb",
                border: r.from === "admin" ? `1px solid ${GOLD}30` : "none",
                borderRadius: r.from === "admin" ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
                padding: "14px 16px", fontSize: 14, color: "#1a1a1a", lineHeight: 1.6, whiteSpace: "pre-wrap",
              }}>
                {r.text}
              </div>
            </div>
          ))}
        </div>

        {/* Reply form */}
        {sent ? (
          <div style={{
            textAlign: "center", padding: "32px 20px",
            background: "#f9f6f0", borderRadius: 16, border: "1px solid #e8dcc4",
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
            <h2 style={{ fontFamily: "Georgia,serif", fontSize: 20, fontWeight: 400, color: "#1a1a1a", margin: "0 0 8px" }}>
              Mensaje enviado
            </h2>
            <p style={{ fontSize: 14, color: "#8a7550" }}>
              Te responderemos pronto a {thread.email}
            </p>
          </div>
        ) : (
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#8a7550", letterSpacing: "0.04em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
              Tu respuesta
            </label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Escribe tu respuesta..."
              rows={4}
              style={{
                width: "100%", padding: "14px 16px", background: "#f9f6f0",
                border: "1px solid #e8dcc4", borderRadius: 14,
                fontSize: 15, color: "#1a1a1a", resize: "vertical",
                outline: "none", fontFamily: "inherit", lineHeight: 1.6,
                boxSizing: "border-box",
              }}
            />
            {error && <p style={{ color: "#dc2626", fontSize: 13, margin: "8px 0 0" }}>{error}</p>}
            <button
              onClick={handleSubmit}
              disabled={sending || !text.trim()}
              style={{
                marginTop: 12, width: "100%", padding: "14px 20px",
                background: GOLD, color: "#fff", border: "none", borderRadius: 999,
                fontSize: 15, fontWeight: 800, cursor: sending ? "wait" : "pointer",
                opacity: !text.trim() ? 0.4 : 1,
              }}
            >
              {sending ? "Enviando..." : "Enviar respuesta"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
