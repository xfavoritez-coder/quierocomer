"use client";

import { useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import SkeletonLoading from "@/components/admin/SkeletonLoading";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";
const BLUE = "#7fbfdc";
const GREEN = "#16a34a";

function timeAgo(date: string | Date): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  const now = new Date();
  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const tDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const days = Math.round((tDay - dDay) / 86400000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;
  if (days < 30) return `Hace ${Math.floor(days / 7)} sem`;
  return `Hace ${Math.floor(days / 30)} mes${Math.floor(days / 30) > 1 ? "es" : ""}`;
}
function fmtDate(date: string | Date): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
}
function clp(n: number) { return `$${n.toLocaleString("es-CL")}`; }
function customerStatus(orderCount: number): { label: string; color: string } {
  if (orderCount >= 6) return { label: "Fan", color: GOLD };
  if (orderCount >= 2) return { label: "Regular", color: GREEN };
  return { label: "Nuevo", color: BLUE };
}

const EVENT_LABELS: Record<string, string> = {
  STORE_VIEW: "Entró al store",
  STORE_DISH_VIEW: "Vio plato",
  STORE_CART_ADD: "Agregó al carrito",
  STORE_CART_REMOVE: "Quitó del carrito",
  STORE_CHECKOUT_START: "Inició checkout",
  STORE_CHECKOUT_ABANDON: "Abandonó checkout",
  STORE_ORDER_PLACED: "Pedido realizado",
  STORE_SEARCH: "Buscó sin resultado",
};

const cardStyle: React.CSSProperties = {
  background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 18px",
};
const backBtnStyle: React.CSSProperties = {
  background: "none", border: "none", color: GOLD, fontFamily: F, fontSize: "0.85rem", cursor: "pointer", marginBottom: 16,
};
const sectionLabelStyle: React.CSSProperties = {
  fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: "0.06em",
};
const rowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--adm-card-border)",
};
const listRowBtnStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
  background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 10,
  cursor: "pointer", width: "100%", textAlign: "left",
};
const searchInputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", marginBottom: 12,
  background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)",
  borderRadius: 10, color: "var(--adm-text)", fontFamily: F, fontSize: "0.85rem",
  outline: "none", boxSizing: "border-box",
};
function pillStyle(color: string, size: "sm" | "md" = "md"): React.CSSProperties {
  return { padding: size === "sm" ? "2px 8px" : "4px 12px", borderRadius: 50, fontFamily: F, fontSize: size === "sm" ? "0.65rem" : "0.72rem", fontWeight: 600, background: `${color}18`, color };
}
function pageBtnStyle(disabled: boolean): React.CSSProperties {
  return { padding: "8px 16px", borderRadius: 8, border: "1px solid var(--adm-card-border)", background: disabled ? "transparent" : "var(--adm-hover)", color: disabled ? "var(--adm-text3)" : "var(--adm-text)", fontFamily: F, fontSize: "0.8rem", cursor: disabled ? "default" : "pointer" };
}
function StatCard({ value, label, color = "var(--adm-text)", sub }: { value: string | number; label: string; color?: string; sub?: string }) {
  return (
    <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: "14px 16px" }}>
      <p style={{ fontFamily: F, fontSize: "1.4rem", color, fontWeight: 700, margin: 0 }}>{value}</p>
      <p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>{label}</p>
      {sub && <p style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", margin: "2px 0 0", opacity: 0.7 }}>{sub}</p>}
    </div>
  );
}

interface EcomCustomer {
  phone: string; name: string | null; email: string | null;
  orderCount: number; totalSpent: number; avgTicket: number;
  firstOrderAt: string; lastOrderAt: string;
  guestIds: string[]; restaurants: string[];
}
interface EcomDetail {
  customer: { name: string; email: string | null; phone: string; firstOrderAt: string; lastOrderAt: string; daysSinceLastOrder: number };
  stats: { orderCount: number; paidOrderCount: number; totalSpent: number; avgTicket: number };
  orders: any[];
  topDishes: { name: string; orderCount: number; totalQty: number; totalRevenue: number }[];
  viewedOnlyDishes: { dishName: string; viewCount: number }[];
  funnel: { storeViews: number; dishViews: number; cartAdds: number; checkoutStarts: number; checkoutAbandons: number; ordersPlaced: number };
  storeEvents: { id: string; eventType: string; createdAt: string; metadata: any; restaurant?: { name: string } }[];
}

