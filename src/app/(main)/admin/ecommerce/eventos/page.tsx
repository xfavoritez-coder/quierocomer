"use client";

import { useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { Activity } from "lucide-react";
import StoreEventsPanel from "@/components/ecommerce/StoreEventsPanel";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

type Restaurant = { id: string; name: string };

function todayYmd(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function AdminEventosPage() {
  useAdminSession();

  const today = todayYmd();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/ecommerce-events")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.restaurants) setRestaurants(d.restaurants); })
      .finally(() => setLoading(false));
  }, []);

  const inputSt: React.CSSProperties = {
    fontFamily: FB, fontSize: "0.84rem", padding: "7px 10px",
    background: "var(--adm-card)", border: "1px solid var(--adm-card-border)",
    borderRadius: 8, color: "var(--adm-text)", cursor: "pointer",
  };
  const navBtn: React.CSSProperties = {
    width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center",
    borderRadius: 7, border: "1px solid var(--adm-card-border)", background: "var(--adm-card)",
    color: "var(--adm-text2)", cursor: "pointer", flexShrink: 0,
  };

  const singleDay = fromDate === toDate;
  const shiftBoth = (days: number) => {
    setFromDate((f) => addDays(f, days));
    setToDate((t) => addDays(t, days));
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 16px 48px", display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: `${GOLD}1a`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Activity size={20} color={GOLD} />
        </div>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.25rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Eventos de comportamiento</h1>
          <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>Embudo, platos, sesiones, cupones y más — por local</p>
        </div>
      </div>

      {/* Controles */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {/* Selector local */}
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          style={{ ...inputSt, minWidth: 200 }}
          disabled={loading}
        >
          <option value="">— Selecciona un local —</option>
          {restaurants.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>

        {/* Date picker */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
          {singleDay && (
            <button onClick={() => shiftBoth(-1)} style={navBtn}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
          )}
          <input type="date" value={fromDate} max={toDate} onChange={(e) => { const v = e.target.value || today; setFromDate(v); if (v > toDate) setToDate(v); }} style={inputSt} />
          <span style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text3)" }}>→</span>
          <input type="date" value={toDate} min={fromDate} onChange={(e) => { const v = e.target.value || today; setToDate(v); if (v < fromDate) setFromDate(v); }} style={inputSt} />
          {singleDay && (
            <button onClick={() => shiftBoth(1)} disabled={fromDate >= today} style={{ ...navBtn, opacity: fromDate >= today ? 0.4 : 1, cursor: fromDate >= today ? "default" : "pointer" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          )}
          {(fromDate !== today || toDate !== today) && (
            <button onClick={() => { setFromDate(today); setToDate(today); }} style={{ fontFamily: FB, fontSize: "0.74rem", fontWeight: 700, color: GOLD, background: `${GOLD}1a`, border: "none", borderRadius: 7, padding: "5px 10px", cursor: "pointer" }}>Hoy</button>
          )}
        </div>
      </div>

      {/* Panel de eventos */}
      {!selectedId ? (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "48px 24px", textAlign: "center" }}>
          <p style={{ fontFamily: FB, fontSize: "0.9rem", color: "var(--adm-text3)", margin: 0 }}>
            Selecciona un local para ver sus eventos de comportamiento.
          </p>
          {loading && <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text3)", margin: "8px 0 0" }}>Cargando locales…</p>}
        </div>
      ) : (
        <StoreEventsPanel restaurantId={selectedId} fromDate={fromDate} toDate={toDate} />
      )}
    </div>
  );
}
