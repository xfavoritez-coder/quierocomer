"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

const F = "var(--font-display)";
const FB = "var(--font-body)";

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
}

export default function DemoAnalyticsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/agregarlocal/demo-analytics?slug=${slug}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0e0e0e", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <span style={{ fontSize: "2.5rem", display: "block", marginBottom: 16, animation: "pulse 1.5s ease-in-out infinite" }}>📊</span>
          <p style={{ color: "#F4A623", fontSize: "1rem", fontWeight: 600 }}>Generando vista previa...</p>
        </div>
      </div>
    );
  }

  if (!data || data.error) {
    return (
      <div style={{ minHeight: "100vh", background: "#0e0e0e", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "1rem" }}>No se encontró el local</p>
      </div>
    );
  }

  const { metrics, dishes, clientes, searches, popularByHour, funnel } = data;
  const topDish = dishes?.mostViewed?.[0];
  const peakHour = clientes?.timeOfDay ? [...clientes.timeOfDay].sort((a: any, b: any) => b.count - a.count)[0] : null;
  const maxTime = clientes?.timeOfDay ? Math.max(...clientes.timeOfDay.map((t: any) => t.count), 1) : 1;
  const topSearch = searches?.[0];
  const topDevice = clientes?.acquisition?.devices?.[0];
  const totalDevices = clientes?.acquisition?.devices?.reduce((s: number, d: any) => s + d.count, 0) || 0;
  const topDiet = clientes?.dietProfile?.diets?.[0];
  const topRestriction = clientes?.dietProfile?.restrictions?.[0];

  return (
    <div style={{ minHeight: "100vh", background: "#0e0e0e", color: "white", padding: "0 0 60px" }}>
      <style>{`
        :root {
          --adm-card: #1a1a1a;
          --adm-card-border: rgba(255,255,255,0.08);
          --adm-card-shadow: 0 2px 8px rgba(0,0,0,0.12);
          --adm-text: #e5e5e5;
          --adm-text2: rgba(255,255,255,0.55);
          --adm-text3: rgba(255,255,255,0.3);
          --adm-accent: #F4A623;
          --adm-hover: rgba(255,255,255,0.04);
          --font-display: system-ui, -apple-system, sans-serif;
          --font-body: system-ui, -apple-system, sans-serif;
        }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.5 } }
        @keyframes shimmer {
          0% { background-position: -200% 0 }
          100% { background-position: 200% 0 }
        }
        .demo-banner {
          background: linear-gradient(90deg, rgba(244,166,35,0.15) 0%, rgba(244,166,35,0.05) 50%, rgba(244,166,35,0.15) 100%);
          background-size: 200% 100%;
          animation: shimmer 3s ease-in-out infinite;
          border-bottom: 1px solid rgba(244,166,35,0.2);
          padding: 12px 20px;
          text-align: center;
        }
        .demo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .demo-cols-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (max-width: 640px) {
          .demo-grid { grid-template-columns: 1fr; }
          .demo-cols-2 { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* Demo banner */}
      <div className="demo-banner">
        <p style={{ fontFamily: F, fontSize: "0.82rem", color: "#F4A623", margin: 0, fontWeight: 700 }}>
          🎭 Vista previa — estos datos son simulados
        </p>
        <p style={{ fontFamily: F, fontSize: "0.68rem", color: "rgba(255,255,255,0.4)", margin: "4px 0 0" }}>
          Cuando tu carta esté activa, verás estadísticas reales de tus clientes
        </p>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{ fontFamily: F, fontSize: "1.4rem", fontWeight: 800, color: "white", margin: "0 0 4px" }}>
            📊 {data.restaurantName}
          </h1>
          <p style={{ fontFamily: F, fontSize: "0.82rem", color: "rgba(255,255,255,0.4)", margin: 0 }}>
            {data.totalCategories} categorías · {data.totalDishes} platos · Últimos 28 días (demo)
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Hero KPIs */}
          <div className="demo-grid">
            <HeroKpi icon="👥" value={metrics.totalVisitors} label="Visitantes únicos"
              sub={`${metrics.totalSessions} sesiones · ${metrics.avgVisitsPerGuest} prom.`}
              color="var(--adm-text)" gradient="linear-gradient(135deg, var(--adm-card) 0%, rgba(244,166,35,0.08) 100%)" />
            <HeroKpi icon="🔁" value={metrics.returningVisitors} label="Clientes que volvieron"
              sub={`${metrics.returningPct}% del total ya te conocía`}
              color="#a78bfa" gradient="linear-gradient(135deg, var(--adm-card) 0%, rgba(167,139,250,0.10) 100%)" />
            <HeroKpi icon="🎂" value={metrics.birthdaysSaved} label="Registraron cumpleaños"
              sub={`${metrics.birthdayPct}% de tus visitantes`}
              color="#7fbfdc" gradient="linear-gradient(135deg, var(--adm-card) 0%, rgba(127,191,220,0.10) 100%)" />
          </div>

          {/* Star dish + Golden hour */}
          <div className="demo-cols-2">
            {topDish && (
              <div style={{ background: "linear-gradient(135deg, var(--adm-card) 0%, rgba(244,166,35,0.06) 100%)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 18px", display: "flex", gap: 14, alignItems: "center" }}>
                {topDish.photo ? (
                  <img src={topDish.photo} alt={topDish.name} style={{ width: 70, height: 70, borderRadius: 12, objectFit: "cover", flexShrink: 0, boxShadow: "0 4px 12px rgba(0,0,0,0.12)" }} />
                ) : (
                  <div style={{ width: 70, height: 70, borderRadius: 12, background: "var(--adm-hover)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", flexShrink: 0 }}>🍽️</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: F, fontSize: "0.66rem", color: "#F4A623", margin: "0 0 4px", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>⭐ Plato estrella</p>
                  <p style={{ fontFamily: FB, fontSize: "0.95rem", color: "var(--adm-text)", margin: "0 0 4px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{topDish.name}</p>
                  <p style={{ fontFamily: F, fontSize: "0.74rem", color: "var(--adm-text2)", margin: 0 }}>
                    <strong style={{ color: "#F4A623" }}>{topDish.count} vistas</strong>
                  </p>
                </div>
              </div>
            )}
            {peakHour && (
              <div style={{ background: "linear-gradient(135deg, var(--adm-card) 0%, rgba(167,139,250,0.06) 100%)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 18px", display: "flex", gap: 14, alignItems: "center" }}>
                <div style={{ width: 70, height: 70, borderRadius: 12, background: "rgba(167,139,250,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.4rem", flexShrink: 0 }}>🕐</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: F, fontSize: "0.66rem", color: "#a78bfa", margin: "0 0 4px", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>Hora dorada</p>
                  <p style={{ fontFamily: FB, fontSize: "0.95rem", color: "var(--adm-text)", margin: "0 0 4px", fontWeight: 600 }}>{peakHour.label} <span style={{ fontFamily: F, fontSize: "0.74rem", color: "var(--adm-text3)", fontWeight: 400 }}>({peakHour.hint})</span></p>
                  <p style={{ fontFamily: F, fontSize: "0.74rem", color: "var(--adm-text2)", margin: 0 }}><strong style={{ color: "#a78bfa" }}>{peakHour.count} sesiones</strong> · cuándo más miran la carta</p>
                </div>
              </div>
            )}
          </div>

          {/* Time distribution */}
          {clientes?.timeOfDay && (
            <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 18px" }}>
              <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 14px", fontWeight: 600 }}>📊 Cuándo abren la carta</p>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 110 }}>
                {clientes.timeOfDay.map((t: any) => {
                  const isPeak = t.key === peakHour?.key;
                  return (
                    <div key={t.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <span style={{ fontFamily: F, fontSize: "0.7rem", color: isPeak ? "#a78bfa" : "var(--adm-text2)", fontWeight: 700 }}>{t.count}</span>
                      <div style={{ width: "100%", height: Math.max(4, (t.count / maxTime) * 80), background: t.count > 0 ? (isPeak ? "linear-gradient(180deg, #a78bfa 0%, #8b6fd9 100%)" : "var(--adm-accent)") : "var(--adm-card-border)", borderRadius: 4, transition: "height 0.4s ease" }} />
                      <span style={{ fontFamily: F, fontSize: "0.66rem", color: "var(--adm-text2)", fontWeight: 600 }}>{t.label}</span>
                      <span style={{ fontFamily: F, fontSize: "0.58rem", color: "var(--adm-text3)" }}>{t.hint}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Star by hour */}
          {popularByHour?.length > 0 && (
            <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 18px" }}>
              <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 4px", fontWeight: 600 }}>🌟 Estrella por horario</p>
              <p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", margin: "0 0 12px" }}>El plato más abierto en cada momento del día.</p>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${popularByHour.length}, minmax(0, 1fr))`, gap: 8 }}>
                {popularByHour.map((p: any) => (
                  <div key={p.key} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 8px", background: "var(--adm-hover)", borderRadius: 10, alignItems: "center", textAlign: "center" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                      <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", fontWeight: 700 }}>{p.label}</span>
                      <span style={{ fontFamily: F, fontSize: "0.6rem", color: "var(--adm-text3)" }}>{p.hint}</span>
                    </div>
                    {p.photo ? (
                      <img src={p.photo} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }} />
                    ) : (
                      <div style={{ width: 56, height: 56, borderRadius: 10, background: "var(--adm-card)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem" }}>🍽️</div>
                    )}
                    <p style={{ fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text)", margin: 0, fontWeight: 600, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{p.name}</p>
                    <span style={{ fontFamily: F, fontSize: "0.66rem", color: "var(--adm-accent)", fontWeight: 700 }}>{p.count} vistas</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top dishes + Who are they */}
          <div className="demo-cols-2">
            {dishes?.mostViewed?.length > 0 && (
              <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 18px" }}>
                <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 12px", fontWeight: 600 }}>🏆 Top 3 más vistos</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {dishes.mostViewed.slice(0, 3).map((d: any, i: number) => {
                    const medal = ["🥇", "🥈", "🥉"][i];
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>{medal}</span>
                        {d.photo ? (
                          <img src={d.photo} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--adm-hover)", flexShrink: 0 }} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text)", margin: 0, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</p>
                        </div>
                        <span style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-accent)", fontWeight: 700, flexShrink: 0 }}>{d.count}x</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Who are they */}
            <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 18px" }}>
              <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 12px", fontWeight: 600 }}>👤 Quiénes son</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {topDevice && totalDevices > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "0.95rem" }}>{topDevice.name === "mobile" ? "📱" : topDevice.name === "desktop" ? "💻" : "📟"}</span>
                    <span style={{ fontFamily: F, fontSize: "0.74rem", color: "var(--adm-text2)", flex: 1 }}>Mayoría usa <strong style={{ color: "var(--adm-text)" }}>{topDevice.name === "mobile" ? "celular" : topDevice.name === "desktop" ? "escritorio" : "tablet"}</strong></span>
                    <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-accent)", fontWeight: 600 }}>{Math.round((topDevice.count / totalDevices) * 100)}%</span>
                  </div>
                )}
                {topDiet && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "0.95rem" }}>🥗</span>
                    <span style={{ fontFamily: F, fontSize: "0.74rem", color: "var(--adm-text2)", flex: 1 }}>Dieta más común <strong style={{ color: "var(--adm-text)" }}>{topDiet.label}</strong></span>
                    <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-accent)", fontWeight: 600 }}>{topDiet.count}</span>
                  </div>
                )}
                {topRestriction && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "0.95rem" }}>⚠️</span>
                    <span style={{ fontFamily: F, fontSize: "0.74rem", color: "var(--adm-text2)", flex: 1 }}>Restricción top <strong style={{ color: "var(--adm-text)" }}>{topRestriction.label}</strong></span>
                    <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-accent)", fontWeight: 600 }}>{topRestriction.count}</span>
                  </div>
                )}
                {clientes?.languages?.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "0.95rem" }}>🌐</span>
                    <span style={{ fontFamily: F, fontSize: "0.74rem", color: "var(--adm-text2)", flex: 1 }}>Idiomas <strong style={{ color: "var(--adm-text)" }}>{clientes.languages.slice(0, 3).map((l: any) => l.code.toUpperCase()).join(" · ")}</strong></span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Top search */}
          {topSearch && (
            <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "14px 18px" }}>
              <p style={{ fontFamily: F, fontSize: "0.66rem", color: "var(--adm-text3)", margin: "0 0 4px", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>🔍 Lo más buscado</p>
              <p style={{ fontFamily: FB, fontSize: "1.1rem", color: "var(--adm-text)", margin: "0 0 4px", fontWeight: 600 }}>&ldquo;{topSearch.query}&rdquo;</p>
              <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", margin: 0 }}>Buscado <strong style={{ color: "var(--adm-accent)" }}>{topSearch.count} {topSearch.count === 1 ? "vez" : "veces"}</strong> por {topSearch.uniqueVisitors} {topSearch.uniqueVisitors === 1 ? "persona" : "personas"}</p>
            </div>
          )}

          {/* Funnel */}
          <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 18px" }}>
            <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 14px", fontWeight: 600 }}>🔄 Embudo de conversión</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "Visitantes", value: funnel.totalGhosts, pct: 100, color: "var(--adm-accent)" },
                { label: "Volvieron", value: funnel.returnedGhosts, pct: funnel.returnedPct, color: "#a78bfa" },
                { label: "Se registraron", value: funnel.convertedUsers, pct: funnel.convertedPct, color: "#4ade80" },
                { label: "Activados", value: funnel.activatedUsers, pct: funnel.activatedPct, color: "#7fbfdc" },
              ].map((step, i) => (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontFamily: F, fontSize: "0.74rem", color: "var(--adm-text2)" }}>{step.label}</span>
                    <span style={{ fontFamily: F, fontSize: "0.74rem", color: step.color, fontWeight: 700 }}>{step.value} ({step.pct}%)</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "var(--adm-hover)", overflow: "hidden" }}>
                    <div style={{ width: `${step.pct}%`, height: "100%", background: step.color, borderRadius: 3, transition: "width 0.6s ease" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Genio impact */}
          <div style={{ background: "linear-gradient(135deg, var(--adm-card) 0%, rgba(244,166,35,0.06) 100%)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 18px" }}>
            <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 4px", fontWeight: 600 }}>🧞 Impacto del Genio</p>
            <p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", margin: "0 0 14px" }}>Comparación entre visitantes que usaron el Genio vs. los que no.</p>
            <div className="demo-cols-2" style={{ gap: 8 }}>
              {[
                { label: "Platos vistos", with: +(metrics.avgDishesViewed * 1.35).toFixed(1), without: +metrics.avgDishesViewed.toFixed(1) },
                { label: "Duración sesión", with: formatDuration(metrics.avgDurationMs * 1.4), without: formatDuration(metrics.avgDurationMs) },
                { label: "Tasa de retorno", with: `${Math.min(metrics.returningPct + 18, 85)}%`, without: `${metrics.returningPct}%` },
                { label: "Engagement", with: `${Math.min(metrics.engagementPct + 22, 95)}%`, without: `${metrics.engagementPct}%` },
              ].map((row, i) => (
                <div key={i} style={{ background: "var(--adm-hover)", borderRadius: 10, padding: "10px 12px" }}>
                  <p style={{ fontFamily: F, fontSize: "0.66rem", color: "var(--adm-text3)", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{row.label}</p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div>
                      <span style={{ fontFamily: F, fontSize: "0.6rem", color: "var(--adm-text3)" }}>Sin </span>
                      <span style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text2)", fontWeight: 600 }}>{row.without}</span>
                    </div>
                    <div>
                      <span style={{ fontFamily: F, fontSize: "0.6rem", color: "#4ade80" }}>Con </span>
                      <span style={{ fontFamily: F, fontSize: "0.82rem", color: "#4ade80", fontWeight: 700 }}>{row.with}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div style={{ textAlign: "center", padding: "24px 0 0" }}>
            <div style={{ background: "linear-gradient(135deg, rgba(244,166,35,0.1) 0%, rgba(244,166,35,0.02) 100%)", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 16, padding: "24px 20px" }}>
              <p style={{ fontFamily: F, fontSize: "1rem", color: "#F4A623", margin: "0 0 6px", fontWeight: 700 }}>
                Cuando tu carta esté activa, verás datos reales aquí
              </p>
              <p style={{ fontFamily: F, fontSize: "0.78rem", color: "rgba(255,255,255,0.4)", margin: "0 0 16px" }}>
                Cada escaneo del QR alimenta tus estadísticas en tiempo real
              </p>
              <a
                href={`/qr/${slug}`}
                target="_blank"
                style={{
                  display: "inline-block", padding: "12px 32px", borderRadius: 50,
                  background: "#F4A623", color: "#0e0e0e",
                  fontSize: "0.92rem", fontWeight: 700, textDecoration: "none",
                }}
              >
                Ver carta QR →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroKpi({ icon, value, label, sub, color, gradient }: { icon: string; value: string | number; label: string; sub?: string; color: string; gradient: string }) {
  return (
    <div style={{ background: gradient, border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "18px 20px", position: "relative", overflow: "hidden" }}>
      <div style={{ fontSize: "1.4rem", marginBottom: 6, opacity: 0.9 }}>{icon}</div>
      <p style={{ fontFamily: F, fontSize: "2rem", color, margin: "0 0 2px", fontWeight: 700, lineHeight: 1 }}>{value}</p>
      <p style={{ fontFamily: F, fontSize: "0.74rem", color: "var(--adm-text2)", margin: "6px 0 0", fontWeight: 600 }}>{label}</p>
      {sub && <p style={{ fontFamily: F, fontSize: "0.66rem", color: "var(--adm-text3)", margin: "3px 0 0" }}>{sub}</p>}
    </div>
  );
}
