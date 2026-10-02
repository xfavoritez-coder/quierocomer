"use client";
import { useEffect, useRef, useState } from "react";
import { use } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { DEFAULT_TRACKING_TEXTS, trackingStatusText, type TrackingTexts } from "@/lib/ecommerce/trackingTexts";
import { useFavicon } from "@/lib/ecommerce/useFavicon";
import { Home, Heart, MessageCircle, User, ShoppingBag } from "lucide-react";

const OrderTrackingMap = dynamic(() => import("@/components/ecommerce/OrderTrackingMap"), { ssr: false });

interface TrackingInfo {
  enabled: boolean;
  live: boolean;
  status: string;
  courier: { lat: number | null; lng: number | null; name: string | null; label: string | null } | null;
  customer: { lat: number; lng: number } | null;
}

interface OrderItem {
  dishName: string;
  quantity: number;
  unitTotal: number;
  selectedOptions?: { optionName: string }[];
  notes?: string;
}

interface StatusEntry {
  status: string;
  ts: string;
}

interface OrderData {
  id: string;
  orderNumber?: number | null;
  restaurantName: string;
  restaurantLogoUrl: string | null;
  restaurantFaviconUrl?: string | null;
  restaurantPhone: string | null;
  customerName: string;
  orderType: "PICKUP" | "DELIVERY";
  items: OrderItem[];
  total: number;
  deliveryAddress: string | null;
  paymentMethod: string;
  paymentStatus: string | null;
  paymentGateway: string | null;
  restaurantSlug?: string | null;
  status: string;
  statusHistory: StatusEntry[];
  notes: string | null;
  cancellationReason: string | null;
  estimatedTime: string | null;
  createdAt: string;
  updatedAt: string;
  colorMode: string;
  accentColor: string | null;
  trackingTexts?: TrackingTexts;
}

interface Theme {
  bg: string;
  surface: string;
  text: string;
  text2: string;
  text3: string;
  border: string;
  accent: string;
  isDark: boolean;
}

function buildTheme(colorMode: string, accentColor: string | null): Theme {
  const isDark = colorMode === "DARK";
  return {
    isDark,
    bg: isDark ? "#0e0e0e" : "#fafafa",
    surface: isDark ? "#1a1a1a" : "#fff",
    text: isDark ? "#f0f0f0" : "#111",
    text2: isDark ? "#aaa" : "#666",
    text3: isDark ? "#555" : "#999",
    border: isDark ? "#262626" : "#e5e5e5",
    accent: accentColor || "#F4A623",
  };
}

const GREEN = "#22c55e";
const RED = "#ef4444";
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

function fmt(n: number) {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

// Etiqueta corta para la Live Activity / Isla Dinámica (app iOS).
function liveLabel(status: string, orderType: string): string {
  switch (status) {
    case "ACCEPTED": return "Pedido recibido";
    case "PREPARING": return "En preparación";
    case "READY": return orderType === "DELIVERY" ? "Listo, esperando repartidor" : "Listo para retirar";
    case "IN_DELIVERY": return "En camino";
    case "DONE": return "Entregado";
    case "CANCELLED": return "Pedido cancelado";
    default: return "";
  }
}
function liveEta(status: string, estimatedTime: string | null): string | undefined {
  if (!estimatedTime) return undefined;
  if (status === "ACCEPTED" || status === "PREPARING") return `Listo en ~${estimatedTime} min`;
  return undefined;
}

// Acceso al plugin nativo OrderActivity desde la página remota (handroll.cl).
// La web no bundlea @capacitor/core, así que `Capacitor.Plugins` no está poblado
// para plugins propios; usamos el bridge de bajo nivel (siempre inyectado), que
// enruta por nombre de plugin. Deja un fallback a Plugins por si estuviera.
function getOrderActivity(cap: any): null | {
  start: (o: any) => Promise<any>;
  update: (o: any) => Promise<any>;
  end: (o: any) => Promise<any>;
  isSupported: () => Promise<any>;
  onPushToken: (cb: (t: string) => void) => void;
} {
  if (!cap) return null;
  const p = cap.Plugins?.OrderActivity;
  if (p?.start) {
    return {
      start: (o) => p.start(o),
      update: (o) => p.update(o),
      end: (o) => p.end(o),
      isSupported: () => (p.isSupported ? p.isSupported() : Promise.resolve({ supported: true })),
      onPushToken: (cb) => p.addListener?.("pushToken", (ev: any) => cb(ev?.token)),
    };
  }
  if (typeof cap.nativePromise === "function") {
    return {
      start: (o) => cap.nativePromise("OrderActivity", "start", o),
      update: (o) => cap.nativePromise("OrderActivity", "update", o),
      end: (o) => cap.nativePromise("OrderActivity", "end", o),
      isSupported: () => cap.nativePromise("OrderActivity", "isSupported", {}),
      onPushToken: (cb) => cap.addListener?.("OrderActivity", "pushToken", (ev: any) => cb(ev?.token)),
    };
  }
  return null;
}

const PAY_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
};

