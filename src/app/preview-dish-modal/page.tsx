"use client";

/**
 * Preview del DishDetail con ÚNICAMENTE color-flip dark→light.
 * Mismo layout, mismas fonts, mismos sizes/paddings/positions que el actual.
 * Solo cambian colores de fondo y texto para adaptarlos a fondo blanco.
 *
 * Mapping aplicado:
 *   bg #000                           → #fff
 *   color: "white"                    → #1a1a1a
 *   color: "rgba(255,255,255,0.9)"   → rgba(0,0,0,0.88)
 *   color: "rgba(255,255,255,0.78)"  → rgba(0,0,0,0.7)
 *   color: "rgba(255,255,255,0.55)"  → rgba(0,0,0,0.55)
 *   color: "rgba(255,255,255,0.45)"  → rgba(0,0,0,0.5)
 *   color: "rgba(255,255,255,0.4)"   → rgba(0,0,0,0.45)
 *   color: "#999"                     → #666 (más contraste sobre blanco)
 *   color: "#fbbf24" (gold)           → #92400e (amber dark, contraste sobre blanco)
 *   bg "rgba(255,255,255,0.1)"        → rgba(0,0,0,0.05)
 *   border "rgba(255,255,255,0.08)"   → rgba(0,0,0,0.08)
 *   bg "rgba(255,255,255,0.06)"       → rgba(0,0,0,0.03)
 *   bg "rgba(244,166,35,0.2)"         → rgba(244,166,35,0.12) (más sutil)
 *   close btn bg "rgba(0,0,0,0.45)"   → rgba(255,255,255,0.92) + sombra
 *   placeholder gradient #1a1a1a/2a   → #f0f0ec / #e8e4dc
 */
import { useState } from "react";

// Sample dish data (replica de Tonkotsu Ramen de Isekai)
const SAMPLE = {
  name: "Tonkotsu Ramen",
  category: "Principales",
  description:
    "Caldo espeso de hueso de cerdo cocinado 18 horas, con fideos ramen al dente, cerdo chashu marinado, huevo soft-boiled, kikurage, cebollín fresco y mayu (aceite de ajo rostizado).",
  price: 13000,
  photo: "https://images.unsplash.com/photo-1623341214825-9f4f963727da?w=900&auto=format&fit=crop&q=80",
  isRec: true,
  isSpicy: true,
  dishDiet: null as string | null,
  isGlutenFree: false,
  isLactoseFree: false,
  isPhotoReferential: false,
};

const MOD_GROUPS = [
  {
    name: "Tipo de fideo",
    options: [
      { name: "Fino", price: 0, description: null },
      { name: "Grueso", price: 0, description: null },
    ],
  },
  {
    name: "Para acompañar",
    options: [
      { name: "Extra chashu", price: 2000, description: null },
      { name: "Extra fideo", price: 2500, description: null },
      { name: "Kikurage extra", price: 1000, description: "Hongo de madera marinado" },
      { name: "Huevo extra", price: 1500, description: null },
    ],
  },
];

const SUGGESTED = [
  { name: "Gyosa de cerdo", price: 7800, description: "Empanada tradicional de cerdo y verduras al vapor", photo: "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=400&auto=format&fit=crop&q=70", isSpicy: false, isRec: false, isPopular: true },
  { name: "Karaage", price: 7800, description: "Pollo frito estilo japonés con ensalada mixta", photo: "https://images.unsplash.com/photo-1606755456206-b25206cde27e?w=400&auto=format&fit=crop&q=70", isSpicy: false, isRec: true, isPopular: false },
];

const fmt = (n: number) => `$${n.toLocaleString("es-CL")}`;

