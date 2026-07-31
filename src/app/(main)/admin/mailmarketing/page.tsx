"use client";
import { useState, useEffect } from "react";

const F  = "var(--font-display, Georgia, serif)";
const FB = "system-ui, -apple-system, sans-serif";
const GOLD = "#F4A623";

interface Campaign {
  purpose: string;
  subject: string;
  sent: number;
  opened: number;
  clicked: number;
  sentAt: string | null;
}

function pct(num: number, total: number) {
  if (!total) return "—";
  return `${Math.round((num / total) * 100)}%`;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}

// Human-readable campaign name from purpose key
function campaignLabel(purpose: string) {
  const map: Record<string, string> = {
    new_features_loyalty_valoraciones_jul2026: "Novedades: Loyalty + Valoraciones + Página local",
  };
  return map[purpose] ?? purpose.replace(/_/g, " ");
}

export default function MailMarketingPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/mailmarketing")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.campaigns)) setCampaigns(d.campaigns); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 20px" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: F, fontSize: "1.4rem", fontWeight: 800, color: "#fff", margin: "0 0 6px" }}>
          ✉️ Mail Marketing
        </h1>
        <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "#666", margin: 0 }}>
          Campañas enviadas a los dueños de restaurantes. Tasa de apertura y clicks por campaña.
        </p>
      </div>

      {/* Instrucción para futuros envíos */}
      <div style={{ background: "#141414", border: "1px solid #222", borderRadius: 14, padding: "16px 20px", marginBottom: 28 }}>
        <p style={{ fontFamily: F, fontSize: "0.8rem", fontWeight: 700, color: GOLD, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          ¿Cómo enviar una campaña?
        </p>
        <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "#777", margin: 0, lineHeight: 1.6 }}>
          Usa <code style={{ background: "#222", padding: "1px 6px", borderRadius: 4, color: "#ccc" }}>scripts/email-novedades-template.mjs</code> como base.
          Crea un nuevo script de envío importando <code style={{ background: "#222", padding: "1px 6px", borderRadius: 4, color: "#ccc" }}>buildNovedadesEmail</code> y <code style={{ background: "#222", padding: "1px 6px", borderRadius: 4, color: "#ccc" }}>featureCard</code>.
          Define un <code style={{ background: "#222", padding: "1px 6px", borderRadius: 4, color: "#ccc" }}>PURPOSE</code> único y registra cada envío en <code style={{ background: "#222", padding: "1px 6px", borderRadius: 4, color: "#ccc" }}>EmailLog</code> — aparecerá aquí automáticamente.
        </p>
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "#555" }}>Cargando...</p>
      ) : campaigns.length === 0 ? (
        <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "#555" }}>Sin campañas registradas.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {campaigns.map(c => {
            const openRate  = c.sent > 0 ? Math.round((c.opened  / c.sent) * 100) : 0;
            const clickRate = c.sent > 0 ? Math.round((c.clicked / c.sent) * 100) : 0;
            const openColor  = openRate  >= 30 ? "#4ade80" : openRate  >= 15 ? GOLD : "#ef4444";
            const clickColor = clickRate >= 5  ? "#4ade80" : clickRate >= 2  ? GOLD : "#888";

            return (
              <div key={c.purpose} style={{ background: "#111", border: "1px solid #222", borderRadius: 16, padding: "20px 24px" }}>
                {/* Campaign name + date */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: F, fontSize: "1rem", fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>
                      {campaignLabel(c.purpose)}
                    </p>
                    <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "#555", margin: 0 }}>
                      {c.subject}
                    </p>
                  </div>
                  <span style={{ fontFamily: FB, fontSize: "0.75rem", color: "#444", flexShrink: 0 }}>
                    {formatDate(c.sentAt)}
                  </span>
                </div>

                {/* Stats row */}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {/* Enviados */}
                  <div style={{ flex: 1, minWidth: 100, background: "#1a1a1a", borderRadius: 10, padding: "12px 16px" }}>
                    <p style={{ fontFamily: FB, fontSize: "0.68rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>Enviados</p>
                    <p style={{ fontFamily: F, fontSize: "1.4rem", fontWeight: 800, color: "#fff", margin: 0 }}>{c.sent.toLocaleString("es-CL")}</p>
                  </div>

                  {/* Abiertos */}
                  <div style={{ flex: 1, minWidth: 100, background: "#1a1a1a", borderRadius: 10, padding: "12px 16px" }}>
                    <p style={{ fontFamily: FB, fontSize: "0.68rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>Abiertos</p>
                    <p style={{ fontFamily: F, fontSize: "1.4rem", fontWeight: 800, color: openColor, margin: 0 }}>
                      {pct(c.opened, c.sent)}
                    </p>
                    <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "#444", margin: "2px 0 0" }}>{c.opened} de {c.sent}</p>
                  </div>

                  {/* Clicks */}
                  <div style={{ flex: 1, minWidth: 100, background: "#1a1a1a", borderRadius: 10, padding: "12px 16px" }}>
                    <p style={{ fontFamily: FB, fontSize: "0.68rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>Clicks</p>
                    <p style={{ fontFamily: F, fontSize: "1.4rem", fontWeight: 800, color: clickColor, margin: 0 }}>
                      {pct(c.clicked, c.sent)}
                    </p>
                    <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "#444", margin: "2px 0 0" }}>{c.clicked} de {c.sent}</p>
                  </div>

                  {/* Barra visual de apertura */}
                  <div style={{ flex: 2, minWidth: 160, background: "#1a1a1a", borderRadius: 10, padding: "12px 16px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontFamily: FB, fontSize: "0.68rem", color: "#555" }}>Apertura</span>
                      <span style={{ fontFamily: F, fontSize: "0.68rem", fontWeight: 700, color: openColor }}>{pct(c.opened, c.sent)}</span>
                    </div>
                    <div style={{ height: 4, background: "#2a2a2a", borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
                      <div style={{ height: "100%", width: `${Math.min(openRate, 100)}%`, background: openColor, borderRadius: 4, transition: "width 0.6s" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontFamily: FB, fontSize: "0.68rem", color: "#555" }}>Clicks</span>
                      <span style={{ fontFamily: F, fontSize: "0.68rem", fontWeight: 700, color: clickColor }}>{pct(c.clicked, c.sent)}</span>
                    </div>
                    <div style={{ height: 4, background: "#2a2a2a", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(clickRate * 5, 100)}%`, background: clickColor, borderRadius: 4, transition: "width 0.6s" }} />
                    </div>
                  </div>
                </div>

                {/* Purpose key */}
                <p style={{ fontFamily: "monospace", fontSize: "0.65rem", color: "#333", margin: "12px 0 0" }}>
                  purpose: {c.purpose}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
