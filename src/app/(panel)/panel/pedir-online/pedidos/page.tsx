"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { supabase } from "@/lib/supabase";
import { ClipboardList, RefreshCw, ChevronDown, ChevronUp, Bell } from "lucide-react";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";
const GREEN = "#22c55e";
const BLUE = "#3b82f6";
const ORANGE = "#f97316";
const RED = "#ef4444";
const GRAY = "#6b7280";

type OrderStatus = "PENDING" | "ACCEPTED" | "PREPARING" | "IN_DELIVERY" | "READY" | "DONE" | "CANCELLED";
type OrderType = "PICKUP" | "DELIVERY";
type PayMethod = "efectivo" | "transferencia" | "tarjeta";

interface CartItem {
  dishName: string;
  quantity: number;
  unitTotal: number;
  notes?: string;
  selectedOptions?: { optionName: string; priceAdjustment: number }[];
}

interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  orderType: OrderType;
  deliveryAddress: string | null;
  paymentMethod: PayMethod;
  items: CartItem[];
  total: number;
  notes: string | null;
  status: OrderStatus;
  createdAt: string;
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING:     "Nuevo",
  ACCEPTED:    "Aceptado",
  PREPARING:   "Preparando",
  IN_DELIVERY: "En reparto",
  READY:       "Listo",
  DONE:        "Entregado",
  CANCELLED:   "Cancelado",
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  PENDING:     ORANGE,
  ACCEPTED:    BLUE,
  PREPARING:   GOLD,
  IN_DELIVERY: GREEN,
  READY:       GREEN,
  DONE:        GRAY,
  CANCELLED:   RED,
};

// Next action buttons per status
const NEXT_ACTIONS: Record<OrderStatus, { status: OrderStatus; label: string; color: string }[]> = {
  PENDING:     [{ status: "ACCEPTED", label: "Aceptar", color: BLUE }, { status: "CANCELLED", label: "Rechazar", color: RED }],
  ACCEPTED:    [{ status: "PREPARING", label: "Preparando", color: GOLD }, { status: "CANCELLED", label: "Cancelar", color: RED }],
  PREPARING:   [
    { status: "IN_DELIVERY", label: "En reparto", color: GREEN },
    { status: "READY", label: "Listo", color: GREEN },
    { status: "CANCELLED", label: "Cancelar", color: RED },
  ],
  IN_DELIVERY: [{ status: "DONE", label: "Entregado", color: GRAY }],
  READY:       [{ status: "DONE", label: "Entregado", color: GRAY }],
  DONE:        [],
  CANCELLED:   [],
};

// Tab groupings
const TABS = [
  { id: "active",  label: "Activos",   statuses: ["PENDING", "ACCEPTED", "PREPARING"] as OrderStatus[] },
  { id: "out",     label: "En curso",  statuses: ["IN_DELIVERY", "READY"] as OrderStatus[] },
  { id: "history", label: "Historial", statuses: ["DONE", "CANCELLED"] as OrderStatus[] },
] as const;

type TabId = "active" | "out" | "history";

function fmt(n: number) {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "hace un momento";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}

