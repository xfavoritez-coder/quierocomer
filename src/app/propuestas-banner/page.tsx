"use client";

import { useState } from "react";

const VISTAS = ["Lista", "Galería", "Impact"];

function Propuesta1() {
  const [vista, setVista] = useState(1);
  return (
    <div style={{ marginBottom: 60 }}>
      <h2 style={{ color: "#888", fontSize: 14, marginBottom: 12 }}>Propuesta 1 — Barra slim fija</h2>
      <div style={{ maxWidth: 430, margin: "0 auto", borderRadius: 16, overflow: "hidden", border: "1px solid #222" }}>
        {/* Banner */}
        <div style={{
          background: "linear-gradient(135deg, #F4A623, #e8913a)", padding: "10px 16px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>🧞</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#0e0e0e" }}>Esto es un demo de tu carta</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={{ fontSize: 11, fontWeight: 700, color: "#0e0e0e", background: "rgba(0,0,0,0.12)", border: "none", borderRadius: 50, padding: "5px 12px", cursor: "pointer" }}>Ver planes</button>
            <button style={{ fontSize: 11, fontWeight: 800, color: "white", background: "#0e0e0e", border: "none", borderRadius: 50, padding: "5px 14px", cursor: "pointer" }}>Activar carta →</button>
          </div>
        </div>
        {/* Fake carta */}
        <div style={{ background: "#0a0a0a", padding: "40px 20px", textAlign: "center" }}>
          <p style={{ color: "#555", fontSize: 13 }}>[ Carta del restaurante aquí ]</p>
        </div>
      </div>
    </div>
  );
}

function Propuesta2() {
  const [vista, setVista] = useState(1);
  return (
    <div style={{ marginBottom: 60 }}>
      <h2 style={{ color: "#888", fontSize: 14, marginBottom: 12 }}>Propuesta 2 — Dock flotante inferior</h2>
      <div style={{ maxWidth: 430, margin: "0 auto", borderRadius: 16, overflow: "hidden", border: "1px solid #222", position: "relative" }}>
        {/* Fake carta */}
        <div style={{ background: "#0a0a0a", padding: "60px 20px 100px", textAlign: "center" }}>
          <p style={{ color: "#555", fontSize: 13 }}>[ Carta del restaurante aquí ]</p>
        </div>
        {/* Dock */}
        <div style={{
          position: "absolute", bottom: 16, left: 16, right: 16,
          background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)",
          borderRadius: 22, padding: "10px 6px",
          display: "flex", justifyContent: "space-around", alignItems: "center",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 -8px 30px rgba(0,0,0,0.4)",
        }}>
          {[
            { icon: "👁", label: "Vistas", active: false },
            { icon: "📊", label: "Stats", active: false },
            { icon: "📱", label: "QR", active: false },
            { icon: "✏️", label: "Editar", active: false },
          ].map((item, i) => (
            <button key={i} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              background: "none", border: "none", cursor: "pointer", color: "#aaa", fontSize: 10, fontWeight: 600,
            }}>
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
          <button style={{
            background: "#F4A623", color: "#0e0e0e", border: "none", borderRadius: 50,
            padding: "10px 20px", fontSize: 12, fontWeight: 800, cursor: "pointer",
            boxShadow: "0 4px 16px rgba(244,166,35,0.3)",
          }}>Activar</button>
        </div>
      </div>
    </div>
  );
}

function Propuesta3() {
  const [vista, setVista] = useState(1);
  return (
    <div style={{ marginBottom: 60 }}>
      <h2 style={{ color: "#888", fontSize: 14, marginBottom: 12 }}>Propuesta 3 — Banner hero con preview</h2>
      <div style={{ maxWidth: 430, margin: "0 auto", borderRadius: 16, overflow: "hidden", border: "1px solid #222" }}>
        {/* Banner hero */}
        <div style={{
          background: "linear-gradient(135deg, #111 0%, #1a1510 100%)",
          padding: "20px 18px", borderBottom: "1px solid rgba(244,166,35,0.15)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#F4A623", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#F4A623", letterSpacing: "0.1em", textTransform: "uppercase" }}>Modo demo</span>
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: "white", margin: "0 0 6px" }}>Tu carta está lista para activarse</h3>
          <p style={{ fontSize: 12, color: "#999", margin: "0 0 16px", lineHeight: 1.4 }}>Los clientes ya podrían estar viendo tu menú. Activa para obtener tu QR y panel de gestión.</p>

          {/* Vista selector */}
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {VISTAS.map((v, i) => (
              <button key={v} onClick={() => setVista(i)} style={{
                flex: 1, padding: "7px 0", borderRadius: 8, border: "none", cursor: "pointer",
                background: vista === i ? "#F4A623" : "rgba(255,255,255,0.06)",
                color: vista === i ? "#0e0e0e" : "#888",
                fontSize: 12, fontWeight: vista === i ? 700 : 500,
              }}>{v}</button>
            ))}
          </div>

          {/* CTA row */}
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "none", background: "#F4A623", color: "#0e0e0e", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
              Activar mi carta →
            </button>
            <button style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "#aaa", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              📊 Demo stats
            </button>
          </div>
        </div>
        {/* Fake carta */}
        <div style={{ background: "#0a0a0a", padding: "40px 20px", textAlign: "center" }}>
          <p style={{ color: "#555", fontSize: 13 }}>[ Vista {VISTAS[vista]} ]</p>
        </div>
      </div>
    </div>
  );
}

