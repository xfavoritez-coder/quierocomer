"use client";

import { useEffect, useState, useRef } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const REFRESH_MS = 60_000;
const SYNC_INTERVAL_MS = 2 * 60_000; // 2 min — matches the server-side debounce

interface LiveData {
  now: string;
  elapsedMs: number;
  today: { orderCount: number; unitsSold: number; revenue: number };
  yesterday: { orderCount: number; unitsSold: number; revenue: number };
  lastWeek: { orderCount: number; unitsSold: number; revenue: number };
  deltas: {
    revenueVsYesterday: number | null;
    revenueVsLastWeek: number | null;
    ordersVsYesterday: number | null;
    ordersVsLastWeek: number | null;
  };
  byHour: { hour: number; units: number; revenue: number }[];
  topNow: { toteatProductId: string; name: string; qty: number }[];
  topToday: { toteatProductId: string; name: string; qty: number }[];
  error?: string;
}

const CLP = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");

export default function LiveDashboard() {
  const { selectedRestaurantId } = useAdminSession();
  const [data, setData] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);
  const tickRef = useRef<number | null>(null);
  const syncTickRef = useRef<number | null>(null);

  const load = () => {
    if (!selectedRestaurantId) return;
    fetch(`/api/admin/live?restaurantId=${selectedRestaurantId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else { setData(d); setError(null); setUpdatedAt(new Date()); }
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  };

  // Sync triggers a fresh fetch from Toteat (debounced server-side at 2 min)
  // and then re-loads the dashboard to show the new data.
  const triggerSync = async (force = false) => {
    if (!selectedRestaurantId) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/toteat/sync-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: selectedRestaurantId, days: 1, force }),
      });
      const d = await res.json();
      if (d.lastSyncAt) setLastSyncAt(new Date(d.lastSyncAt));
      else if (d.ok) setLastSyncAt(new Date());
    } catch {}
    setSyncing(false);
    load();
  };

  useEffect(() => {
    setLoading(true);
    triggerSync();   // Initial sync on load
    // Cheap dashboard refresh every 60s (re-reads cache, no Toteat hit)
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = window.setInterval(load, REFRESH_MS);
    // Real Toteat sync every 2 min (matches server-side debounce)
    if (syncTickRef.current) window.clearInterval(syncTickRef.current);
    syncTickRef.current = window.setInterval(() => triggerSync(false), SYNC_INTERVAL_MS);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      if (syncTickRef.current) window.clearInterval(syncTickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRestaurantId]);

  const minutesAgo = (d: Date | null) => {
    if (!d) return null;
    const m = Math.floor((Date.now() - d.getTime()) / 60_000);
    if (m < 1) return "ahora mismo";
    if (m === 1) return "hace 1 min";
    return `hace ${m} min`;
  };

  if (!selectedRestaurantId) {
    return <div style={{ padding: 24, color: "var(--adm-text2)", fontFamily: F }}>Selecciona un local en el sidebar para ver su dashboard en vivo.</div>;
  }

  if (loading) return <div style={{ padding: 24, color: "var(--adm-text3)", fontFamily: F }}>Cargando datos en vivo…</div>;

  if (error || !data) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: "#ef4444", fontFamily: F, fontSize: "0.92rem", margin: 0 }}>⚠️ {error || "No hay datos"}</p>
      </div>
    );
  }

  const noData = data.today.orderCount === 0;
  const maxHourUnits = Math.max(...data.byHour.map((h) => h.units), 1);

  return (
    <div style={{ maxWidth: 800 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: "var(--adm-accent)", margin: 0 }}>
            <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: "#16a34a", marginRight: 8, animation: "livePulse 2s infinite" }} />
            En vivo
          </h1>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "4px 0 0" }}>
            {lastSyncAt ? `Última sincronización con Toteat: ${minutesAgo(lastSyncAt)}` : "Sincronizando con Toteat..."}
            <span style={{ color: "var(--adm-text3)", marginLeft: 8 }}>· auto cada 2 min</span>
          </p>
        </div>
        <button
          onClick={() => triggerSync(true)}
          disabled={syncing}
          style={{ padding: "8px 14px", background: syncing ? "var(--adm-card-border)" : "var(--adm-accent)", color: "#fff", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.78rem", fontWeight: 700, cursor: syncing ? "wait" : "pointer", opacity: syncing ? 0.6 : 1 }}
        >
          {syncing ? "Sincronizando..." : "Sincronizar ahora"}
        </button>
      </div>

      {noData && (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "22px 18px", textAlign: "center", marginBottom: 16 }}>
          <p style={{ fontFamily: F, fontSize: "0.92rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 6px" }}>Aún no hay ventas hoy</p>
          <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: 0 }}>
            Cuando llegue la primera venta vas a verla acá. Recordatorio: la sincronización con Toteat ocurre cada 30 min.
          </p>
        </div>
      )}

      {/* Big KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }} className="adm-grid-2">
        <KPI label="Ingresos hoy" value={CLP(data.today.revenue)} delta={data.deltas.revenueVsYesterday} deltaLabel="vs ayer" />
        <KPI label="Órdenes" value={data.today.orderCount.toString()} delta={data.deltas.ordersVsYesterday} deltaLabel="vs ayer" />
        <KPI label="Productos vendidos" value={data.today.unitsSold.toString()} />
      </div>

      {/* Comparison strip */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
        <p style={{ fontFamily: F, fontSize: "0.74rem", color: "var(--adm-text3)", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: 0.5 }}>Comparativa misma hora</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <CompareRow label="Ayer" value={CLP(data.yesterday.revenue)} sub={`${data.yesterday.orderCount} órdenes`} delta={data.deltas.revenueVsYesterday} />
          <CompareRow label="Hace 7 días" value={CLP(data.lastWeek.revenue)} sub={`${data.lastWeek.orderCount} órdenes`} delta={data.deltas.revenueVsLastWeek} />
        </div>
      </div>

      {/* Hourly bar chart */}
      {data.today.unitsSold > 0 && (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
          <p style={{ fontFamily: F, fontSize: "0.74rem", color: "var(--adm-text3)", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: 0.5 }}>Ventas por hora</p>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 100 }}>
            {data.byHour.filter((h) => h.units > 0 || (h.hour >= 11 && h.hour <= 23)).map((h) => (
              <div key={h.hour} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <span style={{ fontFamily: F, fontSize: "0.6rem", color: "var(--adm-text3)" }}>{h.units > 0 ? h.units : ""}</span>
                <div style={{ width: "100%", height: Math.max(2, (h.units / maxHourUnits) * 80), background: h.units > 0 ? "var(--adm-accent)" : "var(--adm-card-border)", borderRadius: 3 }} />
                <span style={{ fontFamily: F, fontSize: "0.58rem", color: "var(--adm-text3)" }}>{h.hour.toString().padStart(2, "0")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top now + Top today */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="adm-grid-2">
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "14px 16px" }}>
          <p style={{ fontFamily: F, fontSize: "0.74rem", color: "var(--adm-text3)", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: 0.5 }}>🔥 Últimos 60 min</p>
          {data.topNow.length === 0 ? (
            <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)", margin: 0 }}>Sin movimiento en la última hora.</p>
          ) : (
            data.topNow.map((p, i) => (
              <div key={p.toteatProductId} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: i < data.topNow.length - 1 ? "1px dashed var(--adm-card-border)" : "none", fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text)" }}>
                <span>{p.name}</span>
                <span style={{ color: "var(--adm-accent)", fontWeight: 700 }}>{p.qty}</span>
              </div>
            ))
          )}
        </div>
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "14px 16px" }}>
          <p style={{ fontFamily: F, fontSize: "0.74rem", color: "var(--adm-text3)", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: 0.5 }}>Top del día</p>
          {data.topToday.length === 0 ? (
            <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)", margin: 0 }}>Sin ventas hoy todavía.</p>
          ) : (
            data.topToday.map((p, i) => (
              <div key={p.toteatProductId} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: i < data.topToday.length - 1 ? "1px dashed var(--adm-card-border)" : "none", fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text)" }}>
                <span>
                  <span style={{ color: "var(--adm-text3)", marginRight: 6, fontWeight: 700, fontSize: "0.72rem" }}>{i + 1}.</span>
                  {p.name}
                </span>
                <span style={{ color: "var(--adm-accent)", fontWeight: 700 }}>{p.qty}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}

function KPI({ label, value, delta, deltaLabel }: { label: string; value: string; delta?: number | null; deltaLabel?: string }) {
  const deltaColor = delta == null ? "var(--adm-text3)" : delta > 0 ? "#16a34a" : delta < 0 ? "#ef4444" : "var(--adm-text3)";
  const deltaText = delta == null ? "" : delta === 0 ? "=" : `${delta > 0 ? "+" : ""}${delta}%`;
  return (
    <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "14px 16px" }}>
      <p style={{ fontFamily: F, fontSize: "0.66rem", color: "var(--adm-text3)", margin: 0, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</p>
      <p style={{ fontFamily: F, fontSize: "1.45rem", fontWeight: 700, color: "var(--adm-accent)", margin: "4px 0 0" }}>{value}</p>
      {deltaText && (
        <p style={{ fontFamily: F, fontSize: "0.7rem", color: deltaColor, margin: "4px 0 0", fontWeight: 600 }}>
          {deltaText} <span style={{ color: "var(--adm-text3)", fontWeight: 400, marginLeft: 4 }}>{deltaLabel}</span>
        </p>
      )}
    </div>
  );
}

function CompareRow({ label, value, sub, delta }: { label: string; value: string; sub: string; delta: number | null }) {
  const deltaColor = delta == null ? "var(--adm-text3)" : delta > 0 ? "#16a34a" : delta < 0 ? "#ef4444" : "var(--adm-text3)";
  const deltaText = delta == null ? "—" : delta === 0 ? "=" : `${delta > 0 ? "+" : ""}${delta}%`;
  return (
    <div>
      <p style={{ fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text3)", margin: 0 }}>{label}</p>
      <p style={{ fontFamily: F, fontSize: "1.05rem", fontWeight: 700, color: "var(--adm-text)", margin: "2px 0 0" }}>{value}</p>
      <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>
        {sub} · <span style={{ color: deltaColor, fontWeight: 600 }}>{deltaText}</span>
      </p>
    </div>
  );
}
