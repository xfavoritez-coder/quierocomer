"use client";
import { useState, useEffect, useMemo } from "react";
import { STAGE_META, ENGAGEMENT_CRITERIA, type LifecycleStage } from "@/lib/admin/lifecycle";

const F = "var(--font-display)";
const GOLD = "#F4A623";

type Stage = LifecycleStage;

const STAGE_FILTERS: { key: string; label: string; stages: Stage[] }[] = [
  { key: "todos",     label: "Todos",        stages: [] },
  { key: "leads",     label: "Leads",        stages: ["LEAD_PROCESANDO", "LEAD_FALLIDO", "LEAD_NO_VIO", "LEAD_VIO_NO_ACTIVO"] },
  { key: "trial",     label: "Trial",        stages: ["TRIAL_USANDO", "TRIAL_ACTIVO", "TRIAL_DORMIDO"] },
  { key: "activos",   label: "Activos",      stages: ["ACTIVO", "BONIFICADO"] },
  { key: "dormidos",  label: "Dormidos",     stages: ["DORMIDO", "ACTIVADO_SIN_USO", "TRIAL_DORMIDO"] },
  { key: "vencidos",  label: "Vencidos",     stages: ["TRIAL_VENCIDO"] },
  { key: "demo",      label: "Demo",         stages: ["DEMO"] },
];

interface Entry {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  owner: { name: string; email: string; whatsapp: string | null } | null;
  stage: Stage;
  engagement: number;
  engagementChecks: boolean[];
  lastActivity: string | null;
  salud: string;
  plan: string;
  sessions7d: number;
  totalSessions: number;
  dishes: number;
  categories: number;
  createdAt: string;
  trialDaysLeft: number | null;
  leadId: string | null;
  leadOwner: string | null;
  leadEmail: string | null;
  leadWhatsapp: string | null;
  nurturingSent: { action: string; date: string }[];
  ownerId: string | null;
  cartaOriginalUrl: string | null;
  cartaType: string | null;
  leadTimeline: { deliveredAt: string | null; emailOpenedAt: string | null; emailClickedAt: string | null; activatedAt: string | null } | null;
  emailsSent: { purpose: string; status: string; openedAt: string | null; clickedAt: string | null; createdAt: string }[];
  recentActivity: { action: string; createdAt: string }[];
}

