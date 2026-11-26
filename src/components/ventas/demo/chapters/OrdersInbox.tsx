"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { BellRing, Phone, Store, CreditCard, StickyNote, Printer, ChevronRight } from "lucide-react";
import type { DemoData, LiveOrder } from "../types";
import { EASE, LocalLogo, clp, featuredDishes, onColor, rgba } from "../ui";

type Stage = "nuevo" | "preparando" | "listo";
const STAGE: Record<Stage, { label: string; color: string; next: string | null }> = {
  nuevo: { label: "Nuevo", color: "#f59e0b", next: "Aceptar y preparar" },
  preparando: { label: "En preparación", color: "#3b82f6", next: "Marcar listo" },
  listo: { label: "Listo para retiro", color: "#16a34a", next: null },
};

/** Pedidos de ejemplo cuando el dueño aún no hizo el suyo. */
export function sampleOrders(data: DemoData, now: number): LiveOrder[] {
  const d = featuredDishes(data, 5).filter((x) => x.price > 0);
  if (!d.length) return [];
  const mk = (i: number, customer: string, picks: number[], mins: number): LiveOrder => {
    const lines = picks.map((p, j) => ({ name: d[p % d.length].name, qty: j === 0 ? 2 : 1, price: d[p % d.length].price }));
    return { id: `s${i}`, number: 128 + i, customer, phone: "+56 9 1234 5678", payment: "efectivo", note: i === 0 ? "Sin cebollín, por favor" : null, lines, total: lines.reduce((s, l) => s + l.price * l.qty, 0), at: new Date(now - mins * 60000).toISOString() };
  };
  return [mk(0, "Camila Rojas", [0, 1], 1), mk(1, "Diego Muñoz", [2], 9), mk(2, "Fernanda Soto", [3, 4], 17)];
}

