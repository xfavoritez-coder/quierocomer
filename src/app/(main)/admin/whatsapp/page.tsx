"use client";

import { useState, useEffect } from "react";

interface WaLead {
  id: string;
  localName: string;
  ownerName: string;
  email: string;
  whatsapp: string | null;
  generatedSlug: string | null;
  cartaStatus: string;
  whatsappSentAt: string | null;
  whatsappClickedAt: string | null;
  emailOpenedAt: string | null;
  emailClickedAt: string | null;
  openedVia: string | null;
  onboardingDoneAt: string | null;
  panelVisitedAt: string | null;
  activarVisitedAt: string | null;
  activatedAt: string | null;
  deliveredAt: string | null;
  twilioStatus: string | null;
}

interface Stats {
  total: number;
  clicked: number;
  opened: number;
  delivered: number;
  read: number;
  failed: number;
}

const STATUS_COLORS: Record<string, { color: string; label: string }> = {
  queued: { color: "#888", label: "Encolado" },
  sent: { color: "#3b82f6", label: "Enviado" },
  delivered: { color: "#22c55e", label: "Entregado" },
  read: { color: "#a855f7", label: "Leído" },
  failed: { color: "#ef4444", label: "Falló" },
  undelivered: { color: "#f59e0b", label: "No entregado" },
};

export default function WhatsAppPage() {
  const [leads, setLeads] = useState<WaLead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/whatsapp")
      .then(r => r.json())
      .then(data => { setLeads(data.leads || []); setStats(data.stats || null); })
      .finally(() => setLoading(false));
  }, []);

  const timeAgo = (iso: string | null) => {
    if (!iso) return "—";
    const ms = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return "ahora";
    if (mins < 60) return `hace ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `hace ${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `hace ${days}d`;
  };

  if (loading) return <div style={{ padding: 40, color: "#888" }}>Cargando...</div>;

  return (
    <div style={{ maxWidth: 700, padding: "0 12px" }}>
      <h1 style={{ fontFamily: "var(--font-display, Georgia)", fontSize: 22, color: "#22c55e", margin: "0 0 16px" }}>
        WhatsApp
      </h1>

      {/* Stats */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))", gap: 8, marginBottom: 20 }}>
          <StatCard label="Enviados" value={stats.total} color="#3b82f6" />
          <StatCard label="Entregados" value={stats.delivered} color="#22c55e" />
          <StatCard label="Leídos" value={stats.read} color="#a855f7" />
          <StatCard label="Click carta" value={stats.clicked} color="#F4A623" />
          <StatCard label="Vía WA" value={stats.opened} color="#14b8a6" />
          <StatCard label="Fallidos" value={stats.failed} color="#ef4444" />
        </div>
      )}

      {/* Messages list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {leads.map(l => {
          const s = l.twilioStatus ? STATUS_COLORS[l.twilioStatus] : null;
          const clicked = !!l.whatsappClickedAt;
          return (
            <div key={l.id} style={{
              background: "#1a1a1a", borderRadius: 12, padding: "12px 16px",
              border: `1px solid ${clicked ? "rgba(34,197,94,0.2)" : "#2a2a2a"}`,
            }}>
              {/* Header row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{l.localName || "Sin nombre"}</span>
                  {s && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                      background: `${s.color}20`, color: s.color,
                    }}>
                      {s.label}
                    </span>
                  )}
                  {clicked && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                      background: "rgba(244,166,35,0.12)", color: "#F4A623",
                    }}>
                      CLICK
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 11, color: "#555" }}>{timeAgo(l.whatsappSentAt)}</span>
              </div>

              {/* Details */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", fontSize: 12, color: "#888" }}>
                <span>{l.ownerName}</span>
                <span style={{ color: "#22c55e" }}>{l.whatsapp}</span>
                {l.openedVia === "whatsapp" && <span style={{ color: "#14b8a6", fontWeight: 600 }}>Abrió vía WA</span>}
                {l.onboardingDoneAt && <span style={{ color: "#84cc16" }}>Onboarding ✓</span>}
                {l.activatedAt && <span style={{ color: "#F4A623", fontWeight: 600 }}>Activado</span>}
              </div>

              {/* Timeline */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px", fontSize: 11, marginTop: 6, color: "#666" }}>
                <span>Enviado: {timeAgo(l.whatsappSentAt)}</span>
                {l.whatsappClickedAt && <span style={{ color: "#F4A623" }}>Click: {timeAgo(l.whatsappClickedAt)}</span>}
                {l.emailOpenedAt && <span>Email abierto: {timeAgo(l.emailOpenedAt)}</span>}
                {l.panelVisitedAt && <span>Panel: {timeAgo(l.panelVisitedAt)}</span>}
              </div>

              {/* Links */}
              {l.generatedSlug && (
                <div style={{ marginTop: 6, display: "flex", gap: 12 }}>
                  <a href={`/qr/${l.generatedSlug}`} target="_blank" rel="noopener noreferrer" style={{ color: "#F4A623", fontSize: 11, fontWeight: 600, textDecoration: "none" }}>Ver carta</a>
                </div>
              )}
            </div>
          );
        })}

        {leads.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: "#666" }}>No hay mensajes de WhatsApp enviados.</div>
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
