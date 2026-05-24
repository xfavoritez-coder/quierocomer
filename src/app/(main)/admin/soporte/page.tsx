"use client";

import { useState, useEffect, useCallback } from "react";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

interface Message {
  id: string;
  source: string;
  name: string | null;
  email: string;
  phone: string | null;
  message: string;
  restaurantSlug: string | null;
  ownerId: string | null;
  read: boolean;
  repliedAt: string | null;
  replyText: string | null;
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-CL", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function SoportePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Message | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread" | "replied">("all");

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/soporte")
      .then(r => r.json())
      .then(d => setMessages(d.messages || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const markRead = async (msg: Message) => {
    if (msg.read) return;
    await fetch("/api/admin/soporte", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: msg.id }),
    }).catch(() => {});
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read: true } : m));
  };

  const handleSelect = (msg: Message) => {
    setSelected(msg);
    setReplyText(msg.replyText || "");
    markRead(msg);
  };

  const handleReply = async () => {
    if (!selected || !replyText.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/admin/soporte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: selected.id, replyText: replyText.trim() }),
      });
      if (res.ok) {
        setMessages(prev => prev.map(m =>
          m.id === selected.id ? { ...m, read: true, repliedAt: new Date().toISOString(), replyText: replyText.trim() } : m
        ));
        setSelected(prev => prev ? { ...prev, repliedAt: new Date().toISOString(), replyText: replyText.trim() } : null);
      }
    } finally { setSending(false); }
  };

  const filtered = messages.filter(m => {
    if (filter === "unread") return !m.read;
    if (filter === "replied") return !!m.repliedAt;
    return true;
  });

  const unreadCount = messages.filter(m => !m.read).length;

  if (loading) return <div style={{ padding: 24, color: "var(--adm-text3)", fontFamily: F }}>Cargando mensajes...</div>;

  return (
    <div style={{ maxWidth: 1200, display: "flex", gap: 0, height: "calc(100vh - 80px)", overflow: "hidden" }}>

      {/* Left: Message list */}
      <div style={{
        width: 380, minWidth: 380, borderRight: "1px solid var(--adm-card-border)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--adm-card-border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h1 style={{ fontFamily: F, fontSize: "1.2rem", color: "var(--adm-accent)", margin: 0 }}>
              Soporte
              {unreadCount > 0 && (
                <span style={{
                  marginLeft: 8, fontSize: "0.7rem", fontWeight: 700, padding: "3px 8px",
                  borderRadius: 50, background: "#dc2626", color: "#fff",
                }}>{unreadCount}</span>
              )}
            </h1>
            <button onClick={load} style={{
              padding: "5px 12px", background: "transparent", border: "1px solid var(--adm-card-border)",
              borderRadius: 8, fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text3)", cursor: "pointer",
            }}>Actualizar</button>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["all", "unread", "replied"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: "5px 12px", borderRadius: 50, border: "none", cursor: "pointer",
                fontFamily: F, fontSize: "0.7rem", fontWeight: 600,
                background: filter === f ? GOLD : "var(--adm-input, #f5f5f5)",
                color: filter === f ? "#fff" : "var(--adm-text3)",
              }}>
                {f === "all" ? `Todos (${messages.length})` : f === "unread" ? `Sin leer (${unreadCount})` : `Respondidos`}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {filtered.length === 0 ? (
            <p style={{ padding: 20, textAlign: "center", color: "var(--adm-text3)", fontFamily: FB, fontSize: "0.82rem" }}>
              No hay mensajes.
            </p>
          ) : filtered.map(msg => (
            <div
              key={msg.id}
              onClick={() => handleSelect(msg)}
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid var(--adm-card-border)",
                cursor: "pointer",
                background: selected?.id === msg.id ? "rgba(244,166,35,0.06)" : !msg.read ? "rgba(244,166,35,0.03)" : "transparent",
                transition: "background 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {!msg.read && <div style={{ width: 7, height: 7, borderRadius: "50%", background: GOLD, flexShrink: 0 }} />}
                  <span style={{
                    fontFamily: F, fontSize: "0.82rem", fontWeight: msg.read ? 500 : 700,
                    color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200,
                  }}>
                    {msg.name || msg.email.split("@")[0]}
                  </span>
                </div>
                <span style={{ fontFamily: FB, fontSize: "0.68rem", color: "var(--adm-text3)", flexShrink: 0 }}>
                  {timeAgo(msg.createdAt)}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{
                  padding: "2px 6px", borderRadius: 4, fontSize: "0.6rem", fontWeight: 700, fontFamily: F,
                  background: msg.source === "panel_soporte" ? "rgba(124,58,237,0.1)" : "rgba(244,166,35,0.1)",
                  color: msg.source === "panel_soporte" ? "#7c3aed" : GOLD,
                }}>
                  {msg.source === "panel_soporte" ? "Panel" : "Contacto"}
                </span>
                {msg.repliedAt && (
                  <span style={{ fontSize: "0.6rem", color: "#16a34a", fontWeight: 600, fontFamily: F }}>✓ Respondido</span>
                )}
              </div>
              <p style={{
                fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text2)", margin: 0,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {msg.message.substring(0, 80)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Detail + Reply */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {!selected ? (
          <div style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column", gap: 8, color: "var(--adm-text3)",
          }}>
            <span style={{ fontSize: "2.5rem" }}>📬</span>
            <p style={{ fontFamily: F, fontSize: "0.9rem" }}>Selecciona un mensaje</p>
          </div>
        ) : (
          <>
            {/* Message detail */}
            <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontFamily: F, fontSize: "1.1rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px" }}>
                    {selected.name || selected.email.split("@")[0]}
                  </h2>
                  <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: 0 }}>
                    {selected.email}
                    {selected.phone && <> · {selected.phone}</>}
                  </p>
                  {selected.restaurantSlug && (
                    <p style={{ fontFamily: FB, fontSize: "0.72rem", color: GOLD, margin: "4px 0 0" }}>
                      Local: {selected.restaurantSlug}
                    </p>
                  )}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <span style={{
                    padding: "4px 10px", borderRadius: 50, fontSize: "0.68rem", fontWeight: 700, fontFamily: F,
                    background: selected.source === "panel_soporte" ? "rgba(124,58,237,0.1)" : "rgba(244,166,35,0.1)",
                    color: selected.source === "panel_soporte" ? "#7c3aed" : GOLD,
                  }}>
                    {selected.source === "panel_soporte" ? "Panel Soporte" : "Formulario Contacto"}
                  </span>
                  <p style={{ fontFamily: FB, fontSize: "0.68rem", color: "var(--adm-text3)", margin: "6px 0 0" }}>
                    {formatDate(selected.createdAt)}
                  </p>
                </div>
              </div>

              {/* Message bubble */}
              <div style={{
                background: "var(--adm-input, #f5f5f5)", borderRadius: "4px 16px 16px 16px",
                padding: "16px 18px", marginBottom: 20, maxWidth: "85%",
              }}>
                <p style={{
                  fontFamily: FB, fontSize: "0.88rem", color: "var(--adm-text)",
                  lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap",
                }}>
                  {selected.message}
                </p>
              </div>

              {/* Reply bubble (if already replied) */}
              {selected.repliedAt && selected.replyText && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
                  <div style={{
                    background: `${GOLD}18`, border: `1px solid ${GOLD}33`,
                    borderRadius: "16px 4px 16px 16px", padding: "16px 18px", maxWidth: "85%",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: "0.68rem", fontWeight: 700, color: GOLD, fontFamily: F }}>Tu respuesta</span>
                      <span style={{ fontSize: "0.62rem", color: "var(--adm-text3)", fontFamily: FB }}>
                        {formatDate(selected.repliedAt)}
                      </span>
                    </div>
                    <p style={{
                      fontFamily: FB, fontSize: "0.88rem", color: "var(--adm-text)",
                      lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap",
                    }}>
                      {selected.replyText}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Reply box */}
            <div style={{
              borderTop: "1px solid var(--adm-card-border)", padding: "16px 28px",
              background: "var(--adm-card)",
            }}>
              <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "0 0 8px" }}>
                {selected.repliedAt ? "Enviar otra respuesta" : "Responder"} a {selected.email}
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Escribe tu respuesta..."
                  rows={3}
                  style={{
                    flex: 1, padding: "12px 14px", background: "var(--adm-input, #f5f5f5)",
                    border: "1px solid var(--adm-card-border)", borderRadius: 12,
                    fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text)",
                    resize: "vertical", outline: "none", minHeight: 60,
                  }}
                />
                <button
                  onClick={handleReply}
                  disabled={sending || !replyText.trim()}
                  style={{
                    padding: "12px 20px", background: GOLD, color: "#fff", border: "none",
                    borderRadius: 12, fontFamily: F, fontSize: "0.8rem", fontWeight: 700,
                    cursor: sending ? "wait" : "pointer", opacity: !replyText.trim() ? 0.4 : 1,
                    alignSelf: "flex-end", whiteSpace: "nowrap",
                  }}
                >
                  {sending ? "Enviando..." : "Enviar ✉️"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
