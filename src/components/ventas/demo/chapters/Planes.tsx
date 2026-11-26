"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Check, Star, X, Heart, ShoppingBag, QrCode, Bike, ChefHat, LayoutGrid, RefreshCcw, Receipt, Boxes, Sparkles, Puzzle, Truck, Store, MessageCircle } from "lucide-react";
import type { ChapterProps } from "../DemoShell";
import type { DemoData, DemoPlan, DemoPlanSection } from "../types";
import { BrandText, EASE, Eyebrow, Headline, LocalLogo, Reveal, Stage, clp, lighten, onColor, rgba, useViewport } from "../ui";

const MAX_FEATURES = 6;

/** Páginas del capítulo: planes principales, la Tienda online (por tramos) en su propia página,
 *  los módulos (add-ons) y el cierre. */
type Page = { kind: "plans"; s: DemoPlanSection } | { kind: "tiers"; plan: DemoPlan } | { kind: "modules"; s: DemoPlanSection } | { kind: "end" };
export function planesPages(data: DemoData): Page[] {
  const pages: Page[] = [];
  for (const s of data.plans) {
    const tiered = s.plans.find((p) => tiersOf(p).tiers.length >= 2);
    if (tiered) pages.push({ kind: "tiers", plan: tiered });
    const rest = { ...s, plans: s.plans.filter((p) => p !== tiered) };
    if (!rest.plans.length) continue;
    pages.push(s.id === "__plans" ? { kind: "plans", s: rest } : { kind: "modules", s: rest });
  }
  pages.push({ kind: "end" });
  return pages;
}
export const planesSteps = (data: DemoData) => planesPages(data).length;

