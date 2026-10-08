"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Radio, RefreshCw, History, ClipboardCheck, Phone, MapPin, Utensils, Bike, ShoppingBag, Check, Trash2, MoreVertical, MapPinned, ChevronLeft, ChevronRight, Calendar, Clock, Flame, Bell, CheckSquare, Truck, MonitorPlay } from "lucide-react";
import { toast } from "sonner";
import { useSessionContext } from "@/lib/admin/SessionContext";
import { supabase } from "@/lib/supabase";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#F4A623";
const ORANGE = "#f97316", BLUE = "#3b82f6", GREEN = "#22c55e", GRAY = "#9ca3af", RED = "#ef4444";

type Stage = "preparing" | "ready" | "out_for_delivery" | "delivered";

interface PosOrder {
  id: string; restaurantId: string; externalId: string;
  posStatus: string; opsStage: Stage; saleType: string; isDelivery: boolean; tableLabel: string | null;
  customerName: string; customerPhone: string; addressLine: string;
  totalAmount: number; paidAmount: number; tipAmount: number; changeAmount: number; deliveryFee: number; discountAmount: number;
  currency: string; vendorName: string | null; orderReference: string | null;
  items: any; completedAt: string | null; createdAt: string; updatedAt: string; opsDeliveredAt?: string | null;
  assignedTo?: string | null; uberDeliveryId?: string | null; pyaShippingId?: string | null; courier?: any; trackingToken?: string | null;
}

const clp = (n: number) => "$" + Math.round(n || 0).toLocaleString("es-CL");

// Fecha de hoy (YYYY-MM-DD) en hora de Chile.
function chileTodayLocal(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
// Suma días a un YYYY-MM-DD (seguro por zona horaria: mediodía UTC).
function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const UBER_STATUS_LABEL: Record<string, string> = {
  pending: "Buscando repartidor…",
  pickup: "En camino al local",
  pickup_complete: "Retiró el pedido",
  dropoff: "En camino al cliente",
  delivered: "Entregado",
  canceled: "Cancelado",
  returned: "Devuelto",
};
function courierStatusLabel(provider: string | null, status?: string | null): string {
  if (!status) return provider === "PedidosYa" ? "Solicitado" : "Solicitado";
  return UBER_STATUS_LABEL[status] || status;
}
/** "14:32 · en 8 min" a partir de un ISO de ETA. */
function etaLabel(iso?: string | null): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  const hhmm = new Date(t).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  const mins = Math.round((t - Date.now()) / 60000);
  return mins > 0 ? `${hhmm} · en ${mins} min` : hhmm;
}

const STAGE_LABEL: Record<Stage, string> = { preparing: "En preparación", ready: "Listo", out_for_delivery: "En reparto", delivered: "Entregado" };
const STAGE_SHORT: Record<Stage, string> = { preparing: "Preparación", ready: "Listo", out_for_delivery: "Reparto", delivered: "Entregado" };
// Iconos SVG (lucide) consistentes con el resto de la interfaz — sin emojis.
const STAGE_LUCIDE: Record<Stage, any> = { preparing: Flame, ready: Bell, out_for_delivery: Bike, delivered: CheckSquare };
// Las 4 etapas del tablero (columna izquierda estilo deliveryhandroll).
const STAGES: Stage[] = ["preparing", "ready", "out_for_delivery", "delivered"];
const STAGE_ACCENT: Record<Stage, string> = { preparing: ORANGE, ready: GREEN, out_for_delivery: BLUE, delivered: GRAY };

// Un pedido con dirección pero sin monto de delivery se toma como retiro.
function isDeliveryOrder(o: PosOrder): boolean {
  return o.isDelivery && (o.deliveryFee ?? 0) > 0;
}

function nextActions(o: PosOrder): { stage: Stage; label: string; color: string }[] {
  if (o.posStatus === "canceled" || o.opsStage === "delivered") return [];
  if (isDeliveryOrder(o)) {
    // Delivery: cocina solo marca "Listo". El paso a reparto y la entrega los
    // gestiona la app del repartidor (o el courier). Override manual: menú ⋮.
    if (o.opsStage === "preparing") return [{ stage: "ready", label: "Marcar listo", color: GREEN }];
    return [];
  } else {
    // Retiro/mostrador: sin repartidor, el staff avanza el flujo.
    if (o.opsStage === "preparing") return [{ stage: "ready", label: "Marcar listo", color: GREEN }];
    return [{ stage: "delivered", label: "Entregado", color: GRAY }];
  }
}

