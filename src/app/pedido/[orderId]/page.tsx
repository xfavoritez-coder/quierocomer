"use client";
import { useEffect, useRef, useState } from "react";
import { use } from "react";

interface OrderItem {
  dishName: string;
  quantity: number;
  unitTotal: number;
  selectedOptions?: { optionName: string }[];
  notes?: string;
}

interface OrderData {
  id: string;
  restaurantName: string;
  restaurantLogoUrl: string | null;
  customerName: string;
  orderType: "PICKUP" | "DELIVERY";
  items: OrderItem[];
  total: number;
  deliveryAddress: string | null;
  paymentMethod: string;
  status: string;
  notes: string | null;
  estimatedTime: string | null;
  createdAt: string;
}

const ACCENT = "#F4A623";
const GREEN = "#22c55e";
const RED = "#ef4444";
const GRAY = "#9ca3af";
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

function fmt(n: number) {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

const PAY_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
};

// Status to step index mapping
const STATUS_STEP: Record<string, number> = {
  PENDING: 0,
  ACCEPTED: 1,
  PREPARING: 2,
  IN_DELIVERY: 3,
  READY: 3,
  DONE: 4,
  CANCELLED: -1,
};

function getSteps(orderType: "PICKUP" | "DELIVERY") {
  return [
    { icon: "📋", label: "Recibido" },
    { icon: "✅", label: "Aceptado" },
    { icon: "👨‍🍳", label: "Preparando" },
    orderType === "DELIVERY"
      ? { icon: "🛵", label: "En reparto" }
      : { icon: "🏁", label: "Listo para retirar" },
    { icon: "🎉", label: "Entregado" },
  ];
}

