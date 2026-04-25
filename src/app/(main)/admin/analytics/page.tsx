"use client";
import { useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import Link from "next/link";

const F = "var(--font-display)";

function Card({ label, value, sub, color = "#F4A623" }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 14, padding: "18px 20px" }}>
      <p style={{ fontFamily: F, fontSize: "1.8rem", color, margin: "0 0 4px", fontWeight: 700 }}>{value}</p>
      <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#888", margin: 0 }}>{label}</p>
      {sub && <p style={{ fontFamily: F, fontSize: "0.7rem", color: "#555", margin: "4px 0 0" }}>{sub}</p>}
    </div>
  );
}

export default function AnalyticsDashboard() {
  const { restaurants, isSuper } = useAdminSession();
  const [restaurantId, setRestaurantId] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ type: "metrics" });
    if (restaurantId) params.set("restaurantId", restaurantId);
    fetch(`/api/admin/analytics?${params}`).then((r) => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [restaurantId]);

  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
  };

  const [attention, setAttention] = useState<any>(null);

  useEffect(() => {
    const params = new URLSearchParams({ type: "attention" });
    if (restaurantId) params.set("restaurantId", restaurantId);
    fetch(`/api/admin/analytics?${params}`).then(r => r.json()).then(setAttention).catch(() => {});
  }, [restaurantId]);

  const SUB_PAGES = [
    { label: "Funnel", href: "/admin/analytics/funnel", icon: "🔻" },
    { label: "Tickets", href: "/admin/analytics/tickets", icon: "🧾" },
    { label: "Ticket Trend", href: "/admin/analytics/ticket-trend", icon: "📊" },
    { label: "Búsquedas", href: "/admin/analytics/searches", icon: "🔍" },
    { label: "Personalización", href: "/admin/analytics/genio", icon: "✨" },
  ];

  return (
    <div style={{ maxWidth: 800 }}>
      <div className="adm-flex-wrap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, gap: 10 }}>
        <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: "#F4A623", margin: 0 }}>Analytics</h1>
        <select value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)} style={{ padding: "8px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 10, color: "white", fontFamily: F, fontSize: "0.82rem", outline: "none" }}>
          <option value="" style={{ background: "#1A1A1A" }}>Todos los locales</option>
          {restaurants.map((r) => <option key={r.id} value={r.id} style={{ background: "#1A1A1A" }}>{r.name}</option>)}
        </select>
      </div>

      {/* Sub-navigation */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
        {SUB_PAGES.map((p) => (
          <Link key={p.href} href={p.href} style={{ padding: "8px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 10, color: "#888", fontFamily: F, fontSize: "0.78rem", textDecoration: "none", fontWeight: 600 }}>
            {p.icon} {p.label}
          </Link>
        ))}
      </div>

      {loading ? (
        <p style={{ color: "#F4A623", fontFamily: F, fontSize: "0.85rem", textAlign: "center", padding: 40 }}>Cargando...</p>
      ) : data ? (
        <div className="adm-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Card label="Visitantes únicos" value={data.totalVisitors} color="#F4A623" />
          <Card label="% Recurrentes" value={`${data.returningPct}%`} sub={`${data.returningVisitors} de ${data.totalVisitors}`} color="#3db89e" />
          <Card label="% Conversión a registrado" value={`${data.conversionPct}%`} sub={`${data.convertedCount} convertidos`} color="#7fbfdc" />
          <Card label="Total sesiones" value={data.totalSessions} />
          <Card label="Duración promedio" value={formatDuration(data.avgDurationMs)} color="#4ade80" />
          <Card label="Platos vistos / sesión" value={data.avgDishesViewed} color="white" />
        </div>
      ) : (
        <p style={{ color: "#666", fontFamily: F, textAlign: "center", padding: 40 }}>Sin datos</p>
      )}

      {/* Top Attention Dishes */}
      {attention?.dishes?.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h2 style={{ fontFamily: F, fontSize: "1rem", color: "#888", margin: "0 0 14px" }}>Platos que más llaman la atención</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {attention.dishes.map((d: any, i: number) => (
              <div key={i} style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                {d.photo ? (
                  <img src={d.photo} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: "#2A2A2A", flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 700, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
                    <span style={{ fontSize: "0.7rem", color: "#555", flexShrink: 0 }}>{d.category}</span>
                  </div>
                  <div style={{ display: "flex", gap: 12, marginTop: 2 }}>
                    <span style={{ fontSize: "0.72rem", color: "#888" }}>{d.viewPct}% de sesiones</span>
                    <span style={{ fontSize: "0.72rem", color: "#888" }}>{d.uniqueSessions} vistas</span>
                    <span style={{ fontSize: "0.72rem", color: "#F4A623" }}>{Math.round(d.avgDwellMs / 1000)}s promedio</span>
                  </div>
                </div>
                <span style={{ fontFamily: F, fontSize: "0.82rem", color: "#555", flexShrink: 0 }}>${d.price?.toLocaleString("es-CL")}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: "0.68rem", color: "#444", marginTop: 8, fontFamily: F }}>Basado en {attention.totalSessions} sesiones de los últimos 28 días</p>
        </div>
      )}
    </div>
  );
}