export default function Planes({ data, step }: ChapterProps) {
  const { narrow } = useViewport();
  const c = data.color;
  const pages = planesPages(data);
  const page = pages[Math.min(step, pages.length - 1)];
  const label = `Planes · ${Math.min(step, pages.length - 2) + 1} de ${pages.length - 1}`;

  if (page.kind === "end") {
    return (
      <Stage style={{ flexDirection: "column", textAlign: "center" }}>
        <Reveal step={1} at={1}><LocalLogo data={data} size={96} radius={28} /></Reveal>
        <Reveal step={1} at={1} delay={0.15}><Headline style={{ marginTop: 28 }}>{data.name},<br /><BrandText color={c}>a un paso de vender más.</BrandText></Headline></Reveal>
        <Reveal step={1} at={1} delay={0.4}>
          <div style={{ fontSize: "clamp(17px, 1.7vw, 22px)", color: "rgba(0,0,0,.5)", marginTop: 16 }}>
            {data.isFictional ? "Cargamos tu carta y lo dejamos funcionando por ti." : "Tu carta ya está cargada. Lo dejamos funcionando por ti."}
          </div>
        </Reveal>
      </Stage>
    );
  }

  if (page.kind === "tiers") return <TierPage data={data} plan={page.plan} step={step} label={label} narrow={narrow} />;
  if (page.kind === "modules") return <ModulesStep data={data} step={step} section={page.s} label={label} narrow={narrow} />;
  const section = page.s;

  const cols = Math.min(section.plans.length, narrow ? 1 : 4);
  return (
    <Stage style={{ flexDirection: "column" }}>
      <div style={{ textAlign: "center", maxWidth: 820 }}>
        <Reveal key={`h${step}`} step={0} at={0}><Eyebrow color={c}>{label}</Eyebrow></Reveal>
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
  [/whats ?app/i, MessageCircle],
  [/loyal|fideliz|tarjeta/i, Heart], [/tienda|ecommerce|online/i, ShoppingBag], [/carta|qr/i, QrCode], [/apps? delivery|integraci/i, Truck],
  [/kds|cocina|pantalla/i, ChefHat], [/repartidor|motorist|flota/i, Bike], [/mesa|sal[oó]n/i, LayoutGrid], [/recupera/i, RefreshCcw],
  [/boleta|factura|electr[oó]nica/i, Receipt], [/inventario|bodega|stock/i, Boxes], [/genio|inteligen|ia\b/i, Sparkles], [/sucursal/i, Store],
];
function ModuleIcon({ name, size = 19 }: { name: string; size?: number }) {
  const I = ICONS.find(([re]) => re.test(name))?.[1] ?? Puzzle;
  return <I size={size} />;
}

// "Hasta 100 pedidos", "Hasta 499 pedidos 49.900", "Más de 500 pedidos 79.900", "Pedidos ilimitados 89.900"
const TIER_RE = /^\s*(?:(hasta|m[aá]s de)\s+([\d.]+)\s+pedidos|pedidos\s+ilimitados)(?:\s*[:·-]?\s*\$?\s*([\d.]+))?\s*$/i;
function tiersOf(p: DemoPlan) {
  const tiers = p.features.map((f) => f.match(TIER_RE)).filter(Boolean).map((m) => {
    const n = m![2] ? Number(m![2].replace(/\./g, "")) : 0;
    // "Hasta 499" se muestra como "Hasta 500"; "Más de N" o "ilimitados" → "Pedidos ilimitados".
    const label = m![1] && /hasta/i.test(m![1]) ? `Hasta ${(n % 100 === 99 ? n + 1 : n).toLocaleString("es-CL")} pedidos` : "Pedidos ilimitados";
    return { label, price: m![3] ? Number(m![3].replace(/\./g, "")) : p.price };
  });
  const rest = p.features.filter((f) => !TIER_RE.test(f));
  return { tiers, rest };
}

function ModulesStep({ data, step, section, label, narrow }: { data: DemoData; step: number; section: DemoPlanSection; label: string; narrow: boolean }) {
  const c = data.color;
  const [open, setOpen] = useState<DemoPlan | null>(null);
  const cols = narrow ? 1 : section.plans.length > 6 ? 4 : 3;
  return (
    <Stage style={{ flexDirection: "column", justifyContent: "center" }}>
      <div style={{ textAlign: "center", maxWidth: 820 }}>
        <Reveal key={`h${step}`} step={0} at={0}><Eyebrow color={c}>{label}</Eyebrow></Reveal>
        <Reveal key={`t${step}`} step={0} at={0} delay={0.1}><Headline size="md" style={{ marginTop: 10 }}>{section.title}</Headline></Reveal>
        <Reveal key={`s${step}`} step={0} at={0} delay={0.18}><div style={{ fontSize: "clamp(15px, 1.3vw, 18px)", color: "rgba(0,0,0,.5)", marginTop: 8 }}>{section.subtitle || "Módulos que se suman a tu plan cuando los necesites."} Toca uno para ver el detalle.</div></Reveal>
      </div>
      <div style={{ width: `min(${cols === 4 ? 1180 : 980}px, 100%)`, marginTop: "clamp(18px, 3vh, 32px)", display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 12, overflowY: narrow ? "auto" : "visible", maxHeight: narrow ? "64vh" : undefined }}>
        {section.plans.map((p, i) => (
          <Reveal key={`${step}-${p.id}`} step={0} at={0} delay={0.25 + i * 0.05}>
            <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.25 }} onClick={(e) => { e.stopPropagation(); setOpen(p); }} style={{ height: "100%", cursor: "pointer" }}>
              <ModuleTile plan={p} color={c} />
            </motion.div>
          </Reveal>
        ))}
      </div>
      <AnimatePresence>{open && <ModuleModal plan={open} color={c} narrow={narrow} onClose={() => setOpen(null)} />}</AnimatePresence>
    </Stage>
  );
}

