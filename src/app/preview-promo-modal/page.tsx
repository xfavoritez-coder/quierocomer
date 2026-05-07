"use client";

import { useState } from "react";
import { X } from "lucide-react";

/**
 * Preview de propuestas para el modal de oferta tipo "graphic" (imagen
 * promocional). El layout actual superpone el titulo + descripcion + precio
 * encima de la imagen con un overlay degradado, pero cuando la imagen ya
 * trae texto propio (como la de Hand Roll '30 PIEZAS POR $12.900'), todo se
 * mezcla y la descripcion se vuelve dificil de leer.
 *
 * Propuestas:
 *   A. Split puro: imagen 55% arriba, panel blanco abajo con todo
 *   B. Imagen full + card flotante translucido tipo glass al fondo
 *   C. Imagen 70% arriba con fade fuerte, info en card blanco abajo (compromise)
 *   D. Imagen fondo blur + foto centrada + card blanco abajo
 */

const MOCK = {
  name: "MIÉRCOLES — Promo 30",
  description:
    "10 Hot Tori en Panko, 10 Special Ebi tempura en palta, 10 California Almond Tori en Sésamo",
  promoPrice: 12900,
  originalPrice: 17900,
  imageUrl: "/preview-promo-modal/handroll-mock.jpg", // mock placeholder
  validUntil: "2026-12-31",
};

const PLACEHOLDER_BG =
  "linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 50%, #2a2a2a 100%)";

/* Box que simula el viewport mobile para todas las propuestas */
function PhoneFrame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ fontFamily: "var(--font-playfair)", fontSize: "0.88rem", fontWeight: 700, color: "#F4A623", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
        {label}
      </p>
      <div
        style={{
          width: 360,
          height: 720,
          background: "#000",
          borderRadius: 32,
          overflow: "hidden",
          position: "relative",
          border: "10px solid #1a1a1a",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function CloseBtn() {
  return (
    <button
      style={{
        position: "absolute", top: 14, right: 14, width: 36, height: 36, borderRadius: "50%",
        background: "rgba(0,0,0,0.5)", backdropFilter: "blur(10px)", border: "none",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", zIndex: 10,
      }}
    >
      <X size={16} color="white" strokeWidth={2} />
    </button>
  );
}

/* ════════ ACTUAL ════════ */
function CurrentLayout() {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#000" }}>
      <CloseBtn />
      {/* Imagen full */}
      <div style={{ position: "absolute", inset: 0, background: PLACEHOLDER_BG, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", color: "white" }}>
        <p style={{ fontSize: "12px", letterSpacing: "0.2em", opacity: 0.5, margin: 0 }}>LA PROMO DE SUSHI QUE</p>
        <h1 style={{ fontSize: "62px", fontWeight: 900, letterSpacing: "-0.02em", margin: 0, color: "white" }}>RESUELVE</h1>
        <p style={{ fontSize: "82px", fontWeight: 900, margin: "20px 0", color: "rgba(255,255,255,0.2)" }}>30</p>
        <p style={{ fontSize: "11px", opacity: 0.4, letterSpacing: "0.15em", marginTop: 30 }}>30 PIEZAS DE SUSHI POR $12.900</p>
      </div>
      {/* Overlay degradado actual */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, transparent 25%, transparent 45%, rgba(0,0,0,0.5) 70%, rgba(0,0,0,0.88) 100%)" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 24px 32px" }}>
        <span style={{ fontSize: "10px", fontWeight: 700, color: "#F4A623", letterSpacing: "0.2em", textTransform: "uppercase", display: "block", marginBottom: 10 }}>✦ OFERTA</span>
        <h2 style={{ fontFamily: "var(--font-playfair)", fontSize: "24px", fontWeight: 600, lineHeight: 1.1, color: "white", margin: "0 0 8px" }}>
          {MOCK.name}
        </h2>
        <p style={{ fontSize: "14px", lineHeight: 1.5, color: "rgba(255,255,255,0.7)", margin: "0 0 12px" }}>{MOCK.description}</p>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-playfair)", fontSize: "18px", fontWeight: 600, color: "#F4A623" }}>${MOCK.promoPrice.toLocaleString("es-CL")}</span>
          <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", textDecoration: "line-through" }}>${MOCK.originalPrice.toLocaleString("es-CL")}</span>
        </div>
      </div>
    </div>
  );
}