function DishDetailLight() {
  const [showRecTooltip, setShowRecTooltip] = useState(false);

  return (
    <div
      className="font-[family-name:var(--font-dm)]"
      style={{
        flex: "0 0 100%",
        width: "100%",
        minHeight: "100%",
        overflowY: "auto",
        background: "#fff", // ← era #000
      }}
    >
      {/* Photo */}
      <div style={{ position: "relative", width: "100%", height: "min(55vh, 420px)", overflow: "hidden" }}>
        <img src={SAMPLE.photo} alt={SAMPLE.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} />

        {/* Top gradient (queda sutil sobre fondo claro) */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 100, pointerEvents: "none", background: "linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.04) 50%, transparent 100%)" }} />

        {/* Imagen referencial — sobre la foto sigue blanco con sombra (igual) */}
        {SAMPLE.isPhotoReferential && (
          <div style={{ position: "absolute", bottom: 8, right: 12, pointerEvents: "none" }}>
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.55)", fontWeight: 400, letterSpacing: "0.02em", textShadow: "0 1px 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.5)" }}>Imagen referencial</span>
          </div>
        )}
      </div>

      {/* Close button — ahora blanco con sombra suave (era rgba(0,0,0,0.45) + texto blanco) */}
      <button
        style={{
          position: "absolute", top: 16, right: 16, zIndex: 130, width: 34, height: 34, borderRadius: "50%",
          background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)",
          border: "0.5px solid rgba(0,0,0,0.08)",
          color: "#1a1a1a", fontSize: "1rem",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          cursor: "pointer",
        }}
      >
        ✕
      </button>

      {/* Content */}
      <div style={{ position: "relative", zIndex: 1, background: "#fff", padding: "20px 20px 60px" }}>
        {/* "Recomendado" tooltip */}
        {showRecTooltip && (
          <div
            onClick={() => setShowRecTooltip(false)}
            style={{ marginBottom: 10, padding: "10px 14px", borderRadius: 12, background: "rgba(244,166,35,0.10)", border: "1px solid rgba(244,166,35,0.25)", cursor: "pointer" }}
          >
            <p style={{ margin: 0, fontSize: "0.88rem", color: "rgba(0,0,0,0.85)", lineHeight: 1.4 }}>
              ⭐ Isekai Ramen recomienda este plato.
            </p>
          </div>
        )}

        {/* Header — name left + badge right */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ color: "#666", fontSize: "13.5px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 4, display: "block" }}>{SAMPLE.category}</span>
            <h2 style={{ fontSize: "32px", fontWeight: 800, color: "#1a1a1a", lineHeight: 1.1, margin: 0, letterSpacing: "-0.5px" }}>
              {SAMPLE.name}
            </h2>
            <div style={{ marginTop: 6 }}>
              <span style={{ color: "#555", fontSize: "18px", fontWeight: 500 }}>{fmt(SAMPLE.price)}</span>
            </div>
          </div>
          {SAMPLE.isRec && (
            <div style={{ flexShrink: 0 }}>
              <button
                onClick={() => { setShowRecTooltip(!showRecTooltip); setTimeout(() => setShowRecTooltip(false), 2000); }}
                style={{ background: "rgba(244,166,35,0.12)", border: "1px solid rgba(244,166,35,0.35)", color: "#92400e", fontSize: "0.85rem", fontWeight: 600, padding: "4px 12px", borderRadius: 50, cursor: "pointer", whiteSpace: "nowrap" }}
              >
                ⭐ Recomendado
              </button>
            </div>
          )}
        </div>

        {/* Description */}
        <p style={{ margin: 0, fontSize: "18px", color: "rgba(0,0,0,0.7)", lineHeight: 1.5, width: "100%" }}>
          {SAMPLE.description}
        </p>

        {/* Sellos (dieta/picante/alergeno) */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 16 }}>
          {SAMPLE.isSpicy && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px",
              borderRadius: 50, background: "rgba(239,68,68,0.14)", color: "#dc2626",
              fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap",
            }}>
              <span aria-hidden>🌶️</span>
              <span>Picante</span>
            </span>
          )}
        </div>

        {/* Modifier groups */}
        <div style={{ marginTop: 24 }}>
          {MOD_GROUPS.map((g) => {
            const rows = g.options;
            return (
              <div key={g.name} style={{ marginBottom: 16 }}>
                <p style={{ color: "#666", fontSize: "13.5px", fontWeight: 500, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>{g.name}</p>
                <div>
                  {rows.map((row, i) => (
                    <div key={i} style={{ padding: "10px 0", borderBottom: i < rows.length - 1 ? "1px solid rgba(0,0,0,0.08)" : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ color: "rgba(0,0,0,0.88)", fontSize: "0.92rem", fontWeight: 600, flex: 1 }}>{row.name}</span>
                        {row.price !== 0 && (
                          <span style={{ color: "rgba(0,0,0,0.5)", fontSize: "0.85rem", fontWeight: 400, flexShrink: 0, marginLeft: 12 }}>
                            +{fmt(row.price)}
                          </span>
                        )}
                      </div>
                      {row.description && (
                        <p style={{ color: "rgba(0,0,0,0.45)", fontSize: "0.85rem", margin: "4px 0 0", lineHeight: 1.4 }}>{row.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Cross-sell suggestions */}
        <div style={{ marginTop: 32 }}>
          <p style={{ fontSize: "0.82rem", color: "rgba(0,0,0,0.45)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, fontWeight: 600 }}>El Genio sugiere para acompañar</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {SUGGESTED.map((s) => (
              <div
                key={s.name}
                style={{ display: "flex", gap: 14, padding: "16px 18px", background: "rgba(0,0,0,0.03)", borderRadius: 16, cursor: "pointer", border: "1px solid rgba(0,0,0,0.05)" }}
              >
                <div style={{ position: "relative", width: 78, height: 78, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "rgba(0,0,0,0.04)" }}>
                  <img src={s.photo} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {(s.isRec || s.isPopular) && (
                    <div style={{ display: "flex", gap: 5, marginBottom: 4 }}>
                      {s.isRec && <span style={{ fontSize: "0.62rem", fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: "rgba(244,166,35,0.12)", color: "#92400e" }}>⭐ Recomendado</span>}
                      {s.isPopular && !s.isRec && <span style={{ fontSize: "0.62rem", fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: "rgba(239,68,68,0.10)", color: "#dc2626" }}>🔥 Popular hoy</span>}
                    </div>
                  )}
                  <p style={{ fontSize: "1.05rem", fontWeight: 600, color: "#1a1a1a", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.name}
                    {s.isSpicy && <>{" "}<span style={{ fontSize: "12px", verticalAlign: "middle" }}>🌶️</span></>}
                  </p>
                  {s.description && (
                    <p style={{ fontSize: "0.86rem", color: "rgba(0,0,0,0.5)", margin: "4px 0 0", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.4 }}>{s.description}</p>
                  )}
                  <span style={{ fontSize: "0.92rem", color: "#555", fontWeight: 500, marginTop: 4, display: "block" }}>{fmt(s.price)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Seals: comparación antes/después ────────────────────────────
type SealSpec = { emoji: string; label: string; bg: string; color: string; border?: string; shadow?: string; forYou?: boolean };

const SEAL_OLD: SealSpec[] = [
  { emoji: "🌿", label: "Vegano", bg: "rgba(34,197,94,0.18)", color: "#4ade80" },
  { emoji: "🥗", label: "Vegetariano", bg: "rgba(134,239,172,0.18)", color: "#86efac" },
  { emoji: "🌶️", label: "Picante", bg: "rgba(239,68,68,0.18)", color: "#f87171" },
  { emoji: "🌾", label: "Sin gluten", bg: "rgba(212,160,71,0.18)", color: "#d4a647" },
  { emoji: "🥜", label: "Frutos secos", bg: "rgba(234,88,12,0.14)", color: "#fb923c", border: "1px solid rgba(234,88,12,0.45)", shadow: "0 0 0 2px rgba(234,88,12,0.10)" },
  { emoji: "🥛", label: "Sin lactosa", bg: "rgba(96,165,250,0.18)", color: "#60a5fa", forYou: true },
  { emoji: "🫘", label: "Sin soya", bg: "rgba(52,211,153,0.18)", color: "#34d399", forYou: true },
  { emoji: "🥜", label: "Sin frutos secos", bg: "rgba(192,138,91,0.12)", color: "#a06a3a", forYou: true },
];

const SEAL_NEW: SealSpec[] = [
  { emoji: "🌿", label: "Vegano", bg: "rgba(34,197,94,0.12)", color: "#15803d" },
  { emoji: "🥗", label: "Vegetariano", bg: "rgba(34,197,94,0.10)", color: "#16a34a" },
  { emoji: "🌶️", label: "Picante", bg: "rgba(239,68,68,0.10)", color: "#dc2626" },
  { emoji: "🌾", label: "Sin gluten", bg: "rgba(212,160,71,0.16)", color: "#854d0e" },
  { emoji: "🥜", label: "Frutos secos", bg: "rgba(234,88,12,0.10)", color: "#9a3412", border: "1px solid rgba(234,88,12,0.5)", shadow: "0 0 0 2px rgba(234,88,12,0.10)" },
  { emoji: "🥛", label: "Sin lactosa", bg: "rgba(96,165,250,0.12)", color: "#1d4ed8", forYou: true },
  { emoji: "🫘", label: "Sin soya", bg: "rgba(52,211,153,0.12)", color: "#047857", forYou: true },
  { emoji: "🥜", label: "Sin frutos secos", bg: "rgba(192,138,91,0.14)", color: "#854d0e", forYou: true },
];

function SealRow({ seal }: { seal: SealSpec }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: (seal.forYou || seal.border) ? "4px 12px" : "5px 12px",
      borderRadius: 50, background: seal.bg, color: seal.color,
      fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap",
      border: seal.border || (seal.forYou ? "1px solid rgba(244,166,35,0.55)" : "none"),
      boxShadow: seal.shadow || (seal.forYou ? "0 0 0 2px rgba(244,166,35,0.08)" : "none"),
    }}>
      <span aria-hidden>{seal.emoji}</span>
      <span>{seal.label}</span>
      {seal.forYou && <span style={{ fontSize: "10px", color: "#F4A623", fontWeight: 700, marginLeft: 2 }}>· para ti</span>}
    </span>
  );
}

export default function PreviewDishModalPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#1a1a1a", color: "white", fontFamily: "var(--font-dm), -apple-system, sans-serif" }}>
      {/* Header explicativo */}
      <div style={{ padding: "24px 32px", borderBottom: "1px solid #2a2a2a" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "0 0 6px" }}>Comparativa de sellos del modal — antes vs propuesta</h1>
        <p style={{ fontSize: "0.88rem", color: "#999", margin: 0 }}>Sobre fondo blanco real (mismo del modal), tamaño y forma idénticos al actual. Solo cambia la saturación de los colores para mejorar contraste y legibilidad.</p>
      </div>

      {/* Comparativa de sellos sobre fondo blanco */}
      <div style={{ padding: "32px 32px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }} className="seal-grid">
          {/* ANTES */}
          <div>
            <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#ff8585", margin: "0 0 4px" }}>ANTES (actual)</h2>
            <p style={{ fontSize: "0.78rem", color: "#888", margin: "0 0 14px" }}>Texto pastel claro — diseñado para el dark mode original. Sobre blanco contrast ratio ~2.5:1.</p>
            <div style={{ background: "#fff", padding: "20px 18px", borderRadius: 16, border: "1px solid #2a2a2a", display: "flex", flexWrap: "wrap", gap: 6 }}>
              {SEAL_OLD.map((s, i) => <SealRow key={`old-${i}`} seal={s} />)}
            </div>
          </div>

          {/* PROPUESTA */}
          <div>
            <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#86efac", margin: "0 0 4px" }}>PROPUESTA</h2>
            <p style={{ fontSize: "0.78rem", color: "#888", margin: "0 0 14px" }}>Texto saturado oscuro — contrast ratio &gt;6:1. Misma estructura, mismos íconos, mismos tamaños.</p>
            <div style={{ background: "#fff", padding: "20px 18px", borderRadius: 16, border: "1px solid #4ade80", display: "flex", flexWrap: "wrap", gap: 6 }}>
              {SEAL_NEW.map((s, i) => <SealRow key={`new-${i}`} seal={s} />)}
            </div>
          </div>
        </div>

        {/* Caso particular: Frutos secos warning */}
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#FFD600", margin: "0 0 4px" }}>⚠ Caso clave: Frutos secos (warning de alérgeno)</h2>
          <p style={{ fontSize: "0.78rem", color: "#888", margin: "0 0 14px" }}>Este sello debería actuar como alerta — anafilaxia. Hoy se siente "decorativo". La propuesta lo eleva a alerta visible.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }} className="seal-grid">
            <div style={{ background: "#fff", padding: "20px 18px", borderRadius: 12, border: "1px solid #2a2a2a" }}>
              <p style={{ fontSize: "0.7rem", color: "#888", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Antes</p>
              <SealRow seal={SEAL_OLD[4]} />
            </div>
            <div style={{ background: "#fff", padding: "20px 18px", borderRadius: 12, border: "1px solid #4ade80" }}>
              <p style={{ fontSize: "0.7rem", color: "#888", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Propuesta</p>
              <SealRow seal={SEAL_NEW[4]} />
            </div>
          </div>
        </div>

        <div style={{ marginTop: 32, padding: "16px 18px", background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 12, fontSize: "0.82rem", color: "#999", lineHeight: 1.6 }}>
          <strong style={{ color: "#fff" }}>Si te gusta la propuesta</strong> — toco solo las 8 líneas del bloque de seals en <code style={{ background: "#000", padding: "1px 6px", borderRadius: 3, color: "#FFD600" }}>DishDetail.tsx</code> (líneas 508-521 aprox). Cero cambios de tamaño, padding, íconos, posiciones o lógica condicional. Solo bg + color.
        </div>

        <style jsx>{`
          @media (max-width: 720px) {
            .seal-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>

      {/* Header explicativo del modal completo (existing) */}
      <div style={{ padding: "32px 32px 24px", borderTop: "1px solid #2a2a2a" }}>
        <h1 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 6px" }}>↓ El modal completo (color-flip aplicado anteriormente)</h1>
      </div>

      {/* Frame del modal — alto fijo + scroll dentro */}
      <div style={{ display: "flex", justifyContent: "center", padding: "32px 16px 60px" }}>
        <div style={{
          width: "100%", maxWidth: 460,
          aspectRatio: "9 / 17",
          minHeight: 720,
          overflow: "auto",
          borderRadius: 22,
          border: "1px solid #2a2a2a",
          boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
          position: "relative", // para que el close button absolute se posicione bien
        }}>
          <DishDetailLight />
        </div>
      </div>

      {/* Color mapping reference */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 32px 60px", color: "#999", fontSize: "0.82rem", lineHeight: 1.7 }}>
        <h3 style={{ fontSize: "0.95rem", color: "#fff", margin: "0 0 12px" }}>Mapping de colores aplicado</h3>
        <div style={{ background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 10, padding: "16px 18px", fontFamily: "monospace", fontSize: "0.78rem", lineHeight: 1.7 }}>
          <div>bg <code style={{ color: "#666" }}>#000</code> → <code style={{ color: "#86efac" }}>#fff</code></div>
          <div><code style={{ color: "#666" }}>"white"</code> → <code style={{ color: "#86efac" }}>#1a1a1a</code></div>
          <div><code style={{ color: "#666" }}>rgba(255,255,255,0.78)</code> (descripción) → <code style={{ color: "#86efac" }}>rgba(0,0,0,0.7)</code></div>
          <div><code style={{ color: "#666" }}>"#999"</code> (categoría / labels) → <code style={{ color: "#86efac" }}>#666</code></div>
          <div><code style={{ color: "#666" }}>"#fbbf24"</code> (precio amarillo) → <code style={{ color: "#86efac" }}>#92400e</code> (amber dark)</div>
          <div><code style={{ color: "#666" }}>rgba(255,255,255,0.1)</code> (rating pill bg) → <code style={{ color: "#86efac" }}>rgba(0,0,0,0.05)</code></div>
          <div><code style={{ color: "#666" }}>rgba(255,255,255,0.08)</code> (separadores) → <code style={{ color: "#86efac" }}>rgba(0,0,0,0.08)</code></div>
          <div><code style={{ color: "#666" }}>rgba(255,255,255,0.06)</code> (cards cross-sell) → <code style={{ color: "#86efac" }}>rgba(0,0,0,0.03)</code></div>
          <div>close btn <code style={{ color: "#666" }}>rgba(0,0,0,0.45)</code> + white → <code style={{ color: "#86efac" }}>rgba(255,255,255,0.92)</code> + dark + sombra</div>
          <div>tag pills <code style={{ color: "#666" }}>rgba(244,166,35,0.2)</code> → <code style={{ color: "#86efac" }}>rgba(244,166,35,0.12)</code></div>
        </div>

        <p style={{ marginTop: 20 }}>
          <strong style={{ color: "#fff" }}>Nada más cambia</strong>: mismo padding 20/20/60 del body, misma altura de foto (55vh max 420px), mismo title 32px font-weight 800, misma descripción 18px, mismos seals con sus colores brand, mismo modificador con dividers de 1px, mismo cross-sell con cards rounded-16 y avatar 78px circular.
        </p>
      </div>
    </div>
  );
}
