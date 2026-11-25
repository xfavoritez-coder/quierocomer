"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Wifi, WifiOff, CheckCircle2 } from "lucide-react";
import type { ChapterProps } from "../DemoShell";
import type { DemoData } from "../types";
import { TabletFrame } from "../frames";
import { BrandText, CountUp, EASE, Eyebrow, Headline, LocalLogo, Reveal, Stage, avgTicket, clp, featuredDishes, lighten, onColor, rgba, useViewport } from "../ui";

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

  const titles: Record<number, React.ReactNode> = {
    1: <>Mesas, cuentas y cobros.<br /><BrandText color={accent}>Con tus platos ya cargados.</BrandText><div style={{ fontSize: "clamp(15px, 1.3vw, 18px)", fontWeight: 500, letterSpacing: 0, color: "rgba(255,255,255,.55)", marginTop: 16, lineHeight: 1.5 }}>Toca una mesa libre, agrega platos y cobra.</div></>,
    2: <>Se cae el wifi.<br /><BrandText color={accent}>Tú sigues vendiendo.</BrandText></>,
    3: <>Tu día,<br /><BrandText color={accent}>en números.</BrandText></>,
  };
  const tabletW = Math.min(narrow ? w - 40 : 800, 800);

  return (
    <Stage style={{ flexDirection: narrow ? "column" : "row", gap: "clamp(24px, 4vw, 70px)" }}>
      <div style={{ flex: "0 1 380px", minWidth: 0 }}>
        <Reveal step={step} at={1}><Eyebrow color={accent}>POS · {data.name}</Eyebrow></Reveal>
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, y: 14, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -10, filter: "blur(6px)" }} transition={{ duration: 0.6, ease: EASE }}>
            <Headline size="md" style={{ marginTop: 14, color: "#fff" }}>{titles[step]}</Headline>
            {step === 3 && (
              <div style={{ marginTop: 26 }}>
                <div style={{ fontSize: "clamp(46px, 5vw, 78px)", fontWeight: 750, letterSpacing: "-.045em", lineHeight: 1, color: accent }}><CountUp value={2} run money={false} />h</div>
                <div style={{ fontSize: 16, color: "rgba(255,255,255,.55)", marginTop: 4 }}>al día que ahorras cuadrando caja y armando informes</div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <Reveal step={step} at={1} y={70} delay={0.2}>
        <TabletFrame width={tabletW}>
          {step === 3 ? <PosDashboard data={data} /> : <PosRegister key={step === 2 ? "offline" : "online"} data={data} offline={step === 2} />}
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

function PosDashboard({ data }: { data: DemoData }) {
  const c = data.color;
  const ticket = avgTicket(data);
  const orders = 87;
  const top = featuredDishes(data, 5).map((d, i) => ({ name: d.name, qty: [34, 27, 21, 16, 12][i] }));
  const hours = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
  const load = [40, 95, 80, 30, 18, 22, 35, 60, 100, 88, 50, 20];

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", fontSize: 11, color: "#1a1a1a" }}>
      <PosTopBar data={data} offline={false} />
      <div style={{ flex: 1, padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "auto 1fr", gap: 10, minHeight: 0 }}>
        {[
          { l: "Ventas de hoy", v: <CountUp value={orders * ticket} run /> },
          { l: "Pedidos", v: <CountUp value={orders} run money={false} /> },
          { l: "Ticket promedio", v: <CountUp value={ticket} run /> },
        ].map((k) => (
          <div key={k.l} style={{ background: "#fff", borderRadius: 12, padding: "11px 12px" }}>
            <div style={{ color: "#999", fontSize: 10, fontWeight: 700 }}>{k.l}</div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-.03em", marginTop: 4 }}>{k.v}</div>
          </div>
        ))}
        <div style={{ gridColumn: "span 2", background: "#fff", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <b style={{ fontSize: 11.5 }}>Horas punta</b>
          <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 6, marginTop: 8 }}>
            {hours.map((h, i) => (
              <div key={h} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                <motion.div initial={{ height: 0 }} animate={{ height: `${load[i]}%` }} transition={{ duration: 1, ease: EASE, delay: 0.3 + i * 0.05 }}
                  style={{ width: "100%", borderRadius: 5, background: load[i] >= 80 ? c : rgba(c, 0.3) }} />
                <span style={{ fontSize: 8.5, color: "#999", fontFamily: "var(--demo-mono)" }}>{h}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: "#fff", borderRadius: 12, padding: 12 }}>
          <b style={{ fontSize: 11.5 }}>Más vendidos</b>
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {top.map((t, i) => (
              <div key={t.name}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 6, fontSize: 10 }}><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span><span style={{ fontFamily: "var(--demo-mono)", fontWeight: 700 }}>{t.qty}</span></div>
                <div style={{ height: 5, background: "#f1efea", borderRadius: 3, marginTop: 3 }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(t.qty / top[0].qty) * 100}%` }} transition={{ duration: 1, ease: EASE, delay: 0.5 + i * 0.1 }} style={{ height: "100%", borderRadius: 3, background: c }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
