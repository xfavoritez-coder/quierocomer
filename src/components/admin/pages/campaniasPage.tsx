"use client";
import { useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import RestaurantPicker from "@/lib/admin/RestaurantPicker";
import { EMAIL_TEMPLATES } from "@/lib/campaigns/templates";

const F = "var(--font-display)";
const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT: { label: "Borrador", color: "#888", bg: "rgba(255,255,255,0.05)" },
  SCHEDULED: { label: "Programada", color: "#7fbfdc", bg: "rgba(127,191,220,0.1)" },
  SENDING: { label: "Enviando", color: "#F4A623", bg: "rgba(244,166,35,0.1)" },
  SENT: { label: "Enviada", color: "#4ade80", bg: "rgba(74,222,128,0.1)" },
  CANCELLED: { label: "Cancelada", color: "#ff6b6b", bg: "rgba(255,100,100,0.1)" },
};

interface Segment { id: string; name: string; cachedCount: number | null; }
interface Campaign {
  id: string; name: string; status: string; subject: string | null; bodyHtml: string | null;
  segmentId: string | null; segment: Segment | null; sentAt: string | null; createdAt: string;
  stats: any;
}

export default function AdminCampanias() {
  const { selectedRestaurantId, loading: sessionLoading } = useAdminSession();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [recipientStats, setRecipientStats] = useState<Record<string, { sent: number; opened: number; clicked: number }>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [sending, setSending] = useState(false);

  // Form state
  const [fName, setFName] = useState("");
  const [fSegment, setFSegment] = useState("");
  const [fSubject, setFSubject] = useState("");
  const [fBody, setFBody] = useState("");
  const [fTemplate, setFTemplate] = useState("");

  useEffect(() => {
    if (sessionLoading || !selectedRestaurantId) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      fetch(`/api/admin/campaigns?restaurantId=${selectedRestaurantId}`).then(r => r.json()),
      fetch(`/api/admin/segments?restaurantId=${selectedRestaurantId}`).then(r => r.json()),
    ]).then(([cData, sData]) => {
      setCampaigns(cData.campaigns || []);
      setRecipientStats(cData.recipientStats || {});
      setSegments(sData.segments || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [selectedRestaurantId, sessionLoading]);

  const applyTemplate = (templateId: string) => {
    const t = EMAIL_TEMPLATES.find(t => t.id === templateId);
    if (t) { setFSubject(t.subject); setFBody(t.bodyHtml); setFTemplate(templateId); }
  };

  const handleCreate = async () => {
    if (!fName || !selectedRestaurantId) return;
    const res = await fetch("/api/admin/campaigns", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId: selectedRestaurantId, name: fName, segmentId: fSegment || null, subject: fSubject, bodyHtml: fBody }),
    });
    const data = await res.json();
    if (data.campaign) {
      setCampaigns(prev => [data.campaign, ...prev]);
      resetForm();
    }
  };

  const handleUpdate = async () => {
    if (!editing) return;
    const res = await fetch("/api/admin/campaigns", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editing.id, name: fName, segmentId: fSegment || null, subject: fSubject, bodyHtml: fBody }),
    });
    const data = await res.json();
    if (data.campaign) {
      setCampaigns(prev => prev.map(c => c.id === editing.id ? data.campaign : c));
      resetForm();
    }
  };

  const handleSend = async (campaignId: string) => {
    if (!confirm("¿Enviar esta campaña ahora? Se enviará a todos los usuarios del segmento.")) return;
    setSending(true);
    const res = await fetch("/api/admin/campaigns", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send", campaignId }),
    });
    const data = await res.json();
    if (data.ok) {
      setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, status: "SENT", sentAt: new Date().toISOString(), stats: { sent: data.sent, skipped: data.skipped, failed: data.failed } } : c));
    }
    setSending(false);
  };

  const startEdit = (c: Campaign) => {
    setEditing(c);
    setCreating(true);
    setFName(c.name);
    setFSegment(c.segmentId || "");
    setFSubject(c.subject || "");
    setFBody(c.bodyHtml || "");
  };

  const resetForm = () => {
    setCreating(false); setEditing(null);
    setFName(""); setFSegment(""); setFSubject(""); setFBody(""); setFTemplate("");
  };

  if (loading) return <p style={{ color: "#F4A623", fontFamily: F, padding: 40 }}>Cargando campañas...</p>;

  if (!selectedRestaurantId) return (
    <div style={{ padding: 40, textAlign: "center" }}><p style={{ color: "#888", fontFamily: F }}>Selecciona un local</p><RestaurantPicker /></div>
  );

  return (
    <div style={{ maxWidth: 800 }}>
      <div className="adm-flex-wrap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, gap: 10 }}>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: "#F4A623", margin: 0 }}>Campañas</h1>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "4px 0 0" }}>Envía correos a tus clientes con novedades, ofertas y más</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <RestaurantPicker />
          {!creating && <button onClick={() => setCreating(true)} style={{ padding: "8px 16px", background: "#F4A623", color: "white", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>+ Nuevo</button>}
        </div>
      </div>

      {creating && (
        <div style={{ background: "#1A1A1A", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 16, padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontFamily: F, fontSize: "1rem", color: "white", marginBottom: 16 }}>{editing ? "Editar campaña" : "Nueva campaña"}</h3>

          <input placeholder="Nombre de la campaña" value={fName} onChange={e => setFName(e.target.value)} style={I} />

          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <select value={fSegment} onChange={e => setFSegment(e.target.value)} style={{ ...I, flex: 1 }}>
              <option value="">Sin segmento (todos)</option>
              {segments.map(s => <option key={s.id} value={s.id}>{s.name} ({s.cachedCount ?? "?"} personas)</option>)}
            </select>
            <select value={fTemplate} onChange={e => applyTemplate(e.target.value)} style={{ ...I, flex: 1 }}>
              <option value="">Usar plantilla...</option>
              {EMAIL_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <input placeholder="Asunto del email" value={fSubject} onChange={e => setFSubject(e.target.value)} style={I} />

          <textarea placeholder="HTML del email (usa {{name}} y {{restaurant}})" value={fBody} onChange={e => setFBody(e.target.value)} rows={8} style={{ ...I, resize: "vertical", lineHeight: 1.5 }} />

          {fBody && (
            <div style={{ marginBottom: 10 }}>
              <p style={{ fontFamily: F, fontSize: "0.7rem", color: "#888", marginBottom: 6 }}>Preview:</p>
              <div style={{ background: "white", borderRadius: 10, padding: 16, maxHeight: 300, overflow: "auto" }} dangerouslySetInnerHTML={{ __html: fBody.replace(/\{\{name\}\}/g, "Jaime").replace(/\{\{restaurant\}\}/g, "Mi Local") }} />
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={editing ? handleUpdate : handleCreate} disabled={!fName} style={{ padding: "10px 20px", background: "#F4A623", color: "#0a0a0a", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}>
              {editing ? "Guardar cambios" : "Crear borrador"}
            </button>
            <button onClick={resetForm} style={{ padding: "10px 20px", background: "none", border: "1px solid #2A2A2A", borderRadius: 8, color: "#888", fontFamily: F, fontSize: "0.85rem", cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {campaigns.map(c => {
          const st = STATUS_LABELS[c.status] || STATUS_LABELS.DRAFT;
          const stats = recipientStats[c.id];
          return (
            <div key={c.id} style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 12, padding: "16px 18px" }}>
              <div className="adm-flex-wrap" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: F, fontSize: "0.95rem", color: "white", fontWeight: 600 }}>{c.name}</span>
                    <span style={{ fontSize: "0.6rem", padding: "2px 8px", borderRadius: 4, background: st.bg, color: st.color, fontWeight: 600 }}>{st.label}</span>
                  </div>
                  <div style={{ fontFamily: F, fontSize: "0.72rem", color: "#666", marginTop: 4, display: "flex", gap: 8 }}>
                    {c.segment && <span>👥 {c.segment.name}</span>}
                    {c.subject && <span>· {c.subject.slice(0, 40)}{c.subject.length > 40 ? "..." : ""}</span>}
                    <span>· {new Date(c.createdAt).toLocaleDateString("es-CL")}</span>
                  </div>
                </div>

                {/* Stats for sent campaigns */}
                {c.status === "SENT" && (c.stats || stats) && (
                  <div style={{ display: "flex", gap: 14, flexShrink: 0 }}>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ fontFamily: F, fontSize: "1rem", color: "#4ade80", fontWeight: 700, margin: 0 }}>{c.stats?.sent || stats?.sent || 0}</p>
                      <p style={{ fontFamily: F, fontSize: "0.6rem", color: "#666", margin: 0 }}>Enviados</p>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ fontFamily: F, fontSize: "1rem", color: "#7fbfdc", fontWeight: 700, margin: 0 }}>{stats?.opened || 0}</p>
                      <p style={{ fontFamily: F, fontSize: "0.6rem", color: "#666", margin: 0 }}>Abiertos</p>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ fontFamily: F, fontSize: "1rem", color: "#F4A623", fontWeight: 700, margin: 0 }}>{stats?.clicked || 0}</p>
                      <p style={{ fontFamily: F, fontSize: "0.6rem", color: "#666", margin: 0 }}>Clicks</p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {c.status === "DRAFT" && (
                    <>
                      <button onClick={() => startEdit(c)} style={BTN}>Editar</button>
                      <button onClick={() => handleSend(c.id)} disabled={sending || !c.subject || !c.bodyHtml} style={{ ...BTN, background: "rgba(74,222,128,0.1)", color: "#4ade80", borderColor: "rgba(74,222,128,0.2)" }}>
                        {sending ? "..." : "Enviar"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {campaigns.length === 0 && !creating && (
          <p style={{ fontFamily: F, fontSize: "0.85rem", color: "#666", textAlign: "center", padding: 40 }}>No hay campañas. Crea la primera.</p>
        )}
      </div>
    </div>
  );
}

const I: React.CSSProperties = { width: "100%", padding: "10px 14px", background: "#111", border: "1px solid #2A2A2A", borderRadius: 8, color: "white", fontFamily: "var(--font-display)", fontSize: "0.85rem", outline: "none", marginBottom: 10, boxSizing: "border-box" };
const BTN: React.CSSProperties = { padding: "6px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 6, color: "#aaa", fontFamily: "var(--font-display)", fontSize: "0.72rem", cursor: "pointer" };
