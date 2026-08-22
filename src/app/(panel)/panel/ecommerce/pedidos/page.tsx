"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardList, MapPin, Store, RefreshCw, X, History, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { useSessionContext } from "@/lib/admin/SessionContext";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#F4A623";
const ORANGE = "#f97316", BLUE = "#3b82f6", GOLD = "#F4A623", GREEN = "#22c55e", GRAY = "#9ca3af", RED = "#ef4444";

type OrderStatus = "PENDING" | "ACCEPTED" | "PREPARING" | "IN_DELIVERY" | "READY" | "DONE" | "CANCELLED";

interface OrderItem { dishName?: string; name?: string; quantity: number; unitTotal?: number; unit_price?: number; selectedOptions?: { optionName: string }[] }
interface Order {
  id: string; orderNumber?: number | null; customerName: string; customerPhone: string; customerEmail?: string | null;
  orderType: "PICKUP" | "DELIVERY"; deliveryAddress: string | null; paymentMethod: string; paymentStatus: string; paymentGateway?: string | null;
  items: OrderItem[]; total: number; deliveryFee?: number; discount?: number; couponCode?: string | null;
  notes: string | null; status: OrderStatus; createdAt: string; toteatOrderId?: string | null; posError?: string | null; cancellationReason?: string | null;
  statusHistory?: { status: string; ts: string }[];
}

const STATUS_LABEL: Record<OrderStatus, string> = { PENDING: "Nuevo", ACCEPTED: "Aceptado", PREPARING: "Preparando", IN_DELIVERY: "En reparto", READY: "Listo", DONE: "Entregado", CANCELLED: "Cancelado" };
const STATUS_COLOR: Record<OrderStatus, string> = { PENDING: ORANGE, ACCEPTED: BLUE, PREPARING: GOLD, IN_DELIVERY: GREEN, READY: GREEN, DONE: GRAY, CANCELLED: RED };
const STATUS_ORDER: OrderStatus[] = ["PENDING", "ACCEPTED", "PREPARING", "IN_DELIVERY", "READY", "DONE", "CANCELLED"];
const NEXT_ACTIONS: Record<OrderStatus, { status: OrderStatus; label: string; color: string }[]> = {
  PENDING: [{ status: "ACCEPTED", label: "Aceptar", color: BLUE }, { status: "CANCELLED", label: "Rechazar", color: RED }],
  ACCEPTED: [{ status: "PREPARING", label: "Preparando", color: GOLD }, { status: "CANCELLED", label: "Cancelar", color: RED }],
  PREPARING: [{ status: "IN_DELIVERY", label: "En reparto", color: GREEN }, { status: "READY", label: "Listo", color: GREEN }, { status: "CANCELLED", label: "Cancelar", color: RED }],
  IN_DELIVERY: [{ status: "DONE", label: "Entregado", color: GRAY }],
  READY: [{ status: "DONE", label: "Entregado", color: GRAY }],
  DONE: [], CANCELLED: [],
};

const PAY_LABEL: Record<string, string> = { webpay: "Webpay", flow: "Flow", efectivo: "Efectivo", transferencia: "Transferencia", tarjeta: "Tarjeta" };
const isOnline = (o: Order) => o.paymentMethod === "webpay" || o.paymentMethod === "flow";
const isAttempt = (o: Order) => isOnline(o) && o.paymentStatus !== "paid"; // intento de pago no completado
function payInfo(o: Order): { label: string; color: string } {
  if (o.paymentStatus === "paid") return { label: "Pagado", color: GREEN };
  if (o.paymentStatus === "failed") return { label: "Pago fallido", color: RED };
  if (isOnline(o)) return { label: "Pago pendiente", color: ORANGE };
  return { label: "Por pagar", color: GRAY };
}

const fmt = (n: number) => `$${Math.round(n || 0).toLocaleString("es-CL")}`;
function relativeTime(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "hace un momento";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}
const fmtFull = (iso: string) => new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" });

