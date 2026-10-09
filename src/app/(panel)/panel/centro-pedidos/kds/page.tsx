"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSessionContext } from "@/lib/admin/SessionContext";
import { supabase } from "@/lib/supabase";

// Pantalla KDS de cocina — basada en el KDS actual de deliveryhandroll (tema claro,
// pills por tipo, cronómetro coloreado por antigüedad, KPI y agrupar por hora).
// Datos del Centro de pedidos (PosOrder) + Supabase Realtime.

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
  opsReadyForDeliveryAt?: string | null;
  opsDispatchedAt?: string | null;
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
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
function weekdayLabel(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  return DIAS[d.getUTCDay()];
}

function isDeliveryOrder(o: PosOrder): boolean {
  return o.isDelivery && (o.deliveryFee ?? 0) > 0;
}
// { cls, text } para la pill de tipo (Delivery / Mesa N / Retiro).
function tipo(o: PosOrder): { cls: string; text: string } {
  if (isDeliveryOrder(o)) return { cls: "t-delivery", text: "Delivery" };
  if (o.tableLabel || o.saleType === "dine-in") return { cls: "t-mesa", text: o.tableLabel ? `Mesa ${o.tableLabel}` : "Mesa" };
  return { cls: "t-retiro", text: "Retiro" };
}

const BAN = ["delivery", "envío", "envio", "costo", "fee", "cargo", "tarifa", "propina", "tip", "vuelto", "cambio", "descuento", "discount", "cupón", "cupon", "servicio", "service", "impuesto", "tax", "total"];
const nameOf = (it: any): string => String(it?.productName ?? it?.name ?? it?.dishName ?? it?.description ?? it?.title ?? "").trim();
function kitchenLines(items: any): { qty: number; name: string; mods: string }[] {
  const arr = Array.isArray(items) ? items : [];
  // Extras de Toteat: líneas con isExtra=true que referencian el lineNumber del
  // producto padre (los modificadores NO vienen anidados, vienen como líneas aparte).
  const extrasByRef = new Map<number, string[]>();
  for (const it of arr) {
    if (it && typeof it === "object" && it.isExtra) {
      const ref = Number(it.referenceLine);
      const nm = nameOf(it);
      if (!Number.isNaN(ref) && nm) {
        if (!extrasByRef.has(ref)) extrasByRef.set(ref, []);
        extrasByRef.get(ref)!.push(nm);
      }
    }
  }
  const out: { qty: number; name: string; mods: string }[] = [];
  for (const it of arr) {
    if (!it || typeof it !== "object") continue;
    if (it.isExtra) continue; // los extras se adjuntan a su producto padre
    const name = nameOf(it);
    if (!name) continue;
    if (BAN.some((w) => name.toLowerCase().includes(w))) continue;
    const qtyRaw = Number(it.quantity ?? it.qty ?? it.count ?? 1) || 1;
    const qty = qtyRaw <= 0 ? 1 : qtyRaw;
    const mods: string[] = [];
    // Extras de Toteat por referenceLine
    const ln = Number(it.lineNumber);
    if (!Number.isNaN(ln) && extrasByRef.has(ln)) mods.push(...extrasByRef.get(ln)!);
    // Modificadores anidados (pedidos manuales / otras fuentes)
    for (const k of ["modifiers", "selectedOptions", "extras", "options", "additions"]) {
      if (Array.isArray(it[k])) for (const m of it[k]) {
        const mn = String(m?.optionName ?? m?.name ?? m?.title ?? m?.label ?? m?.value ?? "").trim();
        if (mn) mods.push(mn);
      }
    }
    out.push({ qty, name, mods: mods.length ? ` (${mods.join(", ")})` : "" });
  }
  return out;
}

const SEC = (iso?: string | null) => (iso ? Math.floor(new Date(iso).getTime() / 1000) : 0);
function fmtHMS(sec: number): string {
  if (sec < 0) sec = 0;
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const p = (n: number) => (n < 10 ? "0" : "") + n;
  return `${p(h)}:${p(m)}:${p(s)}`;
}
function ageClass(sec: number, completed: boolean): string {
  if (completed) {
    if (sec < 600) return "card-age-green";
    if (sec < 1200) return "card-age-yellow";
    if (sec < 2400) return "card-age-red";
    return "card-age-red-strong";
  }
  if (sec < 600) return "card-age-gray";
  if (sec < 1200) return "card-age-yellow";
  if (sec < 2400) return "card-age-red";
  return "card-age-red-strong";
}
// Momento en que el pedido dejó preparación (para congelar el tiempo del completado).
function doneSec(o: PosOrder): number {
  return SEC(o.opsReadyForDeliveryAt || o.opsDispatchedAt || o.opsDeliveredAt || o.completedAt || o.updatedAt);
}

