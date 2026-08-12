"use client";
import { useEffect, useState } from "react";
import { use } from "react";
import { supabase } from "@/lib/supabase";

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
  restaurantPhone: string | null;
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
  updatedAt: string;
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

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

function Stepper({ status, orderType, createdAt, updatedAt }: { status: string; orderType: "PICKUP" | "DELIVERY"; createdAt: string; updatedAt: string }) {
  const steps = getSteps(orderType);
  const currentStep = STATUS_STEP[status] ?? 0;

  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 0, width: "100%", overflowX: "auto", padding: "8px 0" }}>
      {steps.map((step, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        const color = done ? GREEN : active ? ACCENT : GRAY;
        const timeLabel = i === 0 ? fmtTime(createdAt) : (active || done) && i === currentStep ? fmtTime(updatedAt) : null;

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
              {timeLabel && (
                <span style={{ fontFamily: FONT, fontSize: 9, color: "#aaa", marginTop: 2, textAlign: "center" }}>
                  {timeLabel}
                </span>
              )}
            </div>
            {/* Connector */}
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: 2, background: i < currentStep ? GREEN : "#e5e7eb",
                marginBottom: 28, minWidth: 8,
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

  // Initial fetch
  useEffect(() => {
    fetch(`/api/pedido/${orderId}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: OrderData) => setOrder(data))
      .catch(() => setError(true));
  }, [orderId]);

  // Supabase Realtime — escucha cambios en este pedido específico
  useEffect(() => {
    const channel = supabase
      .channel(`pedido-${orderId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "OnlineOrder",
        filter: `id=eq.${orderId}`,
      }, (payload) => {
        setOrder(prev => prev ? { ...prev, status: (payload.new as any).status } : prev);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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
    const waPhone = order.restaurantPhone?.replace(/\D/g, "");
    return (
      <div style={{ minHeight: "100vh", background: "#fafafa", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 320 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>😔</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: RED, margin: "0 0 8px" }}>Pedido cancelado</h2>
          <p style={{ fontSize: 14, color: "#666", margin: "0 0 20px", lineHeight: 1.6 }}>
            Lamentamos informarte que tu pedido fue cancelado.
          </p>
          {waPhone && (
            <a
              href={`https://wa.me/${waPhone}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "12px 20px", borderRadius: 12,
                background: "#25D366", color: "#fff",
                fontWeight: 700, fontSize: 14, textDecoration: "none",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Contactar a {order.restaurantName}
            </a>
          )}
          {!waPhone && (
            <p style={{ fontSize: 13, color: "#999" }}>Contacta al local para más información.</p>
          )}
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
          <Stepper status={order.status} orderType={order.orderType} createdAt={order.createdAt} updatedAt={order.updatedAt} />
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

        {/* Realtime indicator */}
        <p style={{ fontSize: 12, color: "#bbb", textAlign: "center", margin: 0 }}>
          ⚡ En vivo
        </p>
      </div>
    </div>
  );
}
