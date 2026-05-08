"use client";

/**
 * Preview comparativo de 3 propuestas en LIGHT MODE para el modal de
 * detalle de plato (incluyendo descripcion, modificadores y sugerencias).
 *
 * Visita: http://localhost:3000/preview-dish-modal
 */
import { useState } from "react";

const SAMPLE_DISH = {
  name: "Tonkotsu Ramen",
  category: "Principales",
  description:
    "Caldo espeso de hueso de cerdo cocinado 18 horas, con fideos ramen al dente, cerdo chashu marinado, huevo soft-boiled, kikurage, cebollín fresco y mayu (aceite de ajo rostizado).",
  price: 13000,
  photo:
    "https://images.unsplash.com/photo-1623341214825-9f4f963727da?w=900&auto=format&fit=crop&q=80",
  ingredients: [
    "Caldo de cerdo",
    "Fideos ramen",
    "Cerdo chashu",
    "Huevo marinado",
    "Kikurage",
    "Cebollín",
    "Mayu",
  ],
  tags: ["NUEVO", "PICANTE"],
  rating: { avg: 4.7, count: 23 },
};

const NOODLE_OPTIONS = [
  { id: "thin", name: "Fino", priceDelta: 0 },
  { id: "thick", name: "Grueso", priceDelta: 0 },
];

const EXTRAS = [
  { id: "chashu", name: "Extra chashu", priceDelta: 2000 },
  { id: "fideo", name: "Extra fideo", priceDelta: 2500 },
  { id: "kikurage", name: "Kikurage extra", priceDelta: 1000 },
  { id: "ajitama", name: "Huevo extra", priceDelta: 1500 },
];

const SUGGESTED = [
  { name: "Gyosa de cerdo", price: 7800, photo: "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=400&auto=format&fit=crop&q=70" },
  { name: "Karaage", price: 7800, photo: "https://images.unsplash.com/photo-1606755456206-b25206cde27e?w=400&auto=format&fit=crop&q=70" },
  { name: "Edamame", price: 7500, photo: "https://images.unsplash.com/photo-1609501676725-7186f29c3ff5?w=400&auto=format&fit=crop&q=70" },
];

const fmt = (n: number) => `$${n.toLocaleString("es-CL")}`;