function EcomTab() {
  const [customers, setCustomers] = useState<EcomCustomer[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<EcomDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/ecommerce-customers?search=${encodeURIComponent(search)}&page=${page}`)
      .then(r => r.json())
      .then(d => { setCustomers(d.customers || []); setTotal(d.total || 0); setPages(d.pages || 1); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [page, search]);

  const openDetail = async (phone: string) => {
    setSelected(null); setDetailLoading(true);
    const res = await fetch(`/api/admin/ecommerce-customers/${encodeURIComponent(phone)}`);
    const data = await res.json();
    if (!data.error) setSelected(data);
    setDetailLoading(false);
  };

  if (detailLoading) return (
    <div>
      <button onClick={() => setDetailLoading(false)} style={backBtnStyle}>&larr; Volver</button>
      <p style={{ color: GOLD, fontFamily: F, padding: 40, textAlign: "center" }}>Cargando perfil...</p>
    </div>
  );

  if (selected) {
    const { customer, stats, funnel, topDishes, viewedOnlyDishes, storeEvents } = selected;
    const st = customerStatus(stats.orderCount);
    return (
      <div style={{ maxWidth: 720 }}>
        <button onClick={() => setSelected(null)} style={backBtnStyle}>&larr; Volver</button>
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: `${st.color}18`, display: "flex", alignItems: "center", justifyContent: "center", color: st.color, fontFamily: F, fontSize: "1.1rem", fontWeight: 700 }}>
              {(customer.name || customer.phone)[0].toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontFamily: F, fontSize: "1.1rem", color: "var(--adm-text)", margin: 0 }}>{customer.name}</h2>
              <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>
                {customer.phone}{customer.email ? ` · ${customer.email}` : ""}
              </p>
            </div>
            <span style={pillStyle(st.color)}>{st.label}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }} className="adm-grid-2">
            <StatCard value={stats.paidOrderCount} label="Pedidos" color={GOLD} />
            <StatCard value={clp(stats.totalSpent)} label="Total gastado" color={GREEN} />
            <StatCard value={clp(stats.avgTicket)} label="Ticket promedio" color={BLUE} />
            <StatCard
              value={timeAgo(customer.lastOrderAt)}
              label="Último pedido"
              color={customer.daysSinceLastOrder > 30 ? "#ef4444" : "var(--adm-text)"}
              sub={fmtDate(customer.lastOrderAt)}
            />
          </div>
        </div>

        <div style={{ ...cardStyle, marginTop: 10 }}>
          <label style={sectionLabelStyle}>Funnel de comportamiento</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 10 }} className="adm-grid-2">
            {[
              { label: "Vistas store", value: funnel.storeViews, color: "var(--adm-text2)" },
              { label: "Platos vistos", value: funnel.dishViews, color: BLUE },
              { label: "Al carrito", value: funnel.cartAdds, color: GOLD },
              { label: "Checkout", value: funnel.checkoutStarts, color: "#a78bfa" },
              { label: "Abandonos", value: funnel.checkoutAbandons, color: "#ef4444" },
              { label: "Pedidos", value: funnel.ordersPlaced, color: GREEN },
            ].map((f, i) => (
              <div key={i} style={{ background: "var(--adm-hover)", borderRadius: 10, padding: "10px 12px" }}>
                <p style={{ fontFamily: F, fontSize: "1.3rem", fontWeight: 700, color: f.color, margin: 0 }}>{f.value}</p>
                <p style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", margin: 0 }}>{f.label}</p>
              </div>
            ))}
          </div>
        </div>

        {topDishes.length > 0 && (
          <div style={{ ...cardStyle, marginTop: 10 }}>
            <label style={sectionLabelStyle}>Platos más pedidos</label>
            {topDishes.map((d, i) => (
              <div key={i} style={rowStyle}>
                <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", width: 18, flexShrink: 0 }}>#{i + 1}</span>
                <span style={{ fontFamily: FB, fontSize: "0.84rem", color: "var(--adm-text)", flex: 1 }}>{d.name}</span>
                <span style={{ fontFamily: F, fontSize: "0.72rem", color: GOLD }}>{d.totalQty}×</span>
                <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)" }}>{clp(d.totalRevenue)}</span>
              </div>
            ))}
          </div>
        )}

        {viewedOnlyDishes.length > 0 && (
          <div style={{ ...cardStyle, marginTop: 10 }}>
            <label style={sectionLabelStyle}>Vio pero nunca pidió <span style={{ color: "#ef4444", fontWeight: 400 }}>→ oportunidad de cupón</span></label>
            {viewedOnlyDishes.map((d, i) => (
              <div key={i} style={rowStyle}>
                <span style={{ fontFamily: FB, fontSize: "0.84rem", color: "var(--adm-text)", flex: 1 }}>{d.dishName}</span>
                <span style={{ fontFamily: F, fontSize: "0.72rem", color: BLUE }}>{d.viewCount} vista{d.viewCount > 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        )}

        {selected.orders.length > 0 && (
          <div style={{ ...cardStyle, marginTop: 10 }}>
            <label style={sectionLabelStyle}>Historial de pedidos</label>
            {selected.orders.map((o: any) => (
              <div key={o.id} style={{ ...rowStyle, flexWrap: "wrap", gap: 6 }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <p style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text)", margin: 0, fontWeight: 600 }}>
                    #{o.orderNumber} · {o.restaurantName}
                  </p>
                  <p style={{ fontFamily: FB, fontSize: "0.68rem", color: "var(--adm-text3)", margin: 0 }}>
                    {fmtDate(o.createdAt)} · {o.orderType === "DELIVERY" ? "Delivery" : "Retiro"}
                  </p>
                </div>
                <span style={pillStyle(o.paymentStatus === "paid" ? GREEN : GOLD, "sm")}>{o.paymentStatus === "paid" ? "Pagado" : o.paymentStatus}</span>
                <span style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text)", fontWeight: 600 }}>{clp(o.total)}</span>
              </div>
            ))}
          </div>
        )}

        {storeEvents.length > 0 && (
          <div style={{ ...cardStyle, marginTop: 10 }}>
            <label style={sectionLabelStyle}>Timeline de actividad en el store</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 8 }}>
              {storeEvents.slice(0, 30).map((e) => {
                const meta = e.metadata as any;
                const label = EVENT_LABELS[e.eventType] || e.eventType;
                const detail = meta?.dishName || meta?.query || (meta?.cartItems ? `${meta.cartItems.length} ítems en carrito` : "") || meta?.orderId || "";
                return (
                  <div key={e.id} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "4px 0", borderBottom: "1px solid var(--adm-card-border)" }}>
                    <span style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", flexShrink: 0, width: 72 }}>
                      {fmtDate(e.createdAt)}
                    </span>
                    <span style={{ fontFamily: F, fontSize: "0.78rem", color: e.eventType.includes("ABANDON") ? "#ef4444" : e.eventType.includes("ORDER_PLACED") ? GREEN : "var(--adm-text2)" }}>
                      {label}
                    </span>
                    {detail && <span style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{detail}</span>}
                    {meta?.dwellMs && <span style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", flexShrink: 0 }}>{Math.round(meta.dwellMs / 1000)}s</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 12px" }}>{total.toLocaleString("es-CL")} clientes únicos</p>
      <input placeholder="Buscar por nombre, teléfono o email..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={searchInputStyle} />
      {loading ? <SkeletonLoading type="list" /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {customers.map(c => {
            const st = customerStatus(c.orderCount);
            return (
              <button key={c.phone} onClick={() => openDetail(c.phone)} style={listRowBtnStyle}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: `${st.color}18`, display: "flex", alignItems: "center", justifyContent: "center", color: st.color, fontFamily: F, fontSize: "0.8rem", fontWeight: 700, flexShrink: 0 }}>
                  {(c.name || c.phone)[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: F, fontSize: "0.84rem", color: "var(--adm-text)", fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.name || c.phone}
                  </p>
                  <p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", margin: 0 }}>
                    {c.phone}{c.email ? ` · ${c.email}` : ""}
                  </p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ fontFamily: F, fontSize: "0.78rem", color: st.color, fontWeight: 600, margin: 0 }}>{c.orderCount} pedido{c.orderCount !== 1 ? "s" : ""}</p>
                  <p style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", margin: 0 }}>
                    {timeAgo(c.lastOrderAt)} · {fmtDate(c.lastOrderAt)}
                  </p>
                </div>
              </button>
            );
          })}
          {customers.length === 0 && !loading && (
            <p style={{ fontFamily: F, fontSize: "0.85rem", color: "var(--adm-text3)", textAlign: "center", padding: 40 }}>
              {total === 0 ? "Aún no hay pedidos en el ecommerce" : "Sin resultados"}
            </p>
          )}
        </div>
      )}
      {pages > 1 && <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}><button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={pageBtnStyle(page <= 1)}>Anterior</button><span style={{ fontFamily: F, fontSize: "0.8rem", color: "var(--adm-text2)", padding: "8px 12px" }}>{page} / {pages}</span><button disabled={page >= pages} onClick={() => setPage(p => p + 1)} style={pageBtnStyle(page >= pages)}>Siguiente</button></div>}
    </div>
  );
}

export default function EcommerceUsuariosPage() {
  const { loading, isSuper } = useAdminSession();
  if (loading) return null;
  if (!isSuper) return <div style={{ padding: 40, color: "#ef4444", fontFamily: F }}>No autorizado</div>;
  return (
    <div style={{ maxWidth: 800 }}>
      <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: GOLD, margin: "0 0 20px" }}>Clientes Ecommerce</h1>
      <EcomTab />
    </div>
  );
}
