"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { FONT_LINK, type Section } from "@/components/exportar/ExportarCarta";
import TemaCarbon from "@/components/exportar/temas/TemaCarbon";
import TemaHuerto from "@/components/exportar/temas/TemaHuerto";
import TemaMedit from "@/components/exportar/temas/TemaMedit";
import TemaPiedra from "@/components/exportar/temas/TemaPiedra";
import { Bell, Languages, Sparkles, Leaf, FileText, X, Eye } from "lucide-react";
import type { ChapterProps } from "../DemoShell";
import type { DemoData } from "../types";
import { PhoneFrame } from "../frames";
import { BrandText, DishImage, EASE, Eyebrow, Headline, LocalLogo, QrPill, Reveal, Stage, clp, featuredDishes, onColor, rgba, useViewport } from "../ui";

// Una función por paso (paso 1 = la primera). Todas quedan a la vista; la activa se destaca.
const FEATURES = [
  { id: "idiomas", icon: Languages, title: "Habla el idioma de cada cliente", sub: "Tu carta se traduce sola a inglés, portugués y más. El turista entiende lo que pide." },
  { id: "recomienda", icon: Sparkles, title: "Recomendaciones inteligentes", sub: "En cada plato sugiere con qué acompañarlo. Más platos por mesa, sin que el garzón insista." },
  { id: "garzon", icon: Bell, title: "Llamar al garzón", sub: "Tocan la campana en la mesa y te llega el aviso al instante." },
  { id: "filtros", icon: Leaf, title: "Filtros para cada dieta", sub: "Vegano, vegetariano, sin gluten, picante. Cada uno encuentra lo suyo en segundos." },
  { id: "pdf", icon: FileText, title: "Tu carta impresa, con diseño", sub: "Exporta tu carta en PDF con distintos diseños. Papel y QR, siempre con los mismos precios." },
] as const;
type FeatureId = (typeof FEATURES)[number]["id"];

export const cartaSteps = FEATURES.length + 1;

/** Foto de portada: el banner del local o, si no tiene, la foto de uno de sus platos. */
export function coverPhoto(data: DemoData): string | null {
  return data.bannerUrl || featuredDishes(data, 12).find((d) => d.photo)?.photo || null;
}

