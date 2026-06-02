"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

const BG = "#f7f7f5";
const SURFACE = "#ffffff";
const TEXT = "#0e0e0e";
const TEXT2 = "#666";
const TEXT3 = "#999";
const ACCENT = "#F4A623";
const BORDER = "rgba(0,0,0,0.07)";
const FADE = "rgba(247,247,245,0.9)";

const HERO_DISHES = [
  { id: "1", name: "Alitas Acevichadas", desc: "Crujientes, bañadas en salsa acevichada y terminadas con hierbas frescas.", price: 6490, photo: "https://images.unsplash.com/photo-1527477396000-e27163b481c2?q=90&w=1200&auto=format&fit=crop", badge: "Lo mas pedido hoy" },
  { id: "2", name: "Salmon Teriyaki", desc: "Filete de salmon glaseado en salsa teriyaki con arroz jazmin y vegetales salteados.", price: 14990, photo: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?q=90&w=1200&auto=format&fit=crop", badge: "Recomendado" },
  { id: "3", name: "Burger Doble Smash", desc: "Doble carne smash, cheddar fundido, pickles caseros y salsa especial de la casa.", price: 9990, photo: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=90&w=1200&auto=format&fit=crop", badge: "Popular" },
];

const FEATURED = [
  { id: "f1", name: "Box Familiar", desc: "3 burgers con cebolla caramelizada, papas cheddar y bebida 1.5L.", price: 12990, photo: "https://images.unsplash.com/photo-1550547660-d9450f859349?q=90&w=900&auto=format&fit=crop" },
  { id: "f2", name: "Mix Sushi & Burger", desc: "Dos hamburguesas clasicas, papas y 10 piezas de sushi.", price: 14490, photo: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?q=90&w=900&auto=format&fit=crop" },
];

const MENU_SECTIONS = [
  { id: "lcat-burgers", name: "Hamburguesas", dishes: [
    { id: "m1", name: "Argentina", desc: "Chorizo ahumado al grill, carne de res, mayo chimichurri, lechuga y tomate.", price: 7490, photo: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=500&auto=format&fit=crop", popular: true },
    { id: "m2", name: "Blue Cheese", desc: "Pan brioche, champinones salteados, cebolla caramelizada y queso blue.", price: 7490, photo: "https://images.unsplash.com/photo-1610440042657-612c34d95e9f?q=80&w=500&auto=format&fit=crop", popular: false },
    { id: "m3", name: "Cheese Bacon", desc: "Doble carne, tocino, salsa BBQ y queso. Una bomba intensa.", price: 8990, photo: "https://images.unsplash.com/photo-1608039755401-742074f0548d?q=80&w=500&auto=format&fit=crop", popular: false },
  ]},
  { id: "lcat-sushi", name: "Sushi", dishes: [
    { id: "m4", name: "Nikkei Roll", desc: "Salmon, palta, queso crema y topping de ceviche.", price: 11490, photo: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?q=80&w=500&auto=format&fit=crop", popular: true },
    { id: "m5", name: "Ceviche Roll", desc: "Roll frito relleno de camaron con salsa acevichada.", price: 9990, photo: "https://images.unsplash.com/photo-1535399831218-d5bd36d1a6b3?q=80&w=500&auto=format&fit=crop", popular: false },
  ]},
  { id: "lcat-alitas", name: "Alitas", dishes: [
    { id: "m6", name: "Alitas BBQ", desc: "Alitas marinadas en salsa BBQ ahumada, servidas con apio y dip blue cheese.", price: 6990, photo: "https://images.unsplash.com/photo-1527477396000-e27163b481c2?q=80&w=500&auto=format&fit=crop", popular: false },
  ]},
  { id: "lcat-papas", name: "Papas", dishes: [
    { id: "m7", name: "Papas Cheddar Bacon", desc: "Papas fritas con cheddar fundido, tocino crocante y ciboulette.", price: 5490, photo: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?q=80&w=500&auto=format&fit=crop", popular: true },
  ]},
  { id: "lcat-ensaladas", name: "Ensaladas", dishes: [
    { id: "m8", name: "Caesar Pollo", desc: "Lechuga romana, pollo grillado, croutones, parmesano y aderezo caesar.", price: 7990, photo: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=500&auto=format&fit=crop", popular: false },
  ]},
];

const MOODS = [
  { id: "lcat-burgers", label: "Hamburguesas", photo: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=500&auto=format&fit=crop" },
  { id: "lcat-sushi", label: "Sushi", photo: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?q=80&w=500&auto=format&fit=crop" },
  { id: "lcat-alitas", label: "Alitas", photo: "https://images.unsplash.com/photo-1527477396000-e27163b481c2?q=80&w=500&auto=format&fit=crop" },
  { id: "lcat-papas", label: "Papas", photo: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?q=80&w=500&auto=format&fit=crop" },
  { id: "lcat-ensaladas", label: "Ensaladas", photo: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=500&auto=format&fit=crop" },
];

function HeroSlider() {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<NodeJS.Timeout>(undefined);

  useEffect(() => {
    timerRef.current = setInterval(() => setCurrent(c => (c + 1) % HERO_DISHES.length), 5000);
    return () => clearInterval(timerRef.current);
  }, []);

  const d = HERO_DISHES[current];

  return (
    <section style={{ minHeight: 560, position: "relative", display: "flex", alignItems: "flex-end", padding: "80px 16px 30px", isolation: "isolate", overflow: "hidden" }}>
      {HERO_DISHES.map((dish, i) => (
        <div key={dish.id} style={{ position: "absolute", inset: 0, zIndex: -3, opacity: i === current ? 1 : 0, transition: "opacity 0.8s ease" }}>
          <Image src={dish.photo} alt={dish.name} fill className="object-cover" sizes="100vw" style={{ transform: "scale(1.03)" }} quality={90} priority={i === 0} />
        </div>
      ))}
      <div style={{ position: "absolute", inset: 0, zIndex: -2, background: "linear-gradient(to bottom, rgba(0,0,0,0.12), rgba(0,0,0,0.25) 36%, rgba(0,0,0,0.78) 78%, #030303 100%), linear-gradient(to right, rgba(0,0,0,0.7), rgba(0,0,0,0.3) 58%, rgba(0,0,0,0.15))" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: -1, height: "55%", zIndex: -1, background: "linear-gradient(to top, #030303 0%, #030303 10%, rgba(3,3,3,0.9) 38%, rgba(3,3,3,0.5) 72%, transparent 100%)" }} />

      <div style={{ width: "100%", padding: "0 4px 8px" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          border: `1px solid ${ACCENT}88`, background: `${ACCENT}22`,
          color: ACCENT, fontSize: 10, fontWeight: 900, textTransform: "uppercase",
          letterSpacing: "0.4px", borderRadius: 999, padding: "6px 10px", marginBottom: 13,
        }}>
          {d.badge}
        </div>
        <h1 style={{ margin: 0, fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 62, lineHeight: 0.82, letterSpacing: "0.5px", textShadow: "0 3px 20px rgba(0,0,0,0.5)", color: "white" }}>
          {d.name.split(" ").map((w, i, arr) => i === arr.length - 1
            ? <span key={i} style={{ display: "block", color: ACCENT, fontSize: 50, textShadow: `0 0 20px ${ACCENT}50` }}>{w}</span>
            : <span key={i}>{w} </span>
          )}
        </h1>
        <p style={{ maxWidth: 300, margin: "12px 0 14px", color: "rgba(255,255,255,0.9)", fontSize: 14, lineHeight: 1.5, textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}>{d.desc}</p>
        <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT, letterSpacing: "-0.8px" }}>${d.price.toLocaleString("es-CL")}</div>
        <div style={{ display: "flex", gap: 7, marginTop: 14 }}>
          {HERO_DISHES.map((_, i) => (
            <button key={i} onClick={() => { setCurrent(i); clearInterval(timerRef.current); timerRef.current = setInterval(() => setCurrent(c => (c + 1) % HERO_DISHES.length), 5000); }}
              style={{ width: i === current ? 20 : 6, height: 6, borderRadius: 50, background: i === current ? ACCENT : "rgba(0,0,0,0.2)", border: "none", cursor: "pointer", transition: "all 0.3s ease", padding: 0 }} />
          ))}
        </div>
      </div>
    </section>
  );
}

function MoodSection() {
  const [active, setActive] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollLeft > 10);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const handleTap = (id: string) => {
    setActive(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section style={{ padding: "20px 14px 0", marginBottom: 0 }}>
      <h2 style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 30, letterSpacing: "0.8px", margin: "0 0 12px", lineHeight: 0.9, color: TEXT }}>Que se te antoja?</h2>
      <div style={{ position: "relative" }}>
        <div ref={scrollRef} style={{ display: "flex", gap: 10, overflowX: "auto", padding: "2px 0 8px", scrollbarWidth: "none" }}>
          {MOODS.map((m) => {
            const isActive = active === m.id;
            return (
              <button key={m.id} onClick={() => handleTap(m.id)} style={{
                minWidth: 116, height: 140, borderRadius: 24, position: "relative", overflow: "hidden",
                padding: 13, display: "flex", flexDirection: "column", justifyContent: "flex-end",
                border: isActive ? `2px solid ${ACCENT}` : "none",
                background: SURFACE, cursor: "pointer",
                boxShadow: isActive ? `0 0 20px ${ACCENT}25` : "0 4px 16px rgba(0,0,0,0.1)",
              }}>
                <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom, transparent 20%, rgba(0,0,0,0.65)), url('${m.photo}') center/cover` }} />
                <b style={{ position: "relative", zIndex: 1, fontSize: 13, lineHeight: 1.15, textShadow: "0 1px 8px rgba(0,0,0,0.5)", color: "white", textAlign: "left" }}>{m.label}</b>
              </button>
            );
          })}
        </div>
        {scrolled && <div style={{ position: "absolute", top: 0, left: 0, bottom: 8, width: 30, background: `linear-gradient(to left, transparent, ${FADE})`, pointerEvents: "none" }} />}
        <div style={{ position: "absolute", top: 0, right: 0, bottom: 8, width: 40, background: `linear-gradient(to right, transparent, ${FADE})`, pointerEvents: "none" }} />
      </div>
    </section>
  );
}

function FeaturedSection() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [featScrolled, setFeatScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const idx = Math.round(el.scrollLeft / (el.scrollWidth / FEATURED.length));
      setActiveIdx(Math.min(idx, FEATURED.length - 1));
      setFeatScrolled(el.scrollLeft > 10);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section style={{ padding: "24px 0 20px", marginBottom: 0, background: `linear-gradient(135deg, ${ACCENT}08, ${ACCENT}04)`, borderTop: `1px solid ${ACCENT}12`, borderBottom: `1px solid ${ACCENT}12` }}>
      <h2 style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 34, letterSpacing: "0.8px", margin: "0 0 14px", lineHeight: 0.9, color: ACCENT, padding: "0 14px" }}>Destacados</h2>
      <div style={{ position: "relative", padding: "0 14px" }}>
        <div ref={scrollRef} style={{ display: "flex", gap: 13, overflowX: "auto", scrollSnapType: "x mandatory", scrollbarWidth: "none", padding: "0 0 8px" }}>
          {FEATURED.map(f => (
            <article key={f.id} style={{ flex: "0 0 85%", minWidth: "85%", scrollSnapAlign: "start", height: 260, borderRadius: 28, overflow: "hidden", position: "relative", background: SURFACE, boxShadow: `0 8px 32px rgba(0,0,0,0.1), 0 0 0 1px ${ACCENT}20` }}>
              <Image src={f.photo} alt={f.name} fill className="object-cover" sizes="100vw" />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 45%, rgba(0,0,0,0.05) 100%)" }} />
              <div style={{ position: "absolute", left: 16, right: 16, bottom: 16 }}>
                <span style={{ display: "inline-block", padding: "5px 10px", borderRadius: 999, background: ACCENT, color: "white", fontSize: 10, fontWeight: 900, textTransform: "uppercase", marginBottom: 8 }}>Recomendado</span>
                <h3 style={{ margin: "0 0 6px", fontSize: 24, letterSpacing: "-0.5px", color: "white" }}>{f.name}</h3>
                <p style={{ margin: "0 0 8px", color: "rgba(255,255,255,0.75)", fontSize: 13, lineHeight: 1.35 }}>{f.desc}</p>
                <div style={{ fontSize: 18, fontWeight: 800, color: ACCENT }}>${f.price.toLocaleString("es-CL")}</div>
              </div>
            </article>
          ))}
        </div>
        {featScrolled && <div style={{ position: "absolute", top: 0, left: 0, bottom: 8, width: 30, background: `linear-gradient(to left, transparent, ${FADE})`, pointerEvents: "none" }} />}
        <div style={{ position: "absolute", top: 0, right: 0, bottom: 8, width: 50, background: `linear-gradient(to right, transparent, ${FADE})`, pointerEvents: "none" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 10 }}>
        {FEATURED.map((_, i) => (
          <div key={i} style={{ width: i === activeIdx ? 18 : 6, height: 6, borderRadius: 50, background: i === activeIdx ? ACCENT : "rgba(0,0,0,0.12)", transition: "all 0.3s ease" }} />
        ))}
      </div>
    </section>
  );
}

function MenuSection() {
  const [activeCat, setActiveCat] = useState(MENU_SECTIONS[0].id);
  const [chipsScrolled, setChipsScrolled] = useState(false);
  const chipsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = chipsRef.current;
    if (!el) return;
    const onScroll = () => setChipsScrolled(el.scrollLeft > 10);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const handleChip = (id: string) => {
    setActiveCat(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section style={{ padding: "0 14px 16px" }}>
      <h2 style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 30, letterSpacing: "0.8px", margin: "0 0 12px", lineHeight: 0.9, color: TEXT }}>Menu completo</h2>
      <div style={{ position: "relative", marginBottom: 16 }}>
        <div ref={chipsRef} style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", padding: "0 0 4px" }}>
          {MENU_SECTIONS.map(cat => (
            <button key={cat.id} onClick={() => handleChip(cat.id)} style={{
              whiteSpace: "nowrap",
              border: activeCat === cat.id ? `1px solid ${ACCENT}` : `1px solid ${BORDER}`,
              background: activeCat === cat.id ? `${ACCENT}15` : SURFACE,
              borderRadius: 999, padding: "9px 13px",
              color: activeCat === cat.id ? ACCENT : TEXT3,
              fontSize: 13, fontWeight: activeCat === cat.id ? 700 : 500, cursor: "pointer",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}>{cat.name}</button>
          ))}
        </div>
        {chipsScrolled && <div style={{ position: "absolute", top: 0, left: 0, bottom: 4, width: 24, background: `linear-gradient(to left, transparent, ${FADE})`, pointerEvents: "none" }} />}
        <div style={{ position: "absolute", top: 0, right: 0, bottom: 4, width: 30, background: `linear-gradient(to right, transparent, ${FADE})`, pointerEvents: "none" }} />
      </div>
      {MENU_SECTIONS.map(cat => (
        <div key={cat.id} id={cat.id} style={{ marginBottom: 20 }}>
          <h3 style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 20, color: TEXT3, margin: "0 0 10px", letterSpacing: "0.4px" }}>{cat.name}</h3>
          {cat.dishes.map(m => (
            <article key={m.id} style={{
              display: "grid", gridTemplateColumns: "100px 1fr", gap: 12, padding: 10,
              marginBottom: 10, borderRadius: 20, background: SURFACE,
              border: `1px solid ${BORDER}`, boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}>
              <div style={{ position: "relative", width: 100, height: 100, borderRadius: 16, overflow: "hidden" }}>
                <Image src={m.photo} alt={m.name} fill className="object-cover" sizes="100px" />
                {m.popular && (
                  <span style={{ position: "absolute", top: 5, left: 5, fontSize: 10, fontWeight: 800, color: "white", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", padding: "3px 8px", borderRadius: 50, border: `1px solid ${ACCENT}55`, boxShadow: `0 0 8px ${ACCENT}30` }}>🔥 Popular</span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <h4 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: TEXT }}>{m.name}</h4>
                <p style={{ margin: 0, color: TEXT3, fontSize: 12, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>{m.desc}</p>
                <b style={{ color: ACCENT, fontSize: 15, marginTop: 6 }}>${m.price.toLocaleString("es-CL")}</b>
              </div>
            </article>
          ))}
        </div>
      ))}
    </section>
  );
}

export default function VistaImpactLight() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" rel="stylesheet" />
      <div style={{
        maxWidth: 430, margin: "0 auto", minHeight: "100vh", paddingBottom: 94,
        position: "relative", overflow: "hidden", background: BG, color: TEXT,
        fontFamily: "Inter, system-ui, sans-serif",
      }}>
        {/* Ambient background — warm glow */}
        <div style={{
          position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
          background: `radial-gradient(ellipse at 75% -5%, ${ACCENT}35, transparent 35%), radial-gradient(ellipse at 5% 35%, rgba(168,120,255,0.15), transparent 35%), radial-gradient(ellipse at 90% 65%, ${ACCENT}20, transparent 30%), radial-gradient(ellipse at 30% 80%, rgba(255,140,60,0.1), transparent 28%)`,
        }} />
        {/* Smoke light */}
        <div style={{
          position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.5,
          background: `radial-gradient(ellipse at 50% 10%, ${ACCENT}18, transparent 35%), radial-gradient(ellipse at 70% 30%, rgba(255,160,80,0.1), transparent 30%)`,
          filter: "blur(20px)",
        }} />
        {/* Grid texture */}
        <div style={{
          position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.18,
          backgroundImage: "linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)",
          backgroundSize: "38px 38px",
          maskImage: "linear-gradient(to bottom, transparent, #000 18%, #000 72%, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 18%, #000 72%, transparent)",
        }} />

        {/* Top bar */}
        <header style={{
          position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)",
          width: "min(430px, 100%)", zIndex: 30,
          padding: "calc(12px + env(safe-area-inset-top)) 16px 10px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: "linear-gradient(to bottom, rgba(0,0,0,0.7), rgba(0,0,0,0.3), transparent)",
          backdropFilter: "blur(12px)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/restaurants/hand-roll/logo.png" alt="Hand Roll" style={{ width: 36, height: 36, borderRadius: 10, objectFit: "contain" }} />
            <span style={{ fontWeight: 800, fontSize: 18, color: "white", letterSpacing: "-0.3px" }}>Hand Roll</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button style={{ width: 40, height: 40, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.1)", display: "grid", placeItems: "center", color: "#fff", fontSize: 16, backdropFilter: "blur(10px)", cursor: "pointer" }}>&#x1F50D;</button>
            <button style={{ height: 40, borderRadius: 999, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.1)", color: "#fff", padding: "0 12px", fontSize: 11, fontWeight: 900, letterSpacing: "0.3px", backdropFilter: "blur(10px)", cursor: "pointer" }}>ES</button>
          </div>
        </header>

        <div style={{ position: "relative", zIndex: 1 }}>
          <HeroSlider />
          <MoodSection />
          <FeaturedSection />
          <MenuSection />
        </div>

        {/* FABs */}
        <div style={{ position: "fixed", bottom: 24, right: 16, zIndex: 30, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <button style={{
            width: 58, height: 58, borderRadius: "50%",
            background: `${ACCENT}40`, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
            border: `1px solid ${ACCENT}70`, boxShadow: `0 2px 16px ${ACCENT}30, 0 4px 18px rgba(0,0,0,0.08)`,
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}>
            <img src="/genio-lamp.png" alt="Genio" style={{ width: 34, height: 34, objectFit: "contain" }} />
          </button>
          <button style={{
            width: 58, height: 58, borderRadius: "50%",
            background: "rgba(0,0,0,0.5)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 4px 18px rgba(0,0,0,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "white", fontSize: 20,
          }}>
            &#x1F514;
          </button>
          <button style={{
            width: 58, height: 58, borderRadius: "50%",
            background: "rgba(255,255,255,0.55)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
            border: `1px solid ${BORDER}`, boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: TEXT2, fontSize: 18,
          }}>
            &#x2261;
          </button>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", padding: "20px 14px 40px", position: "relative", zIndex: 1 }}>
          <p style={{ fontSize: 11, color: TEXT3, margin: 0 }}>Powered by QuieroComer<span style={{ color: ACCENT }}>.cl</span> &copy; {new Date().getFullYear()}</p>
        </div>
      </div>
    </>
  );
}
