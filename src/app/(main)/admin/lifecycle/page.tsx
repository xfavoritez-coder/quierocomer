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
  const [sortBy, setSortBy] = useState<"name" | "owner" | "stage" | "engagement" | "lastActivity" | "salud">("lastActivity");
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
          display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1.2fr 0.8fr 0.5fr",
          padding: "10px 16px", borderBottom: "1px solid #2a2a2a", fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.05em",
        }}>
          {([
            { key: "name", label: "Restaurante" },
            { key: "owner", label: "Owner" },
            { key: "stage", label: "Estado" },
            { key: "engagement", label: "Engagement" },
            { key: "lastActivity", label: "Actividad" },
            { key: "salud", label: "Salud" },
          ] as const).map(col => (
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
                display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1.2fr 0.8fr 0.5fr",
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
              <div style={{ display: "flex", alignItems: "center" }}>
                <span style={{
                  padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600,
                  background: meta.bg, color: meta.color,
                }}>
                  {meta.label}{entry.trialDaysLeft != null ? ` · ${entry.trialDaysLeft}d` : ""}
                </span>
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
            </div>

            {/* Expanded detail */}
            {expanded === entry.id && (
              <div style={{ padding: "16px 20px 20px", borderBottom: "1px solid #2a2a2a", background: "#141414" }}>
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

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <ActionBtn label="Ver carta" onClick={() => window.open(`/qr/${entry.slug}`, "_blank")} />
                  {ownerWa && <ActionBtn label="Enviar WA" onClick={() => {}} />}
                  {entry.owner && <ActionBtn label="Entrar como él" onClick={() => {}} />}
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
    <button onClick={onClick} style={{
      padding: "6px 14px", borderRadius: 8, border: "1px solid #2a2a2a", background: "transparent",
      color: "#999", fontSize: 12, fontWeight: 500, cursor: "pointer",
    }}>
      {label}
    </button>
  );
}
