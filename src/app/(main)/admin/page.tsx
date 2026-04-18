"use client";
import { useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";

interface DashData {
  visitsThisWeek: number;
  visitsLastWeek: number;
  visitsDelta: number | null;
  totalGuests: number;
  registeredGuests: number;
  conversionRate: number;
  avgSessionDuration: number;
  sessionsActive: number;
  sessionsAbandoned: number;
  viewDistribution: Record<string, number>;
  deviceDistribution: Record<string, number>;
  topDishesViewed: { name: string; count: number }[];
  topDishesGenio: { name: string; count: number }[];
  dietDistribution: { type: string; count: number }[];
  activeRestaurantsCount: number;
  topRestaurants: { name: string; visits: number }[];
}

const DIET_LABELS: Record<string, string> = { omnivore: "Omnívoro", vegetarian: "Vegetariano", vegan: "Vegano", pescetarian: "Pescetariano" };
const VIEW_LABELS: Record<string, string> = { premium: "Clásica", lista: "Lista", viaje: "Espacial" };

function Stat({ label, value, sub, color = "#F4A623" }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 14, padding: "18px 20px" }}>
      <p style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", color, margin: "0 0 4px", fontWeight: 700 }}>{value}</p>
      <p style={{ fontFamily: "var(--font-display)", fontSize: "0.78rem", color: "#888", margin: 0 }}>{label}</p>
      {sub && <p style={{ fontFamily: "var(--font-display)", fontSize: "0.7rem", color: "#555", margin: "4px 0 0" }}>{sub}</p>}
    </div>
  );
}

