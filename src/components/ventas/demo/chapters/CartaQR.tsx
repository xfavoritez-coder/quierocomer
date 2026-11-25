"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Bell, LayoutGrid, Sparkles, RefreshCw } from "lucide-react";
import type { ChapterProps } from "../DemoShell";
import type { DemoData } from "../types";
import { PhoneFrame } from "../frames";
import { BrandText, CountUp, DishImage, EASE, Eyebrow, Headline, LocalLogo, Reveal, Stage, TryItHint, clp, featuredDishes, onColor, rgba, useViewport } from "../ui";

const FEATURES = [
  { at: 1, icon: LayoutGrid, title: "Tu carta en 3 vistas", sub: "Lista, carta o espacial. Tus clientes eligen." },
  { at: 2, icon: Bell, title: "Llamar al garzón", sub: "Tocan un botón en la mesa y te llega el aviso." },
  { at: 3, icon: Sparkles, title: "El Genio sugiere platos", sub: "Le preguntan y les recomienda de tu carta." },
  { at: 4, icon: RefreshCw, title: "Cambios al instante", sub: "Cambias un precio y está en todas las mesas." },
];
const VIEWS = ["lista", "carta", "espacial"] as const;
const REPRINT_YEAR = 480000; // 4 reimpresiones al año × $120.000 (referencia)

export default function CartaQR({ data, step }: ChapterProps) {
  const { narrow } = useViewport();
  const c = data.color;

  if (step === 0) {
    return (
      <Stage style={{ flexDirection: "column", textAlign: "center" }}>
        <Reveal step={step} at={0}><Eyebrow color={c}>Carta QR inteligente</Eyebrow></Reveal>
        <Reveal step={step} at={0} delay={0.15}><Headline style={{ marginTop: 18 }}>Tu carta en papel<br />no vende.</Headline></Reveal>
        <Reveal step={step} at={0} delay={0.5}><Headline style={{ color: "rgba(0,0,0,.28)", marginTop: 6 }}>Solo informa.</Headline></Reveal>
      </Stage>
    );
  }

  return (
    <>
    <TryItHint show={step === 2 && !!data.slug && !narrow} color={c} text="Pruébalo: toca la campana en tu celular" />
    <Stage style={{ gap: "clamp(24px, 5vw, 90px)", flexDirection: narrow ? "column" : "row" }}>
      <div style={{ flex: "1 1 0", maxWidth: 560, minWidth: 0 }}>
        <Reveal step={step} at={1}><Eyebrow color={c}>Carta QR · {data.name}</Eyebrow></Reveal>
        <Reveal step={step} at={1} delay={0.1}><Headline size="lg" style={{ marginTop: 14 }}>Tu carta, siempre al día.<br /><BrandText color={c}>Y además vende.</BrandText></Headline></Reveal>
        {!narrow && (
          <div style={{ marginTop: 34, display: "grid", gap: 6 }}>
            {FEATURES.map((f) => (
              <Reveal key={f.title} step={step} at={f.at} y={14}>
                <motion.div initial={false} animate={{ opacity: step === f.at ? 1 : 0.42 }} transition={{ duration: 0.6 }} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "12px 0" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 13, flexShrink: 0, display: "grid", placeItems: "center", background: rgba(c, 0.12), color: c }}><f.icon size={20} /></div>
                  <div><div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-.02em" }}>{f.title}</div><div style={{ fontSize: 16, color: "rgba(0,0,0,.5)", marginTop: 2 }}>{f.sub}</div></div>
                </motion.div>
              </Reveal>
            ))}
          </div>
        )}
        {step === 4 && (
          <Reveal step={step} at={4} delay={0.4} style={{ marginTop: narrow ? 14 : 26 }}>
            <div style={{ fontSize: "clamp(34px, 3.8vw, 56px)", fontWeight: 750, letterSpacing: "-.04em", color: c }}><CountUp value={REPRINT_YEAR} run={step === 4} /></div>
            <div style={{ fontSize: 16, color: "rgba(0,0,0,.5)" }}>al año que dejas de gastar en reimprimir cartas</div>
          </Reveal>
        )}
      </div>

      <div style={{ position: "relative", flexShrink: 0 }}>
        <Reveal step={step} at={1} y={60} delay={0.2}>
          <PhoneFrame width={narrow ? 210 : 300}>
            <CartaPhone data={data} step={step} />
          </PhoneFrame>
        </Reveal>
        {/* Aviso al local: llamar al garzón */}
        <AnimatePresence>
          {step === 2 && (
            <motion.div key="waiter" initial={{ opacity: 0, x: 40, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 30 }} transition={{ duration: 0.7, ease: EASE, delay: 0.5 }}
              style={{ position: "absolute", bottom: narrow ? "8%" : "26%", [narrow ? "right" : "left"]: narrow ? -10 : -210, width: 230, zIndex: 3, padding: "14px 16px", borderRadius: 20, background: "rgba(255,255,255,.92)", backdropFilter: "blur(20px)", boxShadow: "0 24px 60px -16px rgba(0,0,0,.35), 0 0 0 1px rgba(0,0,0,.05)", display: "flex", gap: 12, alignItems: "center" }}>
              <motion.div animate={{ rotate: [0, -16, 14, -10, 8, 0] }} transition={{ duration: 0.9, delay: 1, repeat: Infinity, repeatDelay: 1.6 }}
                style={{ width: 42, height: 42, borderRadius: 14, display: "grid", placeItems: "center", background: c, color: onColor(c), flexShrink: 0 }}><Bell size={20} /></motion.div>
              <div><div style={{ fontWeight: 800, fontSize: 15 }}>Mesa 4</div><div style={{ fontSize: 13, color: "rgba(0,0,0,.55)" }}>llama al garzón · ahora</div></div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Stage>
    </>
  );
}

