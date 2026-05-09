"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import { canAccess } from "@/lib/plans";
import PlanGate from "@/components/admin/PlanGate";
import SkeletonLoading from "@/components/admin/SkeletonLoading";

const F = "var(--font-display)";
const FB = "var(--font-body)";

/** Inline info icon — click/tap toggles a popover with the explanation.
 * Works on both desktop and mobile (HTML `title` only triggers on mouse
 * hover so it was invisible on touch devices). */
function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    // Use click (not mousedown) so the close happens AFTER any click on a
    // sibling element propagates to its onClick handler. mousedown closing
    // first was suspected of intermittently swallowing date-preset / tab
    // clicks for users who left an info tooltip open before navigating.
    const handler = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", handler);
    document.addEventListener("touchend", handler);
    return () => {
      document.removeEventListener("click", handler);
      document.removeEventListener("touchend", handler);
    };
  }, [open]);

  return (
    <span ref={wrapRef} style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <span
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        role="button"
        tabIndex={0}
        aria-label="Mostrar explicación"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 13,
          height: 13,
          borderRadius: "50%",
          background: open ? "var(--adm-accent)" : "var(--adm-text3)",
          color: open ? "#fff" : "var(--adm-card)",
          fontSize: "0.55rem",
          fontWeight: 700,
          fontFamily: "var(--font-display)",
          cursor: "pointer",
          flexShrink: 0,
          userSelect: "none",
          transition: "background 0.15s",
        }}
      >
        i
      </span>
      {open && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            background: "var(--adm-card)",
            border: "1px solid var(--adm-card-border)",
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: "0.74rem",
            lineHeight: 1.45,
            color: "var(--adm-text)",
            fontFamily: "var(--font-body)",
            fontWeight: 400,
            letterSpacing: 0,
            textTransform: "none",
            width: 280,
            maxWidth: "90vw",
            zIndex: 100,
            boxShadow: "0 6px 24px rgba(0,0,0,0.18)",
            whiteSpace: "normal",
          }}
        >
          {text}
        </div>
      )}
    </span>
  );
}

function Card({ label, value, sub, color = "var(--adm-accent)" }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "18px 20px", boxShadow: "var(--adm-card-shadow, none)" }}>
      <p style={{ fontFamily: F, fontSize: "1.8rem", color, margin: "0 0 4px", fontWeight: 700 }}>{value}</p>
      <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: 0 }}>{label}</p>
      {sub && <p style={{ fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text3)", margin: "4px 0 0" }}>{sub}</p>}
    </div>
  );
}

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
}

type Tab = "resumen" | "platos" | "clientes" | "garzon" | "busquedas" | "sesiones";

