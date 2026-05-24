"use client";

import { useState, useEffect } from "react";

interface WaLead {
  id: string; localName: string; ownerName: string; email: string;
  whatsapp: string | null; generatedSlug: string | null; cartaStatus: string;
  whatsappSentAt: string | null; whatsappClickedAt: string | null;
  openedVia: string | null; twilioStatus: string | null;
}

interface Stats { total: number; clicked: number; opened: number; delivered: number; read: number; failed: number; }

interface Conversation {
  phone: string; profileName: string | null; lastMessage: string;
  lastAt: string; count: number; inbound: number; outbound: number;
  localName: string | null; ownerName: string | null;
}

interface ChatMessage {
  id: string; direction: "INBOUND" | "OUTBOUND"; body: string;
  status: string; profileName: string | null; createdAt: string;
}

const STATUS_COLORS: Record<string, { color: string; label: string }> = {
  queued: { color: "#888", label: "Encolado" }, sent: { color: "#3b82f6", label: "Enviado" },
  delivered: { color: "#22c55e", label: "Entregado" }, read: { color: "#a855f7", label: "Leído" },
  failed: { color: "#ef4444", label: "Falló" }, undelivered: { color: "#f59e0b", label: "No entregado" },
};

export default function WhatsAppPage() {
  const [tab, setTab] = useState<"sent" | "chats" | "config">("chats");
  const [leads, setLeads] = useState<WaLead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatContext, setChatContext] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [knowledge, setKnowledge] = useState<{ id: string; topic: string; content: string; enabled: boolean }[]>([]);
  const [newTopic, setNewTopic] = useState("");
  const [newContent, setNewContent] = useState("");
  const [savingKnowledge, setSavingKnowledge] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/whatsapp").then(r => r.json()),
      fetch("/api/admin/whatsapp/conversations").then(r => r.json()),
      fetch("/api/admin/whatsapp/knowledge").then(r => r.json()),
    ]).then(([wa, conv, kb]) => {
      setLeads(wa.leads || []); setStats(wa.stats || null);
      setConversations(conv.conversations || []);
      setKnowledge(kb.entries || []);
    }).finally(() => setLoading(false));
  }, []);

  const saveKnowledge = async (entries: typeof knowledge) => {
    setSavingKnowledge(true);
    await fetch("/api/admin/whatsapp/knowledge", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries }),
    });
    setKnowledge(entries);
    setSavingKnowledge(false);
  };

  const addEntry = () => {
    if (!newTopic.trim() || !newContent.trim()) return;
    const entry = { id: Date.now().toString(), topic: newTopic.trim(), content: newContent.trim(), enabled: true };
    const updated = [...knowledge, entry];
    saveKnowledge(updated);
    setNewTopic(""); setNewContent("");
  };

  const removeEntry = (id: string) => saveKnowledge(knowledge.filter(e => e.id !== id));
  const toggleEntry = (id: string) => saveKnowledge(knowledge.map(e => e.id === id ? { ...e, enabled: !e.enabled } : e));

  const openChat = async (phone: string) => {
    setSelectedPhone(phone);
    const res = await fetch(`/api/admin/whatsapp/conversations?phone=${encodeURIComponent(phone)}`);
    const data = await res.json();
    setChatMessages(data.messages || []);
    setChatContext({ lead: data.lead, restaurant: data.restaurant });
  };

  const timeAgo = (iso: string | null) => {
    if (!iso) return "—";
    const ms = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return "ahora";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  if (loading) return <div style={{ padding: 40, color: "#888" }}>Cargando...</div>;

  return (
    <div style={{ maxWidth: 700, padding: "0 12px" }}>
      <h1 style={{ fontFamily: "var(--font-display, Georgia)", fontSize: 22, color: "#22c55e", margin: "0 0 16px" }}>
        WhatsApp
      </h1>

      {/* Stats */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))", gap: 8, marginBottom: 16 }}>
          <StatCard label="Enviados" value={stats.total} color="#3b82f6" />
          <StatCard label="Click carta" value={stats.clicked} color="#F4A623" />
          <StatCard label="Vía WA" value={stats.opened} color="#14b8a6" />
          <StatCard label="Chats IA" value={conversations.length} color="#a855f7" />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button onClick={() => setTab("chats")} style={{
          padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
          background: tab === "chats" ? "#22c55e" : "#1a1a1a", color: tab === "chats" ? "#fff" : "#888",
          fontSize: 13, fontWeight: 700,
        }}>Conversaciones ({conversations.length})</button>
        <button onClick={() => setTab("sent")} style={{
          padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
          background: tab === "sent" ? "#3b82f6" : "#1a1a1a", color: tab === "sent" ? "#fff" : "#888",
          fontSize: 13, fontWeight: 700,
        }}>Enviados ({leads.length})</button>
        <button onClick={() => setTab("config")} style={{
          padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
          background: tab === "config" ? "#F4A623" : "#1a1a1a", color: tab === "config" ? "#fff" : "#888",
          fontSize: 13, fontWeight: 700,
        }}>Configurar IA</button>
      </div>

      {/* Conversations tab */}
      {tab === "chats" && !selectedPhone && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {conversations.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "#666" }}>No hay conversaciones aún.</div>}
          {conversations.map(c => (
            <button key={c.phone} onClick={() => openChat(c.phone)} style={{
              background: "#1a1a1a", borderRadius: 12, padding: "14px 16px",
              border: "1px solid #2a2a2a", cursor: "pointer", textAlign: "left", width: "100%",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{c.localName || c.profileName || c.phone}</span>
                  <span style={{ fontSize: 10, color: "#888", background: "#222", padding: "2px 6px", borderRadius: 4 }}>{c.count} msgs</span>
                </div>
                <span style={{ fontSize: 11, color: "#555" }}>{timeAgo(c.lastAt)}</span>
              </div>
              <div style={{ fontSize: 12, color: "#888", display: "flex", gap: 8 }}>
                {c.ownerName && <span>{c.ownerName}</span>}
                <span style={{ color: "#22c55e" }}>{c.phone}</span>
              </div>
              <div style={{ fontSize: 12, color: "#555", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.lastMessage}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Chat thread */}
      {tab === "chats" && selectedPhone && (
        <div>
          <button onClick={() => { setSelectedPhone(null); setChatMessages([]); }} style={{
            background: "none", border: "none", color: "#888", fontSize: 13, cursor: "pointer", marginBottom: 12,
          }}>← Volver</button>

          {chatContext?.restaurant && (
            <div style={{ background: "#111", borderRadius: 10, padding: "10px 14px", marginBottom: 12, border: "1px solid #222" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{chatContext.restaurant.name}</span>
              <span style={{ fontSize: 11, color: "#888", marginLeft: 8 }}>{chatContext.restaurant.plan} · {chatContext.restaurant.isDemo ? "Demo" : "Activo"}</span>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {chatMessages.map(m => (
              <div key={m.id} style={{
                alignSelf: m.direction === "OUTBOUND" ? "flex-end" : "flex-start",
                maxWidth: "80%",
                display: "flex", flexDirection: "column",
              }}>
                <div style={{
                  padding: "10px 14px", borderRadius: 14,
                  background: m.direction === "OUTBOUND" ? "rgba(34,197,94,0.12)" : "#222",
                  border: `1px solid ${m.direction === "OUTBOUND" ? "rgba(34,197,94,0.2)" : "#333"}`,
                }}>
                  {m.direction === "OUTBOUND" && (
                    <div style={{ fontSize: 9, color: "#22c55e", fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".05em" }}>🤖 IA</div>
                  )}
                  <div style={{ fontSize: 14, color: "#ddd", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{m.body}</div>
                </div>
                <span style={{ fontSize: 10, color: "#555", marginTop: 2, paddingLeft: 4 }}>{fmtTime(m.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sent messages tab */}
      {tab === "sent" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {leads.map(l => {
            const s = l.twilioStatus ? STATUS_COLORS[l.twilioStatus] : null;
            return (
              <div key={l.id} style={{
                background: "#1a1a1a", borderRadius: 12, padding: "12px 16px",
                border: `1px solid ${l.whatsappClickedAt ? "rgba(34,197,94,0.2)" : "#2a2a2a"}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{l.localName || "Sin nombre"}</span>
                    {s && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: `${s.color}20`, color: s.color }}>{s.label}</span>}
                    {l.whatsappClickedAt && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(244,166,35,0.12)", color: "#F4A623" }}>CLICK</span>}
                  </div>
                  <span style={{ fontSize: 11, color: "#555" }}>{timeAgo(l.whatsappSentAt)}</span>
                </div>
                <div style={{ fontSize: 12, color: "#888", display: "flex", gap: 8 }}>
                  <span>{l.ownerName}</span>
                  <span style={{ color: "#22c55e" }}>{l.whatsapp}</span>
                  {l.openedVia === "whatsapp" && <span style={{ color: "#14b8a6", fontWeight: 600 }}>Vía WA</span>}
                </div>
              </div>
            );
          })}
          {leads.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "#666" }}>No hay mensajes enviados.</div>}
        </div>
      )}

      {/* Config tab */}
      {tab === "config" && (
        <div>
          <p style={{ color: "#888", fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
            Agrega temas y respuestas que el bot debe conocer. Cuando un dueño pregunte sobre alguno de estos temas, el bot usará esta información para responder.
          </p>

          {/* Existing entries */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {knowledge.map(e => (
              <div key={e.id} style={{
                background: "#1a1a1a", borderRadius: 12, padding: "14px 16px",
                border: `1px solid ${e.enabled ? "#2a2a2a" : "rgba(239,68,68,0.2)"}`,
                opacity: e.enabled ? 1 : 0.5,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#F4A623" }}>{e.topic}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => toggleEntry(e.id)} style={{
                      fontSize: 10, padding: "3px 8px", borderRadius: 6, border: "none", cursor: "pointer",
                      background: e.enabled ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                      color: e.enabled ? "#22c55e" : "#ef4444",
                    }}>{e.enabled ? "Activo" : "Inactivo"}</button>
                    <button onClick={() => removeEntry(e.id)} style={{
                      fontSize: 10, padding: "3px 8px", borderRadius: 6, border: "none", cursor: "pointer",
                      background: "rgba(239,68,68,0.12)", color: "#ef4444",
                    }}>Eliminar</button>
                  </div>
                </div>
                <p style={{ fontSize: 13, color: "#aaa", margin: 0, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{e.content}</p>
              </div>
            ))}
            {knowledge.length === 0 && (
              <div style={{ padding: 24, textAlign: "center", color: "#555", fontSize: 13 }}>
                No hay instrucciones configuradas. El bot responde con conocimiento general de QuieroComer.
              </div>
            )}
          </div>

          {/* Add new entry */}
          <div style={{ background: "#111", borderRadius: 14, padding: "16px 18px", border: "1px solid #222" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12 }}>Agregar tema</div>
            <input
              type="text" placeholder="Tema (ej: Planes, Sección Clientes, Cómo subir fotos...)"
              value={newTopic} onChange={e => setNewTopic(e.target.value)}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #333",
                background: "#0a0a0a", color: "#ddd", fontSize: 14, marginBottom: 8, outline: "none",
                boxSizing: "border-box",
              }}
            />
            <textarea
              placeholder="Qué debe responder el bot cuando pregunten sobre este tema..."
              value={newContent} onChange={e => setNewContent(e.target.value)}
              rows={4}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #333",
                background: "#0a0a0a", color: "#ddd", fontSize: 14, marginBottom: 10, outline: "none",
                resize: "vertical", fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box",
              }}
            />
            <button onClick={addEntry} disabled={!newTopic.trim() || !newContent.trim() || savingKnowledge} style={{
              padding: "10px 20px", borderRadius: 10, border: "none", cursor: "pointer",
              background: "#F4A623", color: "#0a0a0a", fontSize: 14, fontWeight: 700,
              opacity: (!newTopic.trim() || !newContent.trim()) ? 0.4 : 1,
            }}>
              {savingKnowledge ? "Guardando..." : "Agregar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: "#1a1a1a", borderRadius: 10, padding: "12px 14px", border: "1px solid #2a2a2a" }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{label}</div>
    </div>
  );
}
