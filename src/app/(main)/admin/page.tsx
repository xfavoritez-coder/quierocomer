"use client";
import { useState, useEffect, useCallback } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";

const F = "var(--font-display)";
const GOLD = "#F4A623";
const PERIODS = [
  { key: "today", label: "Hoy" },
  { key: "yesterday", label: "Ayer" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
  { key: "custom", label: "Personalizado" },
] as const;

const VIEW_LABELS: Record<string, string> = { premium: "Clásica", lista: "Lista", impact: "Impact", viaje: "Viaje", feed: "Feed" };
const DIET_LABELS: Record<string, string> = { VEGAN: "Vegano", VEGETARIAN: "Vegetariano", OMNIVORE: "Carnívoro", vegan: "Vegano", vegetarian: "Vegetariano", omnivore: "Carnívoro" };

interface DashData {
  period: string; from: string; to: string;
  totalSessions: number; uniqueGuests: number; registeredGuests: number;
  conversionRate: number; avgDurationSec: number; birthdaysSaved: number;
  topDishesViewed: { name: string; photo: string | null; count: number }[];
  viewDistribution: Record<string, number>;
  deviceDistribution: Record<string, number>;
  dietDistribution: { type: string; count: number }[];
  restrictionsList: { name: string; count: number }[];
  genio: { starts: number; dietMarked: number; completed: number; completionRate: number; dietRate: number };
  restaurantRanking: { name: string; uniqueGuests: number }[];
  birthdaysByRestaurant: { name: string; count: number }[];
  filterUsage?: { popular: number; estrella: number; veggie: number };
}

// ── Shared styles ──
const card: React.CSSProperties = {
  background: "var(--adm-card)", border: "1px solid var(--adm-card-border)",
  borderRadius: 16, padding: "20px 22px", boxShadow: "var(--adm-card-shadow, none)",
};
const sectionTitle: React.CSSProperties = {
  fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)",
  textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, margin: "0 0 14px",
};

function fmtDuration(sec: number) {
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function pct(a: number, b: number) {
  return b > 0 ? Math.round((a / b) * 100) : 0;
}

// ── Stat card ──
function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div style={card}>
      <p style={{ fontFamily: F, fontSize: "2rem", fontWeight: 700, color: accent || "var(--adm-stat)", margin: 0, lineHeight: 1.1 }}>{value}</p>
      <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "6px 0 0" }}>{label}</p>
      {sub && <p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", margin: "3px 0 0" }}>{sub}</p>}
    </div>
  );
}

