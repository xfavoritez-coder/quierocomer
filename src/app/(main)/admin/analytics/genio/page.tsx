"use client";
import { useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import Link from "next/link";

const F = "var(--font-display)";

function CompareRow({ label, without, withG, unit = "" }: { label: string; without: number; withG: number; unit?: string }) {
  const diff = without > 0 ? Math.round(((withG - without) / without) * 100) : withG > 0 ? 100 : 0;
  const diffColor = diff > 0 ? "#4ade80" : diff < 0 ? "#ff6b6b" : "#888";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 80px", gap: 8, padding: "14px 16px", background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 12, alignItems: "center" }}>
      <div style={{ fontFamily: F, fontSize: "0.82rem", color: "#aaa" }}>{label}</div>
      <div style={{ fontFamily: F, fontSize: "1rem", color: "#888", fontWeight: 600, textAlign: "center" }}>{without}{unit}</div>
      <div style={{ fontFamily: F, fontSize: "1rem", color: "#F4A623", fontWeight: 700, textAlign: "center" }}>{withG}{unit}</div>
      <div style={{ fontFamily: F, fontSize: "0.85rem", color: diffColor, fontWeight: 700, textAlign: "right" }}>{diff > 0 ? "+" : ""}{diff}%</div>
    </div>
  );
}

export default function GenioImpactPage() {
  const { restaurants } = useAdminSession();
  const [restaurantId, setRestaurantId] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ type: "genio" });
    if (restaurantId) params.set("restaurantId", restaurantId);
    fetch(`/api/admin/analytics?${params}`).then((r) => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [restaurantId]);

  const fmt = (ms: number) => { const s = Math.floor(ms / 1000); return s >= 60 ? `${Math.floor(s / 60)}m${s % 60}s` : `${s}s`; };

  return (
    <div style={{ maxWidth: 700 }}>
      <div className="adm-flex-wrap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, gap: 10 }}>
        <div>
          <Link href="/admin/analytics" style={{ fontFamily: F, fontSize: "0.78rem", color: "#888", textDecoration: "none" }}>← Analytics</Link>
          <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: "#F4A623", margin: "8px 0 0" }}>🧞 Impacto del Genio</h1>
        </div>
        <select value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)} style={{ padding: "8px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 10, color: "white", fontFamily: F, fontSize: "0.82rem", outline: "none" }}>
          <option value="" style={{ background: "#1A1A1A" }}>Todos</option>
          {restaurants.map((r) => <option key={r.id} value={r.id} style={{ background: "#1A1A1A" }}>{r.name}</option>)}
        </select>
      </div>

      {loading ? (
        <p style={{ color: "#F4A623", fontFamily: F, textAlign: "center", padding: 40 }}>Cargando...</p>
      ) : data ? (
        <>
          {/* Header row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 80px", gap: 8, padding: "10px 16px", marginBottom: 8 }}>
            <div style={{ fontFamily: F, fontSize: "0.7rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.08em" }}>Métrica</div>
            <div style={{ fontFamily: F, fontSize: "0.7rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>Sin Genio ({data.withoutGenio.sessionCount})</div>
            <div style={{ fontFamily: F, fontSize: "0.7rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>Con Genio ({data.withGenio.sessionCount})</div>
            <div style={{ fontFamily: F, fontSize: "0.7rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "right" }}>Δ</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <CompareRow label="Platos vistos" without={data.withoutGenio.avgDishesViewed} withG={data.withGenio.avgDishesViewed} />
            <CompareRow label="Duración sesión" without={parseFloat(fmt(data.withoutGenio.avgDurationMs))} withG={parseFloat(fmt(data.withGenio.avgDurationMs))} />
            <CompareRow label="Conversión" without={data.withoutGenio.conversionRate} withG={data.withGenio.conversionRate} unit="%" />
            <CompareRow label="Tasa retorno" without={data.withoutGenio.returnRate} withG={data.withGenio.returnRate} unit="%" />
          </div>
        </>
      ) : null}
    </div>
  );
}
