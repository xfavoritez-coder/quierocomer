"use client";
import { useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import Link from "next/link";

const F = "var(--font-display)";

function StatCard({ label, value, sub, color = "#F4A623" }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ padding: "16px", background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 12 }}>
      <div style={{ fontFamily: F, fontSize: "0.72rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: F, fontSize: "1.5rem", fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontFamily: F, fontSize: "0.72rem", color: "#666", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function BarRow({ label, value, max, color = "#F4A623" }: { label: string; value: number; max: number; color?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
      <span style={{ fontFamily: F, fontSize: "0.78rem", color: "#aaa", width: 120, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ flex: 1, height: 8, background: "#222", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.3s" }} />
      </div>
      <span style={{ fontFamily: F, fontSize: "0.75rem", color: "#888", width: 40, textAlign: "right", flexShrink: 0 }}>{value}</span>
    </div>
  );
}

function getDatePresets() {
  const today = new Date();
  const yyyy = (d: Date) => d.toISOString().split("T")[0];
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  return {
    today: { from: yyyy(today), to: yyyy(today) },
    yesterday: { from: yyyy(yesterday), to: yyyy(yesterday) },
    week: { from: yyyy(weekStart), to: yyyy(today) },
    month: { from: yyyy(new Date(today.getFullYear(), today.getMonth(), 1)), to: yyyy(today) },
  };
}

export default function PersonalizationPage() {
  const { restaurants } = useAdminSession();
  const [restaurantId, setRestaurantId] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const presets = getDatePresets();
  const [from, setFrom] = useState(presets.week.from);
  const [to, setTo] = useState(presets.week.to);
  const [activePreset, setActivePreset] = useState("week");

  const applyPreset = (key: string) => {
    const p = (presets as any)[key];
    setFrom(p.from); setTo(p.to); setActivePreset(key);
  };

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ type: "personalization", from, to });
    if (restaurantId) params.set("restaurantId", restaurantId);
    fetch(`/api/admin/analytics?${params}`).then((r) => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [restaurantId, from, to]);

  return (
    <div style={{ maxWidth: 700 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 10, flexWrap: "wrap" }}>
        <div>
          <Link href="/admin/analytics" style={{ fontFamily: F, fontSize: "0.78rem", color: "#888", textDecoration: "none" }}>← Analytics</Link>
          <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: "#F4A623", margin: "8px 0 0" }}>✨ Personalización</h1>
        </div>
        <select value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)} style={{ padding: "8px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 10, color: "white", fontFamily: F, fontSize: "0.82rem", outline: "none" }}>
          <option value="" style={{ background: "#1A1A1A" }}>Todos</option>
          {restaurants.map((r) => <option key={r.id} value={r.id} style={{ background: "#1A1A1A" }}>{r.name}</option>)}
        </select>
      </div>

      {/* Date filters */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        {[
          { key: "today", label: "Hoy" },
          { key: "yesterday", label: "Ayer" },
          { key: "week", label: "Esta semana" },
          { key: "month", label: "Este mes" },
        ].map((p) => (
          <button key={p.key} onClick={() => applyPreset(p.key)} style={{ padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: F, fontSize: "0.75rem", fontWeight: 600, background: activePreset === p.key ? "rgba(244,166,35,0.15)" : "rgba(255,255,255,0.04)", color: activePreset === p.key ? "#F4A623" : "#888" }}>
            {p.label}
          </button>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 4 }}>
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setActivePreset(""); }} style={{ padding: "5px 8px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 6, color: "white", fontFamily: F, fontSize: "0.72rem" }} />
          <span style={{ color: "#666", fontSize: "0.72rem" }}>–</span>
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setActivePreset(""); }} style={{ padding: "5px 8px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 6, color: "white", fontFamily: F, fontSize: "0.72rem" }} />
        </div>
      </div>

      {loading ? (
        <p style={{ color: "#F4A623", fontFamily: F, textAlign: "center", padding: 40 }}>Cargando...</p>
      ) : data ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Recomendaciones "Para ti" */}
          <section>
            <h2 style={{ fontFamily: F, fontSize: "0.88rem", color: "white", fontWeight: 700, marginBottom: 12 }}>Recomendaciones &ldquo;Para ti&rdquo;</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
              <StatCard label="Mostradas" value={data.recommendations.shown} />
              <StatCard label="Tocadas" value={data.recommendations.tapped} color="#4ade80" />
              <StatCard label="CTR" value={`${data.recommendations.ctr}%`} color={data.recommendations.ctr >= 20 ? "#4ade80" : data.recommendations.ctr >= 10 ? "#F4A623" : "#ff6b6b"} />
            </div>
            {data.recommendations.topDishes.length > 0 && (
              <>
                <h3 style={{ fontFamily: F, fontSize: "0.75rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Top platos recomendados</h3>
                {data.recommendations.topDishes.map((d: any) => (
                  <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #1A1A1A" }}>
                    <span style={{ fontFamily: F, fontSize: "0.78rem", color: "#aaa", flex: 1 }}>{d.name}</span>
                    <span style={{ fontFamily: F, fontSize: "0.68rem", color: "#F4A623" }}>{d.shown} vistas</span>
                    <span style={{ fontFamily: F, fontSize: "0.68rem", color: "#4ade80" }}>{d.tapped} clicks</span>
                    <span style={{ fontFamily: F, fontSize: "0.68rem", color: d.shown > 0 ? "#888" : "#444" }}>{d.shown > 0 ? Math.round((d.tapped / d.shown) * 100) : 0}%</span>
                  </div>
                ))}
              </>
            )}
          </section>

          {/* Onboarding Genio */}
          <section>
            <h2 style={{ fontFamily: F, fontSize: "0.88rem", color: "white", fontWeight: 700, marginBottom: 12 }}>🧞 Onboarding Genio</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <StatCard label="Iniciaron" value={data.onboarding.started} color="#888" />
              <StatCard label="Completaron" value={data.onboarding.completed} color="#4ade80" />
              <StatCard label="Tasa completación" value={`${data.onboarding.completionRate}%`} color={data.onboarding.completionRate >= 60 ? "#4ade80" : "#F4A623"} />
            </div>
          </section>

          {/* Perfil del comensal */}
          <section>
            <h2 style={{ fontFamily: F, fontSize: "0.88rem", color: "white", fontWeight: 700, marginBottom: 12 }}>👤 Perfil del comensal ({data.audience.totalProfiles} perfiles)</h2>
            {data.audience.diets.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontFamily: F, fontSize: "0.75rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Distribución de dietas</h3>
                {data.audience.diets.map((d: any) => (
                  <BarRow key={d.name} label={d.name === "vegan" ? "🌿 Vegano" : d.name === "vegetarian" ? "🌱 Vegetariano" : "🍖 Omnívoro"} value={d.count} max={data.audience.totalProfiles} color={d.name === "vegan" ? "#4ade80" : d.name === "vegetarian" ? "#86efac" : "#F4A623"} />
                ))}
              </div>
            )}
            {data.audience.restrictions.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontFamily: F, fontSize: "0.75rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Restricciones más comunes</h3>
                {data.audience.restrictions.map((r: any) => (
                  <BarRow key={r.name} label={r.name} value={r.count} max={data.audience.restrictions[0]?.count || 1} color="#ff6b6b" />
                ))}
              </div>
            )}
          </section>

          {/* Ingredientes favoritos */}
          {data.audience.topIngredients.length > 0 && (
            <section>
              <h2 style={{ fontFamily: F, fontSize: "0.88rem", color: "white", fontWeight: 700, marginBottom: 12 }}>🔥 Ingredientes favoritos del público</h2>
              {data.audience.topIngredients.map((ing: any) => (
                <BarRow key={ing.name} label={ing.name} value={ing.score} max={data.audience.topIngredients[0]?.score || 1} />
              ))}
            </section>
          )}

          {/* Favoritos */}
          <section>
            <h2 style={{ fontFamily: F, fontSize: "0.88rem", color: "white", fontWeight: 700, marginBottom: 12 }}>👍 Favoritos</h2>
            <StatCard label="Total me gusta en el período" value={data.favorites.total} color="#F4A623" />
          </section>
        </div>
      ) : null}
    </div>
  );
}
