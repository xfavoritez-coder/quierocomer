"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";

const F = "var(--font-display)";
const GOLD = "#F4A623";
const GREEN = "#16a34a";
const BLUE = "#7fbfdc";
const RED = "#ef4444";
const PURPLE = "#a78bfa";

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

interface DashboardData {
  period: { days: number };
  users: { total: number; new: number; verified: number };
  events: {
    menuViews: number; dishViews: number; genioSessions: number;
    genioRecommendations: number; promoViews: number; reviews: number;
  };
  topViewedDishes: { name: string; count: number }[];
  peakHours: { hour: number; count: number }[];
  visitsChart: { date: string; count: number }[];
  dietPreferences: { diet: string; count: number }[];
}

const DIET_LABELS: Record<string, string> = {
  VEGAN: "Vegano", VEGETARIAN: "Vegetariano", OMNIVORE: "Carnívoro",
};

export default function CartaQRDashboardPage() {
  const { loading: authLoading, isSuper, restaurants: adminRestaurants } = useAdminSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [restaurantId, setRestaurantId] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ days: String(days) });
    if (restaurantId) params.set("restaurantId", restaurantId);
    const res = await fetch(`/api/admin/qr-dashboard?${params}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [days, restaurantId]);

  useEffect(() => {
    if (!authLoading) fetchData();
  }, [authLoading, fetchData]);

  if (authLoading) return null;
  if (!isSuper) return <div style={{ padding: 40, color: RED, fontFamily: F }}>No autorizado</div>;

  const verifiedPct = data ? (data.users.total > 0 ? Math.round(data.users.verified / data.users.total * 100) : 0) : 0;
  const maxDish = data?.topViewedDishes[0]?.count || 1;
  const maxHour = data ? Math.max(...data.peakHours.map(h => h.count), 1) : 1;

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: GOLD, margin: 0 }}>Carta QR · Dashboard</h1>
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
            <StatCard value={data.users.total.toLocaleString("es-CL")} label="Usuarios registrados" color={BLUE} />
            <StatCard value={data.users.new.toLocaleString("es-CL")} label="Nuevos en período" color={GOLD} />
            <StatCard value={`${verifiedPct}%`} label="Verificados" color={GREEN} sub={`${data.users.verified} cuentas`} />
            <StatCard value={data.events.menuViews.toLocaleString("es-CL")} label="Visitas al menú" color={GOLD} />
            <StatCard value={data.events.dishViews.toLocaleString("es-CL")} label="Vistas de platos" color={BLUE} />
            <StatCard value={data.events.genioSessions.toLocaleString("es-CL")} label="Sesiones Genio" color={PURPLE} />
          </div>

          {/* Engagement stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
            <StatCard value={data.events.genioRecommendations.toLocaleString("es-CL")} label="Recomendaciones Genio" color={PURPLE} />
            <StatCard value={data.events.promoViews.toLocaleString("es-CL")} label="Vistas de promos" color={GOLD} />
            <StatCard value={data.events.reviews.toLocaleString("es-CL")} label="Reseñas enviadas" color={GREEN} />
          </div>

          {/* Two column charts */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {/* Top viewed dishes */}
            <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "18px 20px" }}>
              <p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 14px" }}>Platos más vistos</p>
              {data.topViewedDishes.length === 0 && <p style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text3)" }}>Sin datos</p>}
              {data.topViewedDishes.slice(0, 8).map((d, i) => (
                <div key={d.name} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "75%" }}>{i + 1}. {d.name}</span>
                    <span style={{ fontFamily: F, fontSize: "0.78rem", color: BLUE, fontWeight: 700, flexShrink: 0 }}>{d.count}</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: "var(--adm-hover)" }}>
                    <div style={{ width: `${Math.round(d.count / maxDish * 100)}%`, height: "100%", borderRadius: 2, background: BLUE, opacity: Math.max(0.3, 1 - i * 0.08) }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Peak hours */}
            <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "18px 20px" }}>
              <p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 14px" }}>Horarios pico de visitas</p>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 80 }}>
                {data.peakHours.map(h => (
                  <div key={h.hour} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <div style={{ width: "100%", background: h.count > 0 ? BLUE : "var(--adm-hover)", borderRadius: "2px 2px 0 0", height: `${Math.round(h.count / maxHour * 70) + 2}px`, opacity: h.count > 0 ? Math.max(0.3, h.count / maxHour) : 0.15 }} />
                    {h.hour % 6 === 0 && <span style={{ fontFamily: F, fontSize: "0.5rem", color: "var(--adm-text3)" }}>{h.hour}h</span>}
                  </div>
                ))}
              </div>
              {data.peakHours.length > 0 && (() => {
                const peak = data.peakHours.reduce((a, b) => a.count > b.count ? a : b);
                return peak.count > 0 ? <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", marginTop: 8 }}>Pico: {peak.hour}:00h ({peak.count} visitas)</p> : null;
              })()}

              {/* Diet preferences */}
              {data.dietPreferences.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Preferencias dietéticas</p>
                  {data.dietPreferences.map(d => (
                    <div key={d.diet} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--adm-card-border)" }}>
                      <span style={{ fontFamily: F, fontSize: "0.75rem", color: "var(--adm-text)" }}>{DIET_LABELS[d.diet || ""] || d.diet}</span>
                      <span style={{ fontFamily: F, fontSize: "0.75rem", color: GREEN, fontWeight: 700 }}>{d.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Visits over time (simple text chart) */}
          {data.visitsChart.length > 0 && (
            <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "18px 20px", marginBottom: 16 }}>
              <p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 14px" }}>Visitas al menú por día</p>
              {(() => {
                const maxVisits = Math.max(...data.visitsChart.map(d => d.count), 1);
                return (
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 60 }}>
                    {data.visitsChart.map(d => (
                      <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 0 }} title={`${fmtDate(d.date)}: ${d.count}`}>
                        <div style={{ width: "100%", background: d.count > 0 ? BLUE : "var(--adm-hover)", borderRadius: "2px 2px 0 0", height: `${Math.round(d.count / maxVisits * 55) + 2}px`, opacity: d.count > 0 ? 0.8 : 0.2 }} />
                      </div>
                    ))}
                  </div>
                );
              })()}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontFamily: F, fontSize: "0.6rem", color: "var(--adm-text3)" }}>{fmtDate(data.visitsChart[0].date)}</span>
                <span style={{ fontFamily: F, fontSize: "0.6rem", color: "var(--adm-text3)" }}>{fmtDate(data.visitsChart[data.visitsChart.length - 1].date)}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
