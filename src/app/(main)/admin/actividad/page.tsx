"use client";

import { useState, useEffect, useCallback } from "react";

interface Local {
  id: string;
  name: string;
  slug: string;
  plan: string;
  subscriptionStatus: string;
  trialDaysLeft: number | null;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  owner: { name: string; email: string; lastActive: string | null } | null;
  dishes: number;
  categories: number;
  totalSessions: number;
  recentSessions: number;
  promotions: number;
  editedDishes: number;
  photosUploaded: number;
  lastDishEdit: { name: string; at: string } | null;
  status: "active" | "inactive" | "dormant";
}

const STATUS = {
  active: { label: "Activo", color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
  inactive: { label: "Inactivo", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  dormant: { label: "Dormido", color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
};

const PLAN_COLORS: Record<string, string> = {
  PREMIUM: "#a855f7", GOLD: "#F4A623", FREE: "#666",
};

export default function ActividadPage() {
  const [locales, setLocales] = useState<Local[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "inactive" | "dormant">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/actividad")
      .then(r => r.json())
      .then(data => setLocales(data.locales || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 40, color: "#888" }}>Cargando...</div>;

  const filtered = filter === "all" ? locales : locales.filter(l => l.status === filter);
  const counts = {
    all: locales.length,
    active: locales.filter(l => l.status === "active").length,
    inactive: locales.filter(l => l.status === "inactive").length,
    dormant: locales.filter(l => l.status === "dormant").length,
  };

  const timeAgo = (iso: string | null) => {
    if (!iso) return "nunca";
    const ms = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return "ahora";
    if (mins < 60) return `hace ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `hace ${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `hace ${days}d`;
  };

  return (
    <div style={{ maxWidth: 700, padding: "0 12px" }}>
      <h1 style={{ fontFamily: "var(--font-display, Georgia)", fontSize: 22, color: "#F4A623", margin: "0 0 16px" }}>
        Locales activos
      </h1>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {(["all", "active", "inactive", "dormant"] as const).map(key => {
          const labels = { all: "Todos", active: "Activos", inactive: "Inactivos", dormant: "Dormidos" };
          const colors = { all: "#888", active: "#22c55e", inactive: "#f59e0b", dormant: "#ef4444" };
          return (
            <button key={key} onClick={() => setFilter(key)} style={{
              padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer",
              background: filter === key ? colors[key] : "#1a1a1a",
              color: filter === key ? "#fff" : colors[key],
              fontSize: 13, fontWeight: 700,
            }}>
              {labels[key]} ({counts[key]})
            </button>
          );
        })}
      </div>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map(local => {
          const s = STATUS[local.status];
          const isOpen = expanded === local.id;
          return (
            <div key={local.id} style={{
              background: "#1a1a1a", borderRadius: 14, border: "1px solid #2a2a2a",
              overflow: "hidden",
            }}>
              {/* Main row */}
              <div
                onClick={() => setExpanded(isOpen ? null : local.id)}
                style={{
                  padding: "14px 16px", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 12,
                }}
              >
                {/* Logo */}
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: "#222", display: "flex", alignItems: "center", justifyContent: "center",
                  overflow: "hidden",
                }}>
                  {local.logoUrl ? (
                    <img src={local.logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ fontSize: 16 }}>🍽</span>
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{local.name}</span>
                    <span style={{
                      fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 4,
                      background: `${PLAN_COLORS[local.plan] || "#666"}20`,
                      color: PLAN_COLORS[local.plan] || "#666",
                      textTransform: "uppercase",
                    }}>
                      {local.plan}
                    </span>
                    {local.trialDaysLeft !== null && (
                      <span style={{ fontSize: 10, color: local.trialDaysLeft <= 2 ? "#ef4444" : "#888" }}>
                        {local.trialDaysLeft}d trial
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 4, fontSize: 12, color: "#888", flexWrap: "wrap" }}>
                    {local.owner && <span>{local.owner.name}</span>}
                    <span>{local.dishes} platos</span>
                    <span>{local.recentSessions} visitas 7d</span>
                    <span style={{ color: s.color }}>{timeAgo(local.owner?.lastActive || local.updatedAt)}</span>
                  </div>
                </div>

                {/* Status dot */}
                <div style={{
                  width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                  background: s.color, boxShadow: `0 0 8px ${s.color}40`,
                }} />
              </div>

              {/* Expanded detail */}
              {isOpen && (
                <div style={{
                  padding: "0 16px 16px",
                  borderTop: "1px solid #222",
                }}>
                  {/* Metrics grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 8, marginTop: 12 }}>
                    <Metric label="Platos" value={local.dishes} />
                    <Metric label="Categorías" value={local.categories} />
                    <Metric label="Editados" value={local.editedDishes} color={local.editedDishes > 0 ? "#22c55e" : undefined} />
                    <Metric label="Con foto" value={local.photosUploaded} color={local.photosUploaded > 0 ? "#3b82f6" : undefined} />
                    <Metric label="Sesiones total" value={local.totalSessions} />
                    <Metric label="Sesiones 7d" value={local.recentSessions} color={local.recentSessions > 0 ? "#22c55e" : undefined} />
                    <Metric label="Ofertas" value={local.promotions} />
                  </div>

                  {/* Owner info */}
                  {local.owner && (
                    <div style={{ marginTop: 14, padding: "12px 14px", background: "#111", borderRadius: 10, border: "1px solid #222" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>Dueño</div>
                      <div style={{ fontSize: 13, color: "#ccc" }}>{local.owner.name}</div>
                      <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{local.owner.email}</div>
                      <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                        Último acceso: <span style={{ color: s.color }}>{timeAgo(local.owner.lastActive)}</span>
                      </div>
                    </div>
                  )}

                  {/* Last edit */}
                  {local.lastDishEdit && (
                    <div style={{ marginTop: 10, fontSize: 12, color: "#888" }}>
                      Última edición: <span style={{ color: "#ccc" }}>{local.lastDishEdit.name}</span> · {timeAgo(local.lastDishEdit.at)}
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                    <a href={`/qr/${local.slug}`} target="_blank" rel="noopener noreferrer" style={{
                      fontSize: 12, fontWeight: 600, color: "#F4A623", textDecoration: "none",
                    }}>Ver carta</a>
                    <a href={`/api/panel/demo-auth?slug=${local.slug}`} target="_blank" rel="noopener noreferrer" style={{
                      fontSize: 12, fontWeight: 600, color: "#3b82f6", textDecoration: "none",
                    }}>Entrar al panel</a>
                  </div>

                  {/* Activity Timeline */}
                  <ActivityTimeline restaurantId={local.id} />

                  {/* Activation date */}
                  <div style={{ fontSize: 11, color: "#555", marginTop: 10 }}>
                    Activado: {new Date(local.createdAt).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: "#666" }}>
            No hay locales {filter !== "all" ? `con estado "${STATUS[filter as keyof typeof STATUS]?.label}"` : ""}.
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ background: "#111", borderRadius: 8, padding: "10px 12px", border: "1px solid #222" }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || "#fff" }}>{value}</div>
      <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{label}</div>
    </div>
  );
}

const ACTION_LABELS: Record<string, { icon: string; label: string; color: string }> = {
  panel_login: { icon: "🔑", label: "Inició sesión", color: "#3b82f6" },
  dish_edit: { icon: "✏️", label: "Editó plato", color: "#F4A623" },
  dish_create: { icon: "➕", label: "Creó plato", color: "#22c55e" },
  dish_delete: { icon: "🗑️", label: "Eliminó plato", color: "#ef4444" },
  photo_upload: { icon: "📸", label: "Subió foto", color: "#8b5cf6" },
  category_edit: { icon: "📂", label: "Editó categoría", color: "#F4A623" },
  category_create: { icon: "📁", label: "Creó categoría", color: "#22c55e" },
  promo_create: { icon: "🏷️", label: "Creó oferta", color: "#ec4899" },
  promo_edit: { icon: "🏷️", label: "Editó oferta", color: "#F4A623" },
  settings_change: { icon: "⚙️", label: "Cambió ajustes", color: "#6b7280" },
  announcement_create: { icon: "📢", label: "Creó anuncio", color: "#22c55e" },
  category_delete: { icon: "🗑️", label: "Eliminó categoría", color: "#ef4444" },
  panel_visit: { icon: "👁️", label: "Visitó sección", color: "#6366f1" },
  plan_modal_opened: { icon: "💳", label: "Abrió modal de planes", color: "#F4A623" },
  plan_tab_viewed: { icon: "👀", label: "Vio plan", color: "#F4A623" },
  plan_subscribe_clicked: { icon: "🚀", label: "Intentó suscribirse", color: "#22c55e" },
  plan_page_visited: { icon: "📋", label: "Visitó suscripción", color: "#6366f1" },
};

interface Activity {
  id: string;
  action: string;
  details: any;
  createdAt: string;
}

function ActivityTimeline({ restaurantId }: { restaurantId: string }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback((append = false) => {
    setLoading(true);
    const url = `/api/admin/actividad/${restaurantId}?limit=20${cursor && append ? `&cursor=${cursor}` : ""}`;
    fetch(url)
      .then(r => r.json())
      .then(d => {
        setActivities(prev => append ? [...prev, ...(d.activities || [])] : (d.activities || []));
        setCursor(d.nextCursor);
        setHasMore(!!d.nextCursor);
        setLoaded(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [restaurantId, cursor]);

  useEffect(() => { if (!loaded) load(); }, [loaded]);

  if (!loaded && loading) return <div style={{ marginTop: 14, fontSize: 12, color: "#666" }}>Cargando actividad...</div>;

  if (loaded && activities.length === 0) {
    return <div style={{ marginTop: 14, fontSize: 12, color: "#555", fontStyle: "italic" }}>Sin actividad registrada aún.</div>;
  }

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>
        Actividad reciente
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {activities.map((a, i) => {
          const cfg = ACTION_LABELS[a.action] || { icon: "•", label: a.action, color: "#888" };
          const d = a.details || {};
          const time = new Date(a.createdAt).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
          return (
            <div key={a.id} style={{ display: "flex", gap: 10, padding: "8px 0", borderLeft: "2px solid #2a2a2a", marginLeft: 6, paddingLeft: 14, position: "relative" }}>
              <div style={{ position: "absolute", left: -5, top: 10, width: 8, height: 8, borderRadius: "50%", background: cfg.color }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 13 }}>{cfg.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#ddd" }}>{cfg.label}</span>
                  {d.dishName && <span style={{ fontSize: 11, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>· {d.dishName}</span>}
                  {d.name && !d.dishName && <span style={{ fontSize: 11, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>· {d.name}</span>}
                  {d.section && <span style={{ fontSize: 11, color: "#888" }}>· {d.section}</span>}
                  {d.fields && <span style={{ fontSize: 10, color: "#555" }}>({d.fields.join(", ")})</span>}
                </div>
                <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>{time}</div>
              </div>
            </div>
          );
        })}
      </div>
      {hasMore && (
        <button onClick={() => load(true)} disabled={loading} style={{
          marginTop: 8, padding: "6px 14px", background: "transparent", border: "1px solid #333",
          borderRadius: 8, fontSize: 11, color: "#888", cursor: "pointer",
        }}>
          {loading ? "Cargando..." : "Ver más"}
        </button>
      )}
    </div>
  );
}
