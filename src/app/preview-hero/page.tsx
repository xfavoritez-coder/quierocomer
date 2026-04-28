"use client";

import { useState, useEffect } from "react";

/* ───── Fake data for mockups ───── */
const PHOTOS = [
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80",
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80",
  "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=800&q=80",
];
const DISHES = [
  { name: "Risotto de Hongos Silvestres", desc: "Arroz arborio con mix de hongos, parmesano y trufa" },
  { name: "Salmón Glaseado", desc: "Filete de salmón con glaseado de miso y jengibre" },
  { name: "Tarta de Chocolate", desc: "Ganache oscuro con frambuesas frescas" },
];
const RESTAURANT = { name: "La Brasserie", initial: "L" };

/* ───── Fake list items below hero ───── */
function FakeListItems() {
  const items = [
    { name: "Carpaccio de Res", price: "$12.900", img: PHOTOS[0] },
    { name: "Ensalada César", price: "$8.500", img: PHOTOS[1] },
    { name: "Pasta al Pesto", price: "$10.200", img: PHOTOS[2] },
    { name: "Bruschetta Clásica", price: "$7.800", img: PHOTOS[0] },
  ];
  return (
    <div style={{ background: "#f7f7f5", padding: "0 0 20px" }}>
      {/* Fake sticky nav */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", height: 44, display: "flex", alignItems: "center", padding: "0 16px", gap: 20 }}>
        {["Entradas", "Principales", "Postres", "Bebidas"].map((c, i) => (
          <span key={c} style={{ fontSize: "0.92rem", fontWeight: i === 0 ? 700 : 500, color: i === 0 ? "#0e0e0e" : "#999", borderBottom: i === 0 ? "2px solid #F4A623" : "none", paddingBottom: 2 }}>{c}</span>
        ))}
      </div>
      {/* Fake dish rows */}
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: 12, padding: "12px 16px", borderBottom: "1px solid #f0f0f0", background: "#fff", marginTop: i === 0 ? 0 : 0 }}>
          <div style={{ width: 80, height: 80, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: "#eee" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "#0e0e0e" }}>{item.name}</span>
            <span style={{ fontSize: "0.78rem", color: "#888", marginTop: 2 }}>Ingredientes frescos del día</span>
            <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "#0e0e0e", marginTop: 4 }}>{item.price}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ───── Carousel hook ───── */
function useCarousel(length: number, interval = 4000) {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    if (length <= 1) return;
    const t = setInterval(() => setCurrent((c) => (c + 1) % length), interval);
    return () => clearInterval(t);
  }, [length, interval]);
  return { current, setCurrent };
}

