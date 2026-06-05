"use client";

import { useState } from "react";

const GOLD = "#F4A623";
const BG = "#0a0a0a";

// Fake menu items for background
const FAKE_MENU = [
  { cat: "Entradas", items: [{ name: "Empanadas de pino", price: "$4.990", img: "🥟" }, { name: "Ceviche chileno", price: "$7.490", img: "🐟" }] },
  { cat: "Platos de fondo", items: [{ name: "Lomo a lo pobre", price: "$12.990", img: "🥩" }, { name: "Pastel de choclo", price: "$9.990", img: "🌽" }, { name: "Salmón grillado", price: "$14.990", img: "🍣" }] },
  { cat: "Postres", items: [{ name: "Tres leches", price: "$5.490", img: "🍰" }, { name: "Mote con huesillo", price: "$3.990", img: "🍑" }] },
];

function FakeCartaBG() {
  return (
    <div style={{ padding: "70px 14px 120px", background: BG, minHeight: "100vh" }}>
      {/* Fake header */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: "#1a1a1a", margin: "0 auto 8px", display: "grid", placeItems: "center", fontSize: 24 }}>🍽</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: "0 0 2px" }}>Mi Restaurante Demo</h2>
        <p style={{ fontSize: 12, color: "#666", margin: 0 }}>Carta digital · Santiago</p>
      </div>
      {FAKE_MENU.map(cat => (
        <div key={cat.cat} style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: GOLD, marginBottom: 8, paddingLeft: 4 }}>{cat.cat}</h3>
          {cat.items.map(item => (
            <div key={item.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#111", borderRadius: 12, marginBottom: 6, border: "1px solid #1a1a1a" }}>
              <span style={{ fontSize: 28 }}>{item.img}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#ddd" }}>{item.name}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: GOLD }}>{item.price}</div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════
   OPCIÓN 1: Toast swipeable
   ══════════════════════════════════════════ */
function Option1Toast({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const views = [
    { name: "Vista Lista", icon: "☰", desc: "Menú con precios claros", color: "#3b82f6" },
    { name: "Vista Impact", icon: "◆", desc: "Fotos grandes de cada plato", color: "#a855f7" },
  ];
  return (
    <div style={{
      position: "fixed", bottom: 24, left: 12, right: 12, zIndex: 100,
      background: "rgba(20,20,20,.95)", backdropFilter: "blur(12px)",
      borderRadius: 16, padding: "14px 16px",
      border: "1px solid #2a2a2a",
      boxShadow: "0 -8px 40px rgba(0,0,0,.5)",
      animation: "slideUp .4s ease",
    }}>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: ".06em" }}>Tu carta tiene 1 vista</span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", fontSize: 16, cursor: "pointer" }}>✕</button>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {views.map((v, i) => (
          <button key={i} onClick={() => { setStep(i); if (i === 1) setTimeout(onClose, 1500); }}
            style={{
              flex: 1, padding: "14px 10px", borderRadius: 12,
              background: step === i ? `${v.color}15` : "#1a1a1a",
              border: `1.5px solid ${step === i ? `${v.color}50` : "#222"}`,
              cursor: "pointer", textAlign: "center",
              transition: "all .2s",
            }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{v.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: step === i ? v.color : "#888" }}>{v.name}</div>
            <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{v.desc}</div>
          </button>
        ))}
      </div>
      {/* Dots */}
      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 10 }}>
        {views.map((_, i) => (
          <div key={i} style={{ width: step === i ? 18 : 6, height: 6, borderRadius: 3, background: step === i ? GOLD : "#333", transition: "all .2s" }} />
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   OPCIÓN 2: Tip cards (stories)
   ══════════════════════════════════════════ */
function Option2TipCards({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const cards = [
    { title: "Vista Lista", icon: "☰", desc: "Tu carta completa con categorías, precios y descripciones. Ideal para que el cliente encuentre todo rápido.", color: "#3b82f6", bg: "linear-gradient(135deg, #0c1929, #111)" },
    { title: "Vista Impact", icon: "◆", desc: "Fotos grandes de cada plato en pantalla completa. Perfecta para despertar el apetito.", color: "#a855f7", bg: "linear-gradient(135deg, #1a0c29, #111)" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.8)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={() => { if (step < cards.length - 1) setStep(step + 1); else onClose(); }}>
      <div style={{
        width: "100%", maxWidth: 340, borderRadius: 20, overflow: "hidden",
        background: cards[step].bg,
        border: `1px solid ${cards[step].color}30`,
        boxShadow: `0 20px 60px rgba(0,0,0,.5), 0 0 40px ${cards[step].color}10`,
        animation: "fadeScale .3s ease",
        textAlign: "center", padding: "40px 24px 32px",
      }}>
        <style>{`@keyframes fadeScale { from { transform: scale(.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
        <div style={{ fontSize: 56, marginBottom: 16 }}>{cards[step].icon}</div>
        <h3 style={{ fontSize: 22, fontWeight: 800, color: cards[step].color, margin: "0 0 8px" }}>{cards[step].title}</h3>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,.6)", lineHeight: 1.6, margin: "0 0 24px" }}>{cards[step].desc}</p>
        {/* Progress */}
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 16 }}>
          {cards.map((_, i) => (
            <div key={i} style={{ height: 3, borderRadius: 2, flex: 1, maxWidth: 40, background: i <= step ? cards[step].color : "#333", transition: "all .3s" }} />
          ))}
        </div>
        <span style={{ fontSize: 12, color: "#555" }}>{step < cards.length - 1 ? "Toca para continuar" : "Toca para empezar"}</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   OPCIÓN 3: Bottom sheet selector
   ══════════════════════════════════════════ */
function Option3BottomSheet({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 99, background: "rgba(0,0,0,.6)" }} onClick={onClose} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
        background: "#141414", borderRadius: "20px 20px 0 0",
        padding: "20px 16px 32px",
        boxShadow: "0 -12px 40px rgba(0,0,0,.5)",
        animation: "sheetUp .35s ease",
      }}>
        <style>{`@keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "#333", margin: "0 auto 16px" }} />
        <h3 style={{ fontSize: 17, fontWeight: 800, color: "#fff", textAlign: "center", margin: "0 0 4px" }}>Elige cómo ver tu carta</h3>
        <p style={{ fontSize: 13, color: "#666", textAlign: "center", margin: "0 0 18px" }}>Puedes cambiar de vista en cualquier momento</p>

        <div style={{ display: "flex", gap: 10 }}>
          {/* Lista */}
          <button onClick={onClose} style={{
            flex: 1, padding: "18px 12px", borderRadius: 16,
            background: "#1a1a1a", border: "1.5px solid #2a2a2a",
            cursor: "pointer", textAlign: "center",
            transition: "all .2s",
          }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(59,130,246,.1)", border: "1px solid rgba(59,130,246,.2)", margin: "0 auto 10px", display: "grid", placeItems: "center" }}>
              <span style={{ fontSize: 22 }}>☰</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Lista</div>
            <div style={{ fontSize: 11, color: "#888", lineHeight: 1.4 }}>Categorías y precios claros</div>
            {/* Mini preview lines */}
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", background: "#222", borderRadius: 6 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 4, background: "#2a2a2a" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 5, width: `${70 - i * 10}%`, background: "#333", borderRadius: 2 }} />
                    <div style={{ height: 4, width: "30%", background: "#2a2a2a", borderRadius: 2, marginTop: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          </button>

          {/* Impact */}
          <button onClick={onClose} style={{
            flex: 1, padding: "18px 12px", borderRadius: 16,
            background: "#1a1a1a", border: "1.5px solid #2a2a2a",
            cursor: "pointer", textAlign: "center",
            transition: "all .2s",
          }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(168,85,247,.1)", border: "1px solid rgba(168,85,247,.2)", margin: "0 auto 10px", display: "grid", placeItems: "center" }}>
              <span style={{ fontSize: 22 }}>◆</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Impact</div>
            <div style={{ fontSize: 11, color: "#888", lineHeight: 1.4 }}>Fotos grandes y atractivas</div>
            {/* Mini preview grid */}
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{ aspectRatio: "1", background: "#222", borderRadius: 6, display: "grid", placeItems: "center" }}>
                  <div style={{ width: "60%", height: "60%", borderRadius: 4, background: "#2a2a2a" }} />
                </div>
              ))}
            </div>
          </button>
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════
   PÁGINA PREVIEW
   ══════════════════════════════════════════ */
export default function PreviewOnboarding() {
  const [active, setActive] = useState<1 | 2 | 3 | null>(null);

  return (
    <div style={{ background: BG, minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Selector bar */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
        padding: "12px 14px", background: "rgba(10,10,10,.95)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid #222", display: "flex", gap: 8, justifyContent: "center",
      }}>
        {[
          { n: 1, label: "Toast swipeable" },
          { n: 2, label: "Tip cards (stories)" },
          { n: 3, label: "Bottom sheet" },
        ].map(opt => (
          <button key={opt.n} onClick={() => setActive(opt.n as 1 | 2 | 3)}
            style={{
              padding: "8px 16px", borderRadius: 10, border: "1px solid",
              borderColor: active === opt.n ? `${GOLD}50` : "#333",
              background: active === opt.n ? `${GOLD}15` : "#1a1a1a",
              color: active === opt.n ? GOLD : "#888",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}>
            {opt.n}. {opt.label}
          </button>
        ))}
      </div>

      <FakeCartaBG />

      {active === 1 && <Option1Toast onClose={() => setActive(null)} />}
      {active === 2 && <Option2TipCards onClose={() => setActive(null)} />}
      {active === 3 && <Option3BottomSheet onClose={() => setActive(null)} />}
    </div>
  );
}
