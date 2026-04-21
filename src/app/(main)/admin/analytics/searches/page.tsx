"use client";
import { useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import Link from "next/link";

const F = "var(--font-display)";

export default function SearchesPage() {
  const { restaurants } = useAdminSession();
  const [restaurantId, setRestaurantId] = useState("");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ type: "searches" });
    if (restaurantId) params.set("restaurantId", restaurantId);
    fetch(`/api/admin/analytics?${params}`).then((r) => r.json()).then((d) => setData(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoading(false));
  }, [restaurantId]);

  const exportCSV = () => {
    const header = "Query,Veces buscado,Visitantes únicos,Última vez\n";
    const rows = data.map((d) => `"${d.query}",${d.timesSearched},${d.uniqueVisitors},${d.lastSearchedAt}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "busquedas_fallidas.csv"; a.click();
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <div className="adm-flex-wrap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, gap: 10 }}>
        <div>
          <Link href="/admin/analytics" style={{ fontFamily: F, fontSize: "0.78rem", color: "#888", textDecoration: "none" }}>← Analytics</Link>
          <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: "#F4A623", margin: "8px 0 0" }}>Búsquedas fallidas</h1>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)} style={{ padding: "8px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 10, color: "white", fontFamily: F, fontSize: "0.82rem", outline: "none" }}>
            <option value="" style={{ background: "#1A1A1A" }}>Todos</option>
            {restaurants.map((r) => <option key={r.id} value={r.id} style={{ background: "#1A1A1A" }}>{r.name}</option>)}
          </select>
          {data.length > 0 && (
            <button onClick={exportCSV} style={{ padding: "8px 14px", background: "rgba(244,166,35,0.1)", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 8, color: "#F4A623", fontFamily: F, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}>Exportar CSV</button>
          )}
        </div>
      </div>

      {loading ? (
        <p style={{ color: "#F4A623", fontFamily: F, textAlign: "center", padding: 40 }}>Cargando...</p>
      ) : data.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {data.map((d, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 12 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: F, fontSize: "0.92rem", color: "white", fontWeight: 600, margin: 0 }}>"{d.query}"</p>
                <p style={{ fontFamily: F, fontSize: "0.72rem", color: "#888", margin: "2px 0 0" }}>
                  {d.timesSearched} búsquedas · {d.uniqueVisitors} visitantes · última: {new Date(d.lastSearchedAt).toLocaleDateString("es-CL")}
                </p>
              </div>
              <div style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 700, color: "#F4A623", flexShrink: 0 }}>{d.uniqueVisitors}</div>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: "#666", fontFamily: F, textAlign: "center", padding: 40 }}>No hay búsquedas fallidas en el período</p>
      )}
    </div>
  );
}
