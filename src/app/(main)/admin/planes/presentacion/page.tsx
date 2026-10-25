"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import type { PricingConfig, PricePlan } from "@/lib/pricing";

// Paleta (independiente del tema oscuro del admin). Nunca usar #FFF/white/rgb(255
// en backgrounds inline: una regla global del admin los fuerza a oscuro.
const CREAM = "#FBF7EF", CREAM2 = "#F3EBDB", INK = "#211E18", INKSOFT = "#6B6153";
const GOLD = "#D98A1F", GOLDB = "#E8A33A", GOLDT = "#9A5E12";
const CARD = "#FEFBF3", CARDB = "#EADFC9", PAPER = "#FDFBF6";
const CARDSHADOW = "0 12px 30px -18px rgba(90,65,20,0.4)";
const DISP = "'Fraunces', Georgia, serif";
const SANS = "'DM Sans', system-ui, -apple-system, sans-serif";

const fmt = (n: number) => `$${(Number(n) || 0).toLocaleString("es-CL")}`;
const taglineFor = (name: string) => {
  const l = name.toLowerCase();
  if (l.includes("futuro")) return "Tu operación completa: delivery, POS e inventario.";
  if (l.includes("premium")) return "Sin límites de pedidos, para alto volumen.";
  if (l.includes("avanzado")) return "Para locales que ya venden y quieren crecer.";
  if (l.includes("básico") || l.includes("basico")) return "Para empezar a vender online con tu marca.";
  return "Plan de QuieroComer.";
};

/* ───────────────── Escenas animadas (una por característica) ───────────────── */
const Dot = ({ c }: { c: string }) => <span style={{ width: 11, height: 11, borderRadius: "50%", background: c, display: "inline-block" }} />;

