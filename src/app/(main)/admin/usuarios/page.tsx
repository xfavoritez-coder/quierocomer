"use client";

import { useState, useEffect } from "react";
import SkeletonLoading from "@/components/admin/SkeletonLoading";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";
const BLUE = "#7fbfdc";
const GREEN = "#16a34a";

// ─── helpers ────────────────────────────────────────────────────────────────

function timeAgo(date: string | Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;
  if (days < 30) return `Hace ${Math.floor(days / 7)} sem`;
  return `Hace ${Math.floor(days / 30)} mes${Math.floor(days / 30) > 1 ? "es" : ""}`;
}

function clp(n: number) { return `$${n.toLocaleString("es-CL")}`; }

function customerStatus(orderCount: number): { label: string; color: string } {
  if (orderCount >= 6) return { label: "Fan", color: GOLD };
  if (orderCount >= 2) return { label: "Regular", color: GREEN };
  return { label: "Nuevo", color: BLUE };
}

function engagementLevel(score: number): { label: string; color: string } {
  if (score >= 30) return { label: "Super fan", color: GOLD };
  if (score >= 15) return { label: "Activo", color: GREEN };
  if (score >= 5) return { label: "Regular", color: BLUE };
  return { label: "Nuevo", color: "var(--adm-text3)" };
}

const DIET_LABELS: Record<string, string> = {
  VEGAN: "🌿 Vegano", VEGETARIAN: "🌱 Vegetariano", OMNIVORE: "🍖 Carnívoro",
};
const SOURCE_LABELS: Record<string, string> = {
  post_genio_CONVERTED: "Genio", cta_post_genio_CONVERTED: "CTA Genio",
  cta_repeat_dish_CONVERTED: "CTA Plato", cta_promo_unlock_CONVERTED: "CTA Promo",
  birthday_banner_CONVERTED: "Cumpleaños", favorites_CONVERTED: "Favoritos",
  unknown_CONVERTED: "Directo",
};

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

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ value, label, color = "var(--adm-text)" }: { value: string | number; label: string; color?: string }) {
  return (
    <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: "14px 16px" }}>
      <p style={{ fontFamily: F, fontSize: "1.4rem", color, fontWeight: 700, margin: 0 }}>{value}</p>
      <p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", margin: 0 }}>{label}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: CARTA QR
// ═══════════════════════════════════════════════════════════════════════════════

interface QRUser {
  id: string; name: string | null; email: string;
  verifiedAt: string | null; createdAt: string; unsubscribedAt: string | null;
  dietType: string | null;
}

interface QRUserDetail {
  user: QRUser & { birthDate: string | null; restrictions: string[]; dislikes: string[]; lastEmailAt: string | null };
  engagementScore: number;
  restaurants: { id: string; name: string; slug: string }[];
  sessions: any[]; favorites: any[]; interactions: any[]; campaigns: any[];
}

