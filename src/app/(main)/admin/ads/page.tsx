"use client";
import { useState, useEffect, useCallback } from "react";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

type Session = {
  id: string;
  sessionId: string;
  utmSource: string | null;
  utmCampaign: string | null;
  utmMedium: string | null;
  utmContent: string | null;
  fbclid: string | null;
  ip: string | null;
  device: string | null;
  userAgent: string | null;
  landingPage: string | null;
  exitPage: string | null;
  referrer: string | null;
  duration: number;
  maxScroll: number;
  interactions: number;
  pageViews: number;
  sectionsViewed: string[];
  leadId: string | null;
  converted: boolean;
  bounced: boolean;
  events: any[];
  createdAt: string;
};

type AdData = {
  sessions: Session[];
  totalSessions: number;
  converted: number;
  bounced: number;
  avgDuration: number;
  avgScroll: number;
  avgInteractions: number;
  mobile: number;
  desktop: number;
  subircartaVisits: number;
};

function fmt(secs: number) {
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

function Stat({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: "16px 20px" }}>
      <div style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: F, fontSize: "1.6rem", fontWeight: 800, color: color || "var(--adm-text)", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function FunnelBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontFamily: F, fontSize: "0.8rem", color: "var(--adm-text)" }}>{label}</span>
        <span style={{ fontFamily: F, fontSize: "0.8rem", color: "var(--adm-text2)" }}>{value} <span style={{ color: "var(--adm-text3)" }}>({pct}%)</span></span>
      </div>
      <div style={{ height: 8, background: "var(--adm-card-border)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

function EventBadge({ type, data }: { type: string; data?: any }) {
  const colors: Record<string, string> = {
    click: "#3b82f6",
    section_view: "#8b5cf6",
    scroll_milestone: "#f59e0b",
    input_focus: "#10b981",
    page_load: "#6b7280",
    tab_hidden: "#ef4444",
    tab_visible: "#22c55e",
  };
  const color = colors[type] || "#6b7280";
  const label = type === "click" && data?.label
    ? `click: ${data.label.slice(0, 30)}`
    : type === "section_view" && data?.section
    ? `sección: ${data.section}`
    : type === "scroll_milestone"
    ? `scroll ${data?.pct || ""}%`
    : type === "input_focus"
    ? `campo: ${data?.placeholder || data?.type || ""}`
    : type === "page_load"
    ? `cargó ${data?.page || ""}`
    : type;

  return (
    <span style={{
      display: "inline-block", padding: "2px 6px", borderRadius: 4,
      background: color + "20", color, border: `1px solid ${color}40`,
      fontFamily: FB, fontSize: "0.65rem", marginRight: 4, marginBottom: 4,
    }}>
      {label}
    </span>
  );
}

export default function AdsPage() {
  const [data, setData] = useState<AdData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("7");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [campaign, setCampaign] = useState("truco");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Use tag filter: FB ads append utm_source=ig over ?ads=truco, so filter by landingPage
      const params = new URLSearchParams({ days: period, ...(campaign ? { tag: campaign } : {}) });
      const res = await fetch(`/api/admin/facebook-ads?${params}`);
      if (!res.ok) { setLoading(false); return; }
      const json = await res.json();

      const sessions: Session[] = json.sessions || [];

      const total = sessions.length;
      const conv = sessions.filter((s: Session) => s.converted).length;
      const boun = sessions.filter((s: Session) => s.bounced).length;
      const mob = sessions.filter((s: Session) => s.device === "mobile").length;
      const dsk = sessions.filter((s: Session) => s.device === "desktop").length;
      const avgDur = total > 0 ? Math.round(sessions.reduce((a: number, s: Session) => a + s.duration, 0) / total) : 0;
      const avgScr = total > 0 ? Math.round(sessions.reduce((a: number, s: Session) => a + s.maxScroll, 0) / total) : 0;
      const avgInt = total > 0 ? Math.round(sessions.reduce((a: number, s: Session) => a + s.interactions, 0) / total) : 0;
      const subVisits = sessions.filter((s: Session) => {
        const landed = (s.landingPage || "").includes("/subircarta");
        const visitedViaEvents = (s.events || []).some((e: any) => e.type === "page_load" && (e.data?.page || "").includes("/subircarta"));
        return landed || visitedViaEvents;
      }).length;

      setData({ sessions, totalSessions: total, converted: conv, bounced: boun, avgDuration: avgDur, avgScroll: avgScr, avgInteractions: avgInt, mobile: mob, desktop: dsk, subircartaVisits: subVisits });
    } catch {}
    setLoading(false);
  }, [period, campaign]);

  useEffect(() => { load(); }, [load]);

  // Top clicked elements across all sessions
  const clickCounts: Record<string, number> = {};
  if (data) {
    for (const s of data.sessions) {
      for (const e of (s.events || [])) {
        if (e.type === "click" && e.data?.label) {
          const key = e.data.label.slice(0, 50);
          clickCounts[key] = (clickCounts[key] || 0) + 1;
        }
      }
    }
  }
  const topClicks = Object.entries(clickCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Drop-off analysis: sessions that didn't convert — what was their last event?
  const dropoffClicks: Record<string, number> = {};
  if (data) {
    for (const s of data.sessions.filter(s => !s.converted && (s.events || []).length > 0)) {
      const evts = s.events || [];
      const lastClick = [...evts].reverse().find(e => e.type === "click");
      if (lastClick?.data?.label) {
        const key = lastClick.data.label.slice(0, 50);
        dropoffClicks[key] = (dropoffClicks[key] || 0) + 1;
      }
    }
  }
  const topDropoffs = Object.entries(dropoffClicks).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // Section views
  const sectionCounts: Record<string, number> = {};
  if (data) {
    for (const s of data.sessions) {
      for (const sec of (s.sectionsViewed || [])) {
        sectionCounts[sec] = (sectionCounts[sec] || 0) + 1;
      }
    }
  }
  const topSections = Object.entries(sectionCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const total = data?.totalSessions || 0;

  return (
    <div style={{ fontFamily: FB }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: F, fontSize: "1.1rem", fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>
            Análisis Ads Facebook
          </h2>
          <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text2)", margin: "3px 0 0" }}>
            Tráfico desde <code style={{ background: "var(--adm-input)", padding: "1px 5px", borderRadius: 4 }}>?ads={campaign}</code> — ¿por qué no suben su carta?
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={campaign}
            onChange={e => setCampaign(e.target.value)}
            placeholder="nombre del ads"
            style={{ padding: "6px 10px", background: "var(--adm-input)", border: "1px solid var(--adm-input-border)", borderRadius: 8, fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text)", width: 110 }}
          />
          {["1", "7", "14", "30"].map(d => (
            <button key={d} onClick={() => setPeriod(d)} style={{
              padding: "6px 12px", borderRadius: 8, fontFamily: F, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
              background: period === d ? GOLD : "var(--adm-input)", color: period === d ? "#fff" : "var(--adm-text2)",
              border: period === d ? `1px solid ${GOLD}` : "1px solid var(--adm-input-border)",
            }}>
              {d === "1" ? "Hoy" : `${d}d`}
            </button>
          ))}
          <button onClick={load} style={{ padding: "6px 12px", borderRadius: 8, fontFamily: F, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", background: "var(--adm-input)", border: "1px solid var(--adm-input-border)", color: "var(--adm-text2)" }}>
            ↺
          </button>
        </div>
      </div>

      {loading && !data && (
        <div style={{ textAlign: "center", padding: 60, color: "var(--adm-text3)", fontFamily: FB }}>Cargando...</div>
      )}

      {data && (
        <>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
            <Stat label="Visitas" value={total} sub="con ?ads" />
            <Stat label="Conversiones" value={data.converted} sub={total > 0 ? `${Math.round((data.converted / total) * 100)}% tasa` : "-"} color={data.converted > 0 ? "#16a34a" : undefined} />
            <Stat label="Rebotaron" value={data.bounced} sub={total > 0 ? `${Math.round((data.bounced / total) * 100)}%` : "-"} color={data.bounced > total * 0.6 ? "#ef4444" : undefined} />
            <Stat label="Tiempo medio" value={fmt(data.avgDuration)} sub="en el sitio" />
            <Stat label="Scroll medio" value={`${data.avgScroll}%`} sub="de la página" />
            <Stat label="Interacciones" value={data.avgInteractions} sub="promedio" />
            <Stat label="Móvil / PC" value={`${data.mobile}/${data.desktop}`} />
            <Stat label="Llegaron a /subircarta" value={data.subircartaVisits} sub={total > 0 ? `${Math.round((data.subircartaVisits / total) * 100)}%` : "-"} />
          </div>

          {/* Funnel */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
            {/* Drop-off funnel */}
            <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: "18px 20px" }}>
              <div style={{ fontFamily: F, fontSize: "0.8rem", fontWeight: 700, color: "var(--adm-text)", marginBottom: 16 }}>Embudo de conversión</div>
              <FunnelBar label="Visitaron el sitio" value={total} total={total} color="#3b82f6" />
              <FunnelBar label="Llegaron a /subircarta" value={data.subircartaVisits} total={total} color="#8b5cf6" />
              <FunnelBar label="Interactuaron (+3 ints)" value={data.sessions.filter(s => s.interactions >= 3).length} total={total} color="#f59e0b" />
              <FunnelBar label="Subieron su carta ✓" value={data.converted} total={total} color="#16a34a" />
            </div>

            {/* Top clicks */}
            <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: "18px 20px" }}>
              <div style={{ fontFamily: F, fontSize: "0.8rem", fontWeight: 700, color: "var(--adm-text)", marginBottom: 16 }}>Clics más frecuentes</div>
              {topClicks.length === 0 ? (
                <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)" }}>Sin datos</p>
              ) : topClicks.map(([label, count]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid var(--adm-card-border)" }}>
                  <span style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text)", flex: 1, marginRight: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
                  <span style={{ fontFamily: F, fontSize: "0.75rem", fontWeight: 700, color: GOLD }}>{count}x</span>
                </div>
              ))}
            </div>
          </div>

          {/* Drop-off last click + Sections */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
            <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: "18px 20px" }}>
              <div style={{ fontFamily: F, fontSize: "0.8rem", fontWeight: 700, color: "var(--adm-text)", marginBottom: 4 }}>Último clic antes de salir</div>
              <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)", marginBottom: 12 }}>Donde se fueron los que no convirtieron</p>
              {topDropoffs.length === 0 ? (
                <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)" }}>Sin datos</p>
              ) : topDropoffs.map(([label, count]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid var(--adm-card-border)" }}>
                  <span style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text)", flex: 1, marginRight: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
                  <span style={{ fontFamily: F, fontSize: "0.75rem", fontWeight: 700, color: "#ef4444" }}>{count}x</span>
                </div>
              ))}
            </div>

            <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: "18px 20px" }}>
              <div style={{ fontFamily: F, fontSize: "0.8rem", fontWeight: 700, color: "var(--adm-text)", marginBottom: 4 }}>Secciones más vistas</div>
              <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)", marginBottom: 12 }}>Hasta dónde llegaron</p>
              {topSections.length === 0 ? (
                <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)" }}>Sin datos</p>
              ) : topSections.map(([sec, count]) => (
                <div key={sec} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--adm-card-border)" }}>
                  <span style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text)" }}>{sec}</span>
                  <span style={{ fontFamily: F, fontSize: "0.75rem", fontWeight: 700, color: "#8b5cf6" }}>{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Session list */}
          <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--adm-card-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: F, fontSize: "0.8rem", fontWeight: 700, color: "var(--adm-text)" }}>
                Sesiones individuales ({data.sessions.length})
              </span>
              <span style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)" }}>más reciente primero</span>
            </div>
            {data.sessions.length === 0 && (
              <div style={{ padding: 32, textAlign: "center", fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text3)" }}>
                No hay sesiones con <code>?ads={campaign}</code> en los últimos {period} días.<br />
                Asegúrate de que el link del ad incluya el parámetro.
              </div>
            )}
            {data.sessions.map(s => (
              <div key={s.id} style={{ borderBottom: "1px solid var(--adm-card-border)" }}>
                {/* Row */}
                <div
                  onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                  style={{ padding: "12px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}
                >
                  <span style={{
                    fontFamily: F, fontSize: "0.65rem", fontWeight: 700, padding: "2px 7px", borderRadius: 99,
                    background: s.converted ? "rgba(22,163,74,0.1)" : s.bounced ? "rgba(239,68,68,0.1)" : "rgba(251,191,36,0.1)",
                    color: s.converted ? "#16a34a" : s.bounced ? "#ef4444" : "#a16207",
                    border: `1px solid ${s.converted ? "rgba(22,163,74,0.25)" : s.bounced ? "rgba(239,68,68,0.25)" : "rgba(251,191,36,0.25)"}`,
                  }}>
                    {s.converted ? "✓ convirtió" : s.bounced ? "rebotó" : "visitó"}
                  </span>
                  <span style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text2)" }}>{s.device || "?"}</span>
                  <span style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text)" }}>{fmt(s.duration)}</span>
                  <span style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)" }}>↕ {s.maxScroll}%</span>
                  <span style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)" }}>👆 {s.interactions}</span>
                  <span style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)", marginLeft: "auto" }}>{timeAgo(s.createdAt)}</span>
                  <span style={{ fontFamily: FB, fontSize: "0.65rem", color: "var(--adm-text3)" }}>{expanded === s.id ? "▲" : "▼"}</span>
                </div>

                {/* Expanded */}
                {expanded === s.id && (
                  <div style={{ padding: "0 20px 16px", borderTop: "1px solid var(--adm-card-border)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8, margin: "12px 0" }}>
                      <div>
                        <div style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", marginBottom: 2 }}>LANDING</div>
                        <div style={{ fontFamily: FB, fontSize: "0.73rem", color: "var(--adm-text)" }}>{s.landingPage || "?"}</div>
                      </div>
                      <div>
                        <div style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", marginBottom: 2 }}>SALIDA</div>
                        <div style={{ fontFamily: FB, fontSize: "0.73rem", color: "var(--adm-text)" }}>{s.exitPage || "?"}</div>
                      </div>
                      <div>
                        <div style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", marginBottom: 2 }}>REFERRER</div>
                        <div style={{ fontFamily: FB, fontSize: "0.73rem", color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.referrer || "directo"}</div>
                      </div>
                      <div>
                        <div style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", marginBottom: 2 }}>IP</div>
                        <div style={{ fontFamily: FB, fontSize: "0.73rem", color: "var(--adm-text)" }}>{s.ip || "?"}</div>
                      </div>
                      {s.leadId && (
                        <div>
                          <div style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", marginBottom: 2 }}>LEAD ID</div>
                          <div style={{ fontFamily: FB, fontSize: "0.73rem", color: "#16a34a" }}>{s.leadId.slice(0, 8)}…</div>
                        </div>
                      )}
                    </div>

                    {/* Secciones */}
                    {s.sectionsViewed.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", marginBottom: 6 }}>SECCIONES VISTAS</div>
                        <div>{s.sectionsViewed.map((sec, i) => (
                          <span key={i} style={{ display: "inline-block", padding: "2px 7px", borderRadius: 4, background: "rgba(139,92,246,0.1)", color: "#8b5cf6", fontFamily: FB, fontSize: "0.7rem", marginRight: 4, marginBottom: 4 }}>{sec}</span>
                        ))}</div>
                      </div>
                    )}

                    {/* Timeline */}
                    {s.events.length > 0 && (
                      <div>
                        <div style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", marginBottom: 6 }}>TIMELINE DE EVENTOS</div>
                        <div style={{ maxHeight: 200, overflowY: "auto", padding: "8px 12px", background: "var(--adm-input)", borderRadius: 8 }}>
                          {s.events.map((e, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                              <span style={{ fontFamily: FB, fontSize: "0.65rem", color: "var(--adm-text3)", minWidth: 36, flexShrink: 0 }}>
                                {e.ts ? `+${Math.round(e.ts / 1000)}s` : ""}
                              </span>
                              <EventBadge type={e.type} data={e.data} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
