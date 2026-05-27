"use client";
import { useState, useEffect, useMemo } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";

const F = "var(--font-display)";
const GOLD = "#F4A623";

interface Owner { name: string; email: string; whatsapp: string | null; }
interface Cliente {
  id: string; slug: string; name: string; logoUrl: string | null;
  plan: string; estado: string; trialDaysLeft: number | null;
  origen: string; salud: string; ultimaActividad: string | null;
  owner: Owner | null; ownerId: string | null;
  dishes: number; categories: number; sessions: number; sessions7d: number;
  menuImported: boolean; billingExempt: boolean; isDemo: boolean; createdAt: string;
  leadId: string | null; leadEvents: any[]; leadTimeline: any | null;
  recentActivity: { action: string; createdAt: string; details: any }[];
}
interface Stats { total: number; enTrial: number; trialExpireThisWeek: number; pagando: number; mrr: number; dormidos: number; tasaActivacion: number; }

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

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function getInitials(name: string) {
  return name.split(" ").map(w => w[0] || "").join("").slice(0, 2).toUpperCase();
}

const ESTADO_FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "TRIAL", label: "Trial" },
  { key: "ACTIVO", label: "Activo" },
  { key: "FREE", label: "Free" },
  { key: "TRIAL_VENCIDO", label: "Trial Vencido" },
  { key: "BONIFICADO", label: "Bonificado" },
  { key: "DEMO", label: "Demo" },
];
const ORIGEN_FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "SUBIR_CARTA", label: "Subir Carta" },
  { key: "PLANES", label: "Planes" },
  { key: "HANDOFF", label: "Handoff" },
];

const SORT_COLS = ["name", "estado", "origen", "plan", "ultimaActividad", "salud"] as const;
type SortCol = typeof SORT_COLS[number];

const ESTADO_BADGE: Record<string, { bg: string; color: string; label: (c: Cliente) => string }> = {
  TRIAL: { bg: "rgba(168,85,247,.15)", color: "#a855f7", label: c => `TRIAL · ${c.trialDaysLeft}d` },
  ACTIVO: { bg: "rgba(74,222,128,.12)", color: "#4ade80", label: () => "ACTIVO" },
  FREE: { bg: "rgba(255,255,255,.06)", color: "#999", label: () => "FREE" },
  TRIAL_VENCIDO: { bg: "rgba(255,255,255,.06)", color: "#999", label: () => "FREE" },
  BONIFICADO: { bg: "rgba(74,222,128,.08)", color: "#4ade80", label: () => "BONIFICADO" },
  DEMO: { bg: "rgba(96,165,250,.1)", color: "#60a5fa", label: () => "DEMO" },
};

const ORIGEN_BADGE: Record<string, { bg: string; color: string }> = {
  SUBIR_CARTA: { bg: "rgba(244,166,35,.1)", color: GOLD },
  PLANES: { bg: "rgba(96,165,250,.1)", color: "#60a5fa" },
  HANDOFF: { bg: "rgba(168,85,247,.1)", color: "#a855f7" },
};

const SALUD_COLORS: Record<string, string> = { green: "#4ade80", yellow: "#fbbf24", red: "#f87171", gray: "#555" };
const SALUD_LABELS: Record<string, string> = { green: "Activo", yellow: "Tibio", red: "Dormido", gray: "Sin owner" };

const ACTION_LABELS: Record<string, string> = {
  panel_login: "Inicio sesion", panel_visit: "Visito panel", dish_edit: "Edito plato",
  dish_create: "Creo plato", dish_delete: "Elimino plato", photo_upload: "Subio foto",
  category_edit: "Edito categoria", category_create: "Creo categoria", category_delete: "Elimino categoria",
  promo_create: "Creo oferta", promo_edit: "Edito oferta", settings_change: "Cambio config",
  announcement_create: "Creo anuncio",
  menu_import: "Importo carta",
  menu_import_failed: "Fallo importacion de carta",
};

