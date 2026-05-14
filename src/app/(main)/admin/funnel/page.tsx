"use client";

import { useState, useEffect } from "react";

interface Lead {
  id: string;
  localName: string;
  ownerName: string;
  email: string;
  whatsapp: string | null;
  cartaType: "LINK" | "DOCUMENT" | "PHOTO";
  cartaUrl: string | null;
  cartaFileUrl: string | null;
  cartaStatus: string;
  activated: boolean;
  detectedProvider: { name: string } | null;
  createdAt: string;
}

interface Stats {
  total: number;
  completed: number;
  pending: number;
  byType: { LINK: number; DOCUMENT: number; PHOTO: number };
}

export default function FunnelPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/funnel")
      .then((r) => r.json())
      .then((data) => {
        setLeads(data.leads || []);
        setStats(data.stats || null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ padding: 40, color: "#aaa" }}>Cargando...</div>;
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1 style={{ fontFamily: "var(--font-display, Georgia)", fontSize: 28, color: "#F4A623", marginBottom: 24 }}>
        Funnel /subircarta
      </h1>

      {/* Stats cards */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 28 }}>
          <StatCard label="Total leads" value={stats.total} />
          <StatCard label="Completados" value={stats.completed} color="#43d17b" />
          <StatCard label="Abandonados" value={stats.pending} color="#e85d5d" />
          <StatCard label="Modo Link" value={stats.byType.LINK} />
          <StatCard label="Modo PDF" value={stats.byType.DOCUMENT} />
          <StatCard label="Modo Foto" value={stats.byType.PHOTO} />
        </div>
      )}

      {/* Leads table */}
      <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid #2a2a2a" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#1a1a1a", color: "#aaa", textAlign: "left" }}>
              <th style={th}>Fecha</th>
              <th style={th}>Local</th>
              <th style={th}>Dueño</th>
              <th style={th}>Email</th>
              <th style={th}>WhatsApp</th>
              <th style={th}>Tipo</th>
              <th style={th}>Proveedor</th>
              <th style={th}>URL carta</th>
              <th style={th}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 32, textAlign: "center", color: "#666" }}>No hay leads todavía.</td></tr>
            )}
            {leads.map((lead) => {
              const completed = !!lead.email;
              const date = new Date(lead.createdAt);
              const dateStr = `${date.getDate()}/${date.getMonth() + 1} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
              const domain = lead.cartaUrl ? (() => { try { return new URL(lead.cartaUrl).hostname; } catch { return lead.cartaUrl; } })() : "—";

              return (
                <tr key={lead.id} style={{ borderTop: "1px solid #222", background: completed ? "transparent" : "rgba(232,93,93,.04)" }}>
                  <td style={td}>{dateStr}</td>
                  <td style={td}>{lead.localName || <span style={{ color: "#555" }}>—</span>}</td>
                  <td style={td}>{lead.ownerName || <span style={{ color: "#555" }}>—</span>}</td>
                  <td style={td}>{lead.email || <span style={{ color: "#555" }}>no completó</span>}</td>
                  <td style={td}>{lead.whatsapp || <span style={{ color: "#555" }}>—</span>}</td>
                  <td style={td}><TypeBadge type={lead.cartaType} /></td>
                  <td style={td}>{lead.detectedProvider?.name || <span style={{ color: "#555" }}>—</span>}</td>
                  <td style={{ ...td, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {lead.cartaUrl ? <a href={lead.cartaUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#F4A623" }}>{domain}</a> : "—"}
                  </td>
                  <td style={td}><StatusBadge status={lead.cartaStatus} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ background: "#1a1a1a", borderRadius: 12, padding: "16px 18px", border: "1px solid #2a2a2a" }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || "#fff", marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#888" }}>{label}</div>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = { LINK: "#3b82f6", DOCUMENT: "#f59e0b", PHOTO: "#8b5cf6" };
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: `${colors[type] || "#666"}22`, color: colors[type] || "#666" }}>
      {type}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = { PENDING: "#f59e0b", PROCESSING: "#3b82f6", READY: "#43d17b", DELIVERED: "#43d17b" };
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: `${colors[status] || "#666"}22`, color: colors[status] || "#666" }}>
      {status}
    </span>
  );
}

const th: React.CSSProperties = { padding: "10px 12px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" };
const td: React.CSSProperties = { padding: "10px 12px", color: "#ddd" };
