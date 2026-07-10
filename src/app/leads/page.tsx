"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const PASSWORD = "joan";
const AUTH_KEY = "leads_auth";

type CrmStatus = "nuevo" | "llamando" | "contactado" | "interesado" | "no_interesado" | "cerrado";

interface Note {
  text: string;
  ts: string;
}

interface Lead {
  id: string;
  localName: string;
  ownerName: string;
  email: string;
  whatsapp: string | null;
  cartaType: string;
  cartaStatus: string;
  cartaUrl: string | null;
  generatedSlug: string | null;
  createdAt: string;
  completedAt: string | null;
  deliveredAt: string | null;
  emailOpenedAt: string | null;
  emailClickedAt: string | null;
  panelVisitedAt: string | null;
  activatedAt: string | null;
  errorLog: string | null;
  crmStatus: CrmStatus;
  crmNotes: Note[];
  crmFollowUpAt: string | null;
  city: string | null;
  restaurantPlan: string | null;
  restaurantPlanPrice: number | null;
  restaurantPeriodEnd: string | null;
  restaurantLastPayment: string | null;
}

const STATUS_CONFIG: Record<CrmStatus, { label: string; color: string; bg: string }> = {
  nuevo:         { label: "Nuevo",         color: "#60a5fa", bg: "rgba(96,165,250,.15)" },
  llamando:      { label: "Llamando",      color: "#fbbf24", bg: "rgba(251,191,36,.15)" },
  contactado:    { label: "Contactado",    color: "#a78bfa", bg: "rgba(167,139,250,.15)" },
  interesado:    { label: "Interesado",    color: "#34d399", bg: "rgba(52,211,153,.15)" },
  no_interesado: { label: "No interesado", color: "#9ca3af", bg: "rgba(156,163,175,.12)" },
  cerrado:       { label: "Cerrado",       color: "#E8A33D", bg: "rgba(232,163,61,.18)" },
};

const CRM_STATUSES: CrmStatus[] = ["nuevo", "llamando", "contactado", "interesado", "no_interesado", "cerrado"];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function fmtDateInput(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 16);
}

type Tab = "nuevos" | "en_proceso" | "interesados" | "cerrados" | "no_interesados" | "todos";

const TABS: { id: Tab; label: string }[] = [
  { id: "nuevos",        label: "Nuevos" },
  { id: "en_proceso",    label: "En proceso" },
  { id: "interesados",   label: "Interesados" },
  { id: "cerrados",      label: "Cerrados" },
  { id: "no_interesados",label: "Descartados" },
  { id: "todos",         label: "Todos" },
];

function filterByTab(leads: Lead[], tab: Tab): Lead[] {
  switch (tab) {
    case "nuevos":        return leads.filter(l => l.crmStatus === "nuevo");
    case "en_proceso":    return leads.filter(l => l.crmStatus === "llamando" || l.crmStatus === "contactado");
    case "interesados":   return leads.filter(l => l.crmStatus === "interesado");
    case "cerrados":      return leads.filter(l => l.crmStatus === "cerrado");
    case "no_interesados":return leads.filter(l => l.crmStatus === "no_interesado");
    case "todos":         return leads;
  }
}