const STATUS_STEP: Record<string, number> = {
  PENDING: 0,
  ACCEPTED: 1,
  PREPARING: 2,
  IN_DELIVERY: 3,
  READY: 3,
  DONE: 4,
  CANCELLED: -1,
};

const STEP_STATUSES: string[][] = [
  ["PENDING"],
  ["ACCEPTED"],
  ["PREPARING"],
  ["IN_DELIVERY", "READY"],
  ["DONE"],
];

function getSteps(orderType: "PICKUP" | "DELIVERY", t: TrackingTexts) {
  return [
    { icon: "📋", label: t.stepReceived },
    { icon: "✅", label: t.stepAccepted },
    { icon: "👨‍🍳", label: t.stepPreparing },
    orderType === "DELIVERY"
      ? { icon: "🛵", label: t.stepInDelivery }
      : { icon: "🏁", label: t.stepReady },
    { icon: "🎉", label: t.stepDone },
  ];
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

function getStepTime(stepIndex: number, statusHistory: StatusEntry[], createdAt: string): string | null {
  if (stepIndex === 0) return fmtTime(createdAt);
  const statuses = STEP_STATUSES[stepIndex];
  if (!statuses) return null;
  const entry = statusHistory.find(e => statuses.includes(e.status));
  return entry ? fmtTime(entry.ts) : null;
}

function Stepper({ status, orderType, statusHistory, createdAt, theme, texts }: {
  status: string;
  orderType: "PICKUP" | "DELIVERY";
  statusHistory: StatusEntry[];
  createdAt: string;
  theme: Theme;
  texts: TrackingTexts;
}) {
  const steps = getSteps(orderType, texts);
  const currentStep = STATUS_STEP[status] ?? 0;

  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 0, width: "100%", overflowX: "auto", padding: "8px 0" }}>
      {steps.map((step, i) => {
        // Todo estado alcanzado (incluido el actual) se marca con check verde.
        const reached = i <= currentStep;
        const active = i === currentStep;
        const color = reached ? GREEN : theme.text3;
        const circleBg = reached ? GREEN : theme.isDark ? "#242424" : "#f3f4f6";
        const timeLabel = reached ? getStepTime(i, statusHistory, createdAt) : null;

        return (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", flex: i < steps.length - 1 ? 1 : "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 56 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: circleBg,
                border: `2px solid ${reached ? GREEN : theme.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, flexShrink: 0,
                color: reached ? "#fff" : undefined,
                boxShadow: active ? `0 0 0 4px ${GREEN}22` : "none",
              }}>
                {reached ? "✓" : step.icon}
              </div>
              <span style={{
                fontFamily: FONT, fontSize: "clamp(8px, 2.5vw, 10px)", fontWeight: active ? 700 : 500,
                color, marginTop: 4, textAlign: "center", lineHeight: 1.2,
                whiteSpace: "nowrap",
              }}>
                {step.label}
              </span>
              {timeLabel && (
                <span style={{ fontFamily: FONT, fontSize: 9, color: theme.text3, marginTop: 2, textAlign: "center" }}>
                  {timeLabel}
                </span>
              )}
            </div>
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: 2,
                background: i < currentStep ? GREEN : theme.border,
                marginTop: 17, minWidth: 8,
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
  const [tracking, setTracking] = useState<TrackingInfo | null>(null);
  const orderRef = useRef<OrderData | null>(null);
  useFavicon(order?.restaurantFaviconUrl || order?.restaurantLogoUrl);

  // Estado + ubicación del repartidor desde deliveryhandroll (solo locales habilitados).
  async function fetchTracking() {
    try {
      const r = await fetch(`/api/ecommerce/order-tracking/${orderId}`);
      if (!r.ok) return;
      const d = await r.json();
      if (!d?.ok) return;
      setTracking(d);
      if (d.status && orderRef.current && d.status !== orderRef.current.status) {
        setOrder((prev) => {
          if (!prev) return prev;
          const updated = { ...prev, status: d.status };
          orderRef.current = updated;
          return updated;
        });
      }
    } catch { /* best-effort */ }
  }

  async function fetchOrder() {
    try {
      const r = await fetch(`/api/pedido/${orderId}`);
      if (!r.ok) { setError(true); return; }
      const data: OrderData = await r.json();
      orderRef.current = data;
      setOrder(data);
    } catch {
      setError(true);
    }
  }

  useEffect(() => { fetchOrder(); }, [orderId]);

  // Polling fallback cada 12 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      const cur = orderRef.current;
      if (cur && cur.status !== "DONE" && cur.status !== "CANCELLED") {
        fetchOrder();
      }
    }, 12000);
    return () => clearInterval(interval);
  }, [orderId]);

  // Polling del repartidor (cada 15s) mientras el pedido delivery esté activo.
  useEffect(() => {
    if (order?.orderType !== "DELIVERY") return;
    fetchTracking();
    const id = setInterval(() => {
      const c = orderRef.current;
      if (c && c.orderType === "DELIVERY" && c.status !== "DONE" && c.status !== "CANCELLED") fetchTracking();
    }, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, order?.orderType]);

  // Supabase Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`pedido-${orderId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "OnlineOrder",
        filter: `id=eq.${orderId}`,
      }, (payload) => {
        const p = payload.new as any;
        setOrder(prev => {
          if (!prev) return prev;
          const updated = {
            ...prev,
            status: p.status ?? prev.status,
            paymentStatus: p.paymentStatus ?? prev.paymentStatus,
            updatedAt: p.updatedAt ?? prev.updatedAt,
            statusHistory: Array.isArray(p.statusHistory) ? p.statusHistory : prev.statusHistory,
            cancellationReason: p.cancellationReason ?? prev.cancellationReason,
          };
          orderRef.current = updated;
          return updated;
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orderId]);

  // ── Live Activity / Isla Dinámica (solo app iOS/Capacitor) ──
  // Inicia la actividad al ver el pedido y la actualiza/termina según el estado.
  const liveStartedRef = useRef(false);
  const liveStatusRef = useRef<string | null>(null);
  const [laInfo, setLaInfo] = useState<string>(""); // diagnóstico temporal
  useEffect(() => {
    if (!order || typeof window === "undefined") return;
    const cap: any = (window as any).Capacitor;
    const native = !!cap?.isNativePlatform?.();
    const platform = cap?.getPlatform?.();
    if (!native || platform !== "ios") { return; }
    const LA = getOrderActivity(cap);
    if (!LA) { setLaInfo("isla: bridge nativo no disponible"); return; }
    if (liveStartedRef.current && liveStatusRef.current === order.status) return; // sin cambios
    liveStatusRef.current = order.status;

    const base = {
      orderId,
      status: order.status,
      statusLabel: liveLabel(order.status, order.orderType),
      etaText: liveEta(order.status, order.estimatedTime),
    };
    const isFinal = order.status === "DONE" || order.status === "CANCELLED";

    if (!liveStartedRef.current) {
      liveStartedRef.current = true;
      if (isFinal) { setLaInfo("isla: pedido ya finalizado, no se inicia"); return; }
      // ¿Soporta Live Activities / están habilitadas?
      LA.isSupported().then((s: any) => {
        if (s && s.supported === false) setLaInfo("isla: Live Activities deshabilitadas en Ajustes");
      }).catch(() => {});
      // Push token de la actividad → backend (para actualizar con la app cerrada)
      LA.onPushToken((token) => {
        if (!token) return;
        setLaInfo("isla: token recibido ✓ (push ok)");
        fetch("/api/ecommerce/order-push/subscribe", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, liveActivity: { token } }),
        }).catch(() => {});
      });
      LA.start({
        ...base,
        orderNumber: order.orderNumber != null ? String(order.orderNumber) : "",
        storeName: order.restaurantName,
        orderType: order.orderType,
      }).then((r: any) => {
        setLaInfo("isla: " + (r?.started ? "iniciada ✓" : ("no iniciada — " + (r?.reason || "?"))));
      }).catch((e: any) => setLaInfo("isla: error al iniciar — " + (e?.message || e)));
    } else if (isFinal) {
      LA.end(base).catch(() => {});
    } else {
      LA.update(base).catch(() => {});
    }
  }, [order, orderId]);

  // Theme derivado del pedido (usa LIGHT como fallback mientras carga)
  const theme = buildTheme(order?.colorMode ?? "LIGHT", order?.accentColor ?? null);
  const texts = order?.trackingTexts ?? DEFAULT_TRACKING_TEXTS;

  const cardStyle: React.CSSProperties = {
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    borderRadius: 16,
    padding: "20px 18px",
    marginBottom: 16,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: theme.text3,
    textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 2px",
  };

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, padding: 24 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>😕</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: theme.text, margin: "0 0 8px" }}>Pedido no encontrado</h2>
          <p style={{ fontSize: 14, color: theme.text2, margin: 0 }}>Verifica el enlace o contacta al local.</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div style={{ minHeight: "100vh", background: "#0e0e0e", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT }}>
        <div style={{ textAlign: "center", color: "#555" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <p style={{ fontSize: 14 }}>Cargando tu pedido...</p>
        </div>
      </div>
    );
  }

  // Pago online no completado: no mostramos el estado del pedido. Si el pago se
  // confirma (webhook), la página se actualiza sola (polling + realtime).
  if (order.paymentGateway && order.paymentStatus !== "paid" && order.status !== "CANCELLED") {
    const failed = order.paymentStatus === "failed";
    return (
      <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 340 }}>
          {order.restaurantLogoUrl && <img src={order.restaurantLogoUrl} alt={order.restaurantName} style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", margin: "0 auto 16px" }} />}
          <div style={{ fontSize: 52, marginBottom: 14 }}>{failed ? "❌" : "⏳"}</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: theme.text, margin: "0 0 8px" }}>{failed ? "Tu pago no se completó" : "Pago pendiente"}</h2>
          <p style={{ fontSize: 14, color: theme.text2, margin: "0 0 20px", lineHeight: 1.6 }}>
            {failed
              ? "El pago fue rechazado o cancelado, así que no registramos el pedido. Puedes intentarlo de nuevo."
              : "Aún no confirmamos tu pago. Si ya pagaste, esta pantalla se actualizará en unos segundos; si no completaste el pago, no se registró ningún pedido."}
          </p>
          {order.restaurantSlug && (
            <a href={`/ecommerce/${order.restaurantSlug}`} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 22px", borderRadius: 12, background: theme.accent || "#F4A623", color: "#1a1a1a", fontWeight: 800, fontSize: 14, textDecoration: "none" }}>
              Volver a la tienda
            </a>
          )}
        </div>
      </div>
    );
  }

  if (order.status === "CANCELLED") {
    const waPhone = order.restaurantPhone?.replace(/\D/g, "");
    return (
      <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 320 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>😔</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: RED, margin: "0 0 8px" }}>{texts.cancelledTitle}</h2>
          {order.cancellationReason && (
            <p style={{ fontFamily: FONT, fontSize: "0.88rem", color: "#fca5a5", margin: "8px 0 0", lineHeight: 1.5 }}>
              Motivo: {order.cancellationReason}
            </p>
          )}
          <p style={{ fontSize: 14, color: theme.text2, margin: "0 0 20px", lineHeight: 1.6 }}>
            {texts.cancelledBody}
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
            <p style={{ fontSize: 13, color: theme.text3 }}>Contacta al local para más información.</p>
          )}
        </div>
      </div>
    );
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const st = trackingStatusText(texts, order.status, order.orderType);

  // Base de la tienda para la navegación embebida: en dominio propio del local
  // (handroll.cl) las rutas son absolutas ("" → "/", "/checkout"); en
  // quierocomer.com la tienda vive en /ecommerce/<slug>.
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const onMainDomain = host === "quierocomer.com" || host === "www.quierocomer.com" || host === "localhost" || host.endsWith(".vercel.app");
  const storeBase = onMainDomain && order.restaurantSlug ? `/ecommerce/${order.restaurantSlug}` : "";
  const storeHome = storeBase || "/";

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, fontFamily: FONT }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px 120px" }}>

        {/* Restaurant header — clickeable para volver a la tienda */}
        <a href={storeHome} style={{ display: "block", textAlign: "center", marginBottom: 24, textDecoration: "none" }}>
          {order.restaurantLogoUrl ? (
            <img
              src={order.restaurantLogoUrl}
              alt={order.restaurantName}
              style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", display: "inline-block", marginBottom: 8 }}
            />
          ) : (
            <div style={{
              width: 48, height: 48, borderRadius: "50%", background: theme.accent + "22",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, fontWeight: 700, color: theme.accent, marginBottom: 8,
            }}>
              {order.restaurantName.charAt(0).toUpperCase()}
            </div>
          )}
          <h1 style={{ fontFamily: FONT, fontSize: 18, fontWeight: 700, color: theme.text, margin: 0 }}>
            {order.restaurantName}
          </h1>
          <p style={{ fontSize: 13, color: theme.text2, margin: "4px 0 0" }}>{texts.headerSubtitle}</p>
        </a>

        {/* Título del estado actual */}
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <h2 style={{ fontFamily: FONT, fontSize: 22, fontWeight: 800, color: theme.text, margin: 0 }}>{st.t}</h2>
          {st.s && <p style={{ fontFamily: FONT, fontSize: 14, color: theme.text2, margin: "4px 0 0", lineHeight: 1.5 }}>{st.s}</p>}
        </div>

        {/* Avisos push del estado del pedido */}
        {order.status !== "DONE" && <NotifyButton orderId={orderId} accent={theme.accent} textColor={theme.text2} />}

        {/* Diagnóstico temporal de la Isla Dinámica (solo app iOS) */}
        {laInfo && (
          <p style={{ textAlign: "center", fontSize: 11, color: theme.text3, margin: "0 0 12px", fontFamily: FONT }}>{laInfo}</p>
        )}

        {/* Mapa en vivo del repartidor (deliveryhandroll) — solo cuando el pedido
            ya salió a reparto (IN_DELIVERY) y tenemos ubicación del repartidor. */}
        {order.orderType === "DELIVERY" && order.status === "IN_DELIVERY" && tracking?.enabled && tracking.courier?.lat != null && (
          <div style={{ ...cardStyle, padding: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px 10px" }}>
              <span style={{ fontSize: 22 }}>🛵</span>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: theme.text, margin: 0 }}>{tracking.courier.name || "Tu repartidor va en camino"}</p>
                <p style={{ fontSize: 12, color: theme.text2, margin: "2px 0 0" }}>{tracking.courier.label || "Ubicación en tiempo real"}</p>
              </div>
            </div>
            <OrderTrackingMap
              driver={{ lat: tracking.courier.lat!, lng: tracking.courier.lng! }}
              customer={tracking.customer}
              store={null}
              dark={(order.colorMode ?? "LIGHT") === "DARK"}
            />
          </div>
        )}

        {/* Stepper */}
        <div style={{ ...cardStyle, padding: "20px 12px" }}>
          <Stepper
            status={order.status}
            orderType={order.orderType}
            statusHistory={order.statusHistory}
            createdAt={order.createdAt}
            theme={theme}
            texts={texts}
          />
        </div>

        {/* Order summary card */}
        <div style={cardStyle}>
          {/* Order type badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              background: theme.accent + "18", color: theme.accent,
              fontWeight: 700, fontSize: 12, padding: "4px 10px", borderRadius: 999,
            }}>
              {order.orderType === "DELIVERY" ? "🛵 Delivery" : "🏠 Retiro"}
            </span>
          </div>

          {/* Delivery address */}
          {order.orderType === "DELIVERY" && order.deliveryAddress && (
            <div style={{ marginBottom: 12 }}>
              <p style={labelStyle}>Dirección</p>
              <p style={{ fontSize: 14, color: theme.text, margin: 0 }}>{order.deliveryAddress}</p>
            </div>
          )}

          {/* Estimated time */}
          {order.estimatedTime && (
            <div style={{ marginBottom: 12 }}>
              <p style={labelStyle}>Tiempo estimado</p>
              <p style={{ fontSize: 14, color: theme.text, margin: 0 }}>⏱ {order.estimatedTime}</p>
            </div>
          )}

          {/* Divider */}
          <div style={{ height: 1, background: theme.border, margin: "14px 0" }} />

          {/* Items */}
          <p style={{ ...labelStyle, marginBottom: 10 }}>Productos</p>
          {items.map((item, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: 14, color: theme.text, fontWeight: 500 }}>
                  {item.quantity}× {item.dishName}
                </span>
                {item.selectedOptions && item.selectedOptions.length > 0 && (
                  <p style={{ fontSize: 12, color: theme.text2, margin: "2px 0 0" }}>
                    {item.selectedOptions.map(o => o.optionName).join(", ")}
                  </p>
                )}
                {item.notes && (
                  <p style={{ fontSize: 12, color: theme.text2, margin: "2px 0 0", fontStyle: "italic" }}>
                    Nota: {item.notes}
                  </p>
                )}
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: theme.text, flexShrink: 0, marginLeft: 12 }}>
                {fmt(item.unitTotal * item.quantity)}
              </span>
            </div>
          ))}

          {/* Total */}
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, borderTop: `1px solid ${theme.border}`, marginTop: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>Total</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: theme.accent }}>{fmt(order.total)}</span>
          </div>

          {/* Payment method */}
          <div style={{ marginTop: 12 }}>
            <p style={labelStyle}>Forma de pago</p>
            <p style={{ fontSize: 14, color: theme.text, margin: 0 }}>{PAY_LABELS[order.paymentMethod] ?? order.paymentMethod}</p>
          </div>

          {/* Notes */}
          {order.notes && (
            <div style={{ marginTop: 12 }}>
              <p style={labelStyle}>Notas</p>
              <p style={{ fontSize: 14, color: theme.text2, margin: 0, fontStyle: "italic" }}>{order.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Barra inferior de la tienda — mantiene el seguimiento "embebido"
          dentro de la app/web con acceso directo a inicio, menú y carrito. */}
      <StoreNav base={storeBase} accent={theme.accent} />
    </div>
  );
}

