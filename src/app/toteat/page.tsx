"use client";

import { useEffect, useState } from "react";

interface ProductRow {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
  category: string | null;
}

interface HourBucket {
  hour: number;
  orderCount: number;
  totalSales: number;
  totalRevenue: number;
  products: ProductRow[];
}

interface Data {
  date: string;
  totalOrders: number;
  totalRevenue: number;
  hours: HourBucket[];
  top: ProductRow[];
  error?: string;
}

interface CrossRow {
  qcDishId: string;
  name: string;
  category: string | null;
  photo: string | null;
  qcViews: number;
  qcDetails: number;
  avgDetailMs: number;
  toteatId: string | null;
  toteatName: string | null;
  matchScore: number;
  sales: number;
  revenue: number;
  conversionPct: number | null;
}

interface CrossOrphan {
  toteatId: string;
  name: string;
  category: string | null;
  sales: number;
  revenue: number;
}

interface CrossData {
  date: string;
  restaurant: string;
  summary: {
    qcSessions: number;
    totalQcViews: number;
    totalSales: number;
    matched: number;
    qcDishesNotMatched: number;
    orphanToteatProducts: number;
  };
  insights: {
    seenNotSold: CrossRow[];
    soldNotSeen: CrossRow[];
    bestConverters: CrossRow[];
  };
  rows: CrossRow[];
  orphans: CrossOrphan[];
  error?: string;
}

interface BadgeItem {
  qcDishId: string;
  name: string;
  category: string | null;
  photo: string | null;
  sales: number;
  revenue: number;
  matched: boolean;
}
interface BadgeStats {
  count: number;
  sold: number;
  alsoTopSeller: number;
  hitRate: number;
  avgSalesIn: number;
  avgSalesOut: number;
  lift: number | null;
  sharePct: number;
  items: BadgeItem[];
}
interface BadgeAccuracy {
  date: string;
  totalSales: number;
  popular: BadgeStats;
  recommended: BadgeStats;
  error?: string;
}

const CLP = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");
const PAD2 = (n: number) => n.toString().padStart(2, "0");