/* ───── Dots ───── */
function Dots({ count, current, onSelect }: { count: number; current: number; onSelect: (i: number) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          onClick={() => onSelect(i)}
          style={{
            width: i === current ? 18 : 6, height: 6, borderRadius: 3,
            background: i === current ? "white" : "rgba(255,255,255,0.4)",
            border: "none", padding: 0, cursor: "pointer", transition: "all 0.3s ease",
          }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   OPCION 1: Hero Compacto (~35vh)
   ═══════════════════════════════════════════ */
function HeroCompacto() {
  const { current, setCurrent } = useCarousel(DISHES.length);
  const dish = DISHES[current];
  return (
    <section style={{ position: "relative", width: "100%", height: "35vh", overflow: "hidden" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={PHOTOS[current]}
        alt={dish.name}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", animation: "heroKenBurns 12s ease-in-out infinite alternate" }}
      />
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.2)" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 20%, rgba(0,0,0,0.6) 100%)" }} />

      {/* Logo + name */}
      <div style={{ position: "absolute", top: 12, left: 16, display: "flex", alignItems: "center", gap: 8, zIndex: 2 }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#F4A623", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700, color: "#0e0e0e" }}>{RESTAURANT.initial}</div>
        <span style={{ color: "rgba(255,255,255,0.9)", fontSize: "1rem", fontWeight: 400, textShadow: "0 1px 4px rgba(0,0,0,0.4)" }}>{RESTAURANT.name}</span>
      </div>

      {/* Center: dish name only + dots */}
      <div style={{ position: "absolute", bottom: 24, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, zIndex: 2 }}>
        <h2 style={{ color: "white", fontSize: "1.6rem", fontWeight: 800, textAlign: "center", textShadow: "0 2px 8px rgba(0,0,0,0.5)", margin: 0, padding: "0 20px", lineHeight: 1.15, fontFamily: "var(--font-playfair, Georgia, serif)" }}>
          {dish.name}
        </h2>
        <Dots count={DISHES.length} current={current} onSelect={setCurrent} />
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   OPCION 2: Hero Slim (~25vh) estilo banner
   ═══════════════════════════════════════════ */
function HeroSlim() {
  const { current } = useCarousel(DISHES.length, 5000);
  const dish = DISHES[current];
  return (
    <section style={{ position: "relative", width: "100%", height: "25vh", overflow: "hidden" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={PHOTOS[current]}
        alt={dish.name}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", animation: "heroKenBurns 12s ease-in-out infinite alternate" }}
      />
      {/* Lateral gradient instead of vertical */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)" }} />

      {/* Logo + name top-left */}
      <div style={{ position: "absolute", top: 10, left: 14, display: "flex", alignItems: "center", gap: 8, zIndex: 2 }}>
        <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#F4A623", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: 700, color: "#0e0e0e" }}>{RESTAURANT.initial}</div>
        <span style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.88rem", fontWeight: 400, textShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>{RESTAURANT.name}</span>
      </div>

      {/* Left-aligned content */}
      <div style={{ position: "absolute", bottom: 16, left: 16, right: "40%", zIndex: 2 }}>
        <h2 style={{ color: "white", fontSize: "1.35rem", fontWeight: 800, textShadow: "0 2px 6px rgba(0,0,0,0.5)", margin: 0, lineHeight: 1.15, fontFamily: "var(--font-playfair, Georgia, serif)" }}>
          {dish.name}
        </h2>
        <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.78rem", marginTop: 4, lineHeight: 1.35 }}>
          {dish.desc}
        </p>
      </div>

      {/* Subtle progress bar instead of dots */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "rgba(255,255,255,0.15)", zIndex: 2 }}>
        <div style={{ height: "100%", width: `${((current + 1) / DISHES.length) * 100}%`, background: "#F4A623", transition: "width 0.5s ease" }} />
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   OPCION 3: Hero Card (flotante, con bordes)
   ═══════════════════════════════════════════ */
function HeroCard() {
  const { current, setCurrent } = useCarousel(DISHES.length);
  const dish = DISHES[current];
  return (
    <div style={{ padding: "12px 16px 0", background: "#f7f7f5" }}>
      {/* Logo + name above card */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "8px 0" }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#F4A623", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", fontWeight: 700, color: "#0e0e0e" }}>{RESTAURANT.initial}</div>
        <span style={{ color: "#0e0e0e", fontSize: "1.1rem", fontWeight: 500 }}>{RESTAURANT.name}</span>
      </div>

      <section style={{ position: "relative", width: "100%", height: "30vh", borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={PHOTOS[current]}
          alt={dish.name}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", animation: "heroKenBurns 12s ease-in-out infinite alternate" }}
        />
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.15)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.65) 100%)" }} />

        {/* Center content */}
        <div style={{ position: "absolute", bottom: 20, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, zIndex: 2 }}>
          <h2 style={{ color: "white", fontSize: "1.5rem", fontWeight: 800, textAlign: "center", textShadow: "0 2px 8px rgba(0,0,0,0.5)", margin: 0, padding: "0 24px", lineHeight: 1.15, fontFamily: "var(--font-playfair, Georgia, serif)" }}>
            {dish.name}
          </h2>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.82rem", textAlign: "center", margin: 0, padding: "0 30px" }}>
            {dish.desc}
          </p>
          <Dots count={DISHES.length} current={current} onSelect={setCurrent} />
        </div>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════
   OPCION 4: Hero Peek (~20vh, ultra minimal)
   ═══════════════════════════════════════════ */
function HeroPeek() {
  const { current } = useCarousel(DISHES.length, 4000);
  const dish = DISHES[current];
  return (
    <section style={{ position: "relative", width: "100%", height: "20vh", overflow: "hidden", cursor: "pointer" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={PHOTOS[current]}
        alt={dish.name}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", animation: "heroKenBurns 12s ease-in-out infinite alternate" }}
      />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.55) 100%)" }} />

      {/* Logo top-left */}
      <div style={{ position: "absolute", top: 10, left: 14, display: "flex", alignItems: "center", gap: 6, zIndex: 2 }}>
        <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#F4A623", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", fontWeight: 700, color: "#0e0e0e" }}>{RESTAURANT.initial}</div>
        <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.82rem", fontWeight: 400 }}>{RESTAURANT.name}</span>
      </div>

      {/* Just the name, big and bold */}
      <div style={{ position: "absolute", bottom: 14, left: 16, right: 16, zIndex: 2 }}>
        <h2 style={{ color: "white", fontSize: "1.7rem", fontWeight: 900, textShadow: "0 2px 8px rgba(0,0,0,0.5)", margin: 0, lineHeight: 1.1, fontFamily: "var(--font-playfair, Georgia, serif)" }}>
          {dish.name}
        </h2>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════ */
export default function PreviewHeroPage() {
  const [selected, setSelected] = useState<number | null>(null);

  const options = [
    { id: 1, title: "Compacto", subtitle: "35vh — nombre + dots, sin descripción ni CTA", component: <HeroCompacto /> },
    { id: 2, title: "Slim", subtitle: "25vh — banner lateral, gradiente izquierdo, barra de progreso", component: <HeroSlim /> },
    { id: 3, title: "Card", subtitle: "30vh — flotante con bordes redondeados y sombra", component: <HeroCard /> },
    { id: 4, title: "Peek", subtitle: "20vh — ultra minimalista, solo nombre grande", component: <HeroPeek /> },
  ];

  return (
    <div style={{ background: "#111", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <style>{`
        @keyframes heroKenBurns { 0% { transform: scale(1); } 100% { transform: scale(1.08); } }
        * { box-sizing: border-box; margin: 0; }
      `}</style>

      {/* Header */}
      <div style={{ padding: "24px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <h1 style={{ color: "white", fontSize: "1.5rem", fontWeight: 700 }}>
          Hero para Vista Lista — Mockups
        </h1>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.88rem", marginTop: 6 }}>
          Cada opción muestra el hero + cómo se ve la transición a la lista debajo. Toca una para verla en pantalla completa.
        </p>
      </div>

      {/* Grid / Stack of mockups */}
      {selected === null ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 32, padding: "24px 0 40px" }}>
          {options.map((opt) => (
            <div key={opt.id}>
              {/* Label */}
              <div style={{ padding: "0 20px 10px", display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ color: "#F4A623", fontSize: "1.1rem", fontWeight: 700 }}>Opción {opt.id}</span>
                <span style={{ color: "white", fontSize: "1.05rem", fontWeight: 600 }}>{opt.title}</span>
                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.78rem" }}>{opt.subtitle}</span>
              </div>

              {/* Phone frame */}
              <div
                onClick={() => setSelected(opt.id)}
                style={{
                  margin: "0 auto",
                  width: 375,
                  maxWidth: "92vw",
                  height: 620,
                  borderRadius: 32,
                  overflow: "hidden",
                  border: "3px solid rgba(255,255,255,0.15)",
                  background: "#f7f7f5",
                  cursor: "pointer",
                  position: "relative",
                  boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
                }}
              >
                {/* Notch */}
                <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 120, height: 24, background: "#111", borderRadius: "0 0 16px 16px", zIndex: 10 }} />

                {/* Content */}
                <div style={{ height: "100%", overflow: "hidden" }}>
                  {opt.component}
                  <FakeListItems />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Full-screen preview of selected option */
        <div>
          <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(17,17,17,0.95)", backdropFilter: "blur(10px)", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            <span style={{ color: "white", fontSize: "1rem", fontWeight: 600 }}>Opción {selected}: {options[selected - 1].title}</span>
            <button
              onClick={() => setSelected(null)}
              style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "white", padding: "6px 16px", borderRadius: 8, cursor: "pointer", fontSize: "0.85rem" }}
            >
              Volver
            </button>
          </div>
          <div style={{ maxWidth: 430, margin: "0 auto", background: "#f7f7f5" }}>
            {options[selected - 1].component}
            <FakeListItems />
            <FakeListItems />
          </div>
        </div>
      )}
    </div>
  );
}
