"use client";

import { motion } from "framer-motion";
import { Check, Star, ArrowRight } from "lucide-react";
import type { ChapterProps } from "../DemoShell";
import type { DemoData, DemoPlan } from "../types";
import { BrandText, EASE, Eyebrow, Headline, LocalLogo, Reveal, Stage, clp, onColor, rgba, useViewport } from "../ui";

const MAX_FEATURES = 6;

/** Pasos del capítulo: uno por sección de /admin/planes + el cierre. */
export const planesSteps = (data: DemoData) => Math.max(1, data.plans.length) + 1;

export default function Planes({ data, step, onStart }: ChapterProps) {
  const { narrow } = useViewport();
  const c = data.color;
  const last = planesSteps(data) - 1;

  if (step >= last) {
    return (
      <Stage style={{ flexDirection: "column", textAlign: "center" }}>
        <Reveal step={1} at={1}><LocalLogo data={data} size={96} radius={28} /></Reveal>
        <Reveal step={1} at={1} delay={0.15}><Headline style={{ marginTop: 28 }}>{data.name},<br /><BrandText color={c}>a un paso de vender más.</BrandText></Headline></Reveal>
        <Reveal step={1} at={1} delay={0.4}>
          <div style={{ fontSize: "clamp(17px, 1.7vw, 22px)", color: "rgba(0,0,0,.5)", marginTop: 16 }}>
            {data.isFictional ? "Cargamos tu carta y lo dejamos funcionando por ti." : "Tu carta ya está cargada. Lo dejamos funcionando por ti."}
          </div>
        </Reveal>
        <Reveal step={1} at={1} delay={0.6}>
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={(e) => { e.stopPropagation(); onStart?.(); }}
            style={{ marginTop: 36, border: "none", cursor: "pointer", font: "inherit", fontSize: "clamp(20px, 2vw, 26px)", fontWeight: 750, letterSpacing: "-.02em", padding: "22px 52px", borderRadius: 99, background: c, color: onColor(c), display: "inline-flex", alignItems: "center", gap: 12, boxShadow: `0 24px 60px -16px ${rgba(c, 0.75)}` }}>
            Empezar <ArrowRight size={26} />
          </motion.button>
        </Reveal>
      </Stage>
    );
  }

  const section = data.plans[step];
  if (!section) {
    return (
      <Stage style={{ flexDirection: "column", textAlign: "center" }}>
        <Eyebrow color={c}>Planes</Eyebrow>
        <Headline size="md" style={{ marginTop: 12 }}>Aún no hay planes configurados.</Headline>
        <div style={{ color: "rgba(0,0,0,.5)", marginTop: 10, fontSize: 17 }}>Agrégalos en /admin/planes.</div>
      </Stage>
    );
  }

  const cols = Math.min(section.plans.length, narrow ? 1 : 4);
  return (
    <Stage style={{ flexDirection: "column" }}>
      <div style={{ textAlign: "center", maxWidth: 820 }}>
        <Reveal key={`h${step}`} step={0} at={0}><Eyebrow color={c}>Planes{data.plans.length > 1 ? ` · ${step + 1} de ${data.plans.length}` : ""}</Eyebrow></Reveal>
        <Reveal key={`t${step}`} step={0} at={0} delay={0.1}><Headline size={section.plans.length > 3 ? "md" : "lg"} style={{ marginTop: 12 }}>{section.title}</Headline></Reveal>
        {section.subtitle && <Reveal key={`s${step}`} step={0} at={0} delay={0.18}><div style={{ fontSize: "clamp(15px, 1.4vw, 19px)", color: "rgba(0,0,0,.5)", marginTop: 10 }}>{section.subtitle}</div></Reveal>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 14, width: `min(${cols >= 4 ? 1240 : 1080}px, 100%)`, marginTop: "clamp(22px, 3.5vh, 40px)", alignItems: "stretch", overflowY: narrow ? "auto" : "visible", maxHeight: narrow ? "62vh" : undefined }}>
        {section.plans.map((p, i) => (
          <Reveal key={`${step}-${p.id}`} step={0} at={0} delay={0.25 + i * 0.1} style={{ height: "100%" }}>
            <PlanCard plan={p} color={c} compact={narrow || cols >= 4} />
          </Reveal>
        ))}
      </div>
    </Stage>
  );
}

function PlanCard({ plan: p, color: c, compact }: { plan: DemoPlan; color: string; compact: boolean }) {
  const shown = p.features.slice(0, MAX_FEATURES);
  const hl = new Set(p.highlighted.map((f) => f.trim().toLowerCase()));
  const more = p.features.length - shown.length;
  return (
    <motion.div initial={false} animate={{ y: p.recommended && !compact ? -10 : 0 }} transition={{ duration: 0.8, ease: EASE }}
      style={{ height: "100%", boxSizing: "border-box", borderRadius: 26, padding: compact ? "22px 20px" : "30px 28px", background: "#fff", position: "relative", display: "flex", flexDirection: "column",
        boxShadow: p.recommended ? `0 0 0 2px ${c}, 0 30px 70px -24px ${rgba(c, 0.55)}` : "0 0 0 1px rgba(0,0,0,.07), 0 20px 50px -30px rgba(0,0,0,.25)" }}>
      {p.recommended && <div style={{ position: "absolute", top: -13, left: 22, fontSize: 12, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", padding: "5px 12px", borderRadius: 99, background: c, color: onColor(c) }}>Recomendado</div>}
      <div style={{ fontSize: compact ? 19 : 22, fontWeight: 750, letterSpacing: "-.02em" }}>{p.name}</div>
      <div style={{ marginTop: 12, display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
        {p.priceFrom && <span style={{ fontSize: 13, color: "rgba(0,0,0,.45)", fontWeight: 700 }}>Desde</span>}
        {p.regularPrice && <span style={{ fontFamily: "var(--demo-mono)", fontSize: 15, color: "rgba(0,0,0,.4)", textDecoration: "line-through" }}>{clp(p.regularPrice)}</span>}
        <span style={{ fontFamily: "var(--demo-mono)", fontSize: compact ? "clamp(26px, 2.2vw, 34px)" : "clamp(32px, 3vw, 44px)", fontWeight: 600, letterSpacing: "-.03em", color: p.recommended ? c : "#111" }}>{clp(p.price)}</span>
        <span style={{ fontSize: 14, color: "rgba(0,0,0,.45)" }}>/ mes</span>
      </div>
      {p.includes.length > 0 && <div style={{ fontSize: 13, color: c, fontWeight: 600, marginTop: 6 }}>Incluye: {p.includes.join(" · ")}</div>}
      {p.subtitle && <div style={{ fontSize: 13, color: "rgba(0,0,0,.45)", marginTop: 4 }}>{p.subtitle}</div>}
      <div style={{ height: 1, background: "rgba(0,0,0,.07)", margin: "16px 0 14px" }} />
      <div style={{ display: "grid", gap: 8 }}>
        {shown.map((f) => {
          const star = hl.has(f.trim().toLowerCase());
          return (
            <div key={f} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: compact ? 13.5 : 15, fontWeight: star ? 700 : 400, lineHeight: 1.35 }}>
              {star ? <Star size={16} color={c} fill={c} style={{ flexShrink: 0, marginTop: 2 }} /> : <Check size={16} color={c} strokeWidth={2.6} style={{ flexShrink: 0, marginTop: 2 }} />}
              <span>{f}</span>
            </div>
          );
        })}
        {more > 0 && <div style={{ fontSize: 13, color: "rgba(0,0,0,.45)", paddingLeft: 24 }}>+ {more} más</div>}
      </div>
    </motion.div>
  );
}
