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
function TabResumen({ rid, from, to }: { rid: string; from: string; to: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams({ type: "metrics", from, to });
    if (rid) p.set("restaurantId", rid);
    fetch(`/api/admin/analytics?${p}`).then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [rid, from, to]);

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
function TabPlatos({ rid, from, to }: { rid: string; from: string; to: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams({ type: "dishes", from, to });
    if (rid) p.set("restaurantId", rid);
    fetch(`/api/admin/analytics?${p}`).then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [rid, from, to]);

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
function TabClientes({ rid, from, to }: { rid: string; from: string; to: string }) {
  const [funnel, setFunnel] = useState<any>(null);
  const [genio, setGenio] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const p1 = new URLSearchParams({ type: "funnel", from, to });
    const p2 = new URLSearchParams({ type: "genio", from, to });
    if (rid) { p1.set("restaurantId", rid); p2.set("restaurantId", rid); }
    Promise.all([
      fetch(`/api/admin/analytics?${p1}`).then(r => r.json()),
      fetch(`/api/admin/analytics?${p2}`).then(r => r.json()),
    ]).then(([f, g]) => { setFunnel(f); setGenio(g); }).catch(() => {}).finally(() => setLoading(false));
  }, [rid, from, to]);

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
function TabGarzon({ rid, isSuper }: { rid: string; isSuper: boolean }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = rid ? `restaurantId=${rid}` : (isSuper ? "all=true" : "");
    if (!params) { setLoading(false); return; }
    fetch(`/api/admin/analytics-garzon?${params}`).then(r => r.json()).then(d => { if (!d.error) setData(d); }).catch(() => {}).finally(() => setLoading(false));
  }, [rid, isSuper]);

  if (loading) return <SkeletonLoading type="analytics" />;
  if (!data) return <p style={{ color: "var(--adm-text2)", fontFamily: F, textAlign: "center", padding: 40 }}>Sin datos de garzón</p>;

  const days = Object.entries(data.perDay || {});
  const maxDay = Math.max(...days.map(d => d[1] as number), 1);

  const formatTime = (sec: number) => sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${sec % 60}s`;
  const formatHour = (h: number) => `${h.toString().padStart(2, "0")}:00`;
  const GOLD = "#F4A623";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }} className="adm-grid-2">
        {[
          { label: "Hoy", value: data.today, color: GOLD },
          { label: "Semana", value: data.week },
          { label: "% Atendidos", value: `${data.answeredPct}%`, color: data.answeredPct >= 80 ? "#16a34a" : data.answeredPct >= 50 ? GOLD : "#ef4444" },
          { label: "Tiempo resp.", value: formatTime(data.avgResponseSec), color: data.avgResponseSec <= 120 ? "#16a34a" : GOLD },
        ].map((c, i) => (
          <Card key={i} label={c.label} value={c.value} color={c.color} />
        ))}
      </div>

      {/* Bar chart - calls per day */}
      {days.length > 0 && (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 20px", boxShadow: "var(--adm-card-shadow, none)" }}>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 14px", fontWeight: 600 }}>Llamados por día</p>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100 }}>
            {days.map(([date, count]) => {
              const dayName = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][new Date(date + "T12:00:00").getDay()];
              return (
                <div key={date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text2)" }}>{count as number}</span>
                  <div style={{ width: "100%", height: Math.max(4, ((count as number) / maxDay) * 80), background: (count as number) > 0 ? GOLD : "var(--adm-card-border)", borderRadius: 4 }} />
                  <span style={{ fontFamily: F, fontSize: "0.6rem", color: "var(--adm-text3)" }}>{dayName}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Two columns: top mesas + peak hours */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="adm-grid-2">
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 20px", boxShadow: "var(--adm-card-shadow, none)" }}>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 12px", fontWeight: 600 }}>Mesas más activas</p>
          {(data.topMesas || []).length > 0 ? data.topMesas.map((m: any, i: number) => (
            <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < data.topMesas.length - 1 ? "1px solid var(--adm-card-border)" : "none" }}>
              <span style={{ fontFamily: F, fontSize: "0.75rem", color: GOLD, fontWeight: 700, width: 20 }}>{i + 1}</span>
              <span style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text)", flex: 1 }}>{m.name}</span>
              <span style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)" }}>{m.count}x</span>
            </div>
          )) : <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)" }}>Sin datos</p>}
        </div>
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 20px", boxShadow: "var(--adm-card-shadow, none)" }}>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 12px", fontWeight: 600 }}>Horas punta</p>
          {(data.peakHours || []).length > 0 ? data.peakHours.map((h: any, i: number) => (
            <div key={h.hour} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < data.peakHours.length - 1 ? "1px solid var(--adm-card-border)" : "none" }}>
              <span style={{ fontFamily: F, fontSize: "0.82rem", color: GOLD, fontWeight: 600 }}>{formatHour(h.hour)}</span>
              <div style={{ flex: 1, height: 6, background: "var(--adm-card-border)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${(h.count / (data.peakHours[0]?.count || 1)) * 100}%`, height: "100%", background: GOLD, borderRadius: 3 }} />
              </div>
              <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)" }}>{h.count}</span>
            </div>
          )) : <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)" }}>Sin datos</p>}
        </div>
      </div>

      {/* Recent calls */}
      {(data.recent || []).length > 0 && (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 20px", boxShadow: "var(--adm-card-shadow, none)" }}>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 12px", fontWeight: 600 }}>Últimos llamados</p>
          {data.recent.map((c: any) => {
            const time = new Date(c.calledAt);
            const hhmm = `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}`;
            const dateStr = time.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
            return (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--adm-card-border)" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.answeredAt ? "#16a34a" : "#ef4444", flexShrink: 0 }} />
                <span style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text)", flex: 1 }}>{c.tableName || "Sin mesa"}</span>
                <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)" }}>{dateStr} {hhmm}</span>
                {c.responseTime !== null ? (
                  <span style={{ fontFamily: F, fontSize: "0.68rem", color: "#16a34a", fontWeight: 600 }}>{formatTime(c.responseTime)}</span>
                ) : (
                  <span style={{ fontFamily: F, fontSize: "0.68rem", color: "#ef4444" }}>Sin atender</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══ TAB: Búsquedas ═══ */
function TabBusquedas({ rid, from, to }: { rid: string; from: string; to: string }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams({ type: "searches", from, to });
    if (rid) p.set("restaurantId", rid);
    fetch(`/api/admin/analytics?${p}`).then(r => r.json()).then(d => setData(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoading(false));
  }, [rid, from, to]);

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

type DatePreset = "hoy" | "ayer" | "semana" | "custom";

function getDateRange(preset: DatePreset, customFrom?: string, customTo?: string): { from: string; to: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  if (preset === "hoy") return { from: fmt(today), to: fmt(today) };
  if (preset === "ayer") { const y = new Date(today); y.setDate(y.getDate() - 1); return { from: fmt(y), to: fmt(y) }; }
  if (preset === "semana") { const w = new Date(today); w.setDate(w.getDate() - 7); return { from: fmt(w), to: fmt(today) }; }
  return { from: customFrom || fmt(new Date(today.getTime() - 28 * 86400000)), to: customTo || fmt(today) };
}

export default function AnalyticsDashboard() {
  const { restaurants, isSuper, selectedRestaurantId } = useAdminSession();
  const [restaurantId, setRestaurantId] = useState("");
  const [tab, setTab] = useState<Tab>("resumen");
  const [datePreset, setDatePreset] = useState<DatePreset>("semana");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const effectiveRid = isSuper ? restaurantId : (selectedRestaurantId || "");
  const { from: dateFrom, to: dateTo } = getDateRange(datePreset, customFrom, customTo);

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

      {/* Date filters */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {(["hoy", "ayer", "semana"] as DatePreset[]).map(p => (
          <button key={p} onClick={() => setDatePreset(p)} style={{
            padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
            fontFamily: F, fontSize: "0.75rem", fontWeight: 600,
            background: datePreset === p ? "var(--adm-accent)" : "var(--adm-hover)",
            color: datePreset === p ? "#0a0a0a" : "var(--adm-text3)",
          }}>
            {p === "hoy" ? "Hoy" : p === "ayer" ? "Ayer" : "Esta semana"}
          </button>
        ))}
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input type="date" value={customFrom} onChange={e => { setCustomFrom(e.target.value); setDatePreset("custom"); }} style={{ padding: "5px 8px", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text)", fontFamily: F, fontSize: "0.72rem", outline: "none", colorScheme: "dark" }} />
          <span style={{ color: "var(--adm-text3)", fontSize: "0.72rem" }}>—</span>
          <input type="date" value={customTo} onChange={e => { setCustomTo(e.target.value); setDatePreset("custom"); }} style={{ padding: "5px 8px", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text)", fontFamily: F, fontSize: "0.72rem", outline: "none", colorScheme: "dark" }} />
        </div>
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
      {tab === "resumen" && <TabResumen rid={effectiveRid} from={dateFrom} to={dateTo} />}
      {tab === "platos" && <TabPlatos rid={effectiveRid} from={dateFrom} to={dateTo} />}
      {tab === "clientes" && <TabClientes rid={effectiveRid} from={dateFrom} to={dateTo} />}
      {tab === "garzon" && <TabGarzon rid={effectiveRid} isSuper={isSuper} />}
      {tab === "busquedas" && <TabBusquedas rid={effectiveRid} from={dateFrom} to={dateTo} />}
    </div>
  );
}