function Stepper({ status, orderType }: { status: string; orderType: "PICKUP" | "DELIVERY" }) {
  const steps = getSteps(orderType);
  const currentStep = STATUS_STEP[status] ?? 0;

  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 0, width: "100%", overflowX: "auto", padding: "8px 0" }}>
      {steps.map((step, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        const color = done ? GREEN : active ? ACCENT : GRAY;

        return (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
            {/* Step */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 56 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: done ? GREEN + "22" : active ? ACCENT + "22" : "#f3f4f6",
                border: `2px solid ${color}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, flexShrink: 0,
              }}>
                {done ? "✓" : step.icon}
              </div>
              <span style={{
                fontFamily: FONT, fontSize: 10, fontWeight: active ? 700 : 500,
                color, marginTop: 4, textAlign: "center", lineHeight: 1.2,
                maxWidth: 56, wordBreak: "break-word",
              }}>
                {step.label}
              </span>
            </div>
            {/* Connector */}
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: 2, background: i < currentStep ? GREEN : "#e5e7eb",
                marginBottom: 20, minWidth: 8,
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function PedidoPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  const [order, setOrder] = useState<OrderData | null>(null);
  const [error, setError] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrder = async () => {
    try {
      const res = await fetch(`/api/pedido/${orderId}`);
      if (!res.ok) {
        setError(true);
        return;
      }
      const data: OrderData = await res.json();
      setOrder(data);
      // Stop polling if terminal state
      if (data.status === "DONE" || data.status === "CANCELLED") {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    } catch {
      setError(true);
    }
  };

  useEffect(() => {
    fetchOrder();
    intervalRef.current = setInterval(fetchOrder, 6000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const cardStyle: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: 16,
    padding: "20px 18px",
    marginBottom: 16,
  };

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "#fafafa", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, padding: 24 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>😕</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111", margin: "0 0 8px" }}>Pedido no encontrado</h2>
          <p style={{ fontSize: 14, color: "#666", margin: 0 }}>Verifica el enlace o contacta al local.</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div style={{ minHeight: "100vh", background: "#fafafa", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT }}>
        <div style={{ textAlign: "center", color: "#999" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <p style={{ fontSize: 14 }}>Cargando tu pedido...</p>
        </div>
      </div>
    );
  }

  // CANCELLED screen
  if (order.status === "CANCELLED") {
    return (
      <div style={{ minHeight: "100vh", background: "#fafafa", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, padding: 24 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>😔</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: RED, margin: "0 0 8px" }}>Pedido cancelado</h2>
          <p style={{ fontSize: 14, color: "#666", margin: 0, lineHeight: 1.6 }}>
            Lamentamos informarte que tu pedido fue cancelado.<br />Puedes contactar al local para más información.
          </p>
        </div>
      </div>
    );
  }

  // DONE screen
  if (order.status === "DONE") {
    return (
      <div style={{ minHeight: "100vh", background: "#fafafa", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, padding: 24 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: GREEN, margin: "0 0 8px" }}>¡Pedido entregado!</h2>
          <p style={{ fontSize: 14, color: "#666", margin: 0, lineHeight: 1.6 }}>
            Gracias por tu pedido en <strong>{order.restaurantName}</strong>.<br />¡Esperamos que lo hayas disfrutado!
          </p>
        </div>
      </div>
    );
  }

  const items = Array.isArray(order.items) ? order.items : [];

  return (
    <div style={{ minHeight: "100vh", background: "#fafafa", fontFamily: FONT }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px 48px" }}>

        {/* Restaurant header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          {order.restaurantLogoUrl ? (
            <img
              src={order.restaurantLogoUrl}
              alt={order.restaurantName}
              style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", display: "inline-block", marginBottom: 8 }}
            />
          ) : (
            <div style={{
              width: 48, height: 48, borderRadius: "50%", background: ACCENT + "22",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, fontWeight: 700, color: ACCENT, marginBottom: 8,
            }}>
              {order.restaurantName.charAt(0).toUpperCase()}
            </div>
          )}
          <h1 style={{ fontFamily: FONT, fontSize: 18, fontWeight: 700, color: "#111", margin: 0 }}>
            {order.restaurantName}
          </h1>
          <p style={{ fontSize: 13, color: "#666", margin: "4px 0 0" }}>Seguimiento de pedido</p>
        </div>

        {/* Stepper */}
        <div style={{ ...cardStyle, padding: "20px 12px" }}>
          <Stepper status={order.status} orderType={order.orderType} />
        </div>

        {/* Order summary card */}
        <div style={cardStyle}>
          {/* Order type badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              background: ACCENT + "18", color: ACCENT,
              fontWeight: 700, fontSize: 12, padding: "4px 10px", borderRadius: 999,
            }}>
              {order.orderType === "DELIVERY" ? "🛵 Delivery" : "🏠 Retiro"}
            </span>
          </div>

          {/* Delivery address */}
          {order.orderType === "DELIVERY" && order.deliveryAddress && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 2px" }}>Dirección</p>
              <p style={{ fontSize: 14, color: "#111", margin: 0 }}>{order.deliveryAddress}</p>
            </div>
          )}

          {/* Estimated time */}
          {order.estimatedTime && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 2px" }}>Tiempo estimado</p>
              <p style={{ fontSize: 14, color: "#111", margin: 0 }}>⏱ {order.estimatedTime}</p>
            </div>
          )}

          {/* Divider */}
          <div style={{ height: 1, background: "#f0f0f0", margin: "14px 0" }} />

          {/* Items */}
          <p style={{ fontSize: 11, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 10px" }}>Productos</p>
          {items.map((item, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: 14, color: "#111", fontWeight: 500 }}>
                  {item.quantity}× {item.dishName}
                </span>
                {item.selectedOptions && item.selectedOptions.length > 0 && (
                  <p style={{ fontSize: 12, color: "#888", margin: "2px 0 0" }}>
                    {item.selectedOptions.map(o => o.optionName).join(", ")}
                  </p>
                )}
                {item.notes && (
                  <p style={{ fontSize: 12, color: "#888", margin: "2px 0 0", fontStyle: "italic" }}>
                    Nota: {item.notes}
                  </p>
                )}
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#111", flexShrink: 0, marginLeft: 12 }}>
                {fmt(item.unitTotal * item.quantity)}
              </span>
            </div>
          ))}

          {/* Total */}
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid #f0f0f0", marginTop: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>Total</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: ACCENT }}>{fmt(order.total)}</span>
          </div>

          {/* Payment method */}
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 2px" }}>Forma de pago</p>
            <p style={{ fontSize: 14, color: "#111", margin: 0 }}>{PAY_LABELS[order.paymentMethod] ?? order.paymentMethod}</p>
          </div>

          {/* Notes */}
          {order.notes && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 2px" }}>Notas</p>
              <p style={{ fontSize: 14, color: "#555", margin: 0, fontStyle: "italic" }}>{order.notes}</p>
            </div>
          )}
        </div>

        {/* Auto-refresh indicator */}
        <p style={{ fontSize: 12, color: "#bbb", textAlign: "center", margin: 0 }}>
          🔄 Actualizando cada 6 segundos
        </p>
      </div>
    </div>
  );
}