// Para qué sirve cada módulo (texto del detalle); si no hay coincidencia, se usan sus características.
const MODULE_INFO: [RegExp, string][] = [
  [/whats ?app/i, "Tus clientes arman su pedido en una página con tu carta y, con un toque, te llega listo al WhatsApp del local: productos, cantidades, total, dirección y forma de pago. Sin apps ni comisiones; tú lo confirmas por el chat."],
  [/loyal|fideliz/i, "Tarjeta de sellos en Apple y Google Wallet. Tus clientes juntan sellos, reciben avisos al pasar cerca y un regalo en su cumpleaños."],
  [/carta|qr/i, "Tu carta digital que traduce, recomienda platos, filtra por dieta y llama al garzón. Y la exportas en PDF con diseño."],
  [/apps? delivery|integraci/i, "Los pedidos de Uber Eats, PedidosYa y Rappi entran directo a tu POS. Sin tablets extra ni tipear pedidos."],
  [/kds|pantalla/i, "Una pantalla en cocina con los pedidos en orden y sus tiempos. Adiós a las comandas perdidas."],
  [/repartidor/i, "App para tus propios repartidores: el cliente sigue su pedido en tiempo real y tú ves propinas y entregas."],
  [/mesa|sal[oó]n/i, "Arma tus salones, abre mesas, divide cuentas y registra propinas desde el POS."],
  [/recupera/i, "Detecta a los clientes que dejaron de pedir, les pregunta por qué y les envía un cupón para que vuelvan."],
  [/boleta|factura|electr/i, "Emite boletas electrónicas válidas ante el SII directamente desde tu POS."],
  [/inventario|bodega/i, "Cada venta descuenta insumos y te avisa antes de que algo se acabe."],
  [/genio|inteligen/i, "Recomendaciones inteligentes para vender más en cada pedido."],
];
const moduleInfo = (name: string) => MODULE_INFO.find(([re]) => re.test(name))?.[1] ?? null;

