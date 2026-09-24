"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Radio, RefreshCw, History, ListChecks, Phone, MapPin, Utensils, Bike, ShoppingBag, Check, Trash2, MoreVertical, MapPinned } from "lucide-react";
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
  items: any; completedAt: string | null; createdAt: string; updatedAt: string;
  assignedTo?: string | null; uberDeliveryId?: string | null; pyaShippingId?: string | null; courier?: any; trackingToken?: string | null;
}

const clp = (n: number) => "$" + Math.round(n || 0).toLocaleString("es-CL");

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
const STAGE_ICON: Record<Stage, string> = { preparing: "♨️", ready: "🛎️", out_for_delivery: "🛵", delivered: "✅" };
// Las 4 etapas del tablero (columna izquierda estilo deliveryhandroll).
const STAGES: Stage[] = ["preparing", "ready", "out_for_delivery", "delivered"];
const STAGE_ACCENT: Record<Stage, string> = { preparing: ORANGE, ready: GREEN, out_for_delivery: BLUE, delivered: GRAY };

function nextActions(o: PosOrder): { stage: Stage; label: string; color: string }[] {
  if (o.posStatus === "canceled" || o.opsStage === "delivered") return [];
  if (o.isDelivery) {
    // Delivery: cocina solo marca "Listo". El paso a reparto y la entrega los
    // gestiona la app del repartidor (o el courier). Override manual: menú ⋮.
    if (o.opsStage === "preparing") return [{ stage: "ready", label: "Listo", color: GREEN }];
    return [];
  } else {
    // Retiro/mostrador: sin repartidor, el staff avanza el flujo.
    if (o.opsStage === "preparing") return [{ stage: "ready", label: "Listo", color: GREEN }];
    return [{ stage: "delivered", label: "Entregado", color: GRAY }];
  }
}

