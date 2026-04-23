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

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #eeeae0", borderRadius: 12, padding: "16px 20px", textAlign: "center", flex: 1 }}>
      <p style={{ fontSize: 28, fontWeight: 700, color, fontFamily: F, margin: "0 0 4px" }}>{value}</p>
      <p style={{ fontSize: 12, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", margin: 0 }}>{label}</p>
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

  if (!data) return <div style={{ padding: 40, textAlign: "center", color: "#888" }}>Cargando...</div>;

  const campaign = data.campaigns.find((c) => c.id === selectedCampaign) || data.campaigns[0];
  const filteredContacts = campaign
    ? campaign.contacts.filter((c) => {
        if (tab === "opened") return c.openedAt;
        if (tab === "clicked") return c.clickedAt;
        if (tab === "unsubs") return c.unsubscribedAt;
        return true;
      })
    : [];

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>
      <h1 style={{ fontFamily: F, fontSize: 28, fontWeight: 700, color: "#111", marginBottom: 8 }}>Marketing</h1>
      <p style={{ fontSize: 14, color: "#888", marginBottom: 32 }}>Campañas de plataforma y leads de la landing</p>

      {/* Campaign selector */}
      {data.campaigns.length > 1 && (
        <select
          value={campaign?.id || ""}
          onChange={(e) => setSelectedCampaign(e.target.value)}
          style={{ marginBottom: 24, padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14 }}
        >
          {data.campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.subject} — {new Date(c.createdAt).toLocaleDateString("es-CL")}</option>
          ))}
        </select>
      )}

      {campaign && (
        <>
          {/* Stats */}
          <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
            <StatBox label="Enviados" value={campaign.stats.sent} color="#111" />
            <StatBox label="Abiertos" value={campaign.stats.opened} color="#16a34a" />
            <StatBox label="Clics" value={campaign.stats.clicked} color="#2563eb" />
            <StatBox label="Desuscritos" value={campaign.stats.unsubs} color="#dc2626" />
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
            {(["all", "opened", "clicked", "unsubs"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: tab === t ? "#111" : "#f3f0e8", color: tab === t ? "#fff" : "#555",
                  fontFamily: F, fontSize: 13, fontWeight: 600,
                }}
              >
                {t === "all" ? "Todos" : t === "opened" ? "Abiertos" : t === "clicked" ? "Clics" : "Desuscritos"}
                {" "}({t === "all" ? campaign.contacts.length : t === "opened" ? campaign.stats.opened : t === "clicked" ? campaign.stats.clicked : campaign.stats.unsubs})
              </button>
            ))}
          </div>

          {/* Contact list */}
          <div style={{ background: "#fff", border: "1px solid #eeeae0", borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#faf6ee", textAlign: "left" }}>
                  <th style={{ padding: "10px 16px", fontWeight: 600, color: "#888" }}>Email</th>
                  <th style={{ padding: "10px 16px", fontWeight: 600, color: "#888" }}>Enviado</th>
                  <th style={{ padding: "10px 16px", fontWeight: 600, color: "#888" }}>Abierto</th>
                  <th style={{ padding: "10px 16px", fontWeight: 600, color: "#888" }}>Clic</th>
                  <th style={{ padding: "10px 16px", fontWeight: 600, color: "#888" }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.slice(0, 100).map((c) => (
                  <tr key={c.email} style={{ borderTop: "1px solid #f5f0e8" }}>
                    <td style={{ padding: "10px 16px", color: "#333" }}>{c.email}</td>
                    <td style={{ padding: "10px 16px", color: "#888" }}>{c.sentAt ? new Date(c.sentAt).toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                    <td style={{ padding: "10px 16px" }}>{c.openedAt ? "✅" : "—"}</td>
                    <td style={{ padding: "10px 16px" }}>{c.clickedAt ? "✅" : "—"}</td>
                    <td style={{ padding: "10px 16px" }}>
                      {c.unsubscribedAt ? <span style={{ color: "#dc2626", fontWeight: 600 }}>Desuscrito</span>
                        : c.errorMsg ? <span style={{ color: "#dc2626" }}>{c.errorMsg}</span>
                        : <span style={{ color: "#16a34a" }}>OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredContacts.length > 100 && (
              <p style={{ padding: 16, textAlign: "center", color: "#888", fontSize: 13 }}>Mostrando 100 de {filteredContacts.length}</p>
            )}
          </div>
        </>
      )}

      {data.campaigns.length === 0 && (
        <p style={{ color: "#888", fontSize: 15, textAlign: "center", padding: 40 }}>No hay campañas aún.</p>
      )}

      {/* Demo leads */}
      <h2 style={{ fontFamily: F, fontSize: 20, fontWeight: 700, color: "#111", marginTop: 48, marginBottom: 16 }}>
        Leads de la landing ({data.demoLeads.length})
      </h2>
      <div style={{ background: "#fff", border: "1px solid #eeeae0", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#faf6ee", textAlign: "left" }}>
              <th style={{ padding: "10px 16px", fontWeight: 600, color: "#888" }}>Email</th>
              <th style={{ padding: "10px 16px", fontWeight: 600, color: "#888" }}>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {data.demoLeads.map((l, i) => (
              <tr key={i} style={{ borderTop: "1px solid #f5f0e8" }}>
                <td style={{ padding: "10px 16px", color: "#333" }}>{l.to}</td>
                <td style={{ padding: "10px 16px", color: "#888" }}>{new Date(l.createdAt).toLocaleString("es-CL")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.demoLeads.length === 0 && (
          <p style={{ padding: 16, textAlign: "center", color: "#888" }}>Sin leads aún.</p>
        )}
      </div>
    </div>
  );
}
