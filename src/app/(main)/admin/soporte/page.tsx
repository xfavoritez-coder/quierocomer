"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

interface Reply {
  id: string;
  from: string;
  text: string;
  createdAt: string;
}

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
  replies: Reply[];
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
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default function SoportePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Message | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread" | "replied">("all");
  const threadRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/soporte")
      .then(r => r.json())
      .then(d => {
        setMessages(d.messages || []);
        // Refresh selected if open
        if (selected) {
          const updated = (d.messages || []).find((m: Message) => m.id === selected.id);
          if (updated) setSelected(updated);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selected]);

  useEffect(() => { load(); }, []);

  // Scroll to bottom of thread when selected changes
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [selected]);

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
    setReplyText("");
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
        setReplyText("");
        load(); // Reload to get updated thread
      }
    } finally { setSending(false); }
  };

  const filtered = messages.filter(m => {
    if (filter === "unread") return !m.read;
    if (filter === "replied") return !!m.repliedAt;
    return true;
  });

  const unreadCount = messages.filter(m => !m.read).length;
  const lastActivity = (msg: Message) => {
    if (msg.replies.length > 0) return msg.replies[msg.replies.length - 1].createdAt;
    return msg.createdAt;
  };

  if (loading && messages.length === 0) return <div style={{ padding: 24, color: "var(--adm-text3)", fontFamily: F }}>Cargando mensajes...</div>;

  return (
    <div style={{ maxWidth: 1200, display: "flex", gap: 0, height: "calc(100vh - 80px)", overflow: "hidden" }}>

      {/* Left: Message list */}
      <div style={{
        width: 380, minWidth: 380, borderRight: "1px solid var(--adm-card-border)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--adm-card-border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h1 style={{ fontFamily: F, fontSize: "1.2rem", color: "var(--adm-accent)", margin: 0 }}>
              Soporte
              {unreadCount > 0 && (
                <span style={{ marginLeft: 8, fontSize: "0.7rem", fontWeight: 700, padding: "3px 8px", borderRadius: 50, background: "#dc2626", color: "#fff" }}>{unreadCount}</span>
              )}
            </h1>
            <button onClick={load} style={{ padding: "5px 12px", background: "transparent", border: "1px solid var(--adm-card-border)", borderRadius: 8, fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text3)", cursor: "pointer" }}>Actualizar</button>
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

        <div style={{ flex: 1, overflowY: "auto" }}>
          {filtered.length === 0 ? (
            <p style={{ padding: 20, textAlign: "center", color: "var(--adm-text3)", fontFamily: FB, fontSize: "0.82rem" }}>No hay mensajes.</p>
          ) : filtered.map(msg => {
            const hasNewReply = msg.replies.some(r => r.from === "customer") && !msg.read;
            return (
              <div
                key={msg.id}
                onClick={() => handleSelect(msg)}
                style={{
                  padding: "14px 18px", borderBottom: "1px solid var(--adm-card-border)",
                  cursor: "pointer",
                  background: selected?.id === msg.id ? "rgba(244,166,35,0.06)" : !msg.read ? "rgba(244,166,35,0.03)" : "transparent",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {!msg.read && <div style={{ width: 7, height: 7, borderRadius: "50%", background: hasNewReply ? "#dc2626" : GOLD, flexShrink: 0 }} />}
                    <span style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: msg.read ? 500 : 700, color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
                      {msg.name || msg.email.split("@")[0]}
                    </span>
                  </div>
                  <span style={{ fontFamily: FB, fontSize: "0.68rem", color: "var(--adm-text3)", flexShrink: 0 }}>
                    {timeAgo(lastActivity(msg))}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{
                    padding: "2px 6px", borderRadius: 4, fontSize: "0.6rem", fontWeight: 700, fontFamily: F,
                    background: msg.source === "panel_soporte" ? "rgba(124,58,237,0.1)" : msg.source === "landing_registro" ? "rgba(34,197,94,0.1)" : "rgba(244,166,35,0.1)",
                    color: msg.source === "panel_soporte" ? "#7c3aed" : msg.source === "landing_registro" ? "#16a34a" : GOLD,
                  }}>
                    {msg.source === "panel_soporte" ? "Panel" : msg.source === "landing_registro" ? "Landing" : "Contacto"}
                  </span>
                  {msg.replies.length > 0 && (
                    <span style={{ fontSize: "0.6rem", color: "var(--adm-text3)", fontFamily: F }}>
                      {msg.replies.length} {msg.replies.length === 1 ? "respuesta" : "respuestas"}
                    </span>
                  )}
                </div>
                <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text2)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {msg.replies.length > 0 ? msg.replies[msg.replies.length - 1].text.substring(0, 60) : msg.message.substring(0, 80)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Thread + Reply */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {!selected ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, color: "var(--adm-text3)" }}>
            <span style={{ fontSize: "2.5rem" }}>📬</span>
            <p style={{ fontFamily: F, fontSize: "0.9rem" }}>Selecciona un mensaje</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ padding: "16px 28px", borderBottom: "1px solid var(--adm-card-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h2 style={{ fontFamily: F, fontSize: "1rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 2px" }}>
                  {selected.name || selected.email.split("@")[0]}
                </h2>
                <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text2)", margin: 0 }}>
                  {selected.email}{selected.phone ? ` · ${selected.phone}` : ""}
                  {selected.restaurantSlug ? ` · ${selected.restaurantSlug}` : ""}
                </p>
              </div>
              <span style={{
                padding: "4px 10px", borderRadius: 50, fontSize: "0.68rem", fontWeight: 700, fontFamily: F,
                background: selected.source === "panel_soporte" ? "rgba(124,58,237,0.1)" : selected.source === "landing_registro" ? "rgba(34,197,94,0.1)" : "rgba(244,166,35,0.1)",
                color: selected.source === "panel_soporte" ? "#7c3aed" : selected.source === "landing_registro" ? "#16a34a" : GOLD,
              }}>
                {selected.source === "panel_soporte" ? "Panel" : selected.source === "landing_registro" ? "Landing" : "Contacto"}
              </span>
            </div>

            {/* Thread */}
            <div ref={threadRef} style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
              {/* Original message */}
              <div style={{ maxWidth: "80%", marginBottom: 16 }}>
                <div style={{ fontSize: "0.65rem", color: "var(--adm-text3)", marginBottom: 4, fontFamily: F }}>
                  {selected.name || selected.email.split("@")[0]} · {formatDate(selected.createdAt)}
                </div>
                <div style={{
                  background: "var(--adm-input, #222)", borderRadius: "4px 16px 16px 16px",
                  padding: "14px 16px", fontSize: "0.85rem", color: "var(--adm-text)",
                  lineHeight: 1.6, whiteSpace: "pre-wrap", fontFamily: FB,
                }}>
                  {selected.message}
                </div>
              </div>

              {/* Replies */}
              {selected.replies.map((r, i) => (
                <div key={i} style={{
                  maxWidth: "80%", marginBottom: 16,
                  alignSelf: r.from === "admin" ? "flex-end" : "flex-start",
                  marginLeft: r.from === "admin" ? "auto" : 0,
                }}>
                  <div style={{
                    fontSize: "0.65rem", marginBottom: 4, fontFamily: F,
                    color: r.from === "admin" ? GOLD : "var(--adm-text3)",
                    textAlign: r.from === "admin" ? "right" : "left",
                  }}>
                    {r.from === "admin" ? "Tu" : (selected.name || selected.email.split("@")[0])} · {formatDate(r.createdAt)}
                  </div>
                  <div style={{
                    background: r.from === "admin" ? `${GOLD}18` : "var(--adm-input, #222)",
                    border: r.from === "admin" ? `1px solid ${GOLD}33` : "none",
                    borderRadius: r.from === "admin" ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
                    padding: "14px 16px", fontSize: "0.85rem", color: "var(--adm-text)",
                    lineHeight: 1.6, whiteSpace: "pre-wrap", fontFamily: FB,
                  }}>
                    {r.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Reply box */}
            <div style={{ borderTop: "1px solid var(--adm-card-border)", padding: "14px 28px", background: "var(--adm-card)" }}>
              <div style={{ display: "flex", gap: 8 }}>
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Escribe tu respuesta..."
                  rows={2}
                  onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleReply(); }}
                  style={{
                    flex: 1, padding: "10px 14px", background: "var(--adm-input, #222)",
                    border: "1px solid var(--adm-card-border)", borderRadius: 12,
                    fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text)",
                    resize: "none", outline: "none",
                  }}
                />
                <button
                  onClick={handleReply}
                  disabled={sending || !replyText.trim()}
                  style={{
                    padding: "10px 18px", background: GOLD, color: "#fff", border: "none",
                    borderRadius: 12, fontFamily: F, fontSize: "0.78rem", fontWeight: 700,
                    cursor: sending ? "wait" : "pointer", opacity: !replyText.trim() ? 0.4 : 1,
                    alignSelf: "flex-end", whiteSpace: "nowrap",
                  }}
                >
                  {sending ? "..." : "Enviar"}
                </button>
              </div>
              <p style={{ fontSize: "0.62rem", color: "var(--adm-text3)", margin: "6px 0 0", fontFamily: FB }}>
                Ctrl+Enter para enviar · Se envia como email con diseño QuieroComer
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
