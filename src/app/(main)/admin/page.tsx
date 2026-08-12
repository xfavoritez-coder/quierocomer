"use client";
import { useState, useEffect, useCallback } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";

const F = "var(--font-display)";
const GOLD = "#F4A623";
const PERIODS = [
  { key: "today", label: "Hoy" },
  { key: "yesterday", label: "Ayer" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
  { key: "custom", label: "Rango" },
] as const;

interface LangUsageRow {
  name: string; total: number; es: number; en: number; pt: number;
  enPct: number; ptPct: number; foreignPct: number;
}

interface DashData {
  period: string; from: string; to: string;
  totalSessions: number; uniqueGuests: number; registeredGuests: number;
  conversionRate: number; avgDurationSec: number; birthdaysSaved: number;
  topDishesViewed: { name: string; photo: string | null; count: number }[];
  viewDistribution: Record<string, number>;
  deviceDistribution: Record<string, number>;
  dietDistribution: { type: string; count: number }[];
  restrictionsList: { name: string; count: number }[];
  genio: { starts: number; dietMarked: number; completed: number; completionRate: number; dietRate: number };
  restaurantRanking: { name: string; uniqueGuests: number }[];
  birthdaysByRestaurant: { name: string; count: number }[];
  langUsageByRestaurant?: LangUsageRow[];
}

interface BillingRow {
  id: string; name: string; plan: string; subscriptionStatus: string;
  currentPeriodEnd: string | null; lastPaymentAt: string | null; trialEndsAt: string | null;
  billingExempt: boolean; daysLeft: number | null; netAmount: number; grossAmount: number; method: string;
}

interface BillingData {
  restaurants: BillingRow[];
  totalMonthlyRevenue: number;
}

const card: React.CSSProperties = {
  background: "var(--adm-card)", border: "1px solid var(--adm-card-border)",
  borderRadius: 16, padding: "20px 22px",
};

const sectionTitle: React.CSSProperties = {
  fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text3)",
  textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, margin: "0 0 16px",
};

function fmtDuration(sec: number) {
  if (!sec) return "—";
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
}

function fmtMoney(n: number) {
  return `$${n.toLocaleString("es-CL")}`;
}

function StatCard({ label, value, sub, accent, icon }: { label: string; value: string | number; sub?: string; accent?: string; icon?: string }) {
  return (
    <div style={{ ...card, display: "flex", flexDirection: "column", gap: 4 }}>
      {icon && <span style={{ fontSize: "1.3rem", marginBottom: 2 }}>{icon}</span>}
      <p style={{ fontFamily: F, fontSize: "1.9rem", fontWeight: 800, color: accent || "var(--adm-text)", margin: 0, lineHeight: 1 }}>{value}</p>
      <p style={{ fontFamily: F, fontSize: "0.76rem", color: "var(--adm-text2)", margin: 0 }}>{label}</p>
      {sub && <p style={{ fontFamily: F, fontSize: "0.66rem", color: "var(--adm-text3)", margin: 0 }}>{sub}</p>}
    </div>
  );
}

