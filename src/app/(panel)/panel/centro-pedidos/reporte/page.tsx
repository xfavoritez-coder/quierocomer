"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, BarChart3, Calendar, ChevronLeft, ChevronRight, TrendingUp, Bike, Receipt, ShoppingBag } from "lucide-react";
import { useSessionContext } from "@/lib/admin/SessionContext";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#F4A623";
const GREEN = "#22c55e", BLUE = "#3b82f6", PURPLE = "#7c3aed";

const clp = (n: number) => "$" + Math.round(n || 0).toLocaleString("es-CL");

function chileTodayLocal(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

interface HourBucket { hour: number; sales: number; orders: number }
interface Channel { name: string; sales: number; orders: number }
interface ProductRank { name: string; qty: number; revenue: number }
interface TypeBucket { type: string; label: string; sales: number; orders: number }
interface MonthlyDay { day: number; sales: number; orders: number }
interface Report {
  ordersCount: number;
  productSales: number;
  deliveryTotal: number;
  tipsTotal: number;
  grossTotal: number;
  hourly: HourBucket[];
  channels: Channel[];
  products: ProductRank[];
  byType: TypeBucket[];
  monthly: { month: string; days: MonthlyDay[] };
}

export default function ReportePage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState<string>(() => chileTodayLocal());
  const [toDate, setToDate] = useState<string>(() => chileTodayLocal());

  const fetchReport = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/panel/ecommerce/pos-orders/report?restaurantId=${restaurantId}&from=${fromDate}&to=${toDate}`);
      const d = await r.json();
      if (r.ok) setData(d);
    } catch { /* noop */ }
    setLoading(false);
  }, [restaurantId, fromDate, toDate]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const today = chileTodayLocal();
  const singleDay = fromDate === toDate;
  const shiftBoth = (days: number) => { setFromDate((f) => addDaysYmd(f, days)); setToDate((t) => addDaysYmd(t, days)); };

  const dateInput: React.CSSProperties = { fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text)", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 8, padding: "6px 8px", cursor: "pointer" };
  const navBtn: React.CSSProperties = { width: 32, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "1px solid var(--adm-card-border)", background: "var(--adm-card)", color: "var(--adm-text2)", cursor: "pointer" };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "8px 4px 60px" }}>
      <Link href="/panel/centro-pedidos" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", textDecoration: "none", marginBottom: 16 }}>
        <ArrowLeft size={15} /> Centro de pedidos
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: `${ACCENT}1a`, display: "flex", alignItems: "center", justifyContent: "center" }}><BarChart3 size={20} color={ACCENT} /></div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <h1 style={{ fontFamily: F, fontSize: "1.3rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Reporte</h1>
          <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>Ventas del período seleccionado y su distribución por hora.</p>
        </div>
        <button onClick={() => fetchReport()} title="Refrescar" style={{ width: 38, height: 38, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text2)", cursor: "pointer" }}><RefreshCw size={16} /></button>
      </div>

      {/* Barra de fechas */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <Calendar size={15} style={{ color: "var(--adm-text3)" }} />
        {singleDay && <button onClick={() => shiftBoth(-1)} title="Día anterior" style={navBtn}><ChevronLeft size={16} /></button>}
        <input type="date" value={fromDate} max={toDate} onChange={(e) => { const v = e.target.value || today; setFromDate(v); if (v > toDate) setToDate(v); }} style={dateInput} />
        <span style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text3)" }}>→</span>
        <input type="date" value={toDate} min={fromDate} onChange={(e) => { const v = e.target.value || today; setToDate(v); if (v < fromDate) setFromDate(v); }} style={dateInput} />
        {singleDay && <button onClick={() => shiftBoth(1)} disabled={fromDate >= today} title="Día siguiente" style={{ ...navBtn, opacity: fromDate >= today ? 0.4 : 1, cursor: fromDate >= today ? "default" : "pointer" }}><ChevronRight size={16} /></button>}
        {(fromDate !== today || toDate !== today) && (
          <button onClick={() => { setFromDate(today); setToDate(today); }} style={{ fontFamily: F, fontSize: "0.74rem", fontWeight: 700, color: ACCENT, background: `${ACCENT}14`, border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}>Hoy</button>
        )}
      </div>

      {loading ? (
        <p style={{ fontFamily: FB, color: "var(--adm-text3)", padding: 40, textAlign: "center" }}>Cargando reporte…</p>
      ) : !data ? (
        <p style={{ fontFamily: FB, color: "var(--adm-text3)", padding: 40, textAlign: "center" }}>No se pudo cargar el reporte.</p>
      ) : (
        <>
          {/* Venta por día del mes en curso */}
          <MonthlyChart monthly={data.monthly} />

          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14, marginBottom: 18 }}>
            <BigStat
              label={singleDay ? "Venta del día" : "Venta del período"}
              value={clp(data.productSales)}
              hint="Productos con IVA (sin delivery ni propinas)"
              icon={<TrendingUp size={18} color={GREEN} />}
              color={GREEN}
              big
            />
            <BigStat label="Ticket promedio" value={clp(data.ordersCount > 0 ? data.productSales / data.ordersCount : 0)} hint="Venta de productos por pedido" icon={<Receipt size={18} color="#0ea5e9" />} color="#0ea5e9" />
            <BigStat label="Delivery" value={clp(data.deliveryTotal)} hint="Total cobrado por envíos" icon={<Bike size={18} color={BLUE} />} color={BLUE} />
            <BigStat label="Propinas" value={clp(data.tipsTotal)} hint="Total de propinas" icon={<Receipt size={18} color={PURPLE} />} color={PURPLE} />
            <BigStat label="Pedidos" value={data.ordersCount.toLocaleString("es-CL")} hint="Cantidad de pedidos" icon={<ShoppingBag size={18} color={ACCENT} />} color={ACCENT} />
          </div>

          {/* Venta por canal + Por tipo de pedido (misma fila) */}
          <div style={{ display: "flex", gap: 14, marginBottom: 18, flexWrap: "wrap", alignItems: "stretch" }}>
            <div style={{ flex: "2 1 340px", minWidth: 0 }}>
              <ChannelBreakdown channels={data.channels} total={data.productSales} />
            </div>
            <div style={{ flex: "1 1 280px", minWidth: 0 }}>
              <OrderTypePie byType={data.byType} />
            </div>
          </div>

          {/* Gráfico venta por hora */}
          <HourlyChart hourly={data.hourly} />

          {/* Ranking de productos vendidos */}
          <ProductRanking products={data.products} />
        </>
      )}
    </div>
  );
}

function BigStat({ label, value, hint, icon, color, big }: { label: string; value: string; hint?: string; icon: React.ReactNode; color: string; big?: boolean }) {
  return (
    <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: 16, borderTop: `3px solid ${color}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ width: 30, height: 30, borderRadius: 9, background: `${color}1a`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
        <span style={{ fontFamily: F, fontSize: "0.8rem", fontWeight: 700, color: "var(--adm-text2)" }}>{label}</span>
      </div>
      <div style={{ fontFamily: F, fontSize: big ? "1.9rem" : "1.5rem", fontWeight: 900, color: "var(--adm-text)", lineHeight: 1.1 }}>{value}</div>
      {hint && <div style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function ProductRanking({ products }: { products: ProductRank[] }) {
  const maxQty = Math.max(1, ...products.map((p) => p.qty));
  return (
    <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "16px 16px 14px", marginTop: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Productos vendidos</h2>
        <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)" }}>{products.length} · por cantidad</span>
      </div>
      {products.length === 0 ? (
        <p style={{ fontFamily: FB, color: "var(--adm-text3)", textAlign: "center", padding: "20px 0" }}>Sin productos vendidos en el período seleccionado.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {products.map((p, i) => {
            const pct = Math.max(4, Math.round((p.qty / maxQty) * 100));
            return (
              <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 7, background: i < 3 ? `${ACCENT}22` : "var(--adm-hover)", color: i < 3 ? ACCENT : "var(--adm-text3)", fontFamily: F, fontSize: "0.72rem", fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 3 }}>
                    <span style={{ minWidth: 0, fontFamily: F, fontSize: "0.84rem", fontWeight: 700, color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                    <span style={{ flexShrink: 0, fontFamily: F, fontSize: "0.84rem", fontWeight: 800, color: "var(--adm-text)" }}>{p.qty}<span style={{ fontFamily: FB, fontSize: "0.7rem", fontWeight: 600, color: "var(--adm-text3)" }}> u.{p.revenue > 0 ? ` · ${clp(p.revenue)}` : ""}</span></span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: "var(--adm-hover)", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: ACCENT, borderRadius: 999, transition: "width .3s" }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChannelBreakdown({ channels, total }: { channels: Channel[]; total: number }) {
  const palette = [ACCENT, GREEN, BLUE, PURPLE, "#ef4444", "#0ea5e9", "#ec4899", "#14b8a6"];
  return (
    <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "16px 16px 14px", height: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Venta por canal</h2>
        <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)" }}>Productos con IVA</span>
      </div>
      {channels.length === 0 ? (
        <p style={{ fontFamily: FB, color: "var(--adm-text3)", textAlign: "center", padding: "20px 0" }}>Sin ventas en el período seleccionado.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {channels.map((c, i) => {
            const pct = total > 0 ? Math.round((c.sales / total) * 100) : 0;
            const color = palette[i % palette.length];
            return (
              <div key={c.name}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7, minWidth: 0, fontFamily: F, fontSize: "0.84rem", fontWeight: 700, color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
                    {c.name}
                    <span style={{ fontFamily: FB, fontSize: "0.72rem", fontWeight: 600, color: "var(--adm-text3)" }}>· {c.orders} pedido{c.orders === 1 ? "" : "s"}</span>
                  </span>
                  <span style={{ flexShrink: 0, textAlign: "right", lineHeight: 1.25 }}>
                    <span style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 800, color: "var(--adm-text)" }}>{clp(c.sales)} <span style={{ fontFamily: FB, fontSize: "0.72rem", fontWeight: 600, color: "var(--adm-text3)" }}>({pct}%)</span></span>
                    <span style={{ display: "block", fontFamily: FB, fontSize: "0.7rem", fontWeight: 600, color: "var(--adm-text3)" }}>Ticket prom. {clp(c.orders > 0 ? c.sales / c.orders : 0)}</span>
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: "var(--adm-hover)", overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 999, transition: "width .3s" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OrderTypePie({ byType }: { byType: TypeBucket[] }) {
  const slices = (byType ?? []).filter((t) => t.sales > 0);
  const total = slices.reduce((s, t) => s + t.sales, 0);
  const colors: Record<string, string> = { delivery: BLUE, pickup: GREEN, "dine-in": PURPLE };
  const r = 42, cx = 50, cy = 50, C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "16px 16px 14px", height: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Por tipo de pedido</h2>
        <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)" }}>Productos con IVA</span>
      </div>
      {total === 0 ? (
        <p style={{ fontFamily: FB, color: "var(--adm-text3)", textAlign: "center", padding: "20px 0" }}>Sin ventas en el período seleccionado.</p>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <svg viewBox="0 0 100 100" width={116} height={116} style={{ flexShrink: 0, transform: "rotate(-90deg)" }}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--adm-hover)" strokeWidth={15} />
            {slices.map((t) => {
              const frac = t.sales / total;
              const dash = frac * C;
              const el = <circle key={t.type} cx={cx} cy={cy} r={r} fill="none" stroke={colors[t.type] || ACCENT} strokeWidth={15} strokeLinecap="butt" strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-acc * C} />;
              acc += frac;
              return el;
            })}
          </svg>
          <div style={{ flex: 1, minWidth: 150, display: "flex", flexDirection: "column", gap: 11 }}>
            {slices.map((t) => {
              const pct = Math.round((t.sales / total) * 100);
              return (
                <div key={t.type} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: F, fontSize: "0.84rem", fontWeight: 700, color: "var(--adm-text)" }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: colors[t.type] || ACCENT, flexShrink: 0 }} />
                    {t.label}
                    <span style={{ fontFamily: FB, fontSize: "0.72rem", fontWeight: 600, color: "var(--adm-text3)" }}>· {t.orders}</span>
                  </span>
                  <span style={{ flexShrink: 0, textAlign: "right" }}>
                    <span style={{ fontFamily: F, fontSize: "0.86rem", fontWeight: 800, color: "var(--adm-text)" }}>{clp(t.sales)} <span style={{ fontFamily: FB, fontSize: "0.7rem", fontWeight: 600, color: "var(--adm-text3)" }}>({pct}%)</span></span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function clpShort(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${Math.round(n)}`;
}

function MonthlyChart({ monthly }: { monthly: { month: string; days: MonthlyDay[] } }) {
  const days = monthly?.days ?? [];
  const hasData = days.some((d) => d.sales > 0);
  const max = Math.max(1, ...days.map((d) => d.sales));
  const totalSales = days.reduce((s, d) => s + d.sales, 0);
  const totalOrders = days.reduce((s, d) => s + d.orders, 0);
  const avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0;
  const monthName = (() => {
    try { return new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric", timeZone: "America/Santiago" }).format(new Date(`${monthly?.month}-15T12:00:00Z`)); } catch { return monthly?.month ?? ""; }
  })();
  return (
    <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "16px 16px 10px", marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6, gap: 8, flexWrap: "wrap" }}>
        <h2 style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 800, color: "var(--adm-text)", margin: 0, textTransform: "capitalize" }}>Venta por día · {monthName}</h2>
        <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)" }}>Mes en curso · Productos con IVA</span>
      </div>
      {/* Resumen del mes */}
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 14 }}>
        <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)" }}>Total: <strong style={{ fontFamily: F, color: "var(--adm-text)" }}>{clp(totalSales)}</strong></span>
        <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)" }}>Pedidos: <strong style={{ fontFamily: F, color: "var(--adm-text)" }}>{totalOrders.toLocaleString("es-CL")}</strong></span>
        <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)" }}>Ticket prom.: <strong style={{ fontFamily: F, color: "var(--adm-text)" }}>{clp(avgTicket)}</strong></span>
      </div>
      {!hasData ? (
        <p style={{ fontFamily: FB, color: "var(--adm-text3)", textAlign: "center", padding: "26px 0" }}>Aún no hay ventas este mes.</p>
      ) : (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 210, overflowX: "auto", overflowY: "hidden", paddingTop: 20 }}>
          {days.map((d) => {
            const pct = d.sales > 0 ? Math.max(3, Math.round((d.sales / max) * 100)) : 0;
            const ticket = d.orders > 0 ? d.sales / d.orders : 0;
            return (
              <div key={d.day} style={{ flex: "1 0 26px", minWidth: 26, display: "flex", flexDirection: "column", alignItems: "center", height: "100%" }}
                title={d.sales > 0 ? `Día ${d.day} · ${clp(d.sales)} · ${d.orders} pedido${d.orders === 1 ? "" : "s"} · ticket ${clp(ticket)}` : `Día ${d.day} · sin ventas`}>
                <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                  <div style={{ position: "relative", width: "74%", maxWidth: 28, height: `${pct}%`, background: `linear-gradient(180deg, ${GREEN}, ${GREEN}bb)`, borderRadius: "5px 5px 0 0", minHeight: d.sales > 0 ? 3 : 0, transition: "height .3s" }}>
                    {d.sales > 0 && (
                      <span style={{ position: "absolute", bottom: "100%", marginBottom: 3, left: "50%", transform: "translateX(-50%)", fontFamily: FB, fontSize: "0.58rem", fontWeight: 700, color: "var(--adm-text2)", whiteSpace: "nowrap" }}>{clpShort(d.sales)}</span>
                    )}
                  </div>
                </div>
                <span style={{ fontFamily: FB, fontSize: "0.6rem", color: "var(--adm-text3)", marginTop: 4 }}>{d.day}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HourlyChart({ hourly }: { hourly: HourBucket[] }) {
  // Recorta el rango a las horas con actividad (con un poco de margen) para que
  // el gráfico no muestre 24 barras vacías.
  const active = hourly.filter((h) => h.sales > 0 || h.orders > 0);
  const hasData = active.length > 0;
  const minH = hasData ? Math.max(0, Math.min(...active.map((h) => h.hour)) - 1) : 0;
  const maxH = hasData ? Math.min(23, Math.max(...active.map((h) => h.hour)) + 1) : 23;
  const range = hourly.slice(minH, maxH + 1);
  const max = Math.max(1, ...range.map((h) => h.sales));

  const fmtHour = (h: number) => `${h.toString().padStart(2, "0")}h`;

  return (
    <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "16px 16px 10px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Venta por hora</h2>
        <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)" }}>Productos con IVA</span>
      </div>

      {!hasData ? (
        <p style={{ fontFamily: FB, color: "var(--adm-text3)", textAlign: "center", padding: "26px 0" }}>Sin ventas en el período seleccionado.</p>
      ) : (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 240, overflowX: "auto", overflowY: "hidden", paddingTop: 22 }}>
          {range.map((h) => {
            const pct = h.sales > 0 ? Math.max(3, Math.round((h.sales / max) * 100)) : 0;
            return (
              <div key={h.hour} style={{ flex: "1 0 40px", minWidth: 40, display: "flex", flexDirection: "column", alignItems: "center", height: "100%" }} title={`${fmtHour(h.hour)} · ${clp(h.sales)} · ${h.orders} pedido${h.orders === 1 ? "" : "s"}`}>
                <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                  <div style={{ position: "relative", width: "78%", maxWidth: 42, height: `${pct}%`, background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT}bb)`, borderRadius: "6px 6px 0 0", minHeight: h.sales > 0 ? 4 : 0, transition: "height .3s" }}>
                    {h.sales > 0 && (
                      <span style={{ position: "absolute", bottom: "100%", marginBottom: 3, left: "50%", transform: "translateX(-50%)", fontFamily: FB, fontSize: "0.62rem", fontWeight: 700, color: "var(--adm-text2)", whiteSpace: "nowrap" }}>{clp(h.sales)}</span>
                    )}
                  </div>
                </div>
                <span style={{ fontFamily: FB, fontSize: "0.64rem", color: "var(--adm-text3)", marginTop: 5 }}>{fmtHour(h.hour)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
