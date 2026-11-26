"use client";

import { motion } from "framer-motion";
import { Check, Star, ArrowRight, Heart, ShoppingBag, QrCode, Bike, ChefHat, LayoutGrid, RefreshCcw, Receipt, Boxes, Sparkles, Puzzle, Truck, Store } from "lucide-react";
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

  if (section.id !== "__plans") return <ModulesStep data={data} step={step} sectionIndex={step} narrow={narrow} />;

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

// ── Módulos (add-ons): grilla compacta; la tienda online, por tramos de pedidos ──
const ICONS: [RegExp, typeof Heart][] = [
  [/loyal|fideliz|tarjeta/i, Heart], [/tienda|ecommerce|online/i, ShoppingBag], [/carta|qr/i, QrCode], [/apps? delivery|integraci/i, Truck],
  [/kds|cocina|pantalla/i, ChefHat], [/repartidor|motorist|flota/i, Bike], [/mesa|sal[oó]n/i, LayoutGrid], [/recupera/i, RefreshCcw],
  [/boleta|factura|electr[oó]nica/i, Receipt], [/inventario|bodega|stock/i, Boxes], [/genio|inteligen|ia\b/i, Sparkles], [/sucursal/i, Store],
];
function ModuleIcon({ name }: { name: string }) {
  const I = ICONS.find(([re]) => re.test(name))?.[1] ?? Puzzle;
  return <I size={19} />;
}

// "Hasta 100 pedidos", "Hasta 499 pedidos 49.900", "Mas de 500 pedidos 79.900"
const TIER_RE = /^\s*(hasta|m[aá]s de)\s+([\d.]+)\s+pedidos(?:\s*[:·-]?\s*\$?\s*([\d.]+))?\s*$/i;
function tiersOf(p: DemoPlan) {
  const tiers = p.features.map((f) => f.match(TIER_RE)).filter(Boolean).map((m) => ({
    label: `${/hasta/i.test(m![1]) ? "Hasta" : "Más de"} ${m![2]}`,
    price: m![3] ? Number(m![3].replace(/\./g, "")) : p.price,
  }));
  const rest = p.features.filter((f) => !TIER_RE.test(f));
  return { tiers, rest };
}

function ModulesStep({ data, step, sectionIndex, narrow }: { data: DemoData; step: number; sectionIndex: number; narrow: boolean }) {
  const c = data.color;
  const section = data.plans[sectionIndex];
  const tiered = section.plans.find((p) => tiersOf(p).tiers.length >= 2) ?? null;
  const others = section.plans.filter((p) => p !== tiered);
  const cols = narrow ? 1 : 4;
  return (
    <Stage style={{ flexDirection: "column", justifyContent: "center" }}>
      <div style={{ textAlign: "center", maxWidth: 820 }}>
        <Reveal key={`h${step}`} step={0} at={0}><Eyebrow color={c}>Planes · {step + 1} de {data.plans.length}</Eyebrow></Reveal>
        <Reveal key={`t${step}`} step={0} at={0} delay={0.1}><Headline size="md" style={{ marginTop: 10 }}>{section.title}</Headline></Reveal>
        <Reveal key={`s${step}`} step={0} at={0} delay={0.18}><div style={{ fontSize: "clamp(15px, 1.3vw, 18px)", color: "rgba(0,0,0,.5)", marginTop: 8 }}>{section.subtitle || "Módulos que se suman a tu plan cuando los necesites."}</div></Reveal>
      </div>
      <div style={{ width: "min(1180px, 100%)", marginTop: "clamp(18px, 3vh, 32px)", display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 12, overflowY: narrow ? "auto" : "visible", maxHeight: narrow ? "64vh" : undefined }}>
        {tiered && (
          <Reveal key={`${step}-tier`} step={0} at={0} delay={0.2} style={{ gridColumn: narrow ? "auto" : "span 2", gridRow: narrow ? "auto" : "span 2" }}>
            <TierCard plan={tiered} color={c} />
          </Reveal>
        )}
        {others.map((p, i) => (
          <Reveal key={`${step}-${p.id}`} step={0} at={0} delay={0.25 + i * 0.05}>
            <ModuleTile plan={p} color={c} />
          </Reveal>
        ))}
      </div>
    </Stage>
  );
}

