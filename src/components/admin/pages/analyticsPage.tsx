"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import { canAccess } from "@/lib/plans";
import PlanGate from "@/components/admin/PlanGate";
import PlanUpgradeModal from "@/components/admin/PlanUpgradeModal";
import SkeletonLoading from "@/components/admin/SkeletonLoading";

const F = "var(--font-display)";
const FB = "var(--font-body)";

/** Inline info icon with native title tooltip — click/hover reveals an
 * explanation of what the metric means. Uses HTML `title` for simplicity. */
function InfoTip({ text }: { text: string }) {
  return (
    <span
      title={text}
      role="button"
      tabIndex={0}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 14,
        height: 14,
        borderRadius: "50%",
        background: "var(--adm-text3)",
        color: "var(--adm-card)",
        fontSize: "0.6rem",
        fontWeight: 700,
        fontFamily: "var(--font-display)",
        cursor: "help",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      i
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
function TabResumen({ rid, from, to }: { rid: string; from: string; to: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams({ type: "metrics", from, to });
    if (rid) p.set("restaurantId", rid);
    fetch(`/api/admin/analytics?${p}`).then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [rid, from, to]);

  if (loading) return <SkeletonLoading type="analytics" />;
  if (!data) return <p style={{ color: "var(--adm-text2)", fontFamily: F, textAlign: "center", padding: 40 }}>Sin datos</p>;

  return (
    <div className="adm-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <Card label="Visitantes únicos" value={data.totalVisitors} />
      <Card label="Total sesiones" value={data.totalSessions} />
      <Card label="% Recurrentes" value={`${data.returningPct}%`} sub={`${data.returningVisitors} de ${data.totalVisitors}`} color="var(--adm-positive)" />
      <Card label="% Conversión a registrado" value={`${data.conversionPct}%`} sub={`${data.convertedCount} convertidos`} color="#7fbfdc" />
      <Card label="Duración promedio" value={formatDuration(data.avgDurationMs)} color="var(--adm-positive)" />
      <Card label="Platos vistos / sesión" value={data.avgDishesViewed} color="var(--adm-text)" />
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
  const [data, setData] = useState<any>(null);
  const [cross, setCross] = useState<any>(null);
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

  useEffect(() => {
    setLoading(true);
    const p1 = new URLSearchParams({ type: "dishes", from, to });
    const p2 = new URLSearchParams({ from, to });
    if (rid) { p1.set("restaurantId", rid); p2.set("restaurantId", rid); }
    Promise.all([
      fetch(`/api/admin/analytics?${p1}`).then(r => r.json()),
      fetch(`/api/admin/analytics/carta-vs-caja?${p2}`).then(r => r.json()).catch(() => null),
    ]).then(([d, c]) => { setData(d); if (c && !c.error) setCross(c); }).catch(() => {}).finally(() => setLoading(false));
  }, [rid, from, to]);

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
    unit: "sesiones",
    tooltip: "Cantidad de sesiones distintas que abrieron el detalle de cada plato. Una sesión = un cliente. Un plato con '25' significa que 25 clientes abrieron ese plato durante el período seleccionado.",
  };
  const mostDetailed = {
    title: "Más tiempo en detalle",
    items: data.mostDetailed || [],
    icon: "🔍",
    unit: "promedio",
    tooltip: "Promedio de segundos que cada cliente pasó dentro del modal del plato. Si un plato dice '12s', cada cliente que lo abrió se quedó en promedio 12 segundos mirándolo. Más tiempo suele indicar curiosidad o interés alto.",
  };
  const leastViewed = {
    title: "Platos abandonados",
    items: data.leastViewed || [],
    icon: "🌱",
    unit: "% sesiones que los abrieron",
    tooltip: "Platos que pocos clientes abrieron en detalle. El % muestra qué porcentaje del total de sesiones del período abrió el modal de ese plato. Si dice '3%', solo 3 de cada 100 clientes lo miraron. Excluye platos creados en los últimos 7 días.",
  };
  const topCategories = {
    title: "Categorías más exploradas",
    items: (data.topCategories || []).map((c: any) => ({
      name: c.name,
      count: `${c.pct}% · ${formatDuration(c.totalMs)}`,
    })),
    icon: "🗂️",
    unit: "% del tiempo en carta",
    tooltip: "Tiempo total que los clientes pasaron en cada sección de la carta haciendo scroll. Si dice 'Sushi 35% · 8min', los clientes pasaron el 35% del tiempo total (8 min sumando todas las sesiones) explorando esa sección. Útil para saber qué sección tiene más tracción aunque no se vea reflejado en aperturas de platos.",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Grid 2x2 con los 4 bloques principales */}
      <div className="adm-cols-2">
        {renderSection(mostViewed)}
        {renderSection(leastViewed)}
        {renderSection(mostDetailed)}
        {renderSection(topCategories)}
      </div>

      {/* 🔀 Carta vs Caja — only shown if Toteat data exists */}
      {cross && cross.summary?.totalSales > 0 && (
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
                  <InfoTip text="Platos mapeados a Toteat con interés real (al menos 3 aperturas del modal) pero baja conversión: 0 ventas o conversión ≤ 15%. Ejemplo: 'Gran Flor: 0 ventas de 6 aperturas, 0% conv' significa que 6 clientes lo abrieron en QC y nadie lo pidió. Ojo: las ventas Toteat incluyen pedidos por garzón sin escaneo de QR." />
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
                      {p.avgDetailMs > 0 && ` · ${Math.round(p.avgDetailMs / 1000)}s en detalle`}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {cross.insights.estrellas.length > 0 && (
              <div style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, padding: "12px 14px" }}>
                <p style={{ fontFamily: F, fontSize: "0.74rem", fontWeight: 700, color: "#16a34a", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>🎯 Estrellas</span>
                  <InfoTip text="Platos que la gente abre y termina comprando. Top 5 ordenados por conversión (ventas / aperturas), con al menos 3 aperturas y 2 ventas. Ejemplo: 'Champi furai: 9 ventas de 3 aperturas, 300% conv' significa que se vendieron 9 unidades pero solo 3 personas lo abrieron en QC — el resto pidió por garzón. Conversión > 100% es normal cuando hay pedidos al mozo." />
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
                <InfoTip text="Productos vendidos en Toteat que no tienen mapeo a un plato QC ni vía modificadores. Suelen ser combos, salsas, extras, costos de delivery o productos del menú físico que no están en el digital. El número '×N' es la cantidad vendida en el período." />
              </p>
              <p style={{ fontFamily: FB, fontSize: "0.68rem", color: "var(--adm-text3)", margin: "0 0 8px" }}>Productos vendidos en Toteat sin mapeo. Probable: combos, salsas, extras o sin mapear.</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(showAllOrphans ? cross.orphans : cross.orphans.slice(0, 20)).map((o: any) => (
                  <span key={o.toteatId} style={{ background: "var(--adm-input)", color: "var(--adm-text2)", fontSize: "0.7rem", padding: "3px 8px", borderRadius: 6, fontFamily: FB }}>
                    {o.name} <span style={{ color: "var(--adm-text3)", marginLeft: 4 }}>×{o.sales}</span>
                  </span>
                ))}
                {cross.orphans.length > 20 && (
                  <button
                    onClick={() => setShowAllOrphans(v => !v)}
                    style={{ background: "transparent", border: "1px dashed var(--adm-card-border)", color: "#F4A623", fontSize: "0.7rem", padding: "3px 10px", borderRadius: 6, fontFamily: FB, fontWeight: 600, cursor: "pointer" }}
                  >
                    {showAllOrphans ? "Ver menos" : `+${cross.orphans.length - 20} más`}
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
                <InfoTip text="Platos con al menos 3 aperturas en QC que no están mapeados a un producto Toteat (ni directo, ni vía modificadores). Ejemplo: 'Limonada Artesanal: 6 aperturas' aparece acá si nadie de sus modificadores tiene código Toteat. No podemos saber si vendieron o no — andá a /panel/menus → Toteat para mapearlos." />
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
                      {Math.round(p.avgDetailMs / 1000)}s en detalle
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
                      { key: "opens", label: "Aperturas", align: "right" as const, tooltip: "Veces que alguien tocó el plato y abrió su detalle" },
                      { key: "avgDetailMs", label: "T. detalle", align: "right" as const, tooltip: "Segundos promedio dentro del detalle del plato" },
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
  const deviceLabels: Record<string, { label: string; icon: string }> = {
    mobile: { label: "Móvil", icon: "📱" },
    tablet: { label: "Tablet", icon: "📲" },
    desktop: { label: "Desktop", icon: "🖥️" },
    unknown: { label: "Otro", icon: "❔" },
  };

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

      {/* Cómo llegan */}
      {clientes?.acquisition && clientes.totalSessions > 0 && (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 18px", boxShadow: "var(--adm-card-shadow, none)" }}>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 14px", fontWeight: 600 }}>🚪 Cómo llegan</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <p style={{ fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text3)", margin: "0 0 8px", fontWeight: 600 }}>Origen</p>
              {[
                { label: "📷 QR escaneado", count: clientes.acquisition.qrScans, pct: clientes.acquisition.qrPct, color: "var(--adm-accent)" },
                { label: "🔗 Link directo", count: clientes.acquisition.direct, pct: clientes.acquisition.directPct, color: "#7fbfdc" },
              ].map((row) => (
                <div key={row.label} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text)" }}>{row.label}</span>
                    <span style={{ fontFamily: F, fontSize: "0.72rem", color: row.color, fontWeight: 600 }}>{row.count} ({row.pct}%)</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: "var(--adm-card-border)" }}>
                    <div style={{ height: "100%", width: `${row.pct}%`, borderRadius: 3, background: row.color, transition: "width 0.4s ease" }} />
                  </div>
                </div>
              ))}
            </div>
            <div>
              <p style={{ fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text3)", margin: "0 0 8px", fontWeight: 600 }}>Dispositivo</p>
              {clientes.acquisition.devices.length === 0 ? (
                <p style={{ fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text3)" }}>Sin datos</p>
              ) : (
                clientes.acquisition.devices.map((d: any) => {
                  const meta = deviceLabels[d.name] || deviceLabels.unknown;
                  const totalDev = clientes.acquisition.devices.reduce((s: number, x: any) => s + x.count, 0);
                  const pct = totalDev > 0 ? Math.round((d.count / totalDev) * 100) : 0;
                  return (
                    <div key={d.name} style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <span style={{ fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text)" }}>{meta.icon} {meta.label}</span>
                        <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", fontWeight: 600 }}>{d.count} ({pct}%)</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 3, background: "var(--adm-card-border)" }}>
                        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 3, background: "var(--adm-accent)", opacity: 0.65, transition: "width 0.4s ease" }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Perfil dietético */}
      {clientes?.dietProfile && (clientes.dietProfile.totalDietGuests > 0 || clientes.dietProfile.restrictions.length > 0) && (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 18px", boxShadow: "var(--adm-card-shadow, none)" }}>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 14px", fontWeight: 600 }}>🥗 Perfil dietético de tus clientes</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
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
                      <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text)", flex: 1, textTransform: "capitalize" }}>{r.name}</span>
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }} className="adm-grid-2">
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="adm-grid-2">
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
    fetch(`/api/admin/analytics?${p}`).then(r => r.json()).then(d => setData(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoading(false));
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
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    setPage(1);
    const p = new URLSearchParams({ from, to, page: "1" });
    if (rid) p.set("restaurantId", rid);
    fetch(`/api/admin/sessions?${p}`).then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [rid, from, to]);

  const loadPage = (pg: number) => {
    setLoading(true);
    setPage(pg);
    const p = new URLSearchParams({ from, to, page: String(pg) });
    if (rid) p.set("restaurantId", rid);
    fetch(`/api/admin/sessions?${p}`).then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  };

  if (loading) return <SkeletonLoading type="list" />;
  if (!data?.sessions?.length) return <p style={{ color: "var(--adm-text2)", fontFamily: F, textAlign: "center", padding: 40 }}>Sin sesiones en este período</p>;

  const toggle = (id: string) => setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const fmtTime = (d: string) => { const t = new Date(d); return `${t.getHours().toString().padStart(2, "0")}:${t.getMinutes().toString().padStart(2, "0")}`; };
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("es-CL", { day: "numeric", month: "short" });
  const viewLabels: Record<string, string> = { premium: "Galería", lista: "Lista", feed: "Feed", viaje: "Espacial" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "0 0 4px" }}>
        {data.total} sesión{data.total !== 1 ? "es" : ""} · Página {data.page} de {data.totalPages}
      </p>
      {data.sessions.map((s: any) => {
        const isOpen = expanded.has(s.id);
        const dishes = s.dishesViewed || [];
        const duration = s.durationMs ? formatDuration(s.durationMs) : "—";
        const userName = s.qrUser?.name || (s.guest?.visitCount > 1 ? `Visitante recurrente (${s.guest.visitCount}x)` : "Visitante nuevo");

        return (
          <div key={s.id} style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, overflow: "hidden", boxShadow: "var(--adm-card-shadow, none)" }}>
            <div onClick={() => toggle(s.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", cursor: "pointer" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 600, color: "var(--adm-text)" }}>{userName}</span>
                  {s.qrUser?.email && <span style={{ fontFamily: FB, fontSize: "0.68rem", color: "var(--adm-text3)" }}>{s.qrUser.email}</span>}
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)" }}>{fmtDate(s.startedAt)} {fmtTime(s.startedAt)}</span>
                  <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-accent)", fontWeight: 600 }}>{duration}</span>
                  <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)" }}>{dishes.length} plato{dishes.length !== 1 ? "s" : ""}</span>
                  {s.viewUsed && <span style={{ fontFamily: F, fontSize: "0.65rem", padding: "1px 6px", borderRadius: 4, background: "var(--adm-hover)", color: "var(--adm-text2)" }}>{viewLabels[s.viewUsed] || s.viewUsed}</span>}
                  {s.usedGenio && <span style={{ fontSize: "0.65rem", padding: "1px 6px", borderRadius: 4, background: "rgba(244,166,35,0.15)", color: "#F4A623" }}>🧞 Genio</span>}
                  {s.waiterCalls?.length > 0 && <span style={{ fontSize: "0.65rem", padding: "1px 6px", borderRadius: 4, background: "rgba(127,191,220,0.15)", color: "#7fbfdc" }}>🔔 Garzón</span>}
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

                {/* Genio data */}
                {s.genioData && (
                  <div style={{ marginTop: 12 }}>
                    <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "0 0 4px", fontWeight: 600 }}>🧞 Genio</p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {s.genioData.completed
                        ? <span style={{ fontFamily: FB, fontSize: "0.72rem", padding: "2px 8px", borderRadius: 6, background: "rgba(74,222,128,0.1)", color: "#4ade80" }}>Completado</span>
                        : <span style={{ fontFamily: FB, fontSize: "0.72rem", padding: "2px 8px", borderRadius: 6, background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>Abandonó{s.genioData.lastStep ? ` en ${s.genioData.lastStep}` : ""}</span>
                      }
                      {s.genioData.timesUsed > 1 && <span style={{ fontFamily: FB, fontSize: "0.72rem", padding: "2px 8px", borderRadius: 6, background: "var(--adm-hover)", color: "var(--adm-text2)" }}>{s.genioData.timesUsed}x abierto</span>}
                      {s.genioData.birthdayModalAutoShown && <span style={{ fontFamily: FB, fontSize: "0.72rem", padding: "2px 8px", borderRadius: 6, background: "rgba(167,139,250,0.1)", color: "#a78bfa" }}>🎂 Modal auto</span>}
                      {s.genioData.birthdaySaved && <span style={{ fontFamily: FB, fontSize: "0.72rem", padding: "2px 8px", borderRadius: 6, background: "rgba(74,222,128,0.1)", color: "#4ade80" }}>🎂 Cumple guardado</span>}
                      {s.genioData.birthdayClicked && !s.genioData.birthdaySaved && <span style={{ fontFamily: FB, fontSize: "0.72rem", padding: "2px 8px", borderRadius: 6, background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>🎂 Abrió banner</span>}
                    </div>
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

type DatePreset = "hoy" | "ayer" | "semana" | "custom";

function getDateRange(preset: DatePreset, customFrom?: string, customTo?: string): { from: string; to: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  if (preset === "hoy") return { from: fmt(today), to: fmt(today) };
  if (preset === "ayer") { const y = new Date(today); y.setDate(y.getDate() - 1); return { from: fmt(y), to: fmt(y) }; }
  if (preset === "semana") { const w = new Date(today); w.setDate(w.getDate() - 7); return { from: fmt(w), to: fmt(today) }; }
  return { from: customFrom || fmt(new Date(today.getTime() - 28 * 86400000)), to: customTo || fmt(today) };
}

export default function AnalyticsDashboard() {
  const { restaurants, isSuper, selectedRestaurantId } = useAdminSession();
  const { activePlan } = usePanelSession();
  const hasAdvanced = isSuper || canAccess(activePlan, "stats_advanced");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Read state from URL params
  const restaurantId = searchParams.get("restaurantId") || "";
  const tab = (searchParams.get("tab") as Tab) || "resumen";
  const datePreset = (searchParams.get("preset") as DatePreset) || "semana";
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
          {(["hoy", "ayer", "semana"] as DatePreset[]).map(p => (
            <button key={p} onClick={() => setDatePreset(p)} style={{
              padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
              fontFamily: F, fontSize: "0.75rem", fontWeight: 600,
              background: datePreset === p ? "var(--adm-accent)" : "var(--adm-hover)",
              color: datePreset === p ? "#fff" : "var(--adm-text3)",
            }}>
              {p === "hoy" ? "Hoy" : p === "ayer" ? "Ayer" : "Esta semana"}
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
      <div style={{ display: "flex", gap: 4, marginBottom: 20, overflowX: "auto", scrollbarWidth: "none" }}>
        {allTabs.map(t => {
          const isAdvancedTab = TABS_ADVANCED.some(a => a.key === t.key);
          const locked = isAdvancedTab && !hasAdvanced;
          return (
            <button key={t.key} onClick={() => { if (locked) { setShowUpgradeModal(true); } else { setTab(t.key); } }} style={{
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
            onClick={() => setShowUpgradeModal(true)}
            style={{ padding: "10px 24px", background: "#7c3aed", color: "#fff", borderRadius: 999, border: "none", fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(124,58,237,0.3)" }}
          >
            Pasarme a Premium →
          </button>
        </div>
      )}

      {showUpgradeModal && (
        <PlanUpgradeModal initialTab="PREMIUM" onClose={() => setShowUpgradeModal(false)} />
      )}
    </div>
  );
}
