"use client";
import { useState, useEffect } from "react";
import { Mail } from "lucide-react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { EMAIL_TEMPLATES } from "@/lib/campaigns/templates";
import SkeletonLoading from "@/components/admin/SkeletonLoading";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

type Tab = "cumpleanos" | "campanas";

// ═══════════════════════════════════════════════════════════
// TAB: CUMPLEAÑOS
// ═══════════════════════════════════════════════════════════
function BirthdayTab({ restaurantId, restaurantName }: { restaurantId: string; restaurantName: string }) {
  const [enabled, setEnabled] = useState(false);
  const [perk, setPerk] = useState("");
  const [perkConditions, setPerkConditions] = useState("");
  const [logs, setLogs] = useState<any[]>([]);
  const [kpi, setKpi] = useState({ sent: 0, visited: 0, rate: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/restaurant/birthday?restaurantId=${restaurantId}`)
      .then(r => r.json())
      .then(d => {
        setEnabled(d.birthdayEmailEnabled || false);
        setPerk(d.birthdayPerk || "");
        setPerkConditions(d.birthdayPerkConditions || "");
        setLogs(d.logs || []);
        setKpi(d.kpi || { sent: 0, visited: 0, rate: 0 });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [restaurantId]);

  const handleSave = async () => {
    setSaving(true);
    await fetch("/api/admin/restaurant/birthday", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId, birthdayEmailEnabled: enabled, birthdayPerk: perk, birthdayPerkConditions: perkConditions }),
    });
    setSaving(false);
  };

  const birthdayEmailHtml = `<div style="font-family:'DM Sans',system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 20px;background:#ffffff">
  <div style="text-align:center;margin-bottom:24px">
    <p style="font-size:2.8rem;margin:0">🎂</p>
    <h1 style="font-size:1.5rem;font-weight:700;color:#0e0e0e;margin:12px 0 4px">¡Feliz cumpleaños, Juan!</h1>
    <p style="font-size:1rem;color:#888;margin:0">De parte de todo el equipo de ${restaurantName}</p>
  </div>
  <div style="background:linear-gradient(135deg,#FFF8E5,#FDE68A);border-radius:16px;padding:24px;margin-bottom:24px;text-align:center;border:1px solid rgba(244,166,35,0.3)">
    <p style="font-size:0.75rem;color:#92400e;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;margin:0 0 8px">Tu regalo de cumpleaños</p>
    <p style="font-size:1.3rem;color:#0e0e0e;font-weight:700;line-height:1.3;margin:0">${perk || "..."}</p>
  </div>
  <div style="text-align:center;margin-bottom:24px">
    <p style="font-size:0.95rem;color:#555;line-height:1.6;margin:0">Ven a visitarnos y menciona este correo para recibir tu regalo. ¡Te esperamos!</p>
  </div>
  <div style="text-align:center;margin-bottom:${perkConditions ? '16px' : '0'}">
    <a href="#" style="display:inline-block;background:#F4A623;color:#0a0a0a;text-decoration:none;padding:14px 32px;border-radius:50px;font-weight:700;font-size:1rem">Ver la carta</a>
  </div>
  ${perkConditions ? `<div style="text-align:center;padding-top:16px;border-top:1px solid #f0f0f0">
    <p style="font-size:0.7rem;color:#bbb;line-height:1.5;margin:0">${perkConditions}</p>
  </div>` : ""}
</div>`;

  if (loading) return <SkeletonLoading type="cards" />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Toggle + Perk */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "20px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: enabled ? 16 : 0 }}>
          <div>
            <p style={{ fontFamily: F, fontSize: "0.95rem", color: "var(--adm-text)", fontWeight: 600, margin: 0 }}>Email automático de cumpleaños</p>
            <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "4px 0 0" }}>Envía un regalo a cada cliente el día de su cumpleaños</p>
          </div>
          <button
            onClick={() => { const next = !enabled; setEnabled(next); if (!next) handleSave(); }}
            style={{
              width: 48, height: 26, borderRadius: 13, border: "none", cursor: "pointer",
              background: enabled ? GOLD : "var(--adm-hover)",
              position: "relative", transition: "background 0.2s", flexShrink: 0,
            }}
          >
            <div style={{
              width: 20, height: 20, borderRadius: "50%", background: "white",
              position: "absolute", top: 3,
              left: enabled ? 25 : 3,
              transition: "left 0.2s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }} />
          </button>
        </div>

        {enabled && (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", display: "block", marginBottom: 6 }}>¿Qué regalo van a recibir tus clientes?</label>
              <input
                value={perk}
                onChange={e => setPerk(e.target.value)}
                placeholder="Ej: Un postre de cortesía, 15% de descuento, etc."
                style={{ width: "100%", padding: "10px 14px", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text)", fontFamily: F, fontSize: "0.85rem", outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", display: "block", marginBottom: 6 }}>Condiciones del regalo (opcional)</label>
              <textarea
                value={perkConditions}
                onChange={e => setPerkConditions(e.target.value)}
                placeholder="Ej: Válido solo el día del cumpleaños. No acumulable con otras promociones."
                rows={2}
                style={{ width: "100%", padding: "10px 14px", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text)", fontFamily: F, fontSize: "0.8rem", outline: "none", boxSizing: "border-box", resize: "vertical" }}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleSave} disabled={saving || !perk.trim()} style={{ padding: "8px 20px", background: GOLD, color: "white", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", opacity: saving || !perk.trim() ? 0.5 : 1 }}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
              <button onClick={() => setShowPreview(!showPreview)} style={{ padding: "8px 16px", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text2)", fontFamily: F, fontSize: "0.82rem", cursor: "pointer" }}>
                {showPreview ? "Ocultar preview" : "Ver preview del email"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Email Preview */}
      {showPreview && enabled && (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "16px 18px" }}>
          <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Preview del email</p>
          <div style={{ background: "white", borderRadius: 12, overflow: "hidden" }} dangerouslySetInnerHTML={{ __html: birthdayEmailHtml }} />
        </div>
      )}

      {/* KPI */}
      {kpi.sent > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
            <p style={{ fontFamily: F, fontSize: "1.4rem", fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>{kpi.sent}</p>
            <p style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>Enviados</p>
          </div>
          <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
            <p style={{ fontFamily: F, fontSize: "1.4rem", fontWeight: 700, color: "#4ade80", margin: 0 }}>{kpi.visited}</p>
            <p style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>Visitaron</p>
          </div>
          <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
            <p style={{ fontFamily: F, fontSize: "1.4rem", fontWeight: 700, color: GOLD, margin: 0 }}>{kpi.rate}%</p>
            <p style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>Conversión</p>
          </div>
        </div>
      )}

      {/* History */}
      {logs.length > 0 && (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "16px 18px" }}>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 12px", fontWeight: 600 }}>📧 Historial de envíos</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {logs.map((log: any) => (
              <div key={log.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--adm-card-border)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text)", margin: 0, fontWeight: 500 }}>{log.qrUser?.name || log.qrUser?.email?.split("@")[0]}</p>
                  <p style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>{new Date(log.sentAt).toLocaleDateString("es-CL")} · {log.perkText}</p>
                </div>
                {log.visitedAt ? (
                  <span style={{ fontFamily: F, fontSize: "0.62rem", padding: "2px 8px", borderRadius: 4, background: "rgba(74,222,128,0.15)", color: "#16a34a", fontWeight: 600 }}>🎉 Visitó</span>
                ) : (
                  <span style={{ fontFamily: F, fontSize: "0.62rem", padding: "2px 8px", borderRadius: 4, background: "var(--adm-hover)", color: "var(--adm-text3)" }}>Pendiente</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!enabled && logs.length === 0 && (
        <div style={{ textAlign: "center", padding: 40 }}>
          <span style={{ fontSize: "2.5rem", display: "block", marginBottom: 12 }}>🎂</span>
          <p style={{ fontFamily: F, fontSize: "0.95rem", color: "var(--adm-text2)", marginBottom: 4 }}>Activa los emails de cumpleaños</p>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text3)" }}>Cada cliente recibirá un correo con su regalo el día de su cumpleaños</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB: CAMPAÑAS
// ═══════════════════════════════════════════════════════════
const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT: { label: "Borrador", color: "#888", bg: "rgba(255,255,255,0.05)" },
  SENDING: { label: "Enviando", color: GOLD, bg: "rgba(244,166,35,0.1)" },
  SENT: { label: "Enviada", color: "#4ade80", bg: "rgba(74,222,128,0.1)" },
};

interface Campaign {
  id: string; name: string; status: string; subject: string | null; bodyHtml: string | null;
  segmentId: string | null; segment: { name: string } | null; sentAt: string | null; createdAt: string;
  stats: any;
}

function CampanasTab({ restaurantId }: { restaurantId: string }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [recipientStats, setRecipientStats] = useState<Record<string, { sent: number; opened: number; clicked: number }>>({});
  const [segments, setSegments] = useState<{ id: string; name: string; cachedCount: number | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);

  // Form
  const [fName, setFName] = useState("");
  const [fSegment, setFSegment] = useState("");
  const [fSubject, setFSubject] = useState("");
  const [fBody, setFBody] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/admin/campaigns?restaurantId=${restaurantId}`).then(r => r.json()),
      fetch(`/api/admin/segments?restaurantId=${restaurantId}`).then(r => r.json()),
    ]).then(([cData, sData]) => {
      setCampaigns(cData.campaigns || []);
      setRecipientStats(cData.recipientStats || {});
      setSegments(sData.segments || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [restaurantId]);

  const applyTemplate = (t: typeof EMAIL_TEMPLATES[0]) => {
    setFSubject(t.subject);
    setFBody(t.bodyHtml);
    setShowTemplates(false);
  };

  const handleCreate = async () => {
    if (!fName) return;
    const res = await fetch("/api/admin/campaigns", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId, name: fName, segmentId: fSegment || null, subject: fSubject, bodyHtml: fBody }),
    });
    const data = await res.json();
    if (data.campaign) { setCampaigns(prev => [data.campaign, ...prev]); resetForm(); }
  };

  const handleUpdate = async () => {
    if (!editing) return;
    const res = await fetch("/api/admin/campaigns", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editing.id, name: fName, segmentId: fSegment || null, subject: fSubject, bodyHtml: fBody }),
    });
    const data = await res.json();
    if (data.campaign) { setCampaigns(prev => prev.map(c => c.id === editing.id ? data.campaign : c)); resetForm(); }
  };

  const handleSend = async (id: string) => {
    if (!confirm("¿Enviar esta campaña ahora?")) return;
    setSending(true);
    const res = await fetch("/api/admin/campaigns", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send", campaignId: id }),
    });
    const data = await res.json();
    if (data.ok) {
      setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: "SENT", sentAt: new Date().toISOString(), stats: { sent: data.sent } } : c));
    }
    setSending(false);
  };

  const startEdit = (c: Campaign) => {
    setEditing(c); setCreating(true);
    setFName(c.name); setFSegment(c.segmentId || ""); setFSubject(c.subject || ""); setFBody(c.bodyHtml || "");
  };

  const resetForm = () => {
    setCreating(false); setEditing(null); setShowTemplates(false);
    setFName(""); setFSegment(""); setFSubject(""); setFBody("");
  };

  if (loading) return <SkeletonLoading type="cards" />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Templates */}
      {!creating && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: 0, fontWeight: 600 }}>Plantillas rápidas</p>
            <button onClick={() => { setCreating(true); setShowTemplates(false); }} style={{ padding: "6px 14px", background: GOLD, color: "white", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}>+ Desde cero</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {EMAIL_TEMPLATES.map(t => (
              <button key={t.id} onClick={() => { applyTemplate(t); setCreating(true); setFName(t.name); }} style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: "16px 14px", textAlign: "left", cursor: "pointer" }}>
                <p style={{ fontFamily: F, fontSize: "0.85rem", color: "var(--adm-text)", fontWeight: 600, margin: "0 0 4px" }}>{t.name}</p>
                <p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", margin: 0, lineHeight: 1.4 }}>{t.description}</p>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Create/Edit form */}
      {creating && (
        <div style={{ background: "var(--adm-card)", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 16, padding: 22 }}>
          <h3 style={{ fontFamily: F, fontSize: "1rem", color: "var(--adm-text)", marginBottom: 14 }}>{editing ? "Editar campaña" : "Nueva campaña"}</h3>
          <input placeholder="Nombre de la campaña" value={fName} onChange={e => setFName(e.target.value)} style={INP} />
          <select value={fSegment} onChange={e => setFSegment(e.target.value)} style={{ ...INP, appearance: "auto" }}>
            <option value="">Todos mis clientes</option>
            {segments.map(s => <option key={s.id} value={s.id}>{s.name} ({s.cachedCount ?? "?"} personas)</option>)}
          </select>
          <input placeholder="Asunto del email" value={fSubject} onChange={e => setFSubject(e.target.value)} style={INP} />
          <textarea placeholder="Contenido HTML del email (usa {{name}} y {{restaurant}})" value={fBody} onChange={e => setFBody(e.target.value)} rows={8} style={{ ...INP, resize: "vertical", lineHeight: 1.5 }} />

          {fBody && (
            <div style={{ marginBottom: 10 }}>
              <p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", marginBottom: 6 }}>Preview:</p>
              <div style={{ background: "white", borderRadius: 10, padding: 14, maxHeight: 250, overflow: "auto" }} dangerouslySetInnerHTML={{ __html: fBody.replace(/\{\{name\}\}/g, "Juan").replace(/\{\{restaurant\}\}/g, "Mi Local") }} />
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={editing ? handleUpdate : handleCreate} disabled={!fName} style={{ padding: "10px 20px", background: GOLD, color: "white", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", opacity: !fName ? 0.5 : 1 }}>
              {editing ? "Guardar" : "Crear borrador"}
            </button>
            <button onClick={resetForm} style={{ padding: "10px 16px", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text2)", fontFamily: F, fontSize: "0.82rem", cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Campaign list */}
      {campaigns.length > 0 && (
        <div>
          <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px", fontWeight: 600 }}>Email Marketing</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {campaigns.map(c => {
              const st = STATUS_LABELS[c.status] || STATUS_LABELS.DRAFT;
              const stats = recipientStats[c.id];
              return (
                <div key={c.id} style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontFamily: F, fontSize: "0.88rem", color: "var(--adm-text)", fontWeight: 600 }}>{c.name}</span>
                        <span style={{ fontSize: "0.58rem", padding: "2px 7px", borderRadius: 4, background: st.bg, color: st.color, fontWeight: 600 }}>{st.label}</span>
                      </div>
                      <p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", margin: "3px 0 0" }}>
                        {c.segment?.name || "Todos"} · {new Date(c.createdAt).toLocaleDateString("es-CL")}
                        {c.subject && ` · ${c.subject.slice(0, 30)}${c.subject.length > 30 ? "..." : ""}`}
                      </p>
                    </div>

                    {c.status === "SENT" && (stats || c.stats) && (
                      <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
                        {[
                          { v: c.stats?.sent || stats?.sent || 0, l: "Enviados", c: "#4ade80" },
                          { v: stats?.opened || 0, l: "Abiertos", c: "#7fbfdc" },
                          { v: stats?.clicked || 0, l: "Clicks", c: GOLD },
                        ].map((m, i) => (
                          <div key={i} style={{ textAlign: "center" }}>
                            <p style={{ fontFamily: F, fontSize: "0.88rem", color: m.c, fontWeight: 700, margin: 0 }}>{m.v}</p>
                            <p style={{ fontFamily: F, fontSize: "0.55rem", color: "var(--adm-text3)", margin: 0 }}>{m.l}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {c.status === "DRAFT" && (
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        <button onClick={() => startEdit(c)} style={BTN}>Editar</button>
                        <button onClick={() => handleSend(c.id)} disabled={sending || !c.subject} style={{ ...BTN, background: "rgba(74,222,128,0.1)", color: "#4ade80", borderColor: "rgba(74,222,128,0.2)", opacity: sending || !c.subject ? 0.5 : 1 }}>Enviar</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {campaigns.length === 0 && !creating && (
        <div style={{ textAlign: "center", padding: 40 }}>
          <span style={{ fontSize: "2rem", display: "block", marginBottom: 10 }}>📧</span>
          <p style={{ fontFamily: F, fontSize: "0.88rem", color: "var(--adm-text2)" }}>No hay emails aún</p>
          <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)" }}>Elige una plantilla o crea una desde cero</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════
export default function AdminCampanias() {
  const { selectedRestaurantId, restaurants, loading: sessionLoading } = useAdminSession();
  const [activeTab, setActiveTab] = useState<Tab>("cumpleanos");

  if (sessionLoading) return <SkeletonLoading type="cards" />;
  if (!selectedRestaurantId) return <div style={{ padding: 40, textAlign: "center" }}><p style={{ color: "var(--adm-text2)", fontFamily: F }}>Selecciona un local</p></div>;

  const restName = restaurants.find(r => r.id === selectedRestaurantId)?.name || "Tu local";

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}><Mail size={20} color={GOLD} /> Email Marketing</h1>
        <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: 0 }}>Comunícate con tus clientes y premia su fidelidad</p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {([
          { key: "cumpleanos" as Tab, label: "🎂 Cumpleaños", icon: "" },
          { key: "campanas" as Tab, label: "📧 Email Marketing", icon: "" },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: "8px 16px", borderRadius: 999, border: "none", cursor: "pointer",
              fontFamily: F, fontSize: "0.78rem", fontWeight: 600,
              background: activeTab === t.key ? "var(--adm-card-border)" : "transparent",
              color: activeTab === t.key ? "var(--adm-text)" : "var(--adm-text2)",
              transition: "all 0.15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "cumpleanos" && <BirthdayTab restaurantId={selectedRestaurantId} restaurantName={restName} />}
      {activeTab === "campanas" && <CampanasTab restaurantId={selectedRestaurantId} />}
    </div>
  );
}

const INP: React.CSSProperties = { width: "100%", padding: "10px 14px", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text)", fontFamily: "var(--font-display)", fontSize: "0.85rem", outline: "none", marginBottom: 10, boxSizing: "border-box" };
const BTN: React.CSSProperties = { padding: "5px 12px", background: "rgba(244,166,35,0.1)", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 6, color: GOLD, fontFamily: "var(--font-display)", fontSize: "0.72rem", fontWeight: 600, cursor: "pointer" };