function BarList({ items }: { items: { label: string; value: number; sub?: string }[] }) {
  const max = items[0]?.value || 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map((item, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "75%" }}>{item.label}</span>
            <span style={{ fontFamily: F, fontSize: "0.82rem", color: GOLD, fontWeight: 700, flexShrink: 0 }}>{item.value}</span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: "var(--adm-card-border)", overflow: "hidden" }}>
            <div style={{ width: `${Math.min((item.value / max) * 100, 100)}%`, height: "100%", borderRadius: 3, background: i === 0 ? GOLD : `rgba(244,166,35,${Math.max(0.2, 0.7 - i * 0.06)})` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVE:    { label: "Activo",    color: "#4ade80", bg: "rgba(74,222,128,0.1)" },
  TRIALING:  { label: "Trial",     color: "#60a5fa", bg: "rgba(96,165,250,0.1)" },
  CANCELED:  { label: "Cancelado", color: "#f87171", bg: "rgba(248,113,113,0.1)" },
  PAST_DUE:  { label: "Vencido",   color: "#fb923c", bg: "rgba(251,146,60,0.1)" },
  UNPAID:    { label: "Sin pagar", color: "#fbbf24", bg: "rgba(251,191,36,0.1)" },
  NONE:      { label: "Sin plan",  color: "#888",    bg: "rgba(136,136,136,0.1)" },
};

const PLAN_COLOR: Record<string, string> = {
  PREMIUM: "#a855f7", GOLD: "#F4A623", SILVER: "#94a3b8", FREE: "#888",
};

function BillingSection({ data }: { data: BillingData }) {
  const [tab, setTab] = useState<"activos" | "trial" | "vencidos" | "todos">("activos");

  const rows = data.restaurants.filter(r => {
    if (tab === "activos") return r.subscriptionStatus === "ACTIVE" && !r.billingExempt;
    if (tab === "trial")   return r.subscriptionStatus === "TRIALING";
    if (tab === "vencidos") return ["CANCELED", "PAST_DUE", "UNPAID"].includes(r.subscriptionStatus);
    return true;
  });

  const totalIva = Math.round(data.totalMonthlyRevenue * 0.19);
  const totalGross = data.totalMonthlyRevenue + totalIva;

  return (
    <div style={{ ...card, marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <h3 style={{ ...sectionTitle, margin: 0 }}>💳 Facturación</h3>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)" }}>Ingresos mensuales:</span>
          <span style={{ fontFamily: F, fontSize: "1rem", fontWeight: 800, color: "#4ade80" }}>{fmtMoney(data.totalMonthlyRevenue)}</span>
          <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)" }}>neto · {fmtMoney(totalGross)} c/IVA</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14, borderBottom: "1px solid var(--adm-card-border)", paddingBottom: 10 }}>
        {([["activos", "Activos"], ["trial", "En trial"], ["vencidos", "Vencidos"], ["todos", "Todos"]] as [typeof tab, string][]).map(([key, label]) => {
          const count = key === "todos" ? data.restaurants.length
            : key === "activos" ? data.restaurants.filter(r => r.subscriptionStatus === "ACTIVE" && !r.billingExempt).length
            : key === "trial" ? data.restaurants.filter(r => r.subscriptionStatus === "TRIALING").length
            : data.restaurants.filter(r => ["CANCELED","PAST_DUE","UNPAID"].includes(r.subscriptionStatus)).length;
          return (
            <button key={key} onClick={() => setTab(key)} style={{
              padding: "5px 12px", borderRadius: 8, border: tab === key ? `1px solid ${GOLD}` : "1px solid transparent",
              background: tab === key ? "rgba(244,166,35,0.1)" : "transparent",
              color: tab === key ? GOLD : "var(--adm-text3)", fontFamily: F, fontSize: "0.75rem", fontWeight: 600,
              cursor: "pointer",
            }}>
              {label} <span style={{ opacity: 0.7 }}>({count})</span>
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <p style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text3)", textAlign: "center", padding: "20px 0" }}>Sin registros</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem", fontFamily: F }}>
            <thead>
              <tr style={{ color: "var(--adm-text3)", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                <th style={{ textAlign: "left", padding: "0 8px 10px 0", fontWeight: 700 }}>Local</th>
                <th style={{ textAlign: "left", padding: "0 8px 10px", fontWeight: 700 }}>Plan</th>
                <th style={{ textAlign: "left", padding: "0 8px 10px", fontWeight: 700 }}>Estado</th>
                <th style={{ textAlign: "right", padding: "0 8px 10px", fontWeight: 700 }}>Monto</th>
                <th style={{ textAlign: "center", padding: "0 8px 10px", fontWeight: 700 }}>Días</th>
                <th style={{ textAlign: "left", padding: "0 8px 10px", fontWeight: 700 }}>Vence</th>
                <th style={{ textAlign: "left", padding: "0 0 10px 8px", fontWeight: 700 }}>Método</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const st = STATUS_CONFIG[r.subscriptionStatus] || STATUS_CONFIG.NONE;
                const daysUrgent = r.daysLeft !== null && r.daysLeft <= 5;
                return (
                  <tr key={r.id} style={{ borderTop: i > 0 ? "1px solid var(--adm-card-border)" : undefined }}>
                    <td style={{ padding: "10px 8px 10px 0", color: "var(--adm-text)", fontWeight: 600, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</td>
                    <td style={{ padding: "10px 8px" }}>
                      <span style={{ color: PLAN_COLOR[r.plan] || "#888", fontWeight: 700, fontSize: "0.75rem" }}>{r.plan}</span>
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      {r.billingExempt
                        ? <span style={{ fontSize: "0.72rem", padding: "3px 8px", borderRadius: 6, background: "rgba(168,85,247,0.12)", color: "#a855f7", fontWeight: 600 }}>Bonificado</span>
                        : <span style={{ fontSize: "0.72rem", padding: "3px 8px", borderRadius: 6, background: st.bg, color: st.color, fontWeight: 600 }}>{st.label}</span>
                      }
                    </td>
                    <td style={{ padding: "10px 8px", textAlign: "right", color: r.subscriptionStatus === "ACTIVE" && !r.billingExempt ? "#4ade80" : "var(--adm-text2)", fontWeight: 700 }}>
                      {r.billingExempt ? "—" : fmtMoney(r.netAmount)}
                    </td>
                    <td style={{ padding: "10px 8px", textAlign: "center" }}>
                      {r.daysLeft === null ? <span style={{ color: "var(--adm-text3)" }}>—</span>
                        : r.daysLeft <= 0 ? <span style={{ color: "#f87171", fontWeight: 700 }}>Vencido</span>
                        : <span style={{ color: daysUrgent ? "#fb923c" : "var(--adm-text2)", fontWeight: daysUrgent ? 700 : 400 }}>{r.daysLeft}d</span>
                      }
                    </td>
                    <td style={{ padding: "10px 8px", fontSize: "0.76rem", color: daysUrgent ? "#fb923c" : "var(--adm-text2)" }}>
                      {fmtDate(r.currentPeriodEnd || r.trialEndsAt) || "—"}
                    </td>
                    <td style={{ padding: "10px 0 10px 8px" }}>
                      <span style={{
                        fontSize: "0.7rem", fontWeight: 600, padding: "2px 7px", borderRadius: 5,
                        background: r.method === "Flow" ? "rgba(96,165,250,0.12)" : r.method === "MercadoPago" ? "rgba(0,180,80,0.12)" : r.method === "—" ? "transparent" : "rgba(251,191,36,0.1)",
                        color: r.method === "Flow" ? "#60a5fa" : r.method === "MercadoPago" ? "#4ade80" : r.method === "—" ? "#444" : "#fbbf24",
                      }}>{r.method}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const { restaurants, isSuper, loading: sessionLoading, selectedRestaurantId } = useAdminSession();
  const [filterRestaurant, setFilterRestaurant] = useState("");
  const [period, setPeriod] = useState<string>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [data, setData] = useState<DashData | null>(null);
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    if (sessionLoading) return;
    setLoading(true);
    const rid = isSuper ? filterRestaurant : selectedRestaurantId;
    const params = new URLSearchParams();
    if (rid) params.set("restaurantId", rid);
    params.set("period", period);
    if (period === "custom" && customFrom) params.set("from", customFrom);
    if (period === "custom" && customTo) params.set("to", customTo);
    params.set("mode", "admin");
    fetch(`/api/admin/dashboard?${params}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionLoading, isSuper, filterRestaurant, selectedRestaurantId, period, customFrom, customTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!isSuper) return;
    fetch("/api/admin/billing")
      .then(r => r.json())
      .then(d => setBilling(d))
      .catch(() => {});
  }, [isSuper]);

  if (loading || sessionLoading) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${GOLD}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 14px" }} />
        <p style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text3)" }}>Cargando...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  if (!data) {
    return <div style={{ padding: 40, textAlign: "center" }}><p style={{ fontFamily: F, color: "var(--adm-text2)" }}>Sin datos disponibles</p></div>;
  }

  const periodLabel = PERIODS.find(p => p.key === period)?.label || period;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 0 40px", overflowX: "hidden" }}>
      <style>{`
        @media (max-width: 600px) {
          .adm-stat-cards { grid-template-columns: repeat(2, 1fr) !important; }
          .adm-period-pills { gap: 4px !important; }
          .adm-period-pills button { padding: 5px 10px !important; font-size: 0.72rem !important; }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 22 }}>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.5rem", color: "var(--adm-text)", margin: 0, fontWeight: 800 }}>Dashboard</h1>
          <p style={{ fontFamily: F, fontSize: "0.75rem", color: "var(--adm-text3)", margin: "3px 0 0" }}>{periodLabel} · {new Date(data.from).toLocaleDateString("es-CL", { day: "numeric", month: "short" })} → {new Date(data.to).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}</p>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {isSuper && (
            <select value={filterRestaurant} onChange={e => setFilterRestaurant(e.target.value)}
              style={{ padding: "7px 12px", background: "var(--adm-select-bg)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text)", fontFamily: F, fontSize: "0.78rem", outline: "none" }}>
              <option value="" style={{ background: "var(--adm-select-bg)" }}>Todos los locales</option>
              {restaurants.map(r => <option key={r.id} value={r.id} style={{ background: "var(--adm-select-bg)" }}>{r.name}</option>)}
            </select>
          )}
          <button onClick={fetchData} title="Actualizar"
            style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "var(--adm-select-bg)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--adm-text3)", fontSize: "1rem" }}>
            ↻
          </button>
        </div>
      </div>

      {/* ── Period selector ── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)} style={{
            padding: "6px 16px", borderRadius: 999, cursor: "pointer",
            border: period === p.key ? `1.5px solid ${GOLD}` : "1.5px solid var(--adm-card-border)",
            background: period === p.key ? "rgba(244,166,35,0.12)" : "transparent",
            color: period === p.key ? GOLD : "var(--adm-text3)",
            fontFamily: F, fontSize: "0.78rem", fontWeight: 600, transition: "all 0.15s",
          }}>{p.label}</button>
        ))}
      </div>

      {period === "custom" && (
        <div style={{ display: "flex", gap: 8, marginBottom: 18, alignItems: "center", flexWrap: "wrap" }}>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
            style={{ padding: "7px 12px", background: "var(--adm-select-bg)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text)", fontFamily: F, fontSize: "0.78rem", outline: "none" }} />
          <span style={{ color: "var(--adm-text3)", fontSize: "0.8rem" }}>→</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
            style={{ padding: "7px 12px", background: "var(--adm-select-bg)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text)", fontFamily: F, fontSize: "0.78rem", outline: "none" }} />
          <button onClick={fetchData}
            style={{ padding: "7px 16px", borderRadius: 10, background: GOLD, color: "#0e0e0e", fontFamily: F, fontSize: "0.78rem", fontWeight: 700, border: "none", cursor: "pointer" }}>
            Aplicar
          </button>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="adm-stat-cards" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 20 }}>
        <StatCard icon="✨" label="Visitantes únicos" value={data.uniqueGuests} accent={GOLD} />
        <StatCard icon="🎂" label="Cumpleaños" value={data.birthdaysSaved} accent="#f472b6" />
      </div>

      {/* ── Rankings grid ── */}
      {(data.restaurantRanking.length > 1 || (data.birthdaysByRestaurant && data.birthdaysByRestaurant.length > 0)) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 20 }}>
          {data.restaurantRanking.length > 1 && (
            <div style={card}>
              <h3 style={sectionTitle}>Visitantes únicos por local</h3>
              <BarList items={data.restaurantRanking.slice(0, 10).map((r, i) => ({ label: `${i + 1}. ${r.name}`, value: r.uniqueGuests }))} />
            </div>
          )}
          {data.birthdaysByRestaurant && data.birthdaysByRestaurant.length > 0 && (
            <div style={card}>
              <h3 style={sectionTitle}>Cumpleaños por local</h3>
              <BarList items={data.birthdaysByRestaurant.slice(0, 10).map(r => ({ label: r.name, value: r.count }))} />
            </div>
          )}
        </div>
      )}

      {/* ── Idiomas de la carta ── */}
      {data.langUsageByRestaurant && data.langUsageByRestaurant.length > 0 && (() => {
        const rows = data.langUsageByRestaurant!;
        const totalSessions = rows.reduce((s, r) => s + r.total, 0);
        const totalEn = rows.reduce((s, r) => s + r.en, 0);
        const totalPt = rows.reduce((s, r) => s + r.pt, 0);
        const totalForeignPct = totalSessions > 0 ? Math.round(((totalEn + totalPt) / totalSessions) * 100) : 0;
        return (
          <div style={{ ...card, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <h3 style={{ ...sectionTitle, margin: 0 }}>Idiomas de la carta</h3>
              <div style={{ display: "flex", gap: 14 }}>
                <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)" }}>
                  🇺🇸 EN total: <strong style={{ color: "#3b82f6" }}>{totalEn}</strong>
                </span>
                <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)" }}>
                  🇧🇷 PT total: <strong style={{ color: "#16a34a" }}>{totalPt}</strong>
                </span>
                <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)" }}>
                  Extranjero: <strong style={{ color: GOLD }}>{totalForeignPct}%</strong>
                </span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {rows.map((r, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto auto", gap: "6px 12px", alignItems: "center" }}>
                  <span style={{ fontFamily: F, fontSize: "0.8rem", color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.name}>{r.name}</span>
                  <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", textAlign: "right", whiteSpace: "nowrap" }}>
                    🇪🇸 {r.es}
                  </span>
                  <span style={{ fontFamily: F, fontSize: "0.72rem", color: r.en > 0 ? "#3b82f6" : "var(--adm-text3)", textAlign: "right", whiteSpace: "nowrap", fontWeight: r.en > 0 ? 700 : 400 }}>
                    🇺🇸 {r.en} <span style={{ color: "var(--adm-text3)", fontWeight: 400 }}>({r.enPct}%)</span>
                  </span>
                  <span style={{ fontFamily: F, fontSize: "0.72rem", color: r.pt > 0 ? "#16a34a" : "var(--adm-text3)", textAlign: "right", whiteSpace: "nowrap", fontWeight: r.pt > 0 ? 700 : 400 }}>
                    🇧🇷 {r.pt} <span style={{ color: "var(--adm-text3)", fontWeight: 400 }}>({r.ptPct}%)</span>
                  </span>
                  <span style={{ fontFamily: F, fontSize: "0.68rem", color: r.foreignPct > 0 ? GOLD : "var(--adm-text3)", textAlign: "right", whiteSpace: "nowrap", fontWeight: 600 }}>
                    {r.foreignPct}% ext.
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Billing ── */}
      {isSuper && billing && <BillingSection data={billing} />}

    </div>
  );
}