// ── Bar list ──
function BarList({ items, max: maxOverride }: { items: { label: string; value: number; sub?: string }[]; max?: number }) {
  const max = maxOverride || items[0]?.value || 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((item, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontFamily: F, fontSize: "0.84rem", color: "var(--adm-text)" }}>{item.label}</span>
            <span style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text2)", fontWeight: 600 }}>{item.value}{item.sub ? ` ${item.sub}` : ""}</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: "var(--adm-card-border)", overflow: "hidden" }}>
            <div style={{
              width: `${Math.min((item.value / max) * 100, 100)}%`, height: "100%", borderRadius: 3,
              background: i === 0 ? GOLD : `rgba(244,166,35,${0.6 - i * 0.05})`,
              transition: "width 0.4s ease",
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Funnel row ──
function FunnelStep({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const p = pct(value, total);
  return (
    <div style={{ flex: 1, textAlign: "center" }}>
      <p style={{ fontFamily: F, fontSize: "1.6rem", fontWeight: 700, color, margin: 0 }}>{value}</p>
      <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", margin: "4px 0 0" }}>{label}</p>
      <p style={{ fontFamily: F, fontSize: "0.66rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>{p}%</p>
    </div>
  );
}

// ── Distribution pills ──
function PillDist({ data, labels }: { data: Record<string, number>; labels?: Record<string, string> }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  if (!total) return <p style={{ fontFamily: F, fontSize: "0.8rem", color: "var(--adm-text3)" }}>Sin datos</p>;
  const colors = ["#F4A623", "#3db89e", "#e85530", "#7fbfdc", "#c93010", "#a78bfa"];
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  return (
    <>
      <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", height: 8, marginBottom: 14 }}>
        {entries.map(([key, val], i) => (
          <div key={key} style={{ width: `${(val / total) * 100}%`, background: colors[i % colors.length], height: "100%" }} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
        {entries.map(([key, val], i) => (
          <span key={key} style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: F, fontSize: "0.74rem", color: "var(--adm-text2)" }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: colors[i % colors.length], flexShrink: 0 }} />
            {labels?.[key] || key} ({val}) {Math.round((val / total) * 100)}%
          </span>
        ))}
      </div>
    </>
  );
}

export default function AdminDashboard() {
  const { restaurants, isSuper, loading: sessionLoading, selectedRestaurantId } = useAdminSession();
  const [filterRestaurant, setFilterRestaurant] = useState("");
  const [period, setPeriod] = useState<string>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    if (sessionLoading) return;
    setLoading(true);
    const rid = isSuper ? filterRestaurant : selectedRestaurantId;
    const params = new URLSearchParams();
    if (rid) params.set("restaurantId", rid);
    params.set("period", period);
    if (period === "custom" && customFrom) params.set("from", customFrom);
    if (period === "custom" && customTo) params.set("to", customTo);
    fetch(`/api/admin/dashboard?${params}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionLoading, isSuper, filterRestaurant, selectedRestaurantId, period, customFrom, customTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading || sessionLoading) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <div style={{ width: 36, height: 36, border: `3px solid ${GOLD}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
        <p style={{ fontFamily: F, fontSize: "0.85rem", color: "var(--adm-text3)" }}>Cargando dashboard...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  if (!data) {
    return <div style={{ padding: 40, textAlign: "center" }}><p style={{ fontFamily: F, color: "var(--adm-text2)" }}>Sin datos disponibles</p></div>;
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: GOLD, margin: 0, fontWeight: 800 }}>Dashboard</h1>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={filterRestaurant}
            onChange={e => setFilterRestaurant(e.target.value)}
            style={{ padding: "8px 12px", background: "var(--adm-select-bg)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text)", fontFamily: F, fontSize: "0.8rem", outline: "none" }}
          >
            <option value="" style={{ background: "var(--adm-select-bg)" }}>Todos los locales</option>
            {restaurants.map(r => <option key={r.id} value={r.id} style={{ background: "var(--adm-select-bg)" }}>{r.name}</option>)}
          </select>
          <button onClick={fetchData} title="Actualizar" style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "var(--adm-select-bg)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", color: "var(--adm-text3)" }}>↻</button>
        </div>
      </div>

      {/* ── Period selector ── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            style={{
              padding: "7px 16px", borderRadius: 10, border: period === p.key ? `1px solid ${GOLD}` : "1px solid var(--adm-card-border)",
              background: period === p.key ? "rgba(244,166,35,0.12)" : "var(--adm-card)",
              color: period === p.key ? GOLD : "var(--adm-text2)",
              fontFamily: F, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date range */}
      {period === "custom" && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
            style={{ padding: "8px 12px", background: "var(--adm-select-bg)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text)", fontFamily: F, fontSize: "0.8rem", outline: "none" }} />
          <span style={{ fontFamily: F, fontSize: "0.8rem", color: "var(--adm-text3)" }}>→</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
            style={{ padding: "8px 12px", background: "var(--adm-select-bg)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text)", fontFamily: F, fontSize: "0.8rem", outline: "none" }} />
          <button onClick={fetchData}
            style={{ padding: "8px 16px", borderRadius: 10, background: GOLD, color: "#0e0e0e", fontFamily: F, fontSize: "0.78rem", fontWeight: 700, border: "none", cursor: "pointer" }}
          >
            Aplicar
          </button>
        </div>
      )}

      {/* ── Main metrics ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
        <StatCard label="Sesiones" value={data.totalSessions} />
        <StatCard label="Visitantes únicos" value={data.uniqueGuests} />
        <StatCard label="Registrados" value={data.registeredGuests} sub={`${data.conversionRate}% conversión`} accent="#3db89e" />
        <StatCard label="Duración promedio" value={fmtDuration(data.avgDurationSec)} />
        <StatCard label="Cumpleaños registrados" value={data.birthdaysSaved} accent="#f472b6" />
      </div>

      {/* ── Restaurant ranking ── */}
      {data.restaurantRanking.length > 1 && (
        <div style={{ ...card, marginBottom: 16 }}>
          <h3 style={sectionTitle}>Ranking de locales por usuarios únicos</h3>
          <BarList items={data.restaurantRanking.map((r, i) => ({ label: `${i + 1}. ${r.name}`, value: r.uniqueGuests }))} />
        </div>
      )}

      {/* ── Birthdays by restaurant ── */}
      {data.birthdaysByRestaurant && data.birthdaysByRestaurant.length > 0 && (
        <div style={{ ...card, marginBottom: 16 }}>
          <h3 style={sectionTitle}>Cumpleaños registrados por local</h3>
          <BarList items={data.birthdaysByRestaurant.map(r => ({ label: r.name, value: r.count }))} />
        </div>
      )}

      {/* ── Filtros usados ── */}
      {data.filterUsage && (() => {
        const fu = data.filterUsage!;
        const total = fu.popular + fu.estrella + fu.veggie;
        if (total === 0) return null;
        const filters = [
          { emoji: "🔥", label: "Popular",      count: fu.popular },
          { emoji: "⭐", label: "Recomendados", count: fu.estrella },
          { emoji: "🌿", label: "Veggie",       count: fu.veggie },
        ].sort((a, b) => b.count - a.count);
        return (
          <div style={{ ...card, marginBottom: 16 }}>
            <h3 style={sectionTitle}>🎛️ Filtros usados en la carta</h3>
            <BarList items={filters.map(f => ({ label: `${f.emoji} ${f.label}`, value: f.count }))} />
            <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "12px 0 0" }}>{total} clicks totales en el periodo</p>
          </div>
        );
      })()}
    </div>
  );
}
