"use client";

import { useState } from "react";

const GOLD = "#F4A623";
const BG = "#0a0a0a";

const VIEWS = [
  { name: "Lista", icon: "☰", color: "#3b82f6" },
  { name: "Impact", icon: "◆", color: "#a855f7" },
];
const COLORS = [
  { swatch: "#F4A623" }, { swatch: "#ef4444" }, { swatch: "#22c55e" },
  { swatch: "#3b82f6" }, { swatch: "#a855f7" }, { swatch: "#ec4899" },
];

function FakeCartaBG() {
  return (
    <div style={{ padding: "60px 14px 200px", background: BG, minHeight: "100vh" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: "#1a1a1a", margin: "0 auto 8px", display: "grid", placeItems: "center", fontSize: 20 }}>🍽</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: "0 0 2px" }}>Mi Restaurante</h2>
        <p style={{ fontSize: 11, color: "#666", margin: 0 }}>Santiago</p>
      </div>
      {["Entradas", "Platos de fondo", "Postres"].map(cat => (
        <div key={cat} style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: GOLD, marginBottom: 6, paddingLeft: 4 }}>{cat}</h3>
          {[1, 2].map(i => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#111", borderRadius: 10, marginBottom: 4, border: "1px solid #1a1a1a" }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "#1a1a1a" }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 8, width: `${65 - i * 10}%`, background: "#222", borderRadius: 4 }} />
                <div style={{ height: 6, width: "25%", background: "#1a1a1a", borderRadius: 3, marginTop: 4 }} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════
   DISEÑO 1: Pill bar flotante (ultra compacto)
   ══════════════════════════════════════════ */
function Design1() {
  const [sel, setSel] = useState(0);
  const [dark, setDark] = useState(true);
  const [col, setCol] = useState(0);
  return (
    <div style={{
      position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", zIndex: 100,
      background: "rgba(18,18,18,.95)", backdropFilter: "blur(14px)",
      borderRadius: 999, padding: "6px 8px",
      border: "1px solid #2a2a2a", boxShadow: "0 4px 24px rgba(0,0,0,.5)",
      display: "flex", alignItems: "center", gap: 4,
      animation: "dUp .35s ease",
    }}>
      {VIEWS.map((v, i) => (
        <button key={i} onClick={() => setSel(i)} style={{
          padding: "8px 14px", borderRadius: 999, border: "none", cursor: "pointer",
          background: sel === i ? `${v.color}25` : "transparent",
          color: sel === i ? v.color : "#888",
          fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 5,
          transition: "all .2s",
        }}>
          <span style={{ fontSize: 14 }}>{v.icon}</span> {v.name}
        </button>
      ))}
      <div style={{ width: 1, height: 20, background: "#333", margin: "0 2px" }} />
      <button onClick={() => setDark(!dark)} style={{
        width: 32, height: 32, borderRadius: "50%", border: "none", cursor: "pointer",
        background: "#1a1a1a", display: "grid", placeItems: "center", fontSize: 14,
      }}>{dark ? "🌙" : "☀️"}</button>
      <div style={{ width: 1, height: 20, background: "#333", margin: "0 2px" }} />
      {COLORS.map((c, i) => (
        <button key={i} onClick={() => setCol(i)} style={{
          width: 18, height: 18, borderRadius: "50%", background: c.swatch, border: col === i ? "2px solid #fff" : "2px solid transparent",
          cursor: "pointer", padding: 0, transition: "all .15s",
        }} />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════
   DISEÑO 2: FAB expandible (circle → panel)
   ══════════════════════════════════════════ */
function Design2() {
  const [open, setOpen] = useState(true);
  const [sel, setSel] = useState(0);
  const [dark, setDark] = useState(true);
  const [col, setCol] = useState(0);
  if (!open) return (
    <button onClick={() => setOpen(true)} style={{
      position: "fixed", bottom: 20, right: 16, zIndex: 100,
      width: 52, height: 52, borderRadius: "50%",
      background: "rgba(18,18,18,.95)", border: "1px solid #333",
      boxShadow: "0 4px 20px rgba(0,0,0,.4)", cursor: "pointer",
      display: "grid", placeItems: "center", fontSize: 18,
      animation: "dUp .3s ease",
    }}>🎨</button>
  );
  return (
    <div style={{
      position: "fixed", bottom: 20, right: 16, zIndex: 100,
      background: "rgba(18,18,18,.96)", backdropFilter: "blur(14px)",
      borderRadius: 20, padding: "14px 16px", width: 200,
      border: "1px solid #2a2a2a", boxShadow: "0 8px 30px rgba(0,0,0,.5)",
      animation: "dUp .3s ease",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#888" }}>Personalizar</span>
        <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "#555", fontSize: 13, cursor: "pointer" }}>✕</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {VIEWS.map((v, i) => (
          <button key={i} onClick={() => setSel(i)} style={{
            padding: "8px 12px", borderRadius: 10, border: "none", cursor: "pointer",
            background: sel === i ? `${v.color}20` : "#1a1a1a",
            color: sel === i ? v.color : "#999",
            fontSize: 12, fontWeight: 600, textAlign: "left",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontSize: 16 }}>{v.icon}</span> Vista {v.name}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <button onClick={() => setDark(!dark)} style={{
          flex: 1, padding: "7px 0", borderRadius: 8, border: "none", cursor: "pointer",
          background: "#1a1a1a", fontSize: 12, fontWeight: 600, color: "#bbb",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
        }}>{dark ? "🌙 Dark" : "☀️ Light"}</button>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
        {COLORS.map((c, i) => (
          <button key={i} onClick={() => setCol(i)} style={{
            width: 22, height: 22, borderRadius: "50%", background: c.swatch,
            border: col === i ? "2px solid #fff" : "2px solid transparent",
            cursor: "pointer", padding: 0,
          }} />
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   DISEÑO 3: Drawer slide-up mínimo
   ══════════════════════════════════════════ */
function Design3() {
  const [sel, setSel] = useState(0);
  const [dark, setDark] = useState(true);
  const [col, setCol] = useState(0);
  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 99, background: "rgba(0,0,0,.4)" }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
        background: "#141414", borderRadius: "16px 16px 0 0",
        padding: "12px 14px 24px",
        boxShadow: "0 -8px 30px rgba(0,0,0,.4)",
        animation: "dUp .35s ease",
      }}>
        <div style={{ width: 32, height: 3, borderRadius: 2, background: "#333", margin: "0 auto 12px" }} />
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {VIEWS.map((v, i) => (
            <button key={i} onClick={() => setSel(i)} style={{
              flex: 1, padding: "10px 8px", borderRadius: 10, border: `1.5px solid ${sel === i ? `${v.color}55` : "#252525"}`,
              background: sel === i ? `${v.color}15` : "#1a1a1a", cursor: "pointer", textAlign: "center",
            }}>
              <div style={{ fontSize: 18, lineHeight: 1 }}>{v.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: sel === i ? v.color : "#bbb", marginTop: 3 }}>{v.name}</div>
            </button>
          ))}
          <button onClick={() => setDark(!dark)} style={{
            padding: "10px 12px", borderRadius: 10, background: "#1a1a1a",
            border: "1.5px solid #252525", cursor: "pointer", textAlign: "center",
          }}>
            <div style={{ fontSize: 18, lineHeight: 1 }}>{dark ? "🌙" : "☀️"}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#bbb", marginTop: 3 }}>{dark ? "Dark" : "Light"}</div>
          </button>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
          {COLORS.map((c, i) => (
            <button key={i} onClick={() => setCol(i)} style={{
              width: 24, height: 24, borderRadius: "50%", background: c.swatch,
              border: col === i ? "2.5px solid #fff" : "2.5px solid transparent",
              boxShadow: col === i ? `0 0 8px ${c.swatch}50` : "none",
              cursor: "pointer", padding: 0,
            }} />
          ))}
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════
   DISEÑO 4: Inline strip (pegado abajo, 1 fila)
   ══════════════════════════════════════════ */
function Design4() {
  const [sel, setSel] = useState(0);
  const [dark, setDark] = useState(true);
  const [col, setCol] = useState(0);
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
      background: "rgba(14,14,14,.97)", backdropFilter: "blur(12px)",
      borderTop: "1px solid #222",
      padding: "10px 12px", display: "flex", alignItems: "center", gap: 8,
      animation: "dUp .3s ease",
    }}>
      {VIEWS.map((v, i) => (
        <button key={i} onClick={() => setSel(i)} style={{
          padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer",
          background: sel === i ? `${v.color}20` : "transparent",
          color: sel === i ? v.color : "#777",
          fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 4,
        }}>
          <span style={{ fontSize: 13 }}>{v.icon}</span>{v.name}
        </button>
      ))}
      <div style={{ width: 1, height: 18, background: "#333" }} />
      <button onClick={() => setDark(!dark)} style={{
        background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: 2,
      }}>{dark ? "🌙" : "☀️"}</button>
      <div style={{ width: 1, height: 18, background: "#333" }} />
      <div style={{ display: "flex", gap: 5, marginLeft: "auto" }}>
        {COLORS.map((c, i) => (
          <button key={i} onClick={() => setCol(i)} style={{
            width: 16, height: 16, borderRadius: "50%", background: c.swatch,
            border: col === i ? "2px solid #fff" : "2px solid transparent",
            cursor: "pointer", padding: 0,
          }} />
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   DISEÑO 5: Card flotante con tabs
   ══════════════════════════════════════════ */
function Design5() {
  const [sel, setSel] = useState(0);
  const [dark, setDark] = useState(true);
  const [col, setCol] = useState(0);
  const [tab, setTab] = useState<"vista" | "tema">("vista");
  return (
    <div style={{
      position: "fixed", bottom: 20, left: 14, right: 14, zIndex: 100,
      background: "rgba(18,18,18,.96)", backdropFilter: "blur(14px)",
      borderRadius: 18, overflow: "hidden",
      border: "1px solid #2a2a2a", boxShadow: "0 8px 30px rgba(0,0,0,.5)",
      animation: "dUp .35s ease",
    }}>
      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #222" }}>
        {(["vista", "tema"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
            background: tab === t ? "#1e1e1e" : "transparent",
            color: tab === t ? "#fff" : "#555",
            fontSize: 12, fontWeight: 700, textTransform: "capitalize",
            borderBottom: tab === t ? "2px solid #fff" : "2px solid transparent",
          }}>{t === "vista" ? "📐 Vista" : "🎨 Tema"}</button>
        ))}
      </div>
      <div style={{ padding: "12px 14px" }}>
        {tab === "vista" ? (
          <div style={{ display: "flex", gap: 8 }}>
            {VIEWS.map((v, i) => (
              <button key={i} onClick={() => setSel(i)} style={{
                flex: 1, padding: "14px 8px", borderRadius: 12,
                background: sel === i ? `${v.color}18` : "#1a1a1a",
                border: `1.5px solid ${sel === i ? `${v.color}55` : "#252525"}`,
                cursor: "pointer", textAlign: "center",
              }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>{v.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: sel === i ? v.color : "#bbb" }}>{v.name}</div>
              </button>
            ))}
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <button onClick={() => setDark(!dark)} style={{
                flex: 1, padding: "10px", borderRadius: 10, border: "1.5px solid #252525",
                background: dark ? "#1a1a1a" : "#f5f5f5", cursor: "pointer",
                fontSize: 12, fontWeight: 600, color: dark ? "#bbb" : "#333",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>{dark ? "🌙 Dark" : "☀️ Light"}</button>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
              {COLORS.map((c, i) => (
                <button key={i} onClick={() => setCol(i)} style={{
                  width: 28, height: 28, borderRadius: "50%", background: c.swatch,
                  border: col === i ? "2.5px solid #fff" : "2.5px solid transparent",
                  boxShadow: col === i ? `0 0 10px ${c.swatch}50` : "none",
                  cursor: "pointer", padding: 0,
                }} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   PÁGINA PREVIEW
   ══════════════════════════════════════════ */
export default function PreviewCustomize() {
  const [active, setActive] = useState<1 | 2 | 3 | 4 | 5 | null>(null);

  const designs = [
    { n: 1, label: "Pill bar" },
    { n: 2, label: "FAB panel" },
    { n: 3, label: "Mini drawer" },
    { n: 4, label: "Bottom strip" },
    { n: 5, label: "Card + tabs" },
  ];

  return (
    <div style={{ background: BG, minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <style>{`@keyframes dUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>

      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
        padding: "10px 8px", background: "rgba(10,10,10,.95)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid #222", display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap",
      }}>
        {designs.map(d => (
          <button key={d.n} onClick={() => setActive(active === d.n ? null : d.n as any)}
            style={{
              padding: "6px 12px", borderRadius: 8, border: "1px solid",
              borderColor: active === d.n ? `${GOLD}50` : "#333",
              background: active === d.n ? `${GOLD}15` : "#1a1a1a",
              color: active === d.n ? GOLD : "#888",
              fontSize: 11, fontWeight: 700, cursor: "pointer",
            }}>
            {d.n}. {d.label}
          </button>
        ))}
      </div>

      <FakeCartaBG />

      {active === 1 && <Design1 />}
      {active === 2 && <Design2 />}
      {active === 3 && <Design3 />}
      {active === 4 && <Design4 />}
      {active === 5 && <Design5 />}
    </div>
  );
}
