"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import Link from "next/link";
import SkeletonLoading from "@/components/admin/SkeletonLoading";

const F = "var(--font-display)";

export default function TicketTrendPage() {
  const pathname = usePathname();
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
          <Link href={pathname.startsWith("/panel") ? "/panel/analytics" : "/admin/analytics"} style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", textDecoration: "none" }}>← Analytics</Link>
          <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: "#F4A623", margin: "8px 0 0" }}>Ticket promedio</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)} style={{ padding: "8px 12px", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text)", fontFamily: F, fontSize: "0.82rem", outline: "none" }}>
            <option value="" style={{ background: "var(--adm-select-bg)" }}>Seleccionar local</option>
            {restaurants.map((r) => <option key={r.id} value={r.id} style={{ background: "var(--adm-select-bg)" }}>{r.name}</option>)}
          </select>
          {data.length > 0 && <button onClick={exportCSV} style={{ padding: "8px 14px", background: "rgba(244,166,35,0.1)", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 8, color: "#F4A623", fontFamily: F, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}>CSV</button>}
        </div>
      </div>

      {!restaurantId ? (
        <p style={{ color: "var(--adm-text2)", fontFamily: F, textAlign: "center", padding: 40 }}>Selecciona un local para ver la tendencia</p>
      ) : loading ? (
        <SkeletonLoading type="analytics" />
      ) : data.length > 0 ? (
        <>
          {/* Simple bar chart */}
          <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "20px 16px", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 160, paddingTop: 10 }}>
              {data.map((d, i) => {
                const h = (d.avgTicket / maxTicket) * 140;
                const isActivation = qrActivatedAt && d.weekStart <= qrActivatedAt.split("T")[0] && (i === data.length - 1 || data[i + 1].weekStart > qrActivatedAt.split("T")[0]);
                return (
                  <div key={d.weekStart} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <span style={{ fontFamily: F, fontSize: "0.6rem", color: "var(--adm-text2)" }}>${d.avgTicket.toLocaleString("es-CL")}</span>
                    <div style={{ width: "100%", height: h, background: isActivation ? "#4ade80" : "#F4A623", borderRadius: "4px 4px 0 0", position: "relative" }}>
                      {isActivation && <div style={{ position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)", fontFamily: F, fontSize: "0.55rem", color: "#4ade80", whiteSpace: "nowrap" }}>QR</div>}
                    </div>
                    <span style={{ fontFamily: F, fontSize: "0.55rem", color: "var(--adm-text2)", transform: "rotate(-45deg)", whiteSpace: "nowrap" }}>{d.weekStart.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Data table */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {data.map((d) => (
              <div key={d.weekStart} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 14px", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 8 }}>
                <span style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", flex: 1 }}>{d.weekStart}</span>
                <span style={{ fontFamily: F, fontSize: "0.92rem", color: "var(--adm-text)", fontWeight: 700 }}>${d.avgTicket.toLocaleString("es-CL")}</span>
                <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)" }}>{d.ticketCount} tickets</span>
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
        <p style={{ color: "var(--adm-text2)", fontFamily: F, textAlign: "center", padding: 40 }}>No hay tickets para este local</p>
      )}
    </div>
  );
}
