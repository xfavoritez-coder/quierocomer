"use client";
import { useState, useEffect, useCallback } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { ClipboardList, ChevronDown, ChevronUp } from "lucide-react";
import SkeletonLoading from "@/components/admin/SkeletonLoading";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

type OrderType = "PICKUP" | "DELIVERY";
type PayMethod = "efectivo" | "transferencia" | "tarjeta";
type OrderStatus = "PENDING" | "CONFIRMED" | "READY" | "DONE" | "CANCELLED";

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
  orderType: OrderType;
  deliveryAddress: string | null;
  paymentMethod: PayMethod;
  items: CartItem[];
  total: number;
  notes: string | null;
  status: OrderStatus;
  createdAt: string;
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmado",
  READY: "Listo",
  DONE: "Entregado",
  CANCELLED: "Cancelado",
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  PENDING: "#d97706",
  CONFIRMED: "#2563eb",
  READY: "#16a34a",
  DONE: "#6b7280",
  CANCELLED: "#dc2626",
};

const PAY_LABEL: Record<PayMethod, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
};

function fmt(n: number) {
  return `$${n.toLocaleString("es-CL")}`;
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "hace un momento";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  return new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}

function OrderCard({ order }: { order: Order }) {
  const [open, setOpen] = useState(false);
  const items = Array.isArray(order.items) ? order.items : [];

  return (
    <div style={{
      background: "var(--adm-card)",
      border: "1px solid var(--adm-card-border)",
      borderRadius: 12,
      overflow: "hidden",
    }}>
      {/* Header row */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 12,
          padding: "14px 16px", background: "none", border: "none", cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 700, color: "var(--adm-text)" }}>
              {order.customerName}
            </span>
            <span style={{
              fontSize: "0.68rem", fontWeight: 700, fontFamily: F, padding: "2px 8px",
              borderRadius: 999, background: STATUS_COLOR[order.status] + "22",
              color: STATUS_COLOR[order.status],
            }}>
              {STATUS_LABEL[order.status]}
            </span>
            <span style={{
              fontSize: "0.68rem", fontFamily: FB, padding: "2px 8px", borderRadius: 999,
              background: "var(--adm-hover)", color: "var(--adm-text2)",
            }}>
              {order.orderType === "PICKUP" ? "Retiro" : "Delivery"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
            <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)" }}>
              {relativeTime(order.createdAt)}
            </span>
            <span style={{ fontFamily: F, fontSize: "0.78rem", fontWeight: 700, color: "var(--adm-text2)" }}>
              {fmt(order.total)}
            </span>
            <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)" }}>
              {items.length} producto{items.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        {open ? <ChevronUp size={16} color="var(--adm-text3)" /> : <ChevronDown size={16} color="var(--adm-text3)" />}
      </button>

      {/* Expanded detail */}
      {open && (
        <div style={{
          padding: "0 16px 16px",
          borderTop: "1px solid var(--adm-card-border)",
          display: "flex", flexDirection: "column", gap: 14,
        }}>
          {/* Customer info */}
          <div style={{ paddingTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
            <div>
              <p style={{ fontFamily: F, fontSize: "0.68rem", fontWeight: 600, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: ".06em", margin: "0 0 2px" }}>Teléfono</p>
              <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text)", margin: 0 }}>{order.customerPhone}</p>
            </div>
            <div>
              <p style={{ fontFamily: F, fontSize: "0.68rem", fontWeight: 600, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: ".06em", margin: "0 0 2px" }}>Pago</p>
              <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text)", margin: 0 }}>{PAY_LABEL[order.paymentMethod]}</p>
            </div>
            {order.orderType === "DELIVERY" && order.deliveryAddress && (
              <div style={{ gridColumn: "1 / -1" }}>
                <p style={{ fontFamily: F, fontSize: "0.68rem", fontWeight: 600, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: ".06em", margin: "0 0 2px" }}>Dirección delivery</p>
                <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text)", margin: 0 }}>{order.deliveryAddress}</p>
              </div>
            )}
            <div>
              <p style={{ fontFamily: F, fontSize: "0.68rem", fontWeight: 600, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: ".06em", margin: "0 0 2px" }}>Fecha</p>
              <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text)", margin: 0 }}>
                {new Date(order.createdAt).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>

          {/* Items */}
          <div>
            <p style={{ fontFamily: F, fontSize: "0.72rem", fontWeight: 600, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: ".06em", margin: "0 0 8px" }}>Productos</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {items.map((item, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 10px", background: "var(--adm-hover)", borderRadius: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 600, color: "var(--adm-text)", margin: 0 }}>
                      {item.quantity}× {item.dishName}
                    </p>
                    {item.selectedOptions && item.selectedOptions.length > 0 && (
                      <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>
                        {item.selectedOptions.map(o => o.optionName).join(", ")}
                      </p>
                    )}
                    {item.notes && (
                      <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)", margin: "2px 0 0", fontStyle: "italic" }}>
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
                <p style={{ fontFamily: F, fontSize: "0.68rem", fontWeight: 600, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: ".06em", margin: "0 0 2px" }}>Notas</p>
                <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: 0 }}>{order.notes}</p>
              </div>
            ) : <div />}
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <p style={{ fontFamily: F, fontSize: "0.68rem", fontWeight: 600, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: ".06em", margin: "0 0 2px" }}>Total</p>
              <p style={{ fontFamily: F, fontSize: "1.1rem", fontWeight: 800, color: GOLD, margin: 0 }}>{fmt(order.total)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PedidosPage() {
  const { selectedRestaurantId } = useAdminSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "PICKUP" | "DELIVERY">("all");

  const load = useCallback(() => {
    if (!selectedRestaurantId) return;
    setLoading(true);
    fetch(`/api/panel/orders?restaurantId=${selectedRestaurantId}`)
      .then(r => r.json())
      .then(d => setOrders(d.orders || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedRestaurantId]);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === "all" ? orders : orders.filter(o => o.orderType === filter);

  const todayOrders = orders.filter(o => {
    const d = new Date(o.createdAt);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });
  const todayTotal = todayOrders.reduce((sum, o) => sum + o.total, 0);

  if (loading) return <SkeletonLoading />;

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <ClipboardList size={20} color={GOLD} />
          <h2 style={{ fontFamily: F, fontSize: "1rem", fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>
            Pedidos recibidos
          </h2>
        </div>
        <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: 0 }}>
          Historial de pedidos online de tu local.
        </p>
      </div>

      {/* Stats hoy */}
      {todayOrders.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Pedidos hoy", value: String(todayOrders.length) },
            { label: "Ingresos hoy", value: fmt(todayTotal) },
            { label: "Ticket promedio", value: fmt(Math.round(todayTotal / todayOrders.length)) },
          ].map(s => (
            <div key={s.label} style={{ padding: "12px 14px", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12 }}>
              <p style={{ fontFamily: F, fontSize: "0.68rem", fontWeight: 600, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: ".06em", margin: "0 0 4px" }}>{s.label}</p>
              <p style={{ fontFamily: F, fontSize: "1.05rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {([["all", "Todos"], ["PICKUP", "Retiro"], ["DELIVERY", "Delivery"]] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            style={{
              padding: "7px 14px", borderRadius: 8, border: `1.5px solid ${filter === key ? GOLD : "var(--adm-card-border)"}`,
              background: filter === key ? "rgba(244,166,35,0.1)" : "var(--adm-card)",
              color: filter === key ? GOLD : "var(--adm-text2)",
              fontFamily: F, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--adm-text3)", fontFamily: FB, fontSize: "0.88rem" }}>
          {orders.length === 0 ? "Aún no hay pedidos. Aparecerán aquí cuando llegue el primero." : "No hay pedidos con ese filtro."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(order => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
