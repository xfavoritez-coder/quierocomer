"use client";
import { useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { usePathname } from "next/navigation";
import Link from "next/link";

const F = "var(--font-display)";

function Card({ label, value, sub, color = "var(--adm-accent)" }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "18px 20px", boxShadow: "var(--adm-card-shadow, none)" }}>
      <p style={{ fontFamily: F, fontSize: "1.8rem", color, margin: "0 0 4px", fontWeight: 700 }}>{value}</p>
      <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: 0 }}>{label}</p>
      {sub && <p style={{ fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text3)", margin: "4px 0 0" }}>{sub}</p>}
    </div>
  );
}

export default function AnalyticsDashboard() {
  const { restaurants, isSuper, selectedRestaurantId } = useAdminSession();
  const pathname = usePathname();
  const [restaurantId, setRestaurantId] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Detect base path for links
  const basePath = pathname.startsWith("/panel") ? "/panel" : "/admin";

  // For owners, use selectedRestaurantId
  const effectiveRid = isSuper ? restaurantId : (selectedRestaurantId || "");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ type: "metrics" });
    if (effectiveRid) params.set("restaurantId", effectiveRid);
    fetch(`/api/admin/analytics?${params}`).then((r) => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [effectiveRid]);

  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
  };

  const SUB_PAGES = [
    { label: "Funnel", href: `${basePath}/analytics/funnel`, icon: "🔻" },
    { label: "Tickets", href: `${basePath}/analytics/tickets`, icon: "🧾" },
    { label: "Ticket Trend", href: `${basePath}/analytics/ticket-trend`, icon: "📊" },
    { label: "Búsquedas", href: `${basePath}/analytics/searches`, icon: "🔍" },
    { label: "Genio", href: `${basePath}/analytics/genio`, icon: "🧞" },
  ];

  return (
    <div style={{ maxWidth: 800 }}>
      <div className="adm-flex-wrap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, gap: 10 }}>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: "var(--adm-accent)", margin: 0 }}>Analytics</h1>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "4px 0 0" }}>Métricas de visitas, sesiones y comportamiento de tus clientes</p>
        </div>
        {isSuper && (
          <select value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)} style={{ padding: "8px 12px", background: "var(--adm-select-bg)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text)", fontFamily: F, fontSize: "0.82rem", outline: "none" }}>
            <option value="" style={{ background: "var(--adm-select-bg)" }}>Todos los locales</option>
            {restaurants.map((r) => <option key={r.id} value={r.id} style={{ background: "var(--adm-select-bg)" }}>{r.name}</option>)}
          </select>
        )}
      </div>

      {/* Sub-navigation */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
        {SUB_PAGES.map((p) => (
          <Link key={p.href} href={p.href} style={{ padding: "8px 14px", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text2)", fontFamily: F, fontSize: "0.78rem", textDecoration: "none", fontWeight: 600 }}>
            {p.icon} {p.label}
          </Link>
        ))}
      </div>

      {loading ? (
        <p style={{ color: "var(--adm-accent)", fontFamily: F, fontSize: "0.85rem", textAlign: "center", padding: 40 }}>Cargando...</p>
      ) : data ? (
        <div className="adm-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Card label="Visitantes únicos" value={data.totalVisitors} color="var(--adm-accent)" />
          <Card label="% Recurrentes" value={`${data.returningPct}%`} sub={`${data.returningVisitors} de ${data.totalVisitors}`} color="var(--adm-positive)" />
          <Card label="% Conversión a registrado" value={`${data.conversionPct}%`} sub={`${data.convertedCount} convertidos`} color="#7fbfdc" />
          <Card label="Total sesiones" value={data.totalSessions} />
          <Card label="Duración promedio" value={formatDuration(data.avgDurationMs)} color="var(--adm-positive)" />
          <Card label="Platos vistos / sesión" value={data.avgDishesViewed} color="var(--adm-text)" />
        </div>
      ) : (
        <p style={{ color: "var(--adm-text2)", fontFamily: F, textAlign: "center", padding: 40 }}>Sin datos</p>
      )}
    </div>
  );
}
