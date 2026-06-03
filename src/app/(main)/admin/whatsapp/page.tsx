"use client";

import { useState, useEffect, useRef } from "react";

const F = "var(--font-display, Georgia, serif)";
const FB = "system-ui, -apple-system, sans-serif";
const GOLD = "#F4A623";
const GREEN = "#22c55e";
const PURPLE = "#a855f7";
const BLUE = "#3b82f6";
const RED = "#ef4444";

interface Conversation {
  phone: string; profileName: string | null; lastMessage: string;
  lastAt: string; count: number; inbound: number; outbound: number;
  localName: string | null; ownerName: string | null;
  plan: string | null; isDemo: boolean; subscriptionStatus: string | null;
  activated: boolean; sessions7d: number; mode: "sales" | "support";
  insights: string[]; responded: boolean; isCamila: boolean;
}

interface ChatMessage {
  id: string; direction: "INBOUND" | "OUTBOUND"; body: string;
  status: string; profileName: string | null; createdAt: string;
}

interface ConvStats { totalConvs: number; withResponse: number; camilaSent: number; totalInsights: number; }

export default function WhatsAppPage() {
  const [view, setView] = useState<"dashboard" | "chat" | "insights" | "config">("dashboard");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convStats, setConvStats] = useState<ConvStats | null>(null);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatContext, setChatContext] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [knowledge, setKnowledge] = useState<{ id: string; topic: string; content: string; enabled: boolean }[]>([]);
  const [newTopic, setNewTopic] = useState("");
  const [newContent, setNewContent] = useState("");
  const [savingKnowledge, setSavingKnowledge] = useState(false);
  const [chatFilter, setChatFilter] = useState<"all" | "responded" | "waiting" | "camila">("all");
  const [searchQ, setSearchQ] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const conv = await fetch("/api/admin/whatsapp/conversations").then(r => r.json()).catch(() => ({ conversations: [], stats: {} }));
        setConversations(conv.conversations || []);
        setConvStats(conv.stats || null);
      } catch {}
      try {
        const kb = await fetch("/api/admin/whatsapp/knowledge").then(r => r.json()).catch(() => ({ entries: [] }));
        setKnowledge(kb.entries || []);
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const saveKnowledge = async (entries: typeof knowledge) => {
    setSavingKnowledge(true);
    await fetch("/api/admin/whatsapp/knowledge", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries }),
    });
    setKnowledge(entries);
    setSavingKnowledge(false);
  };

  const openChat = async (phone: string) => {
    setSelectedPhone(phone);
    setView("chat");
    const res = await fetch(`/api/admin/whatsapp/conversations?phone=${encodeURIComponent(phone)}`);
    const data = await res.json();
    setChatMessages(data.messages || []);
    setChatContext({ lead: data.lead, restaurant: data.restaurant, insights: data.insights || [] });
  };

  const timeAgo = (iso: string | null) => {
    if (!iso) return "";
    const ms = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return "ahora";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return "ayer";
    return `${days}d`;
  };

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    const day = d.getDate();
    const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    return `${day} ${months[d.getMonth()]} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  const filteredConvs = conversations.filter(c => {
    if (chatFilter === "responded") return c.responded;
    if (chatFilter === "waiting") return !c.responded && c.outbound > 0;
    if (chatFilter === "camila") return c.isCamila;
    return true;
  }).filter(c => {
    if (!searchQ) return true;
    const q = searchQ.toLowerCase();
    return (c.localName || "").toLowerCase().includes(q) || (c.ownerName || "").toLowerCase().includes(q) || c.phone.includes(q);
  });

  const allInsights = conversations.flatMap(c => c.insights.map(i => ({ text: i, local: c.localName, owner: c.ownerName, phone: c.phone })));

  // Funnel data
  const totalSent = conversations.filter(c => c.outbound > 0).length;
  const totalResponded = conversations.filter(c => c.responded).length;
  const totalWithInsight = conversations.filter(c => c.insights.length > 0).length;
  const responseRate = totalSent > 0 ? Math.round((totalResponded / totalSent) * 100) : 0;

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 40, height: 40, border: `3px solid ${GREEN}30`, borderTopColor: GREEN, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
        <div style={{ color: "#666", fontSize: 13, fontFamily: FB }}>Cargando conversaciones...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 900, padding: "0 12px", fontFamily: FB }}>
      {/* ═══ Header ═══ */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14, background: `linear-gradient(135deg, ${GREEN}, ${GREEN}cc)`,
            display: "grid", placeItems: "center", boxShadow: `0 4px 20px ${GREEN}30`,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </div>
          <div>
            <h1 style={{ fontFamily: F, fontSize: 22, color: "#fff", margin: 0, letterSpacing: "-0.5px" }}>Camila IA</h1>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN }} />
              <span style={{ fontSize: 11, color: "#888" }}>Sonnet 4.6 · {conversations.length} conversaciones</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Nav ═══ */}
      <div style={{ display: "flex", gap: 2, marginBottom: 20, background: "#0d0d0d", borderRadius: 12, padding: 3, border: "1px solid #1a1a1a" }}>
        {([
          { key: "dashboard", label: "Dashboard", icon: "◉" },
          { key: "chat", label: "Chats", icon: "💬", count: conversations.length },
          { key: "insights", label: "Insights", icon: "💡", count: allInsights.length },
          { key: "config", label: "Configurar", icon: "⚙" },
        ] as const).map(t => (
          <button key={t.key} onClick={() => { setView(t.key); if (t.key !== "chat") setSelectedPhone(null); }} style={{
            flex: 1, padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer",
            background: view === t.key ? "#1e1e1e" : "transparent",
            color: view === t.key ? "#fff" : "#555",
            fontSize: 12, fontWeight: 600, fontFamily: FB, transition: "all 0.2s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <span style={{ fontSize: 13 }}>{t.icon}</span>
            {t.label}
            {"count" in t && (t as any).count > 0 && (
              <span style={{ fontSize: 9, background: view === t.key ? "#333" : "#1a1a1a", padding: "1px 6px", borderRadius: 10, color: view === t.key ? "#fff" : "#666" }}>{(t as any).count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ═══ DASHBOARD ═══ */}
      {view === "dashboard" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            <GlassCard>
              <div style={{ fontSize: 28, fontWeight: 800, color: GREEN, lineHeight: 1 }}>{totalSent}</div>
              <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Mensajes enviados</div>
            </GlassCard>
            <GlassCard>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: BLUE, lineHeight: 1 }}>{totalResponded}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: `${BLUE}88` }}>{responseRate}%</span>
              </div>
              <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Respondieron</div>
            </GlassCard>
            <GlassCard>
              <div style={{ fontSize: 28, fontWeight: 800, color: GOLD, lineHeight: 1 }}>{totalWithInsight}</div>
              <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Con insights</div>
            </GlassCard>
            <GlassCard>
              <div style={{ fontSize: 28, fontWeight: 800, color: PURPLE, lineHeight: 1 }}>{allInsights.length}</div>
              <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Total insights</div>
            </GlassCard>
          </div>

          {/* Funnel */}
          <GlassCard>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 14 }}>Funnel de Nurturing</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <FunnelBar label="Camila envio mensaje" value={totalSent} max={totalSent} color={GREEN} />
              <FunnelBar label="Respondieron" value={totalResponded} max={totalSent} color={BLUE} />
              <FunnelBar label="Dieron insight" value={totalWithInsight} max={totalSent} color={GOLD} />
            </div>
          </GlassCard>

          {/* Two columns: responded + insights */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Recent responses */}
            <GlassCard>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 12 }}>Ultimas respuestas</div>
              {conversations.filter(c => c.responded).length === 0 ? (
                <div style={{ color: "#555", fontSize: 12, padding: "16px 0", textAlign: "center" }}>Aun nadie ha respondido</div>
              ) : (
                conversations.filter(c => c.responded).slice(0, 5).map(c => (
                  <MiniConvRow key={c.phone} c={c} onOpen={openChat} timeAgo={timeAgo} />
                ))
              )}
            </GlassCard>

            {/* Recent insights */}
            <GlassCard>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 12 }}>Ultimos insights</div>
              {allInsights.length === 0 ? (
                <div style={{ color: "#555", fontSize: 12, padding: "16px 0", textAlign: "center" }}>Sin insights aun</div>
              ) : (
                allInsights.slice(0, 5).map((ins, i) => (
                  <div key={i} onClick={() => openChat(ins.phone)} style={{ padding: "8px 0", borderBottom: i < 4 ? "1px solid #1a1a1a" : "none", cursor: "pointer" }}>
                    <div style={{ fontSize: 12, color: "#ddd" }}>&ldquo;{ins.text}&rdquo;</div>
                    <div style={{ fontSize: 10, color: GOLD, marginTop: 2 }}>{ins.local || ins.owner}</div>
                  </div>
                ))
              )}
            </GlassCard>
          </div>

          {/* Waiting for response */}
          <GlassCard>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 12 }}>
              Esperando respuesta
              <span style={{ fontSize: 11, color: "#555", fontWeight: 400, marginLeft: 8 }}>
                {conversations.filter(c => !c.responded && c.outbound > 0).length} pendientes
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {conversations.filter(c => !c.responded && c.outbound > 0).slice(0, 8).map(c => (
                <MiniConvRow key={c.phone} c={c} onOpen={openChat} timeAgo={timeAgo} />
              ))}
            </div>
          </GlassCard>
        </div>
      )}

      {/* ═══ CHATS ═══ */}
      {view === "chat" && !selectedPhone && (
        <div>
          {/* Search */}
          <div style={{ position: "relative", marginBottom: 12 }}>
            <input
              type="text" placeholder="Buscar local, dueno o telefono..."
              value={searchQ} onChange={e => setSearchQ(e.target.value)}
              style={{
                width: "100%", padding: "10px 14px 10px 36px", borderRadius: 10, border: "1px solid #222",
                background: "#111", color: "#ddd", fontSize: 13, outline: "none", boxSizing: "border-box",
              }}
            />
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#555" }}>🔍</span>
          </div>

          {/* Filters */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {([
              { key: "all", label: "Todas" },
              { key: "responded", label: "Respondieron" },
              { key: "waiting", label: "Esperando" },
              { key: "camila", label: "Camila" },
            ] as const).map(f => {
              const count = f.key === "all" ? conversations.length : f.key === "responded" ? conversations.filter(c => c.responded).length : f.key === "waiting" ? conversations.filter(c => !c.responded && c.outbound > 0).length : conversations.filter(c => c.isCamila).length;
              return (
                <button key={f.key} onClick={() => setChatFilter(f.key)} style={{
                  padding: "6px 12px", borderRadius: 8, border: "1px solid",
                  borderColor: chatFilter === f.key ? `${GREEN}40` : "#222",
                  background: chatFilter === f.key ? `${GREEN}10` : "transparent",
                  color: chatFilter === f.key ? GREEN : "#888",
                  fontSize: 11, fontWeight: 600, cursor: "pointer",
                }}>{f.label} · {count}</button>
              );
            })}
          </div>

          {/* List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {filteredConvs.map(c => (
              <button key={c.phone} onClick={() => openChat(c.phone)} style={{
                background: "#111", borderRadius: 12, padding: "12px 16px",
                border: "1px solid #1a1a1a", cursor: "pointer", textAlign: "left", width: "100%",
                transition: "all 0.15s",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      {/* Avatar */}
                      <div style={{
                        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                        background: c.responded ? `${GREEN}15` : c.isCamila ? `${PURPLE}15` : "#1a1a1a",
                        border: `1px solid ${c.responded ? `${GREEN}30` : "#222"}`,
                        display: "grid", placeItems: "center",
                        fontSize: 14, color: c.responded ? GREEN : "#555",
                      }}>
                        {(c.localName || c.ownerName || "?").charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {c.localName || c.profileName || c.phone}
                          </span>
                          <span style={{
                            fontSize: 8, fontWeight: 800, padding: "2px 6px", borderRadius: 4, letterSpacing: ".04em",
                            background: c.mode === "support" ? `${GREEN}12` : `${PURPLE}10`,
                            color: c.mode === "support" ? GREEN : PURPLE,
                          }}>{c.mode === "support" ? "SOPORTE" : "SALES"}</span>
                          {c.responded && <span style={{ fontSize: 8, fontWeight: 800, padding: "2px 6px", borderRadius: 4, background: `${BLUE}12`, color: BLUE }}>RESP</span>}
                        </div>
                        <div style={{ fontSize: 11, color: "#666", display: "flex", gap: 6, marginTop: 1 }}>
                          {c.ownerName && <span>{c.ownerName}</span>}
                          <span>{c.phone}</span>
                          {c.plan && <span style={{ color: "#444" }}>{c.plan}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, color: "#555" }}>{timeAgo(c.lastAt)}</span>
                    <div style={{ display: "flex", gap: 3 }}>
                      {c.inbound > 0 && <span style={{ fontSize: 9, color: "#888", background: "#1a1a1a", padding: "1px 5px", borderRadius: 4 }}>{c.inbound}↓</span>}
                      {c.outbound > 0 && <span style={{ fontSize: 9, color: GREEN, background: `${GREEN}10`, padding: "1px 5px", borderRadius: 4 }}>{c.outbound}↑</span>}
                    </div>
                  </div>
                </div>
                {/* Last message preview */}
                <div style={{ fontSize: 12, color: "#555", marginTop: 6, marginLeft: 42, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.lastMessage}
                </div>
                {/* Insight preview */}
                {c.insights.length > 0 && (
                  <div style={{ marginTop: 6, marginLeft: 42, fontSize: 11, color: GOLD, display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 10 }}>💡</span>
                    &ldquo;{c.insights[c.insights.length - 1]}&rdquo;
                  </div>
                )}
              </button>
            ))}
            {filteredConvs.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "#555", fontSize: 13 }}>Sin resultados</div>}
          </div>
        </div>
      )}

      {/* ═══ Chat thread ═══ */}
      {view === "chat" && selectedPhone && (
        <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 220px)" }}>
          {/* Chat header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid #1a1a1a", marginBottom: 12, flexShrink: 0 }}>
            <button onClick={() => setSelectedPhone(null)} style={{
              background: "#1a1a1a", border: "1px solid #222", borderRadius: 8, padding: "6px 10px",
              color: "#888", fontSize: 12, cursor: "pointer",
            }}>←</button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>
                {chatContext?.restaurant?.name || chatContext?.lead?.localName || selectedPhone}
              </div>
              <div style={{ fontSize: 11, color: "#888", display: "flex", gap: 8 }}>
                {chatContext?.lead?.ownerName && <span>{chatContext.lead.ownerName}</span>}
                <span>{selectedPhone}</span>
                {chatContext?.restaurant?.plan && <span>{chatContext.restaurant.plan}</span>}
              </div>
            </div>
            {chatContext?.restaurant?.slug && (
              <a href={`/qr/${chatContext.restaurant.slug}`} target="_blank" rel="noopener noreferrer" style={{
                fontSize: 11, color: GREEN, fontWeight: 700, textDecoration: "none",
                padding: "6px 14px", borderRadius: 8, background: `${GREEN}10`, border: `1px solid ${GREEN}25`,
              }}>Ver carta</a>
            )}
          </div>

          {/* Insights banner */}
          {chatContext?.insights?.length > 0 && (
            <div style={{ background: `${GOLD}06`, borderRadius: 10, padding: "10px 14px", marginBottom: 12, border: `1px solid ${GOLD}12`, flexShrink: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>💡 Insights capturados</div>
              {chatContext.insights.map((ins: string, i: number) => (
                <div key={i} style={{ fontSize: 12, color: "#ccc", marginBottom: 1 }}>• {ins}</div>
              ))}
            </div>
          )}

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, paddingBottom: 16 }}>
            {chatMessages.map((m, i) => {
              const isNurturing = m.direction === "OUTBOUND" && m.body.includes("Camila de QuieroComer");
              const isAutoTemplate = m.direction === "OUTBOUND" && !isNurturing && (m.body.includes("QuieroComer.cl") || m.body.includes("quierocomer.cl/api/funnel"));
              const isAI = m.direction === "OUTBOUND" && !isNurturing && !isAutoTemplate;
              const prevMsg = chatMessages[i - 1];
              const showDate = !prevMsg || new Date(m.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();

              return (
                <div key={m.id}>
                  {showDate && (
                    <div style={{ textAlign: "center", margin: "12px 0 8px" }}>
                      <span style={{ fontSize: 10, color: "#555", background: "#111", padding: "3px 12px", borderRadius: 8 }}>
                        {new Date(m.createdAt).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                  )}
                  <div style={{
                    alignSelf: m.direction === "OUTBOUND" ? "flex-end" : "flex-start",
                    maxWidth: "75%", display: "flex", flexDirection: "column",
                    marginLeft: m.direction === "OUTBOUND" ? "auto" : 0,
                  }}>
                    <div style={{
                      padding: "10px 14px", borderRadius: 14,
                      borderTopLeftRadius: m.direction === "INBOUND" ? 4 : 14,
                      borderTopRightRadius: m.direction === "OUTBOUND" ? 4 : 14,
                      background: isNurturing ? `${PURPLE}10` : isAI ? `${GREEN}08` : "#151515",
                      border: `1px solid ${isNurturing ? `${PURPLE}20` : isAI ? `${GREEN}15` : "#222"}`,
                    }}>
                      {isNurturing && (
                        <div style={{ fontSize: 9, color: PURPLE, fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".04em" }}>
                          📨 Camila Nurturing
                        </div>
                      )}
                      {isAutoTemplate && (
                        <div style={{ fontSize: 9, color: "#888", fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".04em" }}>
                          📋 Template automatico
                        </div>
                      )}
                      {isAI && (
                        <div style={{ fontSize: 9, color: GREEN, fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".04em" }}>
                          🤖 Camila IA
                        </div>
                      )}
                      {m.direction === "INBOUND" && m.profileName && (
                        <div style={{ fontSize: 9, color: "#888", fontWeight: 600, marginBottom: 4 }}>
                          {m.profileName}
                        </div>
                      )}
                      <div style={{ fontSize: 13, color: "#ddd", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{m.body}</div>
                    </div>
                    <span style={{ fontSize: 9, color: "#444", marginTop: 2, paddingLeft: 4, textAlign: m.direction === "OUTBOUND" ? "right" : "left" }}>
                      {fmtDate(m.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
        </div>
      )}

      {/* ═══ INSIGHTS ═══ */}
      {view === "insights" && (
        <div>
          {allInsights.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>💡</div>
              <div style={{ fontSize: 15, color: "#fff", fontWeight: 600, marginBottom: 6 }}>Aun no hay insights</div>
              <div style={{ fontSize: 13, color: "#666", lineHeight: 1.6, maxWidth: 360, margin: "0 auto" }}>
                Cuando los duenos respondan a Camila, ella capturara automaticamente por que no estan usando su carta.
              </div>
            </div>
          ) : (() => {
            // Group insights by similarity
            const CATEGORIES: { key: string; label: string; color: string; keywords: string[] }[] = [
              { key: "fotos", label: "Fotos / imágenes", color: "#60a5fa", keywords: ["foto", "imagen", "imágen", "photo", "subir foto"] },
              { key: "precio", label: "Precios incorrectos", color: "#fb923c", keywords: ["precio", "caro", "costo", "cobr", "valor"] },
              { key: "diseño", label: "Diseño / apariencia", color: "#a855f7", keywords: ["diseño", "color", "vista", "feo", "no le gusto", "no me gust", "apariencia"] },
              { key: "otra_carta", label: "Ya tiene otra carta", color: "#f87171", keywords: ["ya tiene", "otra carta", "otro servicio", "ya uso", "ya tengo"] },
              { key: "no_tiempo", label: "Sin tiempo", color: "#fbbf24", keywords: ["tiempo", "ocupado", "despues", "luego", "más adelante"] },
              { key: "no_sabe", label: "No sabía / confusión", color: "#22d3ee", keywords: ["no sabia", "no sabía", "no supe", "no entend", "confus", "como funciona"] },
              { key: "interesado", label: "Interesado / positivo", color: "#4ade80", keywords: ["le gusto", "le gustó", "interesa", "va a usar", "va a poner", "quiere", "activar"] },
              { key: "qr", label: "QR / imprimir", color: "#e879f9", keywords: ["qr", "imprimir", "codigo", "descargar"] },
            ];

            function categorize(text: string): string {
              const lower = text.toLowerCase();
              for (const cat of CATEGORIES) {
                if (cat.keywords.some(k => lower.includes(k))) return cat.key;
              }
              return "otros";
            }

            type Ins = typeof allInsights[0];
            const grouped = new Map<string, Ins[]>();
            for (const ins of allInsights) {
              const cat = categorize(ins.text);
              if (!grouped.has(cat)) grouped.set(cat, []);
              grouped.get(cat)!.push(ins);
            }

            // Sort categories by count descending
            const sortedCats = [...grouped.entries()].sort((a, b) => b[1].length - a[1].length);

            return (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ fontSize: 12, color: "#888" }}>
                {allInsights.length} insight{allInsights.length !== 1 ? "s" : ""} de {totalWithInsight} conversacion{totalWithInsight !== 1 ? "es" : ""}, agrupados por tema
              </div>

              {/* Category summary */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {sortedCats.map(([key, items]) => {
                  const cat = CATEGORIES.find(c => c.key === key);
                  return (
                    <div key={key} style={{
                      padding: "8px 14px", borderRadius: 10, background: "#111", border: "1px solid #1a1a1a",
                      display: "flex", alignItems: "center", gap: 8,
                    }}>
                      <span style={{ fontSize: 18, fontWeight: 800, color: cat?.color || "#888" }}>{items.length}</span>
                      <span style={{ fontSize: 12, color: "#ccc" }}>{cat?.label || "Otros"}</span>
                    </div>
                  );
                })}
              </div>

              {/* Grouped insights */}
              {sortedCats.map(([key, items]) => {
                const cat = CATEGORIES.find(c => c.key === key);
                return (
                  <div key={key}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 4, height: 16, borderRadius: 2, background: cat?.color || "#555" }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: cat?.color || "#888" }}>{cat?.label || "Otros"}</span>
                      <span style={{ fontSize: 11, color: "#555" }}>({items.length})</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: 12 }}>
                      {items.map((ins, i) => (
                        <button key={i} onClick={() => openChat(ins.phone)} style={{
                          background: "#111", borderRadius: 10, padding: "10px 14px",
                          border: "1px solid #1a1a1a", cursor: "pointer", textAlign: "left", width: "100%",
                        }}>
                          <div style={{ fontSize: 13, color: "#ddd", fontWeight: 500, marginBottom: 4, lineHeight: 1.4 }}>
                            &ldquo;{ins.text}&rdquo;
                          </div>
                          <div style={{ display: "flex", gap: 8, fontSize: 11, alignItems: "center" }}>
                            <span style={{ fontWeight: 700, color: GOLD }}>{ins.local || "—"}</span>
                            <span style={{ color: "#555" }}>{ins.owner}</span>
                            <span style={{ color: GREEN, marginLeft: "auto" }}>Ver chat →</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            );
          })()}
        </div>
      )}

      {/* ═══ CONFIG ═══ */}
      {view === "config" && (
        <div>
          {/* How it works */}
          <GlassCard>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 10 }}>Como funciona Camila</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ padding: "12px 14px", borderRadius: 10, background: `${PURPLE}08`, border: `1px solid ${PURPLE}15` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: PURPLE, marginBottom: 4 }}>Modo Sales</div>
                <div style={{ fontSize: 11, color: "#999", lineHeight: 1.5 }}>
                  La mayoria de locales. Camila quiere entender por que no usan la carta. Escucha, no vende.
                </div>
              </div>
              <div style={{ padding: "12px 14px", borderRadius: 10, background: `${GREEN}08`, border: `1px solid ${GREEN}15` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: GREEN, marginBottom: 4 }}>Modo Support</div>
                <div style={{ fontSize: 11, color: "#999", lineHeight: 1.5 }}>
                  Solo locales con 50+ sesiones/semana. Camila da soporte tecnico real.
                </div>
              </div>
            </div>
          </GlassCard>

          <div style={{ height: 16 }} />

          {/* Knowledge base */}
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Conocimiento adicional</div>
          <div style={{ fontSize: 11, color: "#666", marginBottom: 14, lineHeight: 1.5 }}>
            Agrega temas que Camila debe conocer al responder. Se suman a las instrucciones base.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {knowledge.map(e => (
              <div key={e.id} style={{
                background: "#111", borderRadius: 12, padding: "14px 16px",
                border: `1px solid ${e.enabled ? "#1a1a1a" : `${RED}20`}`,
                opacity: e.enabled ? 1 : 0.5,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: GOLD }}>{e.topic}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => saveKnowledge(knowledge.map(k => k.id === e.id ? { ...k, enabled: !k.enabled } : k))} style={{
                      fontSize: 10, padding: "3px 8px", borderRadius: 6, border: "none", cursor: "pointer",
                      background: e.enabled ? `${GREEN}12` : `${RED}12`,
                      color: e.enabled ? GREEN : RED,
                    }}>{e.enabled ? "Activo" : "Off"}</button>
                    <button onClick={() => saveKnowledge(knowledge.filter(k => k.id !== e.id))} style={{
                      fontSize: 10, padding: "3px 8px", borderRadius: 6, border: "none", cursor: "pointer",
                      background: `${RED}12`, color: RED,
                    }}>×</button>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: "#999", margin: 0, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{e.content}</p>
              </div>
            ))}
            {knowledge.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "#555", fontSize: 12, background: "#111", borderRadius: 12, border: "1px solid #1a1a1a" }}>Sin conocimiento adicional</div>}
          </div>

          {/* Add */}
          <div style={{ background: "#0d0d0d", borderRadius: 14, padding: "18px 20px", border: "1px solid #1a1a1a" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12 }}>Nuevo tema</div>
            <input
              type="text" placeholder="Tema (ej: Como subir fotos, Planes...)"
              value={newTopic} onChange={e => setNewTopic(e.target.value)}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #222",
                background: "#111", color: "#ddd", fontSize: 13, marginBottom: 8, outline: "none", boxSizing: "border-box",
              }}
            />
            <textarea
              placeholder="Que debe saber Camila sobre este tema..."
              value={newContent} onChange={e => setNewContent(e.target.value)} rows={3}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #222",
                background: "#111", color: "#ddd", fontSize: 13, marginBottom: 10, outline: "none",
                resize: "vertical", lineHeight: 1.5, boxSizing: "border-box",
              }}
            />
            <button onClick={() => {
              if (!newTopic.trim() || !newContent.trim()) return;
              saveKnowledge([...knowledge, { id: Date.now().toString(), topic: newTopic.trim(), content: newContent.trim(), enabled: true }]);
              setNewTopic(""); setNewContent("");
            }} disabled={!newTopic.trim() || !newContent.trim() || savingKnowledge} style={{
              padding: "10px 24px", borderRadius: 10, border: "none", cursor: "pointer",
              background: GOLD, color: "#0a0a0a", fontSize: 13, fontWeight: 700,
              opacity: (!newTopic.trim() || !newContent.trim()) ? 0.3 : 1,
            }}>
              {savingKnowledge ? "Guardando..." : "Agregar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ Reusable components ═══ */

function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "#111", borderRadius: 14, padding: "18px 20px",
      border: "1px solid #1a1a1a",
    }}>{children}</div>
  );
}

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: "#999" }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{value}</span>
      </div>
      <div style={{ height: 6, background: "#1a1a1a", borderRadius: 6, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 6, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

function MiniConvRow({ c, onOpen, timeAgo }: { c: Conversation; onOpen: (phone: string) => void; timeAgo: (iso: string | null) => string }) {
  return (
    <div onClick={() => onOpen(c.phone)} style={{
      padding: "8px 0", borderBottom: "1px solid #1a1a1a", cursor: "pointer",
      display: "flex", justifyContent: "space-between", alignItems: "center",
    }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#ddd" }}>{c.localName || c.phone}</div>
        <div style={{ fontSize: 10, color: "#666" }}>{c.ownerName}</div>
      </div>
      <span style={{ fontSize: 10, color: "#555" }}>{timeAgo(c.lastAt)}</span>
    </div>
  );
}
