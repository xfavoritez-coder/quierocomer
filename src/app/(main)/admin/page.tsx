"use client";
import { useState, useEffect } from "react";
import { adminFetch } from "@/lib/adminFetch";

export default function AdminDashboard() {
  const [stats, setStats] = useState<{ locales: number; platos: number; interacciones: number; perfiles: number }>({ locales: 0, platos: 0, interacciones: 0, perfiles: 0 });

  useEffect(() => {
    adminFetch("/api/admin/genie")
      .then(r => r.json())
      .then(d => setStats({
        locales: 0,
        platos: 0,
        interacciones: d.stats?.totalInteractions ?? 0,
        perfiles: d.stats?.totalProfiles ?? 0,
      }))
      .catch(() => {});
  }, []);

  return (
    <div style={{ maxWidth: 600 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", color: "#FFD600", marginBottom: 24 }}>QuieroComer Admin</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
        {[
          { label: "Interacciones", value: stats.interacciones, color: "#FFD600" },
          { label: "Perfiles", value: stats.perfiles, color: "#3db89e" },
        ].map(s => (
          <div key={s.label} style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 14, padding: "18px 20px", textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", color: s.color, margin: "0 0 4px", fontWeight: 700 }}>{s.value}</p>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "0.78rem", color: "#888888", margin: 0 }}>{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