// ─── Password Screen ──────────────────────────────────────────────────────────
function PasswordScreen({ onAuth }: { onAuth: () => void }) {
  const [val, setVal] = useState("");
  const [err, setErr] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { ref.current?.focus(); }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (val.trim().toLowerCase() === PASSWORD) {
      localStorage.setItem(AUTH_KEY, PASSWORD);
      onAuth();
    } else {
      setErr(true);
      setVal("");
      setTimeout(() => setErr(false), 1500);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0A0908", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{`input::placeholder { color: #4A443D !important; opacity: 1; }`}</style>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 32, color: "#E8DDC8", marginBottom: 6 }}>QuieroComer</div>
          <div style={{ fontSize: 13, color: "#7D7366", letterSpacing: ".06em" }}>CRM · Leads</div>
        </div>
        <form onSubmit={submit}>
          <input
            ref={ref}
            type="password"
            value={val}
            onChange={e => setVal(e.target.value)}
            placeholder="Contraseña"
            style={{
              width: "100%", padding: "16px 20px", background: "#131110", border: `1px solid ${err ? "#ef4444" : "rgba(232,163,61,.25)"}`,
              color: "#E8DDC8", fontSize: 16, borderRadius: 10, outline: "none", marginBottom: 12,
              transition: "border-color .2s", fontFamily: "inherit",
            }}
          />
          <button type="submit" style={{
            width: "100%", padding: "16px", background: "#E8A33D", color: "#0A0908", fontSize: 15,
            fontWeight: 700, border: "none", borderRadius: 10, cursor: "pointer",
          }}>
            Entrar
          </button>
        </form>
        {err && <p style={{ textAlign: "center", color: "#ef4444", fontSize: 13, marginTop: 12 }}>Contraseña incorrecta</p>}
      </div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: CrmStatus }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.nuevo;
  return (
    <span style={{
      display: "inline-block", padding: "3px 10px", borderRadius: 20,
      fontSize: 11, fontWeight: 700, letterSpacing: ".04em",
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}40`,
      whiteSpace: "nowrap",
    }}>
      {cfg.label.toUpperCase()}
    </span>
  );
}

// ─── Lead Detail Panel ────────────────────────────────────────────────────────
function LeadPanel({ lead, onClose, onUpdate }: {
  lead: Lead;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Lead>) => void;
}) {
  const [noteText, setNoteText] = useState("");
  const [followUp, setFollowUp] = useState(fmtDateInput(lead.crmFollowUpAt));
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const api = useCallback(async (patch: Record<string, unknown>) => {
    setSaving(true);
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-leads-auth": PASSWORD },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    onUpdate(lead.id, data);
    setSaving(false);
    setSavedMsg("Guardado");
    setTimeout(() => setSavedMsg(""), 1500);
    return data;
  }, [lead.id, onUpdate]);

  const changeStatus = (s: CrmStatus) => api({ crmStatus: s });

  const saveNote = async () => {
    if (!noteText.trim()) return;
    await api({ note: noteText.trim() });
    setNoteText("");
  };

  const saveFollowUp = () => api({ crmFollowUpAt: followUp || null });

  // Timeline events from funnel
  const timeline: { label: string; ts: string }[] = [];
  if (lead.createdAt)     timeline.push({ label: "Envió su carta", ts: lead.createdAt });
  if (lead.completedAt)   timeline.push({ label: "Completó el formulario", ts: lead.completedAt });
  if (lead.deliveredAt)   timeline.push({ label: "Email enviado", ts: lead.deliveredAt });
  if (lead.emailOpenedAt) timeline.push({ label: "Abrió el email", ts: lead.emailOpenedAt });
  if (lead.emailClickedAt)timeline.push({ label: "Hizo clic en el email", ts: lead.emailClickedAt });
  if (lead.panelVisitedAt)timeline.push({ label: "Visitó el panel", ts: lead.panelVisitedAt });
  if (lead.activatedAt)   timeline.push({ label: "Activó cuenta", ts: lead.activatedAt });
  timeline.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  const cartaPreviewUrl = lead.generatedSlug ? `/qr/${lead.generatedSlug}` : lead.cartaUrl;
  const waMsg = encodeURIComponent(`Hola ${lead.ownerName?.split(" ")[0] || ""}, te escribo de QuieroComer. Vi que subiste tu carta de ${lead.localName} y quería mostrarte cómo quedó. ¿Tienes un momento?`);

  const notes = Array.isArray(lead.crmNotes) ? (lead.crmNotes as Note[]) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#131110" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #3A342D", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#7D7366", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "0 4px" }}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: "#E8DDC8", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {lead.localName}
          </div>
          <div style={{ fontSize: 12, color: "#7D7366", marginTop: 2 }}>{timeAgo(lead.createdAt)}</div>
        </div>
        {saving && <div style={{ fontSize: 12, color: "#7D7366" }}>Guardando…</div>}
        {savedMsg && <div style={{ fontSize: 12, color: "#34d399" }}>✓ {savedMsg}</div>}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 0 40px" }}>

        {/* Ficha cliente activo */}
        {lead.restaurantPlan && (
          <div style={{ margin: "16px 20px 0", padding: "14px 16px", background: "rgba(232,163,61,.06)", border: "1px solid rgba(232,163,61,.25)", borderRadius: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 15 }}>{lead.restaurantPlan === "PREMIUM" ? "💎" : lead.restaurantPlan === "GOLD" ? "⭐" : "🥈"}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#E8A33D", letterSpacing: ".04em" }}>CLIENTE ACTIVO — PLAN {lead.restaurantPlan}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {lead.restaurantPlanPrice && (
                <div style={{ fontSize: 13, color: "#C9BBA0" }}>
                  💰 <strong style={{ color: "#E8DDC8" }}>${lead.restaurantPlanPrice.toLocaleString("es-CL")}</strong> / mes neto
                </div>
              )}
              {lead.restaurantLastPayment && (
                <div style={{ fontSize: 12, color: "#7D7366" }}>
                  Último pago: {new Date(lead.restaurantLastPayment).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })}
                </div>
              )}
              {lead.restaurantPeriodEnd && (
                <div style={{ fontSize: 12, color: new Date(lead.restaurantPeriodEnd) < new Date() ? "#ef4444" : "#34d399" }}>
                  {new Date(lead.restaurantPeriodEnd) < new Date() ? "⚠️ Periodo vencido:" : "✓ Vigente hasta:"} {new Date(lead.restaurantPeriodEnd).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Contact info */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #3A342D" }}>
          <div style={{ fontSize: 13, color: "#7D7366", marginBottom: 10, letterSpacing: ".06em", textTransform: "uppercase" }}>Contacto</div>
          <div style={{ fontSize: 15, color: "#E8DDC8", marginBottom: 6 }}>👤 {lead.ownerName}</div>
          {lead.whatsapp && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 15, color: "#C9BBA0" }}>📱 {lead.whatsapp}</span>
              <a href={`tel:${lead.whatsapp}`} style={actionBtnStyle("#60a5fa")}>Llamar</a>
              <a href={`https://wa.me/${lead.whatsapp.replace(/\D/g, "")}?text=${waMsg}`} target="_blank" rel="noreferrer" style={actionBtnStyle("#25d366")}>WhatsApp</a>
            </div>
          )}
          <div style={{ fontSize: 14, color: "#C9BBA0", marginBottom: 4 }}>
            📧 <a href={`mailto:${lead.email}`} style={{ color: "#C9BBA0", textDecoration: "none" }}>{lead.email}</a>
          </div>
          {lead.city && <div style={{ fontSize: 13, color: "#7D7366" }}>📍 {lead.city}</div>}
          <div style={{ fontSize: 13, color: "#7D7366", marginTop: 4 }}>
            📄 {lead.cartaType} · {lead.cartaStatus}
          </div>
          {cartaPreviewUrl && (
            <a href={cartaPreviewUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 10, fontSize: 13, color: "#E8A33D", textDecoration: "none", border: "1px solid rgba(232,163,61,.3)", padding: "6px 12px", borderRadius: 6 }}>
              Ver carta →
            </a>
          )}
          {false && lead.errorLog && (
            <div style={{ marginTop: 10, padding: "10px 12px", background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", borderRadius: 8, fontSize: 12, color: "#fca5a5", lineHeight: 1.5 }}>
              {lead.errorLog.substring(0, 200)}
            </div>
          )}
        </div>

        {/* Status selector */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #3A342D" }}>
          <div style={{ fontSize: 13, color: "#7D7366", marginBottom: 10, letterSpacing: ".06em", textTransform: "uppercase" }}>Estado</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {CRM_STATUSES.map(s => {
              const cfg = STATUS_CONFIG[s];
              const active = lead.crmStatus === s;
              return (
                <button key={s} onClick={() => changeStatus(s)} style={{
                  padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  border: `1px solid ${active ? cfg.color : "#3A342D"}`,
                  background: active ? cfg.bg : "transparent",
                  color: active ? cfg.color : "#7D7366",
                  transition: ".15s",
                }}>
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Follow-up */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #3A342D" }}>
          <div style={{ fontSize: 13, color: "#7D7366", marginBottom: 10, letterSpacing: ".06em", textTransform: "uppercase" }}>Próximo seguimiento</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="datetime-local"
              value={followUp}
              onChange={e => setFollowUp(e.target.value)}
              style={{ flex: 1, padding: "10px 14px", background: "#1A1714", border: "1px solid #3A342D", color: "#E8DDC8", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none" }}
            />
            <button onClick={saveFollowUp} style={{ padding: "10px 16px", background: "#E8A33D", color: "#0A0908", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
              Guardar
            </button>
          </div>
        </div>

        {/* Notes */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #3A342D" }}>
          <div style={{ fontSize: 13, color: "#7D7366", marginBottom: 10, letterSpacing: ".06em", textTransform: "uppercase" }}>Notas</div>
          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="Escribe una nota sobre esta llamada…"
            rows={3}
            style={{ width: "100%", padding: "12px 14px", background: "#1A1714", border: "1px solid #3A342D", color: "#E8DDC8", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", resize: "none", lineHeight: 1.5, boxSizing: "border-box" }}
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveNote(); }}
          />
          <button onClick={saveNote} disabled={!noteText.trim()} style={{
            marginTop: 8, padding: "10px 20px", background: noteText.trim() ? "#E8A33D" : "#3A342D",
            color: noteText.trim() ? "#0A0908" : "#7D7366", border: "none", borderRadius: 8,
            fontSize: 13, fontWeight: 700, cursor: noteText.trim() ? "pointer" : "default", transition: ".15s",
          }}>
            Guardar nota
          </button>

          {notes.length > 0 && (
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              {[...notes].reverse().map((n, i) => (
                <div key={i} style={{ padding: "12px 14px", background: "#1A1714", borderRadius: 8, border: "1px solid #3A342D" }}>
                  <p style={{ fontSize: 14, color: "#C9BBA0", margin: "0 0 6px", lineHeight: 1.5 }}>{n.text}</p>
                  <span style={{ fontSize: 11, color: "#7D7366" }}>{fmtDate(n.ts)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Timeline */}
        {timeline.length > 0 && (
          <div style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 13, color: "#7D7366", marginBottom: 12, letterSpacing: ".06em", textTransform: "uppercase" }}>Actividad del lead</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {timeline.map((ev, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#E8A33D", marginTop: 5, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, color: "#C9BBA0" }}>{ev.label}</div>
                    <div style={{ fontSize: 11, color: "#7D7366" }}>{fmtDate(ev.ts)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const actionBtnStyle = (color: string): React.CSSProperties => ({
  display: "inline-block", padding: "4px 10px", fontSize: 12, fontWeight: 600,
  color, border: `1px solid ${color}50`, borderRadius: 6, textDecoration: "none",
  background: `${color}15`, whiteSpace: "nowrap",
});

// ─── Lead Card ────────────────────────────────────────────────────────────────
function LeadCard({ lead, onClick, selected }: { lead: Lead; onClick: () => void; selected: boolean }) {
  const hasFU = lead.crmFollowUpAt && new Date(lead.crmFollowUpAt) <= new Date();
  return (
    <div
      onClick={onClick}
      style={{
        padding: "14px 16px", borderRadius: 12, cursor: "pointer",
        background: selected ? "rgba(232,163,61,.08)" : "#131110",
        border: `1px solid ${selected ? "rgba(232,163,61,.4)" : hasFU ? "rgba(239,68,68,.35)" : "#3A342D"}`,
        transition: ".15s",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 17, color: "#E8DDC8", lineHeight: 1.2, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {lead.localName}
        </div>
        <StatusBadge status={lead.crmStatus as CrmStatus} />
      </div>
      <div style={{ fontSize: 13, color: "#7D7366", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
        {lead.ownerName}
        {lead.whatsapp && <span style={{ color: "#25d366", fontSize: 12 }}>📱</span>}
        {lead.restaurantPlan && (
          <span style={{ fontSize: 10, fontWeight: 700, color: "#E8A33D", background: "rgba(232,163,61,.12)", border: "1px solid rgba(232,163,61,.3)", padding: "1px 6px", borderRadius: 10, letterSpacing: ".04em" }}>
            YA CLIENTE
          </span>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#7D7366" }}>{lead.cartaType} · {timeAgo(lead.createdAt)}</span>
        {hasFU && (
          <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 600 }}>● Seguimiento vencido</span>
        )}
        {lead.crmFollowUpAt && !hasFU && (
          <span style={{ fontSize: 11, color: "#E8A33D" }}>Contactar: {new Date(lead.crmFollowUpAt).toLocaleDateString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
        )}
      </div>
    </div>
  );
}

// ─── Main CRM ─────────────────────────────────────────────────────────────────
function CRMApp() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [tab, setTab] = useState<Tab>("nuevos");
  const [search, setSearch] = useState("");
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    fetch("/api/leads/list", { headers: { "x-leads-auth": PASSWORD } })
      .then(r => r.json())
      .then(d => { setLeads(d.leads || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const updateLead = useCallback((id: string, patch: Partial<Lead>) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
    setSelected(prev => prev?.id === id ? { ...prev, ...patch } : prev);
  }, []);

  const openLead = (lead: Lead) => {
    setSelected(lead);
    setShowPanel(true);
  };

  const closePanel = () => {
    setShowPanel(false);
    setTimeout(() => setSelected(null), 300);
  };

  const filtered = filterByTab(leads, tab).filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return l.localName.toLowerCase().includes(q)
      || l.ownerName.toLowerCase().includes(q)
      || l.email.toLowerCase().includes(q)
      || (l.whatsapp || "").includes(q);
  });

  // Tab counts
  const counts: Record<Tab, number> = {
    nuevos:        leads.filter(l => l.crmStatus === "nuevo").length,
    en_proceso:    leads.filter(l => l.crmStatus === "llamando" || l.crmStatus === "contactado").length,
    interesados:   leads.filter(l => l.crmStatus === "interesado").length,
    cerrados:      leads.filter(l => l.crmStatus === "cerrado").length,
    no_interesados:leads.filter(l => l.crmStatus === "no_interesado").length,
    todos:         leads.length,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0A0908", color: "#E8DDC8", fontFamily: "'Inter',sans-serif", fontWeight: 300 }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #3A342D; border-radius: 4px; }
        input[type=datetime-local]::-webkit-calendar-picker-indicator { filter: invert(.4); cursor: pointer; }
        input::placeholder, textarea::placeholder { color: #4A443D !important; opacity: 1; }
        @media (max-width: 768px) {
          .desktop-panel { display: none !important; }
          .mobile-panel-overlay { display: flex !important; }
        }
        @media (min-width: 769px) {
          .mobile-panel-overlay { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #3A342D", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, background: "rgba(10,9,8,.95)", backdropFilter: "blur(8px)", zIndex: 50 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="QuieroComer" style={{ height: 32, width: 32, objectFit: "contain", borderRadius: 6 }} />
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: "#E8DDC8", letterSpacing: ".01em" }}>QuieroComer</span>
            <span style={{ fontSize: 12, color: "#E8A33D", fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase" }}>Leads</span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", height: "calc(100vh - 65px)" }}>
        {/* List column */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", borderRight: "1px solid #3A342D" }}>
          {/* Search */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #3A342D" }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar local, dueño, email, teléfono…"
              style={{ width: "100%", padding: "10px 14px", background: "#1A1714", border: "1px solid #3A342D", color: "#E8DDC8", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none" }}
            />
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 0, overflowX: "auto", borderBottom: "1px solid #3A342D", flexShrink: 0 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: "10px 14px", background: "none", border: "none",
                borderBottom: `2px solid ${tab === t.id ? "#E8A33D" : "transparent"}`,
                color: tab === t.id ? "#E8A33D" : "#7D7366",
                fontSize: 13, fontWeight: tab === t.id ? 600 : 400, cursor: "pointer", whiteSpace: "nowrap",
                fontFamily: "inherit", transition: ".15s",
              }}>
                {t.label}
                {counts[t.id] > 0 && (
                  <span style={{ marginLeft: 5, fontSize: 11, background: tab === t.id ? "rgba(232,163,61,.2)" : "#3A342D", color: tab === t.id ? "#E8A33D" : "#7D7366", padding: "1px 6px", borderRadius: 10 }}>
                    {counts[t.id]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Lead list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 40, color: "#7D7366" }}>Cargando…</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#7D7366" }}>
                {search ? "Sin resultados" : "Sin leads en este estado"}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {filtered.map(l => (
                  <LeadCard key={l.id} lead={l} selected={selected?.id === l.id} onClick={() => openLead(l)} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Desktop panel */}
        <div className="desktop-panel" style={{ width: 420, flexShrink: 0, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {selected ? (
            <LeadPanel lead={selected} onClose={closePanel} onUpdate={updateLead} />
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#3A342D", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 32 }}>👈</div>
              <div style={{ fontSize: 14 }}>Selecciona un lead</div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile panel overlay */}
      <div className="mobile-panel-overlay" style={{
        display: "none", position: "fixed", inset: 0, background: "#0A0908", zIndex: 100,
        flexDirection: "column",
        transform: showPanel ? "translateX(0)" : "translateX(100%)",
        transition: "transform .3s ease",
      }}>
        {selected && <LeadPanel lead={selected} onClose={closePanel} onUpdate={updateLead} />}
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function LeadsPage() {
  const [auth, setAuth] = useState<boolean | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(AUTH_KEY);
    setAuth(stored === PASSWORD);
  }, []);

  if (auth === null) return null; // avoid hydration flash
  if (!auth) return <PasswordScreen onAuth={() => setAuth(true)} />;
  return <CRMApp />;
}