function SceneBrowser() {
  return (
    <div style={{ width: 360, maxWidth: "100%" }}>
      <div style={{ background: PAPER, border: "1px solid #E6D9BF", borderRadius: 14, boxShadow: "0 16px 32px -18px rgba(80,55,15,.5)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "#F0E6D2" }}>
          <Dot c="#E06A5A" /><Dot c="#E8B84a" /><Dot c="#63B36a" />
          <div style={{ flex: 1, background: PAPER, border: "1px solid #E6D9BF", borderRadius: 20, padding: "6px 12px", display: "flex", alignItems: "center", gap: 6, fontFamily: SANS, fontSize: 13, color: INKSOFT }}>
            <span style={{ color: "#2E8B57" }}>🔒</span> www.turestaurante.cl
            <span style={{ width: 2, height: 14, background: INK, display: "inline-block", animation: "qcblink 1s step-end infinite" }} />
          </div>
        </div>
        <div style={{ padding: 14 }}>
          <div style={{ height: 68, borderRadius: 10, background: "linear-gradient(120deg,#E8A33A,#C9771A)", display: "flex", alignItems: "flex-end", padding: 10 }}>
            <span style={{ fontFamily: DISP, color: PAPER, fontWeight: 600, fontSize: 18 }}>Tu Restaurante</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 10 }}>
            {([["🍣", "Sushi Roll", "$6.900"], ["🍜", "Ramen", "$7.500"], ["🥟", "Gyozas", "$4.200"]] as const).map(([e, n, p]) => (
              <div key={n} style={{ background: PAPER, border: "1px solid #EFE2C6", borderRadius: 9, overflow: "hidden" }}>
                <div style={{ height: 44, background: "linear-gradient(135deg,#FBEFD6,#F2E0BC)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>{e}</div>
                <div style={{ padding: "5px 7px 7px" }}>
                  <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, color: INK, lineHeight: 1.1 }}>{n}</div>
                  <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, color: GOLD, marginTop: 2 }}>{p}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, textAlign: "center" }}>
            <span style={{ display: "inline-block", background: "#E8A33A", color: "#3a2a0e", fontFamily: SANS, fontWeight: 700, fontSize: 13, padding: "8px 22px", borderRadius: 30, animation: "qcpulse 2s ease-in-out infinite" }}>Pedir ahora</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SceneComandador() {
  const prods: [string, string][] = [["Perro Pollo", "$4.000"], ["Hamb. clásica", "$4.000"], ["Papas fritas", "$3.000"], ["Pepito", "$11.500"]];
  const chips = ["Perros", "Hamburguesas", "Pepito"];
  return (
    <div style={{ width: "100%", maxWidth: 480, display: "flex", gap: 10 }}>
      {/* Carrito */}
      <div style={{ flex: "0 0 40%", background: PAPER, border: "1px solid #E6D9BF", borderRadius: 12, padding: 10, display: "flex", flexDirection: "column", gap: 7, boxShadow: "0 12px 22px -12px rgba(80,55,15,.35)" }}>
        <div style={{ display: "flex", gap: 5 }}>
          <span style={{ flex: 1, textAlign: "center", fontFamily: SANS, fontSize: 9, fontWeight: 700, color: PAPER, background: "#211E18", borderRadius: 7, padding: "5px 0" }}>Retiro</span>
          <span style={{ flex: 1, textAlign: "center", fontFamily: SANS, fontSize: 9, fontWeight: 700, color: INKSOFT, background: "#F0E6D2", borderRadius: 7, padding: "5px 0" }}>Delivery</span>
        </div>
        <div style={{ fontFamily: SANS, fontSize: 8, fontWeight: 700, letterSpacing: 1, color: INKSOFT, textTransform: "uppercase", marginTop: 2 }}>Pedido</div>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: SANS, fontSize: 10, color: INK }}><span>1× Perro Pollo</span><span>$4.000</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: SANS, fontSize: 10, color: INK, animation: "qcrise 5s ease-in-out infinite" }}><span>1× Papas fritas</span><span>$3.000</span></div>
        <div style={{ flex: 1, minHeight: 8 }} />
        <div style={{ borderTop: "1px dashed #D9CBA9", paddingTop: 6, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, color: INK }}>Total</span><span style={{ fontFamily: DISP, fontSize: 16, fontWeight: 600, color: GOLD }}>$7.000</span></div>
        <div style={{ background: "#211E18", color: PAPER, textAlign: "center", fontFamily: SANS, fontSize: 10, fontWeight: 700, padding: "7px 0", borderRadius: 8 }}>Agregar al pedido</div>
      </div>
      {/* Productos */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
        <div style={{ background: PAPER, border: "1px solid #E6D9BF", borderRadius: 20, padding: "6px 12px", fontFamily: SANS, fontSize: 10, color: INKSOFT }}>🔍 Buscar producto…</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {chips.map((c, i) => <span key={c} style={{ fontFamily: SANS, fontSize: 9, fontWeight: 700, color: i === 0 ? "#3a2a0e" : INKSOFT, background: i === 0 ? "#E8A33A" : "#F0E6D2", borderRadius: 20, padding: "4px 10px" }}>{c}</span>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
          {prods.map(([n, p], i) => (
            <div key={n} style={{ background: PAPER, border: `1px solid ${i === 2 ? "#E8A33A" : "#E6D9BF"}`, borderRadius: 9, padding: "8px 9px", display: "flex", flexDirection: "column", gap: 4, animation: i === 2 ? "qcpulse 2s ease-in-out infinite" : undefined, boxShadow: i === 2 ? "0 8px 16px -8px rgba(216,138,31,.5)" : "none" }}>
              <span style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: 700, color: INK, lineHeight: 1.1 }}>{n}</span>
              <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, color: GOLD }}>{p}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScenePayment() {
  return (
    <div style={{ width: 300, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
      <div style={{ width: 260, height: 150, borderRadius: 16, background: "linear-gradient(135deg,#2B2620,#4A4236)", padding: 18, position: "relative", boxShadow: "0 18px 32px -16px rgba(0,0,0,.5)", animation: "qcfloat 3.5s ease-in-out infinite" }}>
        <div style={{ width: 42, height: 30, borderRadius: 6, background: "linear-gradient(135deg,#E8C87a,#C99a3a)" }} />
        <div style={{ position: "absolute", bottom: 42, left: 18, fontFamily: SANS, letterSpacing: 3, color: "#E9DFC9", fontSize: 16 }}>•••• •••• •••• 4028</div>
        <div style={{ position: "absolute", bottom: 16, left: 18, fontFamily: SANS, color: "#B8AE9C", fontSize: 11, letterSpacing: 1 }}>TU RESTAURANTE</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#1F9D57", display: "flex", alignItems: "center", justifyContent: "center", color: PAPER, fontSize: 23, animation: "qcpop 2.6s ease-in-out infinite" }}>✓</div>
        <span style={{ fontFamily: SANS, fontWeight: 700, color: INK, fontSize: 16 }}>Pago aprobado</span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        {([["Webpay", "#E52F2F"], ["MercadoPago", "#009EE3"], ["Flow", "#12A594"]] as const).map(([n, c]) => (
          <span key={n} style={{ display: "flex", alignItems: "center", gap: 6, background: PAPER, border: "1px solid #E6D9BF", borderRadius: 20, padding: "5px 12px", fontFamily: SANS, fontSize: 12, fontWeight: 700, color: INK }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: c }} />{n}
          </span>
        ))}
      </div>
    </div>
  );
}

function SceneMap() {
  const path = "M40 212 C 100 180, 120 118, 182 120 S 286 92, 326 54";
  return (
    <div style={{ width: 360, height: 262, maxWidth: "100%", position: "relative", borderRadius: 16, overflow: "hidden", background: "linear-gradient(160deg,#EFE7D6,#E2D8C1)", border: "1px solid #E0D4B8" }}>
      <svg viewBox="0 0 360 262" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <g stroke="#D7CBAD" strokeWidth="10" fill="none" strokeLinecap="round">
          <line x1="0" y1="92" x2="360" y2="92" /><line x1="140" y1="0" x2="140" y2="262" />
          <line x1="0" y1="192" x2="360" y2="192" /><line x1="262" y1="0" x2="262" y2="262" />
        </g>
        <path d={path} stroke="#E8A33A" strokeWidth="4" fill="none" strokeDasharray="6 8" strokeLinecap="round" />
      </svg>
      <div style={{ position: "absolute", left: 24, top: 196, fontSize: 22 }}>🏪</div>
      <div style={{ position: "absolute", left: 316, top: 36, fontSize: 22 }}>🏠</div>
      <div style={{ position: "absolute", left: 0, top: 0, fontSize: 26, animation: "qcdot 4.5s linear infinite", offsetPath: `path('${path}')`, offsetRotate: "0deg" } as React.CSSProperties}>🛵</div>
      <div style={{ position: "absolute", right: 10, bottom: 10, background: "#211E18", color: PAPER, fontFamily: SANS, fontSize: 11, padding: "6px 10px", borderRadius: 20, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#2ecc71", display: "inline-block", animation: "qcpulse 1.2s infinite" }} /> En vivo
      </div>
    </div>
  );
}

function SceneWhatsApp() {
  const msgs = [["Pedido recibido ✅", "12:01"], ["En preparación 👨‍🍳", "12:04"], ["En camino 🛵", "12:22"], ["Sigue tu pedido en el mapa", "12:22"]];
  return (
    <div style={{ width: 290, maxWidth: "100%" }}>
      <div style={{ background: "#0b141a", borderRadius: 20, padding: "14px 12px", boxShadow: "0 18px 36px -18px rgba(0,0,0,.6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 10, borderBottom: "1px solid #1f2c33" }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#1F9D57", display: "flex", alignItems: "center", justifyContent: "center", color: PAPER, fontWeight: 700, fontSize: 12 }}>TR</div>
          <div><div style={{ color: PAPER, fontFamily: SANS, fontSize: 13, fontWeight: 700 }}>Tu Restaurante</div><div style={{ color: "#8aa0a8", fontSize: 10 }}>en línea</div></div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 10, minHeight: 170 }}>
          {msgs.map((m, i) => (
            <div key={i} style={{ alignSelf: "flex-end", maxWidth: "86%", background: "#075E54", color: "#eaf2ee", fontFamily: SANS, fontSize: 12.5, padding: "8px 10px", borderRadius: "12px 12px 2px 12px", animation: `qcrise 6s ease-in-out ${i * 0.55}s infinite` }}>
              {m[0]}<span style={{ display: "block", fontSize: 9, color: "#9fc3b4", textAlign: "right", marginTop: 2 }}>{m[1]} ✓✓</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScenePrinter() {
  const ticket = (
    <div style={{ width: 130, background: PAPER, borderRadius: "0 0 6px 6px", boxShadow: "0 14px 22px -12px rgba(0,0,0,.35)", padding: "12px 12px 16px" }}>
      <div style={{ textAlign: "center", fontWeight: 700, fontSize: 11, color: INK, fontFamily: SANS }}>COMANDA #1042</div>
      <div style={{ borderTop: "1px dashed #CBB68C", margin: "6px 0" }} />
      {["1x Ramen Tonkotsu", "2x Gyoza", "1x Té verde"].map((t) => <div key={t} style={{ fontSize: 10, color: INK, marginBottom: 3, fontFamily: SANS }}>{t}</div>)}
      <div style={{ borderTop: "1px dashed #CBB68C", margin: "6px 0" }} />
      <div style={{ fontSize: 9, color: INKSOFT, textAlign: "center", fontFamily: SANS }}>Delivery · 12:24</div>
    </div>
  );
  return (
    <div style={{ width: 300, height: 262, position: "relative", display: "flex", justifyContent: "center" }}>
      {/* La comanda sale por la ranura (recortada por la máscara → aparece línea por línea) */}
      <div style={{ position: "absolute", top: 102, width: 130, height: 148, overflow: "hidden", display: "flex", justifyContent: "center" }}>
        <div style={{ width: 130, animation: "qcfeed 3.6s cubic-bezier(.45,0,.55,1) infinite" }}>{ticket}</div>
      </div>
      {/* Cuerpo de la impresora (tapa la parte de arriba de la ranura) */}
      <div style={{ position: "absolute", top: 42, width: 174, height: 74, background: "linear-gradient(180deg,#3a3630,#2B2620)", borderRadius: "14px 14px 8px 8px", boxShadow: "0 14px 28px -12px rgba(0,0,0,.5)" }}>
        <div style={{ position: "absolute", bottom: 6, left: 16, right: 16, height: 7, background: "#14110d", borderRadius: 4 }} />
        <div style={{ position: "absolute", top: 15, right: 16, width: 10, height: 10, borderRadius: "50%", background: "#2ecc71", animation: "qcpulse 1.4s infinite" }} />
        <div style={{ position: "absolute", top: 16, left: 16, fontFamily: SANS, color: "#B8AE9C", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>COCINA</div>
      </div>
    </div>
  );
}

function SceneKds() {
  const tickets: [string, string, string][] = [["#1042", "04:12", "#E8A33A"], ["#1043", "02:30", "#7fd1a8"], ["#1044", "00:45", "#7fd1a8"]];
  return (
    <div style={{ width: "100%", maxWidth: 450, aspectRatio: "4 / 3", position: "relative", borderRadius: 14, overflow: "hidden", perspective: "640px", perspectiveOrigin: "50% 34%", background: "linear-gradient(180deg,#EFE4CC 0%,#EADDC2 52%)" }}>
      {/* pared del fondo con azulejos */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "56%", backgroundImage: "linear-gradient(rgba(120,95,45,0.09) 1px,transparent 1px),linear-gradient(90deg,rgba(120,95,45,0.09) 1px,transparent 1px)", backgroundSize: "34px 34px" }} />
      {/* piso de acero inoxidable en perspectiva (cuadrícula que converge al punto de fuga) */}
      <div style={{ position: "absolute", left: 0, right: 0, top: "50%", bottom: 0, transform: "rotateX(62deg)", transformOrigin: "top center", backgroundColor: "#B4B9C1", backgroundImage: "linear-gradient(180deg,rgba(250,251,253,0.5),rgba(250,251,253,0) 42%,rgba(55,60,68,0.22)),linear-gradient(90deg,rgba(60,66,74,0.4) 1px,transparent 1px),linear-gradient(rgba(60,66,74,0.4) 1px,transparent 1px)", backgroundSize: "auto,44px 44px,44px 44px" }} />
      {/* sombra/junta donde la pared toca el piso */}
      <div style={{ position: "absolute", left: 0, right: 0, top: "calc(50% - 4px)", height: 8, background: "linear-gradient(180deg,rgba(40,44,50,0.22),transparent)" }} />

      {/* pantalla KDS montada en la pared */}
      <div style={{ position: "absolute", left: "50%", top: "7%", transform: "translateX(-50%)", width: "66%" }}>
        <div style={{ background: "#0d0f12", borderRadius: 14, padding: 8, border: "4px solid #2b2f36", boxShadow: "0 20px 30px -16px rgba(0,0,0,.6)" }}>
          <div style={{ background: "#14181c", borderRadius: 7, padding: 10, position: "relative", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
              <span style={{ fontFamily: SANS, color: "#7fd1a8", fontSize: 10, fontWeight: 700 }}>COCINA · 3 activos</span>
              <span style={{ fontFamily: SANS, color: "#6b7a82", fontSize: 9 }}>12:24</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              {tickets.map(([n, t, c]) => (
                <div key={n} style={{ background: "#1e242a", border: `1px solid ${c}`, borderRadius: 6, padding: 7 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}><span style={{ color: "#dfe7ea", fontFamily: SANS, fontSize: 9, fontWeight: 700 }}>{n}</span><span style={{ color: c, fontFamily: SANS, fontSize: 9 }}>{t}</span></div>
                  {[0, 1, 2, 3].map((j) => <div key={j} style={{ height: 4, background: "#2c353c", borderRadius: 3, marginBottom: 4, width: `${92 - j * 16}%` }} />)}
                </div>
              ))}
            </div>
            <div style={{ position: "absolute", top: 0, bottom: 0, width: 60, background: "linear-gradient(90deg,transparent,rgba(127,209,168,.16),transparent)", animation: "qcsweep 3.6s linear infinite" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SceneChart() {
  const bars = [42, 62, 50, 78, 95, 70, 88];
  return (
    <div style={{ width: 340, maxWidth: "100%" }}>
      <div style={{ background: PAPER, borderRadius: 14, padding: 16, border: "1px solid #E6D9BF", boxShadow: "0 16px 30px -16px rgba(80,55,15,.4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <span style={{ fontFamily: SANS, fontWeight: 700, color: INK, fontSize: 13 }}>Ventas de la semana</span>
          <span style={{ fontFamily: SANS, color: "#1f9d57", fontSize: 12, fontWeight: 700 }}>▲ +18%</span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120 }}>
          {bars.map((h, i) => <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: "5px 5px 0 0", background: "linear-gradient(180deg,#E8A33A,#C9771A)", transformOrigin: "bottom", animation: `qcbar 3s ease-in-out ${i * 0.12}s infinite` }} />)}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>{["L", "M", "M", "J", "V", "S", "D"].map((d, i) => <span key={i} style={{ flex: 1, textAlign: "center", fontFamily: SANS, fontSize: 10, color: INKSOFT }}>{d}</span>)}</div>
      </div>
    </div>
  );
}

function SceneLoyalty() {
  return (
    <div style={{ width: 208, height: 130, borderRadius: 16, background: "linear-gradient(135deg,#C9771A,#E8A33A)", padding: 15, position: "relative", boxShadow: "0 16px 30px -14px rgba(180,110,20,.6)", animation: "qcfloat 3.5s ease-in-out infinite" }}>
      <div style={{ fontFamily: DISP, color: "#2a1c08", fontWeight: 600, fontSize: 18 }}>Tu Restaurante</div>
      <div style={{ fontFamily: SANS, color: "#4a330f", fontSize: 11, marginTop: 2 }}>Miembro desde 2026</div>
      <div style={{ position: "absolute", bottom: 16, left: 16, display: "flex", gap: 5 }}>{[0, 1, 2, 3, 4].map((i) => <div key={i} style={{ width: 15, height: 15, borderRadius: "50%", background: i < 3 ? "#2a1c08" : "rgba(42,28,8,.25)" }} />)}</div>
      <div style={{ position: "absolute", top: 13, right: 14, fontSize: 20 }}>★</div>
    </div>
  );
}

function SceneQr() {
  const on = new Set([0, 1, 2, 3, 4, 5, 9, 10, 14, 15, 19, 20, 21, 22, 23, 24, 7, 12, 17]);
  return (
    <div style={{ width: 128, height: 186, borderRadius: 20, background: "#211E18", padding: 9, boxShadow: "0 16px 30px -14px rgba(0,0,0,.5)" }}>
      <div style={{ background: PAPER, borderRadius: 13, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 8 }}>
        <div style={{ fontFamily: DISP, fontWeight: 600, color: INK, fontSize: 14 }}>Carta QR</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 2.5, width: 74 }}>
          {Array.from({ length: 25 }).map((_, i) => <div key={i} style={{ aspectRatio: "1", background: on.has(i) ? INK : "transparent", borderRadius: 1 }} />)}
        </div>
        <div style={{ fontFamily: SANS, fontSize: 9, color: INKSOFT }}>Escanea y pide</div>
      </div>
    </div>
  );
}

const SCENES: Record<string, () => React.JSX.Element> = { browser: SceneBrowser, comandador: SceneComandador, payment: ScenePayment, map: SceneMap, whatsapp: SceneWhatsApp, printer: ScenePrinter, kds: SceneKds, chart: SceneChart };

type Feature = { id: string; scope: string; title: string; desc: string; scene: string; note?: string };
const FEATURES: Feature[] = [
  { id: "sitio", scope: "Incluido en todos los planes", title: "Sitio Web Propio", desc: "Tu propia tienda online en tu dominio —por ejemplo www.turestaurante.cl— con tus colores, tus fotos y tu logo. Tus clientes te compran directamente a ti, no a un marketplace que se queda con la comisión y con la relación.", scene: "browser" },
  { id: "comandador", scope: "Incluido en todos los planes", title: "Comandador de pedidos", desc: "Toma y gestiona cada pedido en un solo lugar: elige productos del menú, aplica descuentos, cobra y despacha. Todo tu equipo trabaja sobre la misma pantalla, en tiempo real, y ningún pedido se pierde.", scene: "comandador" },
  { id: "pagos", scope: "Incluido en todos los planes", title: "Pasarela de Pago", desc: "Cobras online con tarjeta a través de Webpay, MercadoPago o Flow, y el dinero llega directo a tu cuenta. El cliente paga antes de que prepares el pedido: sin manejo de efectivo, sin vueltos y sin cuentas por cobrar.", scene: "payment" },
  { id: "delivery", scope: "Incluido en todos los planes", title: "Delivery con seguimiento en vivo", desc: "Pide un repartidor externo de QuieroComer Delivery con un clic, o despacha con tu propia flota usando la app de repartidores propios. En ambos casos tu cliente sigue al repartidor en un mapa en tiempo real, con tu marca, igual que en las apps grandes.", scene: "map" },
  { id: "whatsapp", scope: "Incluido en todos los planes", title: "WhatsApp automático", desc: "Apenas entra el pedido, el cliente recibe por WhatsApp la confirmación, el estado y el link para seguir su despacho. Todo automático, sin que tu equipo tenga que escribir nada.", scene: "whatsapp" },
  { id: "impresion", scope: "Incluido en todos los planes", title: "Impresión de comandas", desc: "La comanda se imprime sola en la cocina apenas entra el pedido. Tu equipo cocina sin copiar nada a mano ni mirar pantallas, con cero errores de transcripción en las horas peak.", scene: "printer", note: "Requiere una impresora térmica: puedes usar la que ya tienes o adquirir una." },
  { id: "kds", scope: "Incluido en todos los planes", title: "Pantalla de cocina (KDS)", desc: "Una pantalla que ordena los pedidos por estado y tiempo de espera, con colores de alerta. Menos papeles, menos errores y una cocina que avanza más rápido cuando hay mucha demanda.", scene: "kds" },
  { id: "datos", scope: "Incluido en todos los planes", title: "Cupones, encuestas y reportes", desc: "Crea descuentos y promociones para atraer clientes, pídeles su opinión automáticamente, y mira cuánto vendes, tus productos top y tus mejores clientes. Creces con datos, no con corazonadas.", scene: "chart" },
];

export default function PresentacionPage() {
  const { isSuper } = useAdminSession();
  const router = useRouter();
  const [cfg, setCfg] = useState<PricingConfig | null>(null);
  const [idx, setIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetch("/api/admin/pricing").then((r) => (r.ok ? r.json() : null)).then((d) => d && setCfg(d)).catch(() => {}); }, []);

  type Slide = { type: "cover" } | { type: "intro" } | { type: "feature"; f: Feature } | { type: "panorama" } | { type: "plan"; plan: PricePlan; i: number; total: number } | { type: "addons" } | { type: "costos" } | { type: "cierre" };
  const slides: Slide[] = cfg ? [
    { type: "cover" }, { type: "intro" },
    ...FEATURES.map((f): Slide => ({ type: "feature", f })),
    { type: "panorama" },
    ...(cfg.addons.length ? [{ type: "addons" } as Slide] : []),
    ...(cfg.extras.length || cfg.implementation.length ? [{ type: "costos" } as Slide] : []),
    { type: "cierre" },
  ] : [];

  const go = useCallback((d: number) => setIdx((i) => Math.max(0, Math.min(slides.length - 1, i + d))), [slides.length]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); go(-1); }
      else if (e.key === "Escape" && !document.fullscreenElement) router.push("/admin/planes");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, router]);
  const toggleFull = () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else containerRef.current?.requestFullscreen().catch(() => {}); };

  if (!isSuper) return <div style={{ padding: 32, color: "#888" }}>Solo superadmin</div>;

  const slide = slides[idx];
  const onDark = slide && (slide.type === "cover" || slide.type === "cierre");
  const bg = slide && (slide.type === "cover" || slide.type === "cierre") ? INK : slide && (slide.type === "panorama" || slide.type === "addons") ? CREAM2 : CREAM;
  const wrap: React.CSSProperties = { width: "100%", maxWidth: 1320, display: "flex", flexDirection: "column" };
  const eyebrow = (t: string, dark = false) => <p style={{ fontFamily: SANS, fontSize: "clamp(0.8rem,1.1vw,1.05rem)", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, color: dark ? GOLDB : GOLDT, margin: 0 }}>{t}</p>;

  const renderSlide = () => {
    if (!cfg || !slide) return null;

    if (slide.type === "cover") return (
      <div style={{ ...wrap, gap: "clamp(20px,3vh,40px)" }}>
        {eyebrow("QuieroComer · Planes 2026", true)}
        <h1 style={{ fontFamily: DISP, fontSize: "clamp(2.6rem,7vw,6.5rem)", fontWeight: 600, lineHeight: 1.03, color: CREAM, margin: 0 }}>Tu restaurante,<br /><span style={{ color: GOLDB }}>en una sola plataforma</span></h1>
        <p style={{ fontFamily: SANS, fontSize: "clamp(1.1rem,2vw,2rem)", color: "#CFC6B4", margin: 0, lineHeight: 1.35, maxWidth: 1050 }}>Sitio propio, pedidos online, delivery con seguimiento en vivo, fidelización y punto de venta. Todo con tu marca.</p>
        <p style={{ fontFamily: SANS, fontSize: "clamp(0.85rem,1.1vw,1.1rem)", color: "#8F8575", margin: "clamp(8px,2vh,20px) 0 0" }}>Usa las flechas del teclado ← → para avanzar</p>
      </div>
    );

    if (slide.type === "intro") {
      const items = [["★", "Tu propia marca", "Tu sitio y tu carta, con tus colores y tu dominio. No un marketplace."], ["♥", "Más margen", "Cobras online directo a tu cuenta, sin las altas comisiones de las apps."], ["⚡", "Todo en un lugar", "Pedidos, delivery, cocina, fidelización y punto de venta, juntos."]];
      return (
        <div style={{ ...wrap, gap: "clamp(28px,4vh,52px)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{eyebrow("Qué es QuieroComer")}<h2 style={{ fontFamily: DISP, fontSize: "clamp(2rem,5vw,4.5rem)", fontWeight: 600, lineHeight: 1.05, color: INK, margin: 0 }}>Una plataforma hecha para que tu local venda más</h2></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "clamp(16px,2vw,28px)" }}>
            {items.map(([ic, t, d]) => (
              <div key={t} style={{ background: CARD, border: `1px solid ${CARDB}`, borderRadius: 20, padding: "clamp(24px,2.6vw,40px)", display: "flex", flexDirection: "column", gap: 14, boxShadow: CARDSHADOW }}>
                <span style={{ color: GOLD, fontSize: "clamp(1.8rem,3vw,3rem)" }}>{ic}</span>
                <h3 style={{ fontFamily: DISP, fontSize: "clamp(1.4rem,2.2vw,2.4rem)", fontWeight: 600, color: INK, margin: 0 }}>{t}</h3>
                <p style={{ fontFamily: SANS, fontSize: "clamp(1rem,1.4vw,1.5rem)", color: INKSOFT, margin: 0, lineHeight: 1.4 }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (slide.type === "feature") {
      const { f } = slide;
      const Scene = SCENES[f.scene];
      return (
        <div style={{ ...wrap, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: "clamp(28px,4vw,64px)", justifyContent: "center" }}>
          <div style={{ flex: "1 1 320px", maxWidth: 580, minWidth: 280, display: "flex", justifyContent: "center" }}>
            <div style={{ width: "100%", maxWidth: 560, aspectRatio: "4 / 3", borderRadius: 24, background: "linear-gradient(160deg,#FDF4E3,#F4E6C9)", border: `1px solid ${CARDB}`, boxShadow: CARDSHADOW, position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(16px,2.5vw,36px)" }}>
              {Scene && <Scene />}
            </div>
          </div>
          <div style={{ flex: "1 1 360px", minWidth: 300, display: "flex", flexDirection: "column", gap: "clamp(14px,2vh,24px)" }}>
            {eyebrow(f.scope)}
            <h2 style={{ fontFamily: DISP, fontSize: "clamp(2rem,4.2vw,3.8rem)", fontWeight: 600, lineHeight: 1.05, color: INK, margin: 0 }}>{f.title}</h2>
            <p style={{ fontFamily: SANS, fontSize: "clamp(1.1rem,1.6vw,1.65rem)", color: INKSOFT, margin: 0, lineHeight: 1.5, maxWidth: 620 }}>{f.desc}</p>
            {f.note && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#FBF2DF", border: "1px solid #E7C98A", borderRadius: 14, padding: "clamp(12px,1.4vw,16px) clamp(16px,1.8vw,22px)", maxWidth: 620 }}>
                <span style={{ fontSize: "clamp(1.2rem,1.6vw,1.6rem)" }}>🖨️</span>
                <p style={{ fontFamily: SANS, fontSize: "clamp(0.92rem,1.15vw,1.2rem)", color: INK, margin: 0, lineHeight: 1.4, fontWeight: 600 }}>{f.note}</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (slide.type === "panorama") return (
      <div style={{ ...wrap, gap: "clamp(12px,1.8vh,22px)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{eyebrow("Planes Ecommerce")}<h2 style={{ fontFamily: DISP, fontSize: "clamp(1.6rem,3.2vw,2.7rem)", fontWeight: 600, lineHeight: 1.04, color: INK, margin: 0 }}>Cada plan incluye al anterior</h2></div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(cfg.plans.length, 4)},1fr)`, gap: "clamp(10px,1.2vw,18px)", alignItems: "stretch" }}>
          {cfg.plans.map((p, i) => {
            const hi = /premium/i.test(p.name) && !/futuro/i.test(p.name);
            const prev = i > 0 ? cfg.plans[i - 1] : null;
            const prevSet = prev ? new Set(prev.features.map((x) => x.trim().toLowerCase())) : null;
            const shown = prevSet ? p.features.filter((f) => !prevSet.has(f.trim().toLowerCase())) : p.features;
            const tInk = hi ? CREAM : INK, tSub = hi ? "#CFC6B4" : INKSOFT, line = hi ? "#4A4236" : CARDB;
            return (
              <div key={p.id} style={{ background: hi ? "#2B2620" : CARD, border: `1px solid ${hi ? GOLD : CARDB}`, borderRadius: 18, padding: "clamp(16px,1.6vw,26px) clamp(14px,1.4vw,22px)", display: "flex", flexDirection: "column", gap: 8, boxShadow: CARDSHADOW }}>
                {hi ? eyebrow("Recomendado", true) : <div style={{ height: "clamp(0.8rem,1.1vw,1.05rem)" }} />}
                <h3 style={{ fontFamily: SANS, fontSize: "clamp(0.95rem,1.4vw,1.4rem)", fontWeight: 700, color: tInk, margin: 0 }}>{p.name}</h3>
                <p style={{ fontFamily: DISP, fontSize: "clamp(1.5rem,2.4vw,2.3rem)", fontWeight: 600, color: hi ? GOLDB : GOLD, margin: 0, lineHeight: 1 }}>{fmt(p.price)}<span style={{ fontFamily: SANS, fontSize: "0.42em", color: tSub, fontWeight: 500 }}> /mes</span></p>
                <div style={{ height: 1, background: line, margin: "6px 0 2px" }} />
                {prev ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, background: hi ? "rgba(232,163,58,0.14)" : "#FBF2DF", border: `1px solid ${hi ? "rgba(232,163,58,0.4)" : "#E7C98A"}`, borderRadius: 9, padding: "7px 9px" }}>
                      <span style={{ color: GOLDB, fontWeight: 900, fontSize: "clamp(0.85rem,1.1vw,1.1rem)" }}>✚</span>
                      <span style={{ fontFamily: SANS, fontSize: "clamp(0.8rem,1vw,1.05rem)", fontWeight: 700, color: tInk, lineHeight: 1.2 }}>Todo lo del {prev.name}</span>
                    </div>
                    {shown.length > 0 && <p style={{ fontFamily: SANS, fontSize: "clamp(0.68rem,0.85vw,0.9rem)", color: tSub, margin: "4px 0 0", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Y además</p>}
                    {shown.map((f) => (
                      <div key={f} style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
                        <span style={{ color: GOLDB, fontWeight: 900, fontSize: "clamp(0.8rem,1vw,1.05rem)", flexShrink: 0 }}>★</span>
                        <span style={{ fontFamily: SANS, fontSize: "clamp(0.82rem,1.05vw,1.15rem)", color: tInk, fontWeight: 600, lineHeight: 1.25 }}>{f}</span>
                      </div>
                    ))}
                  </>
                ) : (
                  p.features.map((f) => (
                    <div key={f} style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
                      <span style={{ color: GOLD, fontWeight: 900, fontSize: "clamp(0.78rem,0.95vw,1rem)", flexShrink: 0 }}>✓</span>
                      <span style={{ fontFamily: SANS, fontSize: "clamp(0.76rem,0.95vw,1.02rem)", color: tInk, lineHeight: 1.22 }}>{f}</span>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      </div>
    );

    if (slide.type === "plan") {
      const { plan, i, total } = slide;
      const impl = cfg.implementation.find((l) => l.label.trim().toLowerCase() === plan.name.trim().toLowerCase())?.price ?? null;
      const isNew = (f: string) => /ilimitad|pos |pos$|bodega|inventario/i.test(f);
      const prev = i > 0 ? cfg.plans[i - 1] : null;
      const prevSet = prev ? new Set(prev.features.map((x) => x.trim().toLowerCase())) : null;
      const shown = prevSet ? plan.features.filter((f) => !prevSet.has(f.trim().toLowerCase())) : plan.features;
      return (
        <div style={{ ...wrap, gap: "clamp(20px,3vh,36px)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {eyebrow(`Plan ${i + 1} de ${total} · Ecommerce`)}
              <h2 style={{ fontFamily: DISP, fontSize: "clamp(2rem,4.5vw,4rem)", fontWeight: 600, lineHeight: 1, color: INK, margin: 0 }}>{plan.name}</h2>
              <p style={{ fontFamily: SANS, fontSize: "clamp(1rem,1.4vw,1.5rem)", color: INKSOFT, margin: 0 }}>{taglineFor(plan.name)}</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <p style={{ fontFamily: DISP, fontSize: "clamp(2.2rem,4.5vw,4rem)", fontWeight: 600, color: GOLD, margin: 0, lineHeight: 1 }}>{fmt(plan.price)}</p>
              <p style={{ fontFamily: SANS, fontSize: "clamp(0.85rem,1.1vw,1.15rem)", color: INKSOFT, margin: "4px 0 0" }}>por mes{impl != null ? ` · + ${fmt(impl)} implementación` : ""}</p>
            </div>
          </div>
          <div style={{ background: CARD, border: `1px solid ${CARDB}`, borderRadius: 20, padding: "clamp(22px,2.6vw,38px)", boxShadow: CARDSHADOW, display: "flex", flexDirection: "column", gap: "clamp(14px,2vh,22px)" }}>
            {prev && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#FBF2DF", border: "1px solid #E7C98A", borderRadius: 12, padding: "clamp(12px,1.4vw,18px) clamp(16px,1.8vw,24px)" }}>
                <span style={{ color: GOLD, fontWeight: 900, fontSize: "clamp(1.3rem,1.8vw,1.9rem)" }}>✚</span>
                <span style={{ fontFamily: SANS, fontSize: "clamp(1.1rem,1.5vw,1.7rem)", fontWeight: 700, color: INK }}>Todo lo del {prev.name}</span>
              </div>
            )}
            <p style={{ fontFamily: SANS, fontSize: "clamp(0.8rem,1vw,1rem)", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, color: GOLDT, margin: 0 }}>{prev ? "Y además incluye" : "Qué incluye"}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: "clamp(10px,1.4vh,16px) clamp(24px,3vw,48px)" }}>
              {(prev ? shown : plan.features).map((f) => {
                const nw = prev ? true : isNew(f);
                return (
                  <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <span style={{ color: GOLD, fontWeight: 900, fontSize: "clamp(1.1rem,1.4vw,1.4rem)", flexShrink: 0, lineHeight: 1.2 }}>{nw ? "★" : "✓"}</span>
                    <span style={{ fontFamily: SANS, fontSize: "clamp(1rem,1.3vw,1.5rem)", color: INK, fontWeight: nw ? 700 : 500, lineHeight: 1.25 }}>{f}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    if (slide.type === "addons") return (
      <div style={{ ...wrap, gap: "clamp(24px,3.5vh,40px)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{eyebrow("Paquetes y add-ons")}<h2 style={{ fontFamily: DISP, fontSize: "clamp(2rem,4.5vw,4rem)", fontWeight: 600, lineHeight: 1.05, color: INK, margin: 0 }}>Súmale fidelización y carta digital</h2></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(360px,1fr))", gap: "clamp(16px,2vw,28px)" }}>
          {cfg.addons.map((p, i) => (
            <div key={p.id} style={{ background: CARD, border: `1px solid ${CARDB}`, borderRadius: 22, padding: "clamp(24px,2.4vw,36px)", display: "flex", flexDirection: "column", gap: "clamp(14px,1.6vw,20px)", boxShadow: CARDSHADOW }}>
              <div style={{ display: "flex", justifyContent: "center", padding: "6px 0 2px" }}>{i === 0 ? <SceneLoyalty /> : <SceneQr />}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                <h3 style={{ fontFamily: DISP, fontSize: "clamp(1.4rem,2.2vw,2.3rem)", fontWeight: 600, color: INK, margin: 0 }}>{p.name}</h3>
                <p style={{ fontFamily: DISP, fontSize: "clamp(1.4rem,2vw,2.1rem)", fontWeight: 600, color: GOLD, margin: 0 }}>{fmt(p.price)}<span style={{ color: INKSOFT, fontFamily: SANS, fontSize: "0.5em" }}> /mes</span></p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: p.features.length > 4 ? "1fr 1fr" : "1fr", gap: "clamp(7px,0.9vw,12px) clamp(16px,2vw,28px)" }}>
                {p.features.map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <span style={{ color: GOLD, fontWeight: 900, fontSize: "clamp(0.95rem,1.2vw,1.25rem)" }}>✓</span>
                    <p style={{ fontFamily: SANS, fontSize: "clamp(0.9rem,1.15vw,1.3rem)", color: INK, margin: 0 }}>{f}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );

    if (slide.type === "costos") return (
      <div style={{ ...wrap, gap: "clamp(24px,3.5vh,44px)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{eyebrow("Implementación y otros cobros")}<h2 style={{ fontFamily: DISP, fontSize: "clamp(2rem,4.5vw,4rem)", fontWeight: 600, lineHeight: 1.05, color: INK, margin: 0 }}>Puesta en marcha y costos variables</h2></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(360px,1fr))", gap: "clamp(28px,4vw,56px)" }}>
          {cfg.implementation.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <h3 style={{ fontFamily: SANS, fontSize: "clamp(1rem,1.5vw,1.5rem)", fontWeight: 700, color: GOLDT, margin: "0 0 6px" }}>Implementación · pago único</h3>
              {cfg.implementation.map((l) => (
                <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `1px solid ${CARDB}`, padding: "10px 0" }}>
                  <p style={{ fontFamily: SANS, fontSize: "clamp(1rem,1.3vw,1.45rem)", color: INK, margin: 0 }}>{l.label}</p>
                  <p style={{ fontFamily: DISP, fontSize: "clamp(1.1rem,1.5vw,1.6rem)", fontWeight: 600, color: GOLD, margin: 0 }}>{fmt(l.price)}</p>
                </div>
              ))}
            </div>
          )}
          {cfg.extras.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <h3 style={{ fontFamily: SANS, fontSize: "clamp(1rem,1.5vw,1.5rem)", fontWeight: 700, color: GOLDT, margin: "0 0 6px" }}>Otros cobros</h3>
              {cfg.extras.map((l) => (
                <div key={l.id} style={{ borderBottom: `1px solid ${CARDB}`, padding: "10px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <p style={{ fontFamily: SANS, fontSize: "clamp(1rem,1.3vw,1.45rem)", color: INK, margin: 0 }}>{l.label}</p>
                    <p style={{ fontFamily: DISP, fontSize: "clamp(1.1rem,1.5vw,1.6rem)", fontWeight: 600, color: GOLD, margin: 0 }}>{fmt(l.price)}</p>
                  </div>
                  {l.note && <p style={{ fontFamily: SANS, fontSize: "clamp(0.8rem,1vw,1.1rem)", color: "#8F8575", margin: "4px 0 0" }}>{l.note}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );

    // cierre
    return (
      <div style={{ ...wrap, gap: "clamp(22px,3vh,40px)" }}>
        {eyebrow("El siguiente paso", true)}
        <h1 style={{ fontFamily: DISP, fontSize: "clamp(2.4rem,6vw,5.5rem)", fontWeight: 600, lineHeight: 1.04, color: CREAM, margin: 0 }}>Hagamos crecer<br />tu restaurante</h1>
        <p style={{ fontFamily: SANS, fontSize: "clamp(1.1rem,1.8vw,1.9rem)", color: "#CFC6B4", margin: 0, lineHeight: 1.4, maxWidth: 1000 }}>Tu marca, tus clientes, tus datos y toda tu operación en una sola plataforma. Elige el plan, nosotros lo dejamos andando.</p>
        <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
          <span style={{ fontFamily: SANS, fontSize: "clamp(1rem,1.4vw,1.5rem)", fontWeight: 700, color: INK, background: GOLDB, padding: "14px 30px", borderRadius: 50 }}>Conversemos hoy</span>
          <span style={{ fontFamily: SANS, fontSize: "clamp(0.95rem,1.2vw,1.3rem)", color: "#8F8575" }}>quierocomer.com</span>
        </div>
      </div>
    );
  };

  const navBtn: React.CSSProperties = { width: 46, height: 46, borderRadius: "50%", border: "1px solid rgba(0,0,0,0.12)", background: "rgba(250,247,239,0.75)", color: INK, fontSize: "1.3rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)" };
  const topBtn: React.CSSProperties = { border: "1px solid rgba(0,0,0,0.12)", background: "rgba(250,247,239,0.75)", color: INK, fontFamily: SANS, fontWeight: 700, fontSize: "0.82rem", borderRadius: 10, padding: "8px 14px", cursor: "pointer", backdropFilter: "blur(6px)" };
  const darkBtn = onDark ? { background: "rgba(255,253,247,0.14)", color: CREAM, border: "1px solid rgba(255,253,247,0.25)" } : {};

  return (
    <div ref={containerRef} style={{ position: "fixed", inset: 0, zIndex: 9999, background: bg, transition: "background 0.35s ease", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=DM+Sans:wght@400;500;700&display=swap');
@keyframes qcslide{from{opacity:0}to{opacity:1}}
.qc-scroll{scrollbar-width:none;-ms-overflow-style:none}
.qc-scroll::-webkit-scrollbar{width:0;height:0;display:none}
@keyframes qcfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
@keyframes qcblink{0%,49%{opacity:1}50%,100%{opacity:0}}
@keyframes qcrise{0%{opacity:0;transform:translateY(18px) scale(.98)}14%{opacity:1;transform:none}88%{opacity:1}100%{opacity:0;transform:translateY(-6px)}}
@keyframes qcbar{0%{transform:scaleY(.12)}55%{transform:scaleY(1)}100%{transform:scaleY(1)}}
@keyframes qcpop{0%{transform:scale(0);opacity:0}55%{transform:scale(1.12);opacity:1}100%{transform:scale(1)}}
@keyframes qcpulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
@keyframes qcdot{from{offset-distance:0%}to{offset-distance:100%}}
@keyframes qcfeed{0%{transform:translateY(-100%);opacity:1}45%{transform:translateY(0);opacity:1}80%{transform:translateY(0);opacity:1}92%{transform:translateY(8%);opacity:0}100%{transform:translateY(-100%);opacity:0}}
@keyframes qcsweep{0%{transform:translateX(-120%)}100%{transform:translateX(560%)}}
@keyframes qcsteam{0%{transform:translateY(0) scale(.8);opacity:0}30%{opacity:.7}100%{transform:translateY(-22px) scale(1.3);opacity:0}}`}</style>

      <div style={{ position: "absolute", top: 18, right: 18, display: "flex", gap: 10, zIndex: 2 }}>
        <button onClick={toggleFull} style={{ ...topBtn, ...darkBtn }}>⤢ Pantalla completa</button>
        <button onClick={() => router.push("/admin/planes")} style={{ ...topBtn, ...darkBtn }}>✕ Cerrar</button>
      </div>

      <div className="qc-scroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        <div key={idx} style={{ minHeight: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", padding: "76px clamp(28px,5vw,96px) 92px", animation: "qcslide 0.45s ease" }}>{cfg ? renderSlide() : <span style={{ fontFamily: DISP, color: GOLD }}>Cargando…</span>}</div>
      </div>

      <div style={{ position: "absolute", bottom: 20, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 18, zIndex: 2 }}>
        <button onClick={() => go(-1)} disabled={idx === 0} style={{ ...navBtn, ...darkBtn, opacity: idx === 0 ? 0.35 : 1 }}>‹</button>
        <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", justifyContent: "center", maxWidth: "60vw" }}>
          {slides.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)} aria-label={`Slide ${i + 1}`} style={{ width: i === idx ? 24 : 9, height: 9, borderRadius: 50, border: "none", cursor: "pointer", background: i === idx ? GOLD : (onDark ? "rgba(255,253,247,0.3)" : "rgba(0,0,0,0.18)"), transition: "width 0.25s ease", padding: 0 }} />
          ))}
        </div>
        <button onClick={() => go(1)} disabled={idx === slides.length - 1} style={{ ...navBtn, ...darkBtn, opacity: idx === slides.length - 1 ? 0.35 : 1 }}>›</button>
        <span style={{ position: "absolute", right: "clamp(20px,4vw,48px)", fontFamily: SANS, fontSize: "0.85rem", fontWeight: 700, color: onDark ? "rgba(255,253,247,0.55)" : "rgba(0,0,0,0.45)" }}>{idx + 1} / {slides.length}</span>
      </div>
    </div>
  );
}
