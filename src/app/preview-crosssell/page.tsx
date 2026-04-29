"use client";

import { useState } from "react";

const DISH = {
  name: "Roll Salmón Acevichado",
  price: "$12.900",
  desc: "Salmón fresco con palta, queso crema y salsa acevichada. Topping de cebolla crispy.",
  photo: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&q=80",
  category: "Rolls",
};

const SUGGESTIONS = [
  { name: "Sauvignon Blanc", price: "$6.500", photo: "https://images.unsplash.com/photo-1566995541428-f4e256dff5bb?w=400&q=80", reason: "Maridaje", desc: "Vino blanco chileno, notas cítricas y herbales. Ideal para mariscos y pescados" },
  { name: "Edamames", price: "$4.200", photo: "https://images.unsplash.com/photo-1564834744159-ff0ea41ba4b9?w=400&q=80", reason: "Complemento", desc: "Porotos de soya al vapor con sal de mar y un toque de limón" },
  { name: "Gyozas de Cerdo", price: "$5.800", photo: "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=400&q=80", reason: "Otros vieron", desc: "Empanaditas japonesas rellenas de cerdo y verduras, selladas a la plancha" },
  { name: "Limonada Jengibre", price: "$3.900", photo: "https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=400&q=80", reason: "Bebida", desc: "Limonada natural con jengibre fresco, menta y un toque de miel" },
];

/* ═══════════════════════════════════════════
   OPCION 1: Cards horizontales con scroll
   Estilo minimalista, cards pequeñas
   ═══════════════════════════════════════════ */
function Option1() {
  return (
    <div style={{ marginTop: 20 }}>
      <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, fontWeight: 600 }}>Complementa tu pedido</p>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
        {SUGGESTIONS.map((s) => (
          <div key={s.name} style={{ flexShrink: 0, width: 130, cursor: "pointer" }}>
            <div style={{ width: 130, height: 90, borderRadius: 10, overflow: "hidden", marginBottom: 6 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.photo} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "white", margin: "0 0 2px", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</p>
            <p style={{ fontSize: "0.75rem", color: "#fbbf24", margin: 0, fontWeight: 500 }}>{s.price}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   OPCION 2: Lista compacta con fotos redondas
   Estilo más limpio, vertical
   ═══════════════════════════════════════════ */
function Option2() {
  return (
    <div style={{ marginTop: 20 }}>
      <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, fontWeight: 600 }}>También te puede gustar</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {SUGGESTIONS.slice(0, 3).map((s) => (
          <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(255,255,255,0.06)", borderRadius: 12, cursor: "pointer" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.photo} alt={s.name} style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "white", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</p>
              <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.45)", margin: "2px 0 0", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.35 }}>{s.desc}</p>
            </div>
            <span style={{ fontSize: "0.82rem", color: "#fbbf24", fontWeight: 600, flexShrink: 0 }}>{s.price}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   OPCION 3: Pills con foto inline
   Compacto, scroll horizontal, estilo badge
   ═══════════════════════════════════════════ */
function Option3() {
  return (
    <div style={{ marginTop: 20 }}>
      <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, fontWeight: 600 }}>Complementa tu pedido</p>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
        {SUGGESTIONS.map((s) => (
          <div key={s.name} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8, padding: "6px 14px 6px 6px", background: "rgba(255,255,255,0.08)", borderRadius: 50, cursor: "pointer", border: "1px solid rgba(255,255,255,0.1)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.photo} alt={s.name} style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: "0.78rem", fontWeight: 600, color: "white", margin: 0, whiteSpace: "nowrap" }}>{s.name}</p>
              <p style={{ fontSize: "0.68rem", color: "#fbbf24", margin: 0, fontWeight: 500 }}>{s.price}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════ */
export default function PreviewCrossSell() {
  const [selected, setSelected] = useState<number | null>(null);

  const options = [
    { id: 1, title: "Cards horizontales", subtitle: "Fotos rectangulares con scroll, nombre y precio debajo", component: <Option1 /> },
    { id: 2, title: "Lista compacta", subtitle: "Filas verticales con foto redonda, razón de sugerencia visible", component: <Option2 /> },
    { id: 3, title: "Pills con foto", subtitle: "Badges redondeados con scroll horizontal, ultra compacto", component: <Option3 /> },
  ];

  return (
    <div style={{ background: "#111", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ padding: "24px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <h1 style={{ color: "white", fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
          Venta cruzada — Mockups
        </h1>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.88rem", marginTop: 6 }}>
          Cómo se vería la sección de sugerencias debajo de un plato en el modal
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 40, padding: "24px 0 60px" }}>
        {options.map((opt) => (
          <div key={opt.id}>
            {/* Label */}
            <div style={{ padding: "0 20px 12px", display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ color: "#F4A623", fontSize: "1.1rem", fontWeight: 700 }}>Opción {opt.id}</span>
              <span style={{ color: "white", fontSize: "1.05rem", fontWeight: 600 }}>{opt.title}</span>
            </div>
            <p style={{ padding: "0 20px", color: "rgba(255,255,255,0.4)", fontSize: "0.8rem", marginTop: 0, marginBottom: 12 }}>{opt.subtitle}</p>

            {/* Phone frame */}
            <div
              style={{
                margin: "0 auto",
                width: 375,
                maxWidth: "92vw",
                borderRadius: 32,
                overflow: "hidden",
                border: "3px solid rgba(255,255,255,0.15)",
                background: "#000",
                position: "relative",
                boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
              }}
            >
              {/* Notch */}
              <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 120, height: 24, background: "#111", borderRadius: "0 0 16px 16px", zIndex: 10 }} />

              {/* Fake dish photo */}
              <div style={{ width: "100%", height: 220, position: "relative", overflow: "hidden" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={DISH.photo} alt={DISH.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                {/* Close button */}
                <div style={{ position: "absolute", top: 16, right: 16, width: 34, height: 34, borderRadius: "50%", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "1rem" }}>✕</div>
              </div>

              {/* Content */}
              <div style={{ padding: "16px 20px 30px" }}>
                <span style={{ color: "#999", fontSize: "11px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.8px" }}>{DISH.category}</span>
                <h2 style={{ fontSize: "26px", fontWeight: 800, color: "white", lineHeight: 1.1, margin: "4px 0 0", letterSpacing: "-0.5px" }}>{DISH.name}</h2>
                <p style={{ color: "#fbbf24", fontSize: "16px", fontWeight: 500, marginTop: 6 }}>{DISH.price}</p>
                <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.7)", lineHeight: 1.45, marginTop: 8 }}>{DISH.desc}</p>

                <button style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 12, background: "rgba(255,255,255,0.12)", border: "none", color: "rgba(255,255,255,0.55)", fontSize: "13px", fontWeight: 500, padding: "6px 14px", borderRadius: 50 }}>
                  Ver ingredientes
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                </button>

                {/* Cross-sell option */}
                {opt.component}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
