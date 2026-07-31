"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import Link from "next/link";
import SkeletonLoading from "@/components/admin/SkeletonLoading";
import { usePanelLang } from "@/lib/i18n/panel";

const F = "var(--font-display)";
const GOLD = "#F4A623";

function CompareRow({ label, without, withG, unit = "" }: { label: string; without: number; withG: number; unit?: string }) {
  const diff = without > 0 ? Math.round(((withG - without) / without) * 100) : withG > 0 ? 100 : 0;
  const diffColor = diff > 0 ? "#4ade80" : diff < 0 ? "#ff6b6b" : "#888";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 80px", gap: 8, padding: "14px 16px", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, alignItems: "center" }}>
      <div style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text2)" }}>{label}</div>
      <div style={{ fontFamily: F, fontSize: "1rem", color: "var(--adm-text2)", fontWeight: 600, textAlign: "center" }}>{without}{unit}</div>
      <div style={{ fontFamily: F, fontSize: "1rem", color: GOLD, fontWeight: 700, textAlign: "center" }}>{withG}{unit}</div>
      <div style={{ fontFamily: F, fontSize: "0.85rem", color: diffColor, fontWeight: 700, textAlign: "right" }}>{diff > 0 ? "+" : ""}{diff}%</div>
    </div>
  );
}

