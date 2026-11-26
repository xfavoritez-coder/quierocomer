"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { DemoData, DemoDish } from "./types";

// ── Color ─────────────────────────────────────────────────────────────────
export function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
export const rgba = (hex: string, a: number) => { const { r, g, b } = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };
/** Texto legible (blanco o casi negro) sobre el color dado. */
export function onColor(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? "#111111" : "#FFFFFF";
}
/** Aclara el color (para usarlo como acento sobre fondo negro). */
export function lighten(hex: string, amt: number) {
  const { r, g, b } = hexToRgb(hex);
  const f = (v: number) => Math.round(v + (255 - v) * amt).toString(16).padStart(2, "0");
  return `#${f(r)}${f(g)}${f(b)}`;
}

export const clp = (n: number) => "$" + Math.round(n || 0).toLocaleString("es-CL");

// ── Animación ─────────────────────────────────────────────────────────────
export const EASE = [0.22, 1, 0.36, 1] as const; // curva suave tipo Apple

/** Aparece al llegar a `at` (paso del capítulo). */
export function Reveal({ step, at = 0, children, y = 24, delay = 0, style, className }: { step: number; at?: number; children: ReactNode; y?: number; delay?: number; style?: CSSProperties; className?: string }) {
  const reduce = useReducedMotion();
  const on = step >= at;
  return (
    <motion.div
      className={className}
      initial={false}
      animate={on ? { opacity: 1, y: 0, filter: "blur(0px)" } : { opacity: 0, y: reduce ? 0 : y, filter: reduce ? "blur(0px)" : "blur(8px)" }}
      transition={{ duration: reduce ? 0 : 0.9, ease: EASE, delay: on ? delay : 0 }}
      style={{ ...style, pointerEvents: on ? undefined : "none" }}
    >
      {children}
    </motion.div>
  );
}

/** Número que cuenta hacia arriba (formato CLP opcional). */
export function CountUp({ value, run, money = true, duration = 1.6, style }: { value: number; run: boolean; money?: boolean; duration?: number; style?: CSSProperties }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => (money ? clp(v) : Math.round(v).toLocaleString("es-CL")));
  useEffect(() => {
    if (!run) { mv.set(0); return; }
    if (reduce) { mv.set(value); return; }
    const c = animate(mv, value, { duration, ease: EASE });
    return () => c.stop();
  }, [run, value, duration, reduce, mv]);
  return <motion.span style={{ fontFamily: "var(--demo-mono)", fontVariantNumeric: "tabular-nums", ...style }}>{text}</motion.span>;
}

// ── Tipografía ────────────────────────────────────────────────────────────
export function Eyebrow({ children, color }: { children: ReactNode; color: string }) {
  return <div style={{ fontSize: "clamp(13px, 1.2vw, 16px)", fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color }}>{children}</div>;
}

export function Headline({ children, size = "xl", style }: { children: ReactNode; size?: "xl" | "lg" | "md"; style?: CSSProperties }) {
  const fs = size === "xl" ? "clamp(44px, 6.6vw, 96px)" : size === "lg" ? "clamp(36px, 4.8vw, 72px)" : "clamp(28px, 3.2vw, 48px)";
  return <h2 style={{ fontSize: fs, fontWeight: 750, letterSpacing: "-0.045em", lineHeight: 1.02, margin: 0, ...style }}>{children}</h2>;
}

/** Texto con degradado del color del local. */
export function BrandText({ children, color }: { children: ReactNode; color: string }) {
  return (
    <span style={{ background: `linear-gradient(100deg, ${lighten(color, 0.25)} 0%, ${color} 45%, ${lighten(color, 0.5)} 100%)`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
      {children}
    </span>
  );
}

// ── Contenido del local ───────────────────────────────────────────────────
/** Foto del plato o, si no tiene, su emoji sobre un degradado del color del local. */
export function DishImage({ dish, color, style, radius = 12 }: { dish: DemoDish; color: string; style?: CSSProperties; radius?: number }) {
  if (dish.photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={dish.photo} alt="" loading="eager" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: radius, display: "block", ...style }} />;
  }
  return (
    <div style={{ width: "100%", height: "100%", borderRadius: radius, display: "grid", placeItems: "center", background: `radial-gradient(120% 120% at 30% 20%, ${lighten(color, 0.55)} 0%, ${lighten(color, 0.2)} 55%, ${color} 100%)`, fontSize: "clamp(18px, 2.2vw, 34px)", ...style }}>
      <span aria-hidden>{dish.emoji || dishEmoji(dish.name)}</span>
    </div>
  );
}