function ModuleTile({ plan: p, color: c }: { plan: DemoPlan; color: string }) {
  const lines = p.features.slice(0, 3);
  return (
    <div style={{ height: "100%", boxSizing: "border-box", borderRadius: 22, padding: "16px 16px 15px", background: "#fff", display: "flex", flexDirection: "column", gap: 10,
      boxShadow: p.recommended ? `0 0 0 2px ${c}, 0 20px 50px -24px ${rgba(c, 0.55)}` : "0 0 0 1px rgba(0,0,0,.06), 0 16px 40px -30px rgba(0,0,0,.3)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: "grid", placeItems: "center", background: rgba(c, 0.12), color: c }}><ModuleIcon name={p.name} /></div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15.5, fontWeight: 750, letterSpacing: "-.02em", lineHeight: 1.2 }}>{p.name}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 2 }}>
            {p.priceFrom && <span style={{ fontSize: 11, color: "rgba(0,0,0,.45)", fontWeight: 700 }}>Desde</span>}
            <span style={{ fontFamily: "var(--demo-mono)", fontSize: 16, fontWeight: 700, color: c }}>{clp(p.price)}</span>
            <span style={{ fontSize: 11.5, color: "rgba(0,0,0,.45)" }}>/ mes</span>
          </div>
        </div>
      </div>
      {lines.length > 0 ? (
        <div style={{ display: "grid", gap: 5 }}>
          {lines.map((f) => <div key={f} style={{ display: "flex", gap: 6, fontSize: 12.5, color: "rgba(0,0,0,.62)", lineHeight: 1.3 }}><Check size={13} color={c} strokeWidth={2.8} style={{ flexShrink: 0, marginTop: 2 }} />{f}</div>)}
          {p.features.length > 3 && <div style={{ fontSize: 11.5, color: "rgba(0,0,0,.4)", paddingLeft: 19 }}>+ {p.features.length - 3} más</div>}
        </div>
      ) : (
        <div style={{ fontSize: 12.5, color: "rgba(0,0,0,.45)" }}>{p.subtitle || "Se suma a cualquier plan."}</div>
      )}
      {p.subtitle && lines.length > 0 && <div style={{ fontSize: 11.5, color: "rgba(0,0,0,.42)", marginTop: "auto" }}>{p.subtitle}</div>}
    </div>
  );
}

/** Tienda online: el precio depende de cuántos pedidos recibe al mes. */
function TierCard({ plan: p, color: c }: { plan: DemoPlan; color: string }) {
  const { tiers, rest } = tiersOf(p);
  return (
    <div style={{ height: "100%", boxSizing: "border-box", borderRadius: 26, padding: "22px 22px 20px", color: "#fff", position: "relative", overflow: "hidden",
      background: `radial-gradient(120% 120% at 0% 0%, ${rgba(c, 0.55)} 0%, #141416 55%)`, boxShadow: "0 30px 70px -30px rgba(0,0,0,.55)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 42, height: 42, borderRadius: 14, display: "grid", placeItems: "center", background: c, color: onColor(c) }}><ShoppingBag size={20} /></div>
        <div><div style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-.02em" }}>{p.name}</div><div style={{ fontSize: 13, color: "rgba(255,255,255,.6)" }}>Pagas según los pedidos que recibes al mes · 0% comisión</div></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${tiers.length}, minmax(0, 1fr))`, gap: 8, marginTop: 18 }}>
        {tiers.map((t, i) => (
          <div key={t.label} style={{ borderRadius: 16, padding: "14px 12px", background: i === 0 ? "rgba(255,255,255,.14)" : "rgba(255,255,255,.06)", boxShadow: i === 0 ? `inset 0 0 0 1.5px ${c}` : "none" }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.6)", fontWeight: 700 }}>{t.label}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.6)" }}>pedidos al mes</div>
            <div style={{ fontFamily: "var(--demo-mono)", fontSize: "clamp(18px, 1.7vw, 24px)", fontWeight: 700, marginTop: 8 }}>{clp(t.price)}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)" }}>/ mes</div>
          </div>
        ))}
      </div>
      {/* Barra de tramos */}
      <div style={{ display: "flex", gap: 4, marginTop: 12 }}>
        {tiers.map((t, i) => <div key={t.label} style={{ flex: 1, height: 5, borderRadius: 3, background: c, opacity: 0.35 + i * 0.3 }} />)}
      </div>
      {rest.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 16 }}>
          {rest.slice(0, 10).map((f) => <span key={f} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 99, background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.8)" }}>{f}</span>)}
          {rest.length > 10 && <span style={{ fontSize: 12, padding: "5px 10px", color: "rgba(255,255,255,.5)" }}>+ {rest.length - 10} más</span>}
        </div>
      )}
      {p.subtitle && <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginTop: "auto", paddingTop: 12 }}>{p.subtitle}</div>}
    </div>
  );
}
