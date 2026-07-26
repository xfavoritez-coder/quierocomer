"use client";
import { useState } from "react";
import { X, ChevronLeft, MessageCircle, MapPin, Clock, AlertTriangle, Package, Truck } from "lucide-react";
import { useCart } from "./OrderCartContext";
import { useOrderLang } from "./OrderLangContext";

const F = "var(--font-display, 'Inter', sans-serif)";
const FB = "var(--font-body, 'Inter', sans-serif)";
const ACCENT = "var(--carta-accent, #F4A623)";

function formatCLP(n: number) {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

interface OrderingConfig {
  phone: string;
  delivery: "PICKUP" | "DELIVERY" | "BOTH";
  minAmount: number | null;
  waitTime: string | null;
  note: string | null;
  address: string | null;
}

interface Props {
  restaurantName: string;
  restaurantSlug: string;
  orderingConfig: OrderingConfig;
  onBack: () => void;
  onClose: () => void;
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px",
  border: "1.5px solid var(--carta-border, #e5e5e5)",
  borderRadius: 10, fontFamily: FB, fontSize: "0.85rem",
  color: "var(--carta-text, #111)", background: "var(--carta-surface, #fafafa)",
  outline: "none", boxSizing: "border-box",
};

export default function OrderCheckout({ restaurantName, restaurantSlug, orderingConfig, onBack, onClose }: Props) {
  const { items, total, clearCart } = useCart();
  const { s } = useOrderLang();
  const { delivery, minAmount, waitTime, note, address, phone } = orderingConfig;

  const showPickup = delivery === "PICKUP" || delivery === "BOTH";
  const showDelivery = delivery === "DELIVERY" || delivery === "BOTH";

  const [name, setName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [orderType, setOrderType] = useState<"PICKUP" | "DELIVERY">(showPickup ? "PICKUP" : "DELIVERY");
  const [clientAddress, setClientAddress] = useState("");
  const [orderNotes, setOrderNotes] = useState("");

  const belowMin = orderType === "DELIVERY" && minAmount != null && total < minAmount;

  const isValid =
    name.trim().length >= 2 &&
    clientPhone.trim().length >= 8 &&
    (orderType === "PICKUP" || clientAddress.trim().length >= 5) &&
    !belowMin;

  const buildWhatsAppMessage = () => {
    const lines: string[] = [];
    lines.push(s.waMsgTitle(restaurantName));
    lines.push("");
    lines.push(`*${s.waMsgName}* ${name.trim()}`);
    lines.push(`*${s.waMsgPhone}* ${clientPhone.trim()}`);
    lines.push(`*${s.waMsgType}* ${orderType === "PICKUP" ? s.waMsgPickup : s.waMsgDelivery}`);
    if (orderType === "DELIVERY" && clientAddress.trim()) {
      lines.push(`*${s.waMsgAddress}* ${clientAddress.trim()}`);
    }
    if (orderType === "PICKUP" && address) {
      lines.push(`*${s.waMsgLocal}* ${address}`);
    }
    lines.push("");
    lines.push(s.waMsgProducts);
    for (const item of items) {
      const optText = item.selectedOptions.length > 0
        ? item.selectedOptions.map(o => `  - ${o.optionName}${o.priceAdjustment !== 0 ? ` (${o.priceAdjustment > 0 ? "+" : ""}${formatCLP(o.priceAdjustment)})` : ""}`).join("\n")
        : null;
      lines.push(`- ${item.quantity}x ${item.dishName} - ${formatCLP(item.unitTotal * item.quantity)}`);
      if (optText) lines.push(optText);
      if (item.notes) lines.push(`  ${s.itemNote} ${item.notes}`);
    }
    lines.push("");
    lines.push(s.waMsgTotal(formatCLP(total)));
    if (orderNotes.trim()) {
      lines.push("");
      lines.push(`*${s.waMsgNotes}* ${orderNotes.trim()}`);
    }
    lines.push("");
    lines.push(s.waMsgFooter(restaurantSlug));
    return lines.join("\n");
  };

  const sendOrder = () => {
    if (!isValid) return;
    const msg = buildWhatsAppMessage();
    const waPhone = phone.replace(/\D/g, "");
    if (!waPhone) {
      navigator.clipboard?.writeText(msg).catch(() => {});
      alert(s.noPhone);
      return;
    }
    const url = `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
    clearCart();
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 950,
        background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
        display: "flex", justifyContent: "center", alignItems: "flex-end",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--carta-bg, #fff)", borderRadius: "20px 20px 0 0",
          width: "100%", maxWidth: 520, maxHeight: "92dvh",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px", borderBottom: "1px solid var(--carta-border, #eee)", flexShrink: 0 }}>
          <button onClick={onBack} style={{ width: 32, height: 32, borderRadius: "50%", border: "none", cursor: "pointer", background: "var(--carta-surface, #f5f5f5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ChevronLeft size={18} color="var(--carta-text2, #666)" />
          </button>
          <span style={{ fontFamily: F, fontWeight: 700, fontSize: "0.95rem", color: "var(--carta-text, #111)", flex: 1 }}>
            {s.checkoutTitle}
          </span>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: "50%", border: "none", cursor: "pointer", background: "var(--carta-surface, #f5f5f5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={15} color="var(--carta-text2, #666)" />
          </button>
        </div>

        {/* Form */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 18px 0" }}>

          {/* Order type selector */}
          {delivery === "BOTH" && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontFamily: F, fontSize: "0.75rem", fontWeight: 700, color: "var(--carta-text2, #777)", textTransform: "uppercase", letterSpacing: ".04em", margin: "0 0 8px" }}>
                {s.howReceive}
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                {showPickup && (
                  <button
                    onClick={() => setOrderType("PICKUP")}
                    style={{
                      flex: 1, padding: "12px 8px", borderRadius: 10, cursor: "pointer",
                      border: `1.5px solid ${orderType === "PICKUP" ? ACCENT : "var(--carta-border, #e5e5e5)"}`,
                      background: orderType === "PICKUP" ? "rgba(244,166,35,0.08)" : "var(--carta-surface, #fafafa)",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                    }}
                  >
                    <Package size={18} color={orderType === "PICKUP" ? "#F4A623" : "var(--carta-text2, #999)"} />
                    <span style={{ fontFamily: F, fontSize: "0.78rem", fontWeight: 600, color: orderType === "PICKUP" ? "#F4A623" : "var(--carta-text2, #777)" }}>{s.pickupLabel}</span>
                  </button>
                )}
                {showDelivery && (
                  <button
                    onClick={() => setOrderType("DELIVERY")}
                    style={{
                      flex: 1, padding: "12px 8px", borderRadius: 10, cursor: "pointer",
                      border: `1.5px solid ${orderType === "DELIVERY" ? ACCENT : "var(--carta-border, #e5e5e5)"}`,
                      background: orderType === "DELIVERY" ? "rgba(244,166,35,0.08)" : "var(--carta-surface, #fafafa)",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                    }}
                  >
                    <Truck size={18} color={orderType === "DELIVERY" ? "#F4A623" : "var(--carta-text2, #999)"} />
                    <span style={{ fontFamily: F, fontSize: "0.78rem", fontWeight: 600, color: orderType === "DELIVERY" ? "#F4A623" : "var(--carta-text2, #777)" }}>{s.deliveryLabel}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Pickup address info */}
          {orderType === "PICKUP" && address && (
            <div style={{ background: "var(--carta-surface, #f5f5f5)", borderRadius: 10, padding: "10px 12px", marginBottom: 18, display: "flex", alignItems: "flex-start", gap: 8 }}>
              <MapPin size={15} color={ACCENT} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <p style={{ fontFamily: F, fontSize: "0.72rem", fontWeight: 600, color: "var(--carta-text2, #777)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: ".04em" }}>{s.pickupAt}</p>
                <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--carta-text, #111)", margin: 0 }}>{address}</p>
              </div>
            </div>
          )}

          {/* Wait time */}
          {waitTime && (
            <div style={{ background: "rgba(244,166,35,0.07)", borderRadius: 10, padding: "10px 12px", marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={15} color={ACCENT} />
              <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--carta-text, #111)", margin: 0 }}>
                {s.estimatedTime} <strong>{waitTime}</strong>
              </p>
            </div>
          )}

          {/* Your data */}
          <p style={{ fontFamily: F, fontSize: "0.75rem", fontWeight: 700, color: "var(--carta-text2, #777)", textTransform: "uppercase", letterSpacing: ".04em", margin: "0 0 10px" }}>
            {s.yourDetails}
          </p>

          <div style={{ marginBottom: 12 }}>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              style={inputStyle}
              placeholder={s.namePlaceholder}
              autoComplete="name"
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <input
              value={clientPhone}
              onChange={e => setClientPhone(e.target.value)}
              style={inputStyle}
              placeholder={s.phonePlaceholder}
              type="tel"
              autoComplete="tel"
            />
          </div>

          {/* Address for delivery */}
          {orderType === "DELIVERY" && (
            <div style={{ marginBottom: 12 }}>
              <input
                value={clientAddress}
                onChange={e => setClientAddress(e.target.value)}
                style={inputStyle}
                placeholder={s.addressPlaceholder}
                autoComplete="street-address"
              />
            </div>
          )}

          {/* Min amount warning */}
          {belowMin && minAmount != null && (
            <div style={{ display: "flex", gap: 8, background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
              <AlertTriangle size={15} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "#ef4444", margin: 0 }}>
                {s.belowMin(formatCLP(minAmount), formatCLP(total))}
              </p>
            </div>
          )}

          {/* Notes */}
          <div style={{ marginBottom: 18 }}>
            <textarea
              value={orderNotes}
              onChange={e => setOrderNotes(e.target.value)}
              style={{ ...inputStyle, resize: "none", minHeight: 64 }}
              placeholder={s.orderNotes}
            />
          </div>

          {/* Order summary */}
          <div style={{ borderTop: "1px solid var(--carta-border, #eee)", paddingTop: 16, marginBottom: 18 }}>
            <p style={{ fontFamily: F, fontSize: "0.75rem", fontWeight: 700, color: "var(--carta-text2, #777)", textTransform: "uppercase", letterSpacing: ".04em", margin: "0 0 10px" }}>
              {s.summary}
            </p>
            {items.map(item => (
              <div key={item.key} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--carta-text, #111)" }}>
                  {item.quantity}× {item.dishName}
                  {item.selectedOptions.length > 0 && (
                    <span style={{ display: "block", fontSize: "0.7rem", color: "var(--carta-text2, #999)" }}>
                      {item.selectedOptions.map(o => o.optionName).join(", ")}
                    </span>
                  )}
                </span>
                <span style={{ fontFamily: F, fontWeight: 600, fontSize: "0.82rem", color: "var(--carta-text, #111)", flexShrink: 0, marginLeft: 8 }}>
                  {formatCLP(item.unitTotal * item.quantity)}
                </span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--carta-border, #eee)", paddingTop: 10, marginTop: 10 }}>
              <span style={{ fontFamily: F, fontWeight: 700, fontSize: "0.88rem", color: "var(--carta-text, #111)" }}>{s.total}</span>
              <span style={{ fontFamily: F, fontWeight: 700, fontSize: "0.95rem", color: ACCENT }}>{formatCLP(total)}</span>
            </div>
          </div>

          {/* Custom note */}
          {note && (
            <div style={{ background: "var(--carta-surface, #f5f5f5)", borderRadius: 10, padding: "10px 12px", marginBottom: 18 }}>
              <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--carta-text2, #666)", margin: 0, lineHeight: 1.5 }}>{note}</p>
            </div>
          )}
        </div>

        {/* Send button */}
        <div style={{ padding: "14px 18px", borderTop: "1px solid var(--carta-border, #eee)", background: "var(--carta-bg, #fff)", flexShrink: 0, paddingBottom: "max(14px, env(safe-area-inset-bottom, 14px))" }}>
          <button
            onClick={sendOrder}
            disabled={!isValid}
            style={{
              width: "100%", padding: "15px 16px", borderRadius: 14, border: "none",
              background: isValid ? "#25D366" : "var(--carta-border, #ddd)",
              color: isValid ? "#fff" : "#aaa",
              fontFamily: F, fontSize: "0.92rem", fontWeight: 700,
              cursor: isValid ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              transition: "all 0.15s",
            }}
          >
            <MessageCircle size={20} />
            {s.sendWhatsApp}
          </button>
          <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--carta-text2, #999)", textAlign: "center", margin: "8px 0 0" }}>
            {s.whatsAppHint}
          </p>
        </div>
      </div>
    </div>
  );
}
