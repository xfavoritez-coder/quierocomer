"use client";
import { useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import SkeletonLoading from "@/components/admin/SkeletonLoading";

const F = "var(--font-display)";
const FB = "var(--font-body)";

function Card({ label, value, sub, color = "var(--adm-accent)" }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "18px 20px", boxShadow: "var(--adm-card-shadow, none)" }}>
      <p style={{ fontFamily: F, fontSize: "1.8rem", color, margin: "0 0 4px", fontWeight: 700 }}>{value}</p>
      <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: 0 }}>{label}</p>
      {sub && <p style={{ fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text3)", margin: "4px 0 0" }}>{sub}</p>}
    </div>
  );
}

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
}

type Tab = "resumen" | "platos" | "clientes" | "garzon" | "busquedas";

/* ═══ TAB: Resumen ═══ */
function TabResumen({ rid }: { rid: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams({ type: "metrics" });
    if (rid) p.set("restaurantId", rid);
    fetch(`/api/admin/analytics?${p}`).then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [rid]);

  if (loading) return <SkeletonLoading type="analytics" />;
  if (!data) return <p style={{ color: "var(--adm-text2)", fontFamily: F, textAlign: "center", padding: 40 }}>Sin datos</p>;

  return (
    <div className="adm-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <Card label="Visitantes únicos" value={data.totalVisitors} />
      <Card label="Total sesiones" value={data.totalSessions} />
      <Card label="% Recurrentes" value={`${data.returningPct}%`} sub={`${data.returningVisitors} de ${data.totalVisitors}`} color="var(--adm-positive)" />
      <Card label="% Conversión a registrado" value={`${data.conversionPct}%`} sub={`${data.convertedCount} convertidos`} color="#7fbfdc" />
      <Card label="Duración promedio" value={formatDuration(data.avgDurationMs)} color="var(--adm-positive)" />
      <Card label="Platos vistos / sesión" value={data.avgDishesViewed} color="var(--adm-text)" />
    </div>
  );
}