export default function CartaQR({ data, step, onQr }: ChapterProps) {
  const { narrow } = useViewport();
  const reduce = useReducedMotion();
  const c = data.color;
  const [preview, setPreview] = useState<string | null>(null); // diseño de carta impresa a mostrar

  const intro = step === 0;
  const active: FeatureId = FEATURES[Math.max(1, Math.min(step, FEATURES.length)) - 1].id;

  return (
    <AnimatePresence mode="wait" initial={false}>
      {intro ? (
        <motion.div key="intro" style={{ position: "absolute", inset: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.25, filter: "blur(24px)" }} transition={{ duration: 0.7, ease: EASE }}>
          <Stage style={{ flexDirection: "column", textAlign: "center" }}>
            <Reveal step={step} at={0}><Eyebrow color={c}>Carta QR inteligente</Eyebrow></Reveal>
            <Reveal step={step} at={0} delay={0.15}><Headline style={{ marginTop: 18 }}>Papel y digital.</Headline></Reveal>
            <Reveal step={step} at={0} delay={0.45}><Headline style={{ marginTop: 6 }}><BrandText color={c}>Mejor juntos.</BrandText></Headline></Reveal>
            <Reveal step={step} at={0} delay={0.8}>
              <div style={{ fontSize: "clamp(17px, 1.6vw, 22px)", color: "rgba(0,0,0,.5)", marginTop: 22, maxWidth: 660, lineHeight: 1.45 }}>
                Tu carta de siempre en la mesa, y una carta digital que además traduce, recomienda y llama al garzón en el celular de cada cliente.
              </div>
            </Reveal>
          </Stage>
        </motion.div>
      ) : (
        <motion.div key="main" style={{ position: "absolute", inset: 0 }} initial={{ opacity: 1 }} animate={{ opacity: 1 }}>
          <Stage style={{ gap: "clamp(28px, 5vw, 96px)", flexDirection: narrow ? "column" : "row" }}>
            <div style={{ flex: "1 1 0", maxWidth: 540, minWidth: 0 }}>
              <motion.div initial={reduce ? false : { opacity: 0, x: -60, filter: "blur(12px)" }} animate={{ opacity: 1, x: 0, filter: "blur(0px)" }} transition={{ duration: 0.9, ease: EASE, delay: 0.35 }}>
                <Eyebrow color={c}>Carta QR inteligente · {data.name}</Eyebrow>
                <Headline size="md" style={{ marginTop: 12 }}>Tu carta, siempre al día.<br /><BrandText color={c}>Y además vende.</BrandText></Headline>
              </motion.div>
              <div style={{ marginTop: "clamp(16px, 3vh, 30px)", display: "grid", gap: 2 }}>
                {FEATURES.map((f, i) => {
                  const on = f.id === active;
                  if (narrow && !on) return null;
                  return (
                    <motion.div key={f.id} initial={reduce ? false : { opacity: 0, y: 18 }} animate={{ opacity: on ? 1 : 0.38, y: 0 }} transition={{ duration: 0.6, ease: EASE, delay: 0.6 + i * 0.08 }}
                      style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "10px 0", borderTop: i && !narrow ? "1px solid rgba(0,0,0,.06)" : "none" }}>
                      <motion.div initial={false} animate={{ background: on ? c : rgba(c, 0.1), color: on ? onColor(c) : c, scale: on ? 1.06 : 1 }} transition={{ duration: 0.5, ease: EASE }}
                        style={{ width: 40, height: 40, borderRadius: 13, flexShrink: 0, display: "grid", placeItems: "center" }}><f.icon size={19} /></motion.div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: "clamp(17px, 1.5vw, 21px)", fontWeight: 700, letterSpacing: "-.02em", lineHeight: 1.25, paddingTop: 8 }}>{f.title}</div>
                        <AnimatePresence initial={false}>
                          {on && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.45, ease: EASE }} style={{ overflow: "hidden" }}>
                              <div style={{ fontSize: "clamp(14px, 1.2vw, 16.5px)", color: "rgba(0,0,0,.55)", marginTop: 4, lineHeight: 1.45 }}>{f.sub}</div>
                              {f.id === "garzon" && data.slug && <QrPill label="Pruébalo: escanea y toca la campana" color={c} onClick={onQr} delay={0.4} style={{ marginTop: 12, fontSize: 14 }} />}
                              {f.id === "pdf" && <PdfPicker data={data} onShow={setPreview} />}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Celular: entra con fuerza al pasar de la portada a las funciones */}
            <div style={{ position: "relative", flexShrink: 0, perspective: 1400 }}>
              {/* Cartas impresas que salen del celular */}
              <AnimatePresence>{active === "pdf" && <PaperMenus data={data} narrow={narrow} />}</AnimatePresence>
              <motion.div initial={reduce ? false : { opacity: 0, y: 260, rotateX: 38, rotateZ: -6, scale: 1.35, filter: "blur(16px)" }}
                animate={{ opacity: 1, y: 0, rotateX: 0, rotateZ: 0, scale: 1, filter: "blur(0px)", x: active === "pdf" && !narrow ? -80 : 0 }} transition={{ duration: 1.1, ease: EASE }}
                style={{ position: "relative", zIndex: 2 }}>
                <PhoneFrame width={narrow ? 210 : 290}>
                  <CartaPhone data={data} active={active} />
                </PhoneFrame>
              </motion.div>
              {/* Brillo detrás del celular */}
              <motion.div aria-hidden initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.6, ease: EASE, delay: 0.4 }}
                style={{ position: "absolute", inset: "-14%", zIndex: -1, borderRadius: "50%", background: `radial-gradient(closest-side, ${rgba(c, 0.28)}, transparent)` }} />
            </div>
          </Stage>

          {/* Vista de la carta impresa del local con el diseño elegido */}
          <AnimatePresence>{preview && <PrintPreview data={data} template={preview} onChange={setPreview} onClose={() => setPreview(null)} />}</AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Banderas (SVG: los emojis de bandera no se ven en Windows) ─────────────
