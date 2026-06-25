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
  billingExempt: boolean;
  subscriptionStatus: string;
  mpPayerEmail: string | null;
  currentPeriodEnd: string | null;
  lastPaymentAt: string | null;
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
  recentActivity: { action: string; details?: any; createdAt: string }[];
  leadEvents: any[];
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
  plan_modal_opened: "Abrió modal de planes",
  plan_tab_viewed: "Vio plan",
  plan_subscribe_clicked: "Intentó suscribirse",
  plan_page_visited: "Visitó suscripción",
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

                {/* Timeline visual */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Timeline
                    </div>
                    <ActivityBtn restaurantId={entry.id} name={entry.name} />
                  </div>
                  <TimelineSection entry={entry} />
                </div>

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

                {/* Plan & Billing */}
                <PlanActions entry={entry} onUpdate={(updates) => {
                  setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, ...updates } : e));
                }} />

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

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

const DOT_COLORS: Record<string, string> = { gold: GOLD, green: "#4ade80", blue: "#60a5fa", purple: "#a855f7", red: "#f87171" };

function TimelineSection({ entry }: { entry: Entry }) {
  const items: { time: string; text: string; dot: string }[] = [];

  // Lead events
  if (entry.leadEvents?.length > 0) {
    for (const ev of entry.leadEvents) {
      const action = ev.action || "";
      const ts = ev.ts || "";
      let text = action;
      if (action === "paso1_completed") text = `Subio carta via ${ev.mode || "link"}`;
      else if (action === "paso2_loaded") text = "Cargo formulario paso 2";
      else if (action === "paso2_completed") text = "Completo datos (email, nombre)";
      else if (action === "confirmacion_loaded") text = "Vio confirmacion";
      else if (action === "carta_ready") text = "Carta lista";
      else if (action === "onboard_start") text = "Inicio onboarding";
      else if (action === "onboard_done") text = "Completo onboarding (6/6)";
      else if (action.startsWith("onboard_step")) text = `Onboarding paso ${ev.stepName || ""}`;
      else if (action === "panel_visit") text = `Visito panel: ${ev.section || ""}`;
      else if (action === "email_failure_sent") text = `Email de ayuda enviado`;
      else if (action === "wa_fail_template_sent") text = "WhatsApp de fallo enviado";
      items.push({ time: ts, text, dot: action.includes("done") || action.includes("ready") ? "green" : action.includes("fail") ? "red" : "blue" });
    }
  }

  // Lead timeline milestones
  if (entry.leadTimeline) {
    const lt = entry.leadTimeline;
    if (lt.deliveredAt) items.push({ time: lt.deliveredAt, text: "Email carta lista enviado", dot: "gold" });
    if (lt.emailOpenedAt) items.push({ time: lt.emailOpenedAt, text: "Email abierto", dot: "green" });
    if (lt.emailClickedAt) items.push({ time: lt.emailClickedAt, text: "Click en email", dot: "green" });
    if (lt.activatedAt) items.push({ time: lt.activatedAt, text: "Activo plan", dot: "gold" });
  }

  // Panel activity
  for (const a of entry.recentActivity) {
    const label = ACTION_LABELS[a.action] || a.action;
    const d = a.details && typeof a.details === "object" ? a.details : {};
    const detail = d.dishName || d.name || d.section || "";
    items.push({ time: a.createdAt, text: `${label}${detail ? `: ${detail}` : ""}`, dot: a.action.includes("nurturing") ? "purple" : "" });
  }

  // Nurturing
  for (const n of entry.nurturingSent || []) {
    items.push({ time: n.date, text: ACTION_LABELS[n.action] || n.action, dot: "purple" });
  }

  // Emails
  for (const e of entry.emailsSent || []) {
    const purposeLabels: Record<string, string> = {
      activation_welcome: "Email bienvenida", funnel_carta_lista: "Email carta lista",
      trial_reminder: "Email trial reminder", trial_expired: "Email trial vencido",
      weekly_summary: "Informe semanal", lead_failure_help: "Email ayuda carta fallo",
      reactivation: "Email reactivacion",
    };
    items.push({ time: e.createdAt, text: `${purposeLabels[e.purpose] || e.purpose} · ${e.status === "sent" ? "entregado" : "fallo"}`, dot: e.status === "sent" ? "gold" : "red" });
    if (e.openedAt) items.push({ time: e.openedAt, text: "Email abierto", dot: "green" });
    if (e.clickedAt) items.push({ time: e.clickedAt, text: "Click en email", dot: "green" });
  }

  // Registration
  items.push({ time: entry.createdAt, text: `Registro · Plan ${entry.plan}`, dot: "purple" });

  items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return (
    <div style={{ position: "relative", paddingLeft: 24, maxHeight: 400, overflowY: "auto" }}>
      <div style={{ position: "absolute", left: 7, top: 4, bottom: 4, width: 1, background: "#2a2a2a" }} />
      {items.map((item, i) => (
        <div key={i} style={{ position: "relative", paddingBottom: 14 }}>
          <div style={{
            position: "absolute", left: -20, top: 3, width: 10, height: 10, borderRadius: "50%",
            border: `2px solid ${DOT_COLORS[item.dot] || "#2a2a2a"}`,
            background: item.dot ? DOT_COLORS[item.dot] : "#1a1a1a",
          }} />
          <div style={{ fontSize: 10, color: "#666", marginBottom: 2 }}>{fmtDate(item.time)}</div>
          <div style={{ fontSize: 13, color: "#bbb" }}>{item.text}</div>
        </div>
      ))}
      {items.length === 0 && <div style={{ color: "#555", fontSize: 13, padding: "10px 0" }}>Sin actividad registrada.</div>}
    </div>
  );
}

