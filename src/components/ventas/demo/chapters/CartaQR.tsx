"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Bell, Languages, Sparkles, Leaf, FileText, QrCode } from "lucide-react";
import type { ChapterProps } from "../DemoShell";
import type { DemoData } from "../types";
import { PhoneFrame } from "../frames";
import { BrandText, DishImage, EASE, Eyebrow, Headline, LocalLogo, Reveal, Stage, TryItHint, clp, featuredDishes, onColor, rgba, useViewport } from "../ui";

// Una función por paso (paso 1 = la primera). Todas quedan a la vista; la activa se destaca.
const FEATURES = [
  { id: "idiomas", icon: Languages, title: "Habla el idioma de cada cliente", sub: "Tu carta se traduce sola a inglés, portugués y más. El turista entiende lo que pide." },
  { id: "recomienda", icon: Sparkles, title: "Recomendaciones inteligentes", sub: "En cada plato sugiere con qué acompañarlo. Más platos por mesa, sin que el garzón insista." },
  { id: "garzon", icon: Bell, title: "Llamar al garzón", sub: "Tocan un botón en la mesa y te llega el aviso al instante." },
  { id: "filtros", icon: Leaf, title: "Filtros para cada dieta", sub: "Vegano, vegetariano, sin gluten, picante. Cada uno encuentra lo suyo en segundos." },
  { id: "pdf", icon: FileText, title: "Tu carta impresa, con diseño", sub: "Exporta tu carta en PDF con distintos diseños. Papel y QR, siempre con los mismos precios." },
] as const;
type FeatureId = (typeof FEATURES)[number]["id"];

export const cartaSteps = FEATURES.length + 1;

