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
      <h1 style={{ fontFamily: "Georgia", fontSize: "1.4rem", color: "#e8a84c", marginBottom: 24 }}>QuieroComer Admin</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
        {[
          { label: "Interacciones", value: stats.interacciones, color: "#e8a84c" },
          { label: "Perfiles", value: stats.perfiles, color: "#3db89e" },
        ].map(s => (
          <div key={s.label} style={{ background: "rgba(45,26,8,0.7)", border: "1px solid rgba(232,168,76,0.12)", borderRadius: 14, padding: "18px 20px", textAlign: "center" }}>
            <p style={{ fontFamily: "Georgia", fontSize: "1.8rem", color: s.color, margin: "0 0 4px", fontWeight: 700 }}>{s.value}</p>
            <p style={{ fontFamily: "Georgia", fontSize: "0.78rem", color: "rgba(240,234,214,0.4)", margin: 0 }}>{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
