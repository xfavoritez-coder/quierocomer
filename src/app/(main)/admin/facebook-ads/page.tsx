"use client";

import { useState, useEffect } from "react";

interface Stats {
  totalVisits: number;
  adVisits: number;
  fbVisits: number;
  fbPctOfTotal: number;
  totalSessions: number;
  bounced: number;
  bounceRate: number;
  converted: number;
  conversionRate: number;
  avgDuration: number;
  avgScroll: number;
  avgInteractions: number;
  mobile: number;
  desktop: number;
}

interface Session {
  id: string;
  sessionId: string;
  utmSource: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  device: string | null;
  duration: number;
  maxScroll: number;
  interactions: number;
  sectionsViewed: string[];
  converted: boolean;
  bounced: boolean;
  leadId: string | null;
  events: any[];
  createdAt: string;
}

interface Data {
  stats: Stats;
  sourceBreakdown: Record<string, number>;
  byLanding: Record<string, number>;
  byCampaign: Record<string, { visits: number; bounced: number; converted: number; avgDuration: number; avgScroll: number }>;
  byContent: Record<string, { visits: number; bounced: number; converted: number }>;
  sectionCounts: Record<string, number>;
  clickCounts: Record<string, number>;
  daily: Record<string, { visits: number; converted: number; bounced: number }>;
  sessions: Session[];
}