function ActivityModal({ restaurantId, name, onClose }: { restaurantId: string; name: string; onClose: () => void }) {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/actividad/${restaurantId}?limit=50`)
      .then(r => r.json())
      .then(data => {
        setActivities(data.activities || []);
        setCursor(data.nextCursor || null);
        setHasMore(!!data.nextCursor);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [restaurantId]);

  const loadMore = async () => {
    if (!cursor) return;
    const res = await fetch(`/api/admin/actividad/${restaurantId}?limit=50&cursor=${cursor}`);
    const data = await res.json();
    setActivities(prev => [...prev, ...(data.activities || [])]);
    setCursor(data.nextCursor || null);
    setHasMore(!!data.nextCursor);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 20, width: "100%", maxWidth: 560, maxHeight: "85vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #2a2a2a", flexShrink: 0 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0 }}>Actividad del panel</h3>
            <p style={{ fontSize: 12, color: "#888", margin: "2px 0 0" }}>{name}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 20 }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px 20px" }}>
          {loading ? (
            <div style={{ color: "#666", fontSize: 13, padding: "20px 0", textAlign: "center" }}>Cargando...</div>
          ) : activities.length === 0 ? (
            <div style={{ color: "#555", fontSize: 13, padding: "20px 0", textAlign: "center" }}>Sin acciones registradas.</div>
          ) : (
            activities.map((a: any, i: number) => {
              const label = ACTION_LABELS[a.action] || a.action;
              const d = a.details && typeof a.details === "object" ? a.details : {};
              const parts: string[] = [];
              if (d.dishName) parts.push(d.dishName);
              if (d.categoryName || d.name) parts.push(d.categoryName || d.name);
              if (d.section) parts.push(`seccion: ${d.section}`);
              if (d.email) parts.push(d.email);
              if (d.price) parts.push(`$${Number(d.price).toLocaleString("es-CL")}`);
              if (d.fields && Array.isArray(d.fields)) parts.push(`campos: ${d.fields.join(", ")}`);
              if (d.fields && typeof d.fields === "object" && !Array.isArray(d.fields)) parts.push(`campos: ${Object.keys(d.fields).join(", ")}`);
              if (d.promoPrice) parts.push(`oferta: $${Number(d.promoPrice).toLocaleString("es-CL")}`);
              if (d.status) parts.push(`estado: ${d.status}`);
              if (d.defaultView) parts.push(`vista: ${d.defaultView}`);
              if (d.cartaColorMode) parts.push(`modo: ${d.cartaColorMode}`);
              if (d.cartaAccentColor) parts.push(`color: ${d.cartaAccentColor}`);
              if (d.waiterPanelActive !== undefined) parts.push(`garzon: ${d.waiterPanelActive ? "on" : "off"}`);
              if (d.showCategoryLobby !== undefined) parts.push(`lobby: ${d.showCategoryLobby ? "on" : "off"}`);
              if (d.panelTheme) parts.push(`tema panel: ${d.panelTheme}`);
              if (d.fileName) parts.push(d.fileName);
              if (d.text) parts.push(`"${String(d.text).slice(0, 50)}"`);
              const detail = parts.join(" · ");
              return (
                <div key={a.id || i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid #222" }}>
                  <div style={{ fontSize: 11, color: "#666", minWidth: 110, flexShrink: 0 }}>{fmtDate(a.createdAt)}</div>
                  <div style={{ fontSize: 13, color: "#bbb" }}>
                    <strong style={{ color: "#ddd" }}>{label}</strong>
                    {detail && <span style={{ marginLeft: 6, color: "#777", fontSize: 12 }}>{detail}</span>}
                  </div>
                </div>
              );
            })
          )}
          {hasMore && (
            <button onClick={loadMore} style={{
              padding: "8px 16px", marginTop: 10, borderRadius: 8, border: "1px solid #2a2a2a",
              background: "transparent", color: "#888", fontSize: 12, cursor: "pointer",
            }}>
              Ver más
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ActivityBtn({ restaurantId, name }: { restaurantId: string; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={(e) => { e.stopPropagation(); setOpen(true); }} style={{
        padding: "4px 10px", borderRadius: 6, border: "1px solid #2a2a2a", background: "transparent",
        color: "#888", fontSize: 11, fontWeight: 600, cursor: "pointer",
      }}>
        Ver toda la actividad
      </button>
      {open && <ActivityModal restaurantId={restaurantId} name={name} onClose={() => setOpen(false)} />}
    </>
  );
}

const PLAN_OPTIONS = ["FREE", "SILVER", "GOLD", "PREMIUM"] as const;
const PLAN_COLORS: Record<string, string> = { FREE: "#22c55e", SILVER: "#94a3b8", GOLD: "#F4A623", PREMIUM: "#7c3aed" };

function PlanActions({ entry, onUpdate }: { entry: Entry; onUpdate: (u: Partial<Entry>) => void }) {
  const [saving, setSaving] = useState(false);
  const [showPlanSelect, setShowPlanSelect] = useState(false);
  const [showManualPayment, setShowManualPayment] = useState(false);
  const [mpPlan, setMpPlan] = useState<string>(entry.plan === "FREE" ? "GOLD" : entry.plan);
  const [mpMethod, setMpMethod] = useState<string>("transfer");
  const [mpAmount, setMpAmount] = useState<string>("");
  const [mpNote, setMpNote] = useState("");
  const [showMpEmail, setShowMpEmail] = useState(false);
  const [mpEmailDraft, setMpEmailDraft] = useState(entry.mpPayerEmail || "");

  const updateRestaurant = async (fields: Record<string, any>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/locales/${entry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (res.ok) {
        onUpdate(fields as any);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Error al actualizar");
      }
    } catch { alert("Error de conexión"); }
    setSaving(false);
  };

  const registerManualPayment = async () => {
    if (!confirm(`Registrar pago manual de ${entry.name} — plan ${mpPlan} por ${mpMethod === "transfer" ? "transferencia" : mpMethod}?`)) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/manual-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: entry.id, plan: mpPlan, method: mpMethod, amount: mpAmount ? Number(mpAmount) : undefined, note: mpNote || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        onUpdate({ plan: mpPlan, subscriptionStatus: "ACTIVE", billingExempt: false, currentPeriodEnd: data.currentPeriodEnd, lastPaymentAt: new Date().toISOString() } as any);
        setShowManualPayment(false);
        setMpNote("");
      } else {
        alert(data.error || "Error al registrar pago");
      }
    } catch { alert("Error de conexión"); }
    setSaving(false);
  };

  const saveMpEmail = () => {
    const email = mpEmailDraft.trim() || null;
    updateRestaurant({ mpPayerEmail: email });
    onUpdate({ mpPayerEmail: email } as any);
    setShowMpEmail(false);
  };

  const periodLabel = entry.currentPeriodEnd
    ? new Date(entry.currentPeriodEnd).toLocaleDateString("es-CL", { day: "numeric", month: "short" })
    : null;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
        Plan y facturación
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {/* Current plan badge */}
        <span style={{
          padding: "4px 12px", borderRadius: 99, fontSize: 12, fontWeight: 700,
          background: `${PLAN_COLORS[entry.plan] || "#555"}18`,
          color: PLAN_COLORS[entry.plan] || "#555",
          border: `1px solid ${PLAN_COLORS[entry.plan] || "#555"}30`,
        }}>
          {entry.plan}
        </span>

        {/* Period end */}
        {periodLabel && (
          <span style={{ fontSize: 11, color: "#888" }}>
            hasta {periodLabel}
          </span>
        )}

        {/* Change plan */}
        {!showPlanSelect ? (
          <button onClick={(e) => { e.stopPropagation(); setShowPlanSelect(true); }} disabled={saving} style={{
            padding: "4px 10px", borderRadius: 6, border: "1px solid #2a2a2a", background: "transparent",
            color: "#888", fontSize: 11, fontWeight: 600, cursor: "pointer",
          }}>
            Cambiar plan
          </button>
        ) : (
          <div style={{ display: "flex", gap: 4, alignItems: "center" }} onClick={e => e.stopPropagation()}>
            {PLAN_OPTIONS.map(p => (
              <button key={p} onClick={() => {
                updateRestaurant({ plan: p });
                setShowPlanSelect(false);
              }} disabled={saving || p === entry.plan} style={{
                padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: p === entry.plan ? "default" : "pointer",
                background: p === entry.plan ? `${PLAN_COLORS[p]}20` : "transparent",
                border: `1px solid ${p === entry.plan ? PLAN_COLORS[p] : "#2a2a2a"}`,
                color: PLAN_COLORS[p],
                opacity: p === entry.plan ? 0.5 : 1,
              }}>
                {p}
              </button>
            ))}
            <button onClick={() => setShowPlanSelect(false)} style={{
              padding: "4px 8px", borderRadius: 6, border: "none", background: "transparent",
              color: "#555", fontSize: 11, cursor: "pointer",
            }}>✕</button>
          </div>
        )}

        {/* Bonificado toggle */}
        <button onClick={(e) => {
          e.stopPropagation();
          const next = !entry.billingExempt;
          if (next && !confirm(`Marcar ${entry.name} como bonificado? No se le cobrará.`)) return;
          updateRestaurant({ billingExempt: next });
        }} disabled={saving} style={{
          padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
          background: entry.billingExempt ? "rgba(74,222,128,.1)" : "transparent",
          border: entry.billingExempt ? "1px solid rgba(74,222,128,.3)" : "1px solid #2a2a2a",
          color: entry.billingExempt ? "#4ade80" : "#888",
        }}>
          {entry.billingExempt ? "Bonificado" : "Bonificar"}
        </button>

        {/* Registrar pago manual */}
        <button onClick={(e) => { e.stopPropagation(); setShowManualPayment(!showManualPayment); }} disabled={saving} style={{
          padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
          background: "rgba(96,165,250,.08)", border: "1px solid rgba(96,165,250,.25)", color: "#60a5fa",
        }}>
          Registrar pago
        </button>

      </div>

      {/* Manual payment form */}
      {showManualPayment && (
        <div onClick={e => e.stopPropagation()} style={{
          marginTop: 10, padding: 14, background: "#141414", border: "1px solid rgba(96,165,250,.2)",
          borderRadius: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center",
        }}>
          <select value={mpPlan} onChange={e => setMpPlan(e.target.value)} style={{
            height: 30, borderRadius: 6, border: "1px solid #2a2a2a", background: "#1a1a1a",
            color: "#fff", padding: "0 8px", fontSize: 12,
          }}>
            <option value="SILVER">Silver</option>
            <option value="GOLD">Gold</option>
            <option value="PREMIUM">Premium</option>
          </select>
          <select value={mpMethod} onChange={e => setMpMethod(e.target.value)} style={{
            height: 30, borderRadius: 6, border: "1px solid #2a2a2a", background: "#1a1a1a",
            color: "#fff", padding: "0 8px", fontSize: 12,
          }}>
            <option value="transfer">Transferencia</option>
            <option value="cash">Efectivo</option>
            <option value="other">Otro</option>
          </select>
          <input
            placeholder="Monto bruto CLP"
            value={mpAmount}
            onChange={e => setMpAmount(e.target.value.replace(/\D/g, ""))}
            style={{
              height: 30, borderRadius: 6, border: "1px solid #2a2a2a", background: "#1a1a1a",
              color: "#fff", padding: "0 8px", fontSize: 12, width: 110,
            }}
          />
          <input
            placeholder="Nota (opcional)"
            value={mpNote}
            onChange={e => setMpNote(e.target.value)}
            style={{
              height: 30, borderRadius: 6, border: "1px solid #2a2a2a", background: "#1a1a1a",
              color: "#fff", padding: "0 8px", fontSize: 12, width: 150,
            }}
          />
          <button onClick={registerManualPayment} disabled={saving} style={{
            height: 30, padding: "0 14px", borderRadius: 6, border: "none",
            background: "#60a5fa", color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}>
            {saving ? "..." : "Confirmar pago"}
          </button>
          <button onClick={() => setShowManualPayment(false)} style={{
            height: 30, padding: "0 8px", borderRadius: 6, border: "none",
            background: "transparent", color: "#555", fontSize: 11, cursor: "pointer",
          }}>✕</button>
        </div>
      )}

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
  { key: "confirmar_whatsapp", label: "Confirmar WhatsApp", desc: "Pide que actualice su numero de WhatsApp en el perfil" },
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