export default function ClientesPage() {
  const { isSuper, loading: sessionLoading } = useAdminSession();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState("todos");
  const [filterOrigen, setFilterOrigen] = useState("todos");
  const [sortBy, setSortBy] = useState<SortCol>("ultimaActividad");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"timeline" | "metricas" | "panel" | "acciones">("timeline");
  const [togglingExempt, setTogglingExempt] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/clientes").then(r => r.json()).then(data => {
      setClientes(data.clientes || []);
      setStats(data.stats || null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const filtered = useMemo(() => {
    let list = clientes;
    if (filterEstado !== "todos") list = list.filter(c => c.estado === filterEstado);
    if (filterOrigen !== "todos") list = list.filter(c => c.origen === filterOrigen);
    if (search) {
      const q = norm(search);
      list = list.filter(c =>
        norm(c.name).includes(q) || norm(c.slug).includes(q) ||
        (c.owner && (norm(c.owner.email).includes(q) || norm(c.owner.name).includes(q) || (c.owner.whatsapp || "").includes(q)))
      );
    }
    // Sort
    list = [...list].sort((a, b) => {
      let va: any, vb: any;
      if (sortBy === "name") { va = a.name.toLowerCase(); vb = b.name.toLowerCase(); }
      else if (sortBy === "ultimaActividad") { va = a.ultimaActividad || ""; vb = b.ultimaActividad || ""; }
      else if (sortBy === "estado") { va = a.estado; vb = b.estado; }
      else if (sortBy === "origen") { va = a.origen; vb = b.origen; }
      else if (sortBy === "plan") { va = a.plan; vb = b.plan; }
      else if (sortBy === "salud") { const order = { green: 0, yellow: 1, red: 2, gray: 3 } as any; va = order[a.salud] ?? 9; vb = order[b.salud] ?? 9; }
      else { va = a.name; vb = b.name; }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [clientes, filterEstado, filterOrigen, search, sortBy, sortDir]);

  const estadoCounts = useMemo(() => {
    const counts: Record<string, number> = { todos: clientes.length };
    for (const c of clientes) counts[c.estado] = (counts[c.estado] || 0) + 1;
    return counts;
  }, [clientes]);

  const origenCounts = useMemo(() => {
    const counts: Record<string, number> = { todos: clientes.length };
    for (const c of clientes) counts[c.origen] = (counts[c.origen] || 0) + 1;
    return counts;
  }, [clientes]);

  function handleSort(col: SortCol) {
    if (sortBy === col) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortBy(col); setSortDir("desc"); }
  }

  async function toggleExempt(c: Cliente) {
    setTogglingExempt(c.id);
    const newVal = !c.billingExempt;
    await fetch(`/api/admin/locales/${c.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ billingExempt: newVal }),
    }).catch(() => {});
    setClientes(prev => prev.map(x => x.id === c.id ? { ...x, billingExempt: newVal, estado: newVal ? "BONIFICADO" : x.estado } : x));
    setTogglingExempt(null);
  }

  if (sessionLoading || loading) return <div style={{ padding: 40, textAlign: "center", color: "#555" }}>Cargando...</div>;

  const s = stats;

  return (
    <div style={{ maxWidth: 1100, padding: "0 12px" }}>
      <h1 style={{ fontFamily: "Georgia,serif", fontSize: "1.4rem", fontWeight: 400, marginBottom: 20, color: "var(--adm-text)" }}>Clientes</h1>

      {/* Stats */}
      {s && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
          <StatCard label="Total Clientes" value={s.total} sub={`${filtered.length} mostrados`} />
          <StatCard label="En Trial" value={s.enTrial} color="#a855f7" sub={`${s.trialExpireThisWeek} vencen esta semana`} />
          <StatCard label="Pagando" value={s.pagando} color="#4ade80" sub={`$${s.mrr.toLocaleString("es-CL")}/mes MRR`} />
          <StatCard label="Dormidos" value={s.dormidos} color="#f87171" sub=">7 dias sin entrar" />
          <StatCard label="Tasa Activacion" value={`${s.tasaActivacion}%`} color="#60a5fa" sub="leads → activados" />
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
        {ESTADO_FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilterEstado(f.key)} style={{
            padding: "7px 12px", borderRadius: 999, border: `1px solid ${filterEstado === f.key ? GOLD : "var(--adm-card-border)"}`,
            background: filterEstado === f.key ? GOLD : "transparent",
            color: filterEstado === f.key ? "#0a0908" : "var(--adm-text2)",
            fontSize: 12, fontWeight: filterEstado === f.key ? 700 : 500, cursor: "pointer", fontFamily: F,
          }}>
            {f.label} {estadoCounts[f.key] != null && <span style={{ background: filterEstado === f.key ? "rgba(0,0,0,.2)" : "rgba(255,255,255,.08)", padding: "1px 6px", borderRadius: 99, fontSize: 10, marginLeft: 4 }}>{estadoCounts[f.key]}</span>}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {ORIGEN_FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilterOrigen(f.key)} style={{
            padding: "6px 11px", borderRadius: 999, border: `1px solid ${filterOrigen === f.key ? "var(--adm-text3)" : "var(--adm-card-border)"}`,
            background: filterOrigen === f.key ? "var(--adm-card-border)" : "transparent",
            color: filterOrigen === f.key ? "var(--adm-text)" : "var(--adm-text3)",
            fontSize: 11, fontWeight: filterOrigen === f.key ? 700 : 500, cursor: "pointer", fontFamily: F,
          }}>
            {f.label} {origenCounts[f.key] != null && f.key !== "todos" && <span style={{ opacity: 0.6, fontSize: 10, marginLeft: 3 }}>{origenCounts[f.key]}</span>}
          </button>
        ))}
        <input
          placeholder="Buscar nombre, email, slug..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ marginLeft: "auto", padding: "8px 14px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text)", fontSize: 13, outline: "none", fontFamily: F, width: 240 }}
        />
      </div>

      {/* Table */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 0.9fr 0.8fr 1fr 0.7fr", padding: "12px 18px", borderBottom: "1px solid var(--adm-card-border)", fontSize: 11, color: "var(--adm-text3)", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>
          {(["name", "estado", "origen", "plan", "ultimaActividad", "salud"] as SortCol[]).map((col, i) => {
            const labels = ["Restaurante", "Estado", "Origen", "Plan", "Ultima Actividad", "Salud"];
            const isActive = sortBy === col;
            return (
              <div key={col} onClick={() => handleSort(col)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: isActive ? GOLD : undefined }}>
                {labels[i]}
                <span style={{ fontSize: 10, opacity: isActive ? 1 : 0.3, color: isActive ? GOLD : undefined }}>
                  {isActive && sortDir === "asc" ? "▲" : "▼"}
                </span>
              </div>
            );
          })}
        </div>

        {/* Rows */}
        {filtered.map(c => {
          const eb = ESTADO_BADGE[c.estado] || ESTADO_BADGE.FREE;
          const ob = ORIGEN_BADGE[c.origen] || ORIGEN_BADGE.HANDOFF;
          const isExpanded = expanded === c.id;
          return (
            <div key={c.id}>
              <div onClick={() => { setExpanded(isExpanded ? null : c.id); setActiveTab("timeline"); }} style={{
                display: "grid", gridTemplateColumns: "2.2fr 1fr 0.9fr 0.8fr 1fr 0.7fr", padding: "14px 18px",
                borderBottom: `1px solid ${isExpanded ? "transparent" : "var(--adm-card-border)"}`,
                alignItems: "center", cursor: "pointer", background: isExpanded ? "rgba(244,166,35,.03)" : undefined,
                transition: "background .15s",
              }}>
                {/* Restaurante */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "#1a1a1a", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 800, color: GOLD, overflow: "hidden", flexShrink: 0 }}>
                    {c.logoUrl ? <img src={c.logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : getInitials(c.name)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--adm-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {c.name} {c.billingExempt && <span style={{ fontSize: 10, color: "#4ade80" }}>🎁</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--adm-text3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {c.owner ? `${c.owner.name} · ${c.owner.email}${c.owner.whatsapp ? ` · ${c.owner.whatsapp}` : ""}` : "Sin owner"}
                    </div>
                  </div>
                </div>
                {/* Estado */}
                <div>
                  <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 99, fontSize: 10, fontWeight: 700, background: eb.bg, color: eb.color }}>
                    {eb.label(c)}
                  </span>
                  {c.estado === "TRIAL_VENCIDO" && <span style={{ fontSize: 10, color: "#f87171", marginLeft: 4 }}>trial vencido</span>}
                </div>
                {/* Origen */}
                <div>
                  <span style={{ padding: "3px 8px", borderRadius: 99, fontSize: 10, fontWeight: 600, background: ob.bg, color: ob.color }}>
                    {c.origen === "SUBIR_CARTA" ? "Subir Carta" : c.origen === "PLANES" ? "Planes" : "Handoff"}
                  </span>
                </div>
                {/* Plan */}
                <div style={{ fontSize: 13, color: "var(--adm-text2)" }}>{c.plan}</div>
                {/* Ultima Actividad */}
                <div style={{ fontSize: 13, color: c.ultimaActividad ? "var(--adm-text2)" : "var(--adm-text3)" }}>{timeAgo(c.ultimaActividad)}</div>
                {/* Salud */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: SALUD_COLORS[c.salud], boxShadow: `0 0 6px ${SALUD_COLORS[c.salud]}60` }} />
                  <span style={{ fontSize: 11, color: "var(--adm-text3)" }}>{SALUD_LABELS[c.salud]}</span>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div style={{ background: "var(--adm-bg)", borderBottom: "1px solid var(--adm-card-border)", padding: "0 18px 20px" }}>
                  {/* Tabs */}
                  <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--adm-card-border)", marginBottom: 16 }}>
                    {(["timeline", "metricas", "panel", "acciones"] as const).map(tab => (
                      <button key={tab} onClick={() => setActiveTab(tab)} style={{
                        padding: "10px 16px", fontSize: 12, fontWeight: activeTab === tab ? 700 : 500,
                        color: activeTab === tab ? GOLD : "var(--adm-text3)", cursor: "pointer",
                        borderBottom: `2px solid ${activeTab === tab ? GOLD : "transparent"}`,
                        background: "none", border: "none", fontFamily: F,
                      }}>
                        {tab === "timeline" ? "Timeline" : tab === "metricas" ? "Metricas" : tab === "panel" ? "Acciones Panel" : "Acciones"}
                      </button>
                    ))}
                  </div>

                  {activeTab === "timeline" && <TimelineTab c={c} />}
                  {activeTab === "metricas" && <MetricasTab c={c} />}
                  {activeTab === "panel" && <PanelActivityTab restaurantId={c.id} />}
                  {activeTab === "acciones" && <AccionesTab c={c} togglingExempt={togglingExempt} onToggleExempt={() => toggleExempt(c)}
                    onDelete={() => { setClientes(prev => prev.filter(x => x.id !== c.id)); setExpanded(null); }}
                    onUpdateField={(field, value) => setClientes(prev => prev.map(x => x.id === c.id ? { ...x, [field]: value } : x))}
                  />}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "var(--adm-text3)", fontSize: 14 }}>
            No se encontraron clientes con estos filtros.
          </div>
        )}
      </div>

      <div style={{ textAlign: "center", padding: 16, color: "var(--adm-text3)", fontSize: 12 }}>
        {filtered.length} de {clientes.length} clientes
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function StatCard({ label, value, color, sub }: { label: string; value: string | number; color?: string; sub?: string }) {
  return (
    <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 18px" }}>
      <div style={{ fontSize: 11, color: "var(--adm-text3)", textTransform: "uppercase" as const, letterSpacing: "0.08em", fontWeight: 600, marginBottom: 6, fontFamily: F }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -1, color: color || "var(--adm-text)", fontFamily: F }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--adm-text3)", marginTop: 4, fontFamily: F }}>{sub}</div>}
    </div>
  );
}

function TimelineTab({ c }: { c: Cliente }) {
  // Merge lead events + panel activity into chronological timeline
  const items: { time: string; text: string; dot: string }[] = [];

  // Lead events
  if (c.leadEvents.length > 0) {
    for (const ev of c.leadEvents) {
      const action = ev.action || "";
      const ts = ev.ts || "";
      let text = action;
      if (action === "paso1_completed") text = `Subio carta via ${ev.mode || "link"}${ev.url ? `: ${ev.url.substring(0, 60)}` : ""}`;
      else if (action === "paso2_loaded") text = "Cargo formulario paso 2";
      else if (action === "paso2_completed") text = "Completo datos (email, nombre)";
      else if (action === "confirmacion_loaded") text = "Vio confirmacion";
      else if (action === "carta_ready") text = `Carta lista`;
      else if (action === "onboard_start") text = "Inicio onboarding";
      else if (action === "onboard_done") text = "Completo onboarding (6/6)";
      else if (action.startsWith("onboard_step")) text = `Onboarding paso ${ev.stepName || ""}`;
      else if (action === "panel_visit") text = `Visito panel: ${ev.section || ""}`;
      else if (action === "email_failure_sent") text = `Email de ayuda enviado (${ev.type || ""})`;
      else if (action === "wa_fail_template_sent") text = "WhatsApp de fallo enviado";
      else if (action === "manual_reprocess") text = `Reprocesado: ${ev.reason || ""}`;
      items.push({ time: ts, text, dot: action.includes("done") || action.includes("ready") ? "green" : action.includes("fail") || action.includes("error") ? "red" : "blue" });
    }
  }

  // Lead timeline milestones
  if (c.leadTimeline) {
    const lt = c.leadTimeline;
    if (lt.deliveredAt) items.push({ time: lt.deliveredAt, text: "Email carta lista enviado", dot: "gold" });
    if (lt.emailOpenedAt) items.push({ time: lt.emailOpenedAt, text: "Email abierto", dot: "green" });
    if (lt.emailClickedAt) items.push({ time: lt.emailClickedAt, text: "Click en email", dot: "green" });
    if (lt.activatedAt) items.push({ time: lt.activatedAt, text: "Activo plan", dot: "gold" });
  }

  // Panel activity
  for (const a of c.recentActivity) {
    const label = ACTION_LABELS[a.action] || a.action;
    const detail = a.details && typeof a.details === "object" ? (a.details as any).dishName || (a.details as any).categoryName || "" : "";
    items.push({ time: a.createdAt, text: `${label}${detail ? `: ${detail}` : ""}`, dot: "" });
  }

  // Visitor session (pre-activation behavior)
  if ((c as any).visitorSession) {
    const vs = (c as any).visitorSession;
    const src = vs.utmSource === "organic" ? "organico" : vs.utmSource === "facebook" ? "Facebook Ads" : vs.utmSource || "directo";
    const parts = [`Llego via ${src}`];
    if (vs.landingPage) parts.push(`a ${vs.landingPage}`);
    if (vs.device) parts.push(`(${vs.device})`);
    if (vs.referrer) parts.push(`desde ${vs.referrer}`);
    if (vs.duration > 0) parts.push(`· ${vs.duration}s en pagina`);
    if (vs.interactions > 0) parts.push(`· ${vs.interactions} interacciones`);
    if (vs.sectionsViewed?.length > 0) parts.push(`· vio: ${vs.sectionsViewed.join(", ")}`);
    if (vs.utmCampaign) parts.push(`· campaña: ${vs.utmCampaign}`);
    items.push({ time: vs.createdAt, text: parts.join(" "), dot: vs.utmSource === "facebook" ? "blue" : "purple" });
  }

  // Emails sent
  if ((c as any).emailsSent) {
    for (const e of (c as any).emailsSent) {
      const purposeLabel: Record<string, string> = {
        activation_welcome: "Email de bienvenida enviado",
        funnel_carta_lista: "Email carta lista enviado",
        lead_failure_help: "Email de ayuda (carta fallo) enviado",
      };
      items.push({ time: e.createdAt, text: `${purposeLabel[e.purpose] || e.purpose} · ${e.status === "sent" ? "entregado" : "fallo"}`, dot: e.status === "sent" ? "gold" : "red" });
    }
  }

  // Registration + plan info
  const planLabel = c.plan === "FREE" ? "Free" : c.plan === "GOLD" ? "Gold" : c.plan === "PREMIUM" ? "Premium" : c.plan;
  const origenLabel = c.origen === "SUBIR_CARTA" ? "Subir Carta" : c.origen === "PLANES" ? "Planes" : "Handoff";
  const trialInfo = c.trialDaysLeft ? ` · regalo 14 dias Premium` : "";
  items.push({ time: c.createdAt, text: `Registro desde ${origenLabel} · Plan ${planLabel}${trialInfo}`, dot: "purple" });

  // Sort chronologically desc
  items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  const DOT_COLORS: Record<string, string> = { gold: GOLD, green: "#4ade80", blue: "#60a5fa", purple: "#a855f7", red: "#f87171" };

  return (
    <div style={{ position: "relative", paddingLeft: 24, maxHeight: 400, overflowY: "auto" }}>
      <div style={{ position: "absolute", left: 7, top: 4, bottom: 4, width: 1, background: "var(--adm-card-border)" }} />
      {items.map((item, i) => (
        <div key={i} style={{ position: "relative", paddingBottom: 14 }}>
          <div style={{
            position: "absolute", left: -20, top: 3, width: 10, height: 10, borderRadius: "50%",
            border: `2px solid ${DOT_COLORS[item.dot] || "var(--adm-card-border)"}`,
            background: item.dot ? DOT_COLORS[item.dot] : "var(--adm-bg)",
          }} />
          <div style={{ fontSize: 10, color: "var(--adm-text3)", marginBottom: 2 }}>{fmtDate(item.time)}</div>
          <div style={{ fontSize: 13, color: "var(--adm-text2)" }}>{item.text}</div>
        </div>
      ))}
      {items.length === 0 && <div style={{ color: "var(--adm-text3)", fontSize: 13, padding: "10px 0" }}>Sin actividad registrada.</div>}
    </div>
  );
}

function PanelActivityTab({ restaurantId }: { restaurantId: string }) {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/actividad/${restaurantId}?limit=30`)
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
    const res = await fetch(`/api/admin/actividad/${restaurantId}?limit=30&cursor=${cursor}`);
    const data = await res.json();
    setActivities(prev => [...prev, ...(data.activities || [])]);
    setCursor(data.nextCursor || null);
    setHasMore(!!data.nextCursor);
  };

  if (loading) return <div style={{ color: "var(--adm-text3)", fontSize: 13, padding: "10px 0" }}>Cargando...</div>;

  return (
    <div style={{ maxHeight: 450, overflowY: "auto" }}>
      {activities.map((a: any, i: number) => {
        const label = ACTION_LABELS[a.action] || a.action;
        const detail = a.details && typeof a.details === "object"
          ? (a.details.dishName || a.details.categoryName || a.details.name || "")
          : "";
        return (
          <div key={a.id || i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--adm-card-border)" }}>
            <div style={{ fontSize: 11, color: "var(--adm-text3)", minWidth: 110, flexShrink: 0 }}>{fmtDate(a.createdAt)}</div>
            <div style={{ fontSize: 13, color: "var(--adm-text2)" }}>
              <strong style={{ color: "var(--adm-text)" }}>{label}</strong>
              {detail && <span style={{ marginLeft: 6, color: "var(--adm-text3)" }}>{detail}</span>}
            </div>
          </div>
        );
      })}
      {activities.length === 0 && <div style={{ color: "var(--adm-text3)", fontSize: 13, padding: "10px 0" }}>Sin acciones en el panel registradas.</div>}
      {hasMore && (
        <button onClick={loadMore} style={{
          padding: "8px 16px", marginTop: 10, borderRadius: 8, border: "1px solid var(--adm-card-border)",
          background: "transparent", color: "var(--adm-text3)", fontSize: 12, cursor: "pointer", fontFamily: F,
        }}>
          Ver más
        </button>
      )}
    </div>
  );
}

function MetricasTab({ c }: { c: Cliente }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
      <MiniCard label="Platos" value={c.dishes} />
      <MiniCard label="Categorias" value={c.categories} />
      <MiniCard label="Sesiones (7d)" value={c.sessions7d} color={c.sessions7d > 0 ? "#4ade80" : undefined} />
      <MiniCard label="Sesiones total" value={c.sessions} />
      <MiniCard label="Carta importada" value={c.menuImported ? "Si" : "No"} color={c.menuImported ? "#4ade80" : "#f87171"} />
      <MiniCard label="Registrado" value={fmtDate(c.createdAt)} />
    </div>
  );
}

function MiniCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 10, color: "var(--adm-text3)", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 6, fontWeight: 600, fontFamily: F }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || "var(--adm-text)", fontFamily: F }}>{value}</div>
    </div>
  );
}