function RankList({ title, items, valueLabel = "" }: { title: string; items: { name: string; count: number }[]; valueLabel?: string }) {
  if (!items.length) return null;
  const max = items[0]?.count || 1;
  return (
    <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 14, padding: "18px 20px" }}>
      <h3 style={{ fontFamily: "var(--font-display)", fontSize: "0.78rem", color: "#888", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</h3>
      {items.map((item, i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: 4 }}>
            <span style={{ color: "white", fontFamily: "var(--font-display)" }}>{item.name}</span>
            <span style={{ color: "#888", fontFamily: "var(--font-display)" }}>{item.count}{valueLabel}</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: "#2A2A2A" }}>
            <div style={{ width: `${(item.count / max) * 100}%`, height: "100%", background: i === 0 ? "#F4A623" : "rgba(255,214,0,0.4)", borderRadius: 2 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function DistributionBar({ title, data, labels }: { title: string; data: Record<string, number>; labels?: Record<string, string> }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  if (!total) return null;
  const colors = ["#F4A623", "#3db89e", "#e85530", "#7fbfdc", "#c93010"];
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  return (
    <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 14, padding: "18px 20px" }}>
      <h3 style={{ fontFamily: "var(--font-display)", fontSize: "0.78rem", color: "#888", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</h3>
      <div style={{ display: "flex", borderRadius: 4, overflow: "hidden", height: 8, marginBottom: 12 }}>
        {entries.map(([key, val], i) => (
          <div key={key} style={{ width: `${(val / total) * 100}%`, background: colors[i % colors.length], height: "100%" }} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
        {entries.map(([key, val], i) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem", color: "#aaa", fontFamily: "var(--font-display)" }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: colors[i % colors.length] }} />
            {labels?.[key] || key} ({Math.round((val / total) * 100)}%)
          </div>
        ))}
      </div>
    </div>
  );
}

interface Insight { id: string; type: string; title: string; body: string; priority: number; }

export default function AdminDashboard() {
  const { restaurants, isSuper, loading: sessionLoading } = useAdminSession();
  const [filterRestaurant, setFilterRestaurant] = useState<string>("");
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [generatingInsights, setGeneratingInsights] = useState(false);

  useEffect(() => {
    if (sessionLoading) return;
    setLoading(true);
    const params = filterRestaurant ? `?restaurantId=${filterRestaurant}` : "";
    Promise.all([
      fetch(`/api/admin/dashboard${params}`).then(r => r.json()),
      filterRestaurant ? fetch(`/api/admin/insights?restaurantId=${filterRestaurant}`).then(r => r.json()) : Promise.resolve({ insights: [] }),
    ]).then(([dashData, insightData]) => {
      if (!dashData.error) setData(dashData);
      setInsights(insightData.insights || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [filterRestaurant, sessionLoading]);

  if (loading || sessionLoading) {
    return <div style={{ padding: 40, textAlign: "center" }}><p style={{ color: "#F4A623", fontFamily: "var(--font-display)", fontSize: "0.85rem" }}>🧞 Cargando dashboard...</p></div>;
  }

  if (!data) {
    return <div style={{ padding: 40, textAlign: "center" }}><p style={{ color: "#888", fontFamily: "var(--font-display)" }}>Sin datos disponibles</p></div>;
  }

  const deltaText = data.visitsDelta !== null ? `${data.visitsDelta > 0 ? "+" : ""}${data.visitsDelta}% vs semana pasada` : "Sin datos previos";
  const avgMin = Math.floor(data.avgSessionDuration / 60);
  const avgSec = data.avgSessionDuration % 60;
  const avgText = avgMin > 0 ? `${avgMin}m ${avgSec}s` : `${avgSec}s`;

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", color: "#F4A623", margin: 0 }}>Dashboard</h1>
        <select
          value={filterRestaurant}
          onChange={e => setFilterRestaurant(e.target.value)}
          style={{ padding: "8px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 10, color: "white", fontFamily: "var(--font-display)", fontSize: "0.82rem", outline: "none" }}
        >
          <option value="" style={{ background: "#1A1A1A" }}>Todos los locales</option>
          {restaurants.map(r => <option key={r.id} value={r.id} style={{ background: "#1A1A1A" }}>{r.name}</option>)}
        </select>
      </div>

      {/* Main metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        <Stat label="Visitas esta semana" value={data.visitsThisWeek} sub={deltaText} color={data.visitsDelta !== null && data.visitsDelta > 0 ? "#3db89e" : "#F4A623"} />
        <Stat label="Visitantes únicos" value={data.totalGuests} />
        <Stat label="Registrados" value={data.registeredGuests} sub={`${data.conversionRate}% conversión`} color="#3db89e" />
        <Stat label="Duración promedio" value={avgText} />
      </div>

      {/* Engagement */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        <Stat label="Sesiones activas" value={data.sessionsActive} color="#3db89e" />
        <Stat label="Abandonadas (30s)" value={data.sessionsAbandoned} color="#e85530" />
      </div>

      {/* Distributions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        <DistributionBar title="Vista preferida" data={data.viewDistribution} labels={VIEW_LABELS} />
        <DistributionBar title="Dispositivo" data={data.deviceDistribution} />
      </div>

      {/* Rankings */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        <RankList title="🔥 Platos más vistos" items={data.topDishesViewed} />
        <RankList title="🧞 Más recomendados por Genio" items={data.topDishesGenio} />
      </div>

      {/* Diet distribution */}
      <DistributionBar title="Tipo de dieta de los clientes" data={Object.fromEntries(data.dietDistribution.map(d => [d.type, d.count]))} labels={DIET_LABELS} />

      {/* Superadmin: top restaurants */}
      {isSuper && data.topRestaurants.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <RankList title="🏆 Top locales por visitas" items={data.topRestaurants.map(r => ({ name: r.name, count: r.visits }))} />
          <div style={{ marginTop: 12 }}>
            <Stat label="Locales activos (últimos 30 días)" value={data.activeRestaurantsCount} color="#7fbfdc" />
          </div>
        </div>
      )}

      {/* Genio Insights */}
      {filterRestaurant && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1rem", color: "#F4A623", margin: 0 }}>🧞 Insights del Genio</h2>
            <button
              onClick={async () => {
                setGeneratingInsights(true);
                try {
                  const res = await fetch("/api/admin/insights", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ restaurantId: filterRestaurant, action: "generate" }),
                  });
                  const d = await res.json();
                  if (d.insights) setInsights(d.insights);
                } catch {} finally { setGeneratingInsights(false); }
              }}
              disabled={generatingInsights}
              style={{ padding: "6px 14px", background: generatingInsights ? "rgba(244,166,35,0.2)" : "rgba(244,166,35,0.1)", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 8, color: "#F4A623", fontFamily: "var(--font-display)", fontSize: "0.72rem", fontWeight: 600, cursor: generatingInsights ? "wait" : "pointer" }}
            >
              {generatingInsights ? "Analizando..." : "Generar insights"}
            </button>
          </div>
          {insights.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {insights.map(i => {
                const typeIcons: Record<string, string> = { menu_gap: "🍽️", segment_opportunity: "👥", pricing: "💰", engagement: "📈" };
                return (
                  <div key={i.id} style={{ background: "#1A1A1A", border: "1px solid rgba(244,166,35,0.12)", borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <span style={{ fontSize: "1.1rem", flexShrink: 0, marginTop: 2 }}>{typeIcons[i.type] || "💡"}</span>
                      <div>
                        <p style={{ fontFamily: "var(--font-display)", fontSize: "0.88rem", color: "white", fontWeight: 600, margin: "0 0 4px" }}>{i.title}</p>
                        <p style={{ fontFamily: "var(--font-display)", fontSize: "0.8rem", color: "#aaa", lineHeight: 1.5, margin: 0 }}>{i.body}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 12, padding: "24px 16px", textAlign: "center" }}>
              <p style={{ fontFamily: "var(--font-display)", fontSize: "0.82rem", color: "#666" }}>Toca "Generar insights" para que el Genio analice tu data</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