function Flag({ code, size = 14 }: { code: string; size?: number }) {
  const w = size * 1.45, h = size;
  const s = { width: w, height: h, borderRadius: 2, display: "block", boxShadow: "0 0 0 .5px rgba(0,0,0,.2)" } as const;
  if (code === "ES") return (<svg viewBox="0 0 30 20" style={s}><rect width="30" height="20" fill="#d52b1e" /><rect width="30" height="10" fill="#fff" /><rect width="10" height="10" fill="#0039a6" /><path d="M5 2.4l.9 2.6h2.7l-2.2 1.6.9 2.6L5 7.6 2.7 9.2l.9-2.6-2.2-1.6h2.7z" fill="#fff" /></svg>);
  if (code === "EN") return (<svg viewBox="0 0 30 20" style={s}><rect width="30" height="20" fill="#fff" />{Array.from({ length: 7 }).map((_, i) => <rect key={i} y={i * 2.86} width="30" height="1.43" fill="#b22234" />)}<rect width="13" height="10.7" fill="#3c3b6e" /></svg>);
  if (code === "PT") return (<svg viewBox="0 0 30 20" style={s}><rect width="30" height="20" fill="#009c3b" /><path d="M15 2.5L27 10 15 17.5 3 10z" fill="#ffdf00" /><circle cx="15" cy="10" r="4.6" fill="#002776" /></svg>);
  return (<svg viewBox="0 0 30 20" style={s}><rect width="10" height="20" fill="#0055a4" /><rect x="10" width="10" height="20" fill="#fff" /><rect x="20" width="10" height="20" fill="#ef4135" /></svg>);
}

