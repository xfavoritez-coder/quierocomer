"use client";
import { useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import Link from "next/link";

const F = "var(--font-display)";

export default function TicketTrendPage() {
  const { restaurants } = useAdminSession();
  const [restaurantId, setRestaurantId] = useState("");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [qrActivatedAt, setQrActivatedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) { setData([]); return; }
    setLoading(true);
    const params = new URLSearchParams({ type: "ticket-trend", restaurantId, weeks: "16" });
    fetch(`/api/admin/analytics?${params}`).then((r) => r.json()).then((d) => setData(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoading(false));
    // Get qrActivatedAt
    fetch(`/api/admin/locales/${restaurantId}`).then((r) => r.json()).then((d) => setQrActivatedAt(d.qrActivatedAt || null)).catch(() => {});
  }, [restaurantId]);

  const maxTicket = Math.max(...data.map((d) => d.avgTicket), 1);

  const exportCSV = () => {
    const header = "Semana,Ticket promedio,Tickets,Cambio %\n";
    const rows = data.map((d) => `${d.weekStart},${d.avgTicket},${d.ticketCount},${d.changePct ?? ""}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "ticket_trend.csv"; a.click();
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <div className="adm-flex-wrap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, gap: 10 }}>
        <div>
          <Link href="/admin/analytics" style={{ fontFamily: F, fontSize: "0.78rem", color: "#888", textDecoration: "none" }}>← Analytics</Link>
          <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: "#F4A623", margin: "8px 0 0" }}>Ticket promedio</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)} style={{ padding: "8px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 10, color: "white", fontFamily: F, fontSize: "0.82rem", outline: "none" }}>
            <option value="" style={{ background: "#1A1A1A" }}>Seleccionar local</option>
            {restaurants.map((r) => <option key={r.id} value={r.id} style={{ background: "#1A1A1A" }}>{r.name}</option>)}
          </select>
          {data.length > 0 && <button onClick={exportCSV} style={{ padding: "8px 14px", background: "rgba(244,166,35,0.1)", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 8, color: "#F4A623", fontFamily: F, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}>CSV</button>}
        </div>
      </div>

      {!restaurantId ? (
        <p style={{ color: "#666", fontFamily: F, textAlign: "center", padding: 40 }}>Selecciona un local para ver la tendencia</p>
      ) : loading ? (
        <p style={{ color: "#F4A623", fontFamily: F, textAlign: "center", padding: 40 }}>Cargando...</p>
      ) : data.length > 0 ? (
        <>
          {/* Simple bar chart */}
          <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 14, padding: "20px 16px", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 160, paddingTop: 10 }}>
              {data.map((d, i) => {
                const h = (d.avgTicket / maxTicket) * 140;
                const isActivation = qrActivatedAt && d.weekStart <= qrActivatedAt.split("T")[0] && (i === data.length - 1 || data[i + 1].weekStart > qrActivatedAt.split("T")[0]);
                return (
                  <div key={d.weekStart} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <span style={{ fontFamily: F, fontSize: "0.6rem", color: "#888" }}>${d.avgTicket.toLocaleString("es-CL")}</span>
                    <div style={{ width: "100%", height: h, background: isActivation ? "#4ade80" : "#F4A623", borderRadius: "4px 4px 0 0", position: "relative" }}>
                      {isActivation && <div style={{ position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)", fontFamily: F, fontSize: "0.55rem", color: "#4ade80", whiteSpace: "nowrap" }}>QR</div>}
                    </div>
                    <span style={{ fontFamily: F, fontSize: "0.55rem", color: "#666", transform: "rotate(-45deg)", whiteSpace: "nowrap" }}>{d.weekStart.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Data table */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {data.map((d) => (
              <div key={d.weekStart} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 14px", background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 8 }}>
                <span style={{ fontFamily: F, fontSize: "0.78rem", color: "#888", flex: 1 }}>{d.weekStart}</span>
                <span style={{ fontFamily: F, fontSize: "0.92rem", color: "white", fontWeight: 700 }}>${d.avgTicket.toLocaleString("es-CL")}</span>
                <span style={{ fontFamily: F, fontSize: "0.72rem", color: "#888" }}>{d.ticketCount} tickets</span>
                {d.changePct !== null && (
                  <span style={{ fontFamily: F, fontSize: "0.78rem", color: d.changePct > 0 ? "#4ade80" : d.changePct < 0 ? "#ff6b6b" : "#888", fontWeight: 600 }}>
                    {d.changePct > 0 ? "+" : ""}{d.changePct}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <p style={{ color: "#666", fontFamily: F, textAlign: "center", padding: 40 }}>No hay tickets para este local</p>
      )}
    </div>
  );
}