/* ═══ TAB: Platos ═══ */
function TabPlatos({ rid }: { rid: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams({ type: "dishes" });
    if (rid) p.set("restaurantId", rid);
    fetch(`/api/admin/analytics?${p}`).then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [rid]);

  if (loading) return <SkeletonLoading type="list" />;
  if (!data) return <p style={{ color: "var(--adm-text2)", fontFamily: F, textAlign: "center", padding: 40 }}>Sin datos</p>;

  const sections = [
    { title: "Más vistos en la carta", items: data.mostViewed || [], icon: "👀" },
    { title: "Más abiertos en detalle", items: data.mostDetailed || [], icon: "🔍" },
    { title: "Recomendados por el Genio", items: data.genioRecommended || [], icon: "🧞" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {sections.map(s => (
        <div key={s.title} style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 18px", boxShadow: "var(--adm-card-shadow, none)" }}>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 12px", fontWeight: 600 }}>{s.icon} {s.title}</p>
          {s.items.length === 0 ? (
            <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)", margin: 0 }}>Sin datos suficientes</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {s.items.slice(0, 10).map((d: any, i: number) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", width: 18, textAlign: "right", flexShrink: 0 }}>{i + 1}.</span>
                  {d.photo && <img src={d.photo} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />}
                  <span style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
                  <span style={{ fontFamily: F, fontSize: "0.75rem", color: "var(--adm-accent)", fontWeight: 600, flexShrink: 0 }}>{d.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ═══ TAB: Clientes ═══ */
function TabClientes({ rid }: { rid: string }) {
  const [funnel, setFunnel] = useState<any>(null);
  const [genio, setGenio] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const p1 = new URLSearchParams({ type: "funnel" });
    const p2 = new URLSearchParams({ type: "genio" });
    if (rid) { p1.set("restaurantId", rid); p2.set("restaurantId", rid); }
    Promise.all([
      fetch(`/api/admin/analytics?${p1}`).then(r => r.json()),
      fetch(`/api/admin/analytics?${p2}`).then(r => r.json()),
    ]).then(([f, g]) => { setFunnel(f); setGenio(g); }).catch(() => {}).finally(() => setLoading(false));
  }, [rid]);

  if (loading) return <SkeletonLoading type="analytics" />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Funnel */}
      {funnel && (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 18px", boxShadow: "var(--adm-card-shadow, none)" }}>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 14px", fontWeight: 600 }}>Embudo de conversión</p>
          {[
            { label: "Visitantes únicos", value: funnel.totalVisitors, pct: 100, color: "var(--adm-accent)" },
            { label: "Recurrentes", value: funnel.returningVisitors, pct: funnel.returningPct, color: "#3db89e" },
            { label: "Se registraron", value: funnel.convertedCount, pct: funnel.conversionPct, color: "#7fbfdc" },
          ].map((step, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text)" }}>{step.label}</span>
                <span style={{ fontFamily: F, fontSize: "0.78rem", color: step.color, fontWeight: 600 }}>{step.value} ({step.pct}%)</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: "var(--adm-card-border)" }}>
                <div style={{ height: "100%", width: `${step.pct}%`, borderRadius: 3, background: step.color, transition: "width 0.5s ease" }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Genio impact */}
      {genio && (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 18px", boxShadow: "var(--adm-card-shadow, none)" }}>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 14px", fontWeight: 600 }}>🧞 Impacto del Genio</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: "8px 12px", alignItems: "center" }}>
            <span style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)" }}></span>
            <span style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", textAlign: "center" }}>Sin Genio</span>
            <span style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", textAlign: "center" }}>Con Genio</span>
            <span style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", textAlign: "center" }}>Cambio</span>
            {[
              { label: "Platos vistos", without: genio.withoutGenio?.avgDishes, with: genio.withGenio?.avgDishes },
              { label: "Duración", without: genio.withoutGenio?.avgDurationMs ? formatDuration(genio.withoutGenio.avgDurationMs) : "-", with: genio.withGenio?.avgDurationMs ? formatDuration(genio.withGenio.avgDurationMs) : "-" },
              { label: "Conversión", without: `${genio.withoutGenio?.conversionPct || 0}%`, with: `${genio.withGenio?.conversionPct || 0}%` },
            ].map((row, i) => {
              const wVal = typeof row.without === "number" ? row.without : parseFloat(String(row.without));
              const cVal = typeof row.with === "number" ? row.with : parseFloat(String(row.with));
              const change = !isNaN(wVal) && !isNaN(cVal) && wVal > 0 ? Math.round(((cVal - wVal) / wVal) * 100) : null;
              return [
                <span key={`l${i}`} style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text)" }}>{row.label}</span>,
                <span key={`w${i}`} style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text2)", textAlign: "center" }}>{row.without}</span>,
                <span key={`c${i}`} style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-accent)", textAlign: "center", fontWeight: 600 }}>{row.with}</span>,
                <span key={`d${i}`} style={{ fontFamily: F, fontSize: "0.75rem", textAlign: "center", fontWeight: 600, color: change !== null && change >= 0 ? "#4ade80" : "#ef4444" }}>{change !== null ? `${change > 0 ? "+" : ""}${change}%` : "-"}</span>,
              ];
            })}
          </div>
        </div>
      )}

      {/* Vista preferences */}
      <div className="adm-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Card label="Idioma más usado" value={funnel?.topLang || "es"} color="var(--adm-text)" />
        <Card label="Usaron el Genio" value={genio?.withGenio?.count || 0} sub={genio?.totalSessions ? `de ${genio.totalSessions} sesiones` : undefined} color="var(--adm-accent)" />
      </div>
    </div>
  );
}