export default function CartaQR({ data, step }: ChapterProps) {
  const { narrow } = useViewport();
  const c = data.color;

  if (step === 0) {
    return (
      <Stage style={{ flexDirection: "column", textAlign: "center" }}>
        <Reveal step={step} at={0}><Eyebrow color={c}>Carta QR</Eyebrow></Reveal>
        <Reveal step={step} at={0} delay={0.15}><Headline style={{ marginTop: 18 }}>Papel y digital.</Headline></Reveal>
        <Reveal step={step} at={0} delay={0.45}><Headline style={{ marginTop: 6 }}><BrandText color={c}>Mejor juntos.</BrandText></Headline></Reveal>
        <Reveal step={step} at={0} delay={0.8}>
          <div style={{ fontSize: "clamp(17px, 1.6vw, 22px)", color: "rgba(0,0,0,.5)", marginTop: 22, maxWidth: 640, lineHeight: 1.45 }}>
            Tu carta de siempre en la mesa, y una carta que además traduce, recomienda y llama al garzón en el celular de cada cliente.
          </div>
        </Reveal>
      </Stage>
    );
  }

  const active: FeatureId = FEATURES[Math.min(step, FEATURES.length) - 1].id;

  return (
    <>
      <TryItHint show={active === "garzon" && !!data.slug && !narrow} color={c} text="Pruébalo: toca la campana en tu celular" />
      <Stage style={{ gap: "clamp(28px, 5vw, 96px)", flexDirection: narrow ? "column" : "row" }}>
        <div style={{ flex: "1 1 0", maxWidth: 540, minWidth: 0 }}>
          <Reveal step={step} at={1}><Eyebrow color={c}>Carta QR · {data.name}</Eyebrow></Reveal>
          <Reveal step={step} at={1} delay={0.1}><Headline size="md" style={{ marginTop: 12 }}>Tu carta, siempre al día.<br /><BrandText color={c}>Y además vende.</BrandText></Headline></Reveal>
          <div style={{ marginTop: "clamp(16px, 3vh, 30px)", display: "grid", gap: 2 }}>
            {FEATURES.map((f, i) => {
              const on = f.id === active;
              if (narrow && !on) return null;
              return (
                <Reveal key={f.id} step={step} at={1} delay={0.2 + i * 0.07} y={12}>
                  <motion.div initial={false} animate={{ opacity: on ? 1 : 0.38 }} transition={{ duration: 0.5 }}
                    style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "10px 0", borderTop: i && !narrow ? "1px solid rgba(0,0,0,.06)" : "none" }}>
                    <motion.div initial={false} animate={{ background: on ? c : rgba(c, 0.1), color: on ? onColor(c) : c, scale: on ? 1.06 : 1 }} transition={{ duration: 0.5, ease: EASE }}
                      style={{ width: 40, height: 40, borderRadius: 13, flexShrink: 0, display: "grid", placeItems: "center" }}><f.icon size={19} /></motion.div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "clamp(17px, 1.5vw, 21px)", fontWeight: 700, letterSpacing: "-.02em", lineHeight: 1.25, paddingTop: 8 }}>{f.title}</div>
                      <AnimatePresence initial={false}>
                        {on && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.45, ease: EASE }} style={{ overflow: "hidden" }}>
                            <div style={{ fontSize: "clamp(14px, 1.2vw, 16.5px)", color: "rgba(0,0,0,.55)", marginTop: 4, lineHeight: 1.45 }}>{f.sub}</div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                </Reveal>
              );
            })}
          </div>
        </div>

        <div style={{ position: "relative", flexShrink: 0 }}>
          {/* Cartas impresas en PDF (detrás del celular) */}
          <AnimatePresence>{active === "pdf" && <PaperMenus data={data} narrow={narrow} />}</AnimatePresence>
          <Reveal step={step} at={1} y={60} delay={0.2} style={{ position: "relative", zIndex: 2 }}>
            <motion.div initial={false} animate={{ x: active === "pdf" && !narrow ? -70 : 0 }} transition={{ duration: 0.9, ease: EASE }} style={{ position: "relative", zIndex: 2 }}>
              <PhoneFrame width={narrow ? 210 : 290}>
                <CartaPhone data={data} active={active} />
              </PhoneFrame>
            </motion.div>
          </Reveal>
          {/* Aviso al local: llamar al garzón */}
          <AnimatePresence>
            {active === "garzon" && (
              <motion.div key="waiter" initial={{ opacity: 0, x: 40, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 30 }} transition={{ duration: 0.7, ease: EASE, delay: 0.5 }}
                style={{ position: "absolute", bottom: narrow ? "8%" : "30%", right: narrow ? -10 : -250, width: 236, zIndex: 3, padding: "14px 16px", borderRadius: 20, background: "rgba(255,255,255,.94)", backdropFilter: "blur(20px)", boxShadow: "0 24px 60px -16px rgba(0,0,0,.35), 0 0 0 1px rgba(0,0,0,.05)", display: "flex", gap: 12, alignItems: "center" }}>
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

// ── Celular con la carta del local ─────────────────────────────────────────
const LANGS = [
  { code: "ES", flag: "🇨🇱", title: "Nuestra carta", add: "Agregar", rec: "Va perfecto con" },
  { code: "EN", flag: "🇺🇸", title: "Our menu", add: "Add", rec: "Goes great with" },
  { code: "PT", flag: "🇧🇷", title: "Nosso cardápio", add: "Adicionar", rec: "Combina com" },
  { code: "FR", flag: "🇫🇷", title: "Notre carte", add: "Ajouter", rec: "Parfait avec" },
];
const DIETS = ["🌱 Vegano", "🥬 Vegetariano", "🌾 Sin gluten", "🌶️ Picante"];

function useCycle(on: boolean, n: number, ms: number) {
  const reduce = useReducedMotion();
  const [tick, setTick] = useState(0);
  const run = on && !reduce;
  useEffect(() => {
    if (!run) return;
    const t = setInterval(() => setTick((x) => x + 1), ms);
    return () => clearInterval(t);
  }, [run, ms]);
  return run ? tick % n : 0;
}

function CartaPhone({ data, active }: { data: DemoData; active: FeatureId }) {
  const c = data.color;
  const all = featuredDishes(data, 9);
  const li = useCycle(active === "idiomas", LANGS.length, 1700);
  const di = useCycle(active === "filtros", DIETS.length, 1600);
  const lang = LANGS[active === "idiomas" ? li : 0];
  // Filtro: la lista cambia (orden distinto) para mostrar que se filtra.
  const dishes = active === "filtros" ? [...all.slice(di % 3), ...all.slice(0, di % 3)] : all;
  const cats = data.categories.slice(0, 5).map((x) => x.name);
  const hero = dishes[0];

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", fontSize: 12, color: "#111", background: "#fff" }}>
      <div style={{ height: 104, position: "relative", flexShrink: 0, background: data.bannerUrl ? `center/cover url(${data.bannerUrl})` : `linear-gradient(135deg, ${c}, ${rgba(c, 0.7)})` }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 30%, rgba(0,0,0,.45))" }} />
        <div style={{ position: "absolute", left: 14, bottom: -18, borderRadius: 14, boxShadow: "0 6px 18px rgba(0,0,0,.2)" }}><LocalLogo data={data} size={44} radius={14} /></div>
        {/* Selector de idioma */}
        <motion.div initial={false} animate={{ scale: active === "idiomas" ? 1 : 0.9, opacity: active === "idiomas" ? 1 : 0.85 }}
          style={{ position: "absolute", right: 10, top: 34, display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 99, background: "rgba(255,255,255,.92)", fontWeight: 800, fontSize: 10.5, boxShadow: "0 4px 12px rgba(0,0,0,.15)" }}>
          <AnimatePresence mode="wait"><motion.span key={lang.code} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>{lang.flag} {lang.code}</motion.span></AnimatePresence>
        </motion.div>
      </div>
      <div style={{ padding: "24px 14px 6px", flexShrink: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-.02em" }}>{data.name}</div>
        <AnimatePresence mode="wait">
          <motion.div key={lang.code} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.3 }} style={{ fontSize: 11, color: active === "idiomas" ? c : "#999", fontWeight: 700, marginTop: 2 }}>
            {lang.title}{active === "idiomas" && li > 0 ? " · traducido automáticamente" : ""}
          </motion.div>
        </AnimatePresence>
        {active === "filtros" ? (
          <div style={{ display: "flex", gap: 5, marginTop: 9, overflow: "hidden" }}>
            {DIETS.map((d, i) => (
              <span key={d} style={{ padding: "4px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", background: i === di ? c : "#f2f2f2", color: i === di ? onColor(c) : "#555", transition: "all .35s" }}>{d}</span>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 12, marginTop: 10, overflow: "hidden", whiteSpace: "nowrap", fontWeight: 700, fontSize: 11 }}>
            {cats.map((n, i) => <span key={n} style={{ color: i === 0 ? c : "#999", borderBottom: i === 0 ? `2px solid ${c}` : "none", paddingBottom: 3 }}>{n}</span>)}
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflow: "hidden", padding: "6px 12px 12px", position: "relative" }}>
        <motion.div layout style={{ display: "grid", gap: 8 }}>
          {dishes.slice(0, 6).map((d) => (
            <motion.div layout key={d.name} transition={{ duration: 0.45, ease: EASE }} style={{ display: "flex", gap: 10, alignItems: "center", padding: 7, borderRadius: 13, background: "#fafafa" }}>
              <div style={{ width: 50, height: 50, flexShrink: 0 }}><DishImage dish={d} color={c} radius={10} /></div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 3 }}>
                  <span style={{ fontFamily: "var(--demo-mono)", fontWeight: 700, fontSize: 11.5 }}>{d.price > 0 ? clp(d.price) : ""}</span>
                  <AnimatePresence mode="wait"><motion.span key={lang.code} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ fontSize: 9.5, fontWeight: 800, color: c }}>{lang.add} +</motion.span></AnimatePresence>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Botón llamar al garzón */}
        <motion.div initial={false} animate={{ scale: active === "garzon" ? [1, 1.14, 1] : 1 }} transition={{ duration: 0.8, repeat: active === "garzon" ? Infinity : 0, repeatDelay: 1 }}
          style={{ position: "absolute", right: 12, bottom: 12, width: 44, height: 44, borderRadius: 99, background: c, color: onColor(c), display: "grid", placeItems: "center", boxShadow: `0 8px 20px -4px ${rgba(c, 0.6)}` }}>
          <Bell size={19} />
        </motion.div>

        {/* Recomendaciones del plato */}
        <AnimatePresence>
          {active === "recomienda" && hero && (
            <motion.div key="rec" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ duration: 0.65, ease: EASE }}
              style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "12px 12px 16px", background: "#fff", borderRadius: "22px 22px 0 0", boxShadow: "0 -12px 40px rgba(0,0,0,.16)" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ width: 54, height: 54, flexShrink: 0 }}><DishImage dish={hero} color={c} radius={12} /></div>
                <div style={{ minWidth: 0 }}><b style={{ fontSize: 13 }}>{hero.name}</b><div style={{ fontFamily: "var(--demo-mono)", fontSize: 11.5, fontWeight: 700 }}>{hero.price > 0 ? clp(hero.price) : ""}</div></div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 800, fontSize: 11.5, margin: "12px 0 8px", color: c }}><Sparkles size={13} /> {LANGS[0].rec}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {all.slice(1, 3).map((d, i) => (
                  <motion.div key={d.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 + i * 0.2, duration: 0.5, ease: EASE }} style={{ borderRadius: 12, overflow: "hidden", background: "#f7f7f7" }}>
                    <div style={{ height: 58 }}><DishImage dish={d} color={c} radius={0} /></div>
                    <div style={{ padding: "6px 7px" }}><div style={{ fontWeight: 700, fontSize: 10.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</div><div style={{ fontFamily: "var(--demo-mono)", fontSize: 10, fontWeight: 700 }}>{d.price > 0 ? `+ ${clp(d.price)}` : ""}</div></div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Cartas en PDF con distintos diseños ────────────────────────────────────
function PaperMenus({ data, narrow }: { data: DemoData; narrow: boolean }) {
  const c = data.color;
  const dishes = featuredDishes(data, 6);
  const styles = [
    { name: "Clásica", bg: "#fbf8f1", ink: "#2b2118", accent: c, serif: true, rot: 12, x: narrow ? 120 : 285, y: 34 },
    { name: "Moderna", bg: "#111", ink: "#f5f5f5", accent: c, serif: false, rot: 5, x: narrow ? 80 : 180, y: -4 },
  ];
  const w = narrow ? 150 : 205;
  return (
    <>
      {styles.map((s, i) => (
        <motion.div key={s.name} initial={{ opacity: 0, x: 0, rotate: 0, y: 20 }} animate={{ opacity: 1, x: s.x, rotate: s.rot, y: s.y }} exit={{ opacity: 0, x: 0, rotate: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.15 + i * 0.12 }}
          style={{ position: "absolute", top: "8%", left: 0, width: w, aspectRatio: "0.707", zIndex: 1, borderRadius: 6, background: s.bg, color: s.ink, padding: w * 0.09, boxSizing: "border-box", boxShadow: "0 30px 60px -20px rgba(0,0,0,.45)", fontFamily: s.serif ? "Georgia, 'Times New Roman', serif" : "var(--demo-sans)", overflow: "hidden" }}>
          <div style={{ textAlign: "center", borderBottom: `1.5px solid ${s.accent}`, paddingBottom: 6 }}>
            <div style={{ fontSize: w * 0.075, fontWeight: 800, letterSpacing: s.serif ? 0 : "-.02em" }}>{data.name}</div>
            <div style={{ fontSize: w * 0.045, color: s.accent, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", marginTop: 2 }}>Carta</div>
          </div>
          <div style={{ display: "grid", gap: w * 0.03, marginTop: w * 0.06 }}>
            {dishes.map((d) => (
              <div key={d.name} style={{ display: "flex", justifyContent: "space-between", gap: 6, fontSize: w * 0.05 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
                <span style={{ fontWeight: 700, color: s.accent }}>{d.price > 0 ? clp(d.price) : ""}</span>
              </div>
            ))}
          </div>
          <div style={{ position: "absolute", right: w * 0.07, bottom: w * 0.07, display: "flex", alignItems: "center", gap: 4, fontSize: w * 0.04, opacity: 0.7 }}><QrCode size={w * 0.09} /> Escanea</div>
        </motion.div>
      ))}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: 0.8 }}
        style={{ position: "absolute", left: narrow ? 60 : 210, bottom: narrow ? -6 : "2%", zIndex: 3, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: 99, background: "#fff", fontWeight: 700, fontSize: 13, boxShadow: "0 14px 34px -12px rgba(0,0,0,.35)" }}>
        <FileText size={15} color={c} /> Exportar PDF · elige el diseño
      </motion.div>
    </>
  );
}