export default function EcommercePedidosPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const [orders, setOrders] = useState<Order[]>([]);
  const [view, setView] = useState<"activos" | "historial">("activos");
  const [statusFilter, setStatusFilter] = useState<"todos" | OrderStatus>("todos");
  const [loading, setLoading] = useState(true);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<Order | null>(null);
  const knownPendingRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);

  const beep = () => {
    try {
      const AC = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const Ctx = AC.AudioContext || AC.webkitAudioContext; if (!Ctx) return;
      const ctx = new Ctx(); const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.value = 0.12;
      o.start(); o.stop(ctx.currentTime + 0.18);
    } catch {}
  };

  const fetchOrders = useCallback(async (poll = false) => {
    if (!restaurantId) return;
    try {
      const res = await fetch(`/api/panel/orders?restaurantId=${restaurantId}&source=ecommerce`);
      if (!res.ok) return;
      const data = await res.json();
      const fetched: Order[] = data.orders || [];
      const currentPending = fetched.filter((o) => o.status === "PENDING" && !isAttempt(o)).map((o) => o.id);
      if (!firstLoadRef.current) {
        const fresh = currentPending.filter((id) => !knownPendingRef.current.has(id));
        if (fresh.length) { beep(); setNewIds((s) => new Set([...s, ...fresh])); if (poll) { setView("activos"); setStatusFilter("todos"); } }
      }
      knownPendingRef.current = new Set(currentPending);
      firstLoadRef.current = false;
      setOrders(fetched);
      setDetail((d) => (d ? fetched.find((o) => o.id === d.id) ?? null : null));
    } catch {} finally { setLoading(false); }
  }, [restaurantId]);

  useEffect(() => {
    fetchOrders(false);
    const t = setInterval(() => fetchOrders(true), 10000);
    return () => clearInterval(t);
  }, [fetchOrders]);

  async function updateStatus(id: string, status: OrderStatus, reason?: string) {
    try {
      const res = await fetch("/api/panel/orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: id, status, cancellationReason: reason }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error || "No se pudo actualizar"); return; }
      setNewIds((s) => { const n = new Set(s); n.delete(id); return n; });
      setOrders((os) => os.map((o) => (o.id === id ? { ...o, status } : o)));
      setDetail((d) => (d && d.id === id ? { ...d, status } : d));
      toast.success(`Pedido ${STATUS_LABEL[status].toLowerCase()}`);
    } catch { toast.error("Error de conexión"); }
  }

  // Base según vista: activos oculta intentos de pago; historial muestra todo.
  const base = view === "activos" ? orders.filter((o) => !isAttempt(o)) : orders;
  const shown = statusFilter === "todos" ? base : base.filter((o) => o.status === statusFilter);
  const pendingCount = orders.filter((o) => o.status === "PENDING" && !isAttempt(o)).length;
  const countFor = (s: OrderStatus | "todos") => (s === "todos" ? base.length : base.filter((o) => o.status === s).length);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "8px 4px 40px" }}>
      <Link href="/panel/ecommerce" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", textDecoration: "none", marginBottom: 18 }}>
        <ArrowLeft size={15} /> Ecommerce
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: `${ACCENT}1a`, display: "flex", alignItems: "center", justifyContent: "center" }}><ClipboardList size={20} color={ACCENT} /></div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: F, fontSize: "1.3rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Pedidos</h1>
          <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>{pendingCount > 0 ? `${pendingCount} nuevo${pendingCount !== 1 ? "s" : ""} · ` : ""}se actualiza solo</p>
        </div>
        <button onClick={() => fetchOrders(false)} title="Actualizar" style={iconBtn}><RefreshCw size={16} /></button>
      </div>

      {/* Vista: Activos / Historial */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={() => { setView("activos"); setStatusFilter("todos"); }} style={viewBtn(view === "activos")}><ListChecks size={15} /> Activos</button>
        <button onClick={() => { setView("historial"); setStatusFilter("todos"); }} style={viewBtn(view === "historial")}><History size={15} /> Historial</button>
      </div>
      {view === "historial" && <p style={{ fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text3)", margin: "0 2px 12px" }}>Todos los pedidos, incluidos los intentos de pago no completados.</p>}

      {/* Chips por estado */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        <Chip label="Todos" count={countFor("todos")} on={statusFilter === "todos"} onClick={() => setStatusFilter("todos")} color="var(--adm-text2)" />
        {STATUS_ORDER.map((s) => <Chip key={s} label={STATUS_LABEL[s]} count={countFor(s)} on={statusFilter === s} onClick={() => setStatusFilter(s)} color={STATUS_COLOR[s]} />)}
      </div>

      {loading ? (
        <p style={{ fontFamily: FB, color: "var(--adm-text3)" }}>Cargando…</p>
      ) : shown.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 20px", border: "1px dashed var(--adm-card-border)", borderRadius: 14, fontFamily: FB, color: "var(--adm-text3)" }}>No hay pedidos aquí.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {shown.map((o) => <OrderRow key={o.id} order={o} isNew={newIds.has(o.id)} onOpen={() => setDetail(o)} onStatusChange={updateStatus} />)}
        </div>
      )}

      {detail && <DetailModal order={detail} onClose={() => setDetail(null)} onStatusChange={updateStatus} />}
    </div>
  );
}

function Chip({ label, count, on, onClick, color }: { label: string; count: number; on: boolean; onClick: () => void; color: string }) {
  return (
    <button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 999, cursor: "pointer", fontFamily: F, fontSize: "0.76rem", fontWeight: 700, border: `1px solid ${on ? color : "var(--adm-card-border)"}`, background: on ? `${color}22` : "transparent", color: on ? color : "var(--adm-text2)" }}>
      {label}<span style={{ fontFamily: FB, fontSize: "0.68rem", opacity: 0.7 }}>{count}</span>
    </button>
  );
}