/* ═══ TAB: Garzón ═══ */
function TabGarzon({ rid }: { rid: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!rid) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/admin/analytics-garzon?restaurantId=${rid}`).then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [rid]);

  if (loading) return <SkeletonLoading type="analytics" />;
  if (!data) return <p style={{ color: "var(--adm-text2)", fontFamily: F, textAlign: "center", padding: 40 }}>Sin datos de garzón</p>;

  const answeredPct = data.totalCalls > 0 ? Math.round((data.answeredCalls / data.totalCalls) * 100) : 0;
  const avgResponse = data.avgResponseTimeSec ? `${Math.floor(data.avgResponseTimeSec / 60)}m ${data.avgResponseTimeSec % 60}s` : "-";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="adm-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Card label="Llamadas hoy" value={data.todayCalls || 0} />
        <Card label="Llamadas esta semana" value={data.weekCalls || 0} />
        <Card label="% Atendidas" value={`${answeredPct}%`} color={answeredPct > 80 ? "#4ade80" : answeredPct > 50 ? "var(--adm-accent)" : "#ef4444"} />
        <Card label="Tiempo promedio respuesta" value={avgResponse} color={data.avgResponseTimeSec && data.avgResponseTimeSec < 120 ? "#4ade80" : "var(--adm-accent)"} />
      </div>

      {/* Calls by day */}
      {data.byDay && data.byDay.length > 0 && (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 18px", boxShadow: "var(--adm-card-shadow, none)" }}>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 12px", fontWeight: 600 }}>Llamadas por día</p>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 80 }}>
            {data.byDay.map((d: any, i: number) => {
              const max = Math.max(...data.byDay.map((x: any) => x.count));
              const h = max > 0 ? (d.count / max) * 100 : 0;
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontFamily: F, fontSize: "0.62rem", color: "var(--adm-text3)" }}>{d.count}</span>
                  <div style={{ width: "100%", height: `${h}%`, minHeight: 2, background: "var(--adm-accent)", borderRadius: 4 }} />
                  <span style={{ fontFamily: F, fontSize: "0.6rem", color: "var(--adm-text3)" }}>{d.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top tables */}
      {data.topTables && data.topTables.length > 0 && (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 18px", boxShadow: "var(--adm-card-shadow, none)" }}>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 10px", fontWeight: 600 }}>Mesas más activas</p>
          {data.topTables.slice(0, 5).map((t: any, i: number) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--adm-card-border)" }}>
              <span style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text)" }}>{t.name || `Mesa ${i + 1}`}</span>
              <span style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-accent)", fontWeight: 600 }}>{t.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══ TAB: Búsquedas ═══ */
function TabBusquedas({ rid }: { rid: string }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams({ type: "searches" });
    if (rid) p.set("restaurantId", rid);
    fetch(`/api/admin/analytics?${p}`).then(r => r.json()).then(d => setData(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoading(false));
  }, [rid]);

  if (loading) return <SkeletonLoading type="list" />;

  return (
    <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 18px", boxShadow: "var(--adm-card-shadow, none)" }}>
      <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 12px", fontWeight: 600 }}>🔍 Qué buscan tus clientes</p>
      {data.length === 0 ? (
        <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", textAlign: "center", padding: 20 }}>Sin búsquedas registradas</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {data.slice(0, 20).map((s: any, i: number) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--adm-card-border)" }}>
              <span style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text)", flex: 1 }}>"{s.query}"</span>
              <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", flexShrink: 0 }}>{s.count}x</span>
              <span style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", flexShrink: 0 }}>{s.uniqueVisitors} visitor{s.uniqueVisitors !== 1 ? "es" : ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══ MAIN ═══ */
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "resumen", label: "Resumen", icon: "📊" },
  { key: "platos", label: "Platos", icon: "🍽️" },
  { key: "clientes", label: "Clientes", icon: "👥" },
  { key: "garzon", label: "Garzón", icon: "🔔" },
  { key: "busquedas", label: "Búsquedas", icon: "🔍" },
];

export default function AnalyticsDashboard() {
  const { restaurants, isSuper, selectedRestaurantId } = useAdminSession();
  const [restaurantId, setRestaurantId] = useState("");
  const [tab, setTab] = useState<Tab>("resumen");

  const effectiveRid = isSuper ? restaurantId : (selectedRestaurantId || "");

  return (
    <div style={{ maxWidth: 800 }}>
      <div className="adm-flex-wrap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 10 }}>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: "var(--adm-accent)", margin: 0 }}>Analytics</h1>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "4px 0 0" }}>Métricas de tu restaurante</p>
        </div>
        {isSuper && (
          <select value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)} style={{ padding: "8px 12px", background: "var(--adm-select-bg)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text)", fontFamily: F, fontSize: "0.82rem", outline: "none" }}>
            <option value="" style={{ background: "var(--adm-select-bg)" }}>Todos los locales</option>
            {restaurants.map((r) => <option key={r.id} value={r.id} style={{ background: "var(--adm-select-bg)" }}>{r.name}</option>)}
          </select>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, overflowX: "auto", scrollbarWidth: "none" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "8px 16px", borderRadius: 10, border: "none", cursor: "pointer",
            fontFamily: F, fontSize: "0.78rem", fontWeight: 600, whiteSpace: "nowrap",
            background: tab === t.key ? "var(--adm-accent)" : "var(--adm-hover)",
            color: tab === t.key ? "#0a0a0a" : "var(--adm-text2)",
            transition: "all 0.15s",
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "resumen" && <TabResumen rid={effectiveRid} />}
      {tab === "platos" && <TabPlatos rid={effectiveRid} />}
      {tab === "clientes" && <TabClientes rid={effectiveRid} />}
      {tab === "garzon" && <TabGarzon rid={effectiveRid} />}
      {tab === "busquedas" && <TabBusquedas rid={effectiveRid} />}
    </div>
  );
}