/* ═══ TAB: Resumen ═══ */
function HeroKpi({ icon, value, label, sub, color, gradient }: { icon: string; value: string | number; label: string; sub?: string; color: string; gradient: string }) {
  return (
    <div style={{ background: gradient, border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "16px 18px", boxShadow: "var(--adm-card-shadow, none)", position: "relative", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: "1.3rem", opacity: 0.9 }}>{icon}</span>
        <span style={{ fontFamily: F, fontSize: "1.8rem", color, fontWeight: 700, lineHeight: 1 }}>{value}</span>
      </div>
      <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", margin: "4px 0 0", fontWeight: 600 }}>{label}</p>
      {sub && <p style={{ fontFamily: F, fontSize: "0.64rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>{sub}</p>}
    </div>
  );
}

function TabResumen({ rid, from, to }: { rid: string; from: string; to: string }) {
  const { activePlan } = usePanelSession();
  const hasToteatPlan = canAccess(activePlan, "toteat_integration");
  const [metrics, setMetrics] = useState<any>(null);
  const [clientes, setClientes] = useState<any>(null);
  const [dishes, setDishes] = useState<any>(null);
  const [searches, setSearches] = useState<any[]>([]);
  const [popularByHour, setPopularByHour] = useState<any[]>([]);
  const [cross, setCross] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const make = (type: string) => {
      const p = new URLSearchParams({ type, from, to });
      if (rid) p.set("restaurantId", rid);
      return fetch(`/api/admin/analytics?${p}`).then(r => r.json()).catch(() => null);
    };
    // carta-vs-caja gated por plan PREMIUM en el endpoint — pedimos solo si aplica
    const crossPromise = hasToteatPlan && rid
      ? (() => {
          const p = new URLSearchParams({ from, to, restaurantId: rid });
          return fetch(`/api/admin/analytics/carta-vs-caja?${p}`).then(r => r.json()).catch(() => null);
        })()
      : Promise.resolve(null);
    Promise.all([make("metrics"), make("clientes"), make("dishes"), make("searches"), make("popular-by-hour"), crossPromise])
      .then(([m, c, d, s, ph, cv]) => {
        setMetrics(m); setClientes(c); setDishes(d);
        setSearches(Array.isArray(s) ? s.map((x: any) => ({ ...x, count: x.timesSearched || x.count || 0 })) : []);
        setPopularByHour(Array.isArray(ph) ? ph : []);
        setCross(cv && !cv.error ? cv : null);
      })
      .finally(() => setLoading(false));
  }, [rid, from, to, hasToteatPlan]);

  if (loading) return <SkeletonLoading type="analytics" />;
  if (!metrics) return <p style={{ color: "var(--adm-text2)", fontFamily: F, textAlign: "center", padding: 40 }}>Sin datos</p>;

  const topDish = dishes?.mostViewed?.[0];
  const topCategory = dishes?.topCategories?.[0];
  const topSearch = searches?.[0];
  const peakHour = clientes?.timeOfDay ? [...clientes.timeOfDay].sort((a: any, b: any) => b.count - a.count)[0] : null;
  const maxTime = clientes?.timeOfDay ? Math.max(...clientes.timeOfDay.map((t: any) => t.count), 1) : 1;
  const topDiet = clientes?.dietProfile?.diets?.[0];
  const topRestriction = clientes?.dietProfile?.restrictions?.[0];
  const topDevice = clientes?.acquisition?.devices?.[0];
  const totalDevices = clientes?.acquisition?.devices?.reduce((s: number, d: any) => s + d.count, 0) || 0;

  // Toteat: el local tiene Toteat conectado solo si hay platos mapeados.
  const hasToteat = !!(cross?.summary?.mappedDishes && cross.summary.mappedDishes > 0);
  // Conversion a venta: ventas / vistas de detalle (sobre platos mapeados).
  const conversionPct = hasToteat && cross.summary.totalOpens > 0
    ? Math.round((cross.summary.totalSales / cross.summary.totalOpens) * 100)
    : 0;
  // Mapa dishId → ventas en el periodo (para enriquecer top platos / estrella por horario)
  const salesByDish = new Map<string, number>();
  if (hasToteat && Array.isArray(cross?.rows)) {
    for (const r of cross.rows) {
      if (r.dishId && (r.sales || 0) > 0) salesByDish.set(r.dishId, r.sales);
    }
  }
  // Mapa nombre → ventas (mostViewed solo trae name, no dishId)
  const salesByName = new Map<string, number>();
  if (hasToteat && Array.isArray(cross?.rows)) {
    for (const r of cross.rows) {
      if (r.name && (r.sales || 0) > 0) salesByName.set(r.name, r.sales);
    }
  }
  const champions = hasToteat ? (cross?.insights?.estrellas || []).slice(0, 5) : [];
  const ghosts = hasToteat ? (cross?.insights?.fantasmas || []).slice(0, 5) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* ═══ Hero KPIs (2×2) ═══ */}
      <div className="adm-kpi-grid">
        <HeroKpi icon="👥" value={metrics.totalVisitors} label="Visitantes únicos" sub={`${metrics.totalSessions} sesiones · ${metrics.avgVisitsPerGuest} prom. por persona`} color="var(--adm-text)" gradient="linear-gradient(135deg, var(--adm-card) 0%, rgba(244,166,35,0.08) 100%)" />
        <HeroKpi icon="🔁" value={metrics.returningVisitors} label="Clientes que volvieron" sub={metrics.totalVisitors > 0 ? `${metrics.returningPct}% del total ya te conocía` : ""} color="#a78bfa" gradient="linear-gradient(135deg, var(--adm-card) 0%, rgba(167,139,250,0.10) 100%)" />
        <HeroKpi icon="🎂" value={metrics.birthdaysSaved || 0} label="Registraron cumpleaños" sub={metrics.totalVisitors > 0 ? `${metrics.birthdayPct || 0}% de tus visitantes` : ""} color="#7fbfdc" gradient="linear-gradient(135deg, var(--adm-card) 0%, rgba(127,191,220,0.10) 100%)" />
        <HeroKpi icon="🧞" value={metrics.genioUsers || 0} label="Abrieron el Genio" sub={metrics.totalVisitors > 0 ? `${metrics.genioUsedPct || 0}% de tus visitantes` : ""} color="#4ade80" gradient="linear-gradient(135deg, var(--adm-card) 0%, rgba(74,222,128,0.10) 100%)" />
      </div>

      {/* ═══ Plato estrella + hora dorada ═══ */}
      <div className="adm-cols-2">
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
                <strong style={{ color: "#F4A623" }}>{topDish.count} {typeof topDish.count === "number" ? "vistas" : "veces"}</strong>
                {hasToteat && salesByName.has(topDish.name) && <> · <strong style={{ color: "#16a34a" }}>{salesByName.get(topDish.name)} ventas</strong></>}
              </p>
            </div>
          </div>
        )}
        {peakHour && peakHour.count > 0 && (
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

      {/* ═══ Distribución horaria ═══ */}
      {clientes?.timeOfDay && clientes.totalSessions > 0 && (() => {
        const isSingleDay = from === to;
        const nowH = isSingleDay ? new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" })).getHours() : 24;
        const slotStartH: Record<string, number> = { MORNING: 6, LUNCH: 11, AFTERNOON: 15, DINNER: 19, LATE: 23 };
        const filteredTod = isSingleDay ? clientes.timeOfDay.filter((t: any) => (slotStartH[t.key] ?? 0) <= nowH) : clientes.timeOfDay;
        const filteredMax = Math.max(...filteredTod.map((t: any) => t.count), 1);
        if (filteredTod.length === 0) return null;
        return (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 18px", boxShadow: "var(--adm-card-shadow, none)" }}>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 14px", fontWeight: 600 }}>📊 Cuándo abren la carta</p>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
            {filteredTod.map((t: any) => {
              const filteredPeak = [...filteredTod].sort((a: any, b: any) => b.count - a.count)[0];
              const isPeak = t.key === filteredPeak?.key;
              const barH = Math.max(4, (t.count / filteredMax) * 80);
              return (
                <div key={t.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: "100%", height: barH, background: t.count > 0 ? (isPeak ? "linear-gradient(180deg, #a78bfa 0%, #8b6fd9 100%)" : "var(--adm-accent)") : "var(--adm-card-border)", borderRadius: 4, transition: "height 0.4s ease", display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 4, minHeight: 22 }}>
                    <span style={{ fontFamily: F, fontSize: "0.68rem", color: isPeak ? "#fff" : "rgba(255,255,255,0.9)", fontWeight: 700 }}>{t.count}</span>
                  </div>
                  <span style={{ fontFamily: F, fontSize: "0.66rem", color: isPeak ? "#c4b5fd" : "var(--adm-text2)", fontWeight: 600 }}>{t.label}</span>
                  <span style={{ fontFamily: F, fontSize: "0.58rem", color: "var(--adm-text3)" }}>{t.hint}</span>
                </div>
              );
            })}
          </div>
        </div>
        );
      })()}

      {/* ═══ Estrellas por horario — qué plato gana en cada momento del día ═══ */}
      {(() => {
        // If viewing a single day (from === to), filter out future time slots
        const isSingleDay = from === to;
        const nowChileHour = isSingleDay ? new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" })).getHours() : 24;
        const slotStart: Record<string, number> = { MORNING: 6, LUNCH: 11, AFTERNOON: 15, DINNER: 19, LATE: 23 };
        const filteredHours = isSingleDay ? popularByHour.filter((p: any) => (slotStart[p.key] ?? 0) <= nowChileHour) : popularByHour;
        if (filteredHours.length === 0) return null;
        return (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 18px", boxShadow: "var(--adm-card-shadow, none)" }}>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 4px", fontWeight: 600 }}>🌟 Estrella por horario</p>
          <p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", margin: "0 0 12px" }}>El plato más abierto en cada momento del día.</p>
          <div className="adm-hour-grid" style={{ gridTemplateColumns: `repeat(${filteredHours.length}, minmax(0, 1fr))` }}>
            {filteredHours.map((p: any) => (
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
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                  <span style={{ fontFamily: F, fontSize: "0.66rem", color: "var(--adm-accent)", fontWeight: 700 }}>{p.count} vistas</span>
                  {(p.sales || 0) > 0 && (
                    <span style={{ fontFamily: F, fontSize: "0.62rem", color: "#16a34a", fontWeight: 700 }}>{p.sales} ventas</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        );
      })()}

      {/* ═══ Top platos + Quiénes son ═══ */}
      <div className="adm-cols-2">
        {/* Top 3 platos vistos */}
        {dishes?.mostViewed && dishes.mostViewed.length > 0 && (
          <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 18px" }}>
            <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 12px", fontWeight: 600 }}>🏆 Top 3 más vistos</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {dishes.mostViewed.slice(0, 3).map((d: any, i: number) => {
                const medal = ["🥇", "🥈", "🥉"][i];
                const sales = hasToteat ? salesByName.get(d.name) || 0 : 0;
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
                      {hasToteat && sales > 0 && (
                        <p style={{ fontFamily: F, fontSize: "0.66rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>{d.count} vistas · <span style={{ color: "#16a34a", fontWeight: 700 }}>{sales} ventas</span></p>
                      )}
                    </div>
                    {!hasToteat && <span style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-accent)", fontWeight: 700, flexShrink: 0 }}>{d.count}x</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quiénes son */}
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
                <span style={{ fontFamily: F, fontSize: "0.74rem", color: "var(--adm-text2)", flex: 1 }}>Restricción top <strong style={{ color: "var(--adm-text)" }}>{topRestriction.label || topRestriction.name}</strong></span>
                <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-accent)", fontWeight: 600 }}>{topRestriction.count}</span>
              </div>
            )}
            {clientes?.languages && clientes.languages.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "0.95rem" }}>🌐</span>
                <span style={{ fontFamily: F, fontSize: "0.74rem", color: "var(--adm-text2)", flex: 1 }}>Idiomas <strong style={{ color: "var(--adm-text)" }}>{clientes.languages.slice(0, 3).map((l: any) => l.code.toUpperCase()).join(" · ")}</strong></span>
              </div>
            )}
            {!topDevice && !topDiet && !topRestriction && (!clientes?.languages || clientes.languages.length === 0) && (
              <p style={{ fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text3)", margin: 0 }}>Aún no hay suficientes datos demográficos</p>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Búsqueda top — Categoría favorita movida al HeroKpi 4 (mini) ═══ */}
      {topSearch && (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "14px 18px" }}>
          <p style={{ fontFamily: F, fontSize: "0.66rem", color: "var(--adm-text3)", margin: "0 0 4px", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>🔍 Lo más buscado</p>
          <p style={{ fontFamily: FB, fontSize: "1.1rem", color: "var(--adm-text)", margin: "0 0 4px", fontWeight: 600 }}>&ldquo;{topSearch.query}&rdquo;</p>
          <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", margin: 0 }}>Buscado <strong style={{ color: "var(--adm-accent)" }}>{topSearch.count} {topSearch.count === 1 ? "vez" : "veces"}</strong> por {topSearch.uniqueVisitors} {topSearch.uniqueVisitors === 1 ? "persona" : "personas"}</p>
        </div>
      )}

      {/* ═══ Bloques solo Toteat: Campeones + Fantasmas ═══ */}
      {hasToteat && (champions.length > 0 || ghosts.length > 0) && (
        <div className="adm-toteat-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* Campeones */}
          {champions.length > 0 && (
            <div style={{ background: "linear-gradient(135deg, var(--adm-card) 0%, rgba(22,163,74,0.06) 100%)", border: "1px solid rgba(22,163,74,0.18)", borderRadius: 14, padding: "16px 18px" }}>
              <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#16a34a", margin: "0 0 4px", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                <span>🌟 Platos campeones</span>
                <InfoTip text="Los platos que la gente abre Y compra. Estrellas del menú con mejor conversión." />
              </p>
              <p style={{ fontFamily: F, fontSize: "0.66rem", color: "var(--adm-text3)", margin: "0 0 12px" }}>Lo abren y lo piden.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {champions.map((c: any) => (
                  <div key={c.dishId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px dashed rgba(22,163,74,0.12)" }}>
                    {c.photo ? (
                      <img src={c.photo} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 32, height: 32, borderRadius: 6, background: "var(--adm-hover)", flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text)", margin: 0, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</p>
                      <p style={{ fontFamily: F, fontSize: "0.62rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>{c.opens} vistas · <span style={{ color: "#16a34a", fontWeight: 700 }}>{c.sales} ventas</span></p>
                    </div>
                    <span style={{ fontFamily: F, fontSize: "0.78rem", fontWeight: 700, color: "#16a34a", flexShrink: 0 }}>{c.conversionPct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Fantasmas */}
          {ghosts.length > 0 && (
            <div style={{ background: "linear-gradient(135deg, var(--adm-card) 0%, rgba(239,68,68,0.04) 100%)", border: "1px solid rgba(239,68,68,0.18)", borderRadius: 14, padding: "16px 18px" }}>
              <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#ef4444", margin: "0 0 4px", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                <span>👻 Platos fantasma</span>
                <InfoTip text="La gente los abre pero casi nadie los pide. Revisa precio, descripción, foto, o si vale la pena tenerlos." />
              </p>
              <p style={{ fontFamily: F, fontSize: "0.66rem", color: "var(--adm-text3)", margin: "0 0 12px" }}>Lo abren pero no lo compran.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {ghosts.map((g: any) => (
                  <div key={g.dishId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px dashed rgba(239,68,68,0.12)" }}>
                    {g.photo ? (
                      <img src={g.photo} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 32, height: 32, borderRadius: 6, background: "var(--adm-hover)", flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text)", margin: 0, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</p>
                      <p style={{ fontFamily: F, fontSize: "0.62rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>{g.opens} vistas · <span style={{ color: "#ef4444", fontWeight: 700 }}>{g.sales} ventas</span></p>
                    </div>
                    <span style={{ fontFamily: F, fontSize: "0.78rem", fontWeight: 700, color: "#ef4444", flexShrink: 0 }}>{g.conversionPct ?? 0}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══ TAB: Platos ═══ */
type CrossSortKey = "name" | "opens" | "avgDetailMs" | "sales" | "conversionPct";
type CrossSortDir = "asc" | "desc";

function SortIcon({ active, dir }: { active: boolean; dir: CrossSortDir }) {
  return (
    <span aria-hidden style={{ display: "inline-flex", flexDirection: "column", lineHeight: 0.7, fontSize: 9, opacity: active ? 1 : 0.4 }}>
      <span style={{ color: active && dir === "asc" ? "var(--adm-accent)" : "currentColor" }}>▲</span>
      <span style={{ color: active && dir === "desc" ? "var(--adm-accent)" : "currentColor" }}>▼</span>
    </span>
  );
}

function TabPlatos({ rid, from, to }: { rid: string; from: string; to: string }) {
  const { activePlan } = usePanelSession();
  const hasToteatAccess = canAccess(activePlan, "toteat_integration");
  const [data, setData] = useState<any>(null);
  const [cross, setCross] = useState<any>(null);
  const [badges, setBadges] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tableOpen, setTableOpen] = useState(true);
  const [showAllOrphans, setShowAllOrphans] = useState(false);
  const [sortKey, setSortKey] = useState<CrossSortKey>("sales");
  const [sortDir, setSortDir] = useState<CrossSortDir>("desc");

  const toggleSort = (key: CrossSortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "name" ? "asc" : "desc"); }
  };

  const sortedRows = (() => {
    if (!cross?.rows) return [];
    const rows = [...cross.rows];
    rows.sort((a: any, b: any) => {
      let av: any = a[sortKey];
      let bv: any = b[sortKey];
      // null / undefined go last
      if (av === null || av === undefined) av = sortDir === "desc" ? -Infinity : Infinity;
      if (bv === null || bv === undefined) bv = sortDir === "desc" ? -Infinity : Infinity;
      if (typeof av === "string" && typeof bv === "string") {
        const cmp = av.localeCompare(bv, "es");
        return sortDir === "asc" ? cmp : -cmp;
      }
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return rows;
  })();

  const [popularByHour, setPopularByHour] = useState<any[]>([]);
  const [menuHealth, setMenuHealth] = useState<any>(null);
  useEffect(() => {
    setLoading(true);
    const p1 = new URLSearchParams({ type: "dishes", from, to });
    const p2 = new URLSearchParams({ from, to });
    const p3 = new URLSearchParams({ type: "popular-by-hour", from, to });
    const p4 = new URLSearchParams({ type: "menu-health" });
    if (rid) { p1.set("restaurantId", rid); p2.set("restaurantId", rid); p3.set("restaurantId", rid); p4.set("restaurantId", rid); }
    // Solo PREMIUM ve la integración Toteat (carta vs caja, badges)
    const toteatRequests = hasToteatAccess
      ? [
          fetch(`/api/admin/analytics/carta-vs-caja?${p2}`).then(r => r.json()).catch(() => null),
          fetch(`/api/admin/analytics/badge-accuracy?${p2}`).then(r => r.json()).catch(() => null),
        ]
      : [Promise.resolve(null), Promise.resolve(null)];
    Promise.all([
      fetch(`/api/admin/analytics?${p1}`).then(r => r.json()),
      fetch(`/api/admin/analytics?${p3}`).then(r => r.json()).catch(() => []),
      fetch(`/api/admin/analytics?${p4}`).then(r => r.json()).catch(() => null),
      ...toteatRequests,
    ]).then(([d, ph, mh, c, b]) => {
      setData(d);
      setPopularByHour(Array.isArray(ph) ? ph : []);
      setMenuHealth(mh && !mh.error ? mh : null);
      if (c && !c.error) setCross(c);
      if (b && !b.error) setBadges(b);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [rid, from, to, hasToteatAccess]);

  if (loading) return <SkeletonLoading type="list" />;
  if (!data) return <p style={{ color: "var(--adm-text2)", fontFamily: F, textAlign: "center", padding: 40 }}>Sin datos</p>;

  const renderSection = (s: { title: string; items: any[]; icon: string; unit: string; tooltip?: string }) => (
    <div key={s.title} style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "14px 16px", boxShadow: "var(--adm-card-shadow, none)" }}>
      <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 12px", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
        <span>{s.icon} {s.title}</span>
        {s.tooltip && <InfoTip text={s.tooltip} />}
        {s.unit && <span style={{ fontWeight: 400, fontSize: "0.68rem", color: "var(--adm-text3)" }}>({s.unit})</span>}
      </p>
      {s.items.length === 0 ? (
        <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)", margin: 0 }}>Sin datos suficientes</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {s.items.slice(0, 10).map((d: any, i: number) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", width: 18, textAlign: "right", flexShrink: 0 }}>{i + 1}.</span>
              {d.photo && <img src={d.photo} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />}
              <span style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
              <span style={{ fontFamily: F, fontSize: "0.75rem", color: "var(--adm-accent)", fontWeight: 600, flexShrink: 0 }}>{d.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const mostViewed = {
    title: "Más vistos en la carta",
    items: data.mostViewed || [],
    icon: "👀",
    unit: "veces",
    tooltip: "Cuántas veces se abrió el plato. Si dice '25', el plato fue abierto 25 veces en el período seleccionado.",
  };
  const mostDetailed = {
    title: "Más tiempo viéndolos",
    items: data.mostDetailed || [],
    icon: "🔍",
    unit: "promedio",
    tooltip: "Cuántos segundos en promedio pasaron mirando la foto y descripción del plato (al hacer click sobre él). Más tiempo = más interés.",
  };
  const leastViewed = {
    title: "Platos abandonados",
    items: data.leastViewed || [],
    icon: "🌱",
    unit: "% de veces abierto",
    tooltip: "Platos que casi nadie está mirando. Si dice '3%', solo se abrió en el 3% de las veces que alguien entró a la carta.",
  };
  const topCategories = {
    title: "Categorías más exploradas",
    items: (data.topCategories || []).map((c: any) => ({
      name: c.name,
      count: `${c.pct}% · ${formatDuration(c.totalMs)}`,
    })),
    icon: "🗂️",
    unit: "% del tiempo en carta",
    tooltip: "Qué sección de la carta engancha más a los clientes. Si dice 'Sushi 35%', los clientes pasan el 35% del tiempo navegando esa sección.",
  };

  // Premium-only insights — gated tanto por plan como por "Toteat connected".
  // En planes inferiores nunca se muestran (ni se piden los datos al backend).
  const hasToteat = hasToteatAccess && !!(cross && cross.summary?.mappedDishes && cross.summary.mappedDishes > 0);
  const showBadgeAccuracy = hasToteat && badges?.hasData && (badges.popular?.distinctDishes > 0 || badges.recommended?.distinctDishes > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* 🎖️ Acierto de los badges — premium + sales in window */}
      {showBadgeAccuracy && <BadgeAccuracySection badges={badges} />}

      {/* 🌟 Estrella por horario — qué plato gana en cada momento del día */}
      {popularByHour.length > 0 && (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 18px", boxShadow: "var(--adm-card-shadow, none)" }}>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 4px", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <span>🌟 Estrella por horario</span>
            <InfoTip text="El plato más abierto en cada bucket horario del periodo. Útil para saber qué destacar en cada turno." />
          </p>
          <p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", margin: "0 0 12px" }}>El plato que más se abrió en cada momento del día.</p>
          <div className="adm-hour-grid" style={{ gridTemplateColumns: `repeat(${popularByHour.length}, minmax(0, 1fr))` }}>
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
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                  <span style={{ fontFamily: F, fontSize: "0.66rem", color: "var(--adm-accent)", fontWeight: 700 }}>{p.count} vistas</span>
                  {(p.sales || 0) > 0 && (
                    <span style={{ fontFamily: F, fontSize: "0.62rem", color: "#16a34a", fontWeight: 700 }}>{p.sales} ventas</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid 2x2 con los 4 bloques principales */}
      <div className="adm-cols-2">
        {renderSection(mostViewed)}
        {renderSection(leastViewed)}
        {renderSection(mostDetailed)}
        {renderSection(topCategories)}
      </div>

      {/* 🔀 Carta vs Caja — only shown when local has Toteat connected */}
      {hasToteat && (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 18px", boxShadow: "var(--adm-card-shadow, none)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: 0, fontWeight: 600 }}>🔀 Carta vs Caja</p>
            <span style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)" }}>
              {cross.summary.mappedDishes}/{cross.summary.totalDishes} mapeados · {cross.summary.totalOpens} aperturas · {cross.summary.totalSales} ventas · {cross.summary.orphanCount} fuera de carta
            </span>
          </div>

          {/* Insights principales — Fantasmas + Estrellas full-width cada uno */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}>
            {cross.insights.fantasmas.length > 0 && (
              <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "12px 14px" }}>
                <p style={{ fontFamily: F, fontSize: "0.74rem", fontWeight: 700, color: "#ef4444", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>👻 Platos fantasma</span>
                  <InfoTip text="Platos que la gente abre pero casi nadie pide. Ejemplo: 'Gran Flor: 0 ventas de 6 aperturas' = 6 clientes lo miraron, 0 lo compraron." />
                </p>
                <p style={{ fontFamily: FB, fontSize: "0.68rem", color: "var(--adm-text3)", margin: "0 0 8px" }}>Los abren pero no los compran.</p>
                {cross.insights.fantasmas.map((p: any) => (
                  <div key={p.dishId} style={{ display: "flex", flexDirection: "column", padding: "6px 0", borderBottom: "1px dashed rgba(239,68,68,0.15)", fontFamily: FB }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontSize: "0.78rem", color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                      <span style={{ fontSize: "0.78rem", color: "#ef4444", fontWeight: 600, flexShrink: 0, whiteSpace: "nowrap" }}>
                        {p.conversionPct ?? 0}% conv
                      </span>
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--adm-text3)", marginTop: 2 }}>
                      {p.sales} {p.sales === 1 ? "venta" : "ventas"} · {p.opens} {p.opens === 1 ? "apertura" : "aperturas"}
                      {p.avgDetailMs > 0 && ` · ${Math.round(p.avgDetailMs / 1000)}s viéndolo`}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {cross.insights.estrellas.length > 0 && (
              <div style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, padding: "12px 14px" }}>
                <p style={{ fontFamily: F, fontSize: "0.74rem", fontWeight: 700, color: "#16a34a", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>🎯 Estrellas</span>
                  <InfoTip text="Platos que la gente abre y termina pidiendo. Si la conversión es mayor a 100% es porque se vendieron más unidades de las que se vieron en la carta digital (los clientes los pidieron directo al mozo)." />
                </p>
                <p style={{ fontFamily: FB, fontSize: "0.68rem", color: "var(--adm-text3)", margin: "0 0 8px" }}>Los abren y los piden.</p>
                {cross.insights.estrellas.map((p: any) => (
                  <div key={p.dishId} style={{ display: "flex", flexDirection: "column", padding: "6px 0", borderBottom: "1px dashed rgba(34,197,94,0.15)", fontFamily: FB }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontSize: "0.78rem", color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                      <span style={{ fontSize: "0.78rem", color: "#16a34a", fontWeight: 600, flexShrink: 0, whiteSpace: "nowrap" }}>
                        {p.conversionPct}% conv
                      </span>
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--adm-text3)", marginTop: 2 }}>
                      {p.sales} {p.sales === 1 ? "venta" : "ventas"} · {p.opens} {p.opens === 1 ? "apertura" : "aperturas"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Vendidos fuera de la carta digital (orphans) — full width */}
          {cross.orphans.length > 0 && (
            <div style={{ background: "rgba(244,166,35,0.05)", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
              <p style={{ fontFamily: F, fontSize: "0.74rem", fontWeight: 700, color: "#F4A623", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 6 }}>
                <span>📦 Vendidos fuera de la carta digital ({cross.orphans.length})</span>
                <InfoTip text="Cosas que se vendieron en caja pero no están en tu carta digital. Suelen ser combos, salsas, extras o costos de delivery. El '×N' es cuántas unidades se vendieron." />
              </p>
              <p style={{ fontFamily: FB, fontSize: "0.68rem", color: "var(--adm-text3)", margin: "0 0 8px" }}>Productos vendidos en Toteat sin mapeo. Probable: combos, salsas, extras o sin mapear.</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(showAllOrphans ? cross.orphans : cross.orphans.slice(0, 10)).map((o: any) => (
                  <span key={o.toteatId} style={{ background: "var(--adm-input)", color: "var(--adm-text2)", fontSize: "0.7rem", padding: "3px 8px", borderRadius: 6, fontFamily: FB }}>
                    {o.name} <span style={{ color: "var(--adm-text3)", marginLeft: 4 }}>×{o.sales}</span>
                  </span>
                ))}
                {cross.orphans.length > 10 && (
                  <button
                    onClick={() => setShowAllOrphans(v => !v)}
                    style={{ background: "transparent", border: "1px dashed var(--adm-card-border)", color: "#F4A623", fontSize: "0.7rem", padding: "3px 10px", borderRadius: 6, fontFamily: FB, fontWeight: 600, cursor: "pointer" }}
                  >
                    {showAllOrphans ? "Ver menos" : `+${cross.orphans.length - 10} más`}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Sospechosos sin mapear — abajo, full-width compacto, solo si existen */}
          {cross.insights.sospechosos?.length > 0 && (
            <div style={{ background: "rgba(244,166,35,0.05)", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
              <p style={{ fontFamily: F, fontSize: "0.74rem", fontWeight: 700, color: "#F4A623", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 6 }}>
                <span>🟡 Sin mapear</span>
                <InfoTip text="Platos con interés real que no están conectados a tu sistema de caja. No sabemos si vendieron. Andá a Carta → Toteat y conéctalos." />
              </p>
              <p style={{ fontFamily: FB, fontSize: "0.68rem", color: "var(--adm-text3)", margin: "0 0 8px" }}>Tienen interés real pero no podemos cruzarlos contra ventas. Mapéalos para confirmar.</p>
              {cross.insights.sospechosos.map((p: any) => (
                <div key={p.dishId} style={{ display: "flex", flexDirection: "column", padding: "6px 0", borderBottom: "1px dashed rgba(244,166,35,0.15)", fontFamily: FB }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: "0.78rem", color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                    <span style={{ fontSize: "0.78rem", color: "#F4A623", fontWeight: 600, flexShrink: 0, whiteSpace: "nowrap" }}>
                      {p.opens} {p.opens === 1 ? "apertura" : "aperturas"}
                    </span>
                  </div>
                  {p.avgDetailMs > 0 && (
                    <div style={{ fontSize: "0.7rem", color: "var(--adm-text3)", marginTop: 2 }}>
                      {Math.round(p.avgDetailMs / 1000)}s viéndolo
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Full table — collapsible */}
          <button
            onClick={() => setTableOpen(!tableOpen)}
            style={{ width: "100%", padding: "8px 10px", background: "transparent", border: "1px dashed var(--adm-card-border)", borderRadius: 8, fontFamily: F, fontSize: "0.74rem", fontWeight: 600, color: "var(--adm-text2)", cursor: "pointer", textAlign: "left" }}
          >
            {tableOpen ? "▼" : "▶"} Tabla completa por plato ({cross.rows.length})
          </button>
          {tableOpen && (
            <div style={{ marginTop: 10, overflowX: "auto" }}>
              <table style={{ width: "100%", fontFamily: FB, fontSize: "0.74rem", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: "var(--adm-text3)", textAlign: "left", borderBottom: "1px solid var(--adm-card-border)" }}>
                    {([
                      { key: "name", label: "Plato", align: "left" as const, tooltip: undefined },
                      { key: "opens", label: "Aperturas", align: "right" as const, tooltip: "Cuántos clientes abrieron el plato para verlo" },
                      { key: "avgDetailMs", label: "T. viendo", align: "right" as const, tooltip: "Segundos promedio que pasaron mirando el plato" },
                      { key: "sales", label: "Ventas", align: "right" as const, tooltip: "Unidades vendidas en el período" },
                      { key: "conversionPct", label: "Conv.", align: "right" as const, tooltip: "Porcentaje de aperturas que terminaron en venta" },
                    ] as { key: CrossSortKey; label: string; align: "left" | "right"; tooltip?: string }[]).map((col) => {
                      const active = sortKey === col.key;
                      return (
                        <th
                          key={col.key}
                          onClick={() => toggleSort(col.key)}
                          style={{ padding: "8px 6px", fontWeight: 600, textAlign: col.align, cursor: "pointer", userSelect: "none", color: active ? "var(--adm-text)" : "var(--adm-text3)" }}
                          title={col.tooltip ? `${col.tooltip} · Click para ordenar` : `Ordenar por ${col.label}`}
                        >
                          {col.align === "right" ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              {col.label}
                              <SortIcon active={active} dir={sortDir} />
                            </span>
                          ) : (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <SortIcon active={active} dir={sortDir} />
                              {col.label}
                            </span>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((r: any) => {
                    const isFantasma = r.mapped && r.opens >= 3 && (r.sales === 0 || (r.conversionPct ?? 0) < 20);
                    const isStar = r.opens >= 3 && r.sales >= 2 && (r.conversionPct ?? 0) >= 50;
                    const flag = isFantasma ? "👻" : isStar ? "🎯" : "";
                    return (
                      <tr key={r.dishId} className="adm-table-row" style={{ borderBottom: "1px dashed var(--adm-card-border)" }}>
                        <td style={{ padding: "6px" }}>
                          {flag && <span style={{ marginRight: 4 }}>{flag}</span>}
                          {r.name}
                          {!r.mapped && <span style={{ color: "var(--adm-text3)", fontSize: "0.65rem", marginLeft: 6 }}>(sin mapear)</span>}
                        </td>
                        <td style={{ padding: "6px", textAlign: "right" }}>{r.opens}</td>
                        <td style={{ padding: "6px", textAlign: "right", color: r.avgDetailMs > 0 ? "var(--adm-text2)" : "var(--adm-text3)" }}>
                          {r.avgDetailMs > 0 ? `${Math.round(r.avgDetailMs / 1000)}s` : "—"}
                        </td>
                        <td style={{ padding: "6px", textAlign: "right", color: r.sales > 0 ? "var(--adm-accent)" : "var(--adm-text3)", fontWeight: 700 }}>{r.sales}</td>
                        <td style={{ padding: "6px", textAlign: "right", color: r.conversionPct !== null ? (r.conversionPct >= 50 ? "#16a34a" : r.conversionPct >= 20 ? "var(--adm-text2)" : "#ef4444") : "var(--adm-text3)" }}>
                          {r.conversionPct !== null ? `${r.conversionPct}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

/* ═══ Badge accuracy section ═══ */
function BadgeAccuracySection({ badges }: { badges: any }) {
  const renderCard = (
    title: string,
    subtitle: string,
    accent: string,
    bgRgb: string,
    data: any,
    tooltip: string,
  ) => {
    if (!data || data.distinctDishes === 0) return null;
    return (
      <div style={{ background: `rgba(${bgRgb},0.05)`, border: `1px solid rgba(${bgRgb},0.2)`, borderRadius: 10, padding: "14px 16px" }}>
        <p style={{ fontFamily: F, fontSize: "0.78rem", fontWeight: 700, color: accent, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 6 }}>
          <span>{title}</span>
          <InfoTip text={tooltip} />
        </p>
        <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)", margin: "0 0 12px" }}>{subtitle}</p>

        {/* Big numbers row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div>
            <p style={{ fontFamily: F, fontSize: "1.5rem", fontWeight: 700, color: accent, margin: 0 }}>
              {data.hitRate !== null ? `${data.hitRate}%` : "—"}
            </p>
            <p style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text2)", margin: "2px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
              <span>Acierto</span>
              <InfoTip text="De los platos que mostramos con esta etiqueta, qué porcentaje también estuvo entre los más vendidos. Si dice 67%, 2 de cada 3 platos etiquetados sí vendieron bien — la etiqueta está acertando. Si dice 0%, ningún plato etiquetado fue de los más vendidos." />
            </p>
          </div>
          <div>
            <p style={{ fontFamily: F, fontSize: "1.5rem", fontWeight: 700, color: data.salesLift !== null && data.salesLift > 0 ? accent : "var(--adm-text2)", margin: 0 }}>
              {data.salesLift !== null ? (data.salesLift > 0 ? `+${data.salesLift}%` : `${data.salesLift}%`) : "—"}
            </p>
            <p style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text2)", margin: "2px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
              <span>Más ventas que el resto</span>
              <InfoTip text="Comparación de ventas entre platos etiquetados y no etiquetados. Si dice +50%, los platos con etiqueta vendieron en promedio 50% más unidades que los que no tuvieron etiqueta. Si es negativo, los platos sin etiqueta vendieron más." />
            </p>
          </div>
        </div>

        {/* Top items con foto */}
        {data.topItems?.length > 0 && (
          <div>
            <p style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 6 }}>
              <span>Platos que se vendieron con esta etiqueta</span>
              <InfoTip text="Top platos que tuvieron la etiqueta en el período Y vendieron. Ordenados por ventas. La estrella ⭐ marca los que además fueron de los más vendidos del local. El % indica cuánto del periodo el plato estuvo con la etiqueta." />
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.topItems.map((it: any) => (
                <div key={it.dishId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0", borderBottom: `1px dashed rgba(${bgRgb},0.15)` }}>
                  {it.photo ? (
                    <img src={it.photo} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 32, height: 32, borderRadius: 6, background: "var(--adm-hover)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem" }}>🍽️</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text)", margin: 0, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {it.wasTopSeller && <span style={{ marginRight: 4 }}>⭐</span>}{it.name}
                    </p>
                    <p style={{ fontFamily: F, fontSize: "0.62rem", color: "var(--adm-text3)", margin: "2px 0 0" }} title={`Estuvo ${it.coveragePct}% del periodo con la etiqueta`}>
                      {it.coveragePct}% del tiempo etiquetado
                    </p>
                  </div>
                  <span style={{ flexShrink: 0, color: accent, fontFamily: F, fontSize: "0.92rem", fontWeight: 700 }}>
                    {it.sales}
                    <span style={{ fontSize: "0.62rem", fontWeight: 600, marginLeft: 3, opacity: 0.85 }}>{it.sales === 1 ? "venta" : "ventas"}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 18px", boxShadow: "var(--adm-card-shadow, none)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: 0, fontWeight: 600 }}>🎖️ Acierto de las etiquetas</p>
        <InfoTip text="¿Las etiquetas que mostramos en la carta están funcionando? Comparamos los platos que tuvieron etiqueta contra los que más se vendieron." />
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: FB, fontSize: "0.68rem", color: "var(--adm-text3)" }}>
          Capturado cada 30 min · {badges.summary.popularRuns} corridas
        </span>
      </div>

      <div className="adm-cols-2" style={{ alignItems: "start" }}>
        {renderCard(
          "🔥 Popular hoy",
          "Calculado por algoritmo (los más abiertos en las últimas 48h).",
          "#ef4444",
          "239,68,68",
          badges.popular,
          "Mide si los platos que destacamos automáticamente con 🔥 son los que realmente venden bien. Si el acierto es alto, el algoritmo está acertando.",
        )}
        {renderCard(
          "⭐ Recomendado",
          "Tu selección manual de platos a destacar.",
          "#F4A623",
          "244,166,35",
          badges.recommended,
          "Mide si los platos que vos eligiste destacar son los que la gente pide. Si el acierto es alto, tu selección está dando en el clavo. Si es bajo, capaz convenga revisar qué destacás.",
        )}
      </div>
    </div>
  );
}

/* ═══ TAB: Clientes ═══ */
function TabClientes({ rid, from, to }: { rid: string; from: string; to: string }) {
  const [funnel, setFunnel] = useState<any>(null);
  const [clientes, setClientes] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const p1 = new URLSearchParams({ type: "funnel", from, to });
    const p2 = new URLSearchParams({ type: "clientes", from, to });
    if (rid) { p1.set("restaurantId", rid); p2.set("restaurantId", rid); }
    Promise.all([
      fetch(`/api/admin/analytics?${p1}`).then(r => r.json()),
      fetch(`/api/admin/analytics?${p2}`).then(r => r.json()),
    ]).then(([f, c]) => { setFunnel(f); setClientes(c); }).catch(() => {}).finally(() => setLoading(false));
  }, [rid, from, to]);

  if (loading) return <SkeletonLoading type="analytics" />;

  const maxTime = clientes?.timeOfDay ? Math.max(...clientes.timeOfDay.map((t: any) => t.count), 1) : 1;
  const dietColors: Record<string, string> = { OMNIVORE: "#F4A623", VEGAN: "#4ade80", VEGETARIAN: "#16a34a", PESCETARIAN: "#7fbfdc" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Funnel */}
      {funnel && (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 18px", boxShadow: "var(--adm-card-shadow, none)" }}>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 14px", fontWeight: 600 }}>Embudo de conversión</p>
          {[
            { label: "Visitantes únicos", value: funnel.totalVisitors, pct: 100, color: "var(--adm-accent)" },
            { label: "Recurrentes", value: funnel.returningVisitors, pct: funnel.returningPct, color: "#3db89e" },
            { label: "Se registraron", value: funnel.convertedCount, pct: funnel.conversionPct, color: "#7fbfdc" },
          ].map((step, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text)" }}>{step.label}</span>
                <span style={{ fontFamily: F, fontSize: "0.78rem", color: step.color, fontWeight: 600 }}>{step.value} ({step.pct}%)</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: "var(--adm-card-border)" }}>
                <div style={{ height: "100%", width: `${step.pct}%`, borderRadius: 3, background: step.color, transition: "width 0.5s ease" }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cuándo vienen */}
      {clientes?.timeOfDay && clientes.totalSessions > 0 && (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 18px", boxShadow: "var(--adm-card-shadow, none)" }}>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 14px", fontWeight: 600 }}>🕐 Cuándo vienen tus clientes</p>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 110 }}>
            {clientes.timeOfDay.map((t: any) => (
              <div key={t.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <span style={{ fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text2)", fontWeight: 600 }}>{t.count}</span>
                <div style={{ width: "100%", height: Math.max(4, (t.count / maxTime) * 80), background: t.count > 0 ? "var(--adm-accent)" : "var(--adm-card-border)", borderRadius: 4, transition: "height 0.4s ease" }} />
                <span style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text2)", fontWeight: 600 }}>{t.label}</span>
                <span style={{ fontFamily: F, fontSize: "0.58rem", color: "var(--adm-text3)" }}>{t.hint}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Perfil dietético */}
      {clientes?.dietProfile && (clientes.dietProfile.totalDietGuests > 0 || clientes.dietProfile.restrictions.length > 0) && (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 18px", boxShadow: "var(--adm-card-shadow, none)" }}>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 14px", fontWeight: 600 }}>🥗 Perfil dietético de tus clientes</p>
          <div className="adm-cols-2" style={{ gap: 14 }}>
            <div>
              <p style={{ fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text3)", margin: "0 0 8px", fontWeight: 600 }}>Tipo de dieta declarado</p>
              {clientes.dietProfile.diets.length === 0 ? (
                <p style={{ fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text3)" }}>Aún no declaran</p>
              ) : (
                clientes.dietProfile.diets.map((d: any) => {
                  const pct = clientes.dietProfile.totalDietGuests > 0 ? Math.round((d.count / clientes.dietProfile.totalDietGuests) * 100) : 0;
                  return (
                    <div key={d.key} style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <span style={{ fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text)" }}>{d.label}</span>
                        <span style={{ fontFamily: F, fontSize: "0.72rem", color: dietColors[d.key] || "var(--adm-text2)", fontWeight: 600 }}>{d.count} ({pct}%)</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 3, background: "var(--adm-card-border)" }}>
                        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 3, background: dietColors[d.key] || "var(--adm-accent)", transition: "width 0.4s ease" }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div>
              <p style={{ fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text3)", margin: "0 0 8px", fontWeight: 600 }}>Restricciones más comunes</p>
              {clientes.dietProfile.restrictions.length === 0 ? (
                <p style={{ fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text3)" }}>Sin restricciones declaradas</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {clientes.dietProfile.restrictions.map((r: any, i: number) => (
                    <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text3)", fontWeight: 700, width: 14 }}>{i + 1}</span>
                      <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text)", flex: 1 }}>{r.label || r.name}</span>
                      <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-accent)", fontWeight: 600 }}>{r.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ TAB: Garzón ═══ */
function TabGarzon({ rid, isSuper }: { rid: string; isSuper: boolean }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = rid ? `restaurantId=${rid}` : (isSuper ? "all=true" : "");
    if (!params) { setLoading(false); return; }
    fetch(`/api/admin/analytics-garzon?${params}`).then(r => r.json()).then(d => { if (!d.error) setData(d); }).catch(() => {}).finally(() => setLoading(false));
  }, [rid, isSuper]);

  if (loading) return <SkeletonLoading type="analytics" />;
  if (!data) return <p style={{ color: "var(--adm-text2)", fontFamily: F, textAlign: "center", padding: 40 }}>Sin datos de garzón</p>;

  const days = Object.entries(data.perDay || {});
  const maxDay = Math.max(...days.map(d => d[1] as number), 1);

  const formatTime = (sec: number) => sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${sec % 60}s`;
  const formatHour = (h: number) => `${h.toString().padStart(2, "0")}:00`;
  const GOLD = "#F4A623";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary */}
      <div className="adm-kpi-grid">
        {[
          { label: "Hoy", value: data.today, color: GOLD },
          { label: "Semana", value: data.week },
          { label: "% Atendidos", value: `${data.answeredPct}%`, color: data.answeredPct >= 80 ? "#16a34a" : data.answeredPct >= 50 ? GOLD : "#ef4444" },
          { label: "Tiempo resp.", value: formatTime(data.avgResponseSec), color: data.avgResponseSec <= 120 ? "#16a34a" : GOLD },
        ].map((c, i) => (
          <Card key={i} label={c.label} value={c.value} color={c.color} />
        ))}
      </div>

      {/* Bar chart - calls per day */}
      {days.length > 0 && (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 20px", boxShadow: "var(--adm-card-shadow, none)" }}>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 14px", fontWeight: 600 }}>Llamados por día</p>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100 }}>
            {days.map(([date, count]) => {
              const dayName = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][new Date(date + "T12:00:00").getDay()];
              return (
                <div key={date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text2)" }}>{count as number}</span>
                  <div style={{ width: "100%", height: Math.max(4, ((count as number) / maxDay) * 80), background: (count as number) > 0 ? GOLD : "var(--adm-card-border)", borderRadius: 4 }} />
                  <span style={{ fontFamily: F, fontSize: "0.6rem", color: "var(--adm-text3)" }}>{dayName}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Two columns: top mesas + peak hours */}
      <div className="adm-cols-2">
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 20px", boxShadow: "var(--adm-card-shadow, none)" }}>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 12px", fontWeight: 600 }}>Mesas más activas</p>
          {(data.topMesas || []).length > 0 ? data.topMesas.map((m: any, i: number) => (
            <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < data.topMesas.length - 1 ? "1px solid var(--adm-card-border)" : "none" }}>
              <span style={{ fontFamily: F, fontSize: "0.75rem", color: GOLD, fontWeight: 700, width: 20 }}>{i + 1}</span>
              <span style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text)", flex: 1 }}>{m.name}</span>
              <span style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)" }}>{m.count}x</span>
            </div>
          )) : <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)" }}>Sin datos</p>}
        </div>
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 20px", boxShadow: "var(--adm-card-shadow, none)" }}>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 12px", fontWeight: 600 }}>Horas punta</p>
          {(data.peakHours || []).length > 0 ? data.peakHours.map((h: any, i: number) => (
            <div key={h.hour} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < data.peakHours.length - 1 ? "1px solid var(--adm-card-border)" : "none" }}>
              <span style={{ fontFamily: F, fontSize: "0.82rem", color: GOLD, fontWeight: 600 }}>{formatHour(h.hour)}</span>
              <div style={{ flex: 1, height: 6, background: "var(--adm-card-border)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${(h.count / (data.peakHours[0]?.count || 1)) * 100}%`, height: "100%", background: GOLD, borderRadius: 3 }} />
              </div>
              <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)" }}>{h.count}</span>
            </div>
          )) : <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)" }}>Sin datos</p>}
        </div>
      </div>

      {/* Recent calls */}
      {(data.recent || []).length > 0 && (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 20px", boxShadow: "var(--adm-card-shadow, none)" }}>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 12px", fontWeight: 600 }}>Últimos llamados</p>
          {data.recent.map((c: any) => {
            const time = new Date(c.calledAt);
            const hhmm = `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}`;
            const dateStr = time.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
            return (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--adm-card-border)" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.answeredAt ? "#16a34a" : "#ef4444", flexShrink: 0 }} />
                <span style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text)", flex: 1 }}>{c.tableName || "Sin mesa"}</span>
                <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)" }}>{dateStr} {hhmm}</span>
                {c.responseTime !== null ? (
                  <span style={{ fontFamily: F, fontSize: "0.68rem", color: "#16a34a", fontWeight: 600 }}>{formatTime(c.responseTime)}</span>
                ) : (
                  <span style={{ fontFamily: F, fontSize: "0.68rem", color: "#ef4444" }}>Sin atender</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══ TAB: Búsquedas ═══ */
function TabBusquedas({ rid, from, to }: { rid: string; from: string; to: string }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams({ type: "searches", from, to });
    if (rid) p.set("restaurantId", rid);
    fetch(`/api/admin/analytics?${p}`).then(r => r.json()).then(d => {
      const arr = Array.isArray(d) ? d : [];
      setData(arr.map((s: any) => ({ ...s, count: s.timesSearched || s.count || 0 })));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [rid, from, to]);

  if (loading) return <SkeletonLoading type="list" />;

  return (
    <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 18px", boxShadow: "var(--adm-card-shadow, none)" }}>
      <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 12px", fontWeight: 600 }}>🔍 Qué buscan tus clientes</p>
      {data.length === 0 ? (
        <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", textAlign: "center", padding: 20 }}>Sin búsquedas registradas</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {data.slice(0, 20).map((s: any, i: number) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--adm-card-border)" }}>
              <span style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text)", flex: 1 }}>"{s.query}"</span>
              <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", flexShrink: 0 }}>{s.count}x</span>
              <span style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", flexShrink: 0 }}>{s.uniqueVisitors} visitor{s.uniqueVisitors !== 1 ? "es" : ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══ TAB: Sesiones ═══ */
function TabSesiones({ rid, from, to }: { rid: string; from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [hideEmpty, setHideEmpty] = useState(false);
  // El filtro por guest se sincroniza con el URL (?guestId=xxx&guestName=yyy)
  // — así "ver historial" cambia la navegación (back button, share link, refresh).
  const guestIdFromUrl = sp?.get("guestId") || null;
  const guestNameFromUrl = sp?.get("guestName") || null;
  const guestFilter = guestIdFromUrl ? { id: guestIdFromUrl, name: guestNameFromUrl || `Fantasma #${guestIdFromUrl.slice(0, 8)}` } : null;
  const setGuestFilter = (g: { id: string; name: string } | null) => {
    const params = new URLSearchParams(sp?.toString() || "");
    if (g) {
      params.set("guestId", g.id);
      params.set("guestName", g.name);
    } else {
      params.delete("guestId");
      params.delete("guestName");
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  // Si el admin cambia de restaurante mientras filtraba por guest, el filtro queda obsoleto
  // (otro local probablemente no tiene sesiones de ese visitante). Lo limpiamos automáticamente.
  const prevRidRef = useRef<string>(rid);
  useEffect(() => {
    if (prevRidRef.current !== rid && guestIdFromUrl) {
      const params = new URLSearchParams(sp?.toString() || "");
      params.delete("guestId");
      params.delete("guestName");
      router.replace(`${pathname}?${params.toString()}`);
    }
    prevRidRef.current = rid;
  }, [rid]);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    const p = new URLSearchParams({ page: "1" });
    if (guestIdFromUrl) {
      // Cuando filtramos por guest, ignoramos el rango de fechas para ver TODO el historial
      p.set("guestId", guestIdFromUrl);
    } else {
      p.set("from", from);
      p.set("to", to);
    }
    if (rid) p.set("restaurantId", rid);
    if (hideEmpty) p.set("hideEmpty", "true");
    fetch(`/api/admin/sessions?${p}`).then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
    // guestIdFromUrl es un string estable derivado del URL — usar guestFilter (objeto)
    // disparaba el effect en cada render porque la identidad del objeto cambia, causando loop.
  }, [rid, from, to, guestIdFromUrl, hideEmpty]);

  const loadPage = (pg: number) => {
    setLoading(true);
    setPage(pg);
    const p = new URLSearchParams({ page: String(pg) });
    if (guestFilter) {
      p.set("guestId", guestFilter.id);
    } else {
      p.set("from", from);
      p.set("to", to);
    }
    if (rid) p.set("restaurantId", rid);
    if (hideEmpty) p.set("hideEmpty", "true");
    fetch(`/api/admin/sessions?${p}`).then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  };

  if (loading) return <SkeletonLoading type="list" />;
  if (!data?.sessions?.length) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {guestFilter && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "rgba(244,166,35,0.08)", border: "1px solid rgba(244,166,35,0.25)", borderRadius: 10 }}>
          <span style={{ fontSize: "0.85rem" }}>👤</span>
          <span style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text)", flex: 1 }}>
            Viendo solo sesiones de <strong>{guestFilter.name}</strong> en este local
          </span>
          <button onClick={() => setGuestFilter(null)} style={{ padding: "4px 12px", fontFamily: F, fontSize: "0.72rem", background: "rgba(244,166,35,0.15)", border: "1px solid rgba(244,166,35,0.4)", borderRadius: 6, color: "#F4A623", cursor: "pointer", fontWeight: 600 }}>← Ver todas</button>
        </div>
      )}
      <div style={{ color: "var(--adm-text2)", fontFamily: F, textAlign: "center", padding: 40 }}>
        <p>{guestFilter ? "Este visitante no tiene sesiones en este local" : hideEmpty ? "Sin sesiones con actividad en este período" : "Sin sesiones en este período"}</p>
        {guestFilter && <button onClick={() => setGuestFilter(null)} style={{ marginTop: 12, padding: "6px 14px", fontFamily: F, fontSize: "0.78rem", background: "rgba(244,166,35,0.12)", border: "1px solid rgba(244,166,35,0.3)", borderRadius: 8, color: "#F4A623", cursor: "pointer" }}>← Ver todas las sesiones</button>}
        {!guestFilter && hideEmpty && <button onClick={() => setHideEmpty(false)} style={{ marginTop: 12, padding: "6px 14px", fontFamily: F, fontSize: "0.78rem", background: "rgba(244,166,35,0.12)", border: "1px solid rgba(244,166,35,0.3)", borderRadius: 8, color: "#F4A623", cursor: "pointer" }}>Mostrar también escaneos vacíos</button>}
      </div>
    </div>
  );

  const toggle = (id: string) => setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const fmtTime = (d: string) => { const t = new Date(d); return `${t.getHours().toString().padStart(2, "0")}:${t.getMinutes().toString().padStart(2, "0")}`; };
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("es-CL", { day: "numeric", month: "short" });
  const viewLabels: Record<string, string> = { premium: "Galería", lista: "Lista", feed: "Feed", viaje: "Espacial" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {guestFilter && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "rgba(244,166,35,0.08)", border: "1px solid rgba(244,166,35,0.25)", borderRadius: 10 }}>
          <span style={{ fontSize: "0.85rem" }}>👤</span>
          <span style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text)", flex: 1 }}>
            Viendo solo sesiones de <strong>{guestFilter.name}</strong> en este local
          </span>
          <button onClick={() => setGuestFilter(null)} style={{ padding: "4px 12px", fontFamily: F, fontSize: "0.72rem", background: "rgba(244,166,35,0.15)", border: "1px solid rgba(244,166,35,0.4)", borderRadius: 6, color: "#F4A623", cursor: "pointer", fontWeight: 600 }}>← Ver todas</button>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, margin: "0 0 4px", flexWrap: "wrap" }}>
        <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", margin: 0 }}>
          {data.total} sesión{data.total !== 1 ? "es" : ""} · Página {data.page} de {data.totalPages}
        </p>
        {!guestFilter && (
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text3)", cursor: "pointer" }}>
            <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} style={{ cursor: "pointer" }} />
            Ocultar escaneos vacíos
          </label>
        )}
      </div>
      {data.sessions.map((s: any) => {
        const isOpen = expanded.has(s.id);
        const dishes = s.dishesViewed || [];
        const duration = s.durationMs ? formatDuration(s.durationMs) : "—";
        // Recurrente = días distintos que vino al local (no # de sesiones, que pueden ser scans dentro de la misma comida)
        const visitDays = s.visitDays || 1;
        const isReturningGuest = visitDays > 1;
        // Identificador anónimo: "Fantasma #abc12345" si no es usuario registrado
        const anonName = s.anonId ? `Fantasma #${s.anonId}` : "Visitante";
        const userName = s.qrUser?.name || anonName;
        const visitNumToday = s.visitNumToday || 1;
        const visitsToday = s.visitsToday || 1;
        // Parser simple del UA para sacar nombre del browser
        const ua = (s.userAgent || "").toLowerCase();
        const browser = /firefox/.test(ua) ? "Firefox" : /edg\//.test(ua) ? "Edge" : /chrome|crios/.test(ua) ? "Chrome" : /safari/.test(ua) ? "Safari" : /opr|opera/.test(ua) ? "Opera" : (s.userAgent ? "Otro" : null);
        const langShort = s.language ? s.language.split(/[-_]/)[0].toUpperCase() : null;

        return (
          <div key={s.id} style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, overflow: "hidden", boxShadow: "var(--adm-card-shadow, none)" }}>
            <div onClick={() => toggle(s.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", cursor: "pointer" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 600, color: "var(--adm-text)" }}>{userName}</span>
                  {s.qrUser?.email && <span style={{ fontFamily: FB, fontSize: "0.68rem", color: "var(--adm-text3)" }}>{s.qrUser.email}</span>}
                  {isReturningGuest && (
                    <span title={`Este cliente ha venido al local en ${visitDays} días distintos en total`} style={{ fontFamily: F, fontSize: "0.62rem", padding: "1px 7px", borderRadius: 4, background: "rgba(167,139,250,0.15)", color: "#a78bfa", fontWeight: 600, cursor: "help" }}>
                      🔁 {visitDays} {visitDays === 1 ? "día" : "días"}
                    </span>
                  )}
                  {visitsToday > 1 && (
                    <span title={`Hoy abrió la carta ${visitsToday} veces. Esta es la visita N° ${visitNumToday}. Reloads dentro de 1 min se cuentan como la misma sesión.`} style={{ fontFamily: F, fontSize: "0.62rem", padding: "1px 7px", borderRadius: 4, background: "rgba(127,191,220,0.15)", color: "#7fbfdc", fontWeight: 600, cursor: "help" }}>
                      👁 {visitNumToday} de {visitsToday} hoy
                    </span>
                  )}
                  {!guestFilter && (visitDays >= 2 || s.qrUser?.id) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setGuestFilter({ id: s.guestId, name: s.qrUser?.name || anonName }); }}
                      style={{ fontFamily: F, fontSize: "0.65rem", padding: "2px 8px", background: "rgba(244,166,35,0.1)", border: "1px solid rgba(244,166,35,0.3)", borderRadius: 6, color: "#F4A623", cursor: "pointer", fontWeight: 600 }}
                      title="Ver todas las sesiones de este visitante"
                    >
                      ver historial →
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)" }}>{fmtDate(s.startedAt)} {fmtTime(s.startedAt)}</span>
                  <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-accent)", fontWeight: 600 }}>{duration}</span>
                  <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)" }}>{dishes.length} plato{dishes.length !== 1 ? "s" : ""}</span>
                  {s.viewUsed && <span style={{ fontFamily: F, fontSize: "0.65rem", padding: "1px 6px", borderRadius: 4, background: "var(--adm-hover)", color: "var(--adm-text2)" }}>{viewLabels[s.viewUsed] || s.viewUsed}</span>}
                  {s.deviceType && <span style={{ fontFamily: F, fontSize: "0.65rem", padding: "1px 6px", borderRadius: 4, background: "var(--adm-hover)", color: "var(--adm-text3)" }}>{s.deviceType === "mobile" ? "📱" : s.deviceType === "desktop" ? "💻" : "📟"} {s.deviceType}</span>}
                  {browser && <span style={{ fontFamily: F, fontSize: "0.65rem", padding: "1px 6px", borderRadius: 4, background: "var(--adm-hover)", color: "var(--adm-text3)" }}>{browser}</span>}
                  {langShort && <span style={{ fontFamily: F, fontSize: "0.65rem", padding: "1px 6px", borderRadius: 4, background: "var(--adm-hover)", color: "var(--adm-text3)" }} title={`Idioma del navegador: ${s.language}`}>🌐 {langShort}</span>}
                  {s.ipAddress && <span style={{ fontFamily: FB, fontSize: "0.65rem", padding: "1px 6px", borderRadius: 4, background: "var(--adm-hover)", color: "var(--adm-text3)" }} title="IP del visitante">{s.ipAddress}</span>}
                  {/* Destacados vistos / total */}
                  {(s.recommendedTotal || 0) > 0 && (
                    <span style={{ fontSize: "0.65rem", padding: "1px 6px", borderRadius: 4, background: (s.recommendedHits || 0) > 0 ? "rgba(244,166,35,0.15)" : "var(--adm-hover)", color: (s.recommendedHits || 0) > 0 ? "#F4A623" : "var(--adm-text3)", fontWeight: 600 }} title={`Vio ${s.recommendedHits} de los ${s.recommendedTotal} platos destacados de la carta`}>
                      ⭐ {s.recommendedHits || 0}/{s.recommendedTotal} destacados
                    </span>
                  )}
                  {/* Cumpleaños */}
                  {s.genioData?.birthdaySaved && (
                    s.genioData.birthdayWasReturning ? (
                      <span title="Esta persona ya tenía cuenta en QuieroComer (volvió, no es cliente nuevo)" style={{ fontSize: "0.65rem", padding: "1px 6px", borderRadius: 4, background: "rgba(127,191,220,0.15)", color: "#5fa3c4" }}>🎂↻ Cliente que vuelve</span>
                    ) : (
                      <span title="El comensal guardó su cumpleaños en esta sesión (cuenta nueva)" style={{ fontSize: "0.65rem", padding: "1px 6px", borderRadius: 4, background: "rgba(167,139,250,0.15)", color: "#a78bfa" }}>🎂 Guardó cumple</span>
                    )
                  )}
                  {!s.genioData?.birthdaySaved && s.genioData?.birthdayDismissed && <span title="Vio el modal de cumple pero lo cerró sin guardar" style={{ fontSize: "0.65rem", padding: "1px 6px", borderRadius: 4, background: "rgba(155,155,155,0.15)", color: "var(--adm-text3)" }}>🎂✕ Cerró cumple</span>}
                  {!s.genioData?.birthdaySaved && !s.genioData?.birthdayDismissed && s.genioData?.birthdayModalAutoShown && <span title="Se le mostró el modal automático de cumple" style={{ fontSize: "0.65rem", padding: "1px 6px", borderRadius: 4, background: "rgba(167,139,250,0.10)", color: "#a78bfa" }}>🎂 Modal mostrado</span>}
                  {/* Garzón */}
                  {s.waiterCalls?.length > 0 && <span style={{ fontSize: "0.65rem", padding: "1px 6px", borderRadius: 4, background: "rgba(127,191,220,0.15)", color: "#7fbfdc" }}>🔔 Garzón</span>}
                  {/* Sesion sospechosa */}
                  {s.suspicious && <span title="Patrón de bot, dev o spam: sin actividad y muy corta, o user-agent de bot" style={{ fontSize: "0.65rem", padding: "1px 6px", borderRadius: 4, background: "rgba(239,68,68,0.15)", color: "#ef4444", fontWeight: 600 }}>⚠️ Sospechosa</span>}
                </div>
              </div>
              <span style={{ color: "var(--adm-text3)", fontSize: "0.75rem", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▼</span>
            </div>

            {isOpen && (
              <div style={{ padding: "0 16px 14px", borderTop: "1px solid var(--adm-card-border)" }}>
                {/* Categories browsed */}
                {s.categoriesViewed?.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "0 0 4px", fontWeight: 600 }}>Categorías visitadas</p>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {s.categoriesViewed.map((c: any, i: number) => (
                        <span key={i} style={{ fontFamily: FB, fontSize: "0.72rem", padding: "2px 8px", borderRadius: 6, background: "var(--adm-hover)", color: "var(--adm-text2)" }}>
                          {c.name} {c.dwellMs > 1000 && <span style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-accent)" }}>({formatDuration(c.dwellMs)})</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dishes viewed */}
                {dishes.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 10 }}>
                    <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "0 0 4px", fontWeight: 600 }}>Platos vistos (en orden)</p>
                    {dishes.map((d: any, i: number) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", width: 18, textAlign: "right", flexShrink: 0 }}>{i + 1}.</span>
                        {d.dish?.photos?.[0] && <img src={d.dish.photos[0]} alt="" style={{ width: 24, height: 24, borderRadius: 4, objectFit: "cover", flexShrink: 0 }} />}
                        <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {d.dish?.name || d.dishId?.slice(0, 8)}
                        </span>
                        {d.isPopular && <span style={{ fontSize: "0.6rem", padding: "1px 5px", borderRadius: 4, background: "rgba(239,68,68,0.12)", color: "#f87171" }}>🔥</span>}
                        {d.isRecommended && <span style={{ fontSize: "0.6rem", padding: "1px 5px", borderRadius: 4, background: "rgba(244,166,35,0.12)", color: "#fbbf24" }}>⭐</span>}
                        {d.detailMs > 0 && <span style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-accent)", fontWeight: 600, flexShrink: 0 }}>{formatDuration(d.detailMs)}</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)", margin: "10px 0 0" }}>No vio platos en detalle</p>
                )}

                {/* Hero clicks */}
                {s.heroClicks?.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "0 0 4px", fontWeight: 600 }}>Hero clicks</p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {s.heroClicks.map((hc: any, i: number) => (
                        <span key={i} style={{ fontFamily: FB, fontSize: "0.72rem", padding: "2px 8px", borderRadius: 6, background: "rgba(244,166,35,0.1)", color: "#F4A623" }}>
                          {hc.dishName || "—"} ({hc.view})
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cumple guardado — solo se muestra si registró fecha */}
                {s.genioData?.birthdaySaved && (
                  <div style={{ marginTop: 12 }}>
                    <span style={{ fontFamily: FB, fontSize: "0.72rem", padding: "4px 10px", borderRadius: 6, background: "rgba(167,139,250,0.12)", color: "#a78bfa" }}>🎂 Registró su cumpleaños</span>
                  </div>
                )}

                {/* Personalization */}
                {s.personalizationData && s.personalizationData.shown > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "0 0 4px", fontWeight: 600 }}>✨ Para ti ({s.personalizationData.tapped}/{s.personalizationData.shown} tocados)</p>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {s.personalizationData.dishes.map((d: any, i: number) => (
                        <span key={i} style={{ fontFamily: FB, fontSize: "0.72rem", padding: "2px 8px", borderRadius: 6, background: d.tapped ? "rgba(74,222,128,0.1)" : "var(--adm-hover)", color: d.tapped ? "#4ade80" : "var(--adm-text3)" }}>
                          {d.name} {d.tapped && "✓"}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Experience submissions */}
                {s.experienceSubmissions?.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "0 0 4px", fontWeight: 600 }}>Experiencias</p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {s.experienceSubmissions.map((exp: any) => (
                        <span key={exp.id} style={{ fontFamily: FB, fontSize: "0.72rem", padding: "2px 8px", borderRadius: 6, background: "rgba(192,132,252,0.1)", color: "#c084fc" }}>
                          {exp.templateEmoji} {exp.templateName}{exp.resultName ? ` → ${exp.resultName}` : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Waiter calls */}
                {s.waiterCalls?.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "0 0 4px", fontWeight: 600 }}>🔔 Llamados al garzón</p>
                    {s.waiterCalls.map((wc: any) => (
                      <div key={wc.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: wc.answeredAt ? "#16a34a" : "#ef4444", flexShrink: 0 }} />
                        <span style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text)" }}>{wc.tableName || "Sin mesa"}</span>
                        <span style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)" }}>{fmtTime(wc.calledAt)}</span>
                        {wc.responseTime !== null && <span style={{ fontFamily: F, fontSize: "0.68rem", color: "#16a34a", fontWeight: 600 }}>{wc.responseTime}s</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Favorites */}
                {s.dishFavorites?.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "0 0 4px", fontWeight: 600 }}>❤️ Favoritos guardados</p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {s.dishFavorites.map((f: any) => (
                        <span key={f.id} style={{ fontFamily: FB, fontSize: "0.72rem", padding: "3px 8px", borderRadius: 6, background: "rgba(239,68,68,0.1)", color: "#f87171" }}>
                          {f.dish?.name || "—"}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Visit badge */}
                {s.visitDays > 1 && (
                  <div style={{ marginTop: 10 }}>
                    <span style={{ fontFamily: F, fontSize: "0.68rem", padding: "2px 8px", borderRadius: 6, background: "rgba(244,166,35,0.1)", color: "#F4A623" }}>
                      Visitante recurrente: {s.visitDays} días distintos
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 8 }}>
          {page > 1 && <button onClick={() => loadPage(page - 1)} style={{ padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: F, fontSize: "0.75rem", fontWeight: 600, background: "var(--adm-hover)", color: "var(--adm-text2)" }}>← Anterior</button>}
          <span style={{ fontFamily: F, fontSize: "0.75rem", color: "var(--adm-text3)", padding: "6px 0" }}>{page} / {data.totalPages}</span>
          {page < data.totalPages && <button onClick={() => loadPage(page + 1)} style={{ padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: F, fontSize: "0.75rem", fontWeight: 600, background: "var(--adm-hover)", color: "var(--adm-text2)" }}>Siguiente →</button>}
        </div>
      )}
    </div>
  );
}

/* ═══ MAIN ═══ */
const TABS_BASIC: { key: Tab; label: string; icon: string }[] = [
  { key: "resumen", label: "Resumen", icon: "📊" },
  { key: "platos", label: "Platos", icon: "🍽️" },
];

const TABS_ADVANCED: { key: Tab; label: string; icon: string }[] = [
  { key: "sesiones", label: "Sesiones", icon: "👁️" },
  { key: "clientes", label: "Clientes", icon: "👥" },
  { key: "garzon", label: "Garzón", icon: "🔔" },
  { key: "busquedas", label: "Búsquedas", icon: "🔍" },
];

type DatePreset = "hoy" | "ayer" | "semana" | "mes" | "custom";

function getDateRange(preset: DatePreset, customFrom?: string, customTo?: string): { from: string; to: string } {
  // Use Chile timezone so "hoy"/"ayer" match the user's local day
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
  const fmt = (d: Date) => { const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,"0"); const dd = String(d.getDate()).padStart(2,"0"); return `${y}-${m}-${dd}`; };
  if (preset === "hoy") return { from: fmt(today), to: fmt(today) };
  if (preset === "ayer") { const y = new Date(today); y.setDate(y.getDate() - 1); return { from: fmt(y), to: fmt(y) }; }
  if (preset === "semana") { const w = new Date(today); w.setDate(w.getDate() - 7); return { from: fmt(w), to: fmt(today) }; }
  if (preset === "mes") { const m = new Date(today); m.setDate(m.getDate() - 30); return { from: fmt(m), to: fmt(today) }; }
  return { from: customFrom || fmt(new Date(today.getTime() - 28 * 86400000)), to: customTo || fmt(today) };
}

export default function AnalyticsDashboard() {
  const { restaurants, isSuper, selectedRestaurantId } = useAdminSession();
  const { activePlan } = usePanelSession();
  const hasAdvanced = isSuper || canAccess(activePlan, "stats_advanced");
  const router = useRouter();
  const searchParams = useSearchParams();
  const openUpgrade = () => window.dispatchEvent(new CustomEvent("show-plan-modal", { detail: { initialTab: "PREMIUM" } }));

  // Read state from URL params
  const restaurantId = searchParams.get("restaurantId") || "";
  const tab = (searchParams.get("tab") as Tab) || "resumen";
  const datePreset = (searchParams.get("preset") as DatePreset) || "hoy";
  const customFrom = searchParams.get("from") || "";
  const customTo = searchParams.get("to") || "";

  const updateParams = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }, [searchParams, router]);

  const setRestaurantId = (v: string) => updateParams({ restaurantId: v || null });
  const setTab = (v: Tab) => updateParams({ tab: v === "resumen" ? null : v });
  const setDatePreset = (v: DatePreset) => updateParams({ preset: v === "semana" ? null : v, from: null, to: null });
  const setCustomFrom = (v: string) => updateParams({ from: v || null, preset: "custom" });
  const setCustomTo = (v: string) => updateParams({ to: v || null, preset: "custom" });

  const effectiveRid = isSuper ? restaurantId : (selectedRestaurantId || "");
  const { from: dateFrom, to: dateTo } = getDateRange(datePreset, customFrom, customTo);

  const allTabs = [...TABS_BASIC, ...TABS_ADVANCED];

  return (
    <div style={{ maxWidth: 760 }}>
      <div className="adm-flex-wrap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 10 }}>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: "var(--adm-accent)", margin: 0 }}>Analytics</h1>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "4px 0 0" }}>Métricas de tu restaurante</p>
        </div>
        {isSuper && (
          <select value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)} style={{ padding: "8px 12px", background: "var(--adm-select-bg)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text)", fontFamily: F, fontSize: "0.82rem", outline: "none" }}>
            <option value="" style={{ background: "var(--adm-select-bg)" }}>Todos los locales</option>
            {restaurants.map((r) => <option key={r.id} value={r.id} style={{ background: "var(--adm-select-bg)" }}>{r.name}</option>)}
          </select>
        )}
      </div>

      {/* Date filters */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {(["hoy", "ayer", "semana", "mes"] as DatePreset[]).map(p => (
            <button key={p} onClick={() => setDatePreset(p)} style={{
              padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
              fontFamily: F, fontSize: "0.75rem", fontWeight: 600,
              background: datePreset === p ? "var(--adm-accent)" : "var(--adm-hover)",
              color: datePreset === p ? "#fff" : "var(--adm-text3)",
            }}>
              {p === "hoy" ? "Hoy" : p === "ayer" ? "Ayer" : p === "semana" ? "Esta semana" : "Este mes"}
            </button>
          ))}
          <button
            onClick={() => {
              if (datePreset === "custom") setDatePreset("semana");
              else updateParams({ preset: "custom" });
            }}
            style={{
              padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer",
              fontFamily: F, fontSize: "0.75rem", fontWeight: 600,
              background: datePreset === "custom" ? "var(--adm-accent)" : "var(--adm-hover)",
              color: datePreset === "custom" ? "#fff" : "var(--adm-text3)",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>
            <span style={{ fontSize: "0.85rem", lineHeight: 1 }}>📅</span>
            Personalizado
          </button>
        </div>
        {datePreset === "custom" && (
          <div style={{ display: "flex", gap: 6, alignItems: "center", paddingLeft: 2 }}>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ padding: "6px 10px", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text)", fontFamily: F, fontSize: "0.78rem", outline: "none", colorScheme: "dark" }} />
            <span style={{ color: "var(--adm-text3)", fontSize: "0.78rem" }}>—</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ padding: "6px 10px", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text)", fontFamily: F, fontSize: "0.78rem", outline: "none", colorScheme: "dark" }} />
          </div>
        )}
      </div>

      {/* Tabs */}
      {(() => {
        const [tabsScrolled, setTabsScrolled] = useState(false);
        return (
          <div style={{ position: "relative", marginBottom: 20 }}>
            <div
              onScroll={(e) => setTabsScrolled((e.target as HTMLElement).scrollLeft > 8)}
              style={{ display: "flex", gap: 4, overflowX: "auto", scrollbarWidth: "none", paddingRight: 24 }}
            >
              {allTabs.map(t => {
                const isAdvancedTab = TABS_ADVANCED.some(a => a.key === t.key);
                const locked = isAdvancedTab && !hasAdvanced;
                return (
                  <button key={t.key} onClick={() => { if (locked) { openUpgrade(); } else { setTab(t.key); } }} style={{
                    padding: "8px 16px", borderRadius: 10, border: "none", cursor: "pointer",
                    fontFamily: F, fontSize: "0.78rem", fontWeight: 600, whiteSpace: "nowrap",
                    background: tab === t.key ? "var(--adm-accent)" : "var(--adm-hover)",
                    color: tab === t.key ? "#fff" : locked ? "var(--adm-text3)" : "var(--adm-text2)",
                    opacity: locked ? 0.5 : 1,
                    transition: "all 0.15s",
                  }}>
                    {t.icon} {t.label} {locked && "🔒"}
                  </button>
                );
              })}
            </div>
            {tabsScrolled && <div style={{ position: "absolute", top: 0, left: 0, width: 32, height: "100%", background: "linear-gradient(to left, transparent, var(--adm-bg, #0e0e0e))", pointerEvents: "none" }} />}
            <div style={{ position: "absolute", top: 0, right: 0, width: 32, height: "100%", background: "linear-gradient(to right, transparent, var(--adm-bg, #0e0e0e))", pointerEvents: "none" }} />
          </div>
        );
      })()}

      {/* Content */}
      {tab === "resumen" && <TabResumen rid={effectiveRid} from={dateFrom} to={dateTo} />}
      {tab === "platos" && <TabPlatos rid={effectiveRid} from={dateFrom} to={dateTo} />}
      {tab === "sesiones" && <TabSesiones rid={effectiveRid} from={dateFrom} to={dateTo} />}
      {tab === "clientes" && <TabClientes rid={effectiveRid} from={dateFrom} to={dateTo} />}
      {tab === "garzon" && <TabGarzon rid={effectiveRid} isSuper={isSuper} />}
      {tab === "busquedas" && <TabBusquedas rid={effectiveRid} from={dateFrom} to={dateTo} />}

      {/* Upgrade teaser for Gold users */}
      {!hasAdvanced && (
        <div style={{ marginTop: 32, background: "linear-gradient(135deg, rgba(124,58,237,0.08), rgba(124,58,237,0.04))", border: "1px solid rgba(124,58,237,0.15)", borderRadius: 16, padding: "24px 28px", textAlign: "center" }}>
          <p style={{ fontFamily: F, fontSize: "1rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 6px" }}>
            💎 Ve exactamente qué hace cada cliente en tu carta
          </p>
          <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "0 0 16px", lineHeight: 1.5 }}>
            Sesiones en vivo, qué platos miran, cuánto tiempo pasan en cada uno, qué buscan y más
          </p>
          <button
            onClick={() => openUpgrade()}
            style={{ padding: "10px 24px", background: "#7c3aed", color: "#fff", borderRadius: 999, border: "none", fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(124,58,237,0.3)" }}
          >
            Pasarme a Premium →
          </button>
        </div>
      )}

    </div>
  );
}