interface Stats {
  total: number; leads: number; enTrial: number; activos: number;
  dormidos: number; vencidos: number; tasaActivacion: number;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "Nunca";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `Hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `Hace ${days}d`;
  return `Hace ${Math.floor(days / 30)}mes`;
}

function getInitials(name: string) {
  return name.split(" ").map(w => w[0] || "").join("").slice(0, 2).toUpperCase();
}

const SALUD_COLORS: Record<string, string> = { green: "#4ade80", yellow: "#fbbf24", red: "#f87171", gray: "#555" };
const SALUD_LABELS: Record<string, string> = { green: "Activo", yellow: "Tibio", red: "Dormido", gray: "Sin owner" };

const ACTION_LABELS: Record<string, string> = {
  panel_login: "Inicio sesión", panel_visit: "Visitó panel", dish_edit: "Editó plato",
  dish_create: "Creó plato", dish_delete: "Eliminó plato", photo_upload: "Subió foto",
  category_edit: "Editó categoría", category_create: "Creó categoría",
  promo_create: "Creó oferta", promo_edit: "Editó oferta", settings_change: "Cambió config",
  announcement_create: "Creó anuncio", menu_import: "Importó carta",
  nurturing_carta_no_revisada: "WA Camila: carta no revisada",
  nurturing_vio_no_activo: "WA Camila: vio, no activó",
  nurturing_no_volvio: "WA Camila: no volvió",
};

export default function LifecyclePage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "owner" | "stage" | "engagement" | "lastActivity" | "salud" | "createdAt">("lastActivity");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    fetch("/api/admin/lifecycle").then(r => r.json()).then(data => {
      setEntries(data.entries || []);
      setStats(data.stats || null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const SALUD_ORDER: Record<string, number> = { green: 0, yellow: 1, red: 2, gray: 3 };

  const filtered = useMemo(() => {
    let list = entries;
    const sf = STAGE_FILTERS.find(f => f.key === filter);
    if (sf && sf.stages.length > 0) list = list.filter(e => sf.stages.includes(e.stage));
    if (search) {
      const q = norm(search);
      list = list.filter(e =>
        norm(e.name).includes(q) ||
        norm(e.owner?.name || "").includes(q) ||
        norm(e.owner?.email || "").includes(q) ||
        norm(e.leadOwner || "").includes(q) ||
        norm(e.leadEmail || "").includes(q)
      );
    }
    const dir = sortDir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case "name": return dir * a.name.localeCompare(b.name);
        case "owner": return dir * (a.owner?.name || a.leadOwner || "zzz").localeCompare(b.owner?.name || b.leadOwner || "zzz");
        case "stage": return dir * a.stage.localeCompare(b.stage);
        case "engagement": return dir * (a.engagement - b.engagement);
        case "lastActivity": {
          const ta = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
          const tb = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
          return dir * (ta - tb);
        }
        case "salud": return dir * ((SALUD_ORDER[a.salud] ?? 9) - (SALUD_ORDER[b.salud] ?? 9));
        case "createdAt": return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        default: return 0;
      }
    });
    return list;
  }, [entries, filter, search, sortBy, sortDir]);

  const statCards = stats ? [
    { label: "Total", value: stats.total, color: "#fff" },
    { label: "Leads", value: stats.leads, color: "#60a5fa" },
    { label: "En Trial", value: stats.enTrial, color: "#a855f7" },
    { label: "Activos", value: stats.activos, color: "#4ade80" },
    { label: "Dormidos", value: stats.dormidos, color: "#f87171" },
    { label: "Tasa Activación", value: `${stats.tasaActivacion}%`, color: GOLD },
  ] : [];

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#888" }}>Cargando...</div>;


  return (
    <div style={{ padding: "0 0 40px" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: F, fontSize: 28, fontWeight: 500, color: "#fff", margin: "0 0 4px", letterSpacing: "-0.02em" }}>
          Lifecycle
        </h1>
        <p style={{ color: "#888", fontSize: 13, margin: 0 }}>Vista unificada de leads, clientes y su estado actual</p>
      </div>

      {/* Stats cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 20 }}>
        {statCards.map(s => (
          <div key={s.label} style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color, fontFamily: F }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters + Search */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        {STAGE_FILTERS.map(f => {
          const count = f.stages.length === 0 ? entries.length : entries.filter(e => f.stages.includes(e.stage)).length;
          const active = filter === f.key;
          return (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{
              padding: "6px 14px", borderRadius: 99, border: "1px solid", fontSize: 12, fontWeight: 600, cursor: "pointer",
              background: active ? "rgba(244,166,35,.15)" : "transparent",
              borderColor: active ? GOLD : "#2a2a2a",
              color: active ? GOLD : "#888",
            }}>
              {f.label} <span style={{ opacity: 0.6, marginLeft: 4 }}>{count}</span>
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <input
          placeholder="Buscar..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: 200, height: 34, borderRadius: 8, border: "1px solid #2a2a2a", background: "#1a1a1a",
            color: "#fff", padding: "0 12px", fontSize: 13, outline: "none",
          }}
        />
      </div>

      {/* Table */}
      <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 14, overflow: "hidden" }}>
        {/* Header row */}
        <div style={{
          display: "grid", gridTemplateColumns: "2fr 1.3fr 1fr 1.1fr 0.7fr 0.5fr 0.7fr",
          padding: "10px 16px", borderBottom: "1px solid #2a2a2a", fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.05em",
        }}>
          {([
            { key: "name", label: "Restaurante" },
            { key: "owner", label: "Owner" },
            { key: "stage", label: "Estado" },
            { key: "engagement", label: "Engagement" },
            { key: "lastActivity", label: "Actividad" },
            { key: "salud", label: "Salud" },
            { key: "createdAt" as const, label: "Registro" },
          ] as { key: "name" | "owner" | "stage" | "engagement" | "lastActivity" | "salud" | "createdAt"; label: string }[]).map(col => (
            <span
              key={col.key}
              onClick={() => { if (sortBy === col.key) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortBy(col.key); setSortDir("desc"); } }}
              style={{ cursor: "pointer", color: sortBy === col.key ? GOLD : "#666", userSelect: "none" }}
            >
              {col.label} {sortBy === col.key ? (sortDir === "asc" ? "▲" : "▼") : ""}
            </span>
          ))}
        </div>

        {filtered.map(entry => {
          const ownerName = entry.owner?.name || entry.leadOwner || null;
          const ownerEmail = entry.owner?.email || entry.leadEmail || null;
          const ownerWa = entry.owner?.whatsapp || entry.leadWhatsapp || null;
          const meta = STAGE_META[entry.stage] || STAGE_META.DEMO;

          return (
          <div key={entry.id}>
            {/* Row */}
            <div
              onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
              style={{
                display: "grid", gridTemplateColumns: "2fr 1.3fr 1fr 1.1fr 0.7fr 0.5fr 0.7fr",
                padding: "12px 16px", borderBottom: "1px solid #1f1f1f", cursor: "pointer",
                background: expanded === entry.id ? "#141414" : "transparent",
                transition: "background 0.15s",
              }}
            >
              {/* Restaurant */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {entry.logoUrl ? (
                  <img src={entry.logoUrl} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "#2a2a2a", fontSize: 11, fontWeight: 700, color: "#888", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    {getInitials(entry.name)}
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{entry.name}</div>
                  <div style={{ fontSize: 11, color: "#666" }}>{entry.slug}</div>
                </div>
              </div>

              {/* Owner */}
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                {ownerName ? (
                  <>
                    <div style={{ fontSize: 13, color: "#ccc" }}>{ownerName}</div>
                    <div style={{ fontSize: 11, color: "#666" }}>{ownerEmail}</div>
                  </>
                ) : (
                  <span style={{ fontSize: 12, color: "#555" }}>Sin owner</span>
                )}
              </div>

              {/* Stage badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600,
                  background: meta.bg, color: meta.color,
                }}>
                  {meta.label}{entry.trialDaysLeft != null ? ` · ${entry.trialDaysLeft}d` : ""}
                </span>
                {entry.nurturingSent?.length > 0 && (
                  <span title={`WA enviado: ${entry.nurturingSent.map(n => n.action.replace("nurturing_", "")).join(", ")}`} style={{ fontSize: 13, cursor: "help" }}>💬</span>
                )}
              </div>

              {/* Engagement bar */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#2a2a2a", overflow: "hidden" }}>
                  <div style={{
                    width: `${entry.engagement}%`, height: "100%", borderRadius: 3,
                    background: entry.engagement >= 70 ? "#4ade80" : entry.engagement >= 40 ? "#fbbf24" : "#f87171",
                    transition: "width 0.3s",
                  }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#999", minWidth: 32 }}>{entry.engagement}%</span>
              </div>

              {/* Last activity */}
              <div style={{ display: "flex", alignItems: "center", fontSize: 12, color: "#888" }}>
                {timeAgo(entry.lastActivity)}
              </div>

              {/* Health dot */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: SALUD_COLORS[entry.salud] || "#555" }} />
                <span style={{ fontSize: 11, color: "#666" }}>{SALUD_LABELS[entry.salud] || ""}</span>
              </div>

              {/* Registro */}
              <div style={{ display: "flex", alignItems: "center", fontSize: 11, color: "#888" }}>
                {new Date(entry.createdAt).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
              </div>
            </div>

            {/* Expanded detail */}
            {expanded === entry.id && (
              <div style={{ padding: "16px 20px 20px", borderBottom: "1px solid #2a2a2a", background: "#141414" }}>
                <button onClick={(e) => { e.stopPropagation(); setExpanded(null); }} style={{
                  background: "none", border: "none", color: "#888", fontSize: 12, cursor: "pointer", padding: "0 0 12px", display: "flex", alignItems: "center", gap: 4,
                }}>← Volver</button>
                {/* Quick info */}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                  <MiniCard label="Plan" value={entry.plan} />
                  <MiniCard label="Platos" value={String(entry.dishes)} />
                  <MiniCard label="Categorías" value={String(entry.categories)} />
                  <MiniCard label="Sesiones 7d" value={String(entry.sessions7d)} highlight={entry.sessions7d > 0} />
                  <MiniCard label="Sesiones total" value={String(entry.totalSessions)} highlight={entry.totalSessions > 0} />
                  <MiniCard label="Registrado" value={new Date(entry.createdAt).toLocaleDateString("es-CL", { day: "numeric", month: "short" })} />
                  {ownerWa && <MiniCard label="WhatsApp" value={ownerWa} />}
                </div>

                {/* Engagement breakdown */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                    Engagement ({entry.engagement}%)
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {ENGAGEMENT_CRITERIA.map((label, i) => (
                      <span key={label} style={{
                        padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 500,
                        background: entry.engagementChecks[i] ? "rgba(74,222,128,.1)" : "rgba(255,255,255,.04)",
                        color: entry.engagementChecks[i] ? "#4ade80" : "#555",
                        border: `1px solid ${entry.engagementChecks[i] ? "rgba(74,222,128,.2)" : "#2a2a2a"}`,
                      }}>
                        {entry.engagementChecks[i] ? "✓" : "·"} {label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Nurturing sent */}
                {entry.nurturingSent?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                      WhatsApp enviados por Camila
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {entry.nurturingSent.map((n, i) => (
                        <span key={i} style={{
                          padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 500,
                          background: "rgba(34,211,238,.08)", color: "#22d3ee",
                          border: "1px solid rgba(34,211,238,.2)",
                        }}>
                          💬 {ACTION_LABELS[n.action] || n.action.replace("nurturing_", "")} · {new Date(n.date).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent activity timeline */}
                {entry.recentActivity.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                      Actividad reciente
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {entry.recentActivity.slice(0, 8).map((a, i) => (
                        <div key={i} style={{ display: "flex", gap: 8, fontSize: 12 }}>
                          <span style={{ color: "#555", minWidth: 90 }}>{new Date(a.createdAt).toLocaleDateString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                          <span style={{ color: "#999" }}>{ACTION_LABELS[a.action] || a.action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Email/WA communication history */}
                {(entry.leadTimeline || entry.emailsSent?.length > 0 || entry.nurturingSent?.length > 0) && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                      Comunicaciones
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {(() => {
                        const purposeLabels: Record<string, string> = {
                          activation_welcome: "Bienvenida", funnel_carta_lista: "Carta lista",
                          funnel_carta_ready: "Carta lista", trial_reminder: "Trial reminder",
                          trial_expired: "Trial vencido", plan_activated: "Plan activado",
                          weekly_summary: "Informe semanal", lead_failure_help: "Ayuda carta falló",
                          reset_password: "Reset contraseña", reactivation: "Reactivación",
                        };
                        // Collect all comms into one array with dates for sorting
                        const comms: { date: string; node: React.ReactNode }[] = [];
                        if (entry.leadTimeline?.deliveredAt) comms.push({ date: entry.leadTimeline.deliveredAt, node: <CommBadge key="ld" icon="📧" label="Email enviado" date={entry.leadTimeline.deliveredAt} color="#60a5fa" /> });
                        if (entry.leadTimeline?.emailOpenedAt) comms.push({ date: entry.leadTimeline.emailOpenedAt, node: <CommBadge key="lo" icon="👁" label="Email abierto" date={entry.leadTimeline.emailOpenedAt} color="#4ade80" /> });
                        if (entry.leadTimeline?.emailClickedAt) comms.push({ date: entry.leadTimeline.emailClickedAt, node: <CommBadge key="lc" icon="👆" label="Click en email" date={entry.leadTimeline.emailClickedAt} color="#4ade80" /> });
                        if (entry.leadTimeline?.activatedAt) comms.push({ date: entry.leadTimeline.activatedAt, node: <CommBadge key="la" icon="🟢" label="Activó" date={entry.leadTimeline.activatedAt} color="#4ade80" /> });
                        entry.nurturingSent?.forEach((n, i) => comms.push({ date: n.date, node: <CommBadge key={`n${i}`} icon="💬" label={ACTION_LABELS[n.action] || n.action.replace("nurturing_", "")} date={n.date} color="#22d3ee" /> }));
                        entry.emailsSent?.forEach((e, i) => comms.push({ date: e.createdAt, node: <CommBadge key={`e${i}`} icon={e.openedAt ? "📬" : "📧"} label={purposeLabels[e.purpose] || e.purpose} date={e.createdAt} color={e.openedAt ? "#4ade80" : "#60a5fa"} extra={e.clickedAt ? "click" : e.openedAt ? "abierto" : ""} /> }));
                        comms.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                        if (comms.length === 0) return <span style={{ fontSize: 11, color: "#555" }}>Sin comunicaciones registradas</span>;
                        return comms.map((c, i) => <div key={i}>{c.node}</div>);
                      })()}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <ActionBtn label="👁 Ver carta" onClick={() => window.open(`/qr/${entry.slug}`, "_blank")} />
                  {entry.cartaOriginalUrl && (
                    <ActionBtn label={`📄 Ver original (${entry.cartaType === "LINK" ? "link" : entry.cartaType === "DOCUMENT" ? "PDF" : "foto"})`} onClick={() => window.open(entry.cartaOriginalUrl!, "_blank")} />
                  )}
                  {entry.ownerId && (
                    <ActionBtn label="🔑 Entrar como él" onClick={async () => {
                      const res = await fetch("/api/admin/impersonate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ownerId: entry.ownerId }) });
                      if (res.ok) window.open("/panel", "_blank");
                      else alert("Error al entrar como owner");
                    }} />
                  )}
                  {ownerWa && entry.nurturingSent?.length > 0 && (
                    <ChatModalBtn phone={ownerWa} name={entry.name} />
                  )}
                  {(ownerEmail || ownerWa) && (
                    <SendMessageBtn restaurantId={entry.id} ownerName={ownerName || "Dueño"} ownerEmail={ownerEmail} ownerWa={ownerWa} />
                  )}
                </div>
              </div>
            )}
          </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "#555", fontSize: 14 }}>Sin resultados</div>
        )}
      </div>
    </div>
  );
}

function MiniCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, padding: "8px 14px", minWidth: 80 }}>
      <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: highlight ? "#4ade80" : "#ccc", marginTop: 2 }}>{value}</div>
    </div>
  );
}

function ActionBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} style={{
      padding: "6px 14px", borderRadius: 8, border: "1px solid #2a2a2a", background: "transparent",
      color: "#999", fontSize: 12, fontWeight: 500, cursor: "pointer",
    }}>
      {label}
    </button>
  );
}

function CommBadge({ icon, label, date, color, extra }: { icon: string; label: string; date: string; color: string; extra?: string }) {
  return (
    <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 500, background: `${color}12`, color, border: `1px solid ${color}30`, display: "inline-flex", alignItems: "center", gap: 4 }}>
      {icon} {label} · {new Date(date).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
      {extra && <span style={{ opacity: 0.7 }}>· {extra}</span>}
    </span>
  );
}

const EMAIL_TEMPLATES = [
  { key: "bienvenida", label: "Bienvenida + credenciales", desc: "Email con datos de acceso y link al panel" },
  { key: "carta_lista", label: "Tu carta esta lista", desc: "Notificacion de que su carta QR fue creada" },
  { key: "trial_por_vencer", label: "Trial por vencer", desc: "Aviso de que quedan pocos dias de prueba" },
  { key: "trial_vencido", label: "Trial vencido", desc: "Su prueba Premium termino, opciones de plan" },
  { key: "reset_password", label: "Recuperar contraseña", desc: "Link para resetear contraseña" },
];
const WA_TEMPLATES = [
  { key: "carta_lista", label: "Tu carta esta lista", desc: "Template aprobado: carta lista con link" },
  { key: "carta_fallo", label: "No pudimos procesar tu carta", desc: "Template aprobado: pedir que reintente" },
  { key: "camila_carta_no_revisada", label: "Camila: carta no revisada", desc: "Soy Camila, tu carta esta lista pero no la revisaste" },
  { key: "camila_no_volvio", label: "Camila: no volviste", desc: "Soy Camila, activaste pero no volviste" },
  { key: "camila_trial_usado", label: "Camila: trial terminó", desc: "Soy Camila, tu trial terminó" },
];

function ChatModalBtn({ phone, name }: { phone: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ direction: string; body: string; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const loadChat = () => {
    setOpen(true);
    setLoading(true);
    fetch(`/api/admin/whatsapp/conversations?phone=${encodeURIComponent(phone)}`).then(r => r.json()).then(data => {
      setMessages(data.messages || []);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  return (
    <>
      <ActionBtn label="💬 Ver chat WA" onClick={loadChat} />
      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 0 }} onClick={() => setOpen(false)}>
          <style>{`
            @media (min-width: 641px) {
              .lc-chat-modal { max-width: 420px !important; max-height: 85vh !important; margin: auto !important; border-radius: 16px !important; }
            }
          `}</style>
          <div className="lc-chat-modal" style={{ background: "#111", width: "100%", height: "100%", maxHeight: "100vh", display: "flex", flexDirection: "column", borderRadius: 0 }} onClick={e => e.stopPropagation()}>
            {/* WhatsApp-style header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#1a1a1a", borderBottom: "1px solid #222", flexShrink: 0 }}>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 18, padding: "2px 6px" }}>←</button>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#0a3d20", color: "#22c55e", fontWeight: 800, fontSize: 14, display: "grid", placeItems: "center", flexShrink: 0 }}>
                {(name || "?").charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                <div style={{ fontSize: 11, color: "#22c55e" }}>🤖 Camila IA</div>
              </div>
            </div>
            {/* Messages */}
            <div style={{
              flex: 1, overflowY: "auto", padding: "10px 8px 16px", display: "flex", flexDirection: "column", gap: 3,
              background: "#0b0b0b",
              backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.015'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
            }}>
              {loading ? (
                <div style={{ textAlign: "center", color: "#666", padding: 20, fontSize: 13 }}>Cargando...</div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: "center", color: "#555", padding: 20, fontSize: 13 }}>Sin mensajes</div>
              ) : (
                messages.map((m, i) => {
                  const isOut = m.direction === "OUTBOUND";
                  const isNurturing = isOut && m.body.includes("Camila de QuieroComer");
                  const isTemplate = isOut && !isNurturing && (m.body.includes("QuieroComer.cl") || m.body.includes("quierocomer.cl/api/funnel"));
                  const isAI = isOut && !isNurturing && !isTemplate;
                  const prev = messages[i - 1];
                  const showDate = !prev || new Date(m.createdAt).toDateString() !== new Date(prev.createdAt).toDateString();
                  return (
                    <div key={i}>
                      {showDate && (
                        <div style={{ textAlign: "center", margin: "8px 0 4px" }}>
                          <span style={{ fontSize: 10, color: "#888", background: "#1a1a1a", padding: "3px 12px", borderRadius: 8 }}>
                            {new Date(m.createdAt).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                          </span>
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: isOut ? "flex-end" : "flex-start" }}>
                        <div style={{
                          maxWidth: "85%", padding: "6px 8px 4px", borderRadius: 8,
                          borderTopRightRadius: isOut ? 2 : 8,
                          borderTopLeftRadius: isOut ? 8 : 2,
                          background: isNurturing ? "rgba(168,85,247,0.08)" : isAI ? "rgba(34,197,94,0.06)" : isOut ? "#0a3d20" : "#1a1a1a",
                          border: isNurturing ? "1px solid rgba(168,85,247,0.15)" : isAI ? "1px solid rgba(34,197,94,0.1)" : "none",
                        }}>
                          {isNurturing && <div style={{ fontSize: 9, color: "#a855f7", fontWeight: 700, marginBottom: 2 }}>📨 Nurturing</div>}
                          {isTemplate && <div style={{ fontSize: 9, color: "#888", fontWeight: 700, marginBottom: 2 }}>📋 Template</div>}
                          {isAI && <div style={{ fontSize: 9, color: "#22c55e", fontWeight: 700, marginBottom: 2 }}>🤖 Camila IA</div>}
                          <div style={{ fontSize: 14, color: "#e0e0e0", lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.body}</div>
                          <div style={{ fontSize: 9, color: "#5a5a5a", textAlign: "right", marginTop: 1 }}>
                            {new Date(m.createdAt).toLocaleString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SendMessageBtn({ restaurantId, ownerName, ownerEmail, ownerWa }: { restaurantId: string; ownerName: string; ownerEmail: string | null; ownerWa: string | null }) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<"email" | "whatsapp">(ownerWa ? "whatsapp" : "email");
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const templates = channel === "email" ? EMAIL_TEMPLATES : WA_TEMPLATES;

  const handleSend = async (templateKey: string) => {
    setSending(templateKey);
    try {
      const res = await fetch("/api/admin/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, template: templateKey, restaurantId }),
      });
      const data = await res.json();
      if (res.ok) {
        setSent(templateKey);
        setTimeout(() => { setSent(null); setOpen(false); }, 2000);
      } else alert(data.error || "Error al enviar");
    } catch { alert("Error de conexion"); }
    setSending(null);
  };

  return (
    <>
      <ActionBtn label="📨 Enviar mensaje" onClick={() => setOpen(true)} />
      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => { if (!sending) setOpen(false); }}>
          <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 20, width: "100%", maxWidth: 400, padding: "24px 20px" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0 }}>Enviar mensaje</h3>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>
            <p style={{ fontSize: 12, color: "#888", margin: "0 0 4px" }}>Para: <strong style={{ color: "#ccc" }}>{ownerName}</strong></p>
            <p style={{ fontSize: 11, color: "#666", margin: "0 0 14px" }}>{channel === "email" ? ownerEmail : ownerWa}</p>

            {/* Channel toggle */}
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {ownerEmail && (
                <button onClick={() => setChannel("email")} style={{
                  padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  background: channel === "email" ? "rgba(244,166,35,.15)" : "transparent",
                  border: `1px solid ${channel === "email" ? GOLD : "#2a2a2a"}`,
                  color: channel === "email" ? GOLD : "#888",
                }}>📧 Email</button>
              )}
              {ownerWa && (
                <button onClick={() => setChannel("whatsapp")} style={{
                  padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  background: channel === "whatsapp" ? "rgba(34,211,238,.15)" : "transparent",
                  border: `1px solid ${channel === "whatsapp" ? "#22d3ee" : "#2a2a2a"}`,
                  color: channel === "whatsapp" ? "#22d3ee" : "#888",
                }}>💬 WhatsApp</button>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {templates.map(t => (
                <button key={t.key} onClick={() => handleSend(t.key)} disabled={!!sending} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                  padding: "10px 12px", background: sent === t.key ? "rgba(74,222,128,.08)" : "#111",
                  border: `1px solid ${sent === t.key ? "#4ade80" : "#2a2a2a"}`,
                  borderRadius: 10, cursor: sending ? "wait" : "pointer", textAlign: "left", width: "100%",
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: sent === t.key ? "#4ade80" : "#ddd", marginBottom: 2 }}>
                      {sent === t.key ? "✓ Enviado" : t.label}
                    </div>
                    <div style={{ fontSize: 11, color: "#666" }}>{t.desc}</div>
                  </div>
                  {sending === t.key && <span style={{ fontSize: 11, color: "#666" }}>...</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
