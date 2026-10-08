"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, ChevronLeft, ChevronRight, Radio } from "lucide-react";
import { useSessionContext } from "@/lib/admin/SessionContext";
import { supabase } from "@/lib/supabase";

type Stage = "preparing" | "ready" | "out_for_delivery" | "delivered";

interface PosOrder {
  id: string;
  opsStage: Stage;
  posStatus: string;
  saleType: string;
  isDelivery: boolean;
  tableLabel: string | null;
  deliveryFee: number;
  customerName: string;
  items: any;
  vendorName: string | null;
  orderReference: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  opsDeliveredAt?: string | null;
}

function chileTodayLocal(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isDeliveryOrder(o: PosOrder): boolean {
  return o.isDelivery && (o.deliveryFee ?? 0) > 0;
}
function typeLabel(o: PosOrder): string {
  if (isDeliveryOrder(o)) return "Delivery";
  if (o.tableLabel || o.saleType === "dine-in") return "Mesa";
  return "Retiro";
}
function orderLabel(o: PosOrder): string {
  if (o.tableLabel) return `Mesa ${o.tableLabel}`;
  if (o.orderReference) return `#${o.orderReference}`;
  return o.vendorName || "—";
}

// Solo líneas "de cocina": excluye delivery/fees/propinas/descuentos/totales.
const BAN = ["delivery", "envío", "envio", "costo", "fee", "cargo", "tarifa", "propina", "tip", "vuelto", "cambio", "descuento", "discount", "cupón", "cupon", "servicio", "service", "impuesto", "tax", "total"];
function kitchenLines(items: any): string[] {
  const arr = Array.isArray(items) ? items : [];
  const out: string[] = [];
  for (const it of arr) {
    if (!it || typeof it !== "object") continue;
    const name = String(it.productName ?? it.name ?? it.dishName ?? it.description ?? it.title ?? "").trim();
    if (!name) continue;
    const nameLc = name.toLowerCase();
    if (BAN.some((w) => nameLc.includes(w))) continue;
    const qtyRaw = Number(it.quantity ?? it.qty ?? it.count ?? 1) || 1;
    const qty = qtyRaw <= 0 ? 1 : qtyRaw;
    const mods: string[] = [];
    for (const k of ["modifiers", "selectedOptions", "extras", "options", "additions"]) {
      if (Array.isArray(it[k])) for (const m of it[k]) {
        const mn = String(m?.optionName ?? m?.name ?? m?.title ?? m?.label ?? m?.value ?? "").trim();
        if (mn) mods.push(mn);
      }
    }
    const modsStr = mods.length ? ` (${mods.join(", ")})` : "";
    const q = Number.isInteger(qty) ? qty : qty;
    out.push(`${q} × ${name}${modsStr}`);
  }
  return out;
}

function fmtHMS(sec: number): string {
  if (sec < 0) sec = 0;
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const p = (n: number) => (n < 10 ? "0" : "") + n;
  return `${p(h)}:${p(m)}:${p(s)}`;
}
// Color por antigüedad (segundos). Pendiente: gris→amarillo→rojo→rojo fuerte.
// Completado: verde→amarillo→rojo→rojo fuerte. Umbrales: 10/20/40 min.
function ageColors(sec: number, completed: boolean): { bg: string; text: string } {
  if (completed) {
    if (sec < 600) return { bg: "#dcfce7", text: "#0b1324" };
    if (sec < 1200) return { bg: "#fef3c7", text: "#0b1324" };
    if (sec < 2400) return { bg: "#fee2e2", text: "#0b1324" };
    return { bg: "#fca5a5", text: "#0b1324" };
  }
  if (sec < 600) return { bg: "#f3f4f6", text: "#0b1324" };
  if (sec < 1200) return { bg: "#fef3c7", text: "#0b1324" };
  if (sec < 2400) return { bg: "#fee2e2", text: "#0b1324" };
  return { bg: "#fca5a5", text: "#0b1324" };
}

function KdsCard({ o, now }: { o: PosOrder; now: number }) {
  const completed = o.opsStage !== "preparing";
  const created = Math.floor(new Date(o.createdAt).getTime() / 1000);
  const stop = completed
    ? Math.floor(new Date(o.opsDeliveredAt || o.completedAt || o.updatedAt).getTime() / 1000)
    : 0;
  const sec = stop > 0 ? stop - created : now - created;
  const c = ageColors(sec, completed);
  const lines = kitchenLines(o.items);
  const canceled = o.posStatus === "canceled";

  return (
    <div style={{ position: "relative", background: c.bg, color: c.text, border: "1px solid rgba(0,0,0,0.08)", borderRadius: 14, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6, boxShadow: "0 1px 2px rgba(0,0,0,0.12)", outline: completed ? "2px solid rgba(16,185,129,0.35)" : "none" }}>
      {completed && (
        <div style={{ position: "absolute", top: 10, right: -8, fontWeight: 900, fontSize: 11, letterSpacing: 0.5, padding: "4px 10px", borderRadius: "6px 0 0 6px", textTransform: "uppercase", background: canceled ? "#ef4444" : "#86efac", color: canceled ? "#fff" : "#0b1c16", border: "1px solid rgba(0,0,0,0.08)" }}>{canceled ? "Cancelado" : "Listo"}</div>
      )}
      <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.1, color: "#0b1324", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.customerName || "—"}</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#0b1324", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{orderLabel(o)}</div>
        <div style={{ fontSize: 12, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: "#eef2ff", border: "1px solid #c7d2fe", whiteSpace: "nowrap", color: "#1e293b" }}>{typeLabel(o)}</div>
        <div style={{ marginLeft: "auto", fontSize: 26, fontWeight: 900, fontVariantNumeric: "tabular-nums", background: "rgba(255,255,255,0.75)", borderRadius: 10, padding: "2px 8px", color: "#111827" }}>{fmtHMS(sec)}</div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#374151", fontVariantNumeric: "tabular-nums" }}>
        Creado: {new Date(o.createdAt).toLocaleString("es-CL", { timeZone: "America/Santiago", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
      </div>
      {lines.length > 0 && (
        <ul style={{ margin: "2px 0 0", paddingLeft: 16 }}>
          {lines.map((li, i) => (
            <li key={i} style={{ margin: "2px 0", color: "#0b1324", lineHeight: 1.25, listStyle: "disc", wordBreak: "break-word" }}>{li}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function KdsPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [date, setDate] = useState<string>(() => chileTodayLocal());
  const [live, setLive] = useState(false);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  const fetchOrders = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const r = await fetch(`/api/panel/ecommerce/pos-orders?restaurantId=${restaurantId}&scope=activos&from=${date}&to=${date}`);
      const d = await r.json();
      if (r.ok && d.orders) setOrders(d.orders);
    } catch { /* noop */ }
  }, [restaurantId, date]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Reloj para los cronómetros en vivo.
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  // Tiempo real (Supabase) — refresca al entrar/cambiar un pedido.
  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel(`kds-pos-orders-${restaurantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "PosOrder", filter: `restaurantId=eq.${restaurantId}` }, () => { fetchOrders(); })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    const onVis = () => { if (document.visibilityState === "visible") fetchOrders(); };
    document.addEventListener("visibilitychange", onVis);
    const backup = setInterval(fetchOrders, 60000);
    return () => { supabase.removeChannel(channel); document.removeEventListener("visibilitychange", onVis); clearInterval(backup); };
  }, [restaurantId, fetchOrders]);

  const active = orders.filter((o) => o.posStatus !== "canceled");
  const ts = (v: string) => new Date(v).getTime();
  const pend = active.filter((o) => o.opsStage === "preparing").sort((a, b) => ts(a.createdAt) - ts(b.createdAt));
  const comp = active.filter((o) => o.opsStage !== "preparing").sort((a, b) => ts(b.updatedAt) - ts(a.updatedAt));

  const today = chileTodayLocal();
  const ddmmyyyy = date.split("-").reverse().join("-");

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0b0c10", color: "#fff", display: "flex", flexDirection: "column", zIndex: 40, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      {/* Oculta la navegación del panel para pantalla completa de cocina. */}
      <style>{`
        @media (min-width:768px){ .owl-sidebar{ display:none !important } .owl-main{ margin-left:0 !important } }
        .owl-main{ padding:0 !important; zoom:1 !important; }
        .kds-grid{ display:grid; gap:10px; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); align-items:start; }
        @media screen and (max-aspect-ratio: 1/1){ .kds-grid{ gap:8px; grid-template-columns:repeat(4, 1fr); } }
      `}</style>

      {/* Topbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 12px", background: "#111827", borderBottom: "1px solid #0f172a", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/panel/centro-pedidos" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#111827", background: "#e5e7eb", padding: "6px 10px", borderRadius: 10, border: "1px solid #cbd5e1", fontWeight: 800, textDecoration: "none", fontSize: 13 }}>
            <ArrowLeft size={15} /> Volver
          </Link>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#e5e7eb" }}>KDS Cocina</h1>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: live ? "rgba(16,185,129,0.18)" : "rgba(148,163,184,0.18)", color: live ? "#34d399" : "#94a3b8" }}>
            <Radio size={12} /> {live ? "En vivo" : "Conectando…"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setDate((d) => addDaysYmd(d, -1))} style={navBtn}><ChevronLeft size={16} /></button>
          <span style={{ fontSize: 14, fontWeight: 800, color: "#e5e7eb", minWidth: 96, textAlign: "center" }}>{ddmmyyyy}</span>
          <button onClick={() => setDate((d) => addDaysYmd(d, 1))} disabled={date >= today} style={{ ...navBtn, opacity: date >= today ? 0.4 : 1, cursor: date >= today ? "default" : "pointer" }}><ChevronRight size={16} /></button>
          <button onClick={fetchOrders} style={{ ...navBtn, marginLeft: 4 }}><RefreshCw size={15} /></button>
        </div>
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Pendientes */}
        <section>
          <h2 style={{ margin: "0 0 10px", padding: "8px 10px", fontWeight: 900, color: "#e5e7eb", display: "flex", alignItems: "center", gap: 10, fontSize: 15, borderLeft: "6px solid #f59e0b", borderRadius: 8, background: "rgba(245,158,11,0.12)" }}>
            📌 Pendientes <span style={countStyle}>{pend.length}</span>
          </h2>
          {pend.length === 0 ? (
            <div style={{ color: "#cbd5e1", padding: "0 10px" }}>No hay pedidos en preparación.</div>
          ) : (
            <div className="kds-grid">{pend.map((o) => <KdsCard key={o.id} o={o} now={now} />)}</div>
          )}
        </section>

        {/* Separador */}
        <div style={{ height: 12, borderRadius: 999, background: "linear-gradient(90deg, transparent 0%, rgba(16,185,129,.45) 20%, rgba(16,185,129,.85) 50%, rgba(16,185,129,.45) 80%, transparent 100%)", boxShadow: "0 2px 8px rgba(0,0,0,.25), inset 0 0 0 1px rgba(16,185,129,.45)" }} />

        {/* Completados */}
        <section style={{ background: "rgba(16,185,129,.10)", borderTop: "6px solid #10b981", borderRadius: 14, padding: 10 }}>
          <h2 style={{ margin: "0 0 10px", padding: "8px 10px", fontWeight: 900, color: "#e5e7eb", display: "flex", alignItems: "center", gap: 10, fontSize: 15, borderLeft: "6px solid #10b981", borderRadius: 8, background: "rgba(16,185,129,0.16)" }}>
            ✅ Completados <span style={countStyle}>{comp.length}</span>
          </h2>
          {comp.length === 0 ? (
            <div style={{ color: "#cbd5e1", padding: "0 10px" }}>No hay pedidos completados.</div>
          ) : (
            <div className="kds-grid" style={{ filter: "saturate(0.9)" }}>{comp.map((o) => <KdsCard key={o.id} o={o} now={now} />)}</div>
          )}
        </section>
      </div>
    </div>
  );
}

const navBtn: React.CSSProperties = { width: 32, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "1px solid #1f2937", background: "#1f2937", color: "#e5e7eb", cursor: "pointer" };
const countStyle: React.CSSProperties = { fontVariantNumeric: "tabular-nums", background: "#1f2937", border: "1px solid #334155", color: "#e5e7eb", padding: "1px 8px", borderRadius: 999, fontWeight: 800, fontSize: 12 };