/** La carta del local dentro del celular. */
function CartaPhone({ data, step }: { data: DemoData; step: number }) {
  const reduce = useReducedMotion();
  const c = data.color;
  const dishes = featuredDishes(data, 8);
  const cats = data.categories.slice(0, 5).map((x) => x.name);
  // Paso 1: alterna las 3 vistas; en los demás pasos, vista lista.
  const [tick, setTick] = useState(0);
  const cycling = step === 1 && !reduce;
  useEffect(() => {
    if (!cycling) return;
    const t = setInterval(() => setTick((n) => n + 1), 2400);
    return () => clearInterval(t);
  }, [cycling]);
  const view = cycling ? VIEWS[tick % 3] : "lista";

  const first = dishes[0];
  const newPrice = first ? Math.round((first.price * 1.08) / 100) * 100 : 0;

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", fontSize: 12, color: "#111", background: "#fff" }}>
      <div style={{ height: 110, position: "relative", flexShrink: 0, background: data.bannerUrl ? `center/cover url(${data.bannerUrl})` : `linear-gradient(135deg, ${c}, ${rgba(c, 0.7)})` }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 30%, rgba(0,0,0,.45))" }} />
        <div style={{ position: "absolute", left: 14, bottom: -18, display: "flex", alignItems: "flex-end", gap: 10 }}>
          <div style={{ borderRadius: 14, boxShadow: "0 6px 18px rgba(0,0,0,.2)" }}><LocalLogo data={data} size={46} radius={14} /></div>
        </div>
      </div>
      <div style={{ padding: "24px 14px 8px", flexShrink: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-.02em" }}>{data.name}</div>
        <div style={{ display: "flex", gap: 5, marginTop: 9, overflow: "hidden" }}>
          {(["lista", "carta", "espacial"] as const).map((v) => (
            <span key={v} style={{ padding: "4px 9px", borderRadius: 99, fontSize: 10.5, fontWeight: 700, textTransform: "capitalize", background: view === v ? c : "#f2f2f2", color: view === v ? onColor(c) : "#555", transition: "all .4s" }}>{v}</span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 10, overflow: "hidden", whiteSpace: "nowrap", fontWeight: 700, fontSize: 11 }}>
          {cats.map((n, i) => <span key={n} style={{ color: i === 0 ? c : "#999", borderBottom: i === 0 ? `2px solid ${c}` : "none", paddingBottom: 3 }}>{n}</span>)}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "hidden", padding: "6px 12px 12px", position: "relative" }}>
        <AnimatePresence mode="wait">
          <motion.div key={view} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.45, ease: EASE }}
            style={view === "carta" ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } : { display: "grid", gap: view === "espacial" ? 10 : 8 }}>
            {dishes.slice(0, view === "espacial" ? 2 : view === "carta" ? 6 : 5).map((d, i) => {
              const priceEl = (
                <span style={{ fontFamily: "var(--demo-mono)", fontWeight: 700, fontSize: 11.5, position: "relative" }}>
                  {i === 0 && step === 4 ? (
                    <>
                      <motion.span initial={{ opacity: 1 }} animate={{ opacity: 0.35 }} transition={{ delay: 0.6 }} style={{ textDecoration: "line-through", marginRight: 4 }}>{clp(d.price)}</motion.span>
                      <motion.span initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1, duration: 0.5, ease: EASE }} style={{ color: c, display: "inline-block" }}>{clp(newPrice)}</motion.span>
                    </>
                  ) : d.price > 0 ? clp(d.price) : ""}
                </span>
              );
              if (view === "espacial") return (
                <div key={i} style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 6px 20px rgba(0,0,0,.08)" }}>
                  <div style={{ height: 128 }}><DishImage dish={d} color={c} radius={0} /></div>
                  <div style={{ padding: "9px 11px", display: "flex", justifyContent: "space-between", gap: 6 }}><b style={{ fontSize: 12.5 }}>{d.name}</b>{priceEl}</div>
                </div>
              );
              if (view === "carta") return (
                <div key={i} style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #eee" }}>
                  <div style={{ height: 64 }}><DishImage dish={d} color={c} radius={0} /></div>
                  <div style={{ padding: "6px 7px" }}><div style={{ fontWeight: 700, fontSize: 10.5, lineHeight: 1.2, height: 26, overflow: "hidden" }}>{d.name}</div>{priceEl}</div>
                </div>
              );
              return (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: 7, borderRadius: 13, background: i === 0 && step === 4 ? rgba(c, 0.08) : "#fafafa", transition: "background .6s" }}>
                  <div style={{ width: 52, height: 52, flexShrink: 0 }}><DishImage dish={d} color={c} radius={10} /></div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</div>
                    {d.description && <div style={{ fontSize: 10, color: "#888", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.description}</div>}
                    <div style={{ marginTop: 2 }}>{priceEl}</div>
                  </div>
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>

        {/* Botón llamar al garzón */}
        <motion.div initial={false} animate={{ scale: step === 2 ? [1, 1.12, 1] : 1 }} transition={{ duration: 0.8, repeat: step === 2 ? Infinity : 0, repeatDelay: 1 }}
          style={{ position: "absolute", right: 12, bottom: 12, width: 44, height: 44, borderRadius: 99, background: c, color: onColor(c), display: "grid", placeItems: "center", boxShadow: `0 8px 20px -4px ${rgba(c, 0.6)}` }}>
          <Bell size={19} />
        </motion.div>

        {/* El Genio */}
        <AnimatePresence>
          {step === 3 && (
            <motion.div key="genio" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ duration: 0.6, ease: EASE }}
              style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "14px 12px 16px", background: "#fff", borderRadius: "22px 22px 0 0", boxShadow: "0 -12px 40px rgba(0,0,0,.15)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 800, fontSize: 12.5, marginBottom: 10 }}><Sparkles size={15} color={c} /> El Genio</div>
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }} style={{ marginLeft: "auto", width: "fit-content", maxWidth: "80%", padding: "8px 11px", borderRadius: "14px 14px 4px 14px", background: c, color: onColor(c), fontSize: 11.5 }}>
                ¿Algo liviano para compartir?
              </motion.div>
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.4 }} style={{ marginTop: 8, padding: "9px 11px", borderRadius: "14px 14px 14px 4px", background: "#f3f3f3", fontSize: 11.5 }}>
                Te recomiendo estos dos:
                {dishes.slice(1, 3).map((d, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.9 + i * 0.35 }} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 7, background: "#fff", borderRadius: 10, padding: 5 }}>
                    <div style={{ width: 34, height: 34, flexShrink: 0 }}><DishImage dish={d} color={c} radius={8} /></div>
                    <b style={{ fontSize: 11, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</b>
                    <span style={{ fontFamily: "var(--demo-mono)", fontSize: 10.5, fontWeight: 700 }}>{d.price > 0 ? clp(d.price) : ""}</span>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