export default function FacebookAdsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [source, setSource] = useState<string | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  const fetchData = (d: number, src: string | null) => {
    setLoading(true);
    fetch(`/api/admin/facebook-ads?days=${d}${src ? `&source=${encodeURIComponent(src)}` : ""}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(days, source); }, [days, source]);

  if (loading) return <div style={{ padding: 40, color: "#aaa" }}>Cargando...</div>;
  if (!data) return <div style={{ padding: 40, color: "#e85d5d" }}>Error al cargar datos.</div>;

  const { stats, sourceBreakdown, byLanding, byCampaign, byContent, sectionCounts, clickCounts, daily, sessions } = data;
  const sortedSources = Object.entries(sourceBreakdown).sort((a, b) => b[1] - a[1]);
  const sortedLandings = Object.entries(byLanding).sort((a, b) => b[1] - a[1]);

  const sortedClicks = Object.entries(clickCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);
  const sortedSections = Object.entries(sectionCounts).sort((a, b) => b[1] - a[1]);
  const sortedCampaigns = Object.entries(byCampaign).sort((a, b) => b[1].visits - a[1].visits);
  const sortedContent = Object.entries(byContent).sort((a, b) => b[1].visits - a[1].visits);
  const sortedDaily = Object.entries(daily).sort((a, b) => a[0].localeCompare(b[0]));

  const fmtDuration = (s: number) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  return (
    <div style={{ maxWidth: 1100, padding: "0 12px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontFamily: "var(--font-display, Georgia)", fontSize: 22, color: "#3b82f6", margin: 0 }}>
          Facebook Ads
        </h1>
        <div style={{ display: "flex", gap: 6 }}>
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              style={{
                padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600,
                background: days === d ? "#3b82f6" : "#1a1a1a", color: days === d ? "#fff" : "#888",
                cursor: "pointer",
              }}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Source filter */}
      {sortedSources.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          <button
            onClick={() => setSource(null)}
            style={{
              padding: "5px 12px", borderRadius: 6, border: "none", fontSize: 11, fontWeight: 600,
              background: source === null ? "#6366f1" : "#1a1a1a", color: source === null ? "#fff" : "#888",
              cursor: "pointer",
            }}
          >
            Todas ({Object.values(sourceBreakdown).reduce((a, b) => a + b, 0)})
          </button>
          {sortedSources.map(([src, count]) => (
            <button
              key={src}
              onClick={() => setSource(src)}
              style={{
                padding: "5px 12px", borderRadius: 6, border: "none", fontSize: 11, fontWeight: 600,
                background: source === src ? "#6366f1" : "#1a1a1a", color: source === src ? "#fff" : "#888",
                cursor: "pointer",
              }}
            >
              {src} ({count})
            </button>
          ))}
        </div>
      )}

      {/* Stats overview */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, marginBottom: 20 }}>
        <Card label="Visitas totales" value={stats.totalVisits} />
        <Card label="Desde FB Ads" value={stats.fbVisits} color="#3b82f6" suffix={`${stats.fbPctOfTotal}%`} />
        <Card label="Sesiones FB" value={stats.totalSessions} color="#6366f1" />
        <Card label="Rebote" value={stats.bounced} color="#ef4444" suffix={`${stats.bounceRate}%`} />
        <Card label="Convirtieron" value={stats.converted} color="#22c55e" suffix={`${stats.conversionRate}%`} />
        <Card label="Tiempo prom." value={fmtDuration(stats.avgDuration)} color="#eab308" />
        <Card label="Scroll prom." value={`${stats.avgScroll}%`} color="#14b8a6" />
        <Card label="Interacciones" value={stats.avgInteractions} color="#8b5cf6" suffix="prom" />
        <Card label="Mobile" value={stats.mobile} />
        <Card label="Desktop" value={stats.desktop} />
      </div>

      {/* Daily chart */}
      {sortedDaily.length > 0 && (
        <Section title="Visitas diarias">
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 80, padding: "0 4px" }}>
            {sortedDaily.map(([day, d]) => {
              const max = Math.max(...sortedDaily.map(([, x]) => x.visits), 1);
              const h = Math.max((d.visits / max) * 70, 2);
              return (
                <div key={day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <span style={{ fontSize: 9, color: "#666" }}>{d.visits}</span>
                  <div style={{ width: "100%", maxWidth: 28, display: "flex", flexDirection: "column", gap: 1 }}>
                    {d.converted > 0 && (
                      <div style={{ height: Math.max((d.converted / max) * 70, 2), background: "#22c55e", borderRadius: 3 }} />
                    )}
                    <div style={{ height: h - (d.converted > 0 ? Math.max((d.converted / max) * 70, 2) : 0), background: d.bounced === d.visits ? "#ef444480" : "#3b82f6", borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 8, color: "#555", transform: "rotate(-45deg)", whiteSpace: "nowrap" }}>{day.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        {/* Campaigns */}
        <Section title="Por campaña">
          {sortedCampaigns.length === 0 && <Empty />}
          {sortedCampaigns.map(([name, c]) => (
            <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #1a1a1a", fontSize: 12 }}>
              <span style={{ color: "#ccc", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
              <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                <span style={{ color: "#888" }}>{c.visits} vis</span>
                <span style={{ color: "#ef4444" }}>{c.visits > 0 ? Math.round((c.bounced / c.visits) * 100) : 0}% reb</span>
                <span style={{ color: "#22c55e" }}>{c.converted} conv</span>
                <span style={{ color: "#888" }}>{fmtDuration(c.avgDuration)}</span>
              </div>
            </div>
          ))}
        </Section>

        {/* Content/ad */}
        <Section title="Por anuncio (utm_content)">
          {sortedContent.length === 0 && <Empty />}
          {sortedContent.map(([name, c]) => (
            <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #1a1a1a", fontSize: 12 }}>
              <span style={{ color: "#ccc", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
              <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                <span style={{ color: "#888" }}>{c.visits}</span>
                <span style={{ color: "#ef4444" }}>{c.visits > 0 ? Math.round((c.bounced / c.visits) * 100) : 0}%</span>
                <span style={{ color: "#22c55e" }}>{c.converted}</span>
              </div>
            </div>
          ))}
        </Section>
      </div>

      {/* Landing pages */}
      {sortedLandings.length > 0 && (
        <Section title="Pagina de entrada">
          {sortedLandings.map(([page, count]) => (
            <div key={page} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12 }}>
              <span style={{ color: "#ccc" }}>{page}</span>
              <span style={{ color: "#888" }}>{count}</span>
            </div>
          ))}
        </Section>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        {/* Sections viewed */}
        <Section title="Secciones vistas">
          {sortedSections.length === 0 && <Empty />}
          {sortedSections.map(([name, count]) => (
            <div key={name} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12 }}>
              <span style={{ color: "#ccc" }}>{name}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: Math.min((count / (stats.totalSessions || 1)) * 120, 120), height: 8, background: "#14b8a680", borderRadius: 4 }} />
                <span style={{ color: "#888", minWidth: 30, textAlign: "right" }}>{count}</span>
              </div>
            </div>
          ))}
        </Section>

        {/* Clicks */}
        <Section title="Elementos con click">
          {sortedClicks.length === 0 && <Empty />}
          {sortedClicks.map(([label, count]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12 }}>
              <span style={{ color: "#ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{label}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <div style={{ width: Math.min((count / (sortedClicks[0]?.[1] || 1)) * 80, 80), height: 8, background: "#8b5cf680", borderRadius: 4 }} />
                <span style={{ color: "#888", minWidth: 24, textAlign: "right" }}>{count}</span>
              </div>
            </div>
          ))}
        </Section>
      </div>

      {/* Sessions detail */}
      <Section title={`Sesiones individuales (${sessions.length})`}>
        {sessions.length === 0 && <Empty />}
        {sessions.map((s) => {
          const isExpanded = expandedSession === s.id;
          const date = new Date(s.createdAt);
          const dateStr = `${date.getDate()}/${date.getMonth() + 1} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;

          return (
            <div key={s.id} style={{ borderBottom: "1px solid #1a1a1a", padding: "8px 0" }}>
              <div
                onClick={() => setExpandedSession(isExpanded ? null : s.id)}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", gap: 8 }}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center", flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 12, color: "#888" }}>{dateStr}</span>
                  <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: s.bounced ? "#ef44441a" : s.converted ? "#22c55e1a" : "#3b82f61a", color: s.bounced ? "#ef4444" : s.converted ? "#22c55e" : "#3b82f6", fontWeight: 600 }}>
                    {s.bounced ? "Rebote" : s.converted ? "Convertido" : "Exploro"}
                  </span>
                  {s.device && <span style={{ fontSize: 10, color: "#666" }}>{s.device}</span>}
                  {s.utmCampaign && <span style={{ fontSize: 10, color: "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.utmCampaign}</span>}
                  {!source && s.utmSource && <span style={{ fontSize: 10, color: "#6366f1" }}>{s.utmSource}</span>}
                </div>
                <div style={{ display: "flex", gap: 12, flexShrink: 0, fontSize: 11, color: "#888" }}>
                  <span>{fmtDuration(s.duration)}</span>
                  <span>{s.maxScroll}% scroll</span>
                  <span>{s.interactions} int</span>
                  <span style={{ color: "#555" }}>{isExpanded ? "▲" : "▼"}</span>
                </div>
              </div>

              {isExpanded && (
                <div style={{ marginTop: 8, padding: "10px 12px", background: "#111", borderRadius: 8, border: "1px solid #1a1a1a" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", fontSize: 11, marginBottom: 8 }}>
                    <span style={{ color: "#888" }}>Secciones: <span style={{ color: "#14b8a6" }}>{s.sectionsViewed.join(", ") || "ninguna"}</span></span>
                    {s.leadId && <span style={{ color: "#888" }}>Lead: <span style={{ color: "#22c55e" }}>{s.leadId}</span></span>}
                    {s.utmContent && <span style={{ color: "#888" }}>Anuncio: <span style={{ color: "#ccc" }}>{s.utmContent}</span></span>}
                  </div>
                  <div style={{ fontSize: 10, color: "#666", fontFamily: "monospace", maxHeight: 200, overflow: "auto" }}>
                    {(s.events as any[]).map((ev, i) => (
                      <div key={i} style={{ padding: "2px 0", borderBottom: "1px solid #1a1a1a" }}>
                        <span style={{ color: "#555" }}>{typeof ev.ts === "number" ? `+${Math.round(ev.ts / 1000)}s` : ""}</span>{" "}
                        <span style={{
                          color: ev.type === "click" ? "#8b5cf6" :
                            ev.type === "scroll_milestone" ? "#14b8a6" :
                            ev.type === "section_view" ? "#22c55e" :
                            ev.type === "page_load" ? "#3b82f6" :
                            ev.type === "input_focus" ? "#eab308" :
                            "#888"
                        }}>
                          {ev.type}
                        </span>{" "}
                        <span style={{ color: "#555" }}>
                          {ev.data ? JSON.stringify(ev.data).slice(0, 80) : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </Section>
    </div>
  );
}

function Card({ label, value, color, suffix }: { label: string; value: number | string; color?: string; suffix?: string }) {
  return (
    <div style={{ background: "#1a1a1a", borderRadius: 12, padding: "14px 16px", border: "1px solid #2a2a2a" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: color || "#fff" }}>{value}</span>
        {suffix && <span style={{ fontSize: 12, color: "#666" }}>{suffix}</span>}
      </div>
      <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#111", borderRadius: 14, padding: "14px 16px", border: "1px solid #1a1a1a", marginBottom: 12 }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: "#888", marginBottom: 10, textTransform: "uppercase", letterSpacing: ".04em" }}>{title}</h3>
      {children}
    </div>
  );
}

function Empty() {
  return <div style={{ fontSize: 12, color: "#555", padding: "8px 0" }}>Sin datos todavia.</div>;
}
