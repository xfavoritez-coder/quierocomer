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

function Stat({ label, value, sub, color = "#FFD600" }: { label: string; value: string | number; sub?: string; color?: string }) {
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
            <div style={{ width: `${(item.count / max) * 100}%`, height: "100%", background: i === 0 ? "#FFD600" : "rgba(255,214,0,0.4)", borderRadius: 2 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function DistributionBar({ title, data, labels }: { title: string; data: Record<string, number>; labels?: Record<string, string> }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  if (!total) return null;
  const colors = ["#FFD600", "#3db89e", "#e85530", "#7fbfdc", "#c93010"];
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

export default function AdminDashboard() {
  const { selectedRestaurantId, isSuper, loading: sessionLoading } = useAdminSession();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionLoading) return;
    setLoading(true);
    const params = selectedRestaurantId ? `?restaurantId=${selectedRestaurantId}` : "";
    fetch(`/api/admin/dashboard${params}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedRestaurantId, sessionLoading]);

  if (loading || sessionLoading) {
    return <div style={{ padding: 40, textAlign: "center" }}><p style={{ color: "#FFD600", fontFamily: "var(--font-display)", fontSize: "0.85rem" }}>🧞 Cargando dashboard...</p></div>;
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
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", color: "#FFD600", marginBottom: 24 }}>Dashboard</h1>

      {/* Main metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        <Stat label="Visitas esta semana" value={data.visitsThisWeek} sub={deltaText} color={data.visitsDelta !== null && data.visitsDelta > 0 ? "#3db89e" : "#FFD600"} />
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
    </div>
  );
}