// ── Celular con la carta del local ─────────────────────────────────────────
const LANGS = [
  { code: "ES", title: "Nuestra carta", add: "Agregar" },
  { code: "EN", title: "Our menu", add: "Add" },
  { code: "PT", title: "Nosso cardápio", add: "Adicionar" },
  { code: "FR", title: "Notre carte", add: "Ajouter" },
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
  const dishes = active === "filtros" ? [...all.slice(di % 3), ...all.slice(0, di % 3)] : all;
  const cats = data.categories.slice(0, 5).map((x) => x.name);
  const hero = dishes[0];
  const cover = coverPhoto(data);
  const calling = active === "garzon";

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", fontSize: 12, color: "#111", background: "#fff" }}>
      <div style={{ height: 112, position: "relative", flexShrink: 0, background: cover ? `center/cover url(${cover})` : `linear-gradient(135deg, ${c}, ${rgba(c, 0.7)})` }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.05) 30%, rgba(0,0,0,.45))" }} />
        <div style={{ position: "absolute", left: 14, bottom: -18, borderRadius: 14, boxShadow: "0 6px 18px rgba(0,0,0,.2)" }}><LocalLogo data={data} size={44} radius={14} /></div>
        <motion.div initial={false} animate={{ scale: active === "idiomas" ? 1.08 : 1 }}
          style={{ position: "absolute", right: 10, top: 36, display: "flex", alignItems: "center", gap: 5, padding: "4px 8px 4px 5px", borderRadius: 99, background: "rgba(255,255,255,.94)", fontWeight: 800, fontSize: 10.5, boxShadow: "0 4px 12px rgba(0,0,0,.15)" }}>
          <AnimatePresence mode="wait"><motion.span key={lang.code} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }} style={{ display: "flex", alignItems: "center", gap: 5 }}><Flag code={lang.code} size={11} /> {lang.code}</motion.span></AnimatePresence>
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
            {DIETS.map((d, i) => <span key={d} style={{ padding: "4px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", background: i === di ? c : "#f2f2f2", color: i === di ? onColor(c) : "#555", transition: "all .35s" }}>{d}</span>)}
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

        {/* Campana del garzón: al llamar, tirita con ondas */}
        <div style={{ position: "absolute", right: 12, bottom: 12 }}>
          {calling && [0, 1].map((i) => (
            <motion.span key={i} initial={{ scale: 1, opacity: 0.55 }} animate={{ scale: 2.3, opacity: 0 }} transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.8, ease: "easeOut" }}
              style={{ position: "absolute", inset: 0, borderRadius: 99, background: c }} />
          ))}
          <motion.div initial={false} animate={{ scale: calling ? [1, 1.12, 1] : 1, rotate: calling ? [0, -14, 12, -8, 0] : 0 }} transition={{ duration: 0.9, repeat: calling ? Infinity : 0, repeatDelay: 0.8 }}
            style={{ position: "relative", width: 44, height: 44, borderRadius: 99, background: c, color: onColor(c), display: "grid", placeItems: "center", boxShadow: `0 8px 20px -4px ${rgba(c, 0.6)}` }}>
            <Bell size={19} />
          </motion.div>
        </div>

        {/* Recomendaciones del plato */}
        <AnimatePresence>
          {active === "recomienda" && hero && (
            <motion.div key="rec" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ duration: 0.65, ease: EASE }}
              style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "12px 12px 16px", background: "#fff", borderRadius: "22px 22px 0 0", boxShadow: "0 -12px 40px rgba(0,0,0,.16)" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ width: 54, height: 54, flexShrink: 0 }}><DishImage dish={hero} color={c} radius={12} /></div>
                <div style={{ minWidth: 0 }}><b style={{ fontSize: 13 }}>{hero.name}</b><div style={{ fontFamily: "var(--demo-mono)", fontSize: 11.5, fontWeight: 700 }}>{hero.price > 0 ? clp(hero.price) : ""}</div></div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 800, fontSize: 11.5, margin: "12px 0 8px", color: c }}><Sparkles size={13} /> Va perfecto con</div>
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

        {/* Exportar PDF */}
        <AnimatePresence>
          {active === "pdf" && (
            <motion.div key="pdf" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ duration: 0.6, ease: EASE }}
              style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "14px 12px 16px", background: "#fff", borderRadius: "22px 22px 0 0", boxShadow: "0 -12px 40px rgba(0,0,0,.16)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 800, fontSize: 12.5 }}><FileText size={14} color={c} /> Exportar carta en PDF</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5, marginTop: 10 }}>
                {TEMPLATES.map((t, i) => (
                  <div key={t.key} style={{ borderRadius: 8, padding: 5, background: i === 0 ? rgba(c, 0.1) : "#f5f5f5", boxShadow: i === 0 ? `inset 0 0 0 1.5px ${c}` : "none", textAlign: "center" }}>
                    <MiniSheet template={t.key} color={c} />
                    <div style={{ fontSize: 8.5, fontWeight: 700, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, borderRadius: 10, padding: "8px 0", textAlign: "center", fontWeight: 800, fontSize: 11, background: c, color: onColor(c) }}>Descargar PDF</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Carta impresa: los mismos diseños de /panel/exportar ───────────────────
const TEMPLATES = [
  { key: "carbon", label: "Carbón", desc: "Oscuro y dorado", bg: "#141414", ink: "#f3ead8", accent: "#d8ad57" },
  { key: "huerto", label: "Huerto", desc: "Natural y fresco", bg: "#f4efe2", ink: "#23331f", accent: "#3f6b4c" },
  { key: "medit", label: "Mediterráneo", desc: "Claro y elegante", bg: "#fbfaf6", ink: "#1d2c3c", accent: "#2f5d8a" },
  { key: "piedra", label: "Piedra", desc: "Sobrio y cálido", bg: "#e9e4dc", ink: "#2d2925", accent: "#8a7e72" },
] as const;
type TemplateKey = (typeof TEMPLATES)[number]["key"];

function MiniSheet({ template }: { template: string; color?: string }) {
  const t = TEMPLATES.find((x) => x.key === template) ?? TEMPLATES[0];
  return (
    <div style={{ aspectRatio: "0.72", borderRadius: 3, background: t.bg, padding: 4, boxSizing: "border-box", boxShadow: "0 2px 6px rgba(0,0,0,.15)", display: "grid", gap: 3, alignContent: "start" }}>
      <div style={{ height: 3, width: "55%", margin: "1px auto 2px", borderRadius: 2, background: t.accent }} />
      {[0, 1, 2, 3].map((i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 2 }}><div style={{ height: 2, width: "60%", borderRadius: 2, background: t.ink, opacity: 0.5 }} /><div style={{ height: 2, width: "18%", borderRadius: 2, background: t.accent }} /></div>)}
    </div>
  );
}

/** Secciones de la carta del local en el formato de los diseños de exportación. */
function toSections(data: DemoData): Section[] {
  return data.categories.map((cat) => ({
    titulo: cat.name,
    platos: cat.dishes.filter((d) => d.name.trim() && d.price > 0).map((d) => ({ nombre: d.name, descripcion: d.description || null, precio: clp(d.price), precioDescuento: null, foto: d.photo })),
  })).filter((s) => s.platos.length);
}

/** Hojas de la carta impresa, con los diseños reales, saliendo del iPhone. */
function PaperMenus({ data, narrow }: { data: DemoData; narrow: boolean }) {
  const dishes = featuredDishes(data, 7).filter((d) => d.price > 0);
  const w = narrow ? 140 : 190;
  const spots = [
    { x: narrow ? 70 : 150, y: -10, rot: 4 },
    { x: narrow ? 110 : 235, y: 22, rot: 10 },
    { x: narrow ? 150 : 320, y: 58, rot: 16 },
  ];
  return (
    <>
      {TEMPLATES.slice(0, 3).map((t, i) => {
        const sp = spots[i];
        return (
          <motion.div key={t.key} initial={{ opacity: 0, x: 40, y: 120, rotate: 0, scale: 0.5 }} animate={{ opacity: 1, x: sp.x, y: sp.y, rotate: sp.rot, scale: 1 }} exit={{ opacity: 0, x: 40, y: 120, scale: 0.5 }}
            transition={{ duration: 1, ease: EASE, delay: 0.25 + (2 - i) * 0.15 }}
            style={{ position: "absolute", top: "12%", left: 0, zIndex: 1 + (2 - i), width: w, aspectRatio: "0.707", borderRadius: 4, background: t.bg, color: t.ink, padding: w * 0.09, boxSizing: "border-box",
              boxShadow: "0 30px 60px -20px rgba(0,0,0,.45)", fontFamily: "'Cormorant Garamond', Georgia, serif", overflow: "hidden" }}>
            <div style={{ textAlign: "center", borderBottom: `1.5px solid ${t.accent}`, paddingBottom: 6 }}>
              <div style={{ fontSize: w * 0.085, fontWeight: 700, letterSpacing: ".04em" }}>{data.name}</div>
              <div style={{ fontSize: w * 0.045, color: t.accent, fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase", marginTop: 2 }}>Carta</div>
            </div>
            <div style={{ display: "grid", gap: w * 0.03, marginTop: w * 0.06 }}>
              {dishes.map((d) => (
                <div key={d.name} style={{ display: "flex", justifyContent: "space-between", gap: 6, fontSize: w * 0.052 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
                  <span style={{ fontWeight: 700, color: t.accent }}>{clp(d.price)}</span>
                </div>
              ))}
            </div>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: w * 0.06, textAlign: "center", fontSize: w * 0.042, color: t.accent, letterSpacing: ".1em" }}>{t.label.toUpperCase()}</div>
          </motion.div>
        );
      })}
    </>
  );
}

/** Selector de diseño en el texto: elige y "Ver" abre su carta con ese diseño. */
function PdfPicker({ data, onShow }: { data: DemoData; onShow: (t: string) => void }) {
  const c = data.color;
  const [sel, setSel] = useState<TemplateKey>("carbon");
  return (
    <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
        {TEMPLATES.map((t) => (
          <button key={t.key} onClick={() => setSel(t.key)} style={{ border: "none", cursor: "pointer", font: "inherit", textAlign: "center", padding: 6, borderRadius: 12, background: "#fff",
            boxShadow: sel === t.key ? `0 0 0 2px ${c}` : "0 0 0 1px rgba(0,0,0,.1)" }}>
            <div style={{ width: 38, margin: "0 auto" }}><MiniSheet template={t.key} /></div>
            <div style={{ fontWeight: 750, fontSize: 12.5, marginTop: 5 }}>{t.label}</div>
          </button>
        ))}
      </div>
      <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => onShow(sel)}
        style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: 99, border: "none", cursor: "pointer", font: "inherit", fontWeight: 750, fontSize: 15, background: c, color: onColor(c), boxShadow: `0 14px 34px -12px ${rgba(c, 0.8)}` }}>
        <Eye size={17} /> Ver mi carta en {TEMPLATES.find((t) => t.key === sel)?.label}
      </motion.button>
    </div>
  );
}

/** La carta del local con el diseño de exportación elegido (mismo componente de /panel/exportar). */
function PrintPreview({ data, template, onChange, onClose }: { data: DemoData; template: string; onChange: (t: string) => void; onClose: () => void }) {
  const c = data.color;
  const { w } = useViewport();
  const [qr, setQr] = useState("");
  useEffect(() => {
    QRCode.toDataURL(`https://quierocomer.com/qr/${data.slug ?? ""}`, { width: 200, margin: 1, errorCorrectionLevel: "H" }).then(setQr).catch(() => {});
  }, [data.slug]);
  const Tema = template === "huerto" ? TemaHuerto : template === "medit" ? TemaMedit : template === "piedra" ? TemaPiedra : TemaCarbon;
  const sheetW = Math.min(860, w - 40);
  const zoom = sheetW / 794;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} onClick={(e) => { e.stopPropagation(); onClose(); }}
      style={{ position: "absolute", inset: 0, zIndex: 35, background: "rgba(10,10,12,.72)", backdropFilter: "blur(18px)", display: "flex", flexDirection: "column", alignItems: "center", padding: "70px 20px 24px", boxSizing: "border-box" }}>
      <link rel="stylesheet" href={FONT_LINK} />
      <motion.div onClick={(e) => e.stopPropagation()} initial={{ y: 40, scale: 0.96, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 30, opacity: 0 }} transition={{ duration: 0.55, ease: EASE }}
        style={{ width: sheetW, flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 18, marginRight: "auto" }}>Carta impresa de {data.name}</div>
          {TEMPLATES.map((t) => (
            <button key={t.key} onClick={() => onChange(t.key)} style={{ border: "none", cursor: "pointer", font: "inherit", fontWeight: 700, fontSize: 13, padding: "8px 14px", borderRadius: 99,
              background: template === t.key ? c : "rgba(255,255,255,.12)", color: template === t.key ? onColor(c) : "#fff" }}>{t.label}</button>
          ))}
          <button onClick={onClose} aria-label="Cerrar" style={{ border: "none", cursor: "pointer", width: 38, height: 38, borderRadius: 99, background: "rgba(255,255,255,.12)", color: "#fff", display: "grid", placeItems: "center" }}><X size={18} /></button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", borderRadius: 10, boxShadow: "0 40px 100px -30px rgba(0,0,0,.7)", userSelect: "text" }}>
          <AnimatePresence mode="wait">
            <motion.div key={template} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} style={{ width: 794, zoom }}>
              <Tema restaurant={{ name: data.name, logoUrl: data.logoUrl, address: null, phone: null }} sections={toSections(data)} incluirFotos qrDataUrl={qr} />
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
