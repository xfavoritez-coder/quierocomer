"use client";

export default function Footer({ onPlanesClick }: { onPlanesClick?: () => void } = {}) {
  return (
    <footer style={{
      padding: "44px 0",
      background: "#090806",
      borderTop: "1px solid rgba(58,52,45,1)",
      position: "relative",
      zIndex: 2,
    }}>
      <div style={{
        maxWidth: 1220,
        margin: "0 auto",
        padding: "0 clamp(22px,4vw,64px)",
        textAlign: "center",
      }}>
        <div style={{
          fontSize: 13,
          color: "rgba(135,125,115,.65)",
          marginBottom: 10,
        }}>
          © 2026 QuieroComer® · Santiago, Chile
        </div>
        <div style={{
          display: "flex",
          gap: 24,
          justifyContent: "center",
          flexWrap: "wrap",
        }}>
          <a href="/landing" style={{ color: "#887B68", textDecoration: "none", fontSize: 13 }}>Inicio</a>
          <a href="/landing#planes" onClick={onPlanesClick ? (e) => { e.preventDefault(); onPlanesClick(); } : undefined} style={{ color: "#887B68", textDecoration: "none", fontSize: 13 }}>Planes</a>
          <a href="mailto:hola@quierocomer.cl" style={{ color: "#887B68", textDecoration: "none", fontSize: 13 }}>Contacto</a>
        </div>
      </div>
    </footer>
  );
}