function QRTab() {
  const [users, setUsers] = useState<QRUser[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<QRUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/users?search=${encodeURIComponent(search)}&page=${page}`)
      .then(r => r.json())
      .then(d => { setUsers(d.users || []); setTotal(d.total || 0); setPages(d.pages || 1); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, search]);

  const openDetail = async (id: string) => {
    setSelected(null);
    setDetailLoading(true);
    const res = await fetch(`/api/admin/users/${id}`);
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
    const u = selected.user;
    const eng = engagementLevel(selected.engagementScore);
    const regInteraction = selected.interactions.find((i: any) => i.type?.endsWith("_CONVERTED"));
    return (
      <div style={{ maxWidth: 680 }}>
        <button onClick={() => setSelected(null)} style={backBtnStyle}>&larr; Volver</button>

        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: F, fontSize: "1.1rem", fontWeight: 700 }}>
              {(u.name || u.email)[0].toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontFamily: F, fontSize: "1.1rem", color: "var(--adm-text)", margin: 0 }}>{u.name || "Sin nombre"}</h2>
              <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>{u.email}</p>
            </div>
            <span style={pillStyle(eng.color)}>{eng.label}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div><label style={metaLabelStyle}>Registro</label><p style={metaValStyle}>{new Date(u.createdAt).toLocaleDateString("es-CL")}</p></div>
            <div><label style={metaLabelStyle}>Cumpleaños</label><p style={metaValStyle}>{u.birthDate ? new Date(u.birthDate).toLocaleDateString("es-CL", { day: "numeric", month: "long", timeZone: "UTC" }) : "—"}</p></div>
            <div><label style={metaLabelStyle}>Dieta</label><p style={metaValStyle}>{DIET_LABELS[u.dietType || ""] || "—"}</p></div>
          </div>
          {u.restrictions?.length > 0 && <div style={{ marginBottom: 8 }}><label style={metaLabelStyle}>Restricciones</label><div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>{u.restrictions.map((r: string) => <span key={r} style={{ fontSize: "0.72rem", padding: "2px 8px", borderRadius: 50, background: "rgba(232,85,48,0.08)", color: "#e85530", fontFamily: FB }}>{r}</span>)}</div></div>}
          {u.dislikes?.length > 0 && <div style={{ marginBottom: 8 }}><label style={metaLabelStyle}>No le gusta</label><div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>{u.dislikes.map((d: string) => <span key={d} style={{ fontSize: "0.72rem", padding: "2px 8px", borderRadius: 50, background: "rgba(255,100,100,0.06)", color: "#ff6b6b", fontFamily: FB }}>🚫 {d}</span>)}</div></div>}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {u.verifiedAt && <span style={pillStyle(GREEN, "sm")}>✓ Verificado</span>}
            {u.unsubscribedAt && <span style={pillStyle("#ef4444", "sm")}>Desuscrito</span>}
            {regInteraction && <span style={pillStyle(BLUE, "sm")}>Vía {SOURCE_LABELS[regInteraction.type] || regInteraction.type.replace("_CONVERTED", "")}</span>}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 14 }} className="adm-grid-2">
          <StatCard value={selected.sessions.length} label="Sesiones" color={GOLD} />
          <StatCard value={selected.favorites.length} label="Favoritos" color="#ef4444" />
          <StatCard value={selected.interactions.length} label="Interacciones" color={BLUE} />
          <StatCard value={selected.campaigns.length} label="Campañas" color={GREEN} />
        </div>

        {selected.restaurants.length > 0 && (
          <div style={{ ...cardStyle, marginBottom: 10 }}>
            <label style={sectionLabelStyle}>Locales visitados</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {selected.restaurants.map(r => <span key={r.id} style={pillStyle(GOLD)}>{r.name}</span>)}
            </div>
          </div>
        )}

        {selected.favorites.length > 0 && (
          <div style={{ ...cardStyle, marginBottom: 10 }}>
            <label style={sectionLabelStyle}>Platos favoritos</label>
            {selected.favorites.map((f: any) => (
              <div key={f.id} style={rowStyle}>
                {f.dish?.photos?.[0] && <img src={f.dish.photos[0]} alt="" style={{ width: 30, height: 30, borderRadius: 6, objectFit: "cover" }} />}
                <span style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text)", flex: 1 }}>{f.dish?.name || "?"}</span>
                <span style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)" }}>{f.restaurant?.name}</span>
              </div>
            ))}
          </div>
        )}

        {selected.sessions.length > 0 && (
          <div style={{ ...cardStyle, marginBottom: 10 }}>
            <label style={sectionLabelStyle}>Últimas sesiones</label>
            {selected.sessions.map((s: any) => (
              <div key={s.id} style={rowStyle}>
                <span style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text)", flex: 1 }}>{s.restaurant?.name}</span>
                <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)" }}>{new Date(s.startedAt).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}</span>
              </div>
            ))}
          </div>
        )}

        {selected.campaigns.length > 0 && (
          <div style={cardStyle}>
            <label style={sectionLabelStyle}>Campañas recibidas</label>
            {selected.campaigns.map((c: any) => (
              <div key={c.id} style={rowStyle}>
                <span style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text)", flex: 1 }}>{c.campaign?.name || "?"}</span>
                <div style={{ display: "flex", gap: 4 }}>
                  {c.openedAt && <span style={{ fontSize: "0.62rem", padding: "2px 6px", borderRadius: 4, background: "rgba(22,163,74,0.08)", color: GREEN, fontFamily: F }}>Abierto</span>}
                  {c.clickedAt && <span style={{ fontSize: "0.62rem", padding: "2px 6px", borderRadius: 4, background: `${GOLD}18`, color: GOLD, fontFamily: F }}>Click</span>}
                  {!c.openedAt && <span style={{ fontSize: "0.62rem", padding: "2px 6px", borderRadius: 4, background: "rgba(0,0,0,0.04)", color: "var(--adm-text3)", fontFamily: F }}>Enviado</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 740 }}>
      <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 16px" }}>{total} usuarios registrados</p>
      <input
        placeholder="Buscar por nombre o email..."
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(1); }}
        style={searchInputStyle}
      />
      {loading ? <SkeletonLoading type="list" /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {users.map(u => (
            <button key={u.id} onClick={() => openDetail(u.id)} style={listRowBtnStyle}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: `${GOLD}18`, display: "flex", alignItems: "center", justifyContent: "center", color: GOLD, fontFamily: F, fontSize: "0.8rem", fontWeight: 700, flexShrink: 0 }}>
                {(u.name || u.email)[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: F, fontSize: "0.84rem", color: "var(--adm-text)", fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {u.name || u.email.split("@")[0]}
                  {u.verifiedAt && <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: GREEN, marginLeft: 6, verticalAlign: "middle" }} />}
                </p>
                <p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", margin: 0 }}>{u.email}</p>
              </div>
              <span style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", flexShrink: 0 }}>{timeAgo(u.createdAt)}</span>
            </button>
          ))}
          {users.length === 0 && <p style={{ fontFamily: F, fontSize: "0.85rem", color: "var(--adm-text3)", textAlign: "center", padding: 40 }}>Sin usuarios</p>}
        </div>
      )}
      {pages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={pageBtnStyle(page <= 1)}>Anterior</button>
          <span style={{ fontFamily: F, fontSize: "0.8rem", color: "var(--adm-text2)", padding: "8px 12px" }}>{page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} style={pageBtnStyle(page >= pages)}>Siguiente</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: ECOMMERCE
// ═══════════════════════════════════════════════════════════════════════════════

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
  const [overview, setOverview] = useState({ totalCustomers: 0, totalRevenue: 0, avgTicket: 0, repeatCustomers: 0 });
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
      .then(d => {
        setCustomers(d.customers || []);
        setTotal(d.total || 0);
        setPages(d.pages || 1);
        if (d.overview) setOverview(d.overview);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, search]);

  const openDetail = async (phone: string) => {
    setSelected(null);
    setDetailLoading(true);
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

        {/* Header */}
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
            <StatCard value={`${stats.daysSinceLastOrder ?? "?"} días`} label="Último pedido" color={stats.daysSinceLastOrder > 30 ? "#ef4444" : "var(--adm-text)"} />
          </div>
        </div>

        {/* Funnel */}
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

        {/* Platos más pedidos */}
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

        {/* Platos vistos pero no pedidos */}
        {viewedOnlyDishes.length > 0 && (
          <div style={{ ...cardStyle, marginTop: 10 }}>
            <label style={sectionLabelStyle}>Vio pero nunca pidió <span style={{ color: "#ef4444", fontSize: "0.65rem" }}>→ oportunidad de cupón</span></label>
            {viewedOnlyDishes.map((d, i) => (
              <div key={i} style={rowStyle}>
                <span style={{ fontFamily: FB, fontSize: "0.84rem", color: "var(--adm-text)", flex: 1 }}>{d.dishName}</span>
                <span style={{ fontFamily: F, fontSize: "0.72rem", color: BLUE }}>{d.viewCount} vista{d.viewCount > 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        )}

        {/* Historial de pedidos */}
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
                    {new Date(o.createdAt).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })} · {o.orderType === "DELIVERY" ? "Delivery" : "Retiro"}
                  </p>
                </div>
                <span style={pillStyle(o.paymentStatus === "paid" ? GREEN : GOLD, "sm")}>{o.paymentStatus === "paid" ? "Pagado" : o.paymentStatus}</span>
                <span style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text)", fontWeight: 600 }}>{clp(o.total)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Timeline de eventos */}
        {storeEvents.length > 0 && (
          <div style={{ ...cardStyle, marginTop: 10 }}>
            <label style={sectionLabelStyle}>Timeline de actividad en el store</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 8 }}>
              {storeEvents.slice(0, 30).map((e) => {
                const meta = e.metadata as any;
                const label = EVENT_LABELS[e.eventType] || e.eventType;
                const detail = meta?.dishName || meta?.query || (meta?.cartItems ? `${meta.cartItems.length} ítems` : "") || meta?.orderId || "";
                return (
                  <div key={e.id} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "4px 0", borderBottom: "1px solid var(--adm-card-border)" }}>
                    <span style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", flexShrink: 0, width: 72 }}>
                      {new Date(e.createdAt).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
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
    <div style={{ maxWidth: 740 }}>
      {/* Overview */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 20 }} className="adm-grid-2">
        <StatCard value={overview.totalCustomers} label="Clientes únicos" color={GOLD} />
        <StatCard value={clp(overview.totalRevenue)} label="Revenue total" color={GREEN} />
        <StatCard value={clp(overview.avgTicket)} label="Ticket promedio" color={BLUE} />
        <StatCard value={`${overview.totalCustomers > 0 ? Math.round(overview.repeatCustomers / overview.totalCustomers * 100) : 0}%`} label="Recompra" color={GOLD} />
      </div>

      {/* Search + list */}
      <input
        placeholder="Buscar por nombre, teléfono o email..."
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(1); }}
        style={searchInputStyle}
      />

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
                  <p style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", margin: 0 }}>{timeAgo(c.lastOrderAt)}</p>
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

      {pages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={pageBtnStyle(page <= 1)}>Anterior</button>
          <span style={{ fontFamily: F, fontSize: "0.8rem", color: "var(--adm-text2)", padding: "8px 12px" }}>{page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} style={pageBtnStyle(page >= pages)}>Siguiente</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL — Tabs
// ═══════════════════════════════════════════════════════════════════════════════

export default function UsuariosPage() {
  const [tab, setTab] = useState<"qr" | "ecommerce">("qr");

  return (
    <div style={{ maxWidth: 800 }}>
      <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: GOLD, margin: "0 0 4px" }}>Usuarios</h1>

      {/* Tab selector */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--adm-card-border)", paddingBottom: 0 }}>
        {([
          { key: "qr" as const, label: "Carta QR" },
          { key: "ecommerce" as const, label: "Ecommerce" },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "8px 18px",
              background: "none",
              border: "none",
              borderBottom: tab === t.key ? `2px solid ${GOLD}` : "2px solid transparent",
              color: tab === t.key ? GOLD : "var(--adm-text3)",
              fontFamily: F,
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "qr" ? <QRTab /> : <EcomTab />}
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: "var(--adm-card)",
  border: "1px solid var(--adm-card-border)",
  borderRadius: 14,
  padding: "16px 18px",
};

const backBtnStyle: React.CSSProperties = {
  background: "none", border: "none", color: GOLD, fontFamily: F,
  fontSize: "0.85rem", cursor: "pointer", marginBottom: 16,
};

const sectionLabelStyle: React.CSSProperties = {
  fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)",
  textTransform: "uppercase", letterSpacing: "0.06em",
};

const metaLabelStyle: React.CSSProperties = {
  fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)",
  textTransform: "uppercase", display: "block",
};

const metaValStyle: React.CSSProperties = {
  fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text)", margin: "2px 0 0",
};

const rowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10,
  padding: "6px 0", borderBottom: "1px solid var(--adm-card-border)",
};

const listRowBtnStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 12,
  padding: "10px 12px", background: "var(--adm-card)",
  border: "1px solid var(--adm-card-border)", borderRadius: 10,
  cursor: "pointer", width: "100%", textAlign: "left",
};

const searchInputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", marginBottom: 12,
  background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)",
  borderRadius: 10, color: "var(--adm-text)", fontFamily: F, fontSize: "0.85rem",
  outline: "none", boxSizing: "border-box",
};

function pillStyle(color: string, size: "sm" | "md" = "md"): React.CSSProperties {
  return {
    padding: size === "sm" ? "2px 8px" : "4px 12px",
    borderRadius: 50,
    fontFamily: F,
    fontSize: size === "sm" ? "0.65rem" : "0.72rem",
    fontWeight: 600,
    background: `${color}18`,
    color,
  };
}

function pageBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "8px 16px", borderRadius: 8,
    border: "1px solid var(--adm-card-border)",
    background: disabled ? "transparent" : "var(--adm-hover)",
    color: disabled ? "var(--adm-text3)" : "var(--adm-text)",
    fontFamily: F, fontSize: "0.8rem",
    cursor: disabled ? "default" : "pointer",
  };
}
