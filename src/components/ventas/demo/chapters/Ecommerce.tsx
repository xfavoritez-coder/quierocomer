"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Bike, Store, Check, Globe, Users, Wallet, MapPin, Package } from "lucide-react";
import type { ChapterProps } from "../DemoShell";
import type { DemoData } from "../types";
import { LaptopFrame, PhoneFrame, TabletFrame } from "../frames";
import { BrandText, DishImage, EASE, Eyebrow, Headline, LocalLogo, QrPill, Reveal, Stage, clp, featuredDishes, onColor, rgba, useViewport } from "../ui";
import { PosRecovery } from "./Pos";
import OrdersInbox, { sampleOrders } from "./OrdersInbox";

export const ecommerceSteps = 6;

/** Cada paso entra con una transición corta (fundido, leve zoom y desenfoque). */
export default function Ecommerce(props: ChapterProps) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={props.step} style={{ position: "absolute", inset: 0 }}
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 24, filter: "blur(10px)" }}
        animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.02, y: -16, filter: "blur(10px)" }}
        transition={{ duration: 0.45, ease: EASE }}>
        <EcommerceStep {...props} />
      </motion.div>
    </AnimatePresence>
  );
}

function EcommerceStep({ data, step, live, onQr }: ChapterProps) {
  const { narrow, w } = useViewport();
  const c = data.color;
  const liveOrders = [...(live?.orders ?? [])].reverse();
  const [now] = useState(() => Date.now());
  const [samples] = useState(() => sampleOrders(data, now));

  if (step === 0) {
    return (
      <Stage style={{ flexDirection: "column", textAlign: "center" }}>
        <Reveal step={step} at={0}><Eyebrow color={c}>Tienda online</Eyebrow></Reveal>
        <Reveal step={step} at={0} delay={0.15}><Headline style={{ marginTop: 18 }}>Tu propia tienda<br />de pedidos.</Headline></Reveal>
        <Reveal step={step} at={0} delay={0.5}><Headline style={{ marginTop: 6 }}><BrandText color={c}>Sin comisiones.</BrandText></Headline></Reveal>
      </Stage>
    );
  }

  // ── 1 · La tienda (y el pedido de prueba, que llega al POS) ──
  if (step === 1) {
    const got = liveOrders.length > 0;
    const laptopW = Math.min(narrow ? w - 40 : 740, 740);
    return (
      <Stage style={{ flexDirection: "column", gap: 22 }}>
        <div style={{ textAlign: "center" }}>
          <Reveal step={step} at={1}><Eyebrow color={c}>{data.slug ? `quierocomer.com/${data.slug}` : "Tu tienda online"}</Eyebrow></Reveal>
          <AnimatePresence mode="wait">
            <motion.div key={got ? "got" : "store"} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.5, ease: EASE }}>
              <Headline size="md" style={{ marginTop: 10 }}>{got ? <>¡Llegó tu pedido! <BrandText color={c}>Directo a tu POS.</BrandText></> : <>Tu tienda, con <BrandText color={c}>tu marca.</BrandText></>}</Headline>
            </motion.div>
          </AnimatePresence>
        </div>
        <AnimatePresence mode="wait">
          {got ? (
            <motion.div key="inbox" initial={{ opacity: 0, scale: 0.94, filter: "blur(10px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} exit={{ opacity: 0 }} transition={{ duration: 0.8, ease: EASE }}>
              <TabletFrame width={Math.min(narrow ? w - 40 : 780, 780)}><OrdersInbox key={liveOrders.length} data={data} orders={liveOrders} highlightId={liveOrders[0]?.id} /></TabletFrame>
            </motion.div>
          ) : (
            <motion.div key="store" exit={{ opacity: 0, scale: 0.97, filter: "blur(8px)" }} transition={{ duration: 0.5 }} style={{ position: "relative" }}>
              <Reveal step={step} at={1} y={60} delay={0.2}><LaptopFrame width={laptopW}><StoreDesktop data={data} /></LaptopFrame></Reveal>
              {!narrow && (
                <Reveal step={step} at={1} y={80} delay={0.45} style={{ position: "absolute", right: -80, bottom: -24 }}>
                  <PhoneFrame width={180}><StorePhone data={data} /></PhoneFrame>
                </Reveal>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {!got && data.slug && <QrPill label="Haz tu pedido de prueba: escanea el QR" color={c} onClick={onQr} delay={1.2} style={{ marginTop: 6 }} />}
      </Stage>
    );
  }

  // ── 2 · Sin comisiones ──
  if (step === 2) {
    const items = [
      { icon: Globe, t: "Tu sitio de pedidos", s: "Con tu nombre, tus fotos y tus colores. Lo compartes en Instagram, WhatsApp y Google." },
      { icon: Users, t: "Tus clientes son tuyos", s: "Sabes quién te pide, qué pide y cuándo. Puedes volver a hablarle cuando quieras." },
      { icon: Wallet, t: "La plata, directo a ti", s: "Pagos online o al retirar. Sin intermediarios que se queden con una parte." },
    ];
    return (
      <Stage style={{ flexDirection: "column", textAlign: "center" }}>
        <Reveal step={step} at={2}><Eyebrow color={c}>Sin comisiones</Eyebrow></Reveal>
        <Reveal step={step} at={2} delay={0.1}>
          <div style={{ fontSize: "clamp(90px, 15vw, 210px)", fontWeight: 800, letterSpacing: "-.06em", lineHeight: 0.95, marginTop: 6 }}><BrandText color={c}>0%</BrandText></div>
        </Reveal>
        <Reveal step={step} at={2} delay={0.3}><Headline size="md" style={{ marginTop: 4 }}>de comisión por pedido. <span style={{ color: "rgba(0,0,0,.35)" }}>Siempre.</span></Headline></Reveal>
        <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 14, marginTop: "clamp(24px, 4vh, 44px)", width: "min(1060px, 100%)", textAlign: "left" }}>
          {items.map((it, i) => (
            <Reveal key={it.t} step={step} at={2} delay={0.55 + i * 0.15}>
              <div style={{ height: "100%", boxSizing: "border-box", padding: "22px 22px", borderRadius: 24, background: "#fff", boxShadow: "0 0 0 1px rgba(0,0,0,.06), 0 20px 50px -30px rgba(0,0,0,.3)" }}>
                <div style={{ width: 42, height: 42, borderRadius: 14, display: "grid", placeItems: "center", background: rgba(c, 0.12), color: c }}><it.icon size={20} /></div>
                <div style={{ fontSize: 19, fontWeight: 750, letterSpacing: "-.02em", marginTop: 14 }}>{it.t}</div>
                <div style={{ fontSize: 15, color: "rgba(0,0,0,.55)", marginTop: 6, lineHeight: 1.45 }}>{it.s}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </Stage>
    );
  }

  // ── 4 · Despacho ──
  if (step === 4) {
    return (
      <Stage style={{ gap: "clamp(28px, 5vw, 90px)", flexDirection: narrow ? "column" : "row" }}>
        <div style={{ flex: "1 1 0", maxWidth: 500, minWidth: 0 }}>
          <Reveal step={step} at={4}><Eyebrow color={c}>Despacho</Eyebrow></Reveal>
          <Reveal step={step} at={4} delay={0.1}><Headline size="lg" style={{ marginTop: 14 }}>¿Delivery sin repartidores?<br /><BrandText color={c}>Resuelto.</BrandText></Headline></Reveal>
          <Reveal step={step} at={4} delay={0.3}>
            <div style={{ fontSize: "clamp(16px, 1.4vw, 20px)", color: "rgba(0,0,0,.55)", marginTop: 20, lineHeight: 1.5 }}>
              Tu tienda está integrada con <b style={{ color: "#111" }}>una red de motoristas que cubre todo Santiago</b>. Entra un pedido, se asigna un motorista, lo retira en tu local y se lo entrega a tu cliente. Tú sigues cada paso en tu POS.
            </div>
          </Reveal>
        </div>
        <Reveal step={step} at={4} y={50} delay={0.25}><DeliveryMap data={data} narrow={narrow} /></Reveal>
      </Stage>
    );
  }

  // ── 5 · Recuperación de clientes ──
  if (step >= 5) {
    return (
      <Stage style={{ flexDirection: narrow ? "column" : "row", gap: "clamp(24px, 4vw, 64px)" }}>
        <div style={{ flex: "0 1 400px", minWidth: 0 }}>
          <Reveal step={step} at={5}><Eyebrow color={c}>Recuperación de clientes</Eyebrow></Reveal>
          <Reveal step={step} at={5} delay={0.1}><Headline size="md" style={{ marginTop: 14 }}>El cliente que dejó de pedir,<br /><BrandText color={c}>vuelve.</BrandText></Headline></Reveal>
          <Reveal step={step} at={5} delay={0.25}>
            <div style={{ fontSize: "clamp(15px, 1.3vw, 18px)", color: "rgba(0,0,0,.55)", marginTop: 16, lineHeight: 1.5 }}>
              Detectamos a quien dejó de pedirte en tu tienda, le preguntamos por qué y le enviamos un cupón automático. Tú solo ves cómo regresan.
            </div>
          </Reveal>
        </div>
        <Reveal step={step} at={5} y={60} delay={0.2}>
          <TabletFrame width={Math.min(narrow ? w - 40 : 740, 740)}><PosRecovery data={data} /></TabletFrame>
        </Reveal>
      </Stage>
    );
  }

  // ── 3 · Todo llega al POS ──
  const orders = liveOrders.length ? [...liveOrders, ...samples] : samples;
  return (
    <Stage style={{ flexDirection: "column", gap: 22 }}>
      <div style={{ textAlign: "center" }}>
        <Reveal step={step} at={3}><Eyebrow color={c}>Pedidos</Eyebrow></Reveal>
        <Reveal step={step} at={3} delay={0.1}><Headline size="md" style={{ marginTop: 10 }}>Cada pedido, <BrandText color={c}>directo a tu POS.</BrandText></Headline></Reveal>
        <Reveal step={step} at={3} delay={0.2}><div style={{ fontSize: 16, color: "rgba(0,0,0,.5)", marginTop: 8 }}>Tócalos: ves el cliente, el detalle y lo avanzas a cocina.</div></Reveal>
      </div>
      <Reveal step={step} at={3} y={60} delay={0.3}>
        <TabletFrame width={Math.min(narrow ? w - 40 : 780, 780)}><OrdersInbox data={data} orders={orders} highlightId={liveOrders[0]?.id ?? null} /></TabletFrame>
      </Reveal>
    </Stage>
  );
}

// ── Tienda (diseño Modern) ─────────────────────────────────────────────────
function StoreDesktop({ data }: { data: DemoData }) {
  const c = data.color;
  const dishes = featuredDishes(data, 6);
  const hero = dishes[0];
  return (
    <div style={{ position: "absolute", inset: 0, fontSize: 11, color: "#1c1917", background: "#f5f3ee", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 4%", flexShrink: 0 }}>
        <LocalLogo data={data} size={28} />
        <b style={{ fontSize: 13, letterSpacing: "-.02em" }}>{data.name}</b>
        <div style={{ flex: 1 }} />
        <span style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 10, color: "#78716c" }}><Bike size={12} /> Delivery</span>
        <span style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 10, color: "#78716c" }}><Store size={12} /> Retiro</span>
        <span style={{ padding: "5px 10px", borderRadius: 99, background: "#1c1917", color: "#fff", fontWeight: 700, fontSize: 10 }}>Carrito · 0</span>
      </div>
      <div style={{ margin: "0 4%", height: "40%", borderRadius: 16, overflow: "hidden", position: "relative", flexShrink: 0, background: data.bannerUrl ? `center/cover url(${data.bannerUrl})` : `linear-gradient(120deg, ${c}, ${rgba(c, 0.6)})` }}>
        {!data.bannerUrl && hero?.photo && <div style={{ position: "absolute", inset: 0 }}><DishImage dish={hero} color={c} radius={0} /></div>}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(0,0,0,.6), transparent 70%)" }} />
        <div style={{ position: "absolute", left: "5%", top: "50%", transform: "translateY(-50%)", color: "#fff", maxWidth: "55%" }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1.05, fontFamily: "Georgia, serif" }}>Pide directo a {data.name}</div>
          <div style={{ marginTop: 8, display: "inline-block", padding: "6px 12px", borderRadius: 99, background: c, color: onColor(c), fontWeight: 800, fontSize: 10 }}>Ver la carta</div>
        </div>
      </div>
      <div style={{ padding: "10px 4% 4px", display: "flex", gap: 14, fontWeight: 700, fontSize: 11, color: "#a8a29e", flexShrink: 0 }}>
        {data.categories.slice(0, 6).map((x, i) => <span key={x.name} style={{ color: i === 0 ? "#1c1917" : undefined, borderBottom: i === 0 ? `2px solid ${c}` : "none", paddingBottom: 3 }}>{x.name}</span>)}
      </div>
      <div style={{ flex: 1, padding: "8px 4% 12px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, overflow: "hidden" }}>
        {dishes.slice(0, 6).map((d, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", background: "#fff", borderRadius: 12, padding: 7 }}>
            <div style={{ width: 46, height: 46, flexShrink: 0 }}><DishImage dish={d} color={c} radius={9} /></div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 10.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</div>
              <div style={{ fontFamily: "var(--demo-mono)", fontWeight: 700, fontSize: 10, marginTop: 3 }}>{d.price > 0 ? clp(d.price) : ""}</div>
            </div>
            <span style={{ width: 20, height: 20, borderRadius: 99, background: "#1c1917", color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, flexShrink: 0 }}>+</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StorePhone({ data }: { data: DemoData }) {
  const c = data.color;
  const d = featuredDishes(data, 1)[0];
  return (
    <div style={{ position: "absolute", inset: 0, background: "#f5f3ee", fontSize: 10, display: "flex", flexDirection: "column" }}>
      <div style={{ height: "46%", flexShrink: 0 }}>{d && <DishImage dish={d} color={c} radius={0} />}</div>
      <div style={{ padding: "12px 12px", flex: 1, minHeight: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 13 }}>{d?.name}</div>
        <div style={{ color: "#78716c", marginTop: 3, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{d?.description || "Preparado al momento"}</div>
        <div style={{ fontFamily: "var(--demo-mono)", fontWeight: 700, fontSize: 13, marginTop: 8 }}>{d && d.price > 0 ? clp(d.price) : ""}</div>
      </div>
      <div style={{ padding: "8px 10px 16px" }}>
        <div style={{ borderRadius: 99, padding: "10px 0", textAlign: "center", fontWeight: 800, color: onColor(c), background: c, fontSize: 11 }}>Agregar al pedido</div>
      </div>
    </div>
  );
}

// ── Mapa del despacho ──────────────────────────────────────────────────────
const TIMELINE = [
  { icon: Check, t: "Pedido confirmado" },
  { icon: Bike, t: "Motorista asignado" },
  { icon: Package, t: "Retiró en tu local" },
  { icon: MapPin, t: "Entregado a tu cliente" },
];

function DeliveryMap({ data, narrow }: { data: DemoData; narrow: boolean }) {
  const reduce = useReducedMotion();
  const c = data.color;
  const [k, setK] = useState(reduce ? TIMELINE.length - 1 : 0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setK((x) => (x >= TIMELINE.length - 1 ? x : x + 1)), 1500);
    return () => clearInterval(t);
  }, [reduce]);
  const W = narrow ? 320 : 460, H = narrow ? 260 : 330;
  const path = `M ${W * 0.16} ${H * 0.72} C ${W * 0.3} ${H * 0.3}, ${W * 0.55} ${H * 0.85}, ${W * 0.84} ${H * 0.26}`;
  const progress = k <= 1 ? 0 : k === 2 ? 0.5 : 1;
  return (
    <div style={{ width: W, borderRadius: 28, overflow: "hidden", background: "#fff", boxShadow: "0 0 0 1px rgba(0,0,0,.06), 0 40px 90px -30px rgba(0,0,0,.4)" }}>
      <div style={{ position: "relative", height: H, background: "#eef1f4" }}>
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          {Array.from({ length: 9 }).map((_, i) => <line key={`h${i}`} x1={0} y1={(H / 8) * i + 6} x2={W} y2={(H / 8) * i - 10} stroke="#fff" strokeWidth={i % 3 ? 5 : 10} />)}
          {Array.from({ length: 9 }).map((_, i) => <line key={`v${i}`} x1={(W / 8) * i} y1={0} x2={(W / 8) * i + 24} y2={H} stroke="#fff" strokeWidth={i % 3 ? 5 : 10} />)}
          <path d={path} fill="none" stroke={rgba(c, 0.25)} strokeWidth={7} strokeLinecap="round" />
          <motion.path d={path} fill="none" stroke={c} strokeWidth={7} strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: progress }} transition={{ duration: 1.4, ease: EASE }} />
        </svg>
        <Pin x={W * 0.16} y={H * 0.72} color={c} label="Tu local"><Store size={16} /></Pin>
        <Pin x={W * 0.84} y={H * 0.26} color="#111" label="Cliente"><MapPin size={16} /></Pin>
        <motion.div initial={false} animate={{ offsetDistance: `${progress * 100}%` }} transition={{ duration: 1.4, ease: EASE }}
          style={{ position: "absolute", left: 0, top: 0, offsetPath: `path("${path}")`, offsetRotate: "0deg", width: 34, height: 34, marginLeft: -17, marginTop: -17, borderRadius: 99, background: "#fff", color: c, display: "grid", placeItems: "center", boxShadow: "0 8px 20px -6px rgba(0,0,0,.4)", opacity: k >= 1 ? 1 : 0, transition: "opacity .4s" } as React.CSSProperties}>
          <Bike size={18} />
        </motion.div>
      </div>
      <div style={{ padding: "16px 18px", display: "grid", gap: 10 }}>
        {TIMELINE.map((s, i) => (
          <motion.div key={s.t} initial={false} animate={{ opacity: i <= k ? 1 : 0.35 }} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14.5, fontWeight: i === k ? 750 : 550 }}>
            <motion.span initial={false} animate={{ background: i <= k ? c : "#eee", color: i <= k ? onColor(c) : "#999" }} style={{ width: 26, height: 26, borderRadius: 99, display: "grid", placeItems: "center", flexShrink: 0 }}><s.icon size={14} /></motion.span>
            {s.t}
            {i === k && i < TIMELINE.length - 1 && <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1 }} style={{ marginLeft: "auto", fontSize: 12, color: c, fontWeight: 700 }}>ahora</motion.span>}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Pin({ x, y, color, label, children }: { x: number; y: number; color: string; label: string; children: React.ReactNode }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{ width: 36, height: 36, borderRadius: 12, background: color, color: onColor(color), display: "grid", placeItems: "center", boxShadow: "0 8px 18px -6px rgba(0,0,0,.4)" }}>{children}</div>
      <span style={{ fontSize: 11, fontWeight: 800, background: "#fff", padding: "2px 8px", borderRadius: 99 }}>{label}</span>
    </div>
  );
}