// ── Barra flotante inferior (estilo storefront) para volver a la tienda ──
function StoreNav({ base, accent }: { base: string; accent: string }) {
  const home = base || "/";
  const withMenu = (m: string) => `${home}${home.includes("?") ? "&" : "?"}menu=${m}`;
  const go = (href: string) => (window.location.href = href);
  return (
    <nav className="fixed bottom-3 inset-x-0 z-40 flex justify-center pointer-events-none">
      <div className="pointer-events-auto relative flex items-center gap-3 bg-white/95 backdrop-blur rounded-full shadow-[0_10px_34px_rgba(0,0,0,0.20)] border border-gray-100 px-4 h-16">
        <StoreNavBtn label="Inicio" onClick={() => go(home)}><Home className="w-6 h-6" /></StoreNavBtn>
        <StoreNavBtn label="Favoritos" onClick={() => go(withMenu("favorites"))}><Heart className="w-6 h-6" /></StoreNavBtn>
        <span className="w-16 shrink-0" aria-hidden />
        <StoreNavBtn label="Contacto" onClick={() => go(withMenu("contact"))}><MessageCircle className="w-6 h-6" /></StoreNavBtn>
        <StoreNavBtn label="Perfil" onClick={() => go(withMenu("profile"))}><User className="w-6 h-6" /></StoreNavBtn>
        <div className="absolute left-1/2 -translate-x-1/2 -top-6">
          <button
            onClick={() => go(`${base}/checkout`)}
            aria-label="Ir a la tienda"
            className="relative w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg ring-4 ring-white"
            style={{ background: accent }}
          >
            <ShoppingBag className="w-6 h-6" />
          </button>
        </div>
      </div>
    </nav>
  );
}

function StoreNavBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="w-11 h-11 flex items-center justify-center rounded-full transition active:scale-90 text-gray-400 hover:text-gray-700"
    >
      {children}
    </button>
  );
}

// Botón para activar notificaciones push del estado del pedido (PWA).
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function NotifyButton({ orderId, accent, textColor }: { orderId: string; accent: string; textColor: string }) {
  const [state, setState] = useState<"idle" | "busy" | "on" | "denied" | "unsupported">("idle");

  // ¿Corre dentro de la app nativa (Capacitor)? Entonces usamos push nativo.
  function cap(): any { return typeof window !== "undefined" ? (window as any).Capacitor : null; }
  function isNative(): boolean { const c = cap(); return !!(c?.isNativePlatform?.()); }

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isNative()) {
      // En la app: suscribir automáticamente (pide permiso una vez y listo).
      activateNative();
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) { setState("unsupported"); return; }
    if (Notification.permission === "denied") { setState("denied"); return; }
    navigator.serviceWorker.getRegistration().then((reg) => reg?.pushManager.getSubscription()).then((sub) => { if (sub) setState("on"); }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function activateNative() {
    const c = cap();
    const Push = c?.Plugins?.PushNotifications;
    const platform = c?.getPlatform?.();
    if (!Push) { setState("unsupported"); return; }
    setState("busy");
    try {
      const perm = await Push.requestPermissions();
      if (perm?.receive !== "granted") { setState("denied"); return; }
      await Push.addListener("registration", async (t: { value: string }) => {
        try {
          await fetch("/api/ecommerce/order-push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, native: { platform, token: t.value } }) });
          setState("on");
        } catch { setState("idle"); }
      });
      await Push.addListener("registrationError", () => setState("idle"));
      await Push.register();
    } catch { setState("idle"); }
  }

  async function activate() {
    if (isNative()) return activateNative();
    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapid) { setState("unsupported"); return; }
    setState("busy");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "denied" : "idle"); return; }
      const reg = await navigator.serviceWorker.register("/sw-store.js");
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapid) });
      const res = await fetch("/api/ecommerce/order-push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, subscription: sub.toJSON() }) });
      setState(res.ok ? "on" : "idle");
    } catch { setState("idle"); }
  }

  if (state === "unsupported") return null;
  if (state === "on") {
    return <p style={{ textAlign: "center", fontSize: 13, color: textColor, margin: "0 0 16px" }}>🔔 Te avisaremos cuando tu pedido cambie de estado.</p>;
  }
  if (state === "denied") {
    const msg = isNative()
      ? "Activá las notificaciones de la app en Ajustes del teléfono para recibir avisos de tu pedido."
      : "Activa las notificaciones del navegador para recibir avisos de tu pedido.";
    return <p style={{ textAlign: "center", fontSize: 12, color: textColor, margin: "0 0 16px" }}>{msg}</p>;
  }
  // En la app el botón no se muestra: se activa solo (idle/busy mientras registra).
  if (isNative()) {
    return state === "busy" ? <p style={{ textAlign: "center", fontSize: 12, color: textColor, margin: "0 0 16px" }}>Configurando avisos…</p> : null;
  }
  return (
    <div style={{ textAlign: "center", marginBottom: 16 }}>
      <button onClick={activate} disabled={state === "busy"} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 12, border: "none", background: accent, color: "#1a1a1a", fontWeight: 800, fontSize: 14, cursor: state === "busy" ? "wait" : "pointer", opacity: state === "busy" ? 0.6 : 1 }}>
        🔔 {state === "busy" ? "Activando…" : "Avisarme del estado"}
      </button>
    </div>
  );
}
