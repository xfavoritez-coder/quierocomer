"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { X, ChevronLeft, MessageCircle, MapPin, Clock, AlertTriangle, Package, Truck, Banknote, CreditCard, ArrowLeftRight, CheckCircle2 } from "lucide-react";
import { useCart } from "./OrderCartContext";

const MapView = dynamic(() => import("@/app/a/components/LocationMapView"), {
  ssr: false,
  loading: () => <div style={{ width: "100%", height: "100%", background: "var(--carta-surface, #f5f5f5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "var(--carta-text2, #999)" }}>Cargando mapa…</div>,
});

const F = "var(--font-display, 'Inter', sans-serif)";
const FB = "var(--font-body, 'Inter', sans-serif)";
const ACCENT = "var(--carta-accent, #F4A623)";

function formatCLP(n: number) {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

// ─── Phone country selector ──────────────────────────────────────────────────
const PHONE_COUNTRIES = [
  {
    code: "CL",
    dial: "+56",
    placeholder: "9 1234 5678",
    maxDigits: 9,
    flag: (
      <svg width="20" height="14" viewBox="0 0 20 14" style={{ borderRadius: 2, flexShrink: 0 }}>
        <rect width="20" height="7" fill="#fff"/>
        <rect y="7" width="20" height="7" fill="#D52B1E"/>
        <rect width="7" height="7" fill="#0039A6"/>
        <polygon points="3.5,1.5 4.1,3.3 6,3.3 4.5,4.4 5,6.2 3.5,5.1 2,6.2 2.5,4.4 1,3.3 2.9,3.3" fill="#fff"/>
      </svg>
    ),
  },
  {
    code: "US",
    dial: "+1",
    placeholder: "555 123 4567",
    maxDigits: 10,
    flag: (
      <svg width="20" height="14" viewBox="0 0 20 14" style={{ borderRadius: 2, flexShrink: 0 }}>
        <rect width="20" height="14" fill="#B22234"/>
        <rect y="1.08" width="20" height="1.08" fill="#fff"/>
        <rect y="3.23" width="20" height="1.08" fill="#fff"/>
        <rect y="5.38" width="20" height="1.08" fill="#fff"/>
        <rect y="7.54" width="20" height="1.08" fill="#fff"/>
        <rect y="9.69" width="20" height="1.08" fill="#fff"/>
        <rect y="11.85" width="20" height="1.08" fill="#fff"/>
        <rect width="8" height="7.54" fill="#3C3B6E"/>
      </svg>
    ),
  },
] as const;

type CountryCode = "CL" | "US";

function formatPhone(v: string, country: CountryCode) {
  const c = PHONE_COUNTRIES.find(p => p.code === country)!;
  const d = v.replace(/\D/g, "").slice(0, c.maxDigits);
  if (country === "US") {
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
    return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  }
  if (d.length <= 1) return d;
  if (d.length <= 5) return `${d[0]} ${d.slice(1)}`;
  return `${d[0]} ${d.slice(1, 5)} ${d.slice(5)}`;
}

function buildFullPhone(local: string, country: CountryCode): string {
  const digits = local.replace(/\D/g, "");
  const dial = PHONE_COUNTRIES.find(p => p.code === country)!.dial;
  return `${dial}${digits}`;
}

function PhoneCountrySelector({ country, onChange }: { country: CountryCode; onChange: (c: CountryCode) => void }) {
  const [open, setOpen] = useState(false);
  const current = PHONE_COUNTRIES.find(p => p.code === country)!;
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "0 10px", height: "100%", minHeight: 42,
          background: "var(--carta-surface, #f0f0f0)",
          border: "1.5px solid var(--carta-border, #e5e5e5)",
          borderRadius: 10, color: "var(--carta-text, #111)",
          fontSize: 13, cursor: "pointer", whiteSpace: "nowrap",
        }}
      >
        {current.flag}
        <span style={{ fontWeight: 600 }}>{current.dial}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ marginLeft: 2 }}>
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 9 }} />
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 100,
            background: "var(--carta-bg, #fff)",
            border: "1.5px solid var(--carta-border, #e5e5e5)",
            borderRadius: 12, overflow: "hidden", minWidth: 150,
            boxShadow: "0 8px 24px rgba(0,0,0,.15)",
          }}>
            {PHONE_COUNTRIES.map(c => (
              <button
                key={c.code}
                type="button"
                onClick={() => { onChange(c.code); setOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  width: "100%", padding: "10px 14px", border: "none", cursor: "pointer",
                  background: c.code === country ? "var(--carta-surface, #f5f5f5)" : "transparent",
                  color: "var(--carta-text, #111)", fontSize: 14,
                  fontWeight: c.code === country ? 700 : 400,
                }}
              >
                {c.flag}
                <span>{c.dial}</span>
                <span style={{ color: "var(--carta-text2, #999)", fontSize: 12 }}>{c.code}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main types & styles ─────────────────────────────────────────────────────
interface OrderingConfig {
  phone: string;
  delivery: "PICKUP" | "DELIVERY" | "BOTH";
  minAmount: number | null;
  waitTime: string | null;
  note: string | null;
  address: string | null;
  paymentMethods?: string[];
}

interface Props {
  restaurantName: string;
  restaurantSlug: string;
  orderingConfig: OrderingConfig;
  onBack: () => void;
  onClose: () => void;
  orderingMode?: string;
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px",
  border: "1.5px solid var(--carta-border, #e5e5e5)",
  borderRadius: 10, fontFamily: FB, fontSize: "0.85rem",
  color: "var(--carta-text, #111)", background: "var(--carta-surface, #fafafa)",
  outline: "none", boxSizing: "border-box",
};

export default function OrderCheckout({ restaurantName, restaurantSlug, orderingConfig, onBack, onClose, orderingMode }: Props) {
  const { items, total, clearCart } = useCart();
  const { delivery, minAmount, waitTime, note, address, phone, paymentMethods = ["efectivo", "transferencia", "tarjeta"] } = orderingConfig;
  const isPanelMode = orderingMode === "panel";

  const showPickup = delivery === "PICKUP" || delivery === "BOTH";
  const showDelivery = delivery === "DELIVERY" || delivery === "BOTH";

  const [name, setName] = useState("");
  const [dialCountry, setDialCountry] = useState<CountryCode>("CL");
  const [clientPhone, setClientPhone] = useState("");
  const [email, setEmail] = useState("");
  const [orderType, setOrderType] = useState<"PICKUP" | "DELIVERY">(showPickup ? "PICKUP" : "DELIVERY");
  const [clientAddress, setClientAddress] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"efectivo" | "transferencia" | "tarjeta" | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<{ display_name: string; place_id: string | number }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [addressCoords, setAddressCoords] = useState<{ lat: number; lng: number } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const belowMin = orderType === "DELIVERY" && minAmount != null && total < minAmount;
  const phoneDigits = clientPhone.replace(/\D/g, "");

  const handleAddressChange = useCallback((value: string) => {
    setClientAddress(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 3) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geo/search?q=${encodeURIComponent(value)}&all=1`);
        const data = await res.json();
        setAddressSuggestions((Array.isArray(data) ? data : []).slice(0, 5));
        setShowSuggestions(true);
      } catch {
        // ignore
      }
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const isValid =
    name.trim().length >= 2 &&
    phoneDigits.length >= 8 &&
    (!isPanelMode || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) &&
    (orderType === "PICKUP" || clientAddress.trim().length >= 5) &&
    paymentMethod !== null &&
    !belowMin;

  const buildWhatsAppMessage = () => {
    const lines: string[] = [];
    lines.push(`*Pedido - ${restaurantName}*`);
    lines.push("");
    lines.push(`*Nombre:* ${name.trim()}`);
    lines.push(`*Telefono:* ${buildFullPhone(clientPhone, dialCountry)}`);
    lines.push(`*Tipo:* ${orderType === "PICKUP" ? "Retiro en local" : "Delivery"}`);
    if (orderType === "DELIVERY" && clientAddress.trim()) {
      lines.push(`*Direccion:* ${clientAddress.trim()}`);
    }
    if (orderType === "PICKUP" && address) {
      lines.push(`*Local:* ${address}`);
    }
    const payLabels = { efectivo: "Efectivo", transferencia: "Transferencia", tarjeta: "Tarjeta (presencial)" };
    if (paymentMethod) lines.push(`*Pago:* ${payLabels[paymentMethod]}`);
    lines.push("");
    lines.push("*Productos:*");
    for (const item of items) {
      const optText = item.selectedOptions.length > 0
        ? item.selectedOptions.map(o => `  - ${o.optionName}${o.priceAdjustment !== 0 ? ` (${o.priceAdjustment > 0 ? "+" : ""}${formatCLP(o.priceAdjustment)})` : ""}`).join("\n")
        : null;
      lines.push(`- ${item.quantity}x ${item.dishName} - ${formatCLP(item.unitTotal * item.quantity)}`);
      if (optText) lines.push(optText);
      if (item.notes) lines.push(`  Nota: ${item.notes}`);
    }
    lines.push("");
    lines.push(`*Total: ${formatCLP(total)}*`);
    if (orderNotes.trim()) {
      lines.push("");
      lines.push(`*Notas:* ${orderNotes.trim()}`);
    }
    lines.push("");
    lines.push(`_Pedido enviado desde quierocomer.com/pedir/${restaurantSlug}_`);
    return lines.join("\n");
  };

  const sendOrder = async () => {
    if (!isValid || sending) return;
    setSending(true);
    setSendError(null);

    if (isPanelMode) {
      try {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            restaurantSlug,
            customerName: name.trim(),
            customerPhone: buildFullPhone(clientPhone, dialCountry),
            customerEmail: email.trim() || null,
            orderType,
            deliveryAddress: orderType === "DELIVERY" ? clientAddress.trim() : null,
            paymentMethod,
            items,
            total,
            notes: orderNotes.trim() || null,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          clearCart();
          window.location.href = `/pedido/${data.id}`;
        } else {
          const errData = await res.json().catch(() => ({}));
          setSendError(errData.error || "No se pudo enviar el pedido. Intenta de nuevo.");
          setSending(false);
        }
      } catch {
        setSendError("Error de conexión. Intenta de nuevo.");
        setSending(false);
      }
      return;
    }

    // WhatsApp mode
    fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantSlug,
        customerName: name.trim(),
        customerPhone: buildFullPhone(clientPhone, dialCountry),
        orderType,
        deliveryAddress: orderType === "DELIVERY" ? clientAddress.trim() : null,
        paymentMethod,
        items,
        total,
        notes: orderNotes.trim() || null,
      }),
    }).catch(() => {});

    const msg = buildWhatsAppMessage();
    const waPhone = phone.replace(/\D/g, "");
    if (!waPhone) {
      navigator.clipboard?.writeText(msg).catch(() => {});
      alert("El local no tiene número de WhatsApp configurado. Se copió el pedido al portapapeles.");
      setSending(false);
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
      <style>{`
        .oc-input::placeholder { color: var(--carta-text2, #999); opacity: 0.45; }
        .oc-phone-input { flex: 1; padding: 11px 14px; border: 1.5px solid var(--carta-border, #e5e5e5); border-left: none; border-radius: 0 10px 10px 0; font-family: ${FB}; font-size: 0.85rem; color: var(--carta-text, #111); background: var(--carta-surface, #fafafa); outline: none; box-sizing: border-box; min-width: 0; }
        .oc-phone-input::placeholder { color: var(--carta-text2, #999); opacity: 0.45; }
        .oc-phone-selector { border-radius: 10px 0 0 10px !important; border-right: none !important; }
      `}</style>
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
            Finalizar pedido
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
                ¿Cómo quieres recibir tu pedido?
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                {showPickup && (
                  <button
                    onClick={() => setOrderType("PICKUP")}
                    style={{
                      flex: 1, padding: "12px 8px", borderRadius: 10, cursor: "pointer",
                      border: `1.5px solid ${orderType === "PICKUP" ? ACCENT : "var(--carta-border, #e5e5e5)"}`,
                      background: orderType === "PICKUP" ? "var(--carta-bg, #fff)" : "var(--carta-surface, #fafafa)",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                    }}
                  >
                    <Package size={18} color={orderType === "PICKUP" ? ACCENT : "var(--carta-text2, #999)"} />
                    <span style={{ fontFamily: F, fontSize: "0.78rem", fontWeight: 600, color: orderType === "PICKUP" ? ACCENT : "var(--carta-text2, #777)" }}>Retiro</span>
                  </button>
                )}
                {showDelivery && (
                  <button
                    onClick={() => setOrderType("DELIVERY")}
                    style={{
                      flex: 1, padding: "12px 8px", borderRadius: 10, cursor: "pointer",
                      border: `1.5px solid ${orderType === "DELIVERY" ? ACCENT : "var(--carta-border, #e5e5e5)"}`,
                      background: orderType === "DELIVERY" ? "var(--carta-bg, #fff)" : "var(--carta-surface, #fafafa)",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                    }}
                  >
                    <Truck size={18} color={orderType === "DELIVERY" ? ACCENT : "var(--carta-text2, #999)"} />
                    <span style={{ fontFamily: F, fontSize: "0.78rem", fontWeight: 600, color: orderType === "DELIVERY" ? ACCENT : "var(--carta-text2, #777)" }}>Delivery</span>
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
                <p style={{ fontFamily: F, fontSize: "0.72rem", fontWeight: 600, color: "var(--carta-text2, #777)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: ".04em" }}>Retira en</p>
                <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--carta-text, #111)", margin: 0 }}>{address}</p>
              </div>
            </div>
          )}

          {/* Wait time */}
          {waitTime && (
            <div style={{ background: "rgba(244,166,35,0.07)", borderRadius: 10, padding: "10px 12px", marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={15} color={ACCENT} />
              <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--carta-text, #111)", margin: 0 }}>
                Tiempo estimado: <strong>{waitTime}</strong>
              </p>
            </div>
          )}

          {/* Your data */}
          <p style={{ fontFamily: F, fontSize: "0.75rem", fontWeight: 700, color: "var(--carta-text2, #777)", textTransform: "uppercase", letterSpacing: ".04em", margin: "0 0 10px" }}>
            Tus datos
          </p>

          <div style={{ marginBottom: 12 }}>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="oc-input"
              style={inputStyle}
              placeholder="Tu nombre *"
              autoComplete="name"
            />
          </div>

          {/* Phone with country selector */}
          <div style={{ marginBottom: 12, display: "flex" }}>
            <div className="oc-phone-selector" style={{ flexShrink: 0 }}>
              <PhoneCountrySelector
                country={dialCountry}
                onChange={(c) => { setDialCountry(c); setClientPhone(""); }}
              />
            </div>
            <input
              value={clientPhone}
              onChange={e => setClientPhone(formatPhone(e.target.value, dialCountry))}
              className="oc-phone-input"
              placeholder={PHONE_COUNTRIES.find(p => p.code === dialCountry)!.placeholder + " *"}
              type="tel"
              autoComplete="tel"
            />
          </div>

          {/* Email (panel mode only) */}
          {isPanelMode && (
            <div style={{ marginBottom: 12 }}>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="oc-input"
                style={inputStyle}
                placeholder="Tu email para recibir notificaciones *"
                type="email"
                autoComplete="email"
              />
            </div>
          )}

          {/* Payment method */}
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontFamily: F, fontSize: "0.75rem", fontWeight: 700, color: "var(--carta-text2, #777)", textTransform: "uppercase", letterSpacing: ".04em", margin: "0 0 8px" }}>
              Forma de pago
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              {([
                { value: "efectivo", label: "Efectivo", Icon: Banknote },
                { value: "transferencia", label: "Transferencia", Icon: ArrowLeftRight },
                { value: "tarjeta", label: "Tarjeta", Icon: CreditCard },
              ] as const).filter(opt => paymentMethods.includes(opt.value)).map(({ value, label, Icon }) => {
                const active = paymentMethod === value;
                return (
                  <button
                    key={value}
                    onClick={() => setPaymentMethod(value)}
                    style={{
                      flex: 1, padding: "11px 6px", borderRadius: 10, cursor: "pointer",
                      border: `1.5px solid ${active ? ACCENT : "var(--carta-border, #e5e5e5)"}`,
                      background: active ? "var(--carta-bg, #fff)" : "var(--carta-surface, #fafafa)",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                    }}
                  >
                    <Icon size={17} color={active ? "var(--carta-accent, #F4A623)" : "var(--carta-text2, #999)"} />
                    <span style={{ fontFamily: F, fontSize: "0.72rem", fontWeight: active ? 700 : 500, color: active ? ACCENT : "var(--carta-text2, #999)" }}>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Address for delivery — with autocomplete */}
          {orderType === "DELIVERY" && (
            <div style={{ marginBottom: 12 }}>
            <div style={{ position: "relative" }}>
              <input
                value={clientAddress}
                onChange={e => handleAddressChange(e.target.value)}
                onFocus={() => { if (addressSuggestions.length > 0) setShowSuggestions(true); }}
                onBlur={() => { setTimeout(() => setShowSuggestions(false), 150); }}
                className="oc-input"
                style={inputStyle}
                placeholder="Dirección de delivery *"
                autoComplete="off"
              />
              {showSuggestions && addressSuggestions.length > 0 && (
                <div style={{
                  position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 200,
                  background: "var(--carta-bg, #fff)", border: "1.5px solid var(--carta-border, #e5e5e5)",
                  borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,.3)", overflow: "hidden",
                }}>
                  {addressSuggestions.map((s) => (
                    <button
                      key={s.place_id}
                      type="button"
                      onMouseDown={() => {
                        setClientAddress(s.display_name);
                        setShowSuggestions(false);
                        setAddressSuggestions([]);
                        // Fetch coordinates for map preview
                        fetch(`/api/geo/place?place_id=${encodeURIComponent(String(s.place_id))}`)
                          .then(r => r.json())
                          .then(d => { if (d?.lat) setAddressCoords({ lat: Number(d.lat), lng: Number(d.lon) }); })
                          .catch(() => {});
                      }}
                      style={{
                        width: "100%", textAlign: "left", padding: "10px 14px", border: "none",
                        background: "transparent", cursor: "pointer", fontFamily: FB, fontSize: "0.82rem",
                        color: "var(--carta-text, #111)", borderBottom: "1px solid var(--carta-border, #f0f0f0)",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--carta-surface, #f5f5f5)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                    >
                      📍 {s.display_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Map preview */}
            {addressCoords && (
              <div style={{ marginTop: 8, height: 160, borderRadius: 10, overflow: "hidden", border: "1.5px solid var(--carta-border, #e5e5e5)", position: "relative", zIndex: 0 }}>
                <MapView lat={addressCoords.lat} lng={addressCoords.lng} onDragEnd={() => {}} />
              </div>
            )}
            </div>
          )}

          {/* Min amount warning */}
          {belowMin && minAmount != null && (
            <div style={{ display: "flex", gap: 8, background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
              <AlertTriangle size={15} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "#ef4444", margin: 0 }}>
                El monto mínimo para delivery es {formatCLP(minAmount)}. Tu pedido va en {formatCLP(total)}.
              </p>
            </div>
          )}

          {/* Notes */}
          <div style={{ marginBottom: 18 }}>
            <textarea
              value={orderNotes}
              onChange={e => setOrderNotes(e.target.value)}
              className="oc-input"
              style={{ ...inputStyle, resize: "none", minHeight: 64 }}
              placeholder="Notas del pedido (opcional)"
            />
          </div>

          {/* Order summary */}
          <div style={{ borderTop: "1px solid var(--carta-border, #eee)", paddingTop: 16, marginBottom: 18 }}>
            <p style={{ fontFamily: F, fontSize: "0.75rem", fontWeight: 700, color: "var(--carta-text2, #777)", textTransform: "uppercase", letterSpacing: ".04em", margin: "0 0 10px" }}>
              Resumen
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
              <span style={{ fontFamily: F, fontWeight: 700, fontSize: "0.88rem", color: "var(--carta-text, #111)" }}>Total</span>
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
          {sendError && (
            <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "#ef4444", textAlign: "center", margin: "0 0 10px", padding: "8px 12px", background: "rgba(239,68,68,0.08)", borderRadius: 8 }}>
              {sendError}
            </p>
          )}
          <button
            onClick={sendOrder}
            disabled={!isValid || sending}
            style={{
              width: "100%", padding: "15px 16px", borderRadius: 14, border: "none",
              background: isValid && !sending ? (isPanelMode ? ACCENT : "#25D366") : "var(--carta-border, #ddd)",
              color: isValid && !sending ? "#fff" : "var(--carta-text2, #aaa)",
              fontFamily: F, fontSize: "0.92rem", fontWeight: 700,
              cursor: isValid && !sending ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              transition: "all 0.15s",
            }}
          >
            {isPanelMode ? <CheckCircle2 size={20} /> : <MessageCircle size={20} />}
            {sending ? "Enviando..." : isPanelMode ? "Confirmar pedido" : "Enviar pedido por WhatsApp"}
          </button>
          {!isPanelMode && (
            <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--carta-text2, #999)", textAlign: "center", margin: "8px 0 0" }}>
              Se abrirá WhatsApp con tu pedido listo para enviar
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