/** Bandeja de pedidos online como en el POS de QuieroComer: los pedidos llegan, se abren y se avanzan. */
export default function OrdersInbox({ data, orders, highlightId }: { data: DemoData; orders: LiveOrder[]; highlightId?: string | null }) {
  const c = data.color;
  const [selected, setSelected] = useState<string | null>(orders[0]?.id ?? null);
  const [stages, setStages] = useState<Record<string, Stage>>({});
  const [now] = useState(() => Date.now());
  const sel = orders.find((o) => o.id === selected) ?? orders[0] ?? null;
  const stageOf = (id: string) => stages[id] ?? "nuevo";
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const ago = (iso: string) => { const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60000)); return m < 1 ? "recién" : `hace ${m} min`; };

  return (
    <div onClick={stop} style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", fontSize: 11, color: "#1a1a1a", background: "#F5F4F1", cursor: "default" }}>
      <div style={{ height: 44, display: "flex", alignItems: "center", gap: 10, padding: "0 14px", background: "#fff", borderBottom: "1px solid #e7e4de", flexShrink: 0 }}>
        <LocalLogo data={data} size={26} />
        <b style={{ fontSize: 12 }}>Pedidos online</b>
        <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: "#f59e0b", padding: "2px 8px", borderRadius: 99 }}>{orders.filter((o) => stageOf(o.id) === "nuevo").length} nuevos</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: "#888", fontWeight: 700 }}>Tienda · Retiro y delivery</span>
      </div>
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div style={{ flex: 1, padding: 12, display: "grid", gap: 9, alignContent: "start", overflowY: "auto" }}>
          <AnimatePresence initial={false}>
            {orders.map((o) => {
              const st = STAGE[stageOf(o.id)];
              const isSel = sel?.id === o.id;
              const isNew = o.id === highlightId;
              const qty = o.lines.reduce((s, l) => s + l.qty, 0);
              return (
                <motion.button key={o.id} layout initial={{ opacity: 0, y: -18, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.55, ease: EASE }}
                  onClick={() => setSelected(o.id)}
                  style={{ textAlign: "left", font: "inherit", cursor: "pointer", borderRadius: 14, padding: "11px 12px", background: "#fff", color: "#1a1a1a", position: "relative",
                    border: isSel ? `1.5px solid ${c}` : "1.5px solid #e7e4de", boxShadow: isNew ? `0 0 0 4px ${rgba(c, 0.25)}, 0 10px 24px -10px rgba(0,0,0,.3)` : isSel ? "0 6px 20px rgba(0,0,0,.1)" : "none" }}>
                  {isNew && <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1.2 }} style={{ position: "absolute", top: -8, right: 10, fontSize: 9, fontWeight: 900, letterSpacing: ".06em", padding: "3px 8px", borderRadius: 99, background: c, color: onColor(c) }}>TU PEDIDO</motion.span>}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <b style={{ fontSize: 13 }}>#{o.number ?? "—"}</b>
                    <span style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 7px", borderRadius: 99, background: "#f1f5f9", color: "#64748b" }}>Retiro</span>
                    <span style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 7px", borderRadius: 99, background: rgba(st.color, 0.12), color: st.color }}>{st.label}</span>
                    <div style={{ flex: 1 }} />
                    <span style={{ fontSize: 10, color: "#999" }}>{ago(o.at)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, gap: 8 }}>
                    <span style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.customer || "Cliente"}</span>
                    <span style={{ fontFamily: "var(--demo-mono)", fontWeight: 700 }}>{clp(o.total)}</span>
                  </div>
                  <div style={{ color: "#888", fontSize: 10, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{qty} productos · {o.lines.map((l) => l.name).join(", ")}</div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Detalle */}
        <div style={{ width: "46%", background: "#fff", borderLeft: "1px solid #e7e4de", padding: 14, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <AnimatePresence mode="wait">
            {sel ? (
              <motion.div key={sel.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <b style={{ fontSize: 15 }}>Pedido #{sel.number ?? "—"}</b>
                  <span style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 8px", borderRadius: 99, background: rgba(STAGE[stageOf(sel.id)].color, 0.12), color: STAGE[stageOf(sel.id)].color }}>{STAGE[stageOf(sel.id)].label}</span>
                </div>
                <div style={{ display: "grid", gap: 5, marginTop: 10, padding: 10, borderRadius: 12, background: "#faf9f7" }}>
                  <Row icon={<BellRing size={12} />}><b>{sel.customer || "Cliente"}</b></Row>
                  <Row icon={<Phone size={12} />}>{sel.phone || "—"}</Row>
                  <Row icon={<Store size={12} />}>Retiro en local</Row>
                  <Row icon={<CreditCard size={12} />}>Pago en {sel.payment === "efectivo" ? "efectivo" : sel.payment || "efectivo"} al retirar</Row>
                </div>
                <div style={{ marginTop: 10, display: "grid", gap: 6, overflowY: "auto", minHeight: 0, flex: 1, alignContent: "start" }}>
                  {sel.lines.map((l, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span><b>{l.qty}×</b> {l.name}</span>
                      <span style={{ fontFamily: "var(--demo-mono)", fontWeight: 600 }}>{l.price ? clp(l.price * l.qty) : ""}</span>
                    </div>
                  ))}
                  {sel.note && <div style={{ display: "flex", gap: 6, alignItems: "flex-start", padding: "7px 9px", borderRadius: 10, background: "#fef3c7", color: "#92400e", fontWeight: 600 }}><StickyNote size={12} style={{ flexShrink: 0, marginTop: 1 }} /> {sel.note}</div>}
                </div>
                <div style={{ borderTop: "1px dashed #ddd", paddingTop: 8, marginTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 13 }}><span>Total</span><span style={{ fontFamily: "var(--demo-mono)" }}>{clp(sel.total)}</span></div>
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button onClick={() => {}} style={{ flex: "0 0 auto", borderRadius: 10, padding: "9px 10px", border: "1px solid #e7e4de", background: "#fff", font: "inherit", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><Printer size={13} /> Comanda</button>
                  {STAGE[stageOf(sel.id)].next ? (
                    <motion.button whileTap={{ scale: 0.97 }} onClick={() => setStages((s) => ({ ...s, [sel.id]: stageOf(sel.id) === "nuevo" ? "preparando" : "listo" }))}
                      style={{ flex: 1, borderRadius: 10, padding: "9px 0", border: "none", font: "inherit", fontWeight: 800, fontSize: 12, background: c, color: onColor(c), cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                      {STAGE[stageOf(sel.id)].next} <ChevronRight size={14} />
                    </motion.button>
                  ) : (
                    <div style={{ flex: 1, borderRadius: 10, padding: "9px 0", textAlign: "center", fontWeight: 800, fontSize: 12, background: "#f0fdf4", color: "#16a34a" }}>✓ Avisamos al cliente</div>
                  )}
                </div>
              </motion.div>
            ) : (
              <div style={{ margin: "auto", color: "#999", textAlign: "center" }}>Esperando pedidos…</div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 7, color: "#444" }}><span style={{ color: "#999", display: "grid" }}>{icon}</span><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{children}</span></div>;
}
