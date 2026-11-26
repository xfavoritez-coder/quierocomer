"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Wifi, WifiOff, CheckCircle2 } from "lucide-react";
import type { ChapterProps } from "../DemoShell";
import type { DemoData } from "../types";
import { TabletFrame } from "../frames";
import { BrandText, CountUp, EASE, Eyebrow, Headline, LocalLogo, Reveal, Stage, avgTicket, clp, featuredDishes, lighten, onColor, rgba, useViewport } from "../ui";

export const posSteps = 7;

const COPY: Record<number, { t1: React.ReactNode; t2: React.ReactNode; sub: string }> = {
  1: { t1: "Mesas, cuentas y cobros.", t2: "Con tus platos ya cargados.", sub: "Toca una mesa libre, agrega platos y cobra." },
  2: { t1: "Se cae el wifi.", t2: "Tú sigues vendiendo.", sub: "Las ventas se guardan y se sincronizan solas cuando vuelve internet." },
  3: { t1: "Cada pedido,", t2: "su comanda.", sub: "Del salón, de tu tienda online o de las apps: todo entra al mismo POS y se imprime en cocina al instante." },
  4: { t1: "Conoce a tus clientes.", t2: "No solo tus ventas.", sub: "Clientes nuevos y recurrentes, tus platos estrella y quiénes dejaron de venir. Reportes que te dicen qué hacer." },
  5: { t1: "Inventario y bodega,", t2: "al día.", sub: "Cada venta descuenta los insumos. Te avisamos antes de que algo se acabe." },
  6: { t1: "¿Más de un local?", t2: "Todo en un solo lugar.", sub: "Ventas, cajas y reportes de todas tus sucursales, juntos o por separado." },
};

export default function Pos({ data, step }: ChapterProps) {
  const { narrow, w } = useViewport();
  const c = data.color;
  const accent = lighten(c, 0.35);

  if (step === 0) {
    return (
      <Stage style={{ flexDirection: "column", textAlign: "center" }}>
        <Reveal step={step} at={0}><Eyebrow color={accent}>POS</Eyebrow></Reveal>
        <Reveal step={step} at={0} delay={0.15}><Headline style={{ marginTop: 18, color: "#fff" }}>Toda tu operación<br />en una pantalla.</Headline></Reveal>
        <Reveal step={step} at={0} delay={0.5}><Headline style={{ marginTop: 6 }}><BrandText color={accent}>Incluso sin internet.</BrandText></Headline></Reveal>
      </Stage>
    );
  }

  const k = Math.min(step, posSteps - 1);
  const copy = COPY[k];
  const tabletW = Math.min(narrow ? w - 40 : 780, 780);
  const screen =
    k === 1 || k === 2 ? <PosRegister key={k === 2 ? "offline" : "online"} data={data} offline={k === 2} />
    : k === 3 ? <PosComandas data={data} />
    : k === 4 ? <PosReports data={data} />
    : k === 5 ? <PosInventory data={data} />
    : <PosBranches data={data} />;

  return (
    <Stage style={{ flexDirection: narrow ? "column" : "row", gap: "clamp(24px, 4vw, 64px)" }}>
      <div style={{ flex: "0 1 380px", minWidth: 0 }}>
        <Reveal step={step} at={1}><Eyebrow color={accent}>POS · {data.name}</Eyebrow></Reveal>
        <AnimatePresence mode="wait">
          <motion.div key={k} initial={{ opacity: 0, y: 14, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -10, filter: "blur(6px)" }} transition={{ duration: 0.6, ease: EASE }}>
            <Headline size="md" style={{ marginTop: 14, color: "#fff" }}>{copy.t1}<br /><BrandText color={accent}>{copy.t2}</BrandText></Headline>
            <div style={{ fontSize: "clamp(15px, 1.3vw, 18px)", color: "rgba(255,255,255,.58)", marginTop: 16, lineHeight: 1.5 }}>{copy.sub}</div>
          </motion.div>
        </AnimatePresence>
        {!narrow && (
          <div style={{ display: "flex", gap: 6, marginTop: 26, flexWrap: "wrap" }}>
            {["Caja", "Sin internet", "Comandas", "Reportes", "Inventario", "Sucursales"].map((t, i) => (
              <motion.span key={t} initial={false} animate={{ background: i + 1 === k ? accent : "rgba(255,255,255,.07)", color: i + 1 === k ? onColor(accent) : "rgba(255,255,255,.5)" }}
                style={{ padding: "6px 12px", borderRadius: 99, fontSize: 12.5, fontWeight: 700 }}>{t}</motion.span>
            ))}
          </div>
        )}
      </div>
      <Reveal step={step} at={1} y={70} delay={0.2}>
        <TabletFrame width={tabletW}>
          <AnimatePresence mode="wait">
            <motion.div key={k === 2 ? 1 : k} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} style={{ position: "absolute", inset: 0 }}>{screen}</motion.div>
          </AnimatePresence>
        </TabletFrame>
      </Reveal>
    </Stage>
  );
}