// ─────────────────────────────────────────────────────────────────
// VARIANTE A — Editorial / Magazine
// Cream warm white, Playfair headlines, italics, gold accents
// ─────────────────────────────────────────────────────────────────
function VariantA() {
  const [noodle, setNoodle] = useState("thin");
  const [extras, setExtras] = useState<string[]>([]);
  const total = SAMPLE_DISH.price + extras.reduce((s, id) => s + (EXTRAS.find((e) => e.id === id)?.priceDelta || 0), 0);
  const toggleExtra = (id: string) => setExtras((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <div style={{ background: "#faf7f1", minHeight: "100%", color: "#1a1a1a", fontFamily: "var(--font-dm)" }}>
      {/* Hero */}
      <div style={{ position: "relative", aspectRatio: "1 / 1", overflow: "hidden", background: "#e8e4dc" }}>
        <img src={SAMPLE_DISH.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <button style={{ position: "absolute", top: 14, right: 14, width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.92)", border: "none", color: "#1a1a1a", fontSize: "0.95rem", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>✕</button>
        <div style={{ position: "absolute", bottom: 14, left: 14, display: "flex", gap: 6 }}>
          {SAMPLE_DISH.tags.map((t) => (
            <span key={t} style={{ background: "rgba(255,255,255,0.95)", color: "#1a1a1a", fontSize: "0.65rem", fontWeight: 600, padding: "4px 9px", borderRadius: 999, letterSpacing: "0.04em", textTransform: "uppercase" }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "26px 22px 100px" }}>
        <p style={{ fontSize: "0.7rem", color: "#a89878", textTransform: "uppercase", letterSpacing: "0.18em", margin: "0 0 10px" }}>{SAMPLE_DISH.category}</p>
        <h1 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1.1, margin: "0 0 6px", letterSpacing: "-0.5px" }}>
          {SAMPLE_DISH.name}
        </h1>
        <p style={{ fontSize: "1.15rem", color: "#9a7c3c", fontFamily: "Georgia, serif", fontStyle: "italic", margin: "0 0 18px" }}>{fmt(SAMPLE_DISH.price)}</p>

        <p className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "0.95rem", lineHeight: 1.65, color: "#3a3a3a", fontStyle: "italic", margin: "0 0 24px", borderLeft: "2px solid #c9a961", paddingLeft: 14 }}>
          {SAMPLE_DISH.description}
        </p>

        {/* Modificadores - Tipo de fideo */}
        <div style={{ borderTop: "1px solid #e8dec9", paddingTop: 22, marginBottom: 20 }}>
          <h3 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "0.95rem", fontWeight: 600, margin: "0 0 12px", display: "flex", alignItems: "baseline", gap: 8 }}>
            Tipo de fideo
            <span style={{ fontSize: "0.7rem", color: "#a89878", fontWeight: 400, fontStyle: "italic", fontFamily: "Georgia, serif" }}>· elige uno</span>
          </h3>
          {NOODLE_OPTIONS.map((opt) => (
            <button key={opt.id} onClick={() => setNoodle(opt.id)} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%",
              padding: "12px 0", border: "none", background: "transparent", cursor: "pointer",
              borderBottom: "1px dashed #e8dec9", textAlign: "left",
            }}>
              <span style={{ fontSize: "0.92rem", color: noodle === opt.id ? "#1a1a1a" : "#666", fontWeight: noodle === opt.id ? 600 : 400 }}>{opt.name}</span>
              <span style={{ width: 18, height: 18, borderRadius: "50%", border: noodle === opt.id ? "5px solid #c9a961" : "1.5px solid #c9a961" }} />
            </button>
          ))}
        </div>

        {/* Modificadores - Extras */}
        <div style={{ borderTop: "1px solid #e8dec9", paddingTop: 22, marginBottom: 30 }}>
          <h3 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "0.95rem", fontWeight: 600, margin: "0 0 12px", display: "flex", alignItems: "baseline", gap: 8 }}>
            Para acompañar
            <span style={{ fontSize: "0.7rem", color: "#a89878", fontWeight: 400, fontStyle: "italic", fontFamily: "Georgia, serif" }}>· opcional</span>
          </h3>
          {EXTRAS.map((opt) => {
            const sel = extras.includes(opt.id);
            return (
              <button key={opt.id} onClick={() => toggleExtra(opt.id)} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%",
                padding: "12px 0", border: "none", background: "transparent", cursor: "pointer",
                borderBottom: "1px dashed #e8dec9", textAlign: "left",
              }}>
                <span style={{ fontSize: "0.92rem", color: sel ? "#1a1a1a" : "#666", fontWeight: sel ? 600 : 400 }}>{opt.name}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: "0.85rem", color: "#9a7c3c", fontFamily: "Georgia, serif", fontStyle: "italic" }}>+{fmt(opt.priceDelta)}</span>
                  <span style={{ width: 18, height: 18, borderRadius: 4, background: sel ? "#c9a961" : "transparent", border: "1.5px solid #c9a961", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "0.7rem" }}>{sel ? "✓" : ""}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Sugerencias */}
        <div style={{ borderTop: "1px solid #e8dec9", paddingTop: 22 }}>
          <h3 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "0.95rem", fontWeight: 600, margin: "0 0 4px" }}>También te podría gustar</h3>
          <p style={{ fontSize: "0.78rem", color: "#a89878", fontStyle: "italic", fontFamily: "Georgia, serif", margin: "0 0 14px" }}>Sugerencias del chef</p>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none" }}>
            {SUGGESTED.map((s) => (
              <div key={s.name} style={{ flexShrink: 0, width: 130 }}>
                <div style={{ aspectRatio: "1 / 1", overflow: "hidden", borderRadius: 8, marginBottom: 8, background: "#e8e4dc" }}>
                  <img src={s.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <p className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "0.82rem", fontWeight: 600, margin: "0 0 2px", color: "#1a1a1a" }}>{s.name}</p>
                <p style={{ fontSize: "0.78rem", color: "#9a7c3c", fontStyle: "italic", fontFamily: "Georgia, serif", margin: 0 }}>{fmt(s.price)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky CTA footer */}
      <div style={{ position: "sticky", bottom: 0, background: "#faf7f1", borderTop: "1px solid #e8dec9", padding: "14px 22px", boxShadow: "0 -2px 10px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <p style={{ fontSize: "0.7rem", color: "#a89878", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>Total</p>
            <p className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "1.4rem", fontWeight: 700, color: "#1a1a1a", margin: 0 }}>{fmt(total)}</p>
          </div>
          <button style={{ flex: 1, padding: "14px 22px", background: "#1a1a1a", color: "#faf7f1", border: "none", borderRadius: 4, fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer" }}>Lo quiero</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// VARIANTE B — Minimal Apple
// Pure white, sans-serif, geometric, minimal accents
// ─────────────────────────────────────────────────────────────────
function VariantB() {
  const [noodle, setNoodle] = useState("thin");
  const [extras, setExtras] = useState<string[]>([]);
  const total = SAMPLE_DISH.price + extras.reduce((s, id) => s + (EXTRAS.find((e) => e.id === id)?.priceDelta || 0), 0);
  const toggleExtra = (id: string) => setExtras((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <div style={{ background: "#ffffff", minHeight: "100%", color: "#0a0a0a", fontFamily: "var(--font-dm)" }}>
      {/* Hero */}
      <div style={{ position: "relative", aspectRatio: "4 / 5", overflow: "hidden", background: "#f5f5f7" }}>
        <img src={SAMPLE_DISH.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <button style={{ position: "absolute", top: 14, right: 14, width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", border: "none", color: "#0a0a0a", fontSize: "0.85rem", fontWeight: 600 }}>✕</button>
      </div>

      {/* Body */}
      <div style={{ padding: "24px 20px 100px" }}>
        {/* Tags as tiny pills */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {SAMPLE_DISH.tags.map((t) => (
            <span key={t} style={{ background: "#f5f5f7", color: "#1a1a1a", fontSize: "0.65rem", fontWeight: 600, padding: "3px 10px", borderRadius: 999, letterSpacing: "0.05em" }}>{t}</span>
          ))}
        </div>
        <p style={{ fontSize: "0.78rem", color: "#888", margin: "0 0 4px", fontWeight: 500 }}>{SAMPLE_DISH.category}</p>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, lineHeight: 1.15, margin: "0 0 8px", letterSpacing: "-0.01em" }}>{SAMPLE_DISH.name}</h1>
        <p style={{ fontSize: "1.1rem", fontWeight: 600, color: "#0a0a0a", margin: "0 0 20px" }}>{fmt(SAMPLE_DISH.price)}</p>
        <p style={{ fontSize: "0.92rem", lineHeight: 1.55, color: "#444", margin: "0 0 28px" }}>{SAMPLE_DISH.description}</p>

        {/* Modifiers as cards */}
        <div style={{ background: "#f5f5f7", borderRadius: 14, padding: "16px 18px", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <h3 style={{ fontSize: "0.92rem", fontWeight: 600, margin: 0 }}>Tipo de fideo</h3>
            <span style={{ fontSize: "0.72rem", color: "#888" }}>Elige uno</span>
          </div>
          {NOODLE_OPTIONS.map((opt) => (
            <button key={opt.id} onClick={() => setNoodle(opt.id)} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%",
              padding: "10px 0", border: "none", background: "transparent", cursor: "pointer",
              textAlign: "left",
            }}>
              <span style={{ fontSize: "0.95rem", color: "#0a0a0a", fontWeight: noodle === opt.id ? 600 : 400 }}>{opt.name}</span>
              <span style={{ width: 22, height: 22, borderRadius: "50%", border: noodle === opt.id ? "7px solid #0a0a0a" : "1.5px solid #c8c8cc", background: "white", transition: "all 0.15s" }} />
            </button>
          ))}
        </div>

        <div style={{ background: "#f5f5f7", borderRadius: 14, padding: "16px 18px", marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <h3 style={{ fontSize: "0.92rem", fontWeight: 600, margin: 0 }}>Para acompañar</h3>
            <span style={{ fontSize: "0.72rem", color: "#888" }}>Opcional</span>
          </div>
          {EXTRAS.map((opt) => {
            const sel = extras.includes(opt.id);
            return (
              <button key={opt.id} onClick={() => toggleExtra(opt.id)} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%",
                padding: "10px 0", border: "none", background: "transparent", cursor: "pointer",
                textAlign: "left",
              }}>
                <span style={{ fontSize: "0.95rem", color: "#0a0a0a", fontWeight: sel ? 600 : 400 }}>{opt.name}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ fontSize: "0.85rem", color: "#666" }}>+{fmt(opt.priceDelta)}</span>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: sel ? "#0a0a0a" : "white", border: sel ? "none" : "1.5px solid #c8c8cc", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "0.85rem" }}>{sel ? "✓" : ""}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Sugerencias */}
        <h3 style={{ fontSize: "0.92rem", fontWeight: 600, margin: "0 0 12px" }}>También te podría gustar</h3>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none", marginBottom: 8 }}>
          {SUGGESTED.map((s) => (
            <div key={s.name} style={{ flexShrink: 0, width: 130 }}>
              <div style={{ aspectRatio: "1 / 1", overflow: "hidden", borderRadius: 12, marginBottom: 8, background: "#f5f5f7" }}>
                <img src={s.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <p style={{ fontSize: "0.82rem", fontWeight: 500, margin: "0 0 1px", color: "#0a0a0a" }}>{s.name}</p>
              <p style={{ fontSize: "0.8rem", color: "#666", margin: 0 }}>{fmt(s.price)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky CTA footer */}
      <div style={{ position: "sticky", bottom: 0, background: "rgba(255,255,255,0.9)", backdropFilter: "blur(20px)", borderTop: "1px solid #e8e8ec", padding: "12px 20px" }}>
        <button style={{ width: "100%", padding: "16px", background: "#0a0a0a", color: "white", border: "none", borderRadius: 14, fontSize: "0.95rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <span>Lo quiero</span>
          <span style={{ opacity: 0.6 }}>·</span>
          <span>{fmt(total)}</span>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// VARIANTE C — Casual / DoorDash
// White warm tint, brand orange accents, friendly, accessible
// ─────────────────────────────────────────────────────────────────
function VariantC() {
  const [noodle, setNoodle] = useState("thin");
  const [extras, setExtras] = useState<string[]>([]);
  const total = SAMPLE_DISH.price + extras.reduce((s, id) => s + (EXTRAS.find((e) => e.id === id)?.priceDelta || 0), 0);
  const toggleExtra = (id: string) => setExtras((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <div style={{ background: "#ffffff", minHeight: "100%", color: "#1a1a1a", fontFamily: "var(--font-dm)" }}>
      {/* Hero */}
      <div style={{ position: "relative", aspectRatio: "1 / 1", overflow: "hidden" }}>
        <img src={SAMPLE_DISH.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <button style={{ position: "absolute", top: 14, right: 14, width: 36, height: 36, borderRadius: "50%", background: "white", border: "none", color: "#1a1a1a", fontSize: "1rem", fontWeight: 600, boxShadow: "0 2px 10px rgba(0,0,0,0.15)" }}>✕</button>
      </div>

      {/* Body */}
      <div style={{ padding: "20px 18px 100px" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {SAMPLE_DISH.tags.map((t) => (
            <span key={t} style={{
              background: t === "PICANTE" ? "#FFEEE8" : "#FFF4E0",
              color: t === "PICANTE" ? "#c2410c" : "#92400e",
              fontSize: "0.7rem", fontWeight: 700, padding: "4px 11px",
              borderRadius: 999, letterSpacing: "0.04em",
              border: t === "PICANTE" ? "1px solid #fed7aa" : "1px solid #fde68a",
            }}>{t}</span>
          ))}
          <span style={{ background: "#FFF8E7", color: "#92400e", fontSize: "0.7rem", fontWeight: 700, padding: "4px 11px", borderRadius: 999, border: "1px solid #fde68a" }}>★ {SAMPLE_DISH.rating.avg}</span>
        </div>

        <h1 style={{ fontSize: "1.55rem", fontWeight: 700, lineHeight: 1.15, margin: "0 0 6px", color: "#1a1a1a" }}>{SAMPLE_DISH.name}</h1>
        <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "#F4A623", margin: "0 0 16px" }}>{fmt(SAMPLE_DISH.price)}</p>
        <p style={{ fontSize: "0.95rem", lineHeight: 1.55, color: "#555", margin: "0 0 24px" }}>{SAMPLE_DISH.description}</p>

        {/* Ingredientes pills */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24 }}>
          {SAMPLE_DISH.ingredients.slice(0, 5).map((i) => (
            <span key={i} style={{ fontSize: "0.78rem", color: "#666", background: "#f5f5f3", padding: "5px 12px", borderRadius: 999, border: "1px solid #ececea" }}>{i}</span>
          ))}
        </div>

        {/* Modifiers */}
        <div style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 4px", color: "#1a1a1a" }}>Tipo de fideo</h3>
          <p style={{ fontSize: "0.78rem", color: "#999", margin: "0 0 12px" }}>Obligatorio · Elige 1</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {NOODLE_OPTIONS.map((opt) => {
              const sel = noodle === opt.id;
              return (
                <button key={opt.id} onClick={() => setNoodle(opt.id)} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%",
                  padding: "14px 16px", border: sel ? "2px solid #F4A623" : "1.5px solid #ececea",
                  background: sel ? "#FFFCF5" : "white", borderRadius: 12, cursor: "pointer", textAlign: "left",
                  transition: "all 0.12s",
                }}>
                  <span style={{ fontSize: "0.95rem", color: "#1a1a1a", fontWeight: sel ? 700 : 500 }}>{opt.name}</span>
                  {sel && <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#F4A623", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "0.75rem", fontWeight: 700 }}>✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom: 30 }}>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 4px", color: "#1a1a1a" }}>Para acompañar</h3>
          <p style={{ fontSize: "0.78rem", color: "#999", margin: "0 0 12px" }}>Opcional · Hasta 4</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {EXTRAS.map((opt) => {
              const sel = extras.includes(opt.id);
              return (
                <button key={opt.id} onClick={() => toggleExtra(opt.id)} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%",
                  padding: "14px 16px", border: sel ? "2px solid #F4A623" : "1.5px solid #ececea",
                  background: sel ? "#FFFCF5" : "white", borderRadius: 12, cursor: "pointer", textAlign: "left",
                }}>
                  <span style={{ fontSize: "0.95rem", color: "#1a1a1a", fontWeight: sel ? 700 : 500 }}>{opt.name}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: "0.85rem", color: sel ? "#F4A623" : "#666", fontWeight: 600 }}>+{fmt(opt.priceDelta)}</span>
                    <span style={{ width: 20, height: 20, borderRadius: 6, background: sel ? "#F4A623" : "white", border: sel ? "none" : "1.5px solid #d0d0ce", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "0.75rem", fontWeight: 700 }}>{sel ? "✓" : ""}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sugerencias */}
        <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 4px", color: "#1a1a1a" }}>El Genio sugiere</h3>
        <p style={{ fontSize: "0.78rem", color: "#999", margin: "0 0 14px" }}>Acompañamientos populares con este plato</p>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none" }}>
          {SUGGESTED.map((s) => (
            <button key={s.name} style={{ flexShrink: 0, width: 140, background: "white", border: "1.5px solid #ececea", borderRadius: 12, padding: 0, overflow: "hidden", cursor: "pointer", textAlign: "left" }}>
              <div style={{ aspectRatio: "1 / 1", overflow: "hidden", background: "#f5f5f3" }}>
                <img src={s.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div style={{ padding: "8px 10px" }}>
                <p style={{ fontSize: "0.82rem", fontWeight: 600, margin: "0 0 2px", color: "#1a1a1a", lineHeight: 1.3 }}>{s.name}</p>
                <p style={{ fontSize: "0.78rem", color: "#F4A623", fontWeight: 700, margin: 0 }}>{fmt(s.price)}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Sticky CTA footer */}
      <div style={{ position: "sticky", bottom: 0, background: "white", borderTop: "1px solid #ececea", padding: "12px 18px", boxShadow: "0 -4px 16px rgba(0,0,0,0.04)" }}>
        <button style={{ width: "100%", padding: "16px", background: "#F4A623", color: "white", border: "none", borderRadius: 14, fontSize: "0.98rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", paddingLeft: 22, paddingRight: 22, boxShadow: "0 4px 14px rgba(244,166,35,0.35)" }}>
          <span>Lo quiero</span>
          <span>{fmt(total)} →</span>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────
export default function PreviewDishModalPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#1a1a1a", color: "white", fontFamily: "var(--font-dm), -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ padding: "24px 32px", borderBottom: "1px solid #2a2a2a" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 6px" }}>3 propuestas — Light mode dish modal</h1>
        <p style={{ fontSize: "0.88rem", color: "#999", margin: 0 }}>Comparativa lado a lado. Scroll dentro de cada columna para ver todo el modal (descripción, modificadores y sugerencias).</p>
      </div>

      {/* Grid de 3 columnas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, padding: "24px 32px", maxWidth: 1500, margin: "0 auto" }} className="preview-grid">
        {/* A */}
        <div>
          <div style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 4px", color: "#FFD600" }}>A · Editorial</h2>
            <p style={{ fontSize: "0.82rem", color: "#888", margin: 0, lineHeight: 1.45 }}>Cream warm + Playfair italic + acento dorado. Estilo editorial de revista gourmet. Botón negro tipo "fine dining".</p>
          </div>
          <div style={{ aspectRatio: "9 / 18", overflow: "auto", borderRadius: 16, border: "1px solid #2a2a2a", boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}>
            <VariantA />
          </div>
        </div>

        {/* B */}
        <div>
          <div style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 4px", color: "#FFD600" }}>B · Minimal Apple</h2>
            <p style={{ fontSize: "0.82rem", color: "#888", margin: 0, lineHeight: 1.45 }}>Blanco puro + sans-serif limpio + cards grises sutiles. Estilo Apple/iOS. Funcional, espacioso, neutro.</p>
          </div>
          <div style={{ aspectRatio: "9 / 18", overflow: "auto", borderRadius: 16, border: "1px solid #2a2a2a", boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}>
            <VariantB />
          </div>
        </div>

        {/* C */}
        <div>
          <div style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 4px", color: "#FFD600" }}>C · Casual / DoorDash</h2>
            <p style={{ fontSize: "0.82rem", color: "#888", margin: 0, lineHeight: 1.45 }}>Blanco + naranja del brand + cards con bordes y CTAs prominentes. Estilo apps de delivery. Más accesible/casual.</p>
          </div>
          <div style={{ aspectRatio: "9 / 18", overflow: "auto", borderRadius: 16, border: "1px solid #2a2a2a", boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}>
            <VariantC />
          </div>
        </div>
      </div>

      <div style={{ padding: "24px 32px 60px", maxWidth: 1500, margin: "0 auto", color: "#888", fontSize: "0.82rem", lineHeight: 1.6 }}>
        <p style={{ marginBottom: 8 }}><strong style={{ color: "#fff" }}>Cómo elegir:</strong> click en los modificadores, scrollea, observa el sticky footer.</p>
        <p style={{ marginBottom: 0 }}>Cuando me digas cuál preferís (A, B o C — o mezcla), aplico la paleta a <code style={{ background: "#000", padding: "2px 6px", borderRadius: 3, color: "#FFD600" }}>DishDetail.tsx</code>, <code style={{ background: "#000", padding: "2px 6px", borderRadius: 3, color: "#FFD600" }}>DishModifierDrawer.tsx</code> y los sugeridos.</p>
      </div>

      <style jsx>{`
        @media (max-width: 900px) {
          .preview-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
