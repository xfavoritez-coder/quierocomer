"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";

const F = "var(--font-display)";
const GOLD = "#F4A623";
const GREEN = "#16a34a";
const BLUE = "#7fbfdc";
const RED = "#ef4444";
const PURPLE = "#a78bfa";

function clp(n: number) { return `$${Math.round(n).toLocaleString("es-CL")}`; }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}

function StatCard({ value, label, sub, color = GOLD }: { value: string | number; label: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 18px" }}>
      <p style={{ fontFamily: F, fontSize: "1.5rem", fontWeight: 800, color, margin: 0 }}>{value}</p>
      <p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", margin: "3px 0 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
      {sub && <p style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", margin: "2px 0 0", opacity: 0.7 }}>{sub}</p>}
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 12px" }}>{children}</p>;
}

interface DashboardData {
  period: { days: number; since: string };
  overview: {
    totalOrders: number; paidOrders: number; totalRevenue: number; avgTicket: number;
    uniqueCustomers: number; repeatCustomers: number; repeatRate: number;
    pickupCount: number; deliveryCount: number;
  };
  funnel: Record<string, number>;
  topDishes: { name: string; qty: number; revenue: number }[];
  ordersChart: { date: string; orders: number; revenue: number }[];
  peakHours: { hour: number; count: number }[];
  byPaymentMethod: Record<string, number>;
  byRestaurant: { id: string; name: string; orders: number; revenue: number }[];
  abandonedCarts: { id: string; restaurantName: string; totalValue: number; itemCount: number; items: any[]; createdAt: string }[];
  abandonedValue: number;
  topSearches: { query: string; count: number }[];
}

const funnelSteps = [
  { key: "STORE_VIEW", label: "Vistas store", color: "var(--adm-text2)" },
  { key: "STORE_DISH_VIEW", label: "Platos vistos", color: BLUE },
  { key: "STORE_CART_ADD", label: "Al carrito", color: GOLD },
  { key: "STORE_CHECKOUT_START", label: "Checkout", color: PURPLE },
  { key: "STORE_CHECKOUT_ABANDON", label: "Abandonados", color: RED },
  { key: "STORE_ORDER_PLACED", label: "Pedidos", color: GREEN },
];

export default function EcommerceDashboardPage() {
  const { loading: authLoading, isSuper, restaurants: adminRestaurants } = useAdminSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [restaurantId, setRestaurantId] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ days: String(days) });
    if (restaurantId) params.set("restaurantId", restaurantId);
    const res = await fetch(`/api/admin/ecommerce-dashboard?${params}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [days, restaurantId]);

  useEffect(() => {
    if (!authLoading) fetchData();
  }, [authLoading, fetchData]);

  if (authLoading) return null;
  if (!isSuper) return <div style={{ padding: 40, color: RED, fontFamily: F }}>No autorizado</div>;

  const ov = data?.overview;
  const maxHour = data ? Math.max(...data.peakHours.map(h => h.count), 1) : 1;
  const maxDish = data?.topDishes[0]?.qty || 1;
  const maxChartRevenue = data ? Math.max(...data.ordersChart.map(d => d.revenue), 1) : 1;

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: GOLD, margin: 0 }}>Ecommerce · Dashboard</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {adminRestaurants.length > 1 && (
            <select value={restaurantId} onChange={e => setRestaurantId(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--adm-card-border)", background: "var(--adm-card)", color: "var(--adm-text)", fontFamily: F, fontSize: "0.82rem", cursor: "pointer" }}>
              <option value="">Todos los locales</option>
              {adminRestaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)}
              style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${days === d ? GOLD : "var(--adm-card-border)"}`, background: days === d ? `${GOLD}18` : "var(--adm-card)", color: days === d ? GOLD : "var(--adm-text2)", fontFamily: F, fontSize: "0.82rem", cursor: "pointer", fontWeight: days === d ? 700 : 400 }}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: "center", color: "var(--adm-text3)", fontFamily: F }}>Cargando...</div>
      ) : !data ? (
        <div style={{ padding: 60, textAlign: "center", color: RED, fontFamily: F }}>Error al cargar datos</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
            <StatCard value={ov!.totalOrders} label="Pedidos" color={GOLD} />
            <StatCard value={clp(ov!.totalRevenue)} label="Revenue" color={GREEN} sub={`${ov!.paidOrders} pagados`} />
            <StatCard value={clp(ov!.avgTicket)} label="Ticket promedio" color={GOLD} />
            <StatCard value={ov!.uniqueCustomers} label="Clientes únicos" color={BLUE} />
            <StatCard value={`${ov!.repeatRate}%`} label="Tasa recompra" color={PURPLE} sub={`${ov!.repeatCustomers} repiten`} />
            <StatCard value={ov!.deliveryCount} label="Delivery" color={BLUE} sub={`${ov!.pickupCount} retiros`} />
          </div>

          {/* Revenue chart by day */}
          {data.ordersChart.length > 1 && (
            <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "18px 20px", marginBottom: 16 }}>
              <SectionLabel>{`Revenue por día (últimos ${days} días)`}</SectionLabel>
              {/* Labels row */}
              <div style={{ display: "flex", gap: 1, marginBottom: 4 }}>
                {data.ordersChart.map((d, i) => (
                  <div key={d.date} style={{ flex: 1, textAlign: "center", minWidth: 0 }}>
                    {(i === 0 || i === Math.floor(data.ordersChart.length / 2) || i === data.ordersChart.length - 1) && (
                      <span style={{ fontFamily: F, fontSize: "0.52rem", color: "var(--adm-text3)", whiteSpace: "nowrap" }}>{fmtDate(d.date)}</span>
                    )}
                  </div>
                ))}
              </div>
              {/* Bars */}
              <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 72 }}>
                {data.ordersChart.map(d => (
                  <div
                    key={d.date}
                    title={`${fmtDate(d.date)}: ${clp(d.revenue)} · ${d.orders} pedidos`}
                    style={{ flex: 1, background: d.revenue > 0 ? GREEN : "var(--adm-hover)", borderRadius: "2px 2px 0 0", height: `${Math.round(d.revenue / maxChartRevenue * 68) + 2}px`, opacity: d.revenue > 0 ? Math.max(0.3, d.revenue / maxChartRevenue * 0.7 + 0.3) : 0.15, cursor: "default" }}
                  />
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)" }}>
                  Total: {clp(data.ordersChart.reduce((s, d) => s + d.revenue, 0))}
                </span>
                <span style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)" }}>
                  {data.ordersChart.reduce((s, d) => s + d.orders, 0)} pedidos en el período
                </span>
              </div>
            </div>
          )}

          {/* Funnel */}
          <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "18px 20px", marginBottom: 16 }}>
            <SectionLabel>Funnel de conversión</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${funnelSteps.length}, 1fr)`, gap: 8 }}>
              {funnelSteps.map((step, si) => {
                const count = data.funnel[step.key] || 0;
                const prev = si > 0 ? (data.funnel[funnelSteps[si - 1].key] || 0) : count;
                const pct = prev > 0 ? Math.round(count / prev * 100) : (count > 0 ? 100 : 0);
                return (
                  <div key={step.key} style={{ background: "var(--adm-hover)", borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
                    <p style={{ fontFamily: F, fontSize: "1.4rem", fontWeight: 800, color: step.color, margin: 0 }}>{count.toLocaleString("es-CL")}</p>
                    <p style={{ fontFamily: F, fontSize: "0.6rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>{step.label}</p>
                    {si > 0 && <p style={{ fontFamily: F, fontSize: "0.65rem", color: pct >= 50 ? GREEN : pct >= 20 ? GOLD : RED, margin: "4px 0 0", fontWeight: 700 }}>{pct}%</p>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top dishes + Peak hours */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {/* Top dishes */}
            <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "18px 20px" }}>
              <SectionLabel>Platos más pedidos</SectionLabel>
              {data.topDishes.length === 0
                ? <p style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text3)" }}>Sin datos aún — se acumulará con los próximos pedidos</p>
                : data.topDishes.slice(0, 8).map((d, i) => (
                  <div key={d.name} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "75%" }}>{i + 1}. {d.name}</span>
                      <span style={{ fontFamily: F, fontSize: "0.78rem", color: GOLD, fontWeight: 700, flexShrink: 0 }}>{d.qty}× · {clp(d.revenue)}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: "var(--adm-hover)" }}>
                      <div style={{ width: `${Math.round(d.qty / maxDish * 100)}%`, height: "100%", borderRadius: 2, background: i === 0 ? GOLD : `rgba(244,166,35,${Math.max(0.2, 0.8 - i * 0.08)})` }} />
                    </div>
                  </div>
                ))
              }
            </div>

            {/* Peak hours */}
            <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "18px 20px" }}>
              <SectionLabel>Horarios pico de pedidos</SectionLabel>
              {/* Hour labels above bars */}
              <div style={{ display: "flex", gap: 2, marginBottom: 4 }}>
                {data.peakHours.map(h => (
                  <div key={h.hour} style={{ flex: 1, textAlign: "center" }}>
                    {h.hour % 6 === 0 && <span style={{ fontFamily: F, fontSize: "0.5rem", color: "var(--adm-text3)" }}>{h.hour}h</span>}
                  </div>
                ))}
              </div>
              {/* Bars */}
              <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 72 }}>
                {data.peakHours.map(h => (
                  <div
                    key={h.hour}
                    title={`${h.hour}:00h — ${h.count} pedidos`}
                    style={{ flex: 1, background: h.count > 0 ? GOLD : "var(--adm-hover)", borderRadius: "2px 2px 0 0", height: `${Math.round(h.count / maxHour * 68) + 2}px`, opacity: h.count > 0 ? Math.max(0.25, h.count / maxHour) : 0.12 }}
                  />
                ))}
              </div>
              {data.peakHours.length > 0 && (() => {
                const peak = data.peakHours.reduce((a, b) => a.count > b.count ? a : b);
                return peak.count > 0
                  ? <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", marginTop: 8 }}>Pico: {peak.hour}:00h ({peak.count} pedidos)</p>
                  : <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", marginTop: 8 }}>Sin pedidos en el período — el gráfico se llenará con la actividad</p>;
              })()}
            </div>
          </div>

          {/* Abandoned carts + Searches + Payment/Restaurant */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            {/* Abandoned carts */}
            <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "18px 20px" }}>
              <SectionLabel>Carritos abandonados</SectionLabel>
              <p style={{ fontFamily: F, fontSize: "1.6rem", fontWeight: 800, color: data.abandonedCarts.length > 0 ? RED : "var(--adm-text3)", margin: "0 0 2px" }}>{data.abandonedCarts.length}</p>
              <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "0 0 10px" }}>
                {data.abandonedValue > 0 ? `${clp(data.abandonedValue)} en riesgo` : "Sin abandonos en el período"}
              </p>
              {data.abandonedCarts.length === 0
                ? <p style={{ fontFamily: F, fontSize: "0.75rem", color: "var(--adm-text3)" }}>Cuando un usuario llegue al checkout y no complete el pago aparecerá aquí con el contenido de su carrito.</p>
                : data.abandonedCarts.slice(0, 5).map(c => (
                  <div key={c.id} style={{ background: "var(--adm-hover)", borderRadius: 8, padding: "8px 10px", marginBottom: 6 }}>
                    <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text)", margin: 0, fontWeight: 600 }}>{c.restaurantName || "—"}</p>
                    <p style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>
                      {c.itemCount} ítems · {c.totalValue > 0 ? clp(c.totalValue) : "valor desconocido"} · {fmtDate(c.createdAt)}
                    </p>
                    {c.items?.length > 0 && (
                      <p style={{ fontFamily: F, fontSize: "0.6rem", color: "var(--adm-text3)", margin: "3px 0 0", opacity: 0.8 }}>
                        {c.items.slice(0, 2).map((i: any) => i.name).join(", ")}{c.items.length > 2 ? ` +${c.items.length - 2}` : ""}
                      </p>
                    )}
                  </div>
                ))
              }
            </div>

            {/* Top searches with no results */}
            <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "18px 20px" }}>
              <SectionLabel>Búsquedas sin resultado</SectionLabel>
              {data.topSearches.length === 0
                ? <p style={{ fontFamily: F, fontSize: "0.75rem", color: "var(--adm-text3)" }}>Cuando un cliente busque algo en el store y no encuentre resultados, quedará registrado aquí. Es una señal directa de qué platos agregar.</p>
                : data.topSearches.slice(0, 10).map(s => (
                  <div key={s.query} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--adm-card-border)" }}>
                    <span style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>&ldquo;{s.query}&rdquo;</span>
                    <span style={{ fontFamily: F, fontSize: "0.72rem", color: RED, fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>{s.count}×</span>
                  </div>
                ))
              }
            </div>

            {/* Payment methods + by restaurant */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "14px 16px" }}>
                <SectionLabel>Métodos de pago</SectionLabel>
                {Object.keys(data.byPaymentMethod).length === 0
                  ? <p style={{ fontFamily: F, fontSize: "0.75rem", color: "var(--adm-text3)" }}>Sin pedidos aún</p>
                  : Object.entries(data.byPaymentMethod).sort((a, b) => b[1] - a[1]).map(([m, count]) => (
                    <div key={m} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--adm-card-border)" }}>
                      <span style={{ fontFamily: F, fontSize: "0.75rem", color: "var(--adm-text)", textTransform: "capitalize" }}>{m}</span>
                      <span style={{ fontFamily: F, fontSize: "0.75rem", color: BLUE, fontWeight: 700 }}>{count}</span>
                    </div>
                  ))
                }
              </div>
              <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "14px 16px", flex: 1 }}>
                <SectionLabel>Por local</SectionLabel>
                {data.byRestaurant.length === 0
                  ? <p style={{ fontFamily: F, fontSize: "0.75rem", color: "var(--adm-text3)" }}>Sin datos</p>
                  : data.byRestaurant.slice(0, 6).map(r => (
                    <div key={r.id} style={{ padding: "4px 0", borderBottom: "1px solid var(--adm-card-border)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontFamily: F, fontSize: "0.75rem", color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>{r.name}</span>
                        <span style={{ fontFamily: F, fontSize: "0.75rem", color: GREEN, fontWeight: 700, flexShrink: 0 }}>{clp(r.revenue)}</span>
                      </div>
                      <span style={{ fontFamily: F, fontSize: "0.62rem", color: "var(--adm-text3)" }}>{r.orders} pedidos</span>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