function OrderRow({ order, isNew, onOpen, onStatusChange }: { order: Order; isNew: boolean; onOpen: () => void; onStatusChange: (id: string, s: OrderStatus, r?: string) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const actions = NEXT_ACTIONS[order.status] ?? [];
  const pay = payInfo(order);
  const attempt = isAttempt(order);

  const act = async (s: OrderStatus) => { if (s === "CANCELLED") { setCancelOpen(true); return; } setBusy(true); await onStatusChange(order.id, s); setBusy(false); };

  return (
    <div style={{ background: "var(--adm-card)", border: `1px solid ${isNew ? ORANGE : "var(--adm-card-border)"}`, borderRadius: 14, padding: 14, opacity: attempt ? 0.75 : 1 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <button onClick={onOpen} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: F, fontSize: "0.92rem", fontWeight: 800, color: "var(--adm-text)" }}>#{order.orderNumber ?? order.id.slice(-5)}</span>
            <span style={{ fontFamily: FB, fontSize: "0.66rem", fontWeight: 700, color: "#fff", background: STATUS_COLOR[order.status], padding: "2px 8px", borderRadius: 999 }}>{STATUS_LABEL[order.status]}</span>
            {isNew && <span style={{ fontFamily: FB, fontSize: "0.6rem", fontWeight: 800, color: ORANGE }}>● NUEVO</span>}
            {attempt && <span style={{ fontFamily: FB, fontSize: "0.6rem", fontWeight: 800, color: pay.color }}>⚠ {pay.label.toUpperCase()}</span>}
          </div>
          <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text)", margin: "6px 0 0", fontWeight: 600, textDecoration: "underline", textDecorationColor: "var(--adm-card-border)", textUnderlineOffset: 3 }}>{order.customerName}</p>
          <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "2px 0 0", display: "inline-flex", alignItems: "center", gap: 5 }}>
            {order.orderType === "DELIVERY" ? <MapPin size={12} /> : <Store size={12} />} {order.orderType === "DELIVERY" ? "Delivery" : "Retiro"} · {relativeTime(order.createdAt)}
          </p>
        </button>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ fontFamily: F, fontSize: "1rem", fontWeight: 900, color: "var(--adm-text)", margin: 0 }}>{fmt(order.total)}</p>
          <p style={{ fontFamily: FB, fontSize: "0.66rem", fontWeight: 700, margin: "2px 0 0", color: pay.color }}>{PAY_LABEL[order.paymentMethod] || order.paymentMethod} · {pay.label}</p>
        </div>
      </div>

      {actions.length > 0 && !attempt && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          {actions.map((a) => <button key={a.status} onClick={() => act(a.status)} disabled={busy} style={{ flex: a.status === "CANCELLED" ? "0 0 auto" : 1, minWidth: 90, padding: "9px 12px", borderRadius: 10, border: "none", background: a.color, color: "#fff", fontFamily: F, fontSize: "0.8rem", fontWeight: 700, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1 }}>{a.label}</button>)}
        </div>
      )}
      {cancelOpen && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo de cancelación (requerido)" style={inp} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={async () => { setBusy(true); await onStatusChange(order.id, "CANCELLED", reason.trim()); setBusy(false); setCancelOpen(false); }} disabled={busy || !reason.trim()} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: RED, color: "#fff", fontFamily: F, fontSize: "0.78rem", fontWeight: 700, cursor: busy || !reason.trim() ? "not-allowed" : "pointer", opacity: !reason.trim() ? 0.5 : 1 }}>Confirmar cancelación</button>
            <button onClick={() => setCancelOpen(false)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text2)", fontFamily: F, fontSize: "0.78rem", cursor: "pointer" }}>Volver</button>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailModal({ order, onClose, onStatusChange }: { order: Order; onClose: () => void; onStatusChange: (id: string, s: OrderStatus, r?: string) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const items = Array.isArray(order.items) ? order.items : [];
  const actions = NEXT_ACTIONS[order.status] ?? [];
  const pay = payInfo(order);
  const subtotal = items.reduce((s, it) => s + (it.unitTotal ?? it.unit_price ?? 0) * it.quantity, 0);

  useEffect(() => { const prev = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = prev; }; }, []);

  const act = async (s: OrderStatus) => { if (s === "CANCELLED") { setCancelOpen(true); return; } setBusy(true); await onStatusChange(order.id, s); setBusy(false); };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 0 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--adm-card)", width: "100%", maxWidth: 520, maxHeight: "88vh", overflowY: "auto", borderRadius: "18px 18px 0 0", border: "1px solid var(--adm-card-border)" }}>
        <div style={{ position: "sticky", top: 0, background: "var(--adm-card)", padding: "16px 18px", borderBottom: "1px solid var(--adm-card-border)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div>
            <h3 style={{ fontFamily: F, fontSize: "1.05rem", fontWeight: 900, color: "var(--adm-text)", margin: 0 }}>Pedido #{order.orderNumber ?? order.id.slice(-5)}</h3>
            <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "3px 0 0" }}>{fmtFull(order.createdAt)}</p>
          </div>
          <span style={{ fontFamily: FB, fontSize: "0.68rem", fontWeight: 700, color: "#fff", background: STATUS_COLOR[order.status], padding: "3px 10px", borderRadius: 999, flexShrink: 0 }}>{STATUS_LABEL[order.status]}</span>
          <button onClick={onClose} style={{ ...iconBtn, width: 32, height: 32 }}><X size={16} /></button>
        </div>

        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Cliente */}
          <div style={{ fontFamily: FB, fontSize: "0.84rem" }}>
            <p style={{ fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>{order.customerName || "Cliente"}</p>
            {order.customerPhone && <p style={{ color: "var(--adm-text2)", margin: "2px 0 0" }}>{order.customerPhone}</p>}
            {order.customerEmail && <p style={{ color: "var(--adm-text2)", margin: "2px 0 0" }}>{order.customerEmail}</p>}
            <p style={{ color: "var(--adm-text2)", margin: "6px 0 0" }}>{order.orderType === "DELIVERY" ? `🛵 Delivery${order.deliveryAddress ? ` · ${order.deliveryAddress}` : ""}` : "🏠 Retiro en tienda"}</p>
          </div>

          {/* Items */}
          <div style={{ border: "1px solid var(--adm-card-border)", borderRadius: 12, overflow: "hidden" }}>
            {items.map((it, i) => (
              <div key={i} style={{ padding: "10px 12px", borderBottom: i < items.length - 1 ? "1px solid var(--adm-card-border)" : "none", display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontFamily: FB, fontSize: "0.84rem", color: "var(--adm-text)", margin: 0 }}><b>{it.quantity}×</b> {it.dishName || it.name}</p>
                  {it.selectedOptions?.length ? <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>{it.selectedOptions.map((o) => o.optionName).join(", ")}</p> : null}
                </div>
                <span style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", flexShrink: 0 }}>{fmt((it.unitTotal ?? it.unit_price ?? 0) * it.quantity)}</span>
              </div>
            ))}
            {items.length === 0 && <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", textAlign: "center", padding: 16, margin: 0 }}>Sin items.</p>}
          </div>

          {/* Montos */}
          <div style={{ fontFamily: FB, fontSize: "0.84rem", display: "flex", flexDirection: "column", gap: 4 }}>
            {(order.total !== subtotal) && <div style={{ display: "flex", justifyContent: "space-between", color: "var(--adm-text3)" }}><span>Subtotal</span><span>{fmt(subtotal)}</span></div>}
            {(order.deliveryFee ?? 0) > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: "var(--adm-text3)" }}><span>Despacho</span><span>{fmt(order.deliveryFee!)}</span></div>}
            {(order.discount ?? 0) > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: ACCENT }}><span>Descuento{order.couponCode ? ` (${order.couponCode})` : ""}</span><span>−{fmt(order.discount!)}</span></div>}
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: F, fontWeight: 900, color: "var(--adm-text)", paddingTop: 5, borderTop: "1px solid var(--adm-card-border)" }}><span>Total</span><span>{fmt(order.total)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.76rem", marginTop: 2 }}><span style={{ color: "var(--adm-text3)" }}>Pago</span><span style={{ color: pay.color, fontWeight: 700 }}>{PAY_LABEL[order.paymentMethod] || order.paymentMethod} · {pay.label}</span></div>
          </div>

          {order.notes && <div style={{ fontFamily: FB, fontSize: "0.8rem", background: "var(--adm-hover)", borderRadius: 10, padding: "10px 12px", color: "var(--adm-text2)" }}>📝 {order.notes}</div>}
          {order.cancellationReason && <div style={{ fontFamily: FB, fontSize: "0.8rem", color: RED }}>Motivo de cancelación: {order.cancellationReason}</div>}
          {order.toteatOrderId && <div style={{ fontFamily: FB, fontSize: "0.76rem", color: GREEN }}>🖨️ Enviado al POS (Toteat #{order.toteatOrderId})</div>}
          {order.posError && <div style={{ fontFamily: FB, fontSize: "0.76rem", color: RED }}>⚠️ Error POS: {order.posError}</div>}

          {/* Timeline */}
          {Array.isArray(order.statusHistory) && order.statusHistory.length > 0 && (
            <div>
              <p style={{ fontFamily: FB, fontSize: "0.66rem", fontWeight: 700, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: 0.4, margin: "0 0 6px" }}>Línea de tiempo</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {order.statusHistory.map((h, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontFamily: FB, fontSize: "0.76rem" }}>
                    <span style={{ color: STATUS_COLOR[h.status as OrderStatus] || "var(--adm-text2)", fontWeight: 600 }}>{STATUS_LABEL[h.status as OrderStatus] || h.status}</span>
                    <span style={{ color: "var(--adm-text3)" }}>{new Date(h.ts).toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Acciones */}
          {actions.length > 0 && (
            cancelOpen ? (
              <div style={{ padding: 12, borderRadius: 10, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)" }}>
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo de cancelación (requerido)" style={inp} />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button onClick={async () => { setBusy(true); await onStatusChange(order.id, "CANCELLED", reason.trim()); setBusy(false); setCancelOpen(false); }} disabled={busy || !reason.trim()} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: RED, color: "#fff", fontFamily: F, fontSize: "0.78rem", fontWeight: 700, cursor: busy || !reason.trim() ? "not-allowed" : "pointer", opacity: !reason.trim() ? 0.5 : 1 }}>Confirmar cancelación</button>
                  <button onClick={() => setCancelOpen(false)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text2)", fontFamily: F, fontSize: "0.78rem", cursor: "pointer" }}>Volver</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {actions.map((a) => <button key={a.status} onClick={() => act(a.status)} disabled={busy} style={{ flex: a.status === "CANCELLED" ? "0 0 auto" : 1, minWidth: 90, padding: "11px 14px", borderRadius: 10, border: "none", background: a.color, color: "#fff", fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1 }}>{a.label}</button>)}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

const iconBtn: React.CSSProperties = { width: 38, height: 38, borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "var(--adm-hover)", color: "var(--adm-text2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
const inp: React.CSSProperties = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--adm-card-border)", background: "var(--adm-input, var(--adm-card))", color: "var(--adm-text)", fontFamily: FB, fontSize: "0.82rem", outline: "none" };
function viewBtn(on: boolean): React.CSSProperties {
  return { flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px", borderRadius: 10, cursor: "pointer", fontFamily: F, fontSize: "0.82rem", fontWeight: 700, border: `1px solid ${on ? ACCENT : "var(--adm-card-border)"}`, background: on ? ACCENT : "var(--adm-hover)", color: on ? "#1a1a1a" : "var(--adm-text2)" };
}
