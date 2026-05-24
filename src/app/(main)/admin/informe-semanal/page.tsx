"use client";

import { useState, useEffect } from "react";

interface EmailEntry {
  id: string; to: string; subject: string; status: string; createdAt: string;
  ownerName: string | null; restaurantName: string | null; slug: string | null;
  isDemo: boolean; plan: string | null;
  // Parsed from errorMsg field
  openedAt?: string | null; clickedAt?: string | null;
}

export default function InformeSemanalPage() {
  const [logs, setLogs] = useState<EmailEntry[]>([]);
  const [stats, setStats] = useState<{ total: number; sent: number; failed: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/informe-semanal")
      .then(r => r.json())
      .then(data => {
        // Parse open/click from errorMsg
        const enriched = (data.logs || []).map((l: any) => {
          let openedAt: string | null = null;
          let clickedAt: string | null = null;
          if (l.errorMsg) {
            const openMatch = l.errorMsg.match(/opened:([^|]+)/);
            if (openMatch) openedAt = openMatch[1];
            const clickMatch = l.errorMsg.match(/clicked:(.+)/);
            if (clickMatch) clickedAt = clickMatch[1];
          }
          return { ...l, openedAt, clickedAt };
        });
        setLogs(enriched);
        setStats(data.stats || null);
      })
      .finally(() => setLoading(false));
  }, []);

  const timeAgo = (iso: string | null) => {
    if (!iso) return "—";
    const ms = Date.now() - new Date(iso).getTime();
    const hrs = Math.floor(ms / 3600000);
    if (hrs < 24) return `hace ${hrs}h`;
    return `hace ${Math.floor(hrs / 24)}d`;
  };

  if (loading) return <div style={{ padding: 40, color: "#888" }}>Cargando...</div>;

  const opened = logs.filter(l => l.openedAt).length;
  const clicked = logs.filter(l => l.clickedAt).length;

  return (
    <div style={{ maxWidth: 700, padding: "0 12px" }}>
      <h1 style={{ fontFamily: "var(--font-display, Georgia)", fontSize: 22, color: "#F4A623", margin: "0 0 16px" }}>
        Informe Semanal
      </h1>

      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))", gap: 8, marginBottom: 20 }}>
          <StatCard label="Enviados" value={stats.sent} color="#3b82f6" />
          <StatCard label="Abiertos" value={opened} color="#22c55e" />
          <StatCard label="Click" value={clicked} color="#F4A623" />
          <StatCard label="Fallidos" value={stats.failed} color="#ef4444" />
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {logs.map(l => (
          <div key={l.id} style={{
            background: "#1a1a1a", borderRadius: 12, padding: "12px 16px",
            border: `1px solid ${l.clickedAt ? "rgba(244,166,35,0.2)" : l.openedAt ? "rgba(34,197,94,0.2)" : "#2a2a2a"}`,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{l.restaurantName || l.to}</span>
                {l.plan && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(168,85,247,0.12)", color: "#a855f7" }}>{l.plan}</span>}
                {l.isDemo && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(244,166,35,0.12)", color: "#F4A623" }}>DEMO</span>}
              </div>
              <span style={{ fontSize: 11, color: "#555" }}>{timeAgo(l.createdAt)}</span>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", fontSize: 12, color: "#888" }}>
              {l.ownerName && <span>{l.ownerName}</span>}
              <span>{l.to}</span>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 6, fontSize: 11 }}>
              <span style={{
                padding: "2px 8px", borderRadius: 4, fontWeight: 700,
                background: l.status === "sent" ? "rgba(34,197,94,0.12)" : l.status === "failed" ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.06)",
                color: l.status === "sent" ? "#22c55e" : l.status === "failed" ? "#ef4444" : "#888",
              }}>
                {l.status === "sent" ? "Enviado" : l.status === "failed" ? "Falló" : l.status}
              </span>
              {l.openedAt && (
                <span style={{ padding: "2px 8px", borderRadius: 4, fontWeight: 700, background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>
                  Abierto {timeAgo(l.openedAt)}
                </span>
              )}
              {l.clickedAt && (
                <span style={{ padding: "2px 8px", borderRadius: 4, fontWeight: 700, background: "rgba(244,166,35,0.12)", color: "#F4A623" }}>
                  Click {timeAgo(l.clickedAt)}
                </span>
              )}
            </div>

            <div style={{ marginTop: 6, display: "flex", gap: 12 }}>
              {l.slug && (
                <a href={`/qr/${l.slug}`} target="_blank" rel="noopener noreferrer" style={{ color: "#F4A623", fontSize: 11, fontWeight: 600, textDecoration: "none" }}>Ver carta</a>
              )}
              {l.slug && (
                <a href={`/api/admin/informe-semanal/preview?slug=${l.slug}`} target="_blank" rel="noopener noreferrer" style={{ color: "#3b82f6", fontSize: 11, fontWeight: 600, textDecoration: "none" }}>Ver email</a>
              )}
            </div>
          </div>
        ))}

        {logs.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: "#666" }}>No hay informes semanales enviados aún.</div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: "#1a1a1a", borderRadius: 10, padding: "12px 14px", border: "1px solid #2a2a2a" }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{label}</div>
    </div>
  );
}
