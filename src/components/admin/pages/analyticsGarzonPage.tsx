"use client";

import { useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import Link from "next/link";
import SkeletonLoading from "@/components/admin/SkeletonLoading";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

interface Data {
  today: number;
  week: number;
  month: number;
  answeredPct: number;
  avgResponseSec: number;
  perDay: Record<string, number>;
  topMesas: { name: string; count: number }[];
  peakHours: { hour: number; count: number }[];
  recent: { id: string; tableName: string; calledAt: string; answeredAt: string | null; responseTime: number | null; restaurantName: string }[];
  perRestaurant: { id: string; name: string; weekCalls: number; todayCalls: number; answeredPct: number }[];
}

function formatTime(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

function formatHour(h: number): string {
  return `${h.toString().padStart(2, "0")}:00`;
}

export default function AnalyticsGarzonPage() {
  const { selectedRestaurantId, isSuper, loading: sessionLoading } = useAdminSession();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"own" | "all">(isSuper ? "all" : "own");

  useEffect(() => {
    if (sessionLoading) return;
    setLoading(true);
    const params = view === "all" && isSuper
      ? "all=true"
      : `restaurantId=${selectedRestaurantId}`;
    fetch(`/api/admin/analytics-garzon?${params}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionLoading, selectedRestaurantId, view, isSuper]);

  if (loading || sessionLoading) return <SkeletonLoading type="analytics" />;
  if (!data) return <p style={{ fontFamily: F, color: "var(--adm-text3)", padding: 40, textAlign: "center" }}>Sin datos</p>;

  const days = Object.entries(data.perDay);
  const maxDay = Math.max(...days.map(d => d[1]), 1);

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: GOLD, margin: 0 }}>Analytics Garzón</h1>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "4px 0 0" }}>Llamados, tiempos de respuesta y mesas más activas</p>
        </div>
        {isSuper && (
          <div style={{ display: "flex", gap: 4, background: "var(--adm-hover)", borderRadius: 8, padding: 3 }}>
            <button onClick={() => setView("all")} style={{ padding: "6px 12px", borderRadius: 6, border: "none", fontFamily: F, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", background: view === "all" ? "white" : "transparent", color: view === "all" ? GOLD : "var(--adm-text3)", boxShadow: view === "all" ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>Todos</button>
            <button onClick={() => setView("own")} style={{ padding: "6px 12px", borderRadius: 6, border: "none", fontFamily: F, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", background: view === "own" ? "white" : "transparent", color: view === "own" ? GOLD : "var(--adm-text3)", boxShadow: view === "own" ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>Local</button>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 20 }} className="adm-grid-2">
        {[
          { label: "Hoy", value: data.today, color: GOLD },
          { label: "Semana", value: data.week, color: "var(--adm-text)" },
          { label: "% Atendidos", value: `${data.answeredPct}%`, color: data.answeredPct >= 80 ? "#16a34a" : data.answeredPct >= 50 ? GOLD : "#ef4444" },
          { label: "Tiempo resp.", value: formatTime(data.avgResponseSec), color: data.avgResponseSec <= 120 ? "#16a34a" : GOLD },
        ].map((card, i) => (
          <div key={i} style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 14px", boxShadow: "var(--adm-card-shadow, none)" }}>
            <p style={{ fontFamily: F, fontSize: "1.5rem", color: card.color, margin: "0 0 2px", fontWeight: 700 }}>{card.value}</p>
            <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", margin: 0 }}>{card.label}</p>
          </div>
        ))}
      </div>

      {/* Bar chart - calls per day */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 20px", marginBottom: 20, boxShadow: "var(--adm-card-shadow, none)" }}>
        <h3 style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Llamados por día</h3>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100 }}>
          {days.map(([date, count]) => {
            const dayName = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][new Date(date + "T12:00:00").getDay()];
            return (
              <div key={date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <span style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text2)" }}>{count}</span>
                <div style={{ width: "100%", height: Math.max(4, (count / maxDay) * 80), background: count > 0 ? GOLD : "var(--adm-card-border)", borderRadius: 4, transition: "height 0.3s" }} />
                <span style={{ fontFamily: F, fontSize: "0.6rem", color: "var(--adm-text3)" }}>{dayName}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }} className="adm-grid-2">
        {/* Top mesas */}
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 20px", boxShadow: "var(--adm-card-shadow, none)" }}>
          <h3 style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Mesas más activas</h3>
          {data.topMesas.length > 0 ? data.topMesas.map((m, i) => (
            <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < data.topMesas.length - 1 ? "1px solid var(--adm-card-border)" : "none" }}>
              <span style={{ fontFamily: F, fontSize: "0.75rem", color: GOLD, fontWeight: 700, width: 20 }}>{i + 1}</span>
              <span style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text)", flex: 1 }}>{m.name}</span>
              <span style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)" }}>{m.count}x</span>
            </div>
          )) : <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)" }}>Sin datos esta semana</p>}
        </div>

        {/* Peak hours */}
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 20px", boxShadow: "var(--adm-card-shadow, none)" }}>
          <h3 style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Horas punta</h3>
          {data.peakHours.length > 0 ? data.peakHours.map((h, i) => (
            <div key={h.hour} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < data.peakHours.length - 1 ? "1px solid var(--adm-card-border)" : "none" }}>
              <span style={{ fontFamily: F, fontSize: "0.82rem", color: GOLD, fontWeight: 600 }}>{formatHour(h.hour)}</span>
              <div style={{ flex: 1, height: 6, background: "var(--adm-card-border)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${(h.count / (data.peakHours[0]?.count || 1)) * 100}%`, height: "100%", background: GOLD, borderRadius: 3 }} />
              </div>
              <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)" }}>{h.count}</span>
            </div>
          )) : <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)" }}>Sin datos esta semana</p>}
        </div>
      </div>

      {/* Per restaurant (superadmin) */}
      {isSuper && view === "all" && data.perRestaurant.length > 0 && (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 20px", marginBottom: 20, boxShadow: "var(--adm-card-shadow, none)" }}>
          <h3 style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Por local</h3>
          {data.perRestaurant.map(r => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--adm-card-border)" }}>
              <span style={{ fontFamily: F, fontSize: "0.85rem", color: "var(--adm-text)", fontWeight: 600, flex: 1 }}>{r.name}</span>
              <span style={{ fontFamily: F, fontSize: "0.75rem", color: "var(--adm-text2)" }}>{r.todayCalls} hoy</span>
              <span style={{ fontFamily: F, fontSize: "0.75rem", color: "var(--adm-text2)" }}>{r.weekCalls} sem</span>
              <span style={{ fontFamily: F, fontSize: "0.75rem", color: r.answeredPct >= 80 ? "#16a34a" : r.answeredPct >= 50 ? GOLD : "#ef4444", fontWeight: 600 }}>{r.answeredPct}%</span>
            </div>
          ))}
        </div>
      )}

      {/* Recent calls */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 20px", boxShadow: "var(--adm-card-shadow, none)" }}>
        <h3 style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Últimos llamados</h3>
        {data.recent.length > 0 ? data.recent.map(c => {
          const time = new Date(c.calledAt);
          const hhmm = `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}`;
          const dateStr = time.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
          return (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--adm-card-border)" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.answeredAt ? "#16a34a" : "#ef4444", flexShrink: 0 }} />
              <span style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text)", flex: 1 }}>{c.tableName || "Sin mesa"}</span>
              {isSuper && view === "all" && <span style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)" }}>{c.restaurantName}</span>}
              <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)" }}>{dateStr} {hhmm}</span>
              {c.responseTime !== null ? (
                <span style={{ fontFamily: F, fontSize: "0.68rem", color: "#16a34a", fontWeight: 600 }}>{formatTime(c.responseTime)}</span>
              ) : (
                <span style={{ fontFamily: F, fontSize: "0.68rem", color: "#ef4444" }}>Sin atender</span>
              )}
            </div>
          );
        }) : <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)" }}>Sin llamados recientes</p>}
      </div>
    </div>
  );
}