function AccionesTab({ c, togglingExempt, onToggleExempt, onDelete, onUpdateField }: {
  c: Cliente; togglingExempt: string | null; onToggleExempt: () => void;
  onDelete: () => void; onUpdateField: (field: string, value: string) => void;
}) {
  const baseUrl = "https://quierocomer.cl";
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(c.name);
  const [editPlan, setEditPlan] = useState(c.plan);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const body: Record<string, any> = {};
    if (editName !== c.name) body.name = editName;
    if (editPlan !== c.plan) body.plan = editPlan;
    if (Object.keys(body).length > 0) {
      await fetch(`/api/admin/locales/${c.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => {});
      if (body.name) onUpdateField("name", body.name);
      if (body.plan) onUpdateField("plan", body.plan);
    }
    setSaving(false);
    setEditing(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    const res = await fetch(`/api/admin/locales/${c.id}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) onDelete();
    else setDeleting(false);
  };

  return (
    <div>
      {/* Quick actions */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <ActionBtn href={`${baseUrl}/qr/${c.slug}`} label="👁 Ver carta" />
        {c.ownerId && <ActionBtn href={`/api/admin/impersonate?ownerId=${c.ownerId}`} label="🔑 Entrar como el" />}
        {c.owner?.email && <ActionBtn href={`mailto:${c.owner.email}`} label="📧 Enviar email" />}
        {c.owner?.whatsapp && <ActionBtn href={`https://wa.me/${c.owner.whatsapp.replace(/[^0-9+]/g, "")}`} label="💬 Enviar WA" />}
        <button onClick={onToggleExempt} disabled={togglingExempt === c.id} style={{
          padding: "7px 14px", borderRadius: 10, border: `1px solid ${c.billingExempt ? "#4ade80" : "var(--adm-card-border)"}`,
          background: "transparent", color: c.billingExempt ? "#4ade80" : "var(--adm-text2)",
          fontSize: 12, cursor: "pointer", fontFamily: F, display: "flex", alignItems: "center", gap: 5,
        }}>
          {c.billingExempt ? "🎁 Bonificado ✓" : "🎁 Activar bonificacion"}
        </button>
      </div>

      {/* Edit section */}
      {!editing ? (
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setEditing(true)} style={{
            padding: "8px 16px", borderRadius: 10, border: "1px solid var(--adm-card-border)",
            background: "transparent", color: "var(--adm-text2)", fontSize: 12, cursor: "pointer", fontFamily: F,
          }}>
            ✏️ Editar cliente
          </button>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} style={{
              padding: "8px 16px", borderRadius: 10, border: "1px solid rgba(248,113,113,.3)",
              background: "transparent", color: "#f87171", fontSize: 12, cursor: "pointer", fontFamily: F,
            }}>
              🗑 Eliminar
            </button>
          ) : (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#f87171", fontFamily: F }}>¿Seguro?</span>
              <button onClick={handleDelete} disabled={deleting} style={{
                padding: "6px 14px", borderRadius: 8, border: "none", background: "#f87171", color: "#fff",
                fontSize: 12, cursor: deleting ? "wait" : "pointer", fontFamily: F, fontWeight: 700,
              }}>
                {deleting ? "Eliminando..." : "Si, eliminar"}
              </button>
              <button onClick={() => setConfirmDelete(false)} style={{
                padding: "6px 14px", borderRadius: 8, border: "1px solid var(--adm-card-border)",
                background: "transparent", color: "var(--adm-text3)", fontSize: 12, cursor: "pointer", fontFamily: F,
              }}>
                Cancelar
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 11, color: "var(--adm-text3)", textTransform: "uppercase" as const, letterSpacing: "0.06em", fontWeight: 600, marginBottom: 12, fontFamily: F }}>Editar cliente</div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: "var(--adm-text3)", display: "block", marginBottom: 4, fontFamily: F }}>Nombre</label>
            <input value={editName} onChange={e => setEditName(e.target.value)} style={{
              width: "100%", padding: "8px 12px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)",
              borderRadius: 8, color: "var(--adm-text)", fontSize: 13, fontFamily: F, outline: "none", boxSizing: "border-box" as const,
            }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: "var(--adm-text3)", display: "block", marginBottom: 4, fontFamily: F }}>Plan</label>
            <div style={{ display: "flex", gap: 6 }}>
              {["FREE", "GOLD", "PREMIUM"].map(p => (
                <button key={p} onClick={() => setEditPlan(p)} style={{
                  padding: "6px 14px", borderRadius: 8, border: `1px solid ${editPlan === p ? GOLD : "var(--adm-card-border)"}`,
                  background: editPlan === p ? GOLD : "transparent", color: editPlan === p ? "#0a0908" : "var(--adm-text2)",
                  fontSize: 12, fontWeight: editPlan === p ? 700 : 500, cursor: "pointer", fontFamily: F,
                }}>{p}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSave} disabled={saving} style={{
              padding: "8px 20px", borderRadius: 10, border: "none", background: GOLD, color: "#0a0908",
              fontSize: 12, fontWeight: 700, cursor: saving ? "wait" : "pointer", fontFamily: F,
            }}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
            <button onClick={() => { setEditing(false); setEditName(c.name); setEditPlan(c.plan); }} style={{
              padding: "8px 16px", borderRadius: 10, border: "1px solid var(--adm-card-border)",
              background: "transparent", color: "var(--adm-text3)", fontSize: 12, cursor: "pointer", fontFamily: F,
            }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener" style={{
      padding: "7px 14px", borderRadius: 10, border: "1px solid var(--adm-card-border)",
      background: "transparent", color: "var(--adm-text2)", fontSize: 12, cursor: "pointer",
      fontFamily: F, textDecoration: "none", display: "flex", alignItems: "center", gap: 5,
    }}>
      {label}
    </a>
  );
}