/* ════════ A — Split: imagen 55% arriba, card blanco abajo ════════ */
function VariantA() {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "white", display: "flex", flexDirection: "column" }}>
      <CloseBtn />
      <div style={{ position: "relative", height: "55%", background: PLACEHOLDER_BG, color: "white", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
        <p style={{ fontSize: "10px", letterSpacing: "0.2em", opacity: 0.5, margin: 0 }}>LA PROMO DE SUSHI QUE</p>
        <h1 style={{ fontSize: "48px", fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>RESUELVE</h1>
        <p style={{ fontSize: "62px", fontWeight: 900, margin: "10px 0", color: "rgba(255,255,255,0.2)" }}>30</p>
      </div>
      <div style={{ flex: 1, padding: "20px 22px", overflow: "auto" }}>
        <span style={{ display: "inline-block", fontSize: "9.5px", fontWeight: 800, color: "white", background: "#F4A623", letterSpacing: "0.12em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 999, marginBottom: 12 }}>
          SOLO HOY MIÉRCOLES
        </span>
        <h2 style={{ fontFamily: "var(--font-playfair)", fontSize: "24px", fontWeight: 700, lineHeight: 1.15, color: "#0e0e0e", margin: "0 0 10px" }}>
          {MOCK.name}
        </h2>
        <p style={{ fontSize: "14px", lineHeight: 1.55, color: "#4a4a4a", margin: "0 0 16px" }}>{MOCK.description}</p>
        <div style={{ padding: "14px 0", borderTop: "1px solid rgba(0,0,0,0.08)" }}>
          <p style={{ fontSize: "10.5px", fontWeight: 600, color: "#8a8a8a", letterSpacing: "0.18em", textTransform: "uppercase", margin: "0 0 4px" }}>PRECIO OFERTA</p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: "var(--font-playfair)", fontSize: "30px", fontWeight: 700, color: "#F4A623", lineHeight: 1 }}>${MOCK.promoPrice.toLocaleString("es-CL")}</span>
            <span style={{ fontSize: "15px", color: "#8a8a8a", textDecoration: "line-through" }}>${MOCK.originalPrice.toLocaleString("es-CL")}</span>
            <span style={{ marginLeft: "auto", fontSize: "12px", fontWeight: 700, color: "#10b981", background: "#d1fae5", padding: "5px 9px", borderRadius: 7 }}>Ahorras $5.000</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════ B — Imagen full + glass card flotante con info ════════ */
function VariantB() {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#000" }}>
      <CloseBtn />
      <div style={{ position: "absolute", inset: 0, background: PLACEHOLDER_BG, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", color: "white" }}>
        <p style={{ fontSize: "11px", letterSpacing: "0.2em", opacity: 0.5, margin: 0 }}>LA PROMO DE SUSHI QUE</p>
        <h1 style={{ fontSize: "54px", fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>RESUELVE</h1>
        <p style={{ fontSize: "70px", fontWeight: 900, margin: "16px 0 0", color: "rgba(255,255,255,0.2)" }}>30</p>
      </div>
      {/* Card glass flotante */}
      <div style={{ position: "absolute", bottom: 16, left: 16, right: 16, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(20px)", borderRadius: 18, padding: "16px 18px", border: "1px solid rgba(255,255,255,0.3)", boxShadow: "0 10px 40px rgba(0,0,0,0.4)" }}>
        <span style={{ display: "inline-block", fontSize: "9.5px", fontWeight: 800, color: "white", background: "#F4A623", letterSpacing: "0.12em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 999, marginBottom: 8 }}>
          SOLO HOY MIÉRCOLES
        </span>
        <h2 style={{ fontFamily: "var(--font-playfair)", fontSize: "20px", fontWeight: 700, lineHeight: 1.15, color: "#0e0e0e", margin: "0 0 6px" }}>
          {MOCK.name}
        </h2>
        <p style={{ fontSize: "13px", lineHeight: 1.5, color: "#4a4a4a", margin: "0 0 10px" }}>{MOCK.description}</p>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontFamily: "var(--font-playfair)", fontSize: "22px", fontWeight: 700, color: "#F4A623" }}>${MOCK.promoPrice.toLocaleString("es-CL")}</span>
          <span style={{ fontSize: "13px", color: "#8a8a8a", textDecoration: "line-through" }}>${MOCK.originalPrice.toLocaleString("es-CL")}</span>
        </div>
      </div>
    </div>
  );
}

/* ════════ C — Imagen 70% arriba, info abajo en panel blanco ════════ */
function VariantC() {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "white", display: "flex", flexDirection: "column" }}>
      <CloseBtn />
      <div style={{ position: "relative", height: "70%", background: PLACEHOLDER_BG, color: "white", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", overflow: "hidden" }}>
        <p style={{ fontSize: "12px", letterSpacing: "0.2em", opacity: 0.5, margin: 0 }}>LA PROMO DE SUSHI QUE</p>
        <h1 style={{ fontSize: "58px", fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>RESUELVE</h1>
        <p style={{ fontSize: "78px", fontWeight: 900, margin: "16px 0 0", color: "rgba(255,255,255,0.2)" }}>30</p>
      </div>
      <div style={{ padding: "16px 22px 22px", flex: 1, overflow: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <span style={{ display: "inline-block", fontSize: "9.5px", fontWeight: 800, color: "white", background: "#F4A623", letterSpacing: "0.12em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 999 }}>
            SOLO HOY MIÉRCOLES
          </span>
        </div>
        <h2 style={{ fontFamily: "var(--font-playfair)", fontSize: "21px", fontWeight: 700, lineHeight: 1.15, color: "#0e0e0e", margin: "0 0 8px" }}>
          {MOCK.name}
        </h2>
        <p style={{ fontSize: "13px", lineHeight: 1.5, color: "#4a4a4a", margin: "0 0 12px" }}>{MOCK.description}</p>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontFamily: "var(--font-playfair)", fontSize: "24px", fontWeight: 700, color: "#F4A623", lineHeight: 1 }}>${MOCK.promoPrice.toLocaleString("es-CL")}</span>
          <span style={{ fontSize: "14px", color: "#8a8a8a", textDecoration: "line-through" }}>${MOCK.originalPrice.toLocaleString("es-CL")}</span>
        </div>
      </div>
    </div>
  );
}

/* ════════ D — Imagen fondo blur + foto centrada + card abajo ════════ */
function VariantD() {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#0e0e0e", overflow: "hidden" }}>
      <CloseBtn />
      {/* Background blureado */}
      <div style={{ position: "absolute", inset: 0, background: PLACEHOLDER_BG, filter: "blur(30px) brightness(0.55)", transform: "scale(1.1)" }} />
      <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 24px 24px" }}>
        {/* Foto centrada con borde redondeado */}
        <div style={{ width: "100%", height: 380, borderRadius: 18, background: PLACEHOLDER_BG, color: "white", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
          <p style={{ fontSize: "10px", letterSpacing: "0.2em", opacity: 0.6, margin: 0 }}>LA PROMO DE SUSHI QUE</p>
          <h1 style={{ fontSize: "42px", fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>RESUELVE</h1>
          <p style={{ fontSize: "55px", fontWeight: 900, margin: "10px 0 0", color: "rgba(255,255,255,0.2)" }}>30</p>
        </div>
        {/* Info card */}
        <div style={{ width: "100%", marginTop: 16, background: "rgba(255,255,255,0.97)", borderRadius: 18, padding: "16px 18px", boxShadow: "0 10px 40px rgba(0,0,0,0.3)" }}>
          <span style={{ display: "inline-block", fontSize: "9.5px", fontWeight: 800, color: "white", background: "#F4A623", letterSpacing: "0.12em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 999, marginBottom: 8 }}>
            SOLO HOY MIÉRCOLES
          </span>
          <h2 style={{ fontFamily: "var(--font-playfair)", fontSize: "20px", fontWeight: 700, lineHeight: 1.15, color: "#0e0e0e", margin: "0 0 6px" }}>
            {MOCK.name}
          </h2>
          <p style={{ fontSize: "13px", lineHeight: 1.5, color: "#4a4a4a", margin: "0 0 10px" }}>{MOCK.description}</p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: "var(--font-playfair)", fontSize: "22px", fontWeight: 700, color: "#F4A623" }}>${MOCK.promoPrice.toLocaleString("es-CL")}</span>
            <span style={{ fontSize: "13px", color: "#8a8a8a", textDecoration: "line-through" }}>${MOCK.originalPrice.toLocaleString("es-CL")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PreviewPromoModalPage() {
  return (
    <div style={{ minHeight: "100dvh", background: "#fafaf7", padding: "32px 16px 60px", fontFamily: "var(--font-dm), system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 1700, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 }}>
        <header>
          <h1 style={{ fontFamily: "var(--font-playfair)", fontSize: "1.7rem", fontWeight: 800, color: "#0e0e0e", margin: "0 0 6px" }}>Modal de oferta gráfica — propuestas</h1>
          <p style={{ fontSize: "0.9rem", color: "#666", margin: 0, lineHeight: 1.5 }}>
            El layout actual superpone título y descripción sobre la imagen, lo que se confunde con texto que ya viene en el gráfico. 4 propuestas que separan el contenido en una zona limpia.
          </p>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 28, justifyItems: "center" }}>
          <PhoneFrame label="Actual"><CurrentLayout /></PhoneFrame>
          <PhoneFrame label="A — Split 55/45 (más respiro)"><VariantA /></PhoneFrame>
          <PhoneFrame label="B — Imagen full + glass flotante"><VariantB /></PhoneFrame>
          <PhoneFrame label="C — Imagen 70% + panel blanco (compromise)"><VariantC /></PhoneFrame>
          <PhoneFrame label="D — Imagen blur fondo + foto + card"><VariantD /></PhoneFrame>
        </div>

        <footer style={{ padding: "16px 18px", background: "#fff", borderRadius: 12, border: "1px solid #eee", fontSize: "0.82rem", color: "#666", lineHeight: 1.6, marginTop: 12 }}>
          Mi recomendación: <strong>A o C</strong>. Separan limpiamente la imagen promocional del bloque de información, así la descripción se lee siempre — no compite con el texto que ya tiene la imagen. La A da más espacio al texto, la C respeta más el impacto visual de la promo. Cuando me digas cuál te gusta lo aplico al modal real.
        </footer>
      </div>
    </div>
  );
}