function PosTopBar({ data, offline }: { data: DemoData; offline: boolean | "back" }) {
  return (
    <div style={{ height: 44, display: "flex", alignItems: "center", gap: 10, padding: "0 14px", background: "#fff", borderBottom: "1px solid #e7e4de", flexShrink: 0 }}>
      <LocalLogo data={data} size={26} />
      <b style={{ fontSize: 12 }}>{data.name}</b>
      <span style={{ fontSize: 10, color: "#16a34a", fontWeight: 700, background: "#f0fdf4", padding: "3px 8px", borderRadius: 99 }}>Caja abierta</span>
      <div style={{ flex: 1 }} />
      <motion.span initial={false} animate={{ color: offline === true ? "#dc2626" : "#16a34a" }} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 700 }}>
        {offline === true ? <WifiOff size={15} /> : <Wifi size={15} />} {offline === true ? "Sin conexión" : "En línea"}
      </motion.span>
    </div>
  );
}

type Line = { name: string; price: number; qty: number };

/** Caja interactiva: el vendedor abre una mesa, agrega platos del local y cobra frente
 *  al dueño. Todo ocurre en pantalla (no guarda nada). Los clics no avanzan la demo. */
function PosRegister({ data, offline }: { data: DemoData; offline: boolean }) {
  const reduce = useReducedMotion();
  const c = data.color;
  const menu = featuredDishes(data, 8).filter((d) => d.price > 0);

  // Sin internet: las ventas se guardan y luego se sincronizan. (El componente se monta
  // de nuevo al cambiar `offline` — ver key en Pos — así el estado parte limpio.)
  const [phase, setPhase] = useState<"online" | "offline" | "back">(() => (!offline ? "online" : reduce ? "back" : "offline"));
  const [saved, setSaved] = useState(() => (offline && reduce ? 3 : 0));
  useEffect(() => {
    if (!offline || reduce) return;
    const ts = [setTimeout(() => setSaved(1), 1200), setTimeout(() => setSaved(2), 2200), setTimeout(() => setSaved(3), 3200), setTimeout(() => setPhase("back"), 4600)];
    return () => ts.forEach(clearTimeout);
  }, [offline, reduce]);

  // Mesas: algunas ocupadas de fondo; la 4 parte con una cuenta abierta.
  const [orders, setOrders] = useState<Record<number, Line[]>>(() => {
    const o: Record<number, Line[]> = {};
    const seed = menu.slice(0, 3);
    if (seed.length) o[4] = seed.map((d, i) => ({ name: d.name, price: d.price, qty: i === 0 ? 2 : 1 }));
    return o;
  });
  const background = new Set([1, 3, 6, 9, 11]); // ocupadas (decorativas)
  const [active, setActive] = useState(4);
  const [paying, setPaying] = useState<null | "choose" | "done">(null);
  const [paidWith, setPaidWith] = useState("");
  const lines = orders[active] ?? [];
  const totalOf = (ls: Line[]) => ls.reduce((s, l) => s + l.price * l.qty, 0);
  const total = totalOf(lines);

  const add = (d: { name: string; price: number }) => setOrders((o) => {
    const ls = [...(o[active] ?? [])];
    const i = ls.findIndex((l) => l.name === d.name);
    if (i >= 0) ls[i] = { ...ls[i], qty: ls[i].qty + 1 }; else ls.push({ name: d.name, price: d.price, qty: 1 });
    return { ...o, [active]: ls };
  });
  const pay = (method: string) => {
    setPaidWith(method); setPaying("done");
    setTimeout(() => { setOrders((o) => { const n = { ...o }; delete n[active]; return n; }); setPaying(null); }, 2200);
  };
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const amountBg = (n: number) => Math.round((avgTicket(data) * (1 + (n % 3))) / 100) * 100;

  return (
    <div onClick={stop} style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", fontSize: 11, color: "#1a1a1a", cursor: "default" }}>
      <PosTopBar data={data} offline={phase === "offline" ? true : false} />
      <AnimatePresence>
        {phase !== "online" && (
          <motion.div key={phase} initial={{ height: 0, opacity: 0 }} animate={{ height: 30, opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.4 }}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontWeight: 700, fontSize: 11, color: "#fff", background: phase === "offline" ? "#dc2626" : "#16a34a", overflow: "hidden", flexShrink: 0 }}>
            {phase === "offline" ? <><WifiOff size={13} /> Sin internet · sigues vendiendo · {saved} {saved === 1 ? "venta guardada" : "ventas guardadas"}</> : <><CheckCircle2 size={13} /> Conexión recuperada · {saved} ventas sincronizadas</>}
          </motion.div>
        )}
      </AnimatePresence>
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div style={{ flex: 1, padding: 14, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gridAutoRows: "1fr", gap: 9 }}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => {
            const open = (orders[n]?.length ?? 0) > 0;
            const busy = open || background.has(n);
            const isActive = n === active;
            const amount = open ? totalOf(orders[n]) : background.has(n) ? amountBg(n) : 0;
            return (
              <motion.button key={n} onClick={() => { if (!background.has(n)) { setActive(n); setPaying(null); } }} whileTap={{ scale: 0.96 }}
                animate={{ scale: isActive ? 1.03 : 1 }} transition={{ duration: 0.25 }}
                style={{ font: "inherit", textAlign: "left", cursor: background.has(n) ? "default" : "pointer", borderRadius: 12, padding: 9, display: "flex", flexDirection: "column", justifyContent: "space-between",
                  background: isActive ? c : busy ? rgba(c, 0.12) : "#fff", color: isActive ? onColor(c) : "#1a1a1a", border: busy || isActive ? "none" : "1px dashed #d8d4cc", boxShadow: isActive ? `0 8px 20px -8px ${rgba(c, 0.7)}` : "none" }}>
                <b style={{ fontSize: 12 }}>Mesa {n}</b>
                <span style={{ fontFamily: "var(--demo-mono)", fontSize: 10.5, fontWeight: 600, opacity: busy || isActive ? 1 : 0.45 }}>{amount ? clp(amount) : isActive ? "nueva cuenta" : "libre"}</span>
              </motion.button>
            );
          })}
        </div>
        <div style={{ width: "38%", background: "#fff", borderLeft: "1px solid #e7e4de", padding: 12, display: "flex", flexDirection: "column", position: "relative", minHeight: 0 }}>
          <b style={{ fontSize: 13 }}>Mesa {active}</b>
          <span style={{ color: "#999", fontSize: 10 }}>{lines.length ? `${lines.reduce((s, l) => s + l.qty, 0)} productos` : "Mesa abierta · agrega platos"}</span>
          <div style={{ marginTop: 8, display: "grid", gap: 6, flex: 1, alignContent: "start", overflowY: "auto", minHeight: 0 }}>
            <AnimatePresence initial={false}>
              {lines.map((l) => (
                <motion.div key={l.name} layout initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.qty}× {l.name}</span>
                  <span style={{ fontFamily: "var(--demo-mono)", fontWeight: 600 }}>{clp(l.price * l.qty)}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", margin: "8px 0" }}>
            {menu.slice(0, 6).map((d) => (
              <motion.button key={d.name} whileTap={{ scale: 0.93 }} onClick={() => add(d)} title={`Agregar ${d.name}`}
                style={{ font: "inherit", fontSize: 9.5, fontWeight: 700, padding: "5px 7px", borderRadius: 8, border: `1px solid ${rgba(c, 0.35)}`, background: rgba(c, 0.07), color: "#1a1a1a", cursor: "pointer", maxWidth: "48%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                + {d.name}
              </motion.button>
            ))}
          </div>
          <div style={{ borderTop: "1px dashed #ddd", paddingTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 13 }}><span>Total</span><span style={{ fontFamily: "var(--demo-mono)" }}>{clp(total)}</span></div>
          <motion.button whileTap={{ scale: 0.97 }} disabled={!lines.length} onClick={() => setPaying("choose")}
            style={{ marginTop: 8, borderRadius: 10, padding: "10px 0", border: "none", font: "inherit", fontWeight: 800, fontSize: 12, background: lines.length ? c : "#ddd", color: lines.length ? onColor(c) : "#999", cursor: lines.length ? "pointer" : "default" }}>
            Cobrar {lines.length ? clp(total) : ""}
          </motion.button>

          <AnimatePresence>
            {paying && (
              <motion.div key={paying} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,.97)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 14, textAlign: "center" }}>
                {paying === "choose" ? (
                  <>
                    <div style={{ fontSize: 11, color: "#888", fontWeight: 700 }}>Mesa {active} · Total</div>
                    <div style={{ fontFamily: "var(--demo-mono)", fontSize: 24, fontWeight: 700 }}>{clp(total)}</div>
                    {["Efectivo", "Tarjeta", "Transferencia"].map((m) => (
                      <motion.button key={m} whileTap={{ scale: 0.96 }} onClick={() => pay(m)} style={{ width: "100%", padding: "9px 0", borderRadius: 10, border: `1.5px solid ${c}`, background: "#fff", font: "inherit", fontWeight: 800, fontSize: 12, cursor: "pointer", color: "#1a1a1a" }}>{m}</motion.button>
                    ))}
                    <button onClick={() => setPaying(null)} style={{ background: "none", border: "none", color: "#999", font: "inherit", fontSize: 11, cursor: "pointer" }}>Volver</button>
                  </>
                ) : (
                  <>
                    <motion.div initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 14 }}><CheckCircle2 size={46} color="#16a34a" /></motion.div>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>Cuenta cerrada</div>
                    <div style={{ color: "#666" }}>Mesa {active} · {clp(total)} · {paidWith}</div>
                    <div style={{ color: "#999", fontSize: 10 }}>Boleta emitida · mesa liberada</div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ── Pantallas del POS ──────────────────────────────────────────────────────
const card: React.CSSProperties = { background: "#fff", borderRadius: 12, padding: "11px 12px" };
const kpiLabel: React.CSSProperties = { color: "#999", fontSize: 10, fontWeight: 700 };

function Shell({ data, title, children, store }: { data: DemoData; title?: string; children: React.ReactNode; store?: boolean }) {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", fontSize: 11, color: "#1a1a1a" }}>
      {store ? (
        <div style={{ height: 44, display: "flex", alignItems: "center", gap: 10, padding: "0 14px", background: "#fff", borderBottom: "1px solid #e7e4de", flexShrink: 0 }}>
          <LocalLogo data={data} size={26} /><b style={{ fontSize: 12 }}>{data.name}</b><span style={{ fontSize: 10, color: "#888", fontWeight: 700 }}>Tienda online · Clientes</span>
        </div>
      ) : <PosTopBar data={data} offline={false} />}
      {title && <div style={{ padding: "12px 14px 0", fontWeight: 800, fontSize: 13 }}>{title}</div>}
      <div style={{ flex: 1, padding: 14, minHeight: 0, display: "flex", flexDirection: "column" }}>{children}</div>
    </div>
  );
}

/** Comandas: pedidos de distintos canales que se imprimen en cocina. */
function PosComandas({ data }: { data: DemoData }) {
  const reduce = useReducedMotion();
  const c = data.color;
  const d = featuredDishes(data, 6).filter((x) => x.price > 0);
  const tickets = [
    { src: "Salón · Mesa 4", color: "#8b5cf6", items: d.slice(0, 3) },
    { src: "Tienda online · Retiro", color: c, items: d.slice(2, 4) },
    { src: "Uber Eats · Delivery", color: "#16a34a", items: d.slice(4, 6).length ? d.slice(4, 6) : d.slice(0, 2) },
  ];
  const [n, setN] = useState(reduce ? 3 : 0);
  useEffect(() => {
    if (reduce) return;
    const ts = [0, 1, 2].map((i) => setTimeout(() => setN(i + 1), 500 + i * 1400));
    return () => ts.forEach(clearTimeout);
  }, [reduce]);
  return (
    <Shell data={data} title="Cocina · comandas">
      <div style={{ flex: 1, display: "flex", gap: 12, alignItems: "flex-start" }}>
        {tickets.map((t, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: "86%", height: 16, borderRadius: "8px 8px 3px 3px", background: "#2b2b2e", boxShadow: "inset 0 -3px 0 #111" }} />
            <motion.div initial={false} animate={{ height: i < n ? "auto" : 0 }} transition={{ duration: 1.1, ease: EASE }}
              style={{ width: "78%", overflow: "hidden", background: "#fffefa", boxShadow: "0 10px 20px -10px rgba(0,0,0,.35)", fontFamily: "var(--demo-mono)", fontSize: 10 }}>
              <div style={{ padding: "9px 10px 12px", borderBottom: "2px dashed #ddd" }}>
                <div style={{ fontWeight: 800, fontSize: 10.5, color: t.color }}>{t.src}</div>
                <div style={{ color: "#999", marginBottom: 6 }}>#{140 + i} · 13:4{i}</div>
                {t.items.map((x) => <div key={x.name} style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>1× {x.name}</div>)}
              </div>
            </motion.div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/** Reportes avanzados: clientes nuevos/recurrentes, platos estrella, clientes perdidos. */
function PosReports({ data }: { data: DemoData }) {
  const c = data.color;
  const top = featuredDishes(data, 4).map((d, i) => ({ name: d.name, qty: [42, 31, 24, 15][i] }));
  const ring = (pct: number) => `conic-gradient(${c} 0 ${pct}%, ${rgba(c, 0.18)} ${pct}% 100%)`;
  return (
    <Shell data={data} title="Reportes · últimos 30 días">
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "auto 1fr", gap: 10, minHeight: 0 }}>
        <div style={card}><div style={kpiLabel}>Clientes nuevos</div><div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}><CountUp value={186} run money={false} /></div><div style={{ color: "#16a34a", fontWeight: 700, fontSize: 10 }}>▲ 12% vs mes anterior</div></div>
        <div style={card}><div style={kpiLabel}>Clientes recurrentes</div><div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}><CountUp value={412} run money={false} /></div><div style={{ color: "#16a34a", fontWeight: 700, fontSize: 10 }}>▲ 8%</div></div>
        <div style={{ ...card, background: "#fef2f2" }}><div style={{ ...kpiLabel, color: "#dc2626" }}>Clientes perdidos</div><div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: "#dc2626" }}><CountUp value={37} run money={false} /></div><div style={{ color: "#b91c1c", fontWeight: 700, fontSize: 10 }}>no vuelven hace +45 días</div></div>
        <div style={{ ...card, display: "flex", alignItems: "center", gap: 14 }}>
          <motion.div initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} transition={{ duration: 1, ease: EASE }} style={{ width: 84, height: 84, borderRadius: "50%", background: ring(69), display: "grid", placeItems: "center", flexShrink: 0 }}>
            <div style={{ width: 58, height: 58, borderRadius: "50%", background: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 15 }}>69%</div>
          </motion.div>
          <div><b style={{ fontSize: 11.5 }}>Vuelven</b><div style={{ color: "#888", marginTop: 3, lineHeight: 1.35 }}>de cada 10 clientes, 7 repiten en el mes</div></div>
        </div>
        <div style={{ ...card, gridColumn: "span 2" }}>
          <b style={{ fontSize: 11.5 }}>Platos estrella</b>
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {top.map((t, i) => (
              <div key={t.name}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 6, fontSize: 10 }}><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span><span style={{ fontFamily: "var(--demo-mono)", fontWeight: 700 }}>{t.qty}</span></div>
                <div style={{ height: 5, background: "#f1efea", borderRadius: 3, marginTop: 3 }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(t.qty / top[0].qty) * 100}%` }} transition={{ duration: 1, ease: EASE, delay: 0.4 + i * 0.1 }} style={{ height: "100%", borderRadius: 3, background: c }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}

/** Recuperación de clientes: se va, recibe un cupón, vuelve. */
export function PosRecovery({ data }: { data: DemoData }) {
  const reduce = useReducedMotion();
  const c = data.color;
  const dish = featuredDishes(data, 1)[0];
  const people = [
    { n: "María González", d: 52 }, { n: "Jorge Pérez", d: 47 }, { n: "Valentina Díaz", d: 61 },
  ];
  const [k, setK] = useState(reduce ? 3 : 0);
  useEffect(() => {
    if (reduce) return;
    const ts = [setTimeout(() => setK(1), 900), setTimeout(() => setK(2), 2300), setTimeout(() => setK(3), 3900)];
    return () => ts.forEach(clearTimeout);
  }, [reduce]);
  return (
    <Shell data={data} title="Recuperación de clientes" store>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 12, minHeight: 0 }}>
        <div style={{ ...card, display: "grid", gap: 8, alignContent: "start" }}>
          <div style={kpiLabel}>No te piden hace +45 días</div>
          {people.map((p, i) => {
            const back = i === 0 && k >= 3;
            const sent = k >= 1;
            return (
              <motion.div key={p.n} layout style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 9px", borderRadius: 10, background: back ? "#f0fdf4" : "#faf9f7" }}>
                <div style={{ width: 26, height: 26, borderRadius: 99, background: rgba(c, 0.15), color: c, display: "grid", placeItems: "center", fontWeight: 800 }}>{p.n[0]}</div>
                <div style={{ flex: 1, minWidth: 0 }}><b>{p.n}</b><div style={{ color: "#999", fontSize: 9.5 }}>último pedido hace {p.d} días</div></div>
                <AnimatePresence mode="wait">
                  <motion.span key={back ? "b" : sent ? "s" : "w"} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                    style={{ fontSize: 9.5, fontWeight: 800, padding: "3px 8px", borderRadius: 99, background: back ? "#16a34a" : sent ? rgba(c, 0.15) : "#eee", color: back ? "#fff" : sent ? c : "#999" }}>
                    {back ? "¡Volvió!" : sent ? "Cupón enviado" : "En riesgo"}
                  </motion.span>
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
        <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
          <motion.div initial={false} animate={{ opacity: k >= 2 ? 1 : 0.25, y: k >= 2 ? 0 : 8 }} transition={{ duration: 0.6, ease: EASE }} style={{ ...card, border: `1.5px dashed ${c}` }}>
            <div style={kpiLabel}>Correo automático</div>
            <div style={{ fontWeight: 800, fontSize: 12.5, marginTop: 4 }}>María, te extrañamos 💛</div>
            <div style={{ color: "#666", marginTop: 4, lineHeight: 1.35 }}>Vuelve a {data.name} con <b style={{ color: c }}>15% de descuento</b>{dish ? ` en tu ${dish.name}` : ""}. Válido 7 días.</div>
            <div style={{ marginTop: 8, display: "inline-block", fontFamily: "var(--demo-mono)", fontWeight: 800, padding: "4px 10px", borderRadius: 8, background: rgba(c, 0.12), color: c }}>VUELVE15</div>
          </motion.div>
          <motion.div initial={false} animate={{ opacity: k >= 3 ? 1 : 0.25 }} transition={{ duration: 0.6 }} style={{ ...card, background: "#111", color: "#fff" }}>
            <div style={{ ...kpiLabel, color: "rgba(255,255,255,.5)" }}>Recuperados este mes</div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>{k >= 3 ? <CountUp value={14} run money={false} /> : 0} <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,.55)" }}>clientes volvieron</span></div>
          </motion.div>
        </div>
      </div>
    </Shell>
  );
}

/** Inventario y bodega: stock que baja con cada venta y alerta de reposición. */
function PosInventory({ data }: { data: DemoData }) {
  const reduce = useReducedMotion();
  const c = data.color;
  const items = [
    { n: "Arroz", u: "kg", from: 18, to: 16.4, max: 25 },
    { n: "Palta", u: "kg", from: 3.2, to: 1.4, max: 10, low: true },
    { n: "Queso crema", u: "kg", from: 6, to: 5.1, max: 10 },
    { n: "Bebidas lata", u: "un", from: 64, to: 52, max: 96 },
  ];
  const [sold, setSold] = useState(reduce);
  useEffect(() => { if (reduce) return; const t = setTimeout(() => setSold(true), 900); return () => clearTimeout(t); }, [reduce]);
  return (
    <Shell data={data} title="Bodega · stock en tiempo real">
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12, minHeight: 0 }}>
        <div style={{ ...card, display: "grid", gap: 11, alignContent: "start" }}>
          {items.map((it) => {
            const v = sold ? it.to : it.from;
            const low = sold && it.low;
            return (
              <div key={it.n}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><b>{it.n}</b><span style={{ fontFamily: "var(--demo-mono)", fontWeight: 700, color: low ? "#dc2626" : "#1a1a1a" }}>{v.toLocaleString("es-CL")} {it.u}</span></div>
                <div style={{ height: 7, background: "#f1efea", borderRadius: 4, marginTop: 4 }}>
                  <motion.div initial={false} animate={{ width: `${(v / it.max) * 100}%`, background: low ? "#dc2626" : c }} transition={{ duration: 1.2, ease: EASE }} style={{ height: "100%", borderRadius: 4 }} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
          <motion.div initial={false} animate={{ opacity: sold ? 1 : 0.3 }} style={card}>
            <div style={kpiLabel}>Venta registrada</div>
            <div style={{ marginTop: 4, color: "#666" }}>Cada plato vendido descuenta sus insumos de la bodega.</div>
          </motion.div>
          <AnimatePresence>
            {sold && (
              <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 1.2, duration: 0.6, ease: EASE }} style={{ ...card, background: "#fef2f2", border: "1px solid #fecaca" }}>
                <div style={{ fontWeight: 800, color: "#dc2626" }}>⚠️ Queda poca palta</div>
                <div style={{ color: "#7f1d1d", marginTop: 3 }}>1,4 kg · alcanza para hoy. ¿Hacer pedido al proveedor?</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Shell>
  );
}

/** Multisucursal: todas las sucursales en un solo panel. */
function PosBranches({ data }: { data: DemoData }) {
  const c = data.color;
  const t = avgTicket(data);
  const branches = [
    { n: `${data.name} · Centro`, v: 87 * t, o: 87 },
    { n: `${data.name} · Providencia`, v: 64 * t, o: 64 },
    { n: `${data.name} · Ñuñoa`, v: 52 * t, o: 52 },
  ];
  const total = branches.reduce((s, b) => s + b.v, 0);
  return (
    <Shell data={data} title="Todas las sucursales · hoy">
      <div style={{ flex: 1, display: "grid", gridTemplateRows: "auto 1fr", gap: 10, minHeight: 0 }}>
        <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div><div style={kpiLabel}>Ventas totales</div><div style={{ fontSize: 24, fontWeight: 800, marginTop: 2 }}><CountUp value={total} run /></div></div>
          <div style={{ textAlign: "right" }}><div style={kpiLabel}>Pedidos</div><div style={{ fontSize: 24, fontWeight: 800, marginTop: 2 }}><CountUp value={203} run money={false} /></div></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {branches.map((b, i) => (
            <motion.div key={b.n} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.15, duration: 0.6, ease: EASE }} style={{ ...card, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ width: 28, height: 28, borderRadius: 9, background: rgba(c, 0.14), color: c, display: "grid", placeItems: "center", fontWeight: 800 }}>{i + 1}</div>
                <div style={{ fontWeight: 800, marginTop: 8, lineHeight: 1.25 }}>{b.n}</div>
                <div style={{ color: "#16a34a", fontWeight: 700, fontSize: 10, marginTop: 2 }}>● Caja abierta</div>
              </div>
              <div>
                <div style={{ fontFamily: "var(--demo-mono)", fontWeight: 700, fontSize: 15, marginTop: 10 }}>{clp(b.v)}</div>
                <div style={{ height: 5, background: "#f1efea", borderRadius: 3, marginTop: 6 }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(b.v / branches[0].v) * 100}%` }} transition={{ duration: 1, ease: EASE, delay: 0.5 + i * 0.1 }} style={{ height: "100%", borderRadius: 3, background: c }} />
                </div>
                <div style={{ color: "#999", fontSize: 10, marginTop: 4 }}>{b.o} pedidos</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </Shell>
  );
}
