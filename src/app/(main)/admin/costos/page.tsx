"use client";

import { useState, useEffect } from "react";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

interface CostData {
  from: string;
  to: string;
  totalCostUsd: number;
  totalCalls: number;
  uniqueLeads: number;
  costPerLead: number;
  byService: Record<string, { count: number; costUsd: number; inputTokens: number; outputTokens: number }>;
  byDay: Record<string, Record<string, number>>;
  byAction: Record<string, { count: number; costUsd: number }>;
  topLeads: { leadId: string; costUsd: number; localName?: string }[];
  metaAds: { spendClp: number; impressions: number; clicks: number; leads: number; landingViews: number } | null;
}

const SERVICE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  claude: { label: "Claude API", icon: "🧠", color: "#a78bfa" },
  twilio: { label: "WhatsApp (Twilio)", icon: "💬", color: "#22c55e" },
  resend: { label: "Email (Resend)", icon: "📧", color: "#f59e0b" },
  supabase: { label: "Supabase", icon: "🗄️", color: "#3b82f6" },
};

const ACTION_LABELS: Record<string, string> = {
  extract_document_text: "Extraer texto PDF",
  pdf_vision_single: "PDF Vision (completo)",
  pdf_vision_page: "PDF Vision (por página)",
  pdf_vision_batch: "PDF Vision (batch imágenes)",
  extract_image: "Extraer imagen",
  scrape_menu: "Scraping menú",
  translate: "Traducción",
  whatsapp_agent: "Agente WhatsApp",
  extract_ingredients: "Extraer ingredientes",
  send_whatsapp: "Enviar WhatsApp",
  send_email: "Enviar email",
  storage_upload: "Storage upload",
  historical_extraction: "Extracción (histórico)",
  historical_translation: "Traducción (histórico)",
  historical_ingredients: "Ingredientes (histórico)",
  historical_wa_agent: "Agente WA (histórico)",
  historical_weekly_email: "Weekly email (histórico)",
  historical_whatsapp: "WhatsApp (histórico)",
  historical_email: "Email (histórico)",
};

function usd(n: number) {
  return `$${n.toFixed(4)}`;
}

function clp(n: number) {
  return `$${Math.round(n * 950).toLocaleString("es-CL")}`;
}

function tokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export default function CostosPage() {
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<"hoy" | "7d" | "14d" | "30d">("30d");
  const [allTimeTotal, setAllTimeTotal] = useState<number | null>(null);

  // Fetch all-time total once
  useEffect(() => {
    fetch("/api/admin/costs?from=2024-01-01&to=2030-01-01")
      .then(r => r.json())
      .then(d => {
        // Proyecto inicio 14 abril 2026
        const startDate = new Date("2026-04-14");
        const fixedMonths = Math.max(1, Math.ceil((Date.now() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000)));
        const fixedPerMonthClp = 100_000 + 19_000 + 23_750 + 19_000 + 950; // Claude Pro + Vercel + Supabase + Resend + Dominio
        const metaClp = d.metaAds ? d.metaAds.spendClp : 0;
        const variableClp = Math.round((d.totalCostUsd || 0) * 950);
        setAllTimeTotal(variableClp + metaClp + fixedPerMonthClp * fixedMonths);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const days = preset === "hoy" ? 0 : preset === "7d" ? 7 : preset === "14d" ? 14 : 30;
    const from = preset === "hoy"
      ? new Date().toISOString().slice(0, 10)
      : new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const to = new Date().toISOString().slice(0, 10);

    setLoading(true);
    fetch(`/api/admin/costs?from=${from}&to=${to}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [preset]);

  const cardStyle: React.CSSProperties = {
    background: "var(--adm-card)", border: "1px solid var(--adm-card-border)",
    borderRadius: 16, padding: "18px 20px",
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 800, padding: 20 }}>
        <h1 style={{ fontFamily: F, fontSize: "1.2rem", color: "var(--adm-text)", margin: "0 0 20px" }}>💰 Costos</h1>
        <div style={{ ...cardStyle, textAlign: "center", padding: 40, color: "var(--adm-text3)" }}>Cargando...</div>
      </div>
    );
  }

  if (!data || data.totalCalls === 0) {
    return (
      <div style={{ maxWidth: 800, padding: 20 }}>
        <h1 style={{ fontFamily: F, fontSize: "1.2rem", color: "var(--adm-text)", margin: "0 0 8px" }}>💰 Costos</h1>
        <p style={{ fontFamily: FB, fontSize: "0.88rem", color: "var(--adm-text2)", margin: "0 0 20px" }}>Consumo de servicios externos: Claude API, Twilio, Resend, Supabase</p>
        <div style={{ ...cardStyle, textAlign: "center", padding: 40 }}>
          <p style={{ fontFamily: F, fontSize: "0.92rem", color: "var(--adm-text3)" }}>Sin datos de costos todavía</p>
          <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", marginTop: 4 }}>Los costos se registran automáticamente con cada llamada a servicios externos.</p>
        </div>
      </div>
    );
  }

  const days = Object.keys(data.byDay).sort();
  const maxDayCost = Math.max(...days.map(d => data.byDay[d]._total || 0), 0.001);

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px" }}>💰 Costos</h1>
          <p style={{ fontFamily: FB, fontSize: "0.88rem", color: "var(--adm-text2)", margin: 0 }}>Consumo de servicios externos en tiempo real</p>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {(["hoy", "7d", "14d", "30d"] as const).map(p => (
            <button key={p} onClick={() => setPreset(p)} style={{
              padding: "6px 14px", borderRadius: 999, border: "none", cursor: "pointer",
              fontFamily: F, fontSize: "0.78rem", fontWeight: 600,
              background: preset === p ? "var(--adm-card-border)" : "transparent",
              color: preset === p ? "var(--adm-text)" : "var(--adm-text3)",
            }}>
              {p === "hoy" ? "Hoy" : p === "7d" ? "7 días" : p === "14d" ? "14 días" : "30 días"}
            </button>
          ))}
        </div>
      </div>

      {/* Total acumulado */}
      {allTimeTotal !== null && (
        <div style={{ ...cardStyle, marginBottom: 16, background: "linear-gradient(135deg, var(--adm-card), var(--adm-hover))", border: `1px solid ${GOLD}33`, textAlign: "center" }}>
          <div style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>Total acumulado (desde el inicio)</div>
          <div style={{ fontFamily: F, fontSize: "2rem", fontWeight: 900, color: GOLD }}>${allTimeTotal.toLocaleString("es-CL")} CLP</div>
          <div style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)", marginTop: 2 }}>≈ {usd(allTimeTotal / 950)} USD</div>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Costo total", value: usd(data.totalCostUsd), sub: clp(data.totalCostUsd) + " CLP", color: GOLD },
          { label: "Costo / lead", value: usd(data.costPerLead), sub: clp(data.costPerLead) + " CLP", color: "#a78bfa" },
          { label: "Llamadas API", value: data.totalCalls.toLocaleString(), color: "#3b82f6" },
          { label: "Leads procesados", value: String(data.uniqueLeads), color: "#22c55e" },
        ].map(kpi => (
          <div key={kpi.label} style={{ ...cardStyle, textAlign: "center" }}>
            <div style={{ fontFamily: F, fontSize: "1.4rem", fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", marginTop: 2 }}>{kpi.label}</div>
            {kpi.sub && <div style={{ fontFamily: FB, fontSize: "0.68rem", color: "var(--adm-text3)", marginTop: 2 }}>≈ {kpi.sub}</div>}
          </div>
        ))}
      </div>

      {/* By service */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <h2 style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: ".06em" }}>Por servicio</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Object.entries(data.byService)
            .sort((a, b) => b[1].costUsd - a[1].costUsd)
            .map(([service, info]) => {
              const meta = SERVICE_LABELS[service] || { label: service, icon: "⚙️", color: "#888" };
              const pct = data.totalCostUsd > 0 ? (info.costUsd / data.totalCostUsd * 100) : 0;
              return (
                <div key={service}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text)" }}>{meta.icon} {meta.label}</span>
                    <span style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: meta.color }}>{usd(info.costUsd)}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "var(--adm-hover)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: meta.color, borderRadius: 3, transition: "width 0.3s" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                    <span style={{ fontFamily: FB, fontSize: "0.68rem", color: "var(--adm-text3)" }}>{info.count} llamadas</span>
                    {info.inputTokens > 0 && (
                      <span style={{ fontFamily: FB, fontSize: "0.68rem", color: "var(--adm-text3)" }}>
                        {tokens(info.inputTokens)} in · {tokens(info.outputTokens)} out
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* By day chart */}
      {days.length > 1 && (
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <h2 style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: ".06em" }}>Por día</h2>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 100 }}>
            {days.map(day => {
              const total = data.byDay[day]._total || 0;
              const h = Math.max(2, (total / maxDayCost) * 100);
              const dayNum = day.slice(8);
              return (
                <div key={day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }} title={`${day}: ${usd(total)}`}>
                  <div style={{ width: "100%", maxWidth: 24, height: h, background: `linear-gradient(to top, ${GOLD}44, ${GOLD})`, borderRadius: "4px 4px 0 0" }} />
                  <span style={{ fontFamily: FB, fontSize: "0.55rem", color: "var(--adm-text3)" }}>{dayNum}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* By action */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <h2 style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: ".06em" }}>Por acción</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {Object.entries(data.byAction)
            .sort((a, b) => b[1].costUsd - a[1].costUsd)
            .map(([action, info]) => (
              <div key={action} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)" }}>{ACTION_LABELS[action] || action}</span>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)" }}>{info.count}x</span>
                  <span style={{ fontFamily: F, fontSize: "0.78rem", fontWeight: 700, color: "var(--adm-text)", minWidth: 60, textAlign: "right" }}>{usd(info.costUsd)}</span>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Top leads */}
      {data.topLeads.length > 0 && (
        <div style={{ ...cardStyle }}>
          <h2 style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: ".06em" }}>Leads más caros</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {data.topLeads.map((lead, i) => (
              <div key={lead.leadId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", width: 18 }}>{i + 1}.</span>
                  <span style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text)" }}>{lead.localName || lead.leadId.slice(0, 8)}</span>
                </div>
                <span style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: GOLD }}>{usd(lead.costUsd)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meta Ads */}
      {data.metaAds && (
        <div style={{ ...cardStyle, marginBottom: 16, border: "1px solid rgba(66,103,178,.25)" }}>
          <h2 style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: ".06em" }}>📣 Meta Ads</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10, marginBottom: 14 }}>
            {[
              { label: "Gasto", value: `$${data.metaAds.spendClp.toLocaleString("es-CL")}`, sub: "CLP", color: "#4267B2" },
              { label: "Impresiones", value: data.metaAds.impressions.toLocaleString("es-CL"), color: "var(--adm-text)" },
              { label: "Clicks", value: data.metaAds.clicks.toLocaleString("es-CL"), color: "var(--adm-text)" },
              { label: "Landing views", value: data.metaAds.landingViews.toLocaleString("es-CL"), color: "var(--adm-text)" },
              { label: "Leads", value: String(data.metaAds.leads), color: "#22c55e" },
              { label: "Costo / lead", value: data.metaAds.leads > 0 ? `$${Math.round(data.metaAds.spendClp / data.metaAds.leads).toLocaleString("es-CL")}` : "—", sub: "CLP", color: GOLD },
            ].map(kpi => (
              <div key={kpi.label} style={{ textAlign: "center", padding: "8px 4px" }}>
                <div style={{ fontFamily: F, fontSize: "1rem", fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
                {kpi.sub && <div style={{ fontFamily: FB, fontSize: "0.62rem", color: "var(--adm-text3)" }}>{kpi.sub}</div>}
                <div style={{ fontFamily: FB, fontSize: "0.68rem", color: "var(--adm-text3)", marginTop: 2 }}>{kpi.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resumen del período */}
      {(() => {
        const periodLabel = preset === "hoy" ? "hoy" : preset === "7d" ? "últimos 7 días" : preset === "14d" ? "últimos 14 días" : "últimos 30 días";
        const variableTotal = data.totalCostUsd;
        const metaAdsUsd = data.metaAds ? data.metaAds.spendClp / 950 : 0;
        const periodTotal = variableTotal + metaAdsUsd;

        return (
          <div style={{ ...cardStyle, marginTop: 20, background: "linear-gradient(135deg, var(--adm-card), var(--adm-hover))", border: `1px solid ${GOLD}33` }}>
            <h2 style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 800, color: GOLD, margin: "0 0 16px", textTransform: "uppercase", letterSpacing: ".06em" }}>Gasto real — {periodLabel}</h2>

            {/* Variable costs */}
            {Object.entries(data.byService)
              .sort((a, b) => b[1].costUsd - a[1].costUsd)
              .map(([service, info]) => {
                const meta = SERVICE_LABELS[service] || { label: service, icon: "⚙️", color: "#888" };
                return (
                  <div key={service} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                    <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)" }}>{meta.icon} {meta.label}</span>
                    <span style={{ fontFamily: F, fontSize: "0.78rem", fontWeight: 700, color: "var(--adm-text)" }}>{usd(info.costUsd)} <span style={{ color: "var(--adm-text3)", fontWeight: 400 }}>({clp(info.costUsd)})</span></span>
                  </div>
                );
              })}

            {/* Meta Ads */}
            {data.metaAds && data.metaAds.spendClp > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)" }}>📣 Meta Ads</span>
                <span style={{ fontFamily: F, fontSize: "0.78rem", fontWeight: 700, color: "var(--adm-text)" }}>{usd(metaAdsUsd)} <span style={{ color: "var(--adm-text3)", fontWeight: 400 }}>({`$${data.metaAds.spendClp.toLocaleString("es-CL")}`})</span></span>
              </div>
            )}

            {/* Period total */}
            <div style={{ background: "var(--adm-card)", borderRadius: 12, padding: "14px 16px", border: `1px solid ${GOLD}44`, marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 800, color: "var(--adm-text)" }}>TOTAL {periodLabel.toUpperCase()}</span>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 900, color: GOLD }}>{usd(periodTotal)}</div>
                  <div style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)" }}>≈ {clp(periodTotal)} CLP</div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Costos fijos mensuales (referencia) */}
      {(() => {
        const fixedCosts = [
          { label: "Claude Code Pro", clp: 100_000 },
          { label: "Vercel Pro", clp: Math.round(20 * 950) },
          { label: "Supabase Pro", clp: Math.round(25 * 950) },
          { label: "Resend (50K emails)", clp: Math.round(20 * 950) },
          { label: "Dominio (anual ÷ 12)", clp: Math.round(1 * 950) },
        ];
        const totalFixed = fixedCosts.reduce((s, c) => s + c.clp, 0);
        return (
          <div style={{ ...cardStyle, marginTop: 16, opacity: 0.7 }}>
            <h2 style={{ fontFamily: F, fontSize: "0.78rem", fontWeight: 700, color: "var(--adm-text3)", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: ".06em" }}>Costos fijos mensuales (referencia)</h2>
            {fixedCosts.map(c => (
              <div key={c.label} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                <span style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)" }}>{c.label}</span>
                <span style={{ fontFamily: F, fontSize: "0.75rem", fontWeight: 600, color: "var(--adm-text3)" }}>${c.clp.toLocaleString("es-CL")}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0 0", borderTop: "1px solid var(--adm-card-border)", marginTop: 6 }}>
              <span style={{ fontFamily: F, fontSize: "0.75rem", fontWeight: 700, color: "var(--adm-text3)" }}>Total fijo/mes</span>
              <span style={{ fontFamily: F, fontSize: "0.75rem", fontWeight: 700, color: "var(--adm-text3)" }}>${totalFixed.toLocaleString("es-CL")} CLP</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
