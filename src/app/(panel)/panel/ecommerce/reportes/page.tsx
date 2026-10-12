"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, TrendingUp, ShoppingBag, Receipt } from "lucide-react";
import { useSessionContext } from "@/lib/admin/SessionContext";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

interface DayPoint { ymd: string; day: number; total: number; count: number }
interface Product { name: string; qty: number; revenue: number }
interface Report {
  month: string; monthLabel: string; today: string;
  totalSales: number; orderCount: number; avgTicket: number;
  byDay: DayPoint[]; products: Product[];
  prev?: { month: string; monthLabel: string; totalSales: number; orderCount: number; avgTicket: number; throughDay: number; partial: boolean };
  deltas?: { sales: number | null; orders: number | null; ticket: number | null };
}

const fmt = (n: number) => `$${Math.round(n || 0).toLocaleString("es-CL")}`;

// Indicador de variación vs. mes anterior.
function Delta({ pct, prevLabel, partial }: { pct: number | null | undefined; prevLabel?: string; partial?: boolean }) {
  if (pct == null) return <small style={{ display: "block", marginTop: 7, fontFamily: F, fontSize: "0.68rem", fontWeight: 700, color: "var(--adm-text3)" }}>Sin dato comparable</small>;
  const up = pct >= 0;
  return (
    <small title={prevLabel} style={{ display: "block", marginTop: 7, fontFamily: F, fontSize: "0.72rem", fontWeight: 900, color: up ? "#16a34a" : "#ef4444", cursor: prevLabel ? "help" : undefined }}>
      {up ? "▲" : "▼"} {up ? "+" : ""}{pct}% <span style={{ color: "var(--adm-text3)", fontWeight: 700 }}>{partial ? "vs. mismo período mes anterior" : "vs. mes anterior"}</span>
    </small>
  );
}
function prevTip(prev: Report["prev"], valueStr: string): string | undefined {
  if (!prev) return undefined;
  const range = prev.partial ? ` (1–${prev.throughDay})` : "";
  return `${prev.monthLabel}${range}: ${valueStr}`;
}
const DIAS = ["D", "L", "M", "M", "J", "V", "S"];
function weekdayOf(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  return DIAS[d.getUTCDay()];
}
function addMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function ReportesPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const [month, setMonth] = useState<string>(() => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7));
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/panel/ecommerce/reports?restaurantId=${restaurantId}&month=${month}`);
      const d = await r.json();
      if (r.ok) setData(d);
    } catch { /* noop */ }
    setLoading(false);
  }, [restaurantId, month]);

  useEffect(() => { load(); }, [load]);

  const thisMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
  const isCurrent = month >= thisMonth;
  const maxDay = data ? Math.max(1, ...data.byDay.map((d) => d.total)) : 1;
  const maxProd = data && data.products.length ? Math.max(1, ...data.products.map((p) => p.qty)) : 1;

  const card: React.CSSProperties = { background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: 16, boxShadow: "var(--adm-card-shadow)" };
  const sectionTitle: React.CSSProperties = { fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 14px" };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 2px 40px" }}>
      {/* Encabezado */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 18px" }}>
        <Link href="/panel/ecommerce" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "var(--adm-card)", color: "var(--adm-text2)" }}><ArrowLeft size={18} /></Link>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.3rem", fontWeight: 900, color: "var(--adm-text)", margin: 0 }}>Reportes</h1>
          <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>Ventas y productos del mes</p>
        </div>
      </div>

      {/* Selector de mes */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <button onClick={() => setMonth((m) => addMonth(m, -1))} style={navBtn} aria-label="Mes anterior"><ChevronLeft size={18} /></button>
        <span style={{ fontFamily: F, fontSize: "1rem", fontWeight: 800, color: "var(--adm-text)", minWidth: 160, textAlign: "center", textTransform: "capitalize" }}>{data?.monthLabel || "…"}</span>
        <button onClick={() => setMonth((m) => addMonth(m, 1))} disabled={isCurrent} style={{ ...navBtn, opacity: isCurrent ? 0.4 : 1, cursor: isCurrent ? "default" : "pointer" }} aria-label="Mes siguiente"><ChevronRight size={18} /></button>
        {!isCurrent && <button onClick={() => setMonth(thisMonth)} style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${GOLD}`, background: GOLD, color: "#1a1a1a", fontFamily: F, fontSize: "0.8rem", fontWeight: 800, cursor: "pointer" }}>Este mes</button>}
      </div>

      {loading && !data ? (
        <div style={{ ...card, textAlign: "center", color: "var(--adm-text3)", fontFamily: FB, padding: "40px 20px" }}>Cargando…</div>
      ) : !data ? (
        <div style={{ ...card, textAlign: "center", color: "var(--adm-text3)", fontFamily: FB, padding: "40px 20px" }}>No se pudo cargar el reporte.</div>
      ) : (
        <>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 20 }}>
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <strong style={{ fontFamily: F, fontSize: "1.5rem", fontWeight: 900, letterSpacing: "-0.04em", color: "var(--adm-text)" }}>{fmt(data.totalSales)}</strong>
                <TrendingUp size={16} color={GOLD} />
              </div>
              <span style={{ fontFamily: F, fontSize: "0.8rem", color: "var(--adm-text2)", fontWeight: 700 }}>Venta del mes</span>
              <Delta pct={data.deltas?.sales} partial={data.prev?.partial} prevLabel={prevTip(data.prev, fmt(data.prev?.totalSales ?? 0))} />
            </div>
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <strong style={{ fontFamily: F, fontSize: "1.5rem", fontWeight: 900, letterSpacing: "-0.04em", color: "var(--adm-text)" }}>{data.orderCount}</strong>
                <ShoppingBag size={16} color="var(--adm-text3)" />
              </div>
              <span style={{ fontFamily: F, fontSize: "0.8rem", color: "var(--adm-text2)", fontWeight: 700 }}>Pedidos</span>
              <Delta pct={data.deltas?.orders} partial={data.prev?.partial} prevLabel={prevTip(data.prev, String(data.prev?.orderCount ?? 0))} />
            </div>
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <strong style={{ fontFamily: F, fontSize: "1.5rem", fontWeight: 900, letterSpacing: "-0.04em", color: "var(--adm-text)" }}>{fmt(data.avgTicket)}</strong>
                <Receipt size={16} color="var(--adm-text3)" />
              </div>
              <span style={{ fontFamily: F, fontSize: "0.8rem", color: "var(--adm-text2)", fontWeight: 700 }}>Ticket promedio</span>
              <Delta pct={data.deltas?.ticket} partial={data.prev?.partial} prevLabel={prevTip(data.prev, fmt(data.prev?.avgTicket ?? 0))} />
            </div>
          </div>

          {/* Venta por día */}
          <div style={{ ...card, marginBottom: 20 }}>
            <h3 style={sectionTitle}>Venta por día</h3>
            {data.totalSales === 0 ? (
              <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text3)", margin: 0 }}>Sin ventas este mes.</p>
            ) : (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 3, overflowX: "auto", paddingBottom: 2 }}>
                {data.byDay.map((d) => {
                  const h = d.total > 0 ? Math.max(4, Math.round((d.total / maxDay) * 120)) : 2;
                  const isToday = d.ymd === data.today;
                  return (
                    <div key={d.ymd} title={`${d.day} · ${fmt(d.total)} · ${d.count} pedido${d.count !== 1 ? "s" : ""}`} style={{ flex: "1 0 20px", minWidth: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      {/* Monto exacto sobre la barra (vertical para que quepa) */}
                      <div style={{ height: 54, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                        {d.total > 0 && <span style={{ fontFamily: FB, fontSize: "0.56rem", fontWeight: 800, color: isToday ? "#16a34a" : "var(--adm-text2)", writingMode: "vertical-rl", transform: "rotate(180deg)", whiteSpace: "nowrap", lineHeight: 1 }}>{fmt(d.total)}</span>}
                      </div>
                      <div style={{ width: "100%", height: 120, display: "flex", alignItems: "flex-end" }}>
                        <div style={{ width: "100%", height: h, background: d.total > 0 ? (isToday ? "#16a34a" : GOLD) : "var(--adm-hover)", borderRadius: "4px 4px 0 0" }} />
                      </div>
                      <span style={{ fontFamily: FB, fontSize: "0.58rem", fontWeight: d.total > 0 ? 700 : 400, color: "var(--adm-text3)", lineHeight: 1 }}>{d.day}</span>
                      <span style={{ fontFamily: FB, fontSize: "0.52rem", color: "var(--adm-text3)", lineHeight: 1, opacity: 0.7 }}>{weekdayOf(d.ymd)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Ranking de productos vendidos */}
          <div style={card}>
            <h3 style={sectionTitle}>Ranking de productos vendidos</h3>
            {data.products.length === 0 ? (
              <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text3)", margin: 0 }}>Sin productos vendidos este mes.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {data.products.map((p, i) => (
                  <div key={p.name} style={{ display: "grid", gridTemplateColumns: "26px 1fr auto", alignItems: "center", gap: 12 }}>
                    <div style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 900, color: i < 3 ? GOLD : "var(--adm-text3)", textAlign: "right" }}>{i + 1}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
                        <span style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 800, color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                        <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)", whiteSpace: "nowrap", flexShrink: 0 }}>{fmt(p.revenue)}</span>
                      </div>
                      <div style={{ height: 6, background: "var(--adm-hover)", borderRadius: 999, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(p.qty / maxProd) * 100}%`, background: GOLD, borderRadius: 999 }} />
                      </div>
                    </div>
                    <div style={{ fontFamily: F, fontSize: "0.92rem", fontWeight: 900, color: "var(--adm-text)", textAlign: "right", minWidth: 44 }}>{p.qty}<span style={{ fontSize: "0.68rem", color: "var(--adm-text3)", fontWeight: 700 }}> u.</span></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const navBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "var(--adm-card)", color: "var(--adm-text2)", cursor: "pointer" };
