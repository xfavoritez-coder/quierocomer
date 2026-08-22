"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardList, MapPin, Store, RefreshCw } from "lucide-react";
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
  orderType: "PICKUP" | "DELIVERY"; deliveryAddress: string | null; paymentMethod: string; paymentStatus: string;
  items: OrderItem[]; total: number; deliveryFee?: number; discount?: number; couponCode?: string | null;
  notes: string | null; status: OrderStatus; createdAt: string; toteatOrderId?: string | null; posError?: string | null;
}

const STATUS_LABEL: Record<OrderStatus, string> = { PENDING: "Nuevo", ACCEPTED: "Aceptado", PREPARING: "Preparando", IN_DELIVERY: "En reparto", READY: "Listo", DONE: "Entregado", CANCELLED: "Cancelado" };
const STATUS_COLOR: Record<OrderStatus, string> = { PENDING: ORANGE, ACCEPTED: BLUE, PREPARING: GOLD, IN_DELIVERY: GREEN, READY: GREEN, DONE: GRAY, CANCELLED: RED };
const NEXT_ACTIONS: Record<OrderStatus, { status: OrderStatus; label: string; color: string }[]> = {
  PENDING: [{ status: "ACCEPTED", label: "Aceptar", color: BLUE }, { status: "CANCELLED", label: "Rechazar", color: RED }],
  ACCEPTED: [{ status: "PREPARING", label: "Preparando", color: GOLD }, { status: "CANCELLED", label: "Cancelar", color: RED }],
  PREPARING: [{ status: "IN_DELIVERY", label: "En reparto", color: GREEN }, { status: "READY", label: "Listo", color: GREEN }, { status: "CANCELLED", label: "Cancelar", color: RED }],
  IN_DELIVERY: [{ status: "DONE", label: "Entregado", color: GRAY }],
  READY: [{ status: "DONE", label: "Entregado", color: GRAY }],
  DONE: [], CANCELLED: [],
};
const TABS = [
  { id: "active", label: "Activos", statuses: ["PENDING", "ACCEPTED", "PREPARING"] as OrderStatus[] },
  { id: "out", label: "En curso", statuses: ["IN_DELIVERY", "READY"] as OrderStatus[] },
  { id: "history", label: "Historial", statuses: ["DONE", "CANCELLED"] as OrderStatus[] },
] as const;
type TabId = (typeof TABS)[number]["id"];

const PAY_LABEL: Record<string, string> = { webpay: "Webpay", flow: "Flow", efectivo: "Efectivo", transferencia: "Transferencia", tarjeta: "Tarjeta" };
const fmt = (n: number) => `$${Math.round(n || 0).toLocaleString("es-CL")}`;
function relativeTime(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "hace un momento";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}

