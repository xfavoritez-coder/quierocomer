"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

const HERO_DISHES = [
  { id: "1", name: "Alitas Acevichadas", desc: "Crujientes, bañadas en salsa acevichada y terminadas con hierbas frescas.", price: 6490, photo: "https://images.unsplash.com/photo-1527477396000-e27163b481c2?q=90&w=1200&auto=format&fit=crop", badge: "🔥 Lo más pedido hoy", social: "12 personas las pidieron hoy" },
  { id: "2", name: "Salmón Teriyaki", desc: "Filete de salmón glaseado en salsa teriyaki con arroz jazmín y vegetales salteados.", price: 14990, photo: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?q=90&w=1200&auto=format&fit=crop", badge: "⭐ Recomendado", social: "8 personas lo pidieron hoy" },
  { id: "3", name: "Burger Doble Smash", desc: "Doble carne smash, cheddar fundido, pickles caseros y salsa especial de la casa.", price: 9990, photo: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=90&w=1200&auto=format&fit=crop", badge: "🔥 Popular", social: "15 personas la pidieron hoy" },
];

const FEATURED = [
  { id: "f1", name: "Box Familiar", desc: "3 burgers con cebolla caramelizada, papas cheddar y bebida 1.5L.", price: 12990, photo: "https://images.unsplash.com/photo-1550547660-d9450f859349?q=90&w=900&auto=format&fit=crop", stamp: "La favorita" },
  { id: "f2", name: "Mix Sushi & Burger", desc: "Dos hamburguesas clásicas, papas y 10 piezas de sushi.", price: 14490, photo: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?q=90&w=900&auto=format&fit=crop", stamp: "Mix salvador" },
];

const MENU_SECTIONS = [
  { id: "cat-burgers", name: "Hamburguesas", dishes: [
    { id: "m1", name: "Argentina", desc: "Chorizo ahumado al grill, carne de res, mayo chimichurri, lechuga y tomate.", price: 7490, photo: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=500&auto=format&fit=crop", popular: true },
    { id: "m2", name: "Blue Cheese", desc: "Pan brioche, champiñones salteados, cebolla caramelizada y queso blue.", price: 7490, photo: "https://images.unsplash.com/photo-1610440042657-612c34d95e9f?q=80&w=500&auto=format&fit=crop", popular: false },
    { id: "m3", name: "Cheese Bacon", desc: "Doble carne, tocino, salsa BBQ y queso. Una bomba intensa.", price: 8990, photo: "https://images.unsplash.com/photo-1608039755401-742074f0548d?q=80&w=500&auto=format&fit=crop", popular: false },
  ]},
  { id: "cat-sushi", name: "Sushi", dishes: [
    { id: "m4", name: "Nikkei Roll", desc: "Salmón, palta, queso crema y topping de ceviche.", price: 11490, photo: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?q=80&w=500&auto=format&fit=crop", popular: true },
    { id: "m5", name: "Ceviche Roll", desc: "Roll frito relleno de camarón con salsa acevichada.", price: 9990, photo: "https://images.unsplash.com/photo-1535399831218-d5bd36d1a6b3?q=80&w=500&auto=format&fit=crop", popular: false },
  ]},
  { id: "cat-alitas", name: "Alitas", dishes: [
    { id: "m6", name: "Alitas BBQ", desc: "Alitas marinadas en salsa BBQ ahumada, servidas con apio y dip blue cheese.", price: 6990, photo: "https://images.unsplash.com/photo-1527477396000-e27163b481c2?q=80&w=500&auto=format&fit=crop", popular: false },
  ]},
  { id: "cat-papas", name: "Papas", dishes: [
    { id: "m7", name: "Papas Cheddar Bacon", desc: "Papas fritas con cheddar fundido, tocino crocante y ciboulette.", price: 5490, photo: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?q=80&w=500&auto=format&fit=crop", popular: true },
  ]},
  { id: "cat-ensaladas", name: "Ensaladas", dishes: [
    { id: "m8", name: "Caesar Pollo", desc: "Lechuga romana, pollo grillado, croutones, parmesano y aderezo caesar.", price: 7990, photo: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=500&auto=format&fit=crop", popular: false },
  ]},
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
    <section style={{ minHeight: 620, position: "relative", display: "flex", alignItems: "flex-end", padding: "92px 16px 34px", isolation: "isolate", overflow: "hidden" }}>
      {/* Photo */}
      {HERO_DISHES.map((dish, i) => (
        <div key={dish.id} style={{
          position: "absolute", inset: 0, zIndex: -3,
          opacity: i === current ? 1 : 0,
          transition: "opacity 0.8s ease",
        }}>
          <Image src={dish.photo} alt={dish.name} fill className="object-cover" sizes="100vw" style={{ transform: "scale(1.03)", filter: "saturate(1.1) contrast(1.08)" }} quality={90} priority={i === 0} />
        </div>
      ))}
      {/* Overlay */}
      <div style={{ position: "absolute", inset: 0, zIndex: -2, background: "linear-gradient(to bottom, rgba(0,0,0,0.12), rgba(0,0,0,0.25) 36%, rgba(0,0,0,0.78) 78%, #030303 100%), linear-gradient(to right, rgba(0,0,0,0.7), rgba(0,0,0,0.3) 58%, rgba(0,0,0,0.15))" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: -1, height: "55%", zIndex: -1, background: "linear-gradient(to top, #030303 0%, #030303 10%, rgba(3,3,3,0.9) 38%, rgba(3,3,3,0.5) 72%, transparent 100%)" }} />

      {/* Content */}
      <div style={{ width: "100%", padding: "0 4px 8px" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          border: "1px solid rgba(255,178,26,0.55)", background: "rgba(255,106,0,0.18)",
          color: "#ffb21a", fontSize: 10, fontWeight: 900, textTransform: "uppercase",
          letterSpacing: "0.4px", borderRadius: 999, padding: "6px 10px", marginBottom: 13,
          boxShadow: "0 0 24px rgba(255,178,26,0.13)",
        }}>
          {d.badge}
        </div>
        <h1 style={{
          margin: 0, fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 68, lineHeight: 0.82,
          letterSpacing: "0.5px", textShadow: "0 5px 30px rgba(0,0,0,0.92)", color: "white",
        }}>
          {d.name.split(" ").map((w, i, arr) => i === arr.length - 1
            ? <span key={i} style={{ display: "block", color: "#ffb21a", fontSize: 55, textShadow: "0 0 24px rgba(255,178,26,0.32)" }}>{w}</span>
            : <span key={i}>{w} </span>
          )}
        </h1>
        <p style={{ maxWidth: 300, margin: "15px 0 16px", color: "#f0e6d8", fontSize: 15, lineHeight: 1.52 }}>{d.desc}</p>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#ffb21a", letterSpacing: "-0.8px" }}>${d.price.toLocaleString("es-CL")}</div>
        <div style={{ display: "flex", gap: 7, marginTop: 17 }}>
          {HERO_DISHES.map((_, i) => (
            <button key={i} onClick={() => { setCurrent(i); clearInterval(timerRef.current); timerRef.current = setInterval(() => setCurrent(c => (c + 1) % HERO_DISHES.length), 5000); }}
              style={{ width: i === current ? 22 : 7, height: 7, borderRadius: 50, background: i === current ? "#ffb21a" : "rgba(255,255,255,0.38)", border: "none", cursor: "pointer", transition: "all 0.3s ease", padding: 0 }} />
          ))}
        </div>
      </div>
    </section>
  );
}

const GENIO_DISHES = [
  { id: "g1", name: "Buddha Bowl", price: 8990, photo: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=500&auto=format&fit=crop" },
  { id: "g2", name: "Pad Thai Tofu", price: 9490, photo: "https://images.unsplash.com/photo-1559314809-0d155014e29e?q=80&w=500&auto=format&fit=crop" },
  { id: "g3", name: "Poke Vegano", price: 10990, photo: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=500&auto=format&fit=crop" },
  { id: "g4", name: "Wrap Mediterráneo", price: 7990, photo: "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?q=80&w=500&auto=format&fit=crop" },
];

function GenioCarouselImpact() {
  return (
    <section style={{ padding: "20px 14px 0", marginBottom: 0 }}>
      <div style={{
        borderRadius: 24, padding: "16px 0 14px", position: "relative", overflow: "hidden",
        background: "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.03))",
        border: "1px solid rgba(34,197,94,0.18)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 16px", marginBottom: 12 }}>
          <div style={{
            width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", fontSize: "1rem",
          }}>🧞</div>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "white" }}>4 opciones veganas para ti 🌿</p>
            <p style={{ margin: "1px 0 0", fontSize: 11, color: "#888" }}>Basado en tus preferencias</p>
          </div>
        </div>
        {/* Cards scroll */}
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "0 16px 4px", scrollbarWidth: "none" }}>
            {GENIO_DISHES.map(d => (
              <div key={d.id} style={{
                flexShrink: 0, width: 130, borderRadius: 16, overflow: "hidden",
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(34,197,94,0.15)",
              }}>
                <div style={{ position: "relative", width: "100%", height: 90 }}>
                  <Image src={d.photo} alt={d.name} fill className="object-cover" sizes="130px" />
                  <span style={{
                    position: "absolute", top: 6, left: 6,
                    background: "rgba(34,197,94,0.45)", color: "white",
                    fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                    display: "flex", alignItems: "center", gap: 3,
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "white" }} />VEGAN
                  </span>
                </div>
                <div style={{ padding: "8px 10px 10px" }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, fontWeight: 700, color: "#4ade80" }}>${d.price.toLocaleString("es-CL")}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ position: "absolute", top: 0, right: 0, bottom: 4, width: 40, background: "linear-gradient(to right, transparent, rgba(3,3,3,0.85))", pointerEvents: "none" }} />
        </div>
        {/* Disclaimer */}
        <p style={{ fontSize: 11, color: "#666", textAlign: "center", margin: "10px 0 0", fontWeight: 500 }}>Confirma ingredientes y alérgenos con el personal del local</p>
      </div>
    </section>
  );
}

const MOODS = [
  { id: "cat-burgers", label: "Hamburguesas", photo: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=500&auto=format&fit=crop" },
  { id: "cat-sushi", label: "Sushi", photo: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?q=80&w=500&auto=format&fit=crop" },
  { id: "cat-alitas", label: "Alitas", photo: "https://images.unsplash.com/photo-1527477396000-e27163b481c2?q=80&w=500&auto=format&fit=crop" },
  { id: "cat-papas", label: "Papas", photo: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?q=80&w=500&auto=format&fit=crop" },
  { id: "cat-ensaladas", label: "Ensaladas", photo: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=500&auto=format&fit=crop" },
];

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
    <section style={{ padding: "24px 14px 0", marginBottom: 0 }}>
      <h2 style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 32, letterSpacing: "0.8px", margin: "0 0 12px", lineHeight: 0.9, color: "white" }}>¿Qué se te antoja?</h2>
      <div style={{ position: "relative" }}>
      <div ref={scrollRef} style={{ display: "flex", gap: 10, overflowX: "auto", padding: "2px 0 8px", scrollbarWidth: "none", scrollPaddingLeft: 14 }}>
        {MOODS.map((m) => {
          const isActive = active === m.id;
          return (
            <button key={m.id} onClick={() => handleTap(m.id)} style={{
              minWidth: 116, height: 140, borderRadius: 28, position: "relative", overflow: "hidden",
              padding: 13, display: "flex", flexDirection: "column", justifyContent: "flex-end",
              border: isActive ? "1px solid rgba(255,178,26,0.9)" : "1px solid rgba(255,255,255,0.14)",
              background: "#101010", cursor: "pointer",
              boxShadow: isActive ? "0 0 28px rgba(255,178,26,0.2), inset 0 0 28px rgba(255,178,26,0.08)" : "inset 0 0 28px rgba(255,255,255,0.025)",
            }}>
              <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom, rgba(0,0,0,0.05), rgba(0,0,0,0.75)), url('${m.photo}') center/cover`, opacity: 0.9 }} />
              <b style={{ position: "relative", zIndex: 1, fontSize: 13, lineHeight: 1.15, textShadow: "0 2px 14px #000", color: "white", textAlign: "left" }}>{m.label}</b>
            </button>
          );
        })}
      </div>
      {scrolled && <div style={{ position: "absolute", top: 0, left: 0, bottom: 8, width: 30, background: "linear-gradient(to left, transparent, rgba(3,3,3,0.85))", pointerEvents: "none" }} />}
      <div style={{ position: "absolute", top: 0, right: 0, bottom: 8, width: 40, background: "linear-gradient(to right, transparent, rgba(3,3,3,0.85))", pointerEvents: "none" }} />
      </div>
    </section>
  );
}

function FeaturedSection() {
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [featScrolled, setFeatScrolled] = useState(false);

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
    <section style={{ padding: "24px 14px 0", marginBottom: 24 }}>
      <h2 style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 32, letterSpacing: "0.8px", margin: "0 0 12px", lineHeight: 0.9, color: "white" }}>Destacados</h2>
      <div style={{ position: "relative" }}>
        <div ref={scrollRef} style={{ display: "flex", gap: 13, overflowX: "auto", scrollSnapType: "x mandatory", scrollbarWidth: "none", padding: "0 0 8px" }}>
          {FEATURED.map(f => (
            <article key={f.id} style={{ flex: "0 0 85%", minWidth: "85%", scrollSnapAlign: "start", height: 260, borderRadius: 31, overflow: "hidden", position: "relative", border: "1px solid rgba(255,178,26,0.25)", background: "#111", boxShadow: "0 0 24px rgba(255,178,26,0.12), 0 0 48px rgba(255,178,26,0.06)" }}>
              <Image src={f.photo} alt={f.name} fill className="object-cover" sizes="100vw" />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.18) 62%, transparent)" }} />
              <div style={{ position: "absolute", left: 16, right: 16, bottom: 16 }}>
                <span style={{ display: "inline-block", padding: "6px 9px", borderRadius: 999, background: "rgba(255,178,26,0.15)", border: "1px solid rgba(255,178,26,0.36)", color: "#ffb21a", fontSize: 10, fontWeight: 900, textTransform: "uppercase", marginBottom: 8 }}>Recomendado</span>
                <h3 style={{ margin: "0 0 6px", fontSize: 25, letterSpacing: "-0.6px", color: "white" }}>{f.name}</h3>
                <p style={{ margin: "0 0 9px", color: "#dfd5ca", fontSize: 13, lineHeight: 1.35 }}>{f.desc}</p>
                <div style={{ fontSize: 19, fontWeight: 800, color: "#ffb21a", letterSpacing: "-0.5px" }}>${f.price.toLocaleString("es-CL")}</div>
              </div>
            </article>
          ))}
        </div>
        {featScrolled && <div style={{ position: "absolute", top: 0, left: 0, bottom: 8, width: 30, background: "linear-gradient(to left, transparent, rgba(3,3,3,0.85))", pointerEvents: "none" }} />}
        <div style={{ position: "absolute", top: 0, right: 0, bottom: 8, width: 50, background: "linear-gradient(to right, transparent, rgba(3,3,3,0.85))", pointerEvents: "none" }} />
      </div>
      {/* Dots */}
      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 10 }}>
        {FEATURED.map((_, i) => (
          <div key={i} style={{ width: i === activeIdx ? 18 : 6, height: 6, borderRadius: 50, background: i === activeIdx ? "#ffb21a" : "rgba(255,255,255,0.25)", transition: "all 0.3s ease" }} />
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
      <h2 style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 32, letterSpacing: "0.8px", margin: "0 0 12px", lineHeight: 0.9, color: "white" }}>Menú completo</h2>
      {/* Chips */}
      <div style={{ position: "relative", marginBottom: 16 }}>
      <div ref={chipsRef} style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", padding: "0 0 4px" }}>
        {MENU_SECTIONS.map(cat => (
          <button key={cat.id} onClick={() => handleChip(cat.id)} style={{
            whiteSpace: "nowrap", border: activeCat === cat.id ? "1px solid rgba(255,178,26,0.55)" : "1px solid rgba(255,255,255,0.13)",
            background: activeCat === cat.id ? "rgba(255,178,26,0.1)" : "transparent",
            borderRadius: 999, padding: "9px 13px", color: activeCat === cat.id ? "#fff" : "#777",
            fontSize: 13, fontWeight: activeCat === cat.id ? 800 : 600, cursor: "pointer",
          }}>{cat.name}</button>
        ))}
      </div>
      {chipsScrolled && <div style={{ position: "absolute", top: 0, left: 0, bottom: 4, width: 24, background: "linear-gradient(to left, transparent, rgba(3,3,3,0.85))", pointerEvents: "none" }} />}
      <div style={{ position: "absolute", top: 0, right: 0, bottom: 4, width: 30, background: "linear-gradient(to right, transparent, rgba(3,3,3,0.85))", pointerEvents: "none" }} />
      </div>
      {/* Sections */}
      {MENU_SECTIONS.map(cat => (
        <div key={cat.id} id={cat.id} style={{ marginBottom: 20 }}>
          <h3 style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 20, color: "#666", margin: "0 0 10px", letterSpacing: "0.4px" }}>{cat.name}</h3>
          {cat.dishes.map(m => (
            <article key={m.id} style={{
              display: "grid", gridTemplateColumns: "108px 1fr", gap: 12, padding: 10,
              marginBottom: 11, borderRadius: 26, background: "linear-gradient(135deg, rgba(255,255,255,0.075), rgba(255,255,255,0.025))",
              border: "1px solid rgba(255,255,255,0.1)", position: "relative", overflow: "hidden",
            }}>
              <div style={{ position: "absolute", right: -35, top: -35, width: 90, height: 90, borderRadius: "50%", background: "rgba(255,178,26,0.08)", filter: "blur(10px)" }} />
              <div style={{ position: "relative", width: 108, height: 108, borderRadius: 20, overflow: "hidden" }}>
                <Image src={m.photo} alt={m.name} fill className="object-cover" sizes="108px" />
                {m.popular && (
                  <span style={{ position: "absolute", top: 6, left: 6, fontSize: 10, fontWeight: 800, color: "white", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", padding: "3px 9px", borderRadius: 50, border: "1px solid rgba(255,140,0,0.4)", boxShadow: "0 0 12px rgba(255,106,0,0.3)" }}>🔥 Popular</span>
                )}
              </div>
              <div>
                <h4 style={{ margin: "4px 0 6px", fontSize: 16, color: "white" }}>{m.name}</h4>
                <p style={{ margin: 0, color: "#b8ada1", fontSize: 12, lineHeight: 1.42, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>{m.desc}</p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 11 }}>
                  <b style={{ color: "#ffb21a", fontSize: 16 }}>${m.price.toLocaleString("es-CL")}</b>
                </div>
              </div>
            </article>
          ))}
        </div>
      ))}
    </section>
  );
}

export default function VistaImpact() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" rel="stylesheet" />
      <div style={{
        maxWidth: 430, margin: "0 auto", minHeight: "100vh", paddingBottom: 94,
        position: "relative", overflow: "hidden", background: "#030303", color: "#fff7ed",
        fontFamily: "Inter, system-ui, sans-serif",
      }}>
        {/* Ambient background */}
        <div style={{
          position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
          background: "radial-gradient(circle at 70% 0%, rgba(255,91,0,0.33), transparent 27%), radial-gradient(circle at 8% 28%, rgba(155,92,255,0.22), transparent 30%), radial-gradient(circle at 90% 72%, rgba(255,178,26,0.14), transparent 24%), linear-gradient(#050505, #000)",
        }} />
        {/* Grid texture */}
        <div style={{
          position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.28,
          backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "38px 38px",
          maskImage: "linear-gradient(to bottom, transparent, #000 18%, #000 72%, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 18%, #000 72%, transparent)",
        }} />
        {/* Smoke */}
        <div style={{
          position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.55,
          background: "radial-gradient(ellipse at 50% 8%, rgba(255,194,92,0.16), transparent 32%), radial-gradient(ellipse at 70% 24%, rgba(255,91,0,0.1), transparent 28%)",
          filter: "blur(10px)",
        }} />

        {/* Top bar */}
        <header style={{
          position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)",
          width: "min(430px, 100%)", zIndex: 30,
          padding: "calc(12px + env(safe-area-inset-top)) 16px 10px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: "linear-gradient(to bottom, rgba(3,3,3,0.92), rgba(3,3,3,0.55), transparent)",
          backdropFilter: "blur(12px)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/restaurants/hand-roll/logo.png" alt="Hand Roll" style={{ width: 36, height: 36, borderRadius: 10, objectFit: "contain" }} />
            <span style={{ fontWeight: 800, fontSize: 18, color: "white", letterSpacing: "-0.3px" }}>Hand Roll</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button style={{ width: 42, height: 42, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.06)", display: "grid", placeItems: "center", color: "#fff", fontSize: 18, backdropFilter: "blur(10px)", cursor: "pointer" }}>🔍</button>
            <button style={{ height: 42, borderRadius: 999, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.06)", color: "#fff", padding: "0 14px", fontSize: 12, fontWeight: 900, letterSpacing: "0.3px", backdropFilter: "blur(10px)", cursor: "pointer" }}>ES ▾</button>
          </div>
        </header>

        <div style={{ position: "relative", zIndex: 1 }}>
          <HeroSlider />
          <GenioCarouselImpact />
          <MoodSection />
          <FeaturedSection />
          <MenuSection />
        </div>

        {/* FABs */}
        <div style={{ position: "fixed", bottom: 24, right: 16, zIndex: 30, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <button style={{
            width: 58, height: 58, borderRadius: "50%",
            background: "rgba(255,178,26,0.28)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(255,178,26,0.45)", boxShadow: "0 0 16px rgba(255,178,26,0.15), 0 4px 18px rgba(0,0,0,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}>
            <img src="/genio-lamp.png" alt="Genio" style={{ width: 34, height: 34, objectFit: "contain" }} />
          </button>
          <button style={{
            width: 58, height: 58, borderRadius: "50%",
            background: "rgba(0,0,0,0.5)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 4px 18px rgba(0,0,0,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "white", fontSize: 20,
          }}>
            🔔
          </button>
          <button style={{
            width: 58, height: 58, borderRadius: "50%",
            background: "rgba(255,255,255,0.08)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 4px 18px rgba(0,0,0,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "white", fontSize: 18,
          }}>
            ≡
          </button>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", padding: "20px 14px 40px", position: "relative", zIndex: 1 }}>
          <p style={{ fontSize: 11, color: "#555", margin: 0 }}>Powered by QuieroComer<span style={{ color: "#ffb21a" }}>.cl</span> © {new Date().getFullYear()}</p>
        </div>
      </div>
    </>
  );
}