function saleBadge(o: PosOrder): { label: string; icon: any; color: string } {
  if (o.isDelivery) return { label: "Delivery", icon: Bike, color: GREEN };
  if (o.tableLabel || o.saleType === "dine-in") return { label: o.tableLabel || "Mesa", icon: Utensils, color: BLUE };
  return { label: "Retiro", icon: ShoppingBag, color: ORANGE };
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
  const [selectedStage, setSelectedStage] = useState<Stage>("preparing");
  const [live, setLive] = useState(false);
  const [flash, setFlash] = useState<Record<string, boolean>>({});
  const [courierBusy, setCourierBusy] = useState<Record<string, boolean>>({});
  const courierReq = useRef<Set<string>>(new Set());

  const fetchOrders = useCallback(async (silent = false) => {
    if (!restaurantId) return;
    if (!silent) setLoading(true);
    try {
      const r = await fetch(`/api/panel/ecommerce/pos-orders?restaurantId=${restaurantId}&scope=${view}`);
      const d = await r.json();
      if (r.ok && d.orders) setOrders(d.orders);
    } catch { /* noop */ }
    setLoading(false);
  }, [restaurantId, view]);

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
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "8px 4px 60px" }}>
      <Link href="/panel" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", textDecoration: "none", marginBottom: 16 }}>
        <ArrowLeft size={15} /> Panel
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: `${ACCENT}1a`, display: "flex", alignItems: "center", justifyContent: "center" }}><ListChecks size={20} color={ACCENT} /></div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <h1 style={{ fontFamily: F, fontSize: "1.3rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Centro de pedidos</h1>
          <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>Los pedidos de Toteat entran solos y los gestionas por etapa.</p>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 999, fontFamily: F, fontSize: "0.72rem", fontWeight: 700, background: live ? "rgba(34,197,94,0.12)" : "var(--adm-hover)", color: live ? GREEN : "var(--adm-text3)" }}>
          <Radio size={13} /> {live ? "En vivo" : "Conectando…"}
        </span>
        <button onClick={() => fetchOrders()} title="Refrescar" style={{ width: 38, height: 38, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text2)", cursor: "pointer" }}><RefreshCw size={16} /></button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <TabChip active={view === "activos"} onClick={() => setView("activos")} icon={ListChecks} label="Activos" />
        <TabChip active={view === "historial"} onClick={() => setView("historial")} icon={History} label="Historial" />
      </div>

      {loading ? (
        <p style={{ fontFamily: FB, color: "var(--adm-text3)", padding: 30, textAlign: "center" }}>Cargando pedidos…</p>
      ) : view === "historial" ? (
        orders.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <p style={{ fontFamily: F, fontSize: "1rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 6px" }}>Sin historial</p>
            <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text3)", margin: 0 }}>Los pedidos entregados o cancelados aparecerán aquí.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
            {orders.map((o) => <OrderCard key={o.id} o={o} flash={!!flash[o.id]} onAdvance={advance} onDelete={eliminar} onCourier={requestCourier} onCancelCourier={cancelCourier} courierBusy={!!courierBusy[o.id]} />)}
          </div>
        )
      ) : (() => {
        // Conteo por etapa (excluye cancelados).
        const counts: Record<Stage, number> = { preparing: 0, ready: 0, out_for_delivery: 0, delivered: 0 };
        for (const o of orders) if (o.posStatus !== "canceled") counts[o.opsStage] = (counts[o.opsStage] || 0) + 1;
        const items = orders.filter((o) => o.opsStage === selectedStage && o.posStatus !== "canceled");
        return (
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            {/* Columna de etapas (estilo deliveryhandroll) */}
            <div style={{ width: 250, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8, minWidth: 220 }}>
              <p style={{ fontFamily: F, fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--adm-text3)", margin: "0 0 2px 2px" }}>Etapas del pedido</p>
              {STAGES.map((st) => {
                const active = selectedStage === st;
                const c = STAGE_ACCENT[st];
                return (
                  <button
                    key={st}
                    onClick={() => setSelectedStage(st)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                      padding: "13px 14px", borderRadius: 12, cursor: "pointer",
                      border: `1px solid ${active ? c : "var(--adm-card-border)"}`,
                      background: active ? `${c}1a` : "var(--adm-card)",
                      transition: "background .15s, border-color .15s",
                    }}
                  >
                    <span style={{ fontSize: "1.05rem", lineHeight: 1 }}>{STAGE_ICON[st]}</span>
                    <span style={{ flex: 1, fontFamily: F, fontSize: "0.9rem", fontWeight: 800, color: active ? "var(--adm-text)" : "var(--adm-text2)" }}>{STAGE_LABEL[st]}</span>
                    <span style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 800, minWidth: 24, height: 24, padding: "0 7px", borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", background: active ? c : "var(--adm-hover)", color: active ? "#fff" : "var(--adm-text3)" }}>{counts[st]}</span>
                  </button>
                );
              })}
            </div>

            {/* Pedidos de la etapa seleccionada */}
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 2px 12px", borderLeft: `3px solid ${STAGE_ACCENT[selectedStage]}`, paddingLeft: 10 }}>
                <span style={{ fontFamily: F, fontSize: "1rem", fontWeight: 800, color: "var(--adm-text)" }}>{STAGE_ICON[selectedStage]} {STAGE_LABEL[selectedStage]}</span>
                <span style={{ fontFamily: FB, fontSize: "0.72rem", fontWeight: 700, color: "var(--adm-text3)", marginLeft: "auto", background: "var(--adm-hover)", borderRadius: 999, padding: "2px 9px" }}>{items.length}</span>
              </div>
              {items.length === 0 ? (
                <div style={{ padding: "36px 16px", textAlign: "center", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14 }}>
                  <p style={{ fontFamily: FB, fontSize: "0.84rem", color: "var(--adm-text3)", margin: 0 }}>No hay pedidos en «{STAGE_LABEL[selectedStage]}».</p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, alignItems: "start" }}>
                  {items.map((o) => <OrderCard key={o.id} o={o} flash={!!flash[o.id]} onAdvance={advance} onDelete={eliminar} onCourier={requestCourier} onCancelCourier={cancelCourier} courierBusy={!!courierBusy[o.id]} />)}
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function OrderCard({ o, flash, onAdvance, onDelete, onCourier, onCancelCourier, courierBusy }: { o: PosOrder; flash: boolean; onAdvance: (o: PosOrder, s: Stage) => void; onDelete: (o: PosOrder) => void; onCourier: (o: PosOrder, p: "uber" | "pedidosya") => void; onCancelCourier: (o: PosOrder) => void; courierBusy?: boolean }) {
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
  const canRequestCourier = o.isDelivery && !hasCourier && !canceled && (o.opsStage === "preparing" || o.opsStage === "ready");
  return (
    <div style={{ background: "var(--adm-card)", border: `1px solid ${flash ? GREEN : "var(--adm-card-border)"}`, boxShadow: flash ? `0 0 0 3px rgba(34,197,94,0.2)` : "none", borderRadius: 14, padding: 13, transition: "box-shadow .3s, border-color .3s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 7, fontFamily: F, fontSize: "0.7rem", fontWeight: 800, background: `${badge.color}1a`, color: badge.color }}>
          <badge.icon size={12} /> {badge.label}
        </span>
        {flash && <span style={{ fontFamily: F, fontSize: "0.64rem", fontWeight: 900, color: "#fff", background: GREEN, borderRadius: 999, padding: "2px 8px" }}>NUEVO</span>}
        {canceled && <span style={{ fontFamily: F, fontSize: "0.64rem", fontWeight: 900, color: "#fff", background: RED, borderRadius: 999, padding: "2px 8px" }}>CANCELADO</span>}
        {isTest && <span style={{ fontFamily: F, fontSize: "0.64rem", fontWeight: 900, color: "#fff", background: BLUE, borderRadius: 999, padding: "2px 8px" }}>PRUEBA</span>}
        <span style={{ marginLeft: "auto", fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)" }}>{new Date(o.createdAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</span>
        <div ref={menuRef} style={{ position: "relative" }}>
          <button onClick={() => setMenuOpen((v) => !v)} title="Opciones" aria-label="Opciones" style={{ width: 26, height: 26, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 7, border: "none", background: menuOpen ? "var(--adm-hover)" : "transparent", color: "var(--adm-text3)", cursor: "pointer" }}><MoreVertical size={15} /></button>
          {menuOpen && (
            <div style={{ position: "absolute", top: 30, right: 0, zIndex: 30, minWidth: 190, background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 11, boxShadow: "0 10px 30px rgba(0,0,0,0.22)", padding: 6, display: "flex", flexDirection: "column", gap: 1 }}>
              <span style={{ fontFamily: F, fontSize: "0.66rem", fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--adm-text3)", padding: "6px 8px 3px" }}>Mover a etapa</span>
              {STAGES.map((st) => {
                const current = st === o.opsStage;
                return (
                  <button
                    key={st}
                    disabled={current}
                    onClick={() => { onAdvance(o, st); setMenuOpen(false); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "8px 8px", borderRadius: 8, border: "none", background: current ? "var(--adm-hover)" : "transparent", color: current ? "var(--adm-text3)" : "var(--adm-text)", fontFamily: FB, fontSize: "0.82rem", fontWeight: 600, cursor: current ? "default" : "pointer" }}
                    onMouseEnter={(e) => { if (!current) e.currentTarget.style.background = "var(--adm-hover)"; }}
                    onMouseLeave={(e) => { if (!current) e.currentTarget.style.background = "transparent"; }}
                  >
                    <span style={{ fontSize: "0.95rem", lineHeight: 1 }}>{STAGE_ICON[st]}</span>
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

      {o.vendorName && (
        <p style={{ textAlign: "center", marginBottom: 6, fontFamily: FB, fontSize: "0.74rem", fontWeight: 700, color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.vendorName}</p>
      )}

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <p style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 800, color: "var(--adm-text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.customerName || (o.orderReference ? `#${o.orderReference}` : "Pedido")}</p>
        <span style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 800, color: ACCENT, flexShrink: 0 }}>{clp(o.totalAmount)}</span>
      </div>

      {(o.customerPhone || o.addressLine) && (
        <div style={{ marginTop: 5, display: "flex", flexDirection: "column", gap: 2 }}>
          {o.customerPhone && <a href={`tel:${o.customerPhone}`} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: FB, fontSize: "0.76rem", color: "var(--adm-text2)", textDecoration: "none" }}><Phone size={12} /> {o.customerPhone}</a>}
          {o.addressLine && <span style={{ display: "inline-flex", alignItems: "flex-start", gap: 5, fontFamily: FB, fontSize: "0.76rem", color: "var(--adm-text2)" }}><MapPin size={12} style={{ marginTop: 2, flexShrink: 0 }} /> {o.addressLine}</span>}
        </div>
      )}

      {o.assignedTo && (o.opsStage === "out_for_delivery" || o.opsStage === "delivered") && (
        <div style={{ marginTop: 6 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: F, fontSize: "0.74rem", fontWeight: 800, color: BLUE, background: `${BLUE}14`, borderRadius: 7, padding: "3px 8px" }}>
            <Bike size={12} /> {o.assignedTo}
          </span>
        </div>
      )}

      {items.length > 0 && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--adm-card-border)", display: "flex", flexDirection: "column", gap: 3 }}>
          {items.slice(0, 6).map((ln, i) => {
            const qty = Number(ln?.quantity ?? ln?.qty ?? 1) || 1;
            const name = String(ln?.productName ?? ln?.name ?? ln?.dishName ?? "Ítem");
            return <div key={i} style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)" }}><strong style={{ color: "var(--adm-text)" }}>{qty}×</strong> {name}</div>;
          })}
          {items.length > 6 && <div style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)" }}>+{items.length - 6} más…</div>}
        </div>
      )}

      {(o.tipAmount > 0 || o.changeAmount > 0 || o.deliveryFee > 0) && (
        <div style={{ marginTop: 7, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {o.deliveryFee > 0 && <Chip label={`Envío ${clp(o.deliveryFee)}`} />}
          {o.tipAmount > 0 && <Chip label={`Propina ${clp(o.tipAmount)}`} color={GREEN} />}
          {o.changeAmount > 0 && <Chip label={`Vuelto ${clp(o.changeAmount)}`} color={ORANGE} />}
        </div>
      )}

      {acts.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
          {acts.map((a) => (
            <button key={a.stage} onClick={() => onAdvance(o, a.stage)} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "9px 10px", borderRadius: 9, border: "none", background: a.color, color: "#fff", fontFamily: F, fontSize: "0.8rem", fontWeight: 800, cursor: "pointer" }}>
              <Check size={14} /> {a.label}
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
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--adm-card-border)", display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)" }}>{courierBusy ? "Solicitando…" : "Solicitar:"}</span>
          <button disabled={courierBusy} onClick={() => onCourier(o, "uber")} style={{ flex: 1, padding: "7px", borderRadius: 8, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text)", fontFamily: F, fontSize: "0.76rem", fontWeight: 700, cursor: courierBusy ? "wait" : "pointer", opacity: courierBusy ? 0.5 : 1 }}>Uber</button>
          <button disabled={courierBusy} onClick={() => onCourier(o, "pedidosya")} style={{ flex: 1, padding: "7px", borderRadius: 8, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text)", fontFamily: F, fontSize: "0.76rem", fontWeight: 700, cursor: courierBusy ? "wait" : "pointer", opacity: courierBusy ? 0.5 : 1 }}>PedidosYa</button>
        </div>
      ) : null}
    </div>
  );
}

function Chip({ label, color }: { label: string; color?: string }) {
  return <span style={{ fontFamily: FB, fontSize: "0.7rem", fontWeight: 700, color: color || "var(--adm-text2)", background: color ? `${color}1a` : "var(--adm-hover)", borderRadius: 6, padding: "2px 7px" }}>{label}</span>;
}

function TabChip({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 999, cursor: "pointer", fontFamily: F, fontSize: "0.82rem", fontWeight: 700, border: `1px solid ${active ? ACCENT : "var(--adm-card-border)"}`, background: active ? `${ACCENT}1a` : "transparent", color: active ? ACCENT : "var(--adm-text2)" }}>
      <Icon size={15} /> {label}
    </button>
  );
}
