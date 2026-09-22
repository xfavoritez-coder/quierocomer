"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Radio, RefreshCw, History, ListChecks, Phone, MapPin, Utensils, Bike, ShoppingBag, Copy, Link2, ChevronDown, ChevronUp, Check, Send, Trash2 } from "lucide-react";
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
}

const clp = (n: number) => "$" + Math.round(n || 0).toLocaleString("es-CL");

const STAGE_LABEL: Record<Stage, string> = { preparing: "En preparación", ready: "Listo", out_for_delivery: "En reparto", delivered: "Entregado" };
const STAGE_ICON: Record<Stage, string> = { preparing: "♨️", ready: "🛎️", out_for_delivery: "🛵", delivered: "✅" };
const STAGE_COLS: Stage[] = ["preparing", "ready", "out_for_delivery"];

function nextActions(o: PosOrder): { stage: Stage; label: string; color: string }[] {
  if (o.posStatus === "canceled" || o.opsStage === "delivered") return [];
  if (o.isDelivery) {
    if (o.opsStage === "preparing") return [{ stage: "ready", label: "Listo", color: GREEN }];
    if (o.opsStage === "ready") return [{ stage: "out_for_delivery", label: "Salió a reparto", color: BLUE }];
    if (o.opsStage === "out_for_delivery") return [{ stage: "delivered", label: "Entregado", color: GRAY }];
  } else {
    if (o.opsStage === "preparing") return [{ stage: "ready", label: "Listo", color: GREEN }];
    return [{ stage: "delivered", label: "Entregado", color: GRAY }];
  }
  return [];
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
  const [live, setLive] = useState(false);
  const [flash, setFlash] = useState<Record<string, boolean>>({});
  const [setupOpen, setSetupOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

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

  // Token del webhook (para la tarjeta de conexión).
  useEffect(() => {
    if (!restaurantId) return;
    fetch(`/api/panel/ecommerce/pos-orders/config?restaurantId=${restaurantId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setToken(d.token); if (!d.token) setSetupOpen(true); } })
      .catch(() => {});
  }, [restaurantId]);

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
      if (stage === "delivered" && view === "activos") setOrders((prev) => prev.filter((x) => x.id !== o.id));
    } catch { toast.error("Error de conexión"); fetchOrders(true); }
  }

  async function probarConexion() {
    if (!restaurantId) return;
    setTesting(true);
    try {
      const r = await fetch("/api/panel/ecommerce/pos-orders/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId }) });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error || "La prueba falló"); setTesting(false); return; }
      const created = d.webhook?.created ?? 0;
      toast.success(created > 0 ? "¡Funciona! Pedido de prueba recibido — míralo en el tablero." : "El webhook respondió, pero no creó el pedido de prueba.");
      setView("activos");
      fetchOrders(true);
    } catch { toast.error("Error de conexión"); }
    setTesting(false);
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

  async function generarToken() {
    if (!restaurantId) return;
    try {
      const r = await fetch("/api/panel/ecommerce/pos-orders/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId }) });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error || "No se pudo generar"); return; }
      setToken(d.token);
      toast.success("Token generado");
    } catch { toast.error("Error de conexión"); }
  }

  const base = typeof window !== "undefined" ? window.location.origin : "https://quierocomer.com";
  const webhookUrl = `${base}/api/ecommerce/toteat/webhook`;
  const webhookUrlToken = token ? `${webhookUrl}?token=${token}` : webhookUrl;

  const copy = (txt: string, msg: string) => { navigator.clipboard?.writeText(txt).then(() => toast.success(msg)).catch(() => {}); };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "8px 4px 60px" }}>
      <Link href="/panel/ecommerce" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", textDecoration: "none", marginBottom: 16 }}>
        <ArrowLeft size={15} /> Ecommerce
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

      {/* Tarjeta de conexión con Toteat */}
      <section style={{ background: "var(--adm-card)", border: `1px solid ${token ? "var(--adm-card-border)" : ACCENT}`, borderRadius: 14, marginBottom: 16, overflow: "hidden" }}>
        <button onClick={() => setSetupOpen((v) => !v)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", background: "transparent", border: "none", cursor: "pointer", color: "var(--adm-text)" }}>
          <Link2 size={17} color={ACCENT} />
          <span style={{ flex: 1, textAlign: "left", fontFamily: F, fontSize: "0.9rem", fontWeight: 800 }}>Conexión con Toteat {token ? "" : "· pendiente"}</span>
          {setupOpen ? <ChevronUp size={17} color="var(--adm-text3)" /> : <ChevronDown size={17} color="var(--adm-text3)" />}
        </button>
        {setupOpen && (
          <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
              En Toteat, configura el <strong>Post Hook URL</strong> de pedidos apuntando a esta URL y agrega el header <strong>x-webhook-token</strong> con el token del local. Si Toteat no permite headers, usa la URL con el token incluido.
            </p>
            {!token ? (
              <button onClick={generarToken} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 10, border: "none", background: ACCENT, color: "#1a1a1a", fontFamily: F, fontSize: "0.85rem", fontWeight: 800, cursor: "pointer" }}>
                Generar token del local
              </button>
            ) : (
              <>
                <Field label="Post Hook URL" value={webhookUrl} onCopy={() => copy(webhookUrl, "URL copiada")} />
                <Field label="Header · x-webhook-token" value={token} onCopy={() => copy(token, "Token copiado")} />
                <Field label="Alternativa · URL con token" value={webhookUrlToken} onCopy={() => copy(webhookUrlToken, "URL copiada")} />
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 2 }}>
                  <button onClick={probarConexion} disabled={testing} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 10, border: `1px solid ${ACCENT}`, background: `${ACCENT}1a`, color: ACCENT, fontFamily: F, fontSize: "0.84rem", fontWeight: 800, cursor: testing ? "wait" : "pointer", opacity: testing ? 0.6 : 1 }}>
                    <Send size={15} /> {testing ? "Probando…" : "Probar conexión"}
                  </button>
                  <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)" }}>Envía un pedido de prueba por el webhook (verifica token, guardado y tablero en vivo).</span>
                </div>
                <button onClick={generarToken} style={{ alignSelf: "flex-start", padding: 0, border: "none", background: "transparent", color: "var(--adm-text3)", fontFamily: FB, fontSize: "0.72rem", fontWeight: 600, textDecoration: "underline", cursor: "pointer" }}>
                  Regenerar token (invalida el anterior)
                </button>
              </>
            )}
          </div>
        )}
      </section>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <TabChip active={view === "activos"} onClick={() => setView("activos")} icon={ListChecks} label="Activos" />
        <TabChip active={view === "historial"} onClick={() => setView("historial")} icon={History} label="Historial" />
      </div>

      {loading ? (
        <p style={{ fontFamily: FB, color: "var(--adm-text3)", padding: 30, textAlign: "center" }}>Cargando pedidos…</p>
      ) : orders.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center" }}>
          <p style={{ fontFamily: F, fontSize: "1rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 6px" }}>{view === "activos" ? "Sin pedidos activos" : "Sin historial"}</p>
          <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text3)", margin: 0 }}>{view === "activos" ? "Cuando entre un pedido a Toteat, aparecerá aquí al instante." : "Los pedidos entregados o cancelados aparecerán aquí."}</p>
        </div>
      ) : view === "historial" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
          {orders.map((o) => <OrderCard key={o.id} o={o} flash={!!flash[o.id]} onAdvance={advance} onDelete={eliminar} />)}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, alignItems: "start" }}>
          {STAGE_COLS.map((st) => {
            const items = orders.filter((o) => o.opsStage === st && o.posStatus !== "canceled");
            return (
              <div key={st}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 4px 10px" }}>
                  <span style={{ fontFamily: F, fontSize: "0.92rem", fontWeight: 800, color: "var(--adm-text)" }}>{STAGE_ICON[st]} {STAGE_LABEL[st]}</span>
                  <span style={{ fontFamily: FB, fontSize: "0.72rem", fontWeight: 700, color: "var(--adm-text3)", marginLeft: "auto", background: "var(--adm-hover)", borderRadius: 999, padding: "2px 8px" }}>{items.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {items.map((o) => <OrderCard key={o.id} o={o} flash={!!flash[o.id]} onAdvance={advance} onDelete={eliminar} />)}
                  {items.length === 0 && <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)", textAlign: "center", padding: "16px 0" }}>—</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OrderCard({ o, flash, onAdvance, onDelete }: { o: PosOrder; flash: boolean; onAdvance: (o: PosOrder, s: Stage) => void; onDelete: (o: PosOrder) => void }) {
  const badge = saleBadge(o);
  const acts = nextActions(o);
  const canceled = o.posStatus === "canceled";
  const isTest = o.externalId.startsWith("TEST-");
  const items: any[] = Array.isArray(o.items) ? o.items : [];
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
        <button onClick={() => onDelete(o)} title="Eliminar pedido" aria-label="Eliminar pedido" style={{ width: 26, height: 26, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 7, border: "none", background: "transparent", color: "var(--adm-text3)", cursor: "pointer", opacity: 0.6 }}><Trash2 size={13} /></button>
      </div>

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
    </div>
  );
}

function Chip({ label, color }: { label: string; color?: string }) {
  return <span style={{ fontFamily: FB, fontSize: "0.7rem", fontWeight: 700, color: color || "var(--adm-text2)", background: color ? `${color}1a` : "var(--adm-hover)", borderRadius: 6, padding: "2px 7px" }}>{label}</span>;
}

function Field({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div>
      <span style={{ display: "block", fontFamily: F, fontSize: "0.72rem", fontWeight: 700, color: "var(--adm-text2)", marginBottom: 4 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 8, padding: "8px 10px" }}>
        <code style={{ flex: 1, minWidth: 0, fontFamily: "monospace", fontSize: "0.74rem", color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</code>
        <button onClick={onCopy} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 9px", borderRadius: 7, border: "1px solid var(--adm-card-border)", background: "var(--adm-card)", color: "var(--adm-text2)", fontFamily: F, fontSize: "0.72rem", fontWeight: 700, cursor: "pointer", flexShrink: 0 }}><Copy size={12} /> Copiar</button>
      </div>
    </div>
  );
}

function TabChip({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 999, cursor: "pointer", fontFamily: F, fontSize: "0.82rem", fontWeight: 700, border: `1px solid ${active ? ACCENT : "var(--adm-card-border)"}`, background: active ? `${ACCENT}1a` : "transparent", color: active ? ACCENT : "var(--adm-text2)" }}>
      <Icon size={15} /> {label}
    </button>
  );
}
