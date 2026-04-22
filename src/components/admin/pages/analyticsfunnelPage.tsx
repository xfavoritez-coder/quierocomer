"use client";
import { useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import Link from "next/link";
import SkeletonLoading from "@/components/admin/SkeletonLoading";

const F = "var(--font-display)";

function FunnelStep({ label, value, pctRelative, pctAbsolute, color, isFirst }: { label: string; value: number; pctRelative: number; pctAbsolute: number; color: string; isFirst?: boolean }) {
  return (
    <div style={{ textAlign: "center", padding: "20px 16px", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14 }}>
      {!isFirst && (
        <div style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", marginBottom: 8 }}>
          ↓ {pctRelative}% del anterior · {pctAbsolute}% del total
        </div>
      )}
      <p style={{ fontFamily: F, fontSize: "2rem", fontWeight: 700, color, margin: "0 0 4px" }}>{value}</p>
      <p style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text2)", margin: 0 }}>{label}</p>
      <div style={{ marginTop: 10, height: 6, borderRadius: 3, background: "var(--adm-card-border)" }}>
        <div style={{ width: `${pctAbsolute}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.5s" }} />
      </div>
    </div>
  );
}

export default function FunnelPage() {
  const { restaurants } = useAdminSession();
  const [restaurantId, setRestaurantId] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ type: "funnel" });
    if (restaurantId) params.set("restaurantId", restaurantId);
    fetch(`/api/admin/analytics?${params}`).then((r) => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [restaurantId]);

  return (
    <div style={{ maxWidth: 600 }}>
      <div className="adm-flex-wrap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, gap: 10 }}>
        <div>
          <Link href="/admin/analytics" style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", textDecoration: "none" }}>← Analytics</Link>
          <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: "#F4A623", margin: "8px 0 0" }}>Funnel de conversión</h1>
        </div>
        <select value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)} style={{ padding: "8px 12px", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text)", fontFamily: F, fontSize: "0.82rem", outline: "none" }}>
          <option value="" style={{ background: "var(--adm-select-bg)" }}>Todos</option>
          {restaurants.map((r) => <option key={r.id} value={r.id} style={{ background: "var(--adm-select-bg)" }}>{r.name}</option>)}
        </select>
      </div>

      {loading ? (
        <SkeletonLoading type="analytics" />
      ) : data ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <FunnelStep label="Fantasmas únicos" value={data.totalGhosts} pctRelative={100} pctAbsolute={100} color="#F4A623" isFirst />
          <FunnelStep label="Volvieron (recurrentes)" value={data.returnedGhosts} pctRelative={data.returnedPct} pctAbsolute={data.totalGhosts > 0 ? Math.round((data.returnedGhosts / data.totalGhosts) * 100) : 0} color="#3db89e" />
          <FunnelStep label="Se registraron" value={data.convertedUsers} pctRelative={data.convertedPct} pctAbsolute={data.totalGhosts > 0 ? Math.round((data.convertedUsers / data.totalGhosts) * 100) : 0} color="#7fbfdc" />
          <FunnelStep label="Volvieron como registrados" value={data.activatedUsers} pctRelative={data.activatedPct} pctAbsolute={data.totalGhosts > 0 ? Math.round((data.activatedUsers / data.totalGhosts) * 100) : 0} color="#c084fc" />
        </div>
      ) : null}
    </div>
  );
}
