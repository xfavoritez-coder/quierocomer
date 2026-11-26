"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { QrCode, Heart, ShoppingBag, MonitorSmartphone } from "lucide-react";
import type { ChapterProps } from "../DemoShell";
import { BrandText, EASE, LocalLogo, Reveal, Stage, lighten, rgba } from "../ui";

const MODULES = [
  { icon: QrCode, title: "Carta QR", sub: "que vende sola" },
  { icon: Heart, title: "Fidelización", sub: "clientes que vuelven" },
  { icon: ShoppingBag, title: "Tienda online", sub: "sin comisiones" },
  { icon: MonitorSmartphone, title: "POS", sub: "todo en una pantalla" },
];

export default function Intro({ data, step }: ChapterProps) {
  const reduce = useReducedMotion();
  const c = data.color;
  const accent = lighten(c, 0.35);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {/* Halo del color del local */}
      <motion.div aria-hidden
        animate={reduce ? {} : { scale: [1, 1.12, 1], opacity: [0.55, 0.8, 0.55] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        style={{ position: "absolute", left: "50%", top: step === 0 ? "42%" : "30%", width: "90vmax", height: "90vmax", transform: "translate(-50%, -50%)", borderRadius: "50%", background: `radial-gradient(circle, ${rgba(c, 0.55)} 0%, ${rgba(c, 0.12)} 35%, transparent 62%)`, filter: "blur(20px)", transition: "top 1.2s cubic-bezier(.22,1,.36,1)" }} />
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 120%, rgba(255,255,255,.06), transparent 60%)" }} />

      <Stage style={{ flexDirection: "column", textAlign: "center" }}>
        <motion.div layout initial={false} animate={{ scale: step === 0 ? 1 : 0.72 }} transition={{ duration: 1.1, ease: EASE }} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <motion.div initial={reduce ? false : { opacity: 0, scale: 0.6, filter: "blur(20px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} transition={{ duration: 1.4, ease: EASE, delay: 0.15 }}
            style={{ borderRadius: 40, boxShadow: `0 0 0 1px rgba(255,255,255,.12), 0 30px 120px -10px ${rgba(c, 0.9)}` }}>
            <LocalLogo data={data} size={148} radius={40} />
          </motion.div>
          <motion.h1 initial={reduce ? false : { opacity: 0, y: 30, letterSpacing: "0.02em" }} animate={{ opacity: 1, y: 0, letterSpacing: "-0.05em" }} transition={{ duration: 1.4, ease: EASE, delay: 0.45 }}
            style={{ fontSize: "clamp(52px, 9vw, 136px)", fontWeight: 800, lineHeight: 0.95, margin: "34px 0 0", color: "#fff" }}>
            {data.name}
          </motion.h1>
          {(data.cuisine || data.commune) && (
            <motion.div initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 1 }} style={{ marginTop: 18, fontSize: "clamp(16px, 1.6vw, 22px)", color: "rgba(255,255,255,.55)", fontWeight: 500 }}>
              {[data.cuisine, data.commune].filter(Boolean).join(" · ")}
            </motion.div>
          )}
        </motion.div>

        <AnimatePresence>
        {step >= 1 && (
        <motion.div key="modules" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
        <Reveal step={step} at={1} style={{ marginTop: "clamp(8px, 2vh, 24px)" }}>
          <div style={{ fontSize: "clamp(22px, 2.6vw, 40px)", fontWeight: 650, letterSpacing: "-0.03em", color: "rgba(255,255,255,.92)" }}>
            Esto es <BrandText color={accent}>{data.name}</BrandText> con QuieroComer.
          </div>
        </Reveal>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 42vw), 1fr))", gap: 14, width: "min(1040px, 100%)", marginTop: "clamp(22px, 4vh, 46px)" }}>
          {MODULES.map((m, i) => (
            <Reveal key={m.title} step={step} at={1} delay={0.25 + i * 0.12}>
              <div style={{ borderRadius: 24, padding: "22px 20px", textAlign: "left", background: "linear-gradient(160deg, rgba(255,255,255,.09), rgba(255,255,255,.03))", border: "1px solid rgba(255,255,255,.1)", backdropFilter: "blur(20px)" }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, display: "grid", placeItems: "center", background: rgba(c, 0.22), color: accent }}><m.icon size={22} /></div>
                <div style={{ marginTop: 16, fontSize: 20, fontWeight: 700, letterSpacing: "-.02em", color: "#fff" }}>{m.title}</div>
                <div style={{ fontSize: 15, color: "rgba(255,255,255,.55)", marginTop: 2 }}>{m.sub}</div>
              </div>
            </Reveal>
          ))}
        </div>
        </motion.div>
        )}
        </AnimatePresence>
      </Stage>
    </div>
  );
}