// ─── Order card ───────────────────────────────────────────────────────────────
function OrderCard({ order, onStatusChange }: { order: Order; onStatusChange: (id: string, status: OrderStatus) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const items = Array.isArray(order.items) ? order.items : [];
  const actions = NEXT_ACTIONS[order.status] ?? [];
  const isNew = order.status === "PENDING";
  const statusColor = STATUS_COLOR[order.status];

  const handleAction = async (status: OrderStatus) => {
    setBusy(true);
    try {
      await onStatusChange(order.id, status);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      background: "var(--adm-card)",
      border: `1.5px solid ${isNew ? ORANGE + "55" : "var(--adm-card-border)"}`,
      borderRadius: 14,
      overflow: "hidden",
      boxShadow: isNew ? `0 0 0 3px ${ORANGE}18` : undefined,
    }}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
      >
        {/* Status dot */}
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: statusColor, flexShrink: 0 }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: "var(--adm-text)" }}>
              {order.customerName}
            </span>
            <span style={{
              fontSize: "0.68rem", fontWeight: 700, fontFamily: F, padding: "2px 8px",
              borderRadius: 999, background: statusColor + "22", color: statusColor,
            }}>
              {STATUS_LABEL[order.status]}
            </span>
            <span style={{
              fontSize: "0.68rem", fontFamily: FB, padding: "2px 8px", borderRadius: 999,
              background: "var(--adm-hover)", color: "var(--adm-text2)",
            }}>
              {order.orderType === "PICKUP" ? "🏠 Retiro" : "🛵 Delivery"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
            <span style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)" }}>{relativeTime(order.createdAt)}</span>
            <span style={{ fontFamily: F, fontSize: "0.78rem", fontWeight: 700, color: "var(--adm-text2)" }}>{fmt(order.total)}</span>
            <span style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)" }}>
              {items.length} producto{items.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        {open ? <ChevronUp size={16} color="var(--adm-text3)" /> : <ChevronDown size={16} color="var(--adm-text3)" />}
      </button>

      {/* Actions (always visible for active orders) */}
      {actions.length > 0 && (
        <div style={{ padding: "0 16px 14px", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {actions.map(action => (
            <button
              key={action.status}
              type="button"
              disabled={busy}
              onClick={(e) => { e.stopPropagation(); handleAction(action.status); }}
              style={{
                padding: "7px 16px", borderRadius: 8,
                border: action.status === "CANCELLED" ? `1.5px solid ${action.color}44` : "none",
                cursor: busy ? "not-allowed" : "pointer",
                background: action.color + (action.status === "CANCELLED" ? "18" : ""),
                color: action.status === "CANCELLED" ? action.color : "#fff",
                fontFamily: F, fontSize: "0.78rem", fontWeight: 700,
                opacity: busy ? 0.6 : 1,
                transition: "all 0.15s",
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Expanded detail */}
      {open && (
        <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--adm-card-border)", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Customer info */}
          <div style={{ paddingTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
            <div>
              <p style={{ fontFamily: F, fontSize: "0.65rem", fontWeight: 600, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: ".06em", margin: "0 0 2px" }}>Teléfono</p>
              <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text)", margin: 0 }}>
                <a href={`tel:${order.customerPhone}`} style={{ color: "inherit", textDecoration: "none" }}>{order.customerPhone}</a>
              </p>
            </div>
            {order.customerEmail && (
              <div>
                <p style={{ fontFamily: F, fontSize: "0.65rem", fontWeight: 600, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: ".06em", margin: "0 0 2px" }}>Email</p>
                <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text)", margin: 0, wordBreak: "break-all" }}>{order.customerEmail}</p>
              </div>
            )}
            <div>
              <p style={{ fontFamily: F, fontSize: "0.65rem", fontWeight: 600, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: ".06em", margin: "0 0 2px" }}>Pago</p>
              <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text)", margin: 0 }}>
                {{ efectivo: "Efectivo", transferencia: "Transferencia", tarjeta: "Tarjeta" }[order.paymentMethod]}
              </p>
            </div>
            {order.orderType === "DELIVERY" && order.deliveryAddress && (
              <div style={{ gridColumn: "1 / -1" }}>
                <p style={{ fontFamily: F, fontSize: "0.65rem", fontWeight: 600, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: ".06em", margin: "0 0 2px" }}>Dirección</p>
                <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text)", margin: 0 }}>{order.deliveryAddress}</p>
              </div>
            )}
            <div>
              <p style={{ fontFamily: F, fontSize: "0.65rem", fontWeight: 600, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: ".06em", margin: "0 0 2px" }}>Hora</p>
              <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text)", margin: 0 }}>
                {new Date(order.createdAt).toLocaleString("es-CL", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
              </p>
            </div>
          </div>

          {/* Items */}
          <div>
            <p style={{ fontFamily: F, fontSize: "0.68rem", fontWeight: 600, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: ".06em", margin: "0 0 8px" }}>Productos</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {items.map((item, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 10px", background: "var(--adm-hover)", borderRadius: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 600, color: "var(--adm-text)", margin: 0 }}>
                      {item.quantity}× {item.dishName}
                    </p>
                    {item.selectedOptions && item.selectedOptions.length > 0 && (
                      <p style={{ fontFamily: FB, fontSize: "0.73rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>
                        {item.selectedOptions.map(o => o.optionName).join(", ")}
                      </p>
                    )}
                    {item.notes && (
                      <p style={{ fontFamily: FB, fontSize: "0.73rem", color: "var(--adm-text3)", margin: "2px 0 0", fontStyle: "italic" }}>
                        Nota: {item.notes}
                      </p>
                    )}
                  </div>
                  <span style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-text)", flexShrink: 0 }}>
                    {fmt(item.unitTotal * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Total + notes */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
            {order.notes ? (
              <div>
                <p style={{ fontFamily: F, fontSize: "0.65rem", fontWeight: 600, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: ".06em", margin: "0 0 2px" }}>Notas</p>
                <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: 0 }}>{order.notes}</p>
              </div>
            ) : <div />}
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <p style={{ fontFamily: F, fontSize: "0.65rem", fontWeight: 600, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: ".06em", margin: "0 0 2px" }}>Total</p>
              <p style={{ fontFamily: F, fontSize: "1.1rem", fontWeight: 800, color: GOLD, margin: 0 }}>{fmt(order.total)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PedidosPage() {
  const { selectedRestaurantId } = useAdminSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<TabId>("active");
  const [newAlert, setNewAlert] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevPendingCountRef = useRef<number | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const playNotification = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJiVkHBRUGmim5J2VVVwpaCYgGJhfLCpoI2Agoy1rqePgoWPvranmZCRlcO8s6yjmaKqy8Owp6CkqtLKv7Cwt7/a0ca8yszS3NbOxsvP2OHb08jL0trl4NfN0NXg6uXc0tLX4evn3tXU2+Pt6+Pc2d/l7+3k3d3i6O/u5uDf5Ovx7+ji4+bp7/Hv6OXm6u3w8O3p6Ors7fDy8Ovp6u3u8PLx7erq7O3v8fHu6+vs7u/x8O3r7O3u8PDv7Ozs7e7v8O/t7Ozs7e7w7+3t7e3u7+/u7e3t7e7u7+7t7e3t7u7v7u3t7e3u7u7u7e3t7e3u7u7t7e3t7e3u7e7t7e3t7e3t7e3t7e3t7e3t7e0=");
    }
    audioRef.current.play().catch(() => {});
  }, []);

  const fetchOrders = useCallback(async (isPolling = false) => {
    if (!selectedRestaurantId) return;
    try {
      const res = await fetch(`/api/panel/orders?restaurantId=${selectedRestaurantId}`);
      const data = await res.json();
      const fetched: Order[] = data.orders || [];
      setOrders(fetched);

      // Polling-based new order detection
      if (isPolling) {
        const newPendingCount = fetched.filter(o => o.status === "PENDING").length;
        const prev = prevPendingCountRef.current;
        if (prev !== null && newPendingCount > prev) {
          setNewAlert(true);
          playNotification();
          setTab("active");
        }
        prevPendingCountRef.current = newPendingCount;
      } else {
        // On initial load, just record baseline
        prevPendingCountRef.current = fetched.filter(o => o.status === "PENDING").length;
      }
    } catch {}
  }, [selectedRestaurantId, playNotification]);

  // Initial fetch + polling fallback every 10s
  useEffect(() => {
    fetchOrders(false);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(() => fetchOrders(true), 10000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [fetchOrders]);

  // Supabase Realtime subscription
  useEffect(() => {
    if (!selectedRestaurantId) return;

    const channel = supabase
      .channel(`orders-${selectedRestaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "OnlineOrder",
          filter: `restaurantId=eq.${selectedRestaurantId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newOrder = payload.new as Order;
            setOrders(prev => [newOrder, ...prev]);
            if (newOrder.status === "PENDING") {
              setNewAlert(true);
              playNotification();
              setTab("active");
            }
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as Order;
            setOrders(prev => prev.map(o => o.id === updated.id ? { ...o, ...updated } : o));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedRestaurantId, playNotification]);

  const handleStatusChange = async (orderId: string, status: OrderStatus) => {
    const res = await fetch("/api/panel/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, status }),
    });
    if (res.ok) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    }
  };

  const currentTab = TABS.find(t => t.id === tab)!;
  const tabOrders = orders.filter(o => (currentTab.statuses as readonly string[]).includes(o.status));

  const pendingCount = orders.filter(o => o.status === "PENDING").length;
  const todayOrders = orders.filter(o => new Date(o.createdAt).toDateString() === new Date().toDateString());
  const todayRevenue = todayOrders.filter(o => o.status !== "CANCELLED").reduce((s, o) => s + o.total, 0);

  return (
    <div style={{ maxWidth: 680 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ClipboardList size={20} color={GOLD} />
          <h2 style={{ fontFamily: F, fontSize: "1rem", fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>
            Pedidos en vivo
          </h2>
          {pendingCount > 0 && (
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "50%", background: ORANGE, color: "#fff", fontFamily: F, fontSize: "0.72rem", fontWeight: 800 }}>
              {pendingCount}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => { setNewAlert(false); fetchOrders(false); }}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "1.5px solid var(--adm-card-border)", background: newAlert ? ORANGE + "18" : "var(--adm-card)", color: newAlert ? ORANGE : "var(--adm-text2)", fontFamily: F, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}
        >
          {newAlert ? <Bell size={14} /> : <RefreshCw size={14} />}
          {newAlert ? "Nuevo pedido" : "Actualizar"}
        </button>
      </div>

      {/* Stats hoy */}
      {todayOrders.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Pedidos hoy", value: String(todayOrders.filter(o => o.status !== "CANCELLED").length) },
            { label: "Ingresos hoy", value: fmt(todayRevenue) },
            { label: "Ticket promedio", value: todayOrders.filter(o => o.status !== "CANCELLED").length > 0 ? fmt(Math.round(todayRevenue / todayOrders.filter(o => o.status !== "CANCELLED").length)) : "-" },
          ].map(s => (
            <div key={s.label} style={{ padding: "12px 14px", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12 }}>
              <p style={{ fontFamily: F, fontSize: "0.63rem", fontWeight: 600, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: ".06em", margin: "0 0 4px" }}>{s.label}</p>
              <p style={{ fontFamily: F, fontSize: "1rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid var(--adm-card-border)", paddingBottom: 0 }}>
        {TABS.map(t => {
          const count = orders.filter(o => (t.statuses as readonly string[]).includes(o.status)).length;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => { setTab(t.id); if (t.id === "active") setNewAlert(false); }}
              style={{
                padding: "9px 14px", border: "none", borderBottom: `2px solid ${active ? GOLD : "transparent"}`,
                background: "none", color: active ? GOLD : "var(--adm-text2)",
                fontFamily: F, fontSize: "0.8rem", fontWeight: active ? 700 : 500,
                cursor: "pointer", marginBottom: -1, display: "flex", alignItems: "center", gap: 6,
                transition: "all 0.15s",
              }}
            >
              {t.label}
              {count > 0 && (
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999,
                  background: t.id === "active" && count > 0 ? ORANGE + "22" : "var(--adm-hover)",
                  color: t.id === "active" && count > 0 ? ORANGE : "var(--adm-text3)",
                  fontSize: "0.65rem", fontWeight: 700,
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Orders list */}
      {tabOrders.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--adm-text3)", fontFamily: FB, fontSize: "0.88rem" }}>
          {tab === "active" ? "No hay pedidos nuevos ahora. Llegarán aquí en tiempo real." :
           tab === "out" ? "No hay pedidos en reparto o listos para retirar." :
           "El historial está vacío."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tabOrders.map(order => (
            <OrderCard key={order.id} order={order} onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}

      {/* Realtime indicator */}
      <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)", textAlign: "center", marginTop: 24 }}>
        ⚡ Tiempo real · 🔄 Respaldo cada 10s
      </p>
    </div>
  );
}