// Ícono según el nombre del plato (cuando no tiene foto).
const EMOJI_RULES: [RegExp, string][] = [
  [/roll|maki|sushi|nigiri|sashimi|handroll|hand roll|gyoza/i, "🍣"], [/tempura|ebi|camar[oó]n/i, "🍤"], [/ceviche|marisco|machas|ostra/i, "🦐"],
  [/pizza/i, "🍕"], [/burger|hamburgues/i, "🍔"], [/papas|fritas/i, "🍟"], [/taco|burrito|quesadilla|nacho/i, "🌮"], [/ramen|sopa|caldo|cazuela/i, "🍜"],
  [/empanad/i, "🥟"], [/s[aá]ndwich|churrasco|chacarero|barros|completo|italiano|hot ?dog/i, "🥪"], [/ensalad|bowl|poke/i, "🥗"],
  [/pollo|chicken|alitas/i, "🍗"], [/lomo|carne|filete|bife|parrilla|costilla|asado|plateada/i, "🥩"], [/salm[oó]n|pescad|merluza|reineta|at[uú]n/i, "🐟"],
  [/pasta|spaghetti|fettuccin|ravioli|lasa[gñ]/i, "🍝"], [/arroz|risotto|paella|chaufa/i, "🍚"], [/queso|provoleta|tabla/i, "🧀"],
  [/helado|sorbete/i, "🍨"], [/torta|pastel|cake|cheesecake|kuchen|postre|brownie|tiramis/i, "🍰"], [/donut|dona|churro|calzones/i, "🍩"],
  [/caf[eé]|espresso|latte|capuchino|cortado|americano/i, "☕"], [/t[eé]\b|infusi[oó]n/i, "🍵"], [/limonada|lim[oó]n/i, "🍋"], [/jugo|smoothie|batido/i, "🧃"],
  [/agua/i, "💧"], [/cerveza|schop|beer/i, "🍺"], [/vino|carmenere|cabernet|merlot|sauvignon/i, "🍷"], [/sour|mojito|c[oó]ctel|trago|spritz|piscola|terremoto/i, "🍸"],
  [/bebida|coca|sprite|fanta|gaseosa/i, "🥤"],
];
export function dishEmoji(name: string): string {
  for (const [re, e] of EMOJI_RULES) if (re.test(name)) return e;
  return "🍽️";
}

export function LocalLogo({ data, size = 56, radius }: { data: DemoData; size?: number; radius?: number }) {
  const r = radius ?? Math.round(size * 0.24);
  if (data.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={data.logoUrl} alt={data.name} style={{ width: size, height: size, objectFit: "contain", borderRadius: r, background: "#fff", padding: Math.round(size * 0.08), boxSizing: "border-box" }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: r, background: data.color, color: onColor(data.color), display: "grid", placeItems: "center", fontWeight: 800, fontSize: size * 0.46, letterSpacing: "-.04em" }}>
      {data.name.trim().charAt(0).toUpperCase()}
    </div>
  );
}

export { featuredDishes, avgTicket, demoPrize } from "./dishes";

// ── Tamaño de pantalla ────────────────────────────────────────────────────
export function useViewport() {
  const [vp, setVp] = useState({ w: 1440, h: 900 });
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return { ...vp, narrow: vp.w < 820 };
}

/** Contenedor centrado de un capítulo (deja espacio para la barra y el progreso). */
export function Stage({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ position: "absolute", inset: 0, padding: "clamp(92px, 12vh, 118px) clamp(20px, 5vw, 80px) 64px", display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box", ...style }}>
      {children}
    </div>
  );
}

/** Invitación a probar en el celular, apuntando al botón QR (abajo a la derecha). */
export function TryItHint({ show, color, text = "Pruébalo en tu celular" }: { show: boolean; color: string; text?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div initial={false} animate={show ? { opacity: 1, x: 0 } : { opacity: 0, x: 16 }} transition={{ duration: 0.6, ease: EASE, delay: show ? 1.2 : 0 }}
      style={{ position: "absolute", right: 90, bottom: 40, zIndex: 9, display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 99, background: "#111", color: "#fff", fontWeight: 700, fontSize: 15, boxShadow: "0 16px 40px -12px rgba(0,0,0,.5)", pointerEvents: "none" }}>
      📱 {text}
      <motion.span animate={reduce || !show ? {} : { x: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.2 }} style={{ color }}>→</motion.span>
    </motion.div>
  );
}

/** Botón para abrir el QR y probar en el celular (reemplaza al botón flotante). */
export function QrPill({ label, color, onClick, dark = false, delay = 0.8, style }: { label: string; color: string; onClick?: () => void; dark?: boolean; delay?: number; style?: CSSProperties }) {
  const reduce = useReducedMotion();
  if (!onClick) return null;
  return (
    <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE, delay }} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "11px 18px 11px 12px", borderRadius: 99, border: "none", cursor: "pointer", font: "inherit", fontWeight: 700, fontSize: 15,
        background: dark ? "#fff" : "#111", color: dark ? "#111" : "#fff", boxShadow: "0 16px 40px -14px rgba(0,0,0,.5)", ...style }}>
      <span style={{ width: 30, height: 30, borderRadius: 99, display: "grid", placeItems: "center", background: color, color: onColor(color) }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h3v3"/></svg>
      </span>
      {label}
      <motion.span animate={reduce ? {} : { y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 1.3 }} style={{ color }}>↑</motion.span>
    </motion.button>
  );
}
