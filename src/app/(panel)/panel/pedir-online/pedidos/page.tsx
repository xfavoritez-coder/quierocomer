"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { supabase } from "@/lib/supabase";
import { ClipboardList, ChevronDown, ChevronUp } from "lucide-react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

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
function OrderCard({
  order,
  isNew,
  onStatusChange,
}: {
  order: Order;
  isNew: boolean;
  onStatusChange: (id: string, status: OrderStatus, reason?: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelForm, setShowCancelForm] = useState(false);
  const items = Array.isArray(order.items) ? order.items : [];
  const actions = NEXT_ACTIONS[order.status] ?? [];
  const statusColor = STATUS_COLOR[order.status];

  const handleAction = async (status: OrderStatus) => {
    if (status === "CANCELLED") {
      setShowCancelForm(true);
      return;
    }
    setBusy(true);
    try {
      await onStatusChange(order.id, status);
    } finally {
      setBusy(false);
    }
  };

  const handleCancelConfirm = async () => {
    if (!cancelReason.trim()) return;
    setBusy(true);
    try {
      await onStatusChange(order.id, "CANCELLED", cancelReason.trim());
    } finally {
      setBusy(false);
      setShowCancelForm(false);
    }
  };

  const isPending = order.status === "PENDING";

  return (
    <>
      <style>{`
        @keyframes pendingPulse {
          0%, 100% { box-shadow: 0 0 0 0 ${ORANGE}44; }
          50%       { box-shadow: 0 0 0 6px ${ORANGE}00; }
        }
        @keyframes newOrderGlow {
          0%   { box-shadow: 0 0 0 0 ${GREEN}66; border-color: ${GREEN}; }
          50%  { box-shadow: 0 0 0 10px ${GREEN}11; border-color: ${GREEN}; }
          100% { box-shadow: 0 0 0 0 ${GREEN}00; border-color: ${GREEN}; }
        }
        .pending-card { animation: pendingPulse 2s ease-in-out infinite; }
        .new-order-card { animation: newOrderGlow 1s ease-in-out 4; }
      `}</style>
      <div
        className={isNew ? "new-order-card" : isPending ? "pending-card" : ""}
        style={{
          background: "var(--adm-card)",
          border: `2px solid ${isNew ? GREEN : isPending ? ORANGE : "var(--adm-card-border)"}`,
          borderRadius: 14,
          overflow: "hidden",
          transition: "border-color 0.4s",
        }}
      >
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
              {isNew && (
                <span style={{
                  fontSize: "0.65rem", fontWeight: 800, fontFamily: F, padding: "2px 8px",
                  borderRadius: 999, background: GREEN + "22", color: GREEN, letterSpacing: ".04em",
                }}>
                  ¡NUEVO!
                </span>
              )}
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
                  background: action.status === "CANCELLED" ? action.color + "18" : action.color,
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

        {/* Cancel reason form */}
        {showCancelForm && (
          <div style={{ padding: "0 16px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ fontFamily: F, fontSize: "0.75rem", fontWeight: 600, color: RED, margin: 0 }}>
              ¿Por qué se cancela este pedido?
            </p>
            <textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="Ej: No hay stock del producto, local cerrado, fuera de zona de reparto..."
              rows={2}
              style={{
                width: "100%", padding: "8px 10px", borderRadius: 8, boxSizing: "border-box",
                border: `1.5px solid ${RED}44`, background: "var(--adm-input, var(--adm-hover))",
                color: "var(--adm-text)", fontFamily: FB, fontSize: "0.82rem", resize: "none", outline: "none",
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                disabled={!cancelReason.trim() || busy}
                onClick={handleCancelConfirm}
                style={{
                  padding: "7px 16px", borderRadius: 8, border: "none",
                  background: RED, color: "#fff", fontFamily: F, fontSize: "0.78rem", fontWeight: 700,
                  cursor: !cancelReason.trim() || busy ? "not-allowed" : "pointer",
                  opacity: !cancelReason.trim() || busy ? 0.5 : 1,
                }}
              >
                Confirmar cancelación
              </button>
              <button
                type="button"
                onClick={() => { setShowCancelForm(false); setCancelReason(""); }}
                style={{
                  padding: "7px 14px", borderRadius: 8, border: "1.5px solid var(--adm-card-border)",
                  background: "none", color: "var(--adm-text2)", fontFamily: F, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer",
                }}
              >
                Volver
              </button>
            </div>
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
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PedidosPage() {
  const { selectedRestaurantId } = useAdminSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<TabId>("active");
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());
  const prevPendingCountRef = useRef<number | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [pushState, setPushState] = useState<"unknown" | "unsupported" | "denied" | "inactive" | "active">("unknown");

  // Push subscription state check on mount
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushState("unsupported");
      return;
    }
    if (Notification.permission === "denied") { setPushState("denied"); return; }
    navigator.serviceWorker.register("/sw-orders.js")
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => setPushState(sub ? "active" : "inactive"))
      .catch(() => setPushState("inactive"));
  }, []);

  const subscribeToPush = useCallback(async () => {
    if (!selectedRestaurantId) return;
    try {
      const reg = await navigator.serviceWorker.register("/sw-orders.js");
      await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setPushState("denied"); return; }
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
        });
      }
      await fetch("/api/panel/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: selectedRestaurantId, subscription: sub.toJSON() }),
      });
      setPushState("active");
    } catch { setPushState("inactive"); }
  }, [selectedRestaurantId]);

  const unsubscribeFromPush = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw-orders.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/panel/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setPushState("inactive");
    } catch { setPushState("inactive"); }
  }, []);

  const playNotification = useCallback(() => {
    try {
      const ctx = new AudioContext();
      // Bell tone: layered harmonics with exponential decay
      [[880, 0.5], [1320, 0.25], [1760, 0.15], [2200, 0.08]].forEach(([freq, amp]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(amp, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.8);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 1.8);
      });
      // Second chime after 0.4s
      setTimeout(() => {
        [[1100, 0.4], [1650, 0.2]].forEach(([freq, amp]) => {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.type = "sine";
          osc2.frequency.setValueAtTime(freq, ctx.currentTime);
          gain2.gain.setValueAtTime(amp, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.4);
          osc2.start(ctx.currentTime);
          osc2.stop(ctx.currentTime + 1.4);
        });
      }, 400);
    } catch {}
  }, []);

  const markOrderAsNew = useCallback((orderId: string) => {
    setNewOrderIds(prev => new Set(prev).add(orderId));
    setTimeout(() => {
      setNewOrderIds(prev => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }, 6000);
  }, []);

  const fetchOrders = useCallback(async (isPolling = false) => {
    if (!selectedRestaurantId) return;
    try {
      const res = await fetch(`/api/panel/orders?restaurantId=${selectedRestaurantId}`);
      const data = await res.json();
      const fetched: Order[] = data.orders || [];

      if (isPolling) {
        // Detect new PENDING orders that weren't there before
        setOrders(prev => {
          const prevIds = new Set(prev.map(o => o.id));
          const newPendings = fetched.filter(o => o.status === "PENDING" && !prevIds.has(o.id));
          if (newPendings.length > 0) {
            playNotification();
            setTab("active");
            newPendings.forEach(o => markOrderAsNew(o.id));
          }
          return fetched;
        });
      } else {
        setOrders(fetched);
        prevPendingCountRef.current = fetched.filter(o => o.status === "PENDING").length;
      }
    } catch {}
  }, [selectedRestaurantId, playNotification, markOrderAsNew]);

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
              playNotification();
              setTab("active");
              markOrderAsNew(newOrder.id);
            }
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as Order;
            setOrders(prev => prev.map(o => o.id === updated.id ? { ...o, ...updated } : o));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedRestaurantId, playNotification, markOrderAsNew]);

  const handleStatusChange = async (orderId: string, status: OrderStatus, reason?: string) => {
    const res = await fetch("/api/panel/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, status, ...(reason ? { cancellationReason: reason } : {}) }),
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
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <ClipboardList size={20} color={GOLD} />
        <h2 style={{ fontFamily: F, fontSize: "1rem", fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>
          Pedidos en vivo
        </h2>
        {pendingCount > 0 && (
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "50%", background: ORANGE, color: "#fff", fontFamily: F, fontSize: "0.72rem", fontWeight: 800 }}>
            {pendingCount}
          </span>
        )}
        {pushState !== "unsupported" && (
          <button
            type="button"
            onClick={pushState === "active" ? unsubscribeFromPush : subscribeToPush}
            title={pushState === "active" ? "Desactivar notificaciones" : pushState === "denied" ? "Notificaciones bloqueadas en el navegador" : "Activar notificaciones push"}
            style={{
              marginLeft: "auto",
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 8,
              border: `1.5px solid ${pushState === "active" ? GREEN + "55" : "var(--adm-card-border)"}`,
              background: pushState === "active" ? GREEN + "18" : "var(--adm-card)",
              color: pushState === "active" ? GREEN : pushState === "denied" ? RED : "var(--adm-text2)",
              fontFamily: F, fontSize: "0.73rem", fontWeight: 600, cursor: "pointer",
            }}
          >
            {pushState === "active" ? "🔔 Notificaciones activas" : pushState === "denied" ? "🔕 Bloqueadas" : "🔔 Activar notificaciones"}
          </button>
        )}
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
              onClick={() => setTab(t.id)}
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
            <OrderCard
              key={order.id}
              order={order}
              isNew={newOrderIds.has(order.id)}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

    </div>
  );
}