// `color` = tono base (para el fondo tenue); `deep` = tono profundo para texto/ícono.
function saleBadge(o: PosOrder): { label: string; icon: any; color: string; deep: string } {
  if (isDeliveryOrder(o)) return { label: "Delivery", icon: Bike, color: GREEN, deep: "#15803d" };
  if (o.tableLabel || o.saleType === "dine-in") return { label: o.tableLabel || "Mesa", icon: Utensils, color: BLUE, deep: "#1d4ed8" };
  return { label: "Retiro", icon: ShoppingBag, color: ORANGE, deep: "#c2410c" };
}

function beep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880; o.type = "sine";
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o.start(); o.stop(ctx.currentTime + 0.42);
  } catch { /* noop */ }
}

export default function CentroPedidosPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"activos" | "historial">("activos");
  const [fromDate, setFromDate] = useState<string>(() => chileTodayLocal());
  const [toDate, setToDate] = useState<string>(() => chileTodayLocal());
  const [selectedStage, setSelectedStage] = useState<Stage>("preparing");
  const [live, setLive] = useState(false);
  const [flash, setFlash] = useState<Record<string, boolean>>({});
  const [courierBusy, setCourierBusy] = useState<Record<string, boolean>>({});
  const [uberEnabled, setUberEnabled] = useState(true);
  const [pedidosyaEnabled, setPedidosyaEnabled] = useState(true);
  const courierReq = useRef<Set<string>>(new Set());

  // Flags de couriers externos (para mostrar/ocultar los botones de solicitar).
  useEffect(() => {
    if (!restaurantId) return;
    fetch(`/api/panel/ecommerce/pos-orders/settings?restaurantId=${restaurantId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.config) { setUberEnabled(d.config.uberEnabled !== false); setPedidosyaEnabled(d.config.pedidosyaEnabled !== false); } })
      .catch(() => {});
  }, [restaurantId]);

  const fetchOrders = useCallback(async (silent = false) => {
    if (!restaurantId) return;
    if (!silent) setLoading(true);
    try {
      const r = await fetch(`/api/panel/ecommerce/pos-orders?restaurantId=${restaurantId}&scope=${view}&from=${fromDate}&to=${toDate}`);
      const d = await r.json();
      if (r.ok && d.orders) setOrders(d.orders);
    } catch { /* noop */ }
    setLoading(false);
  }, [restaurantId, view, fromDate, toDate]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Tiempo real (Supabase) — sin polling. Refresco por evento.
  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel(`pos-orders-${restaurantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "PosOrder", filter: `restaurantId=eq.${restaurantId}` }, (payload: any) => {
        const row = payload.new as PosOrder;
        if (payload.eventType === "INSERT") {
          setOrders((prev) => (prev.some((o) => o.id === row.id) ? prev : [row, ...prev]));
          setFlash((f) => ({ ...f, [row.id]: true }));
          setTimeout(() => setFlash((f) => { const n = { ...f }; delete n[row.id]; return n; }), 6000);
          beep();
        } else if (payload.eventType === "UPDATE") {
          setOrders((prev) => prev.map((o) => (o.id === row.id ? { ...o, ...row } : o)));
        } else if (payload.eventType === "DELETE") {
          setOrders((prev) => prev.filter((o) => o.id !== (payload.old as any).id));
        }
      })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    const onVis = () => { if (document.visibilityState === "visible") fetchOrders(true); };
    document.addEventListener("visibilitychange", onVis);
    const backup = setInterval(() => fetchOrders(true), 60000); // respaldo lento

    return () => { supabase.removeChannel(channel); document.removeEventListener("visibilitychange", onVis); clearInterval(backup); };
  }, [restaurantId, fetchOrders]);

  async function advance(o: PosOrder, stage: Stage) {
    // Optimista
    setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, opsStage: stage } : x)));
    try {
      const r = await fetch("/api/panel/ecommerce/pos-orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId, id: o.id, opsStage: stage }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); toast.error(d.error || "No se pudo actualizar"); fetchOrders(true); return; }
      // El servidor puede resolver una etapa distinta (ej: retiro con auto-entregar
      // salta de "Listo" a "Entregado"). Aplicamos la etapa final que devuelve.
      const d = await r.json().catch(() => ({}));
      const finalStage = d?.order?.opsStage as Stage | undefined;
      if (finalStage && finalStage !== stage) setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, opsStage: finalStage } : x)));
      // El entregado NO se quita: pasa a la etapa "Entregado" del tablero.
    } catch { toast.error("Error de conexión"); fetchOrders(true); }
  }

  async function eliminar(o: PosOrder) {
    if (!restaurantId) return;
    if (!confirm(`¿Eliminar este pedido${o.externalId.startsWith("TEST-") ? " de prueba" : ""}?`)) return;
    setOrders((prev) => prev.filter((x) => x.id !== o.id));
    try {
      const r = await fetch(`/api/panel/ecommerce/pos-orders?restaurantId=${restaurantId}&id=${o.id}`, { method: "DELETE" });
      if (!r.ok) { const d = await r.json().catch(() => ({})); toast.error(d.error || "No se pudo eliminar"); fetchOrders(true); }
    } catch { toast.error("Error de conexión"); fetchOrders(true); }
  }

  async function requestCourier(o: PosOrder, provider: "uber" | "pedidosya") {
    if (!restaurantId) return;
    // Guard inmediato: ignora clics repetidos mientras hay una solicitud en curso
    // (evita crear varias entregas Uber que luego llegan al local).
    if (courierReq.current.has(o.id) || o.uberDeliveryId || o.pyaShippingId) return;
    if (!confirm(provider === "uber" ? "¿Solicitar un repartidor de Uber para este pedido?" : "¿Solicitar un repartidor de PedidosYa para este pedido?")) return;
    courierReq.current.add(o.id);
    setCourierBusy((s) => ({ ...s, [o.id]: true }));
    const path = provider === "uber" ? "uber" : "pedidosya";
    try {
      const r = await fetch(`/api/panel/ecommerce/pos-orders/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId, id: o.id }) });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error || "No se pudo solicitar el courier"); return; }
      toast.success(d.alreadyRequested ? "Este pedido ya tenía courier" : (provider === "uber" ? "Uber solicitado" : "PedidosYa solicitado"));
      fetchOrders(true);
    } catch { toast.error("Error de conexión"); }
    finally {
      courierReq.current.delete(o.id);
      setCourierBusy((s) => { const n = { ...s }; delete n[o.id]; return n; });
    }
  }

  async function cancelCourier(o: PosOrder) {
    if (!restaurantId) return;
    const path = o.uberDeliveryId ? "uber" : "pedidosya";
    if (!confirm("¿Cancelar el courier de este pedido?")) return;
    try {
      const r = await fetch(`/api/panel/ecommerce/pos-orders/${path}?restaurantId=${restaurantId}&id=${o.id}`, { method: "DELETE" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(d.error || "No se pudo cancelar"); return; }
      toast.success("Courier cancelado");
      fetchOrders(true);
    } catch { toast.error("Error de conexión"); }
  }

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 0 48px" }}>
      <Link href="/panel" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: FB, fontSize: "0.76rem", color: "var(--adm-text3)", textDecoration: "none", marginBottom: 4 }}>
        <ArrowLeft size={14} /> Panel
      </Link>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontFamily: F, fontSize: "1.35rem", fontWeight: 900, letterSpacing: "-0.02em", color: "var(--adm-text)", margin: 0, lineHeight: 1.1 }}>Centro de pedidos</h1>
          <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text2)", margin: "1px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Gestiona tus pedidos en tiempo real</p>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999, fontFamily: F, fontSize: "0.66rem", fontWeight: 700, background: live ? "rgba(34,197,94,0.12)" : "var(--adm-hover)", color: live ? GREEN : "var(--adm-text3)", flexShrink: 0, whiteSpace: "nowrap", marginTop: 2 }}>
          <Radio size={11} /> {live ? "En vivo" : "Conectando…"}
        </span>
        <Link href="/panel/centro-pedidos/kds" title="Pantalla KDS de cocina" style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 12px", borderRadius: 8, border: "none", background: "#111827", color: "#fff", fontFamily: F, fontSize: "0.74rem", fontWeight: 800, textDecoration: "none", cursor: "pointer", flexShrink: 0 }}>
          <MonitorPlay size={15} /> KDS
        </Link>
        <button onClick={() => fetchOrders()} title="Refrescar" style={{ width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text2)", cursor: "pointer", flexShrink: 0 }}><RefreshCw size={14} /></button>
      </div>

      {/* Segmented control Activos / Historial */}
      <div style={{ display: "flex", gap: 3, marginBottom: 10, background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 10, padding: 3 }}>
        <SegTab active={view === "activos"} onClick={() => setView("activos")} icon={ClipboardCheck} label="Activos" />
        <SegTab active={view === "historial"} onClick={() => setView("historial")} icon={History} label="Historial" />
      </div>

      {/* Selector de fecha — un solo control, admite día único o rango */}
      {(() => {
        const today = chileTodayLocal();
        // Avanza/retrocede la "ventana" completa (manteniendo su largo en días).
        const spanDays = Math.max(1, Math.round((Date.parse(fromDate) - Date.parse(toDate)) / 86400000 * -1) + 1);
        const shiftWindow = (dir: number) => {
          setFromDate((f) => addDaysYmd(f, dir * spanDays));
          setToDate((t) => addDaysYmd(t, dir * spanDays));
        };
        const navBtn: React.CSSProperties = { width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "1px solid var(--adm-card-border)", background: "var(--adm-card)", color: "var(--adm-text2)", cursor: "pointer", flexShrink: 0 };
        const dateInput: React.CSSProperties = { fontFamily: FB, fontSize: "0.78rem", fontWeight: 600, color: "var(--adm-text)", background: "transparent", border: "none", outline: "none", padding: 0, margin: 0, cursor: "pointer", colorScheme: "light dark" as any };
        return (
          <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => shiftWindow(-1)} title="Anterior" style={navBtn}><ChevronLeft size={16} /></button>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 8, padding: "6px 11px" }}>
              <Calendar size={15} style={{ color: "var(--adm-text3)", flexShrink: 0 }} />
              <input type="date" aria-label="Desde" value={fromDate} max={toDate} onChange={(e) => { const v = e.target.value || today; setFromDate(v); if (v > toDate) setToDate(v); }} style={dateInput} />
              <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)" }}>→</span>
              <input type="date" aria-label="Hasta" value={toDate} min={fromDate} max={today} onChange={(e) => { const v = e.target.value || today; setToDate(v); if (v < fromDate) setFromDate(v); }} style={dateInput} />
            </div>
            <button onClick={() => shiftWindow(1)} disabled={toDate >= today} title="Siguiente" style={{ ...navBtn, opacity: toDate >= today ? 0.4 : 1, cursor: toDate >= today ? "default" : "pointer" }}><ChevronRight size={16} /></button>
          </div>
        );
      })()}

      {loading ? (
        <p style={{ fontFamily: FB, color: "var(--adm-text3)", padding: 30, textAlign: "center" }}>Cargando pedidos…</p>
      ) : view === "historial" ? (
        orders.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <p style={{ fontFamily: F, fontSize: "1rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 6px" }}>Sin historial</p>
            <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text3)", margin: 0 }}>Los pedidos entregados o cancelados aparecerán aquí.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 10 }}>
            {orders.map((o) => <OrderCard key={o.id} o={o} flash={!!flash[o.id]} onAdvance={advance} onDelete={eliminar} onCourier={requestCourier} onCancelCourier={cancelCourier} courierBusy={!!courierBusy[o.id]} uberEnabled={uberEnabled} pedidosyaEnabled={pedidosyaEnabled} />)}
          </div>
        )
      ) : (() => {
        // Conteo por etapa (excluye cancelados).
        const counts: Record<Stage, number> = { preparing: 0, ready: 0, out_for_delivery: 0, delivered: 0 };
        for (const o of orders) if (o.posStatus !== "canceled") counts[o.opsStage] = (counts[o.opsStage] || 0) + 1;
        const items = orders.filter((o) => o.opsStage === selectedStage && o.posStatus !== "canceled");
        // Orden: activos (preparación/listo/reparto) por antigüedad (más antiguo
        // primero); entregados por hora de entrega (más reciente primero).
        const ts = (v: string | null | undefined) => (v ? new Date(v).getTime() : 0);
        if (selectedStage === "delivered") {
          items.sort((a, b) => ts(b.opsDeliveredAt || b.completedAt || b.updatedAt) - ts(a.opsDeliveredAt || a.completedAt || a.updatedAt));
        } else {
          items.sort((a, b) => ts(a.createdAt) - ts(b.createdAt));
        }
        return (
          <>
            {/* Chips de etapas — las 4 en una sola fila, ancho igual, sin scroll */}
            <div style={{ display: "flex", gap: 5, marginBottom: 12, width: "100%" }}>
              {STAGES.map((st) => {
                const active = selectedStage === st;
                const c = STAGE_ACCENT[st];
                const Ic = STAGE_LUCIDE[st];
                return (
                  <button
                    key={st}
                    onClick={() => setSelectedStage(st)}
                    title={STAGE_SHORT[st]}
                    style={{
                      flex: "1 1 0", minWidth: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
                      padding: "6px 4px", borderRadius: 9, cursor: "pointer",
                      border: `1px solid ${active ? c : "var(--adm-card-border)"}`,
                      background: active ? `${c}14` : "var(--adm-card)",
                      transition: "background .15s, border-color .15s",
                    }}
                  >
                    <Ic size={13} color={active ? c : "var(--adm-text3)"} style={{ flexShrink: 0 }} />
                    <span style={{ fontFamily: F, fontSize: "0.62rem", fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: active ? "var(--adm-text)" : "var(--adm-text2)" }}>{STAGE_SHORT[st]}</span>
                    <span style={{ fontFamily: F, fontSize: "0.6rem", fontWeight: 800, minWidth: 15, height: 15, padding: "0 4px", borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", background: active ? c : "var(--adm-hover)", color: active ? "#fff" : "var(--adm-text3)", flexShrink: 0 }}>{counts[st]}</span>
                  </button>
                );
              })}
            </div>

            {/* Pedidos de la etapa seleccionada (ancho completo) */}
            {items.length === 0 ? (
              <div style={{ padding: "36px 16px", textAlign: "center", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14 }}>
                <p style={{ fontFamily: FB, fontSize: "0.84rem", color: "var(--adm-text3)", margin: 0 }}>No hay pedidos en «{STAGE_SHORT[selectedStage]}».</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 10, alignItems: "start" }}>
                {items.map((o) => <OrderCard key={o.id} o={o} flash={!!flash[o.id]} onAdvance={advance} onDelete={eliminar} onCourier={requestCourier} onCancelCourier={cancelCourier} courierBusy={!!courierBusy[o.id]} uberEnabled={uberEnabled} pedidosyaEnabled={pedidosyaEnabled} />)}
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}

// Contador en vivo HH:MM:SS del tiempo transcurrido desde que se creó el pedido.
function ElapsedTimer({ since }: { since: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 15000); // minutos: basta refrescar cada 15s
    return () => clearInterval(t);
  }, []);
  const start = new Date(since).getTime();
  const mins = Math.max(0, Math.floor((Date.now() - start) / 60000));
  let label: string;
  if (mins < 60) label = `${mins} min`;
  else if (mins < 1440) { const h = Math.floor(mins / 60), m = mins % 60; label = m ? `${h} h ${m} min` : `${h} h`; }
  else label = `${Math.floor(mins / 1440)} d`;
  // Color según urgencia: <30m gris, 30–60m ámbar, >60m rojo.
  const color = mins >= 60 ? RED : mins >= 30 ? ORANGE : "var(--adm-text2)";
  const bg = mins >= 60 ? "rgba(239,68,68,0.12)" : mins >= 30 ? "rgba(249,115,22,0.12)" : "var(--adm-hover)";
  return (
    <span title="Tiempo desde que se creó el pedido" style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 999, fontFamily: F, fontSize: "0.68rem", fontWeight: 800, background: bg, color }}>
      <Clock size={11} /> {label}
    </span>
  );
}

function OrderCard({ o, flash, onAdvance, onDelete, onCourier, onCancelCourier, courierBusy, uberEnabled = true, pedidosyaEnabled = true }: { o: PosOrder; flash: boolean; onAdvance: (o: PosOrder, s: Stage) => void; onDelete: (o: PosOrder) => void; onCourier: (o: PosOrder, p: "uber" | "pedidosya") => void; onCancelCourier: (o: PosOrder) => void; courierBusy?: boolean; uberEnabled?: boolean; pedidosyaEnabled?: boolean }) {
  const badge = saleBadge(o);
  const acts = nextActions(o);
  const canceled = o.posStatus === "canceled";
  const isTest = o.externalId.startsWith("TEST-");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onEsc); };
  }, [menuOpen]);
  const items: any[] = Array.isArray(o.items) ? o.items : [];
  const hasCourier = !!(o.uberDeliveryId || o.pyaShippingId);
  const courierName = o.uberDeliveryId ? "Uber Direct" : o.pyaShippingId ? "PedidosYa" : null;
  // Se puede solicitar courier desde "En preparación" o "Listo" (a veces se pide
  // con anticipación). Solicitarlo NO cambia la etapa: el paso a reparto lo hace
  // el webhook de Uber/PedidosYa. En reparto ya lo lleva alguien, no se ofrece.
  const canRequestCourier = isDeliveryOrder(o) && !hasCourier && !canceled && (o.opsStage === "preparing" || o.opsStage === "ready") && (uberEnabled || pedidosyaEnabled);
  return (
    <div style={{ background: "var(--adm-card)", border: `1px solid ${flash ? GREEN : "var(--adm-card-border)"}`, boxShadow: flash ? `0 0 0 3px rgba(34,197,94,0.2)` : "none", borderRadius: 12, padding: 11, transition: "box-shadow .3s, border-color .3s" }}>
      {o.vendorName && (
        <p style={{ textAlign: "center", margin: "0 0 6px", fontFamily: FB, fontSize: "0.72rem", fontWeight: 700, color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.vendorName}</p>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 6, fontFamily: F, fontSize: "0.68rem", fontWeight: 900, letterSpacing: "-0.01em", background: `${badge.color}2e`, color: badge.deep }}>
            <badge.icon size={12} strokeWidth={2.6} /> {badge.label}
          </span>
          {flash && <span style={{ fontFamily: F, fontSize: "0.6rem", fontWeight: 900, color: "#fff", background: GREEN, borderRadius: 999, padding: "1px 6px" }}>NUEVO</span>}
          {canceled && <span style={{ fontFamily: F, fontSize: "0.6rem", fontWeight: 900, color: "#fff", background: RED, borderRadius: 999, padding: "1px 6px" }}>CANCELADO</span>}
          {isTest && <span style={{ fontFamily: F, fontSize: "0.6rem", fontWeight: 900, color: "#fff", background: BLUE, borderRadius: 999, padding: "1px 6px" }}>PRUEBA</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        {o.opsStage !== "delivered" && !canceled && <ElapsedTimer since={o.createdAt} />}
        <div ref={menuRef} style={{ position: "relative" }}>
          <button onClick={() => setMenuOpen((v) => !v)} title="Opciones" aria-label="Opciones" style={{ width: 24, height: 24, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 7, border: "none", background: menuOpen ? "var(--adm-hover)" : "transparent", color: "var(--adm-text3)", cursor: "pointer" }}><MoreVertical size={15} /></button>
          {menuOpen && (
            <div style={{ position: "absolute", top: 30, right: 0, zIndex: 30, minWidth: 190, background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 11, boxShadow: "0 10px 30px rgba(0,0,0,0.22)", padding: 6, display: "flex", flexDirection: "column", gap: 1 }}>
              <span style={{ fontFamily: F, fontSize: "0.66rem", fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--adm-text3)", padding: "6px 8px 3px" }}>Mover a etapa</span>
              {STAGES.map((st) => {
                const current = st === o.opsStage;
                const Ic = STAGE_LUCIDE[st];
                return (
                  <button
                    key={st}
                    disabled={current}
                    onClick={() => { onAdvance(o, st); setMenuOpen(false); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "8px 8px", borderRadius: 8, border: "none", background: current ? "var(--adm-hover)" : "transparent", color: current ? "var(--adm-text3)" : "var(--adm-text)", fontFamily: FB, fontSize: "0.82rem", fontWeight: 600, cursor: current ? "default" : "pointer" }}
                    onMouseEnter={(e) => { if (!current) e.currentTarget.style.background = "var(--adm-hover)"; }}
                    onMouseLeave={(e) => { if (!current) e.currentTarget.style.background = "transparent"; }}
                  >
                    <Ic size={15} color={current ? "var(--adm-text3)" : STAGE_ACCENT[st]} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{STAGE_LABEL[st]}</span>
                    {current && <span style={{ fontSize: "0.66rem", color: "var(--adm-text3)" }}>actual</span>}
                  </button>
                );
              })}
              {o.trackingToken && (
                <>
                  <div style={{ height: 1, background: "var(--adm-card-border)", margin: "4px 2px" }} />
                  <a
                    href={`/track/${o.trackingToken}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setMenuOpen(false)}
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "8px 8px", borderRadius: 8, border: "none", background: "transparent", color: "var(--adm-text)", fontFamily: FB, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", textDecoration: "none" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--adm-hover)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <MapPinned size={14} /> Ver seguimiento
                  </a>
                </>
              )}
              <div style={{ height: 1, background: "var(--adm-card-border)", margin: "4px 2px" }} />
              <button
                onClick={() => { setMenuOpen(false); onDelete(o); }}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "8px 8px", borderRadius: 8, border: "none", background: "transparent", color: RED, fontFamily: FB, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = `${RED}14`; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <Trash2 size={14} /> Eliminar pedido
              </button>
            </div>
          )}
        </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <p style={{ fontFamily: F, fontSize: "0.92rem", fontWeight: 900, letterSpacing: "-0.01em", color: "var(--adm-text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.customerName || (o.orderReference ? `#${o.orderReference}` : "Pedido")}</p>
        <span style={{ fontFamily: F, fontSize: "0.86rem", fontWeight: 800, color: ACCENT, flexShrink: 0 }}>{clp(o.totalAmount)}</span>
      </div>

      {(o.customerPhone || o.addressLine) && (
        <div style={{ marginTop: 3, display: "flex", flexDirection: "column", gap: 1 }}>
          {o.customerPhone && <a href={`tel:${o.customerPhone}`} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text2)", textDecoration: "none" }}><Phone size={11} style={{ flexShrink: 0 }} /> {o.customerPhone}</a>}
          {o.addressLine && <span style={{ display: "inline-flex", alignItems: "flex-start", gap: 5, fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text2)" }}><MapPin size={11} style={{ marginTop: 2, flexShrink: 0 }} /> {o.addressLine}</span>}
        </div>
      )}

      {/* Repartidor propio (el de Uber/PedidosYa se muestra en el bloque de courier). */}
      {o.assignedTo && (o.opsStage === "out_for_delivery" || o.opsStage === "delivered") && (
        <div style={{ marginTop: 6 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: F, fontSize: "0.74rem", fontWeight: 800, color: BLUE, background: `${BLUE}14`, borderRadius: 7, padding: "3px 8px" }}>
            <Bike size={12} /> Repartidor: {o.assignedTo}
          </span>
        </div>
      )}

      {items.length > 0 && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--adm-card-border)", display: "flex", flexDirection: "column", gap: 2 }}>
          {items.slice(0, 6).map((ln, i) => {
            const qty = Number(ln?.quantity ?? ln?.qty ?? 1) || 1;
            const name = String(ln?.productName ?? ln?.name ?? ln?.dishName ?? "Ítem");
            return <div key={i} style={{ fontFamily: FB, fontSize: "0.73rem", lineHeight: 1.35, color: "var(--adm-text2)" }}><strong style={{ color: "var(--adm-text)" }}>{qty}×</strong> {name}</div>;
          })}
          {items.length > 6 && <div style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)" }}>+{items.length - 6} más…</div>}
        </div>
      )}

      {(o.tipAmount > 0 || o.changeAmount > 0 || o.deliveryFee > 0) && (
        <div style={{ marginTop: 6, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {o.deliveryFee > 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: FB, fontSize: "0.74rem", fontWeight: 700, color: "var(--adm-text2)" }}>
              <Truck size={13} style={{ color: "var(--adm-text3)", flexShrink: 0 }} /> <span style={{ fontFamily: FB, fontWeight: 700 }}>Envío</span> <span style={{ fontFamily: FB, fontWeight: 700, color: "var(--adm-text)" }}>{clp(o.deliveryFee)}</span>
            </span>
          )}
          {o.tipAmount > 0 && <Chip label={`Propina ${clp(o.tipAmount)}`} color={GREEN} />}
          {o.changeAmount > 0 && <Chip label={`Vuelto ${clp(o.changeAmount)}`} color={ORANGE} />}
        </div>
      )}

      {acts.length > 0 && (
        <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
          {acts.map((a) => (
            <button key={a.stage} onClick={() => onAdvance(o, a.stage)} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "8px 10px", borderRadius: 8, border: "none", background: a.color, color: "#fff", fontFamily: F, fontSize: "0.78rem", fontWeight: 800, cursor: "pointer" }}>
              <Check size={13} /> {a.label}
            </button>
          ))}
        </div>
      )}

      {/* Courier externo (Uber / PedidosYa) para pedidos de delivery */}
      {hasCourier ? (() => {
        const c = o.courier || {};
        const pickEta = etaLabel(c.pickupEta);
        const dropEta = etaLabel(c.eta);
        return (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--adm-card-border)", display: "flex", flexDirection: "column", gap: 7 }}>
          {/* Repartidor + estado */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {c.courierImg
              ? <img src={c.courierImg} alt="" style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
              : <span style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(124,58,237,0.12)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Bike size={15} color="#7c3aed" /></span>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: F, fontSize: "0.8rem", fontWeight: 800, color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.courierName || courierName}</div>
              <div style={{ fontFamily: FB, fontSize: "0.7rem", color: "#7c3aed", fontWeight: 700 }}>{courierName} · {courierStatusLabel(courierName, c.status)}</div>
            </div>
            {c.courierPhone && <a href={`tel:${c.courierPhone}`} onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 9px", borderRadius: 8, border: "1px solid var(--adm-card-border)", color: "var(--adm-text2)", fontFamily: F, fontSize: "0.72rem", fontWeight: 700, textDecoration: "none" }}><Phone size={12} /> Llamar</a>}
          </div>

          {/* ETAs */}
          {(pickEta || dropEta) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 2, fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text2)" }}>
              {pickEta && <span>🏍️ Llega al local: <strong style={{ color: "var(--adm-text)" }}>{pickEta}</strong></span>}
              {dropEta && <span>🏠 Llega al cliente: <strong style={{ color: "var(--adm-text)" }}>{dropEta}</strong></span>}
            </div>
          )}

          {/* Códigos (PIN) */}
          {(c.pickupPin || c.dropoffPin) && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {c.pickupPin && <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text2)", background: "var(--adm-hover)", borderRadius: 7, padding: "4px 9px" }}>🔑 Código local: <strong style={{ fontFamily: "monospace", color: "var(--adm-text)", letterSpacing: "1px" }}>{c.pickupPin}</strong></span>}
              {c.dropoffPin && <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text2)", background: "var(--adm-hover)", borderRadius: 7, padding: "4px 9px" }}>🔑 Código cliente: <strong style={{ fontFamily: "monospace", color: "var(--adm-text)", letterSpacing: "1px" }}>{c.dropoffPin}</strong></span>}
            </div>
          )}
          {c.dropoffPin && <span style={{ fontFamily: FB, fontSize: "0.66rem", color: "var(--adm-text3)" }}>El cliente le da el <strong>código cliente</strong> al repartidor (respaldo si no le llegó).</span>}

          {/* Seguir / cancelar */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {c.trackingUrl && <a href={c.trackingUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ fontFamily: FB, fontSize: "0.74rem", color: BLUE, textDecoration: "none", fontWeight: 700 }}>Ver seguimiento →</a>}
            {o.opsStage !== "delivered" && c.status !== "canceled" && <button onClick={() => onCancelCourier(o)} style={{ marginLeft: "auto", fontFamily: FB, fontSize: "0.72rem", color: RED, background: "transparent", border: "none", cursor: "pointer" }}>Cancelar courier</button>}
          </div>
        </div>
        );
      })() : canRequestCourier ? (
        <div style={{ marginTop: 8, padding: "8px 9px", borderRadius: 10, background: "var(--adm-hover)" }}>
          <span style={{ display: "block", fontFamily: FB, fontSize: "0.68rem", fontWeight: 600, color: "var(--adm-text2)", marginBottom: 6 }}>{courierBusy ? "Solicitando…" : "Solicitar:"}</span>
          <div style={{ display: "flex", gap: 6 }}>
            {uberEnabled && (
              <button disabled={courierBusy} onClick={() => onCourier(o, "uber")} style={{ flex: 1, minWidth: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "6px 8px", borderRadius: 8, border: "1px solid var(--adm-card-border)", background: "var(--adm-card)", color: "var(--adm-text)", fontFamily: F, fontSize: "0.74rem", fontWeight: 700, whiteSpace: "nowrap", cursor: courierBusy ? "wait" : "pointer", opacity: courierBusy ? 0.5 : 1, boxShadow: "0 1px 3px rgba(0,0,0,0.14)" }}>
                <span style={{ width: 16, height: 16, borderRadius: 4, background: "#000", color: "#fff", fontFamily: F, fontSize: "0.62rem", fontWeight: 900, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>U</span>
                Uber Direct
              </button>
            )}
            {pedidosyaEnabled && (
              <button disabled={courierBusy} onClick={() => onCourier(o, "pedidosya")} style={{ flex: 1, minWidth: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "6px 8px", borderRadius: 8, border: "1px solid var(--adm-card-border)", background: "var(--adm-card)", color: "var(--adm-text)", fontFamily: F, fontSize: "0.74rem", fontWeight: 700, whiteSpace: "nowrap", cursor: courierBusy ? "wait" : "pointer", opacity: courierBusy ? 0.5 : 1, boxShadow: "0 1px 3px rgba(0,0,0,0.14)" }}>
                <span style={{ width: 16, height: 16, borderRadius: 4, background: "#E4002B", color: "#fff", fontFamily: F, fontSize: "0.62rem", fontWeight: 900, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>P</span>
                PedidosYa
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Chip({ label, color }: { label: string; color?: string }) {
  return <span style={{ fontFamily: FB, fontSize: "0.7rem", fontWeight: 700, color: color || "var(--adm-text2)", background: color ? `${color}1a` : "var(--adm-hover)", borderRadius: 6, padding: "2px 7px" }}>{label}</span>;
}

function SegTab({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button onClick={onClick} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "7px 10px", borderRadius: 8, cursor: "pointer", fontFamily: F, fontSize: "0.8rem", fontWeight: 800, border: "none", background: active ? ACCENT : "transparent", color: active ? "#fff" : "var(--adm-text2)", boxShadow: active ? "0 1px 3px rgba(0,0,0,0.12)" : "none", transition: "background .15s" }}>
      <Icon size={15} /> {label}
    </button>
  );
}