function ModuleModal({ plan: p, color: c, narrow, onClose }: { plan: DemoPlan; color: string; narrow: boolean; onClose: () => void }) {
  const info = moduleInfo(p.name);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={(e) => { e.stopPropagation(); onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 30, background: "rgba(10,10,12,.55)", backdropFilter: "blur(18px)", display: "grid", placeItems: "center", padding: 20 }}>
      <motion.div onClick={(e) => e.stopPropagation()} initial={{ y: 50, scale: 0.92, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 24, scale: 0.97, opacity: 0 }} transition={{ duration: 0.55, ease: EASE }}
        style={{ width: "min(720px, 100%)", maxHeight: "88vh", overflowY: "auto", borderRadius: 32, background: "#fff", boxShadow: "0 60px 140px -30px rgba(0,0,0,.65)", position: "relative", display: "grid", gridTemplateColumns: narrow ? "1fr" : "minmax(0, 1fr) minmax(0, 1.1fr)" }}>
        {/* Ilustración */}
        <div style={{ position: "relative", minHeight: narrow ? 220 : 340, overflow: "hidden", background: `radial-gradient(120% 120% at 20% 10%, ${lighten(c, 0.35)} 0%, ${c} 55%, ${rgba(c, 0.9)} 100%)`, display: "grid", placeItems: "center" }}>
          <div aria-hidden style={{ position: "absolute", inset: 0, background: "radial-gradient(60% 50% at 80% 90%, rgba(255,255,255,.25), transparent)" }} />
          <motion.div initial={{ y: 30, opacity: 0, scale: 0.9 }} animate={{ y: [0, -6, 0], opacity: 1, scale: 1 }} transition={{ y: { duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.6 }, opacity: { duration: 0.6, delay: 0.15 }, scale: { duration: 0.7, delay: 0.15, ease: EASE } }}>
            <ModuleArt name={p.name} color={c} />
          </motion.div>
        </div>
        {/* Detalle */}
        <div style={{ padding: "30px 28px 28px", position: "relative" }}>
          <button onClick={onClose} aria-label="Cerrar" style={{ position: "absolute", top: 16, right: 16, width: 36, height: 36, borderRadius: 99, border: "none", cursor: "pointer", background: "rgba(0,0,0,.06)", display: "grid", placeItems: "center" }}><X size={17} /></button>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: c }}><ModuleIcon name={p.name} size={14} /> Módulo</div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.03em", marginTop: 8, lineHeight: 1.1, paddingRight: 30 }}>{p.name}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 10 }}>
            {p.priceFrom && <span style={{ fontSize: 13, color: "rgba(0,0,0,.45)", fontWeight: 700 }}>Desde</span>}
            <span style={{ fontFamily: "var(--demo-mono)", fontSize: 30, fontWeight: 700, letterSpacing: "-.02em" }}>{clp(p.price)}</span>
            <span style={{ fontSize: 14, color: "rgba(0,0,0,.45)" }}>/ mes</span>
          </div>
          {p.subtitle && <div style={{ fontSize: 13, color: "rgba(0,0,0,.5)", marginTop: 2 }}>{p.subtitle}</div>}
          {info && <p style={{ fontSize: 15.5, color: "rgba(0,0,0,.62)", lineHeight: 1.5, margin: "16px 0 0" }}>{info}</p>}
          {p.features.length > 0 && (
            <div style={{ display: "grid", gap: 8, marginTop: 18 }}>
              {p.features.map((f, i) => (
                <motion.div key={f} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.05, duration: 0.4, ease: EASE }}
                  style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14.5, lineHeight: 1.4, padding: "9px 12px", borderRadius: 14, background: "#f7f6f3" }}>
                  <span style={{ width: 20, height: 20, borderRadius: 99, flexShrink: 0, display: "grid", placeItems: "center", background: c, color: onColor(c), marginTop: 1 }}><Check size={12} strokeWidth={3} /></span>{f}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Ilustración de cada módulo (sobre el degradado del color del local). */
function ModuleArt({ name, color: c }: { name: string; color: string }) {
  const card: React.CSSProperties = { background: "#fff", borderRadius: 18, boxShadow: "0 24px 50px -18px rgba(0,0,0,.45)", color: "#111" };
  const line = (w: string | number, o = 0.15) => <div style={{ height: 7, width: w, borderRadius: 4, background: `rgba(0,0,0,${o})` }} />;
  if (/whats ?app/i.test(name)) return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {/* La página de pedido */}
      <div style={{ ...card, width: 112, height: 200, borderRadius: 22, padding: 7, background: "#111" }}>
        <div style={{ background: "#fff", borderRadius: 16, height: "100%", padding: 9, boxSizing: "border-box", display: "grid", gap: 6, alignContent: "start" }}>
          {[0, 1, 2].map((i) => <div key={i} style={{ display: "flex", gap: 5, alignItems: "center" }}><div style={{ width: 20, height: 20, borderRadius: 6, background: rgba(c, 0.2) }} /><div style={{ flex: 1, display: "grid", gap: 3 }}>{line("85%")}{line("45%", 0.08)}</div></div>)}
          <div style={{ marginTop: 34, borderRadius: 99, padding: "6px 0", textAlign: "center", fontSize: 8.5, fontWeight: 800, background: "#25D366", color: "#fff" }}>Enviar por WhatsApp</div>
        </div>
      </div>
      <div style={{ color: "#fff", fontSize: 24, fontWeight: 800 }}>→</div>
      {/* El chat del local con el pedido listo */}
      <div style={{ ...card, width: 150, padding: 0, overflow: "hidden", background: "#efeae2" }}>
        <div style={{ background: "#075E54", color: "#fff", padding: "8px 10px", fontSize: 10.5, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}><MessageCircle size={12} /> Tu local</div>
        <div style={{ padding: 8 }}>
          <div style={{ marginLeft: "auto", width: "92%", background: "#d9fdd3", borderRadius: "10px 10px 2px 10px", padding: "7px 8px", fontSize: 8.5, lineHeight: 1.45, color: "#111", boxShadow: "0 1px 1px rgba(0,0,0,.1)" }}>
            <b>🛒 Nuevo pedido</b><br />2× Burger clásica<br />1× Papas rústicas<br /><b>Total: $21.890</b><br />📍 Retiro · 💵 Efectivo
          </div>
        </div>
      </div>
    </div>
  );
  if (/loyal|fideliz|tarjeta/i.test(name)) return (
    <div style={{ ...card, width: 220, padding: 16, background: `linear-gradient(135deg, ${lighten(c, 0.15)}, ${c})`, color: onColor(c) }}>
      <div style={{ fontWeight: 800, fontSize: 14 }}>Tarjeta de cliente</div>
      <div style={{ fontSize: 11, opacity: 0.8 }}>4 de 5 sellos</div>
      <div style={{ display: "flex", gap: 7, marginTop: 34 }}>{[0, 1, 2, 3, 4].map((i) => <div key={i} style={{ flex: 1, aspectRatio: "1", borderRadius: 99, background: i < 4 ? "rgba(255,255,255,.95)" : "transparent", border: "2px solid rgba(255,255,255,.7)", display: "grid", placeItems: "center", color: c }}>{i < 4 ? <Check size={13} strokeWidth={3} /> : <Heart size={12} color="#fff" />}</div>)}</div>
    </div>
  );
  if (/carta|qr/i.test(name)) return (
    <div style={{ ...card, width: 150, height: 250, borderRadius: 28, padding: 10, background: "#111" }}>
      <div style={{ background: "#fff", borderRadius: 20, height: "100%", padding: 12, boxSizing: "border-box", display: "grid", gap: 8, alignContent: "start" }}>
        <div style={{ height: 50, borderRadius: 10, background: rgba(c, 0.25) }} />
        {[0, 1, 2].map((i) => <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}><div style={{ width: 26, height: 26, borderRadius: 7, background: rgba(c, 0.2) }} /><div style={{ flex: 1, display: "grid", gap: 4 }}>{line("90%")}{line("50%", 0.08)}</div></div>)}
        <div style={{ marginLeft: "auto", width: 30, height: 30, borderRadius: 99, background: c, color: onColor(c), display: "grid", placeItems: "center" }}><QrCode size={15} /></div>
      </div>
    </div>
  );
  if (/apps? delivery|integraci/i.test(name)) return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ display: "grid", gap: 8 }}>{[["Uber Eats", "#06c167"], ["PedidosYa", "#fa0050"], ["Rappi", "#ff441f"]].map(([n, col]) => <div key={n} style={{ ...card, padding: "8px 12px", fontWeight: 800, fontSize: 12, color: col, borderRadius: 12 }}>{n}</div>)}</div>
      <div style={{ color: "#fff", fontSize: 26, fontWeight: 800 }}>→</div>
      <div style={{ ...card, width: 110, padding: 12, display: "grid", gap: 6 }}><b style={{ fontSize: 12 }}>Tu POS</b>{[0, 1, 2].map((i) => <div key={i} style={{ height: 16, borderRadius: 6, background: rgba(c, 0.18 + i * 0.1) }} />)}</div>
    </div>
  );
  if (/kds|cocina|pantalla/i.test(name)) return (
    <div style={{ ...card, width: 250, padding: 10, background: "#1b1b1d", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
      {[["#f59e0b", "08:12"], ["#16a34a", "03:40"], ["#ef4444", "14:05"]].map(([col, t], i) => (
        <div key={i} style={{ background: "#fff", borderRadius: 8, overflow: "hidden" }}><div style={{ background: col, color: "#fff", fontSize: 10, fontWeight: 800, padding: "4px 6px" }}>{t}</div><div style={{ padding: 6, display: "grid", gap: 4 }}>{line("90%")}{line("70%")}{line("80%", 0.08)}</div></div>
      ))}
    </div>
  );
  if (/repartidor|motorist|flota/i.test(name)) return (
    <div style={{ ...card, width: 230, height: 170, padding: 0, overflow: "hidden", position: "relative", background: "#eef1f4" }}>
      <svg width="230" height="170" style={{ position: "absolute", inset: 0 }}><path d="M30 140 C 80 60, 140 150, 200 40" fill="none" stroke={c} strokeWidth="6" strokeLinecap="round" strokeDasharray="1 12" /></svg>
      <div style={{ position: "absolute", left: 18, top: 124, width: 26, height: 26, borderRadius: 8, background: c, color: onColor(c), display: "grid", placeItems: "center" }}><Store size={14} /></div>
      <div style={{ position: "absolute", left: 104, top: 82, width: 32, height: 32, borderRadius: 99, background: "#fff", color: c, display: "grid", placeItems: "center", boxShadow: "0 6px 14px rgba(0,0,0,.25)" }}><Bike size={17} /></div>
      <div style={{ position: "absolute", left: 188, top: 26, width: 24, height: 24, borderRadius: 99, background: "#111" }} />
    </div>
  );
  if (/mesa|sal[oó]n/i.test(name)) return (
    <div style={{ ...card, width: 230, padding: 14, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
      {[1, 0, 1, 1, 0, 0].map((busy, i) => <div key={i} style={{ aspectRatio: "1", borderRadius: 14, background: busy ? c : "#f2f1ee", color: busy ? onColor(c) : "#999", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 13 }}>{i + 1}</div>)}
    </div>
  );
  if (/recupera/i.test(name)) return (
    <div style={{ ...card, width: 230, padding: 0, display: "flex", overflow: "hidden" }}>
      <div style={{ background: c, color: onColor(c), padding: "18px 14px", display: "grid", placeItems: "center", fontWeight: 900, fontSize: 26 }}>-15%</div>
      <div style={{ padding: 14, borderLeft: "2px dashed #ddd" }}><div style={{ fontWeight: 800, fontSize: 13 }}>¡Te extrañamos!</div><div style={{ fontSize: 11, color: "#777", marginTop: 4 }}>Vuelve esta semana</div><div style={{ marginTop: 8, fontFamily: "var(--demo-mono)", fontWeight: 800, fontSize: 12, color: c }}>VUELVE15</div></div>
    </div>
  );
  if (/boleta|factura|electr/i.test(name)) return (
    <div style={{ ...card, width: 170, padding: 16, borderRadius: 6, display: "grid", gap: 7, fontFamily: "var(--demo-mono)" }}>
      <b style={{ fontSize: 11, textAlign: "center" }}>BOLETA ELECTRÓNICA</b>
      <div style={{ fontSize: 9, textAlign: "center", color: "#777" }}>N° 001284 · SII</div>
      {[0, 1, 2].map((i) => <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>{line("55%")}{line("22%")}</div>)}
      <div style={{ borderTop: "1px dashed #ccc", paddingTop: 6, display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 800 }}><span>TOTAL</span><span style={{ color: c }}>$24.390</span></div>
    </div>
  );
  if (/tienda|ecommerce|online/i.test(name)) return (
    <div style={{ ...card, width: 150, height: 250, borderRadius: 28, padding: 10, background: "#111" }}>
      <div style={{ background: "#f5f3ee", borderRadius: 20, height: "100%", padding: 12, boxSizing: "border-box", display: "grid", gap: 8, alignContent: "start" }}>
        <div style={{ height: 70, borderRadius: 12, background: rgba(c, 0.3) }} />{line("70%")}{line("40%", 0.08)}
        <div style={{ marginTop: 40, borderRadius: 99, padding: "8px 0", textAlign: "center", fontSize: 10, fontWeight: 800, background: c, color: onColor(c) }}>Pedir</div>
      </div>
    </div>
  );
  return <div style={{ ...card, width: 120, height: 120, display: "grid", placeItems: "center", color: c }}><ModuleIcon name={name} size={48} /></div>;
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

/** Tienda online: página propia con sus planes según los pedidos del mes. */
function TierPage({ data, plan: p, step, label, narrow }: { data: DemoData; plan: DemoPlan; step: number; label: string; narrow: boolean }) {
  const c = data.color;
  const { tiers, rest } = tiersOf(p);
  const names = ["Para empezar", "Para crecer", "Alto volumen", "Cadena"];
  return (
    <Stage style={{ flexDirection: "column" }}>
      <div style={{ textAlign: "center", maxWidth: 820 }}>
        <Reveal key={`h${step}`} step={0} at={0}><Eyebrow color={c}>{label}</Eyebrow></Reveal>
        <Reveal key={`t${step}`} step={0} at={0} delay={0.1}><Headline size="lg" style={{ marginTop: 10 }}><BrandText color={c}>{p.name}</BrandText></Headline></Reveal>
        <Reveal key={`s${step}`} step={0} at={0} delay={0.18}><div style={{ fontSize: "clamp(15px, 1.4vw, 19px)", color: "rgba(0,0,0,.5)", marginTop: 10 }}>Pagas según los pedidos que recibes al mes. Nunca un porcentaje de tus ventas.</div></Reveal>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${narrow ? 1 : tiers.length}, minmax(0, 1fr))`, gap: 14, width: "min(1040px, 100%)", marginTop: "clamp(22px, 3.5vh, 40px)", alignItems: "stretch" }}>
        {tiers.map((t, i) => {
          const hl = i === 0;
          return (
            <Reveal key={`${step}-${t.label}`} step={0} at={0} delay={0.25 + i * 0.1} style={{ height: "100%" }}>
              <div style={{ height: "100%", boxSizing: "border-box", borderRadius: 28, padding: "26px 24px", position: "relative", overflow: "hidden",
                background: hl ? `radial-gradient(130% 130% at 0% 0%, ${rgba(c, 0.6)} 0%, #141416 60%)` : "#fff", color: hl ? "#fff" : "#111",
                boxShadow: hl ? `0 34px 80px -30px ${rgba(c, 0.8)}` : "0 0 0 1px rgba(0,0,0,.07), 0 20px 50px -30px rgba(0,0,0,.25)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 13, display: "grid", placeItems: "center", background: hl ? c : rgba(c, 0.12), color: hl ? onColor(c) : c }}><ShoppingBag size={19} /></div>
                  <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: hl ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.45)" }}>{names[i] ?? "Plan"}</div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.02em", marginTop: 18 }}>{t.label}</div>
                <div style={{ fontSize: 14, color: hl ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.45)" }}>al mes</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 18 }}>
                  <span style={{ fontFamily: "var(--demo-mono)", fontSize: "clamp(32px, 3vw, 44px)", fontWeight: 700, letterSpacing: "-.03em", color: hl ? "#fff" : c }}>{clp(t.price)}</span>
                  <span style={{ fontSize: 14, color: hl ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.45)" }}>/ mes</span>
                </div>
                {/* Medidor de volumen */}
                <div style={{ display: "flex", gap: 4, marginTop: 18 }}>
                  {tiers.map((_, j) => <div key={j} style={{ flex: 1, height: 6, borderRadius: 3, background: j <= i ? (hl ? "#fff" : c) : hl ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.08)" }} />)}
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
      {rest.length > 0 && (
        <Reveal key={`${step}-inc`} step={0} at={0} delay={0.6}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 22, maxWidth: 1040 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "rgba(0,0,0,.45)", padding: "7px 4px" }}>Todos incluyen:</span>
            {rest.map((f) => <span key={f} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13.5, padding: "7px 12px", borderRadius: 99, background: "#fff", boxShadow: "0 0 0 1px rgba(0,0,0,.07)" }}><Check size={13} color={c} strokeWidth={3} />{f}</span>)}
          </div>
        </Reveal>
      )}
    </Stage>
  );
}
