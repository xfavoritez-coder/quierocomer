"use client";

import { useState, useEffect } from "react";

const F = "var(--font-display)";

interface Contact {
  email: string;
  openedAt: string | null;
  clickedAt: string | null;
  unsubscribedAt: string | null;
  errorMsg: string | null;
  sentAt: string | null;
}

interface Campaign {
  id: string;
  subject: string;
  status: string;
  totalContacts: number;
  sentAt: string | null;
  createdAt: string;
  stats: { sent: number; opened: number; clicked: number; unsubs: number; errors: number };
  contacts: Contact[];
}

interface DemoLead {
  to: string;
  subject: string;
  createdAt: string;
}

function StatCard({ label, value, pct, color, icon }: { label: string; value: number; pct?: string; color: string; icon: string }) {
  return (
    <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 14, padding: "20px 22px", flex: 1, minWidth: 140 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        {pct && <span style={{ fontSize: 11, fontWeight: 700, color, fontFamily: F }}>{pct}</span>}
      </div>
      <p style={{ fontSize: 30, fontWeight: 700, color, fontFamily: F, margin: "0 0 4px", lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 11, color: "#666", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", margin: 0, fontFamily: F }}>{label}</p>
    </div>
  );
}

export default function MarketingAdmin() {
  const [data, setData] = useState<{ campaigns: Campaign[]; demoLeads: DemoLead[] } | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "opened" | "clicked" | "unsubs">("all");

  useEffect(() => {
    fetch("/api/admin/marketing").then((r) => r.json()).then(setData);
  }, []);

  if (!data) return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#F4A623", fontFamily: F, fontSize: 14 }}>📣 Cargando marketing...</p>
    </div>
  );

  const campaign = data.campaigns.find((c) => c.id === selectedCampaign) || data.campaigns[0];
  const filteredContacts = campaign
    ? campaign.contacts.filter((c) => {
        if (tab === "opened") return c.openedAt;
        if (tab === "clicked") return c.clickedAt;
        if (tab === "unsubs") return c.unsubscribedAt;
        return true;
      })
    : [];

  const pct = (n: number, total: number) => total > 0 ? `${Math.round((n / total) * 100)}%` : "0%";

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: F, fontSize: 24, fontWeight: 700, color: "#F4A623", margin: "0 0 6px" }}>📣 Marketing</h1>
        <p style={{ fontSize: 13, color: "#666", margin: 0, fontFamily: F }}>Campañas de plataforma · Tracking · Leads</p>
      </div>

      {/* Campaign selector */}
      {data.campaigns.length > 1 && (
        <select
          value={campaign?.id || ""}
          onChange={(e) => setSelectedCampaign(e.target.value)}
          style={{ marginBottom: 20, padding: "10px 14px", borderRadius: 10, border: "1px solid #2A2A2A", background: "#1A1A1A", color: "#ccc", fontSize: 13, fontFamily: F }}
        >
          {data.campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.subject} — {new Date(c.createdAt).toLocaleDateString("es-CL")}</option>
          ))}
        </select>
      )}

      {campaign && (
        <>
          {/* Campaign info */}
          <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 14, padding: "18px 22px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#eee", fontFamily: F, margin: "0 0 4px" }}>{campaign.subject}</p>
              <p style={{ fontSize: 12, color: "#666", margin: 0, fontFamily: F }}>
                {campaign.sentAt ? `Enviada el ${new Date(campaign.sentAt).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}` : "No enviada"}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: F, textTransform: "uppercase", letterSpacing: "0.5px",
                background: campaign.status === "sent" ? "rgba(74,222,128,0.1)" : campaign.status === "sending" ? "rgba(244,166,35,0.1)" : "rgba(255,255,255,0.05)",
                color: campaign.status === "sent" ? "#4ade80" : campaign.status === "sending" ? "#F4A623" : "#888",
              }}>
                {campaign.status === "sent" ? "Enviada" : campaign.status === "sending" ? "Enviando" : "Borrador"}
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="adm-grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
            <StatCard icon="📤" label="Enviados" value={campaign.stats.sent} color="#F4A623" />
            <StatCard icon="👁️" label="Abiertos" value={campaign.stats.opened} pct={pct(campaign.stats.opened, campaign.stats.sent)} color="#4ade80" />
            <StatCard icon="👆" label="Clics" value={campaign.stats.clicked} pct={pct(campaign.stats.clicked, campaign.stats.sent)} color="#60a5fa" />
            <StatCard icon="🚫" label="Desuscritos" value={campaign.stats.unsubs} pct={pct(campaign.stats.unsubs, campaign.stats.sent)} color="#ff6b6b" />
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
            {(["all", "opened", "clicked", "unsubs"] as const).map((t) => {
              const count = t === "all" ? campaign.contacts.length : t === "opened" ? campaign.stats.opened : t === "clicked" ? campaign.stats.clicked : campaign.stats.unsubs;
              const active = tab === t;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    padding: "8px 16px", borderRadius: 10, border: active ? "1px solid #F4A623" : "1px solid #2A2A2A", cursor: "pointer",
                    background: active ? "rgba(244,166,35,0.1)" : "#1A1A1A", color: active ? "#F4A623" : "#888",
                    fontFamily: F, fontSize: 12, fontWeight: 600,
                  }}
                >
                  {t === "all" ? "Todos" : t === "opened" ? "Abiertos" : t === "clicked" ? "Clics" : "Desuscritos"} ({count})
                </button>
              );
            })}
          </div>

          {/* Contact list */}
          <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 14, overflow: "hidden", marginBottom: 40 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: F }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #2A2A2A" }}>
                  <th style={{ padding: "12px 16px", fontWeight: 600, color: "#666", textAlign: "left", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.5px" }}>Email</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600, color: "#666", textAlign: "left", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.5px" }}>Enviado</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600, color: "#666", textAlign: "center", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.5px" }}>Abierto</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600, color: "#666", textAlign: "center", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.5px" }}>Clic</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600, color: "#666", textAlign: "center", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.5px" }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.slice(0, 100).map((c) => (
                  <tr key={c.email} style={{ borderTop: "1px solid #222" }}>
                    <td style={{ padding: "10px 16px", color: "#ccc" }}>{c.email}</td>
                    <td style={{ padding: "10px 16px", color: "#666" }}>
                      {c.sentAt ? new Date(c.sentAt).toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>
                      {c.openedAt ? <span style={{ color: "#4ade80" }}>●</span> : <span style={{ color: "#333" }}>●</span>}
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>
                      {c.clickedAt ? <span style={{ color: "#60a5fa" }}>●</span> : <span style={{ color: "#333" }}>●</span>}
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>
                      {c.unsubscribedAt
                        ? <span style={{ color: "#ff6b6b", fontSize: 10, fontWeight: 700 }}>DESUSCRITO</span>
                        : c.errorMsg
                        ? <span style={{ color: "#ff6b6b", fontSize: 10 }}>ERROR</span>
                        : <span style={{ color: "#4ade80", fontSize: 10 }}>OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredContacts.length > 100 && (
              <p style={{ padding: 14, textAlign: "center", color: "#666", fontSize: 11, borderTop: "1px solid #222", fontFamily: F }}>
                Mostrando 100 de {filteredContacts.length} contactos
              </p>
            )}
            {filteredContacts.length === 0 && (
              <p style={{ padding: 32, textAlign: "center", color: "#555", fontSize: 13, fontFamily: F }}>Sin contactos en este filtro</p>
            )}
          </div>
        </>
      )}

      {data.campaigns.length === 0 && (
        <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 14, padding: 48, textAlign: "center" }}>
          <p style={{ fontSize: 32, margin: "0 0 12px" }}>📣</p>
          <p style={{ color: "#666", fontSize: 14, fontFamily: F }}>No hay campañas aún</p>
        </div>
      )}

      {/* Demo leads */}
      <div style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ fontFamily: F, fontSize: 18, fontWeight: 700, color: "#F4A623", margin: 0 }}>
          🎯 Leads de la landing
        </h2>
        <span style={{ background: "rgba(244,166,35,0.1)", border: "1px solid rgba(244,166,35,0.2)", color: "#F4A623", fontSize: 12, fontWeight: 700, fontFamily: F, padding: "4px 12px", borderRadius: 20 }}>
          {data.demoLeads.length}
        </span>
      </div>
      <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: F }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #2A2A2A" }}>
              <th style={{ padding: "12px 16px", fontWeight: 600, color: "#666", textAlign: "left", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.5px" }}>Email</th>
              <th style={{ padding: "12px 16px", fontWeight: 600, color: "#666", textAlign: "left", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.5px" }}>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {data.demoLeads.map((l, i) => (
              <tr key={i} style={{ borderTop: "1px solid #222" }}>
                <td style={{ padding: "10px 16px", color: "#ccc" }}>{l.to}</td>
                <td style={{ padding: "10px 16px", color: "#666" }}>{new Date(l.createdAt).toLocaleString("es-CL")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.demoLeads.length === 0 && (
          <p style={{ padding: 32, textAlign: "center", color: "#555", fontSize: 13, fontFamily: F }}>Sin leads aún — cuando alguien pida demo desde la landing aparecerá aquí</p>
        )}
      </div>
    </div>
  );
}
