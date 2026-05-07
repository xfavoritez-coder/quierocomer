"use client";

/**
 * Preview de variantes para destacar productos picantes en la lista cuando
 * el cliente activó el filtro "sin picante" en el Genio. Opcion A (emoji
 * pegado al nombre) ya esta implementada por defecto. Aqui mostramos
 * alternativas B-F para que el usuario elija una.
 *
 * Todas se renderizan SOLO cuando el cliente tiene "_spicy" en restrictions.
 * Para los demas visitantes el destaque NO se muestra.
 */

const MOCK_NAME = "Hot Roll Tori en Panko";
const MOCK_DESC = "10 piezas con salsa teriyaki, palta y sésamo dorado.";
const MOCK_PRICE = "$8.900";
const MOCK_PHOTO = "linear-gradient(135deg, #c95c2a 0%, #8b3a16 100%)";

function CardShell({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ fontFamily: "var(--font-playfair)", fontSize: "0.78rem", fontWeight: 700, color: "#F4A623", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
        {label}
      </p>
      <div style={{ background: "#fafaf7", padding: 14, borderRadius: 14, border: "1px solid #e8e2d4" }}>
        {children}
      </div>
    </div>
  );
}

function PhotoBox({ children }: { children?: React.ReactNode }) {
  return (
    <div style={{ position: "relative", width: 80, height: 80, borderRadius: 12, background: MOCK_PHOTO, flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}>
      🍣
      {children}
    </div>
  );
}

/* ════════ A — Emoji pegado al nombre (ACTUAL) ════════ */
function VariantA() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <PhotoBox />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: "1rem", fontWeight: 600, color: "#1a1a1a", lineHeight: 1.2 }}>
          🌶️ {MOCK_NAME}
        </p>
        <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "#666", lineHeight: 1.4 }}>{MOCK_DESC}</p>
        <p style={{ margin: "6px 0 0", fontSize: "0.92rem", fontWeight: 700, color: "#F4A623" }}>{MOCK_PRICE}</p>
      </div>
    </div>
  );
}

/* ════════ B — Pill sutil rojo claro al lado del precio ════════ */
function VariantB() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <PhotoBox />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: "1rem", fontWeight: 600, color: "#1a1a1a", lineHeight: 1.2 }}>{MOCK_NAME}</p>
        <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "#666", lineHeight: 1.4 }}>{MOCK_DESC}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <span style={{ fontSize: "0.92rem", fontWeight: 700, color: "#F4A623" }}>{MOCK_PRICE}</span>
          <span style={{ fontSize: "0.66rem", padding: "2px 7px", borderRadius: 999, background: "rgba(239,68,68,0.10)", color: "#dc2626", fontWeight: 700, letterSpacing: "0.02em" }}>
            🌶️ Picante
          </span>
        </div>
      </div>
    </div>
  );
}

/* ════════ C — Borde lateral izquierdo rojo de 3px ════════ */
function VariantC() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", borderLeft: "3px solid #ef4444", paddingLeft: 12, marginLeft: -12 }}>
      <PhotoBox />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: "1rem", fontWeight: 600, color: "#1a1a1a", lineHeight: 1.2 }}>{MOCK_NAME}</p>
        <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "#666", lineHeight: 1.4 }}>{MOCK_DESC}</p>
        <p style={{ margin: "6px 0 0", fontSize: "0.92rem", fontWeight: 700, color: "#F4A623" }}>{MOCK_PRICE}</p>
      </div>
    </div>
  );
}

/* ════════ D — Pill 'Picante' debajo del nombre ════════ */
function VariantD() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <PhotoBox />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: "1rem", fontWeight: 600, color: "#1a1a1a", lineHeight: 1.2 }}>{MOCK_NAME}</p>
        <span style={{ display: "inline-block", marginTop: 4, fontSize: "0.62rem", padding: "2px 7px", borderRadius: 999, background: "rgba(239,68,68,0.10)", color: "#dc2626", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          🌶️ Picante
        </span>
        <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "#666", lineHeight: 1.4 }}>{MOCK_DESC}</p>
        <p style={{ margin: "6px 0 0", fontSize: "0.92rem", fontWeight: 700, color: "#F4A623" }}>{MOCK_PRICE}</p>
      </div>
    </div>
  );
}