export default function ToteatPage() {
  const [data, setData] = useState<Data | null>(null);
  const [cross, setCross] = useState<CrossData | null>(null);
  const [badges, setBadges] = useState<BadgeAccuracy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch("/api/toteat/sales-today", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/toteat/cross-today", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/toteat/badge-accuracy", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([d, c, b]) => {
        if (d.error) setError(d.error);
        else setData(d);
        if (!c.error) setCross(c);
        if (!b.error) setBadges(b);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const maxHourQty = data ? Math.max(...data.hours.map((h) => h.totalSales), 1) : 1;
  const maxTopQty = data && data.top[0] ? data.top[0].quantity : 1;

  return (
    <div style={{ minHeight: "100dvh", background: "#0e0e10", color: "#fff", fontFamily: "system-ui, -apple-system, sans-serif", padding: "24px 20px 60px" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h1 style={{ margin: 0, fontSize: 26, letterSpacing: -0.5 }}>📊 Toteat · Ventas de hoy</h1>
          <button onClick={load} disabled={loading} style={{ padding: "8px 16px", background: "#F4A623", color: "#000", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.6 : 1 }}>
            {loading ? "Cargando…" : "Actualizar"}
          </button>
        </div>
        <p style={{ color: "#888", fontSize: 13, margin: "6px 0 24px" }}>
          {data ? `Datos del ${data.date}` : "Conectando con Toteat…"}
        </p>

        {error && (
          <div style={{ padding: 16, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, marginBottom: 20 }}>
            <p style={{ color: "#fca5a5", margin: 0, fontSize: 14 }}>⚠️ {error}</p>
          </div>
        )}

        {data && data.totalOrders === 0 && !error && (
          <div style={{ padding: 24, background: "#1a1a1d", borderRadius: 12, textAlign: "center", color: "#888" }}>
            Aún no hay ventas registradas hoy.
          </div>
        )}

        {data && data.totalOrders > 0 && (
          <>
            {/* Summary */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 28 }}>
              <Stat label="Órdenes cerradas" value={String(data.totalOrders)} />
              <Stat label="Ingreso total" value={CLP(data.totalRevenue)} />
              <Stat label="Productos vendidos" value={String(data.hours.reduce((s, h) => s + h.totalSales, 0))} />
            </div>

            {/* Top 10 of the day */}
            <Section title="🏆 Top 10 productos del día">
              {data.top.map((p, i) => {
                const pct = (p.quantity / maxTopQty) * 100;
                return (
                  <div key={p.id} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 14 }}>
                        <span style={{ color: "#F4A623", fontWeight: 700, marginRight: 8 }}>#{i + 1}</span>
                        {p.name}
                        {p.category && <span style={{ color: "#666", fontSize: 12, marginLeft: 6 }}>· {p.category}</span>}
                      </span>
                      <span style={{ fontSize: 13, color: "#888" }}>
                        <span style={{ color: "#F4A623", fontWeight: 700 }}>{p.quantity}</span>
                        <span style={{ marginLeft: 8 }}>{CLP(p.revenue)}</span>
                      </span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: "#222" }}>
                      <div style={{ width: `${pct}%`, height: "100%", borderRadius: 2, background: i === 0 ? "#F4A623" : "rgba(244,166,35,0.5)" }} />
                    </div>
                  </div>
                );
              })}
            </Section>

            {/* Badge accuracy */}
            {badges && (
              <>
                <h2 style={{ fontSize: 18, marginTop: 32, marginBottom: 6 }}>🎯 Acierto de las señales</h2>
                <p style={{ color: "#888", fontSize: 12, margin: "0 0 14px" }}>
                  ¿Lo que destacamos al cliente coincide con lo que realmente vende?
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                  <BadgeCard title="Algoritmo Popular" subtitle="badge automático según vistas (rolling 48h)" stats={badges.popular} accentColor="#a78bfa" />
                  <BadgeCard title="Selección del Dueño" subtitle="platos marcados con ⭐ destacado" stats={badges.recommended} accentColor="#F4A623" />
                </div>
              </>
            )}

            {/* Cross QC vs Toteat */}
            {cross && (
              <>
                <h2 style={{ fontSize: 18, marginTop: 32, marginBottom: 6 }}>🔀 Carta vs Caja (hoy)</h2>
                <p style={{ color: "#888", fontSize: 12, margin: "0 0 14px" }}>
                  {cross.summary.qcSessions} sesiones · {cross.summary.totalQcViews} vistas en carta · {cross.summary.totalSales} unidades vendidas · {cross.summary.matched} platos cruzados, {cross.summary.qcDishesNotMatched} sin venta · {cross.summary.orphanToteatProducts} productos vendidos fuera del menú QC
                </p>

                {/* Insights cards */}
                {cross.insights.seenNotSold.length > 0 && (
                  <div style={{ background: "#291816", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
                    <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#fca5a5" }}>👻 Platos fantasma — los miran pero no los compran</p>
                    {cross.insights.seenNotSold.map((p) => (
                      <div key={p.qcDishId} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, borderBottom: "1px dashed #3a2826" }}>
                        <span>
                          {p.name}
                          {p.category && <span style={{ color: "#666", fontSize: 11, marginLeft: 6 }}>· {p.category}</span>}
                        </span>
                        <span style={{ color: "#fca5a5" }}>
                          <span style={{ fontWeight: 700 }}>{p.qcViews}</span> vistas
                          {p.avgDetailMs > 0 && <span style={{ color: "#888", marginLeft: 8 }}>{Math.round(p.avgDetailMs / 1000)}s en detalle</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {cross.insights.bestConverters.length > 0 && (
                  <div style={{ background: "#0f2417", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
                    <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#86efac" }}>🎯 Mejores conversiones — los ven y los piden</p>
                    {cross.insights.bestConverters.map((p) => (
                      <div key={p.qcDishId} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, borderBottom: "1px dashed #1a3a25" }}>
                        <span>
                          {p.name}
                          {p.category && <span style={{ color: "#666", fontSize: 11, marginLeft: 6 }}>· {p.category}</span>}
                        </span>
                        <span style={{ color: "#86efac" }}>
                          <span style={{ fontWeight: 700 }}>{p.conversionPct}%</span>
                          <span style={{ color: "#888", marginLeft: 8 }}>{p.sales} de {p.qcViews} vistas</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {cross.orphans.length > 0 && (
                  <div style={{ background: "#1a1a1d", border: "1px solid #2a2a2d", borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
                    <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "#fbbf24" }}>📦 Vendidos sin estar en QC ({cross.orphans.length})</p>
                    <p style={{ margin: "0 0 10px", fontSize: 11, color: "#666" }}>Posiblemente: combos, salsas/extras, modificadores, o platos que aún no están en la carta digital</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {cross.orphans.slice(0, 12).map((o) => (
                        <span key={o.toteatId} style={{ background: "#262629", color: "#bbb", fontSize: 11, padding: "3px 8px", borderRadius: 6 }}>
                          {o.name} <span style={{ color: "#888", marginLeft: 4 }}>×{o.sales}</span>
                        </span>
                      ))}
                      {cross.orphans.length > 12 && <span style={{ color: "#666", fontSize: 11 }}>+{cross.orphans.length - 12} más</span>}
                    </div>
                  </div>
                )}

                {/* Full table */}
                <details style={{ background: "#1a1a1d", border: "1px solid #2a2a2d", borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
                  <summary style={{ cursor: "pointer", listStyle: "none", fontSize: 13, color: "#bbb", fontWeight: 600 }}>
                    📋 Tabla completa por plato ({cross.rows.length}) — click para expandir
                  </summary>
                  <div style={{ marginTop: 12, overflowX: "auto" }}>
                    <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ color: "#888", textAlign: "left", borderBottom: "1px solid #2a2a2d" }}>
                          <th style={{ padding: "8px 6px", fontWeight: 600 }}>Plato</th>
                          <th style={{ padding: "8px 6px", fontWeight: 600, textAlign: "right" }}>Vistas</th>
                          <th style={{ padding: "8px 6px", fontWeight: 600, textAlign: "right" }}>Detalles</th>
                          <th style={{ padding: "8px 6px", fontWeight: 600, textAlign: "right" }}>Ventas</th>
                          <th style={{ padding: "8px 6px", fontWeight: 600, textAlign: "right" }}>Conv.</th>
                          <th style={{ padding: "8px 6px", fontWeight: 600, textAlign: "right" }}>Ingreso</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cross.rows.map((r) => {
                          const flag = r.qcViews >= 3 && r.sales === 0 ? "👻" : r.sales > 0 && (r.conversionPct || 0) >= 30 ? "🎯" : "";
                          return (
                            <tr key={r.qcDishId} style={{ borderBottom: "1px dashed #2a2a2d" }}>
                              <td style={{ padding: "6px" }}>
                                {flag && <span style={{ marginRight: 4 }}>{flag}</span>}
                                {r.name}
                                {r.category && <div style={{ color: "#555", fontSize: 10 }}>{r.category}</div>}
                              </td>
                              <td style={{ padding: "6px", textAlign: "right" }}>{r.qcViews}</td>
                              <td style={{ padding: "6px", textAlign: "right" }}>{r.qcDetails}</td>
                              <td style={{ padding: "6px", textAlign: "right", color: r.sales > 0 ? "#F4A623" : "#444", fontWeight: 700 }}>{r.sales}</td>
                              <td style={{ padding: "6px", textAlign: "right", color: r.conversionPct !== null ? (r.conversionPct >= 30 ? "#86efac" : r.conversionPct >= 10 ? "#bbb" : "#fca5a5") : "#444" }}>
                                {r.conversionPct !== null ? `${r.conversionPct}%` : "—"}
                              </td>
                              <td style={{ padding: "6px", textAlign: "right", color: "#888" }}>{r.revenue > 0 ? CLP(r.revenue) : "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </details>
              </>
            )}

            {/* Hour by hour breakdown */}
            <h2 style={{ fontSize: 18, marginTop: 32, marginBottom: 16 }}>🕐 Por hora</h2>
            {data.hours.map((h) => {
              const pct = (h.totalSales / maxHourQty) * 100;
              return (
                <details key={h.hour} open={h.totalSales >= maxHourQty * 0.5} style={{ background: "#1a1a1d", border: "1px solid #2a2a2d", borderRadius: 12, padding: "12px 16px", marginBottom: 10 }}>
                  <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", gap: 12, userSelect: "none" }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: "#F4A623", minWidth: 70 }}>
                      {PAD2(h.hour)}:00
                    </span>
                    <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#262629" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: "#F4A623", borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 13, color: "#bbb", minWidth: 110, textAlign: "right" }}>
                      <span style={{ color: "#fff", fontWeight: 700 }}>{h.totalSales}</span> productos
                      <span style={{ color: "#666", marginLeft: 6 }}>· {h.orderCount} órden{h.orderCount > 1 ? "es" : ""}</span>
                    </span>
                    <span style={{ fontSize: 13, color: "#666", minWidth: 100, textAlign: "right" }}>{CLP(h.totalRevenue)}</span>
                  </summary>
                  <div style={{ marginTop: 12, borderTop: "1px solid #262629", paddingTop: 12 }}>
                    {h.products.map((p) => (
                      <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, borderBottom: "1px dashed #262629" }}>
                        <span>
                          <span style={{ color: "#F4A623", fontWeight: 700, marginRight: 8 }}>{p.quantity}×</span>
                          {p.name}
                          {p.category && <span style={{ color: "#555", fontSize: 11, marginLeft: 6 }}>· {p.category}</span>}
                        </span>
                        <span style={{ color: "#888" }}>{CLP(p.revenue)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#1a1a1d", border: "1px solid #2a2a2d", borderRadius: 12, padding: "14px 16px" }}>
      <p style={{ margin: 0, fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</p>
      <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 700, color: "#F4A623" }}>{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#1a1a1d", border: "1px solid #2a2a2d", borderRadius: 12, padding: "16px 18px", marginBottom: 16 }}>
      <h2 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700 }}>{title}</h2>
      {children}
    </div>
  );
}

function BadgeCard({ title, subtitle, stats, accentColor }: { title: string; subtitle: string; stats: BadgeStats; accentColor: string }) {
  if (stats.count === 0) {
    return (
      <div style={{ background: "#1a1a1d", border: "1px solid #2a2a2d", borderRadius: 12, padding: "14px 16px" }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{title}</p>
        <p style={{ margin: "2px 0 12px", fontSize: 11, color: "#666" }}>{subtitle}</p>
        <p style={{ margin: 0, color: "#666", fontSize: 12 }}>Sin platos en este grupo hoy.</p>
      </div>
    );
  }

  const liftColor = stats.lift !== null && stats.lift > 0 ? "#86efac" : stats.lift !== null && stats.lift < 0 ? "#fca5a5" : "#bbb";
  const liftSign = stats.lift !== null && stats.lift > 0 ? "+" : "";
  const verdict =
    stats.lift === null
      ? "No hay con qué comparar todavía."
      : stats.lift >= 30
      ? "El badge está acertando 🎯"
      : stats.lift >= 0
      ? "El badge ayuda un poco."
      : "El badge no está acertando hoy ⚠️";

  return (
    <div style={{ background: "#1a1a1d", border: "1px solid #2a2a2d", borderRadius: 12, padding: "14px 16px" }}>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{title}</p>
      <p style={{ margin: "2px 0 14px", fontSize: 11, color: "#666" }}>{subtitle}</p>

      {/* Insight 1: aciertos */}
      <div style={{ background: "#262629", borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
        <p style={{ margin: 0, fontSize: 12, color: "#bbb" }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: accentColor, marginRight: 6 }}>{stats.alsoTopSeller}/{stats.count}</span>
          de los platos con esta señal están entre los <span style={{ fontWeight: 600, color: "#fff" }}>más vendidos del día</span>.
        </p>
      </div>

      {/* Insight 2: lift */}
      <div style={{ background: "#262629", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
        <p style={{ margin: 0, fontSize: 12, color: "#bbb" }}>
          {stats.lift !== null ? (
            <>
              Venden <span style={{ fontSize: 18, fontWeight: 800, color: liftColor, margin: "0 4px" }}>{liftSign}{stats.lift}%</span>
              que el resto de los platos.
              <br />
              <span style={{ fontSize: 11, color: "#888" }}>
                Promedio de unidades por plato: <strong style={{ color: "#fff" }}>{stats.avgSalesIn}</strong> vs <strong style={{ color: "#fff" }}>{stats.avgSalesOut}</strong> del resto.
              </span>
            </>
          ) : (
            <span style={{ color: "#888" }}>Necesitamos más ventas para comparar.</span>
          )}
        </p>
      </div>

      <p style={{ margin: "0 0 10px", fontSize: 11, color: "#888", fontStyle: "italic" }}>{verdict}</p>

      <div style={{ borderTop: "1px solid #2a2a2d", paddingTop: 10, fontSize: 12 }}>
        <p style={{ margin: "0 0 6px", fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.5 }}>Detalle</p>
        {stats.items.map((it) => (
          <div key={it.qcDishId} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px dashed #262629" }}>
            <span>
              <span style={{ marginRight: 6 }}>{it.sales > 0 ? "✓" : "✗"}</span>
              {it.name}
              {it.category && <span style={{ color: "#555", fontSize: 10, marginLeft: 6 }}>· {it.category}</span>}
            </span>
            <span style={{ color: it.sales > 0 ? accentColor : "#666", fontWeight: 700 }}>
              {it.sales > 0 ? `${it.sales} venta${it.sales > 1 ? "s" : ""}` : "no se vendió"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
