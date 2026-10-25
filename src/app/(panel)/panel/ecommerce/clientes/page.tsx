"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSessionContext } from "@/lib/admin/SessionContext";
import { Users, RefreshCw, Search, Phone, Repeat, TrendingUp, ShoppingBag } from "lucide-react";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#F4A623";
const GREEN = "#22c55e", BLUE = "#3b82f6", PURPLE = "#8b5cf6";

const clp = (n: number) => "$" + Math.round(n || 0).toLocaleString("es-CL");

interface Customer { name: string; phone: string; email: string | null; orders: number; totalSpent: number; avgTicket: number; firstOrder: string; lastOrder: string; manualOnly: boolean }
interface Summary { totalCustomers: number; recurring: number; recurringPct: number; avgOrdersPerCustomer: number; avgSpentPerCustomer: number; totalRevenue: number; totalOrders: number }

type SortKey = "totalSpent" | "orders" | "lastOrder";

export default function ClientesPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const [summary, setSummary] = useState<Summary | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("totalSpent");

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/panel/ecommerce/customers-report?restaurantId=${restaurantId}`);
      const d = await r.json();
      if (r.ok) { setSummary(d.summary); setCustomers(d.customers || []); }
    } catch { /* noop */ }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qd = q.replace(/\D/g, "");
    let list = customers;
    if (q) list = list.filter((c) => c.name.toLowerCase().includes(q) || (qd.length >= 3 && c.phone.replace(/\D/g, "").includes(qd)) || (c.email || "").toLowerCase().includes(q));
    return [...list].sort((a, b) => sort === "orders" ? b.orders - a.orders : sort === "lastOrder" ? (a.lastOrder < b.lastOrder ? 1 : -1) : b.totalSpent - a.totalSpent);
  }, [customers, query, sort]);

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "2-digit" });

  const sortBtn = (key: SortKey, label: string): React.CSSProperties => ({
    fontFamily: F, fontSize: "0.74rem", fontWeight: 700, padding: "6px 10px", borderRadius: 8, cursor: "pointer",
    border: "1px solid var(--adm-card-border)", background: sort === key ? ACCENT : "transparent", color: sort === key ? "#1a1a1a" : "var(--adm-text2)",
  });

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "8px 4px 60px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: `${ACCENT}1a`, display: "flex", alignItems: "center", justifyContent: "center" }}><Users size={20} color={ACCENT} /></div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <h1 style={{ fontFamily: F, fontSize: "1.3rem", fontWeight: 900, color: "var(--adm-text)", margin: 0 }}>Clientes</h1>
          <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>Tus clientes agrupados por teléfono: cuántos son, cuánto compran y quiénes vuelven.</p>
        </div>
        <button onClick={load} title="Refrescar" style={{ width: 38, height: 38, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text2)", cursor: "pointer" }}><RefreshCw size={16} /></button>
      </div>

      {loading ? (
        <p style={{ fontFamily: FB, color: "var(--adm-text3)", padding: 40, textAlign: "center" }}>Cargando clientes…</p>
      ) : !summary || customers.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 20px", border: "1px dashed var(--adm-card-border)", borderRadius: 14, fontFamily: FB, color: "var(--adm-text3)" }}>Aún no hay clientes con pedidos.</div>
      ) : (
        <>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 18 }}>
            <Stat label="Clientes" value={summary.totalCustomers.toLocaleString("es-CL")} hint={`${summary.totalOrders.toLocaleString("es-CL")} pedidos en total`} icon={<Users size={18} color={ACCENT} />} color={ACCENT} big />
            <Stat label="Recurrentes" value={`${summary.recurring.toLocaleString("es-CL")}`} hint={`${summary.recurringPct}% compró 2+ veces`} icon={<Repeat size={18} color={PURPLE} />} color={PURPLE} />
            <Stat label="Gasto por cliente" value={clp(summary.avgSpentPerCustomer)} hint={`${summary.avgOrdersPerCustomer} pedidos promedio`} icon={<TrendingUp size={18} color={GREEN} />} color={GREEN} />
            <Stat label="Pedidos por cliente" value={String(summary.avgOrdersPerCustomer)} hint="Frecuencia de compra" icon={<ShoppingBag size={18} color={BLUE} />} color={BLUE} />
          </div>

          {/* Controles */}
          <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
              <Search size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--adm-text3)" }} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre o teléfono…"
                style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px 9px 34px", borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "var(--adm-input, var(--adm-card))", color: "var(--adm-text)", fontFamily: FB, fontSize: "0.85rem", outline: "none" }} />
            </div>
            <span style={{ fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text3)" }}>Ordenar:</span>
            <button onClick={() => setSort("totalSpent")} style={sortBtn("totalSpent", "")}>Más gastan</button>
            <button onClick={() => setSort("orders")} style={sortBtn("orders", "")}>Más pedidos</button>
            <button onClick={() => setSort("lastOrder")} style={sortBtn("lastOrder", "")}>Más recientes</button>
          </div>

          {/* Tabla */}
          <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 70px 110px 100px 80px", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--adm-card-border)", fontFamily: F, fontSize: "0.68rem", fontWeight: 800, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              <span>#</span><span>Cliente</span><span style={{ textAlign: "right" }}>Pedidos</span><span style={{ textAlign: "right" }}>Total</span><span style={{ textAlign: "right" }}>Ticket</span><span style={{ textAlign: "right" }}>Último</span>
            </div>
            {shown.map((c, i) => (
              <div key={c.phone + c.name + i} style={{ display: "grid", gridTemplateColumns: "28px 1fr 70px 110px 100px 80px", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--adm-card-border)", alignItems: "center" }}>
                <span style={{ fontFamily: F, fontSize: "0.78rem", fontWeight: 800, color: i < 3 ? ACCENT : "var(--adm-text3)" }}>{i + 1}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 700, color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.name}{c.orders >= 2 && <span style={{ marginLeft: 6, fontFamily: FB, fontSize: "0.64rem", fontWeight: 800, color: PURPLE, background: `${PURPLE}1a`, borderRadius: 999, padding: "1px 7px" }}>recurrente</span>}
                  </div>
                  {c.phone && <a href={`tel:${c.phone}`} onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", textDecoration: "none" }}><Phone size={11} /> {c.phone}</a>}
                </div>
                <span style={{ textAlign: "right", fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-text)" }}>{c.orders}</span>
                <span style={{ textAlign: "right", fontFamily: F, fontSize: "0.82rem", fontWeight: 800, color: GREEN }}>{clp(c.totalSpent)}</span>
                <span style={{ textAlign: "right", fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)" }}>{clp(c.avgTicket)}</span>
                <span style={{ textAlign: "right", fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text3)" }}>{fmtDate(c.lastOrder)}</span>
              </div>
            ))}
            {shown.length === 0 && <div style={{ padding: 30, textAlign: "center", fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text3)" }}>Sin resultados para “{query}”.</div>}
          </div>
          <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "10px 2px 0" }}>Se agrupan los pedidos reales (no intentos de pago fallidos ni cancelados) por teléfono del cliente.</p>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, hint, icon, color, big }: { label: string; value: string; hint?: string; icon: React.ReactNode; color: string; big?: boolean }) {
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
