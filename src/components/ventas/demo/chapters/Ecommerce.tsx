"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { BellRing, Bike, Store, Check, Printer } from "lucide-react";
import type { ChapterProps } from "../DemoShell";
import type { DemoData } from "../types";
import { DEFAULT_APP_COMMISSION } from "../types";
import { LaptopFrame, PhoneFrame } from "../frames";
import { BrandText, CountUp, DishImage, EASE, Eyebrow, Headline, LocalLogo, Reveal, Stage, TryItHint, clp, featuredDishes, onColor, rgba, useViewport } from "../ui";

const SALES_OPTIONS = [1_000_000, 3_000_000, 5_000_000, 10_000_000];

export default function Ecommerce({ data, step }: ChapterProps) {
  const { narrow, w } = useViewport();
  const c = data.color;
  const [sales, setSales] = useState(3_000_000);
  const commission = Math.round(sales * DEFAULT_APP_COMMISSION);
  const PLAN_PRICE = data.storePlan?.price ?? 0; // plan de tienda desde /admin/planes
  const saving = Math.max(0, commission - PLAN_PRICE);

  if (step === 0) {
    return (
      <Stage style={{ flexDirection: "column", textAlign: "center" }}>
        <Reveal step={step} at={0}><Eyebrow color={c}>Tienda online</Eyebrow></Reveal>
        <Reveal step={step} at={0} delay={0.15}><Headline style={{ marginTop: 18 }}>Tu propia tienda<br />de pedidos.</Headline></Reveal>
        <Reveal step={step} at={0} delay={0.5}><Headline style={{ color: "rgba(0,0,0,.28)", marginTop: 6 }}>Sin pagar 25–30% de comisión.</Headline></Reveal>
      </Stage>
    );
  }

  if (step === 3) {
    return (
      <Stage style={{ flexDirection: "column", textAlign: "center" }}>
        <Reveal step={step} at={3}><Eyebrow color={c}>Calculadora de comisiones</Eyebrow></Reveal>
        <Reveal step={step} at={3} delay={0.1}><div style={{ fontSize: "clamp(18px, 1.8vw, 24px)", color: "rgba(0,0,0,.6)", marginTop: 18 }}>Si vendes al mes por apps de delivery</div></Reveal>
        <Reveal step={step} at={3} delay={0.2}>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 16 }}>
            {SALES_OPTIONS.map((v) => (
              <button key={v} onClick={(e) => { e.stopPropagation(); setSales(v); }} style={{
                font: "inherit", fontFamily: "var(--demo-mono)", fontSize: "clamp(15px, 1.5vw, 20px)", fontWeight: 600, padding: "11px 20px", borderRadius: 99, cursor: "pointer",
                border: v === sales ? `2px solid ${c}` : "2px solid rgba(0,0,0,.08)", background: v === sales ? rgba(c, 0.1) : "#fff", color: v === sales ? c : "#333",
              }}>{clp(v)}</button>
            ))}
          </div>
        </Reveal>
        <Reveal step={step} at={3} delay={0.35}>
          <div style={{ display: "flex", gap: "clamp(16px, 4vw, 64px)", justifyContent: "center", alignItems: "flex-end", marginTop: 36, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 15, color: "rgba(0,0,0,.45)", fontWeight: 600 }}>Hoy pagas en comisiones ({Math.round(DEFAULT_APP_COMMISSION * 100)}%)</div>
              <div style={{ fontSize: "clamp(32px, 3.6vw, 54px)", fontWeight: 700, letterSpacing: "-.04em", color: "#C0392B", textDecoration: "line-through", textDecorationThickness: 3 }}><CountUp key={sales} value={commission} run /></div>
            </div>
            <div>
              <div style={{ fontSize: 15, color: "rgba(0,0,0,.45)", fontWeight: 600 }}>Con tu tienda QuieroComer{data.storePlan ? ` · ${data.storePlan.name}` : ""}</div>
              <div style={{ fontSize: "clamp(32px, 3.6vw, 54px)", fontWeight: 700, letterSpacing: "-.04em" }}>{clp(PLAN_PRICE)} <span style={{ fontSize: "0.4em", color: "rgba(0,0,0,.45)" }}>/ mes</span></div>
            </div>
          </div>
        </Reveal>
        <Reveal step={step} at={3} delay={0.6} style={{ marginTop: 34 }}>
          <div style={{ fontSize: 16, color: "rgba(0,0,0,.5)", fontWeight: 600 }}>Ahorras</div>
          <div style={{ fontSize: "clamp(60px, 9vw, 140px)", fontWeight: 800, letterSpacing: "-.055em", lineHeight: 1 }}><BrandText color={c}><CountUp key={`s${sales}`} value={saving} run duration={1.8} /></BrandText></div>
          <div style={{ fontSize: 17, color: "rgba(0,0,0,.5)", marginTop: 6 }}>al mes · <b style={{ color: "#111", fontFamily: "var(--demo-mono)" }}>{clp(saving * 12)}</b> al año</div>
        </Reveal>
      </Stage>
    );
  }

  const laptopW = Math.min(narrow ? w - 40 : 760, 760);
  return (
    <>
    <TryItHint show={step === 2 && !!data.slug && !narrow} color={c} text="Haz un pedido de prueba desde tu celular" />
    <Stage style={{ flexDirection: "column", gap: 26 }}>
      <div style={{ textAlign: "center" }}>
        <Reveal step={step} at={1}><Eyebrow color={c}>{data.slug ? `quierocomer.com/${data.slug}` : "Tu tienda online"}</Eyebrow></Reveal>
        <Reveal step={step} at={1} delay={0.1}>
          <Headline size="md" style={{ marginTop: 10 }}>
            {step === 1 ? <>Tu tienda, con <BrandText color={c}>tu marca.</BrandText></> : <>Pidieron. <BrandText color={c}>Ya está en tu cocina.</BrandText></>}
          </Headline>
        </Reveal>
      </div>
      <div style={{ position: "relative" }}>
        <Reveal step={step} at={1} y={60} delay={0.2}>
          <LaptopFrame width={laptopW}><StoreDesktop data={data} /></LaptopFrame>
        </Reveal>
        {!narrow && (
          <Reveal step={step} at={1} y={80} delay={0.45} style={{ position: "absolute", right: -70, bottom: -30 }}>
            <PhoneFrame width={190}><StorePhone data={data} ordering={step === 2} /></PhoneFrame>
          </Reveal>
        )}
        <AnimatePresence>
          {step === 2 && (
            <motion.div key="order" initial={{ opacity: 0, y: -30, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.7, ease: EASE, delay: narrow ? 0.3 : 2.2 }}
              style={{ position: "absolute", top: narrow ? -10 : 40, left: narrow ? 10 : -230, width: 280, zIndex: 3, borderRadius: 20, padding: "14px 16px", background: "#111", color: "#fff", boxShadow: "0 30px 70px -20px rgba(0,0,0,.6)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.1 }} style={{ width: 38, height: 38, borderRadius: 12, background: c, color: onColor(c), display: "grid", placeItems: "center" }}><BellRing size={19} /></motion.div>
                <div><div style={{ fontWeight: 800 }}>Nuevo pedido #128</div><div style={{ fontSize: 12, color: "rgba(255,255,255,.6)" }}>Delivery · pagado online</div></div>
              </div>
              <div style={{ marginTop: 10, fontSize: 13, color: "rgba(255,255,255,.85)" }}>
                {featuredDishes(data, 2).map((d) => <div key={d.name} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>1× {d.name}</span><span style={{ fontFamily: "var(--demo-mono)" }}>{clp(d.price)}</span></div>)}
              </div>
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(255,255,255,.6)" }}><Printer size={14} /> Imprimiendo comanda…</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Stage>
    </>
  );
}

function StoreDesktop({ data }: { data: DemoData }) {
  const c = data.color;
  const dishes = featuredDishes(data, 8);
  return (
    <div style={{ position: "absolute", inset: 0, fontSize: 11, color: "#111", background: "#fafafa", display: "flex", flexDirection: "column" }}>
      <div style={{ height: "34%", position: "relative", flexShrink: 0, background: data.bannerUrl ? `center/cover url(${data.bannerUrl})` : `linear-gradient(120deg, ${c}, ${rgba(c, 0.65)})` }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.05), rgba(0,0,0,.55))" }} />
        <div style={{ position: "absolute", left: "4%", bottom: "12%", display: "flex", gap: 12, alignItems: "center", color: "#fff" }}>
          <LocalLogo data={data} size={46} />
          <div><div style={{ fontWeight: 800, fontSize: 19, letterSpacing: "-.02em" }}>{data.name}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 4, fontSize: 10.5, opacity: 0.9 }}><span style={{ display: "flex", gap: 3, alignItems: "center" }}><Bike size={12} /> Delivery 30–40 min</span><span style={{ display: "flex", gap: 3, alignItems: "center" }}><Store size={12} /> Retiro</span></div>
          </div>
        </div>
      </div>
      <div style={{ padding: "12px 4%", display: "flex", gap: 14, fontWeight: 700, fontSize: 11, color: "#777", borderBottom: "1px solid #eee", background: "#fff" }}>
        {data.categories.slice(0, 6).map((x, i) => <span key={x.name} style={{ color: i === 0 ? c : undefined }}>{x.name}</span>)}
      </div>
      <div style={{ flex: 1, padding: "12px 4%", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, overflow: "hidden" }}>
        {dishes.map((d, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 10, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,.05)" }}>
            <div style={{ height: 62 }}><DishImage dish={d} color={c} radius={0} /></div>
            <div style={{ padding: "6px 8px" }}>
              <div style={{ fontWeight: 700, fontSize: 10, lineHeight: 1.2, height: 24, overflow: "hidden" }}>{d.name}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 3 }}>
                <span style={{ fontFamily: "var(--demo-mono)", fontWeight: 700, fontSize: 10 }}>{d.price > 0 ? clp(d.price) : ""}</span>
                <span style={{ width: 18, height: 18, borderRadius: 6, background: c, color: onColor(c), display: "grid", placeItems: "center", fontWeight: 800 }}>+</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StorePhone({ data, ordering }: { data: DemoData; ordering: boolean }) {
  const c = data.color;
  const d = featuredDishes(data, 1)[0];
  return (
    <div style={{ position: "absolute", inset: 0, background: "#fff", fontSize: 10, display: "flex", flexDirection: "column" }}>
      <div style={{ height: 160, flexShrink: 0 }}>{d && <DishImage dish={d} color={c} radius={0} />}</div>
      <div style={{ padding: "12px 12px", flex: 1 }}>
        <div style={{ fontWeight: 800, fontSize: 13 }}>{d?.name}</div>
        <div style={{ color: "#888", marginTop: 3, lineHeight: 1.3 }}>{d?.description || "Preparado al momento"}</div>
        <div style={{ fontFamily: "var(--demo-mono)", fontWeight: 700, fontSize: 13, marginTop: 8 }}>{d && d.price > 0 ? clp(d.price) : ""}</div>
      </div>
      <div style={{ padding: 10 }}>
        <motion.div initial={false} animate={{ backgroundColor: ordering ? "#16a34a" : c }} transition={{ delay: ordering ? 1.4 : 0, duration: 0.4 }}
          style={{ borderRadius: 12, padding: "11px 0", textAlign: "center", fontWeight: 800, color: "#fff", fontSize: 11.5 }}>
          <AnimatePresence mode="wait">
            {ordering ? (
              <motion.span key="ok" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4 }} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Check size={14} /> Pedido enviado</motion.span>
            ) : (
              <motion.span key="add" exit={{ opacity: 0 }}>Agregar · {d && d.price > 0 ? clp(d.price) : ""}</motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