function Card({ o, now }: { o: PosOrder; now: number }) {
  const completed = o.opsStage !== "preparing";
  const created = SEC(o.createdAt);
  const stop = completed ? doneSec(o) : 0;
  const sec = stop > 0 ? Math.max(0, stop - created) : Math.max(0, now - created);
  const cls = ageClass(sec, completed);
  const t = tipo(o);
  const lines = kitchenLines(o.items);
  const doneHM = completed && stop > 0 ? new Date(stop * 1000).toLocaleTimeString("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div className={`kds-card ${cls}${completed ? " is-completed" : ""}`}>
      <div className="kds-head">
        <div className={`kds-type ${t.cls}`}>{t.text}</div>
        <div className="kds-timer">{fmtHMS(sec)}</div>
      </div>
      <div className="kds-customer">{o.customerName || (o.orderReference ? `#${o.orderReference}` : "—")}</div>
      {completed && doneHM && <div className="kds-donetime">Completado {doneHM}</div>}
      {lines.length > 0 && (
        <ul className="kds-items">
          {lines.map((li, i) => (
            <li key={i}><strong>{li.qty} × {li.name}</strong>{li.mods}</li>
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
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [groupHour, setGroupHour] = useState(false);

  useEffect(() => { try { setGroupHour(localStorage.getItem("kdsGroupHour") === "1"); } catch { /* noop */ } }, []);

  const fetchOrders = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const r = await fetch(`/api/panel/ecommerce/pos-orders?restaurantId=${restaurantId}&scope=activos&from=${date}&to=${date}`);
      const d = await r.json();
      if (r.ok && d.orders) setOrders(d.orders);
    } catch { /* noop */ }
  }, [restaurantId, date]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => { const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000); return () => clearInterval(t); }, []);

  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel(`kds-pos-orders-${restaurantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "PosOrder", filter: `restaurantId=eq.${restaurantId}` }, () => { fetchOrders(); })
      .subscribe();
    const onVis = () => { if (document.visibilityState === "visible") fetchOrders(); };
    document.addEventListener("visibilitychange", onVis);
    const backup = setInterval(fetchOrders, 60000);
    return () => { supabase.removeChannel(channel); document.removeEventListener("visibilitychange", onVis); clearInterval(backup); };
  }, [restaurantId, fetchOrders]);

  const active = orders.filter((o) => o.posStatus !== "canceled");
  const pend = active.filter((o) => o.opsStage === "preparing").sort((a, b) => SEC(a.createdAt) - SEC(b.createdAt));
  const comp = active.filter((o) => o.opsStage !== "preparing").sort((a, b) => doneSec(b) - doneSec(a));

  // KPI: completados en buen tiempo (< 10 min).
  const greenCount = comp.filter((o) => Math.max(0, doneSec(o) - SEC(o.createdAt)) < 600).length;

  const today = chileTodayLocal();
  const toggleGroup = () => setGroupHour((g) => { const n = !g; try { localStorage.setItem("kdsGroupHour", n ? "1" : "0"); } catch { /* noop */ } return n; });

  // Agrupa completados por bloque horario (hora de completado).
  const compGroups: { hk: string; label: string; rate: string; items: PosOrder[] }[] = [];
  if (groupHour) {
    const by = new Map<string, PosOrder[]>();
    for (const o of comp) {
      const d = new Date(doneSec(o) * 1000);
      const hk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}`;
      if (!by.has(hk)) by.set(hk, []);
      by.get(hk)!.push(o);
    }
    for (const [hk, items] of by) {
      const hh = hk.slice(-2);
      // Cadencia del bloque: 1 pedido cada (60/N) minutos.
      const cada = Math.round(60 / items.length);
      const rate = items.length >= 1 ? `1 pedido cada ${cada} ${cada === 1 ? "minuto" : "minutos"}` : "";
      compGroups.push({ hk, label: `${hh}:00 – ${hh}:59`, rate, items });
    }
  }

  return (
    <div className="kds-root">
      <style>{KDS_CSS}</style>

      <div className="topbar">
        <h1>KDS Cocina</h1>
        <div className="right">
          <span className="kpi" title="Completados en menos de 10 minutos">Pedidos preparados en buen tiempo: <b>{greenCount}</b></span>
          <button type="button" className={`ghost ${groupHour ? "on" : ""}`} aria-pressed={groupHour} onClick={toggleGroup}>🕐 Completados por hora</button>
          <Link href="/panel/centro-pedidos" className="ghost">Volver</Link>
          <button type="button" className="ghost" onClick={fetchOrders}>Refrescar</button>
        </div>
      </div>

      <div className="toolbar">
        <button type="button" className="nav-day" onClick={() => setDate((d) => addDaysYmd(d, -1))} aria-label="Día anterior">‹</button>
        <span className="day">{date.split("-").reverse().join("-")}</span>
        <button type="button" className="nav-day" onClick={() => setDate((d) => addDaysYmd(d, 1))} disabled={date >= today} aria-label="Día siguiente">›</button>
        {date !== today && <button type="button" className="hoy" onClick={() => setDate(today)}>Hoy</button>}
        <span className="meta">{weekdayLabel(date)}</span>
      </div>

      <div className="wrap">
        <section className="section pending">
          <h2 className="section-title">📌 Pendientes <span className="count">{pend.length}</span></h2>
          {pend.length === 0 ? (
            <div className="empty">No hay pedidos en preparación.</div>
          ) : (
            <div className="kds-grid">{pend.map((o) => <Card key={o.id} o={o} now={now} />)}</div>
          )}
        </section>

        <div className="hard-sep" />

        <section className="section completed-block">
          <h2 className="section-title">✅ Completados <span className="count">{comp.length}</span></h2>
          {comp.length === 0 ? (
            <div className="empty">No hay pedidos completados.</div>
          ) : groupHour ? (
            <div className="kds-grid">
              {compGroups.map((g) => (
                <div key={g.hk} style={{ display: "contents" }}>
                  <div className="hour-group"><span>{g.label}</span><span className="hg-count">{g.items.length}</span><span className="hg-line" /><span className="hg-rate">{g.rate}</span></div>
                  {g.items.map((o) => <Card key={o.id} o={o} now={now} />)}
                </div>
              ))}
            </div>
          ) : (
            <div className="kds-grid">{comp.map((o) => <Card key={o.id} o={o} now={now} />)}</div>
          )}
        </section>
      </div>
    </div>
  );
}

const KDS_CSS = `
  @media (min-width:768px){ .owl-sidebar{ display:none !important } .owl-main{ margin-left:0 !important } }
  .owl-main{ padding:0 !important; zoom:1 !important; }
  .kds-root{
    position:fixed; inset:0; z-index:40; overflow-y:auto;
    background:#fff; color:#0d1526;
    font-family:'Inter',system-ui,-apple-system,Segoe UI,Roboto,Arial; -webkit-font-smoothing:antialiased;
    --bg-soft:#f1f4f9; --line:#d4dbe6; --text:#0d1526; --muted:#51607a;
    --del-bg:#dbeafe; --del-fg:#1e3a8a; --mesa-bg:#ede9fe; --mesa-fg:#5b21b6; --ret-bg:#ccfbf1; --ret-fg:#115e59;
    --accent-pend:#d97706; --accent-comp:#059669;
  }
  .kds-root .topbar{ display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;
    padding:12px 16px; background:rgba(255,255,255,.92); backdrop-filter:blur(8px); border-bottom:1px solid var(--line); position:sticky; top:0; z-index:20; }
  .kds-root .topbar h1{ margin:0; font-size:17px; font-weight:700; letter-spacing:.02em; display:flex; align-items:center; gap:9px; }
  .kds-root .topbar h1::before{ content:"🍣"; font-size:18px; }
  .kds-root .topbar .right{ display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; align-items:center; }
  .kds-root .topbar .right .ghost{ text-decoration:none; color:var(--text); background:var(--bg-soft); padding:8px 14px; border-radius:10px; border:1px solid var(--line); font-weight:600; font-size:13px; cursor:pointer; font-family:inherit; }
  .kds-root .topbar .right .ghost:hover{ background:#e2e8f2; }
  .kds-root .topbar .right .ghost.on{ background:#2563eb; color:#fff; border-color:#2563eb; }
  .kds-root .topbar .right .kpi{ display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:10px; background:rgba(5,150,105,.12); border:1px solid rgba(5,150,105,.35); color:#047857; font-weight:600; font-size:13px; white-space:nowrap; }
  .kds-root .topbar .right .kpi b{ font-weight:800; font-size:15px; font-variant-numeric:tabular-nums; }

  .kds-root .toolbar{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; padding:10px 16px; background:var(--bg-soft); border-bottom:1px solid var(--line); color:var(--muted); position:sticky; top:53px; z-index:19; }
  .kds-root .toolbar .nav-day{ background:#fff; color:var(--text); border:1px solid var(--line); font-size:18px; font-weight:700; line-height:1; width:36px; height:36px; border-radius:9px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; }
  .kds-root .toolbar .nav-day:disabled{ opacity:.4; cursor:default; }
  .kds-root .toolbar .day{ font-size:14px; font-weight:800; color:var(--text); min-width:92px; text-align:center; font-variant-numeric:tabular-nums; }
  .kds-root .toolbar .hoy{ padding:8px 14px; border-radius:9px; border:1px solid #2563eb; background:#2563eb; color:#fff; font-weight:600; cursor:pointer; font-size:13px; }
  .kds-root .toolbar .meta{ margin-left:auto; opacity:.9; font-size:18px; font-weight:700; color:var(--text); }

  .kds-root .wrap{ padding:16px; display:flex; flex-direction:column; gap:20px; }
  .kds-root .section-title{ margin:0 0 14px; font-weight:600; color:var(--text); display:flex; align-items:center; gap:10px; font-size:14px; text-transform:uppercase; letter-spacing:.08em; }
  .kds-root .section-title::before{ content:""; width:10px; height:10px; border-radius:50%; }
  .kds-root .section.pending .section-title::before{ background:var(--accent-pend); box-shadow:0 0 10px var(--accent-pend); }
  .kds-root .section.completed-block .section-title::before{ background:var(--accent-comp); box-shadow:0 0 10px var(--accent-comp); }
  .kds-root .section-title .count{ font-variant-numeric:tabular-nums; background:var(--bg-soft); border:1px solid var(--line); color:var(--text); padding:2px 10px; border-radius:999px; font-weight:700; font-size:12px; }
  .kds-root .hard-sep{ height:1px; background:linear-gradient(90deg,transparent,var(--line) 15%,var(--line) 85%,transparent); margin:4px 0; }
  .kds-root .section.completed-block{ opacity:.96; }
  .kds-root .empty{ color:var(--muted); font-size:13px; padding:8px 2px; }

  .kds-root .kds-grid{ display:grid; gap:14px; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); align-items:start; }
  @media screen and (max-aspect-ratio: 1/1){ .kds-root .kds-grid{ grid-template-columns:repeat(4, 1fr); gap:10px; } }
  @media (max-width:1100px){ .kds-root .kds-grid{ grid-template-columns:repeat(3, 1fr); gap:12px; } }
  @media (max-width:700px){ .kds-root .kds-grid{ grid-template-columns:repeat(2, 1fr); gap:10px; } }
  @media (max-width:480px){ .kds-root .kds-grid{ grid-template-columns:1fr; } }

  .kds-root .hour-group{ grid-column:1 / -1; display:flex; align-items:center; gap:10px; margin:6px 0 2px; padding:6px 2px; font-size:13px; font-weight:700; color:var(--text); text-transform:uppercase; letter-spacing:.04em; }
  .kds-root .hour-group::before{ content:""; width:9px; height:9px; border-radius:50%; background:var(--accent-comp); }
  .kds-root .hour-group .hg-line{ flex:1 1 auto; height:1px; background:var(--line); }
  .kds-root .hour-group .hg-count{ font-variant-numeric:tabular-nums; font-weight:700; font-size:12px; background:var(--bg-soft); border:1px solid var(--line); color:var(--muted); padding:1px 9px; border-radius:999px; }
  .kds-root .hour-group .hg-rate{ flex:0 0 auto; text-transform:none; letter-spacing:0; font-size:12px; font-weight:600; color:var(--muted); font-variant-numeric:tabular-nums; }

  .kds-root .kds-card{ --age:#64748b; --age-soft:rgba(100,116,139,.14); position:relative; overflow:hidden; background:#fff; border:1px solid var(--line); border-radius:16px; padding:14px 16px 14px 18px; box-shadow:0 2px 8px rgba(13,21,38,.08); display:flex; flex-direction:column; gap:9px; }
  .kds-root .kds-card::before{ content:""; position:absolute; left:0; top:0; bottom:0; width:6px; background:var(--age); }
  .kds-root .kds-card::after{ content:""; position:absolute; inset:0; pointer-events:none; z-index:0; background:linear-gradient(180deg, var(--age-soft), transparent 40%); }
  .kds-root .kds-card > *{ position:relative; z-index:1; }
  .kds-root .card-age-gray{ --age:#64748b; --age-soft:rgba(100,116,139,.12); }
  .kds-root .card-age-yellow{ --age:#f59e0b; --age-soft:rgba(245,158,11,.16); }
  .kds-root .card-age-red{ --age:#f97316; --age-soft:rgba(249,115,22,.18); }
  .kds-root .card-age-red-strong{ --age:#ef4444; --age-soft:rgba(239,68,68,.22); }
  .kds-root .card-age-green{ --age:#22c55e; --age-soft:rgba(34,197,94,.14); }
  .kds-root .kds-card.card-age-red-strong:not(.is-completed)::before{ animation:kdsPulse 1.3s ease-in-out infinite; }
  @keyframes kdsPulse{ 0%,100%{opacity:1} 50%{opacity:.45} }

  .kds-root .kds-head{ display:flex; gap:9px; align-items:center; }
  .kds-root .kds-type{ display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:700; padding:3px 11px; border-radius:999px; text-transform:uppercase; letter-spacing:.05em; white-space:nowrap; background:var(--bg-soft); color:var(--muted); }
  .kds-root .kds-type::before{ content:""; width:14px; height:14px; flex:0 0 auto; background:currentColor; -webkit-mask:center/contain no-repeat var(--ic); mask:center/contain no-repeat var(--ic); }
  .kds-root .kds-type.t-delivery{ background:var(--del-bg); color:var(--del-fg); --ic:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='6' cy='17' r='2.5'/%3E%3Ccircle cx='17' cy='17' r='2.5'/%3E%3Cpath d='M8.5 17H14l2-7h3'/%3E%3Cpath d='M14 10l-1.5-4H9'/%3E%3C/svg%3E"); }
  .kds-root .kds-type.t-mesa{ background:var(--mesa-bg); color:var(--mesa-fg); --ic:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M7 2v20'/%3E%3Cpath d='M5 2v6a2 2 0 0 0 4 0V2'/%3E%3Cpath d='M17 2c-1.5 0-3 1.5-3 5s1.5 4 3 4v11'/%3E%3C/svg%3E"); }
  .kds-root .kds-type.t-retiro{ background:var(--ret-bg); color:var(--ret-fg); --ic:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 7h12l-1 13H7L6 7Z'/%3E%3Cpath d='M9 7a3 3 0 0 1 6 0'/%3E%3C/svg%3E"); }
  .kds-root .kds-timer{ margin-left:auto; font-size:22px; font-weight:800; font-variant-numeric:tabular-nums; letter-spacing:.02em; background:var(--age); color:#0d1526; border-radius:10px; padding:3px 11px; box-shadow:0 1px 4px rgba(13,21,38,.18); }
  .kds-root .card-age-red-strong .kds-timer, .kds-root .card-age-red .kds-timer{ color:#fff; }

  .kds-root .kds-customer{ font-size:21px; font-weight:800; line-height:1.15; margin:0; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .kds-root .kds-donetime{ font-size:12px; font-weight:600; color:var(--muted); font-variant-numeric:tabular-nums; margin-top:-2px; }

  .kds-root .kds-items{ margin:4px 0 0; padding:10px 0 0; list-style:none; border-top:1px dashed var(--line); display:flex; flex-direction:column; gap:5px; }
  .kds-root .kds-items li{ position:relative; padding-left:20px; color:#33415c; line-height:1.3; font-size:14px; font-weight:500; word-break:break-word; }
  .kds-root .kds-items li::before{ content:""; position:absolute; left:2px; top:.42em; width:7px; height:7px; border-radius:2px; background:var(--age); box-shadow:0 0 0 2px var(--age-soft); }
  .kds-root .kds-items li strong{ font-weight:800; color:var(--text); }

  .kds-root .kds-card.is-completed{ background:var(--bg-soft); }
  .kds-root .kds-card.is-completed::before{ animation:none; }
  .kds-root .kds-card.is-completed::after{ display:none; }
  .kds-root .kds-card.is-completed .kds-customer{ color:#51607a; }
  .kds-root .kds-card.is-completed .kds-items li{ color:#64748b; }
  .kds-root .kds-card.is-completed .kds-items li strong{ color:#33415c; }
  .kds-root .kds-card.is-completed .kds-timer{ background:#e2e8f2; color:#51607a; box-shadow:none; }

  @media (max-width:820px){ .kds-root .topbar .right .kpi{ padding:7px 11px; font-size:12px; } }
  @media (max-width:480px){ .kds-root .kds-customer{ font-size:19px; } .kds-root .kds-timer{ font-size:20px; } }
`;