export default function GenioImpactPage() {
  const { t } = usePanelLang();
  const DIET_LABELS: Record<string, string> = { VEGAN: t("diet_vegan") || "Vegano", VEGETARIAN: t("diet_vegetarian") || "Vegetariano", OMNIVORE: t("diet_omnivore") || "Carnívoro", vegan: t("diet_vegan") || "Vegano", vegetarian: t("diet_vegetarian") || "Vegetariano", omnivore: t("diet_omnivore") || "Carnívoro" };
  const pathname = usePathname();
  const { restaurants } = useAdminSession();
  const [restaurantId, setRestaurantId] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ type: "genio" });
    if (restaurantId) params.set("restaurantId", restaurantId);
    fetch(`/api/admin/analytics?${params}`).then((r) => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [restaurantId]);

  const fmt = (ms: number) => { const s = Math.floor(ms / 1000); return s >= 60 ? `${Math.floor(s / 60)}m${s % 60}s` : `${s}s`; };

  const funnel = data?.funnel;
  const diets = data?.dietDistribution as { type: string; count: number }[] | undefined;
  const restrictions = data?.restrictionsList as { name: string; count: number }[] | undefined;

  return (
    <div style={{ maxWidth: 700 }}>
      <div className="adm-flex-wrap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, gap: 10 }}>
        <div>
          <Link href={pathname.startsWith("/panel") ? "/panel/analytics" : "/admin/analytics"} style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", textDecoration: "none" }}>{t("analytics_back")}</Link>
          <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: GOLD, margin: "8px 0 0" }}>{t("genio_title")}</h1>
        </div>
        <select value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)} style={{ padding: "8px 12px", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text)", fontFamily: F, fontSize: "0.82rem", outline: "none" }}>
          <option value="" style={{ background: "var(--adm-select-bg)" }}>{t("genio_all")}</option>
          {restaurants.map((r) => <option key={r.id} value={r.id} style={{ background: "var(--adm-select-bg)" }}>{r.name}</option>)}
        </select>
      </div>

      {loading ? (
        <SkeletonLoading type="table" />
      ) : data ? (
        <>
          {/* ═══ Funnel ═══ */}
          {funnel && funnel.starts > 0 && (
            <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "20px 22px", marginBottom: 20 }}>
              <h3 style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 16px" }}>{t("genio_funnel_title")}</h3>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", marginBottom: 16 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: F, fontSize: "1.8rem", fontWeight: 700, color: GOLD }}>{funnel.starts}</div>
                  <div style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", marginTop: 2 }}>{t("genio_opened")}</div>
                </div>
                <span style={{ color: "var(--adm-text3)", fontSize: "1.2rem" }}>→</span>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: F, fontSize: "1.8rem", fontWeight: 700, color: "#3db89e" }}>{funnel.dietMarked}</div>
                  <div style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", marginTop: 2 }}>{t("genio_marked_diet")}</div>
                </div>
                <span style={{ color: "var(--adm-text3)", fontSize: "1.2rem" }}>→</span>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: F, fontSize: "1.8rem", fontWeight: 700, color: "#7fbfdc" }}>{funnel.completed}</div>
                  <div style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", marginTop: 2 }}>{t("genio_saved")}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1, background: "rgba(244,166,35,0.06)", borderRadius: 10, padding: "10px 14px", textAlign: "center" }}>
                  <div style={{ fontFamily: F, fontSize: "1.3rem", fontWeight: 700, color: GOLD }}>{funnel.completionRate}%</div>
                  <div style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)" }}>{t("genio_completion_rate")}</div>
                </div>
                <div style={{ flex: 1, background: "rgba(61,184,158,0.06)", borderRadius: 10, padding: "10px 14px", textAlign: "center" }}>
                  <div style={{ fontFamily: F, fontSize: "1.3rem", fontWeight: 700, color: "#3db89e" }}>{funnel.dietRate}%</div>
                  <div style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)" }}>{t("genio_marked_diet_label")}</div>
                </div>
                <div style={{ flex: 1, background: "rgba(127,191,220,0.06)", borderRadius: 10, padding: "10px 14px", textAlign: "center" }}>
                  <div style={{ fontFamily: F, fontSize: "1.3rem", fontWeight: 700, color: "#7fbfdc" }}>{funnel.starts - funnel.completed}</div>
                  <div style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)" }}>{t("genio_abandoned")}</div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ Diet + Restrictions ═══ */}
          {((diets && diets.length > 0) || (restrictions && restrictions.length > 0)) && (
            <div className="adm-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              {diets && diets.length > 0 && (
                <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "20px 22px" }}>
                  <h3 style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 12px" }}>{t("genio_diets_title")}</h3>
                  {(() => {
                    const COLORS = [GOLD, "#3db89e", "#a78bfa"];
                    const total = diets.reduce((a, d) => a + d.count, 0);
                    return (
                      <>
                        <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", height: 8, marginBottom: 12 }}>
                          {diets.map((d, i) => (
                            <div key={d.type} style={{ width: `${(d.count / total) * 100}%`, background: COLORS[i % COLORS.length], height: "100%" }} />
                          ))}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {diets.map((d, i) => (
                            <span key={d.type} style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)" }}>
                              <span style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                              {DIET_LABELS[d.type] || d.type} ({d.count}) {Math.round((d.count / total) * 100)}%
                            </span>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
              {restrictions && restrictions.length > 0 && (
                <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "20px 22px" }}>
                  <h3 style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 12px" }}>{t("genio_restrictions_title")}</h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {restrictions.map(r => (
                      <span key={r.name} style={{
                        fontFamily: F, fontSize: "0.78rem", padding: "5px 12px", borderRadius: 20,
                        background: "rgba(232,85,48,0.08)", border: "1px solid rgba(232,85,48,0.15)",
                        color: "#e85530", fontWeight: 600,
                      }}>
                        {r.name} <strong>{r.count}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ Impact comparison ═══ */}
          <h3 style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 14px" }}>{t("genio_compare_title")}</h3>

          {/* Header row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 80px", gap: 8, padding: "10px 16px", marginBottom: 8 }}>
            <div style={{ fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{t("genio_metric_col")}</div>
            <div style={{ fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>{t("genio_without_col")} ({data.withoutGenio.sessionCount})</div>
            <div style={{ fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>{t("genio_with_col")} ({data.withGenio.sessionCount})</div>
            <div style={{ fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "right" }}>{t("genio_delta_col")}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <CompareRow label={t("genio_dishes_seen")} without={data.withoutGenio.avgDishesViewed} withG={data.withGenio.avgDishesViewed} />
            <CompareRow label={t("genio_session_duration")} without={parseFloat(fmt(data.withoutGenio.avgDurationMs))} withG={parseFloat(fmt(data.withGenio.avgDurationMs))} />
            <CompareRow label={t("genio_conversion")} without={data.withoutGenio.conversionRate} withG={data.withGenio.conversionRate} unit="%" />
            <CompareRow label={t("genio_return_rate")} without={data.withoutGenio.returnRate} withG={data.withGenio.returnRate} unit="%" />
          </div>
        </>
      ) : null}
    </div>
  );
}