export default function EcommercePedidosPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<TabId>("active");
  const [loading, setLoading] = useState(true);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const knownPendingRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);

  const beep = () => {
    try {
      const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext });
      const Ctx = AC.AudioContext || AC.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880; g.gain.value = 0.12;
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
      // Detectar nuevos pendientes.
      const currentPending = fetched.filter((o) => o.status === "PENDING").map((o) => o.id);
      if (!firstLoadRef.current) {
        const fresh = currentPending.filter((id) => !knownPendingRef.current.has(id));
        if (fresh.length) { beep(); setNewIds((s) => new Set([...s, ...fresh])); if (poll) setTab("active"); }
      }
      knownPendingRef.current = new Set(currentPending);
      firstLoadRef.current = false;
      setOrders(fetched);
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
      toast.success(`Pedido ${STATUS_LABEL[status].toLowerCase()}`);
    } catch { toast.error("Error de conexión"); }
  }

  const activeTab = TABS.find((t) => t.id === tab)!;
  const shown = orders.filter((o) => activeTab.statuses.includes(o.status));
  const counts: Record<TabId, number> = { active: 0, out: 0, history: 0 };
  for (const o of orders) for (const t of TABS) if (t.statuses.includes(o.status)) counts[t.id]++;
  const pendingCount = orders.filter((o) => o.status === "PENDING").length;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "8px 4px 40px" }}>
      <Link href="/panel/ecommerce" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", textDecoration: "none", marginBottom: 18 }}>
        <ArrowLeft size={15} /> Ecommerce
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: `${ACCENT}1a`, display: "flex", alignItems: "center", justifyContent: "center" }}><ClipboardList size={20} color={ACCENT} /></div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: F, fontSize: "1.3rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Pedidos</h1>
          <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>{pendingCount > 0 ? `${pendingCount} pedido${pendingCount !== 1 ? "s" : ""} nuevo${pendingCount !== 1 ? "s" : ""} · ` : ""}se actualiza automáticamente</p>
        </div>
        <button onClick={() => fetchOrders(false)} title="Actualizar" style={{ width: 38, height: 38, borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "var(--adm-hover)", color: "var(--adm-text2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><RefreshCw size={16} /></button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "9px 8px", borderRadius: 10, cursor: "pointer", fontFamily: F, fontSize: "0.8rem", fontWeight: 700, border: `1px solid ${tab === t.id ? ACCENT : "var(--adm-card-border)"}`, background: tab === t.id ? ACCENT : "var(--adm-hover)", color: tab === t.id ? "#1a1a1a" : "var(--adm-text2)" }}>
            {t.label}{counts[t.id] > 0 ? ` (${counts[t.id]})` : ""}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ fontFamily: FB, color: "var(--adm-text3)" }}>Cargando…</p>
      ) : shown.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 20px", border: "1px dashed var(--adm-card-border)", borderRadius: 14, fontFamily: FB, color: "var(--adm-text3)" }}>
          {tab === "active" ? "No hay pedidos nuevos por ahora." : tab === "out" ? "No hay pedidos en curso." : "Aún no hay pedidos en el historial."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {shown.map((o) => <OrderCard key={o.id} order={o} isNew={newIds.has(o.id)} onStatusChange={updateStatus} />)}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order, isNew, onStatusChange }: { order: Order; isNew: boolean; onStatusChange: (id: string, status: OrderStatus, reason?: string) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const items = Array.isArray(order.items) ? order.items : [];
  const actions = NEXT_ACTIONS[order.status] ?? [];
  const paid = order.paymentStatus === "paid";
  const online = order.paymentMethod === "webpay" || order.paymentMethod === "flow";

  const act = async (status: OrderStatus) => {
    if (status === "CANCELLED") { setCancelOpen(true); return; }
    setBusy(true); await onStatusChange(order.id, status); setBusy(false);
  };

  return (
    <div style={{ background: "var(--adm-card)", border: `1px solid ${isNew ? ORANGE : "var(--adm-card-border)"}`, borderRadius: 14, padding: 16, boxShadow: isNew ? `0 0 0 1px ${ORANGE}55` : "none" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 800, color: "var(--adm-text)" }}>#{order.orderNumber ?? order.id.slice(-5)}</span>
            <span style={{ fontFamily: FB, fontSize: "0.68rem", fontWeight: 700, color: "#fff", background: STATUS_COLOR[order.status], padding: "2px 9px", borderRadius: 999 }}>{STATUS_LABEL[order.status]}</span>
            {isNew && <span style={{ fontFamily: FB, fontSize: "0.62rem", fontWeight: 800, color: ORANGE }}>● NUEVO</span>}
          </div>
          <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text)", margin: "6px 0 0", fontWeight: 600 }}>{order.customerName} · {order.customerPhone}</p>
          <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "2px 0 0", display: "flex", alignItems: "center", gap: 5 }}>
            {order.orderType === "DELIVERY" ? <><MapPin size={12} /> {order.deliveryAddress || "Delivery"}</> : <><Store size={12} /> Retiro en tienda</>}
            <span>· {relativeTime(order.createdAt)}</span>
          </p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ fontFamily: F, fontSize: "1.05rem", fontWeight: 900, color: "var(--adm-text)", margin: 0 }}>{fmt(order.total)}</p>
          <p style={{ fontFamily: FB, fontSize: "0.68rem", fontWeight: 700, margin: "2px 0 0", color: paid ? GREEN : "var(--adm-text3)" }}>{PAY_LABEL[order.paymentMethod] || order.paymentMethod} · {online ? (paid ? "Pagado" : "Pago pendiente") : "Por pagar"}</p>
        </div>
      </div>

      {/* Items */}
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--adm-card-border)", display: "flex", flexDirection: "column", gap: 5 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontFamily: FB, fontSize: "0.82rem" }}>
            <span style={{ color: "var(--adm-text2)" }}>
              {it.quantity}× {it.dishName || it.name}
              {it.selectedOptions?.length ? <span style={{ color: "var(--adm-text3)" }}> · {it.selectedOptions.map((o) => o.optionName).join(", ")}</span> : null}
            </span>
            <span style={{ color: "var(--adm-text3)", flexShrink: 0 }}>{fmt((it.unitTotal ?? it.unit_price ?? 0) * it.quantity)}</span>
          </div>
        ))}
        {(order.deliveryFee ?? 0) > 0 && <Row label="Delivery" value={fmt(order.deliveryFee!)} />}
        {(order.discount ?? 0) > 0 && <Row label={`Descuento${order.couponCode ? ` (${order.couponCode})` : ""}`} value={`−${fmt(order.discount!)}`} accent />}
      </div>

      {order.notes && <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text2)", margin: "10px 0 0", background: "var(--adm-hover)", padding: "8px 10px", borderRadius: 8 }}>📝 {order.notes}</p>}

      {/* POS */}
      {order.toteatOrderId && <p style={{ fontFamily: FB, fontSize: "0.7rem", color: GREEN, margin: "8px 0 0" }}>🖨️ Enviado al POS (Toteat #{order.toteatOrderId})</p>}
      {order.posError && <p style={{ fontFamily: FB, fontSize: "0.7rem", color: RED, margin: "8px 0 0" }}>⚠️ Error POS: {order.posError}</p>}

      {/* Actions */}
      {actions.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          {actions.map((a) => (
            <button key={a.status} onClick={() => act(a.status)} disabled={busy} style={{ flex: a.status === "CANCELLED" ? "0 0 auto" : 1, minWidth: 100, padding: "10px 14px", borderRadius: 10, border: "none", background: a.color, color: "#fff", fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1 }}>{a.label}</button>
          ))}
        </div>
      )}

      {/* Cancel form */}
      {cancelOpen && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo de cancelación (requerido)" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--adm-card-border)", background: "var(--adm-input, var(--adm-card))", color: "var(--adm-text)", fontFamily: FB, fontSize: "0.82rem", outline: "none" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={async () => { setBusy(true); await onStatusChange(order.id, "CANCELLED", reason.trim()); setBusy(false); setCancelOpen(false); }} disabled={busy || !reason.trim()} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: RED, color: "#fff", fontFamily: F, fontSize: "0.78rem", fontWeight: 700, cursor: busy || !reason.trim() ? "not-allowed" : "pointer", opacity: !reason.trim() ? 0.5 : 1 }}>Confirmar cancelación</button>
            <button onClick={() => setCancelOpen(false)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text2)", fontFamily: F, fontSize: "0.78rem", cursor: "pointer" }}>Volver</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FB, fontSize: "0.8rem", color: accent ? ACCENT : "var(--adm-text3)" }}><span>{label}</span><span>{value}</span></div>;
}