/* ════════ E — Stamp 🌶️ en esquina superior izquierda de la foto ════════ */
function VariantE() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <PhotoBox>
        <span
          style={{
            position: "absolute",
            top: 6,
            left: 6,
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.95)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.85rem",
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
          }}
        >
          🌶️
        </span>
      </PhotoBox>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: "1rem", fontWeight: 600, color: "#1a1a1a", lineHeight: 1.2 }}>{MOCK_NAME}</p>
        <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "#666", lineHeight: 1.4 }}>{MOCK_DESC}</p>
        <p style={{ margin: "6px 0 0", fontSize: "0.92rem", fontWeight: 700, color: "#F4A623" }}>{MOCK_PRICE}</p>
      </div>
    </div>
  );
}

/* ════════ F — Underline rojo sutil bajo el nombre ════════ */
function VariantF() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <PhotoBox />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: "1rem", fontWeight: 600, color: "#1a1a1a", lineHeight: 1.2, display: "inline-block", borderBottom: "2px solid #ef4444", paddingBottom: 1 }}>
          {MOCK_NAME}
        </p>
        <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "#666", lineHeight: 1.4 }}>{MOCK_DESC}</p>
        <p style={{ margin: "6px 0 0", fontSize: "0.92rem", fontWeight: 700, color: "#F4A623" }}>{MOCK_PRICE}</p>
      </div>
    </div>
  );
}

/* ════════ G — Icono picante a la derecha del nombre, mismo nivel ════════ */
function VariantG() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <PhotoBox />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <p style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: "1rem", fontWeight: 600, color: "#1a1a1a", lineHeight: 1.2 }}>{MOCK_NAME}</p>
          <span style={{ fontSize: "0.85rem" }} title="Picante">🌶️</span>
        </div>
        <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "#666", lineHeight: 1.4 }}>{MOCK_DESC}</p>
        <p style={{ margin: "6px 0 0", fontSize: "0.92rem", fontWeight: 700, color: "#F4A623" }}>{MOCK_PRICE}</p>
      </div>
    </div>
  );
}

export default function PreviewSpicyBadgePage() {
  return (
    <div style={{ minHeight: "100dvh", background: "#fafaf7", padding: "32px 16px 60px", fontFamily: "var(--font-dm), system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
        <header>
          <h1 style={{ fontFamily: "var(--font-playfair)", fontSize: "1.6rem", fontWeight: 800, color: "#0e0e0e", margin: "0 0 8px" }}>
            Destacar picantes — propuestas
          </h1>
          <p style={{ fontSize: "0.92rem", color: "#666", margin: 0, lineHeight: 1.55 }}>
            Solo se muestra cuando el cliente activó &ldquo;sin picante&rdquo; en el Genio. La opción A (emoji pegado al nombre) ya está por defecto. B-G son alternativas más visibles.
          </p>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 20 }}>
          <CardShell label="A — Emoji pegado al nombre (actual)">
            <VariantA />
          </CardShell>
          <CardShell label="B — Pill al lado del precio">
            <VariantB />
          </CardShell>
          <CardShell label="C — Borde lateral rojo">
            <VariantC />
          </CardShell>
          <CardShell label="D — Pill 'Picante' debajo del nombre">
            <VariantD />
          </CardShell>
          <CardShell label="E — Stamp 🌶️ en la foto (esquina)">
            <VariantE />
          </CardShell>
          <CardShell label="F — Underline rojo sutil">
            <VariantF />
          </CardShell>
          <CardShell label="G — Icono al final del nombre (separado)">
            <VariantG />
          </CardShell>
        </div>

        <footer style={{ padding: "16px 18px", background: "#fff", borderRadius: 12, border: "1px solid #eee", fontSize: "0.84rem", color: "#666", lineHeight: 1.6, marginTop: 8 }}>
          <p style={{ margin: 0 }}>
            <strong>Mi recomendación:</strong> <strong>E (stamp en la foto)</strong> es la más escaneable a la distancia — el ojo busca rojo y lo encuentra al instante en la grilla, sin afectar la tipografía del nombre. <strong>D</strong> es la alternativa más informativa para personas que recién aprenden los iconos. Las dos son menos invasivas que la A actual cuando el plato ya tiene un emoji propio en el nombre.
          </p>
        </footer>
      </div>
    </div>
  );
}
