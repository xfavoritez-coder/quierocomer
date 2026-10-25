"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";

const ACCENT = "#F4A623";
const F = "var(--font-display, system-ui)";

// Select con chevron propio (deja espacio a la derecha; evita la flecha pegada al borde).
const CHEVRON = "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='12'%20height='12'%20viewBox='0%200%2024%2024'%20fill='none'%20stroke='%23999'%20stroke-width='2.5'%20stroke-linecap='round'%20stroke-linejoin='round'%3E%3Cpolyline%20points='6%209%2012%2015%2018%209'/%3E%3C/svg%3E";
const SELECT_STYLE: React.CSSProperties = {
  padding: "9px 38px 9px 14px", borderRadius: 10, border: "1px solid #333", background: "#1a1a1a",
  color: "#f0f0f0", fontSize: 14, outline: "none", cursor: "pointer",
  appearance: "none", WebkitAppearance: "none",
  backgroundImage: `url("${CHEVRON}")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 13px center", backgroundSize: "12px",
};

interface OrderItem { dishName: string; quantity: number; unitTotal: number; selectedOptions: { optionName: string }[]; notes?: string; }
interface Order {
  id: string;
  restaurantId: string;
  restaurant: { name: string; slug: string };
  customerName: string;
  customerPhone: string;
  orderType: string;
  deliveryAddress: string | null;
  paymentMethod: string;
  items: OrderItem[];
  total: number;
  notes: string | null;
  status: string;
  createdAt: string;
}

interface Stats {
  totalOrders: number;
  totalRevenue: number;
  totalRevenueAll: number;
  totalRevenueDone: number;
  deliveryRevenue: number;
  byStatus: Record<string, number>;
  repeatCustomers: number;
  uniqueCustomers: number;
  topDishes: { name: string; count: number }[];
  byPaymentMethod: Record<string, number>;
  deliveryCount: number;
  pickupCount: number;
  byRestaurant: { id: string; name: string; count: number; revenue: number }[];
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmado",
  READY: "Listo",
  DONE: "Entregado",
  CANCELLED: "Cancelado",
};
const STATUS_COLORS: Record<string, string> = {
  PENDING: "#f59e0b",
  CONFIRMED: "#3b82f6",
  READY: "#8b5cf6",
  DONE: "#22c55e",
  CANCELLED: "#ef4444",
};

function fmtCLP(n: number) { return `$${Math.round(n).toLocaleString("es-CL")}`; }
function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: "#1a1a1a", borderRadius: 14, padding: "18px 20px", border: "1px solid #262626" }}>
      <p style={{ fontSize: 11, color: "#666", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: F }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 800, color: color || ACCENT, margin: 0, fontFamily: F }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: "#555", margin: "4px 0 0", fontFamily: F }}>{sub}</p>}
    </div>
  );
}

export default function PedidosOnlinePage() {
  const { loading: authLoading, restaurants: adminRestaurants, isSuper } = useAdminSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [restaurantFilter, setRestaurantFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState(""); // "" = todos; "YYYY-MM"
  const [showFailed, setShowFailed] = useState(false); // mostrar intentos de pago fallidos
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  const fetchOrders = useCallback(async (p = 1, s = statusFilter, rid = restaurantFilter) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p) });
    if (s) params.set("status", s);
    if (rid) params.set("restaurantId", rid);
    if (monthFilter) params.set("month", monthFilter);
    if (showFailed) params.set("includeFailed", "1");
    const res = await fetch(`/api/admin/online-orders?${params}`);
    if (res.ok) {
      const data = await res.json();
      setOrders(data.orders);
      setTotal(data.total);
      setPages(data.pages);
      setPage(p);
    }
    setLoading(false);
  }, [statusFilter, restaurantFilter, monthFilter, showFailed]);

  const fetchStats = useCallback(async (rid = restaurantFilter) => {
    setStatsLoading(true);
    const params = new URLSearchParams();
    if (rid) params.set("restaurantId", rid);
    if (monthFilter) params.set("month", monthFilter);
    const res = await fetch(`/api/admin/online-orders/stats?${params}`);
    if (res.ok) {
      const data = await res.json();
      setStats(data);
    }
    setStatsLoading(false);
  }, [restaurantFilter, monthFilter]);

  useEffect(() => {
    if (!authLoading) {
      fetchOrders(1, statusFilter, restaurantFilter);
      fetchStats(restaurantFilter);
    }
  }, [authLoading, statusFilter, restaurantFilter, monthFilter, showFailed]);

  const updateStatus = async (id: string, status: string) => {
    await fetch("/api/admin/online-orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    fetchOrders(page, statusFilter, restaurantFilter);
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null);
  };

  const monthOptions = useMemo(() => {
    const out: { val: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 18; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      let label = d.toLocaleDateString("es-CL", { month: "long", year: "numeric" });
      label = label.charAt(0).toUpperCase() + label.slice(1);
      out.push({ val, label });
    }
    return out;
  }, []);

  const filtered = search.trim()
    ? orders.filter(o => o.customerName.toLowerCase().includes(search.toLowerCase()) || o.restaurant.name.toLowerCase().includes(search.toLowerCase()) || o.customerPhone.includes(search))
    : orders;

  if (authLoading) return null;

  const topDishes = stats?.topDishes?.slice(0, 5) || [];
  const maxDish = topDishes[0]?.count || 1;

  return (
    <div style={{ minHeight: "100vh", background: "#0e0e0e", color: "#f0f0f0", fontFamily: F, padding: "24px" }}>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontFamily: F, fontSize: 28, fontWeight: 800, margin: "0 0 6px", color: "#fff" }}>Pedidos Online</h1>
        <p style={{ color: "#777", fontSize: 14, margin: 0 }}>{statsLoading ? "..." : (stats?.totalOrders ?? total)} pedidos · {statsLoading ? "..." : fmtCLP(stats?.totalRevenue || 0)} en ventas reales</p>
      </div>

      {/* Filtro por local + acciones */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        {(isSuper && adminRestaurants.length > 1) && (
          <select value={restaurantFilter} onChange={e => setRestaurantFilter(e.target.value)} style={SELECT_STYLE}>
            <option value="">Todos los locales</option>
            {adminRestaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}
        <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} style={SELECT_STYLE}>
          <option value="">Todos los meses</option>
          {monthOptions.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={SELECT_STYLE}>
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button onClick={() => setShowFailed(v => !v)} title="Intentos de pago Webpay no completados"
          style={{ padding: "9px 14px", borderRadius: 10, border: `1px solid ${showFailed ? ACCENT : "#333"}`, background: showFailed ? "rgba(244,166,35,0.12)" : "transparent", color: showFailed ? ACCENT : "#999", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          {showFailed ? "Ocultar intentos fallidos" : "Mostrar intentos fallidos"}
        </button>
        <button onClick={() => { fetchOrders(page, statusFilter, restaurantFilter); fetchStats(restaurantFilter); }}
          style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: "#262626", color: "#ccc", fontSize: 14, cursor: "pointer" }}>
          ↺ Refrescar
        </button>
      </div>

      {/* Stats cards */}
      {!statsLoading && stats && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
            <StatCard label="Total pedidos" value={String(stats.totalOrders)} color={ACCENT} />
            <StatCard label="Total en pedidos" value={fmtCLP(stats.totalRevenue)} sub={`${fmtCLP(stats.totalRevenueDone)} entregados`} color="#22c55e" />
            <StatCard label="Total delivery" value={fmtCLP(stats.deliveryRevenue)} sub={`${stats.deliveryCount} pedidos delivery`} color="#60a5fa" />
            <StatCard label="Clientes únicos" value={String(stats.uniqueCustomers)} sub={`${stats.repeatCustomers} repiten (${stats.uniqueCustomers > 0 ? Math.round(stats.repeatCustomers / stats.uniqueCustomers * 100) : 0}%)`} color="#f472b6" />
            <StatCard label="Retiros" value={String(stats.pickupCount)} sub={`${stats.deliveryCount} delivery`} color="#a78bfa" />
          </div>

          {/* Top platos + métodos pago */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginBottom: 20 }}>
            {topDishes.length > 0 && (
              <div style={{ background: "#1a1a1a", borderRadius: 14, padding: "18px 20px", border: "1px solid #262626" }}>
                <p style={{ fontSize: 11, color: "#666", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: F, fontWeight: 700 }}>
                  Lo más pedido
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {topDishes.map((d, i) => (
                    <div key={d.name}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 13, color: "#ddd", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "80%", fontFamily: F }}>{i + 1}. {d.name}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT, flexShrink: 0, fontFamily: F }}>{d.count}</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: "#2a2a2a" }}>
                        <div style={{ width: `${Math.round(d.count / maxDish * 100)}%`, height: "100%", borderRadius: 2, background: i === 0 ? ACCENT : `rgba(244,166,35,${Math.max(0.2, 0.8 - i * 0.12)})` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Object.keys(stats.byPaymentMethod).length > 0 && (
              <div style={{ background: "#1a1a1a", borderRadius: 14, padding: "18px 20px", border: "1px solid #262626" }}>
                <p style={{ fontSize: 11, color: "#666", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: F, fontWeight: 700 }}>
                  Métodos de pago
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {Object.entries(stats.byPaymentMethod).sort((a, b) => b[1] - a[1]).map(([m, count]) => (
                    <div key={m} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, color: "#ddd", textTransform: "capitalize", fontFamily: F }}>{m}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#60a5fa", fontFamily: F }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!restaurantFilter && stats.byRestaurant.length > 1 && (
              <div style={{ background: "#1a1a1a", borderRadius: 14, padding: "18px 20px", border: "1px solid #262626" }}>
                <p style={{ fontSize: 11, color: "#666", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: F, fontWeight: 700 }}>
                  Por local
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {stats.byRestaurant.slice(0, 6).map(r => (
                    <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: "#ddd", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%", fontFamily: F }}>{r.name}</span>
                      <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                        <span style={{ fontSize: 12, color: "#888", fontFamily: F }}>{r.count} ped.</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#22c55e", fontFamily: F }}>{fmtCLP(r.revenue)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Search */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar cliente, restaurante, teléfono..."
          style={{ flex: 1, minWidth: 200, padding: "9px 14px", borderRadius: 10, border: "1px solid #333", background: "#1a1a1a", color: "#f0f0f0", fontSize: 14, outline: "none" }}
        />
      </div>

      {/* Table */}
      <div style={{ background: "#1a1a1a", borderRadius: 16, border: "1px solid #262626", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "#555" }}>Cargando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "#555" }}>No hay pedidos</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #262626" }}>
                {["Restaurante", "Cliente", "Tipo", "Pago", "Total", "Estado", "Fecha", ""].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(order => (
                <tr key={order.id} style={{ borderBottom: "1px solid #1e1e1e", transition: "background 0.1s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#202020")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <td style={{ padding: "12px 16px", fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: "#fff" }}>{order.restaurant.name}</span>
                    <span style={{ display: "block", fontSize: 11, color: "#555" }}>{order.restaurant.slug}</span>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13 }}>
                    <span style={{ color: "#ddd" }}>{order.customerName}</span>
                    <span style={{ display: "block", fontSize: 11, color: "#555" }}>{order.customerPhone}</span>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: "#aaa" }}>
                    {order.orderType === "PICKUP" ? "🏠 Retiro" : "🚚 Delivery"}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: "#aaa", textTransform: "capitalize" }}>{order.paymentMethod}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: ACCENT }}>{fmtCLP(order.total)}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <select
                      value={order.status}
                      onChange={e => updateStatus(order.id, e.target.value)}
                      style={{ fontSize: 12, fontWeight: 600, color: STATUS_COLORS[order.status] || "#aaa", background: "#111", border: `1px solid ${STATUS_COLORS[order.status] || "#333"}`, borderRadius: 6, padding: "3px 26px 3px 8px", cursor: "pointer", outline: "none", appearance: "none", WebkitAppearance: "none", backgroundImage: `url("${CHEVRON}")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 7px center", backgroundSize: "11px" }}
                    >
                      {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 11, color: "#555" }}>
                    <span title={fmtDate(order.createdAt)}>{timeAgo(order.createdAt)}</span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <button onClick={() => setSelected(order)} style={{ fontSize: 12, color: ACCENT, background: "none", border: `1px solid ${ACCENT}30`, borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20 }}>
          {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => fetchOrders(p, statusFilter, restaurantFilter)}
              style={{ width: 34, height: 34, borderRadius: 8, border: "none", cursor: "pointer", background: p === page ? ACCENT : "#1a1a1a", color: p === page ? "#fff" : "#aaa", fontWeight: p === page ? 700 : 400, fontSize: 13 }}>
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#1a1a1a", borderRadius: 20, border: "1px solid #2a2a2a", width: "100%", maxWidth: 520, maxHeight: "85vh", overflow: "auto" }}>
            <div style={{ padding: "20px 22px", borderBottom: "1px solid #262626", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h2 style={{ fontFamily: F, fontSize: 20, fontWeight: 800, margin: "0 0 4px", color: "#fff" }}>Detalle del pedido</h2>
                <p style={{ fontSize: 12, color: "#555", margin: 0 }}>{fmtDate(selected.createdAt)} · {selected.restaurant.name}</p>
              </div>
              <button onClick={() => setSelected(null)} style={{ width: 30, height: 30, borderRadius: "50%", border: "none", background: "#262626", color: "#aaa", cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
            <div style={{ padding: "20px 22px" }}>
              <div style={{ marginBottom: 18 }}>
                <p style={{ fontSize: 11, color: "#555", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Cliente</p>
                <p style={{ fontSize: 15, fontWeight: 600, color: "#fff", margin: "0 0 2px" }}>{selected.customerName}</p>
                <p style={{ fontSize: 13, color: "#aaa", margin: 0 }}>{selected.customerPhone}</p>
              </div>
              <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
                <div style={{ flex: 1, background: "#111", borderRadius: 10, padding: "12px 14px" }}>
                  <p style={{ fontSize: 11, color: "#555", margin: "0 0 4px", textTransform: "uppercase" }}>Tipo</p>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#ddd", margin: 0 }}>{selected.orderType === "PICKUP" ? "🏠 Retiro" : "🚚 Delivery"}</p>
                  {selected.deliveryAddress && <p style={{ fontSize: 12, color: "#777", margin: "4px 0 0" }}>{selected.deliveryAddress}</p>}
                </div>
                <div style={{ flex: 1, background: "#111", borderRadius: 10, padding: "12px 14px" }}>
                  <p style={{ fontSize: 11, color: "#555", margin: "0 0 4px", textTransform: "uppercase" }}>Pago</p>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#ddd", margin: 0, textTransform: "capitalize" }}>{selected.paymentMethod}</p>
                </div>
              </div>
              <div style={{ marginBottom: 18 }}>
                <p style={{ fontSize: 11, color: "#555", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Productos</p>
                {(selected.items as OrderItem[]).map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid #222" }}>
                    <div>
                      <span style={{ fontSize: 14, color: "#fff" }}>{item.quantity}× {item.dishName}</span>
                      {item.selectedOptions?.length > 0 && (
                        <span style={{ display: "block", fontSize: 11, color: "#666" }}>{item.selectedOptions.map(o => o.optionName).join(", ")}</span>
                      )}
                      {item.notes && <span style={{ display: "block", fontSize: 11, color: "#666", fontStyle: "italic" }}>"{item.notes}"</span>}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: ACCENT, flexShrink: 0, marginLeft: 12 }}>{fmtCLP(item.unitTotal * item.quantity)}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Total</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: ACCENT }}>{fmtCLP(selected.total)}</span>
                </div>
              </div>
              {selected.notes && (
                <div style={{ background: "#111", borderRadius: 10, padding: "12px 14px", marginBottom: 18 }}>
                  <p style={{ fontSize: 11, color: "#555", margin: "0 0 4px", textTransform: "uppercase" }}>Notas</p>
                  <p style={{ fontSize: 13, color: "#aaa", margin: 0 }}>{selected.notes}</p>
                </div>
              )}
              <div>
                <p style={{ fontSize: 11, color: "#555", margin: "0 0 8px", textTransform: "uppercase" }}>Cambiar estado</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {Object.entries(STATUS_LABELS).map(([v, l]) => (
                    <button key={v} onClick={() => updateStatus(selected.id, v)}
                      style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${selected.status === v ? STATUS_COLORS[v] : "#333"}`, background: selected.status === v ? `${STATUS_COLORS[v]}22` : "#111", color: selected.status === v ? STATUS_COLORS[v] : "#666", fontSize: 13, fontWeight: selected.status === v ? 700 : 400, cursor: "pointer" }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