function Propuesta4() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 60 }}>
      <h2 style={{ color: "#888", fontSize: 14, marginBottom: 12 }}>Propuesta 4 — Tab lateral + panel slide</h2>
      <div style={{ maxWidth: 430, margin: "0 auto", borderRadius: 16, overflow: "hidden", border: "1px solid #222", position: "relative" }}>
        {/* Fake carta */}
        <div style={{ background: "#0a0a0a", padding: "60px 20px", textAlign: "center" }}>
          <p style={{ color: "#555", fontSize: 13 }}>[ Carta del restaurante aquí ]</p>
        </div>
        {/* Tab */}
        <button onClick={() => setOpen(!open)} style={{
          position: "absolute", top: "50%", right: 0, transform: "translateY(-50%)",
          background: "#F4A623", color: "#0e0e0e", border: "none", borderRadius: "8px 0 0 8px",
          padding: "12px 6px", fontSize: 10, fontWeight: 800, cursor: "pointer",
          writingMode: "vertical-rl", textOrientation: "mixed", letterSpacing: "0.1em",
        }}>DEMO</button>
        {/* Panel */}
        {open && (
          <div style={{
            position: "absolute", top: 0, right: 0, bottom: 0, width: 220,
            background: "rgba(0,0,0,0.92)", backdropFilter: "blur(20px)",
            borderLeft: "1px solid rgba(244,166,35,0.2)", padding: "20px 16px",
            display: "flex", flexDirection: "column", gap: 12,
          }}>
            <button onClick={() => setOpen(false)} style={{ alignSelf: "flex-end", background: "none", border: "none", color: "#666", fontSize: 16, cursor: "pointer" }}>✕</button>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "white", margin: 0 }}>Modo Demo</h3>
            <p style={{ fontSize: 11, color: "#888", lineHeight: 1.4, margin: 0 }}>Explora cómo se verá tu carta antes de activarla.</p>
            {["Lista", "Galería", "Impact"].map(v => (
              <button key={v} style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
                👁 Vista {v}
              </button>
            ))}
            <button style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#aaa", fontSize: 12, cursor: "pointer", textAlign: "left" }}>📊 Ver demo estadísticas</button>
            <button style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#aaa", fontSize: 12, cursor: "pointer", textAlign: "left" }}>📱 Ver mi QR</button>
            <div style={{ flex: 1 }} />
            <button style={{ padding: "14px 0", borderRadius: 10, border: "none", background: "#F4A623", color: "#0e0e0e", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
              Activar mi carta →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Propuesta5() {
  const [vista, setVista] = useState(1);
  const [dismissed, setDismissed] = useState(false);
  return (
    <div style={{ marginBottom: 60 }}>
      <h2 style={{ color: "#888", fontSize: 14, marginBottom: 12 }}>Propuesta 5 — Pill flotante + expand</h2>
      <div style={{ maxWidth: 430, margin: "0 auto", borderRadius: 16, overflow: "hidden", border: "1px solid #222", position: "relative" }}>
        {/* Fake carta */}
        <div style={{ background: "#0a0a0a", padding: "60px 20px 100px", textAlign: "center" }}>
          <p style={{ color: "#555", fontSize: 13 }}>[ Carta del restaurante aquí ]</p>
        </div>
        {/* Pill flotante top center */}
        {!dismissed ? (
          <div style={{
            position: "absolute", top: 12, left: 12, right: 12,
            background: "rgba(0,0,0,0.88)", backdropFilter: "blur(16px)",
            borderRadius: 16, padding: "14px 16px",
            border: "1px solid rgba(244,166,35,0.2)",
            boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#F4A623" }} />
                <span style={{ fontSize: 11, fontWeight: 800, color: "#F4A623", letterSpacing: "0.08em" }}>DEMO</span>
              </div>
              <button onClick={() => setDismissed(true)} style={{ background: "none", border: "none", color: "#555", fontSize: 12, cursor: "pointer" }}>✕</button>
            </div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "white", margin: "0 0 10px" }}>Así se ve tu carta. Actívala para que tus clientes la vean.</p>
            {/* Vista pills */}
            <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
              {VISTAS.map((v, i) => (
                <button key={v} onClick={() => setVista(i)} style={{
                  flex: 1, padding: "6px 0", borderRadius: 6, cursor: "pointer",
                  background: vista === i ? "rgba(244,166,35,0.15)" : "rgba(255,255,255,0.04)",
                  color: vista === i ? "#F4A623" : "#666",
                  fontSize: 11, fontWeight: vista === i ? 700 : 500,
                  border: vista === i ? "1px solid rgba(244,166,35,0.3)" : "1px solid rgba(255,255,255,0.06)",
                }}>{v}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: "#F4A623", color: "#0e0e0e", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                Activar carta
              </button>
              <button style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#888", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                📊 Stats
              </button>
              <button style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#888", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                📱 QR
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setDismissed(false)} style={{
            position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)",
            border: "1px solid rgba(244,166,35,0.3)", borderRadius: 50,
            padding: "6px 14px", display: "flex", alignItems: "center", gap: 6,
            cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#F4A623" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#F4A623" }}>DEMO</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default function PropuestasBanner() {
  return (
    <div style={{ background: "#050505", minHeight: "100vh", color: "#f0f0f0", fontFamily: "system-ui, sans-serif", padding: "30px 16px" }}>
      <div style={{ maxWidth: 500, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#F4A623", marginBottom: 30 }}>Propuestas Banner Demo</h1>
        <Propuesta1 />
        <Propuesta2 />
        <Propuesta3 />
        <Propuesta4 />
        <Propuesta5 />
      </div>
    </div>
  );
}
