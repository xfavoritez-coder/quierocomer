"use client";

import { useState } from "react";
import Link from "next/link";

const F = "var(--font-display)";
const B = "var(--font-body)";
const BRAND = "#EF9F27";
const BG = "#FAF9F7";

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #eeeae0", overflow: "hidden" }}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "18px 22px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
        <span style={{ fontFamily: F, fontSize: 15, fontWeight: 600, color: "#111", lineHeight: 1.4 }}>{q}</span>
        <span style={{ fontSize: 18, color: "#999", transform: open ? "rotate(45deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0, lineHeight: 1 }}>+</span>
      </button>
      {open && (
        <div style={{ padding: "0 22px 18px" }}>
          <p style={{ fontFamily: B, fontSize: 14, color: "#666", lineHeight: 1.6, margin: 0 }}>{a}</p>
        </div>
      )}
    </div>
  );
}

export default function VendedoresPage() {
  return (
    <div style={{ fontFamily: B, color: "#111", overflowX: "hidden" }}>

      {/* ══════ NAVBAR ══════ */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(250,249,247,0.97)", borderBottom: "1px solid #eeeae0", backdropFilter: "blur(12px)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <Link href="/" style={{ textDecoration: "none", fontFamily: F, fontSize: "1.1rem", fontWeight: 800 }}>
            <span style={{ color: "#111" }}>Quiero</span><span style={{ color: BRAND }}>Comer</span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <Link href="/" style={{ fontSize: 13, color: "#555", textDecoration: "none", fontFamily: F, fontWeight: 500 }}>Inicio</Link>
            <span style={{ fontSize: 13, color: BRAND, fontFamily: F, fontWeight: 600 }}>Vendedores</span>
          </div>
        </div>
      </nav>

      {/* ══════ HERO ══════ */}
      <section style={{ background: BG, paddingTop: 56 }}>
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "64px 24px 56px", textAlign: "center" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(239,159,39,0.1)", padding: "6px 14px", borderRadius: 999, fontSize: "12.5px", color: "#92400e", fontWeight: 600, marginBottom: 20, fontFamily: F }}>
            💼 Programa de vendedores
          </span>
          <h1 style={{ fontFamily: F, fontSize: "clamp(30px, 4.5vw, 38px)", fontWeight: 700, letterSpacing: "-1.5px", lineHeight: 1.08, marginBottom: 18, color: "#111", maxWidth: 640, margin: "0 auto 18px" }}>
            Cierra un restaurante. Te llevas el primer mes completo
          </h1>
          <p style={{ fontFamily: B, fontSize: "clamp(15px, 2vw, 17px)", color: "#555", lineHeight: 1.6, maxWidth: 540, margin: "0 auto" }}>
            Sin metas. Sin contratos. Sin sueldo base. Tú vendes, tú instalas, tú cobras. La forma más directa de ganar plata vendiendo software a restaurantes en Chile
          </p>
        </div>
      </section>

      {/* ══════ CÓMO SE GANA ══════ */}
      <section style={{ background: "#fff", padding: "64px 24px" }}>
        <div style={{ maxWidth: 580, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <p style={{ fontSize: 12, color: BRAND, textTransform: "uppercase", letterSpacing: "1.2px", fontWeight: 600, fontFamily: F, marginBottom: 10 }}>Cómo se gana</p>
            <h2 style={{ fontFamily: F, fontSize: "clamp(24px, 3.5vw, 32px)", fontWeight: 700, letterSpacing: "-0.8px", color: "#111", marginBottom: 8 }}>Tu foco son Gold y Premium</h2>
            <p style={{ fontSize: 15, color: "#666", lineHeight: 1.5 }}>Recibes el equivalente al primer mes que paga el cliente, por adelantado</p>
          </div>

          <div className="vnd-plans" style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 14, marginBottom: 16 }}>
            {/* Gold */}
            <div style={{ background: "#fff", border: `2px solid ${BRAND}`, borderRadius: 14, padding: 24, position: "relative" }}>
              <span style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: BRAND, color: "#fff", fontFamily: F, fontSize: "10px", fontWeight: 700, padding: "3px 10px", borderRadius: 999, letterSpacing: "0.5px", textTransform: "uppercase", whiteSpace: "nowrap" }}>Más popular</span>
              <p style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: "#854F0B", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Plan Gold</p>
              <p style={{ fontFamily: F, fontSize: 32, fontWeight: 700, color: "#111", letterSpacing: "-1px", marginBottom: 4 }}>$35.000</p>
              <p style={{ fontSize: 13, color: "#888" }}>Por cada restaurante que cierres en Gold</p>
            </div>
            {/* Premium */}
            <div style={{ background: "#fff", border: "1px solid #eeeae0", borderRadius: 14, padding: 24 }}>
              <p style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Plan Premium</p>
              <p style={{ fontFamily: F, fontSize: 32, fontWeight: 700, color: "#111", letterSpacing: "-1px", marginBottom: 4 }}>$55.000</p>
              <p style={{ fontSize: 13, color: "#888" }}>Por cada restaurante que cierres en Premium</p>
            </div>
          </div>

          <p style={{ fontSize: 13, color: "#999", textAlign: "center", lineHeight: 1.5, maxWidth: 540, margin: "0 auto" }}>
            Si un cliente prefiere el plan gratis, tu comisión es de $5.000. Pero tu objetivo está en Gold y Premium
          </p>
        </div>
      </section>

      {/* ══════ CUÁNTO PUEDES GANAR ══════ */}
      <section style={{ background: BG, padding: "64px 24px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <p style={{ fontSize: 12, color: BRAND, textTransform: "uppercase", letterSpacing: "1.2px", fontWeight: 600, fontFamily: F, marginBottom: 10 }}>Cuánto puedes ganar</p>
            <h2 style={{ fontFamily: F, fontSize: "clamp(24px, 3.5vw, 32px)", fontWeight: 700, letterSpacing: "-0.8px", color: "#111" }}>Tres ejemplos reales</h2>
          </div>

          <div className="vnd-examples" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 16 }}>
            <div style={{ background: "#fff", border: "1px solid #eeeae0", borderRadius: 14, padding: 24, textAlign: "center" }}>
              <p style={{ fontFamily: F, fontSize: 13, color: "#888", marginBottom: 8 }}>2 restaurantes Gold</p>
              <p style={{ fontFamily: F, fontSize: 28, fontWeight: 700, color: "#111", letterSpacing: "-0.5px" }}>$70.000</p>
              <p style={{ fontSize: 12, color: "#999" }}>al mes</p>
            </div>
            <div style={{ background: "#fff", border: "1px solid #eeeae0", borderRadius: 14, padding: 24, textAlign: "center" }}>
              <p style={{ fontFamily: F, fontSize: 13, color: "#888", marginBottom: 8 }}>5 Gold + 1 Premium</p>
              <p style={{ fontFamily: F, fontSize: 28, fontWeight: 700, color: "#111", letterSpacing: "-0.5px" }}>$230.000</p>
              <p style={{ fontSize: 12, color: "#999" }}>al mes</p>
            </div>
            <div style={{ background: "#1a1a1a", borderRadius: 14, padding: 24, textAlign: "center" }}>
              <p style={{ fontFamily: F, fontSize: 13, color: "#999", marginBottom: 8 }}>10 Gold + 3 Premium</p>
              <p style={{ fontFamily: F, fontSize: 28, fontWeight: 700, color: "#FAC775", letterSpacing: "-0.5px" }}>$515.000</p>
              <p style={{ fontSize: 12, color: "#777" }}>al mes</p>
            </div>
          </div>

          <p style={{ fontSize: 13, color: "#999", textAlign: "center" }}>Sin techo. No hay metas máximas — vende todo lo que puedas</p>
        </div>
      </section>

      {/* ══════ CÓMO FUNCIONA ══════ */}
      <section style={{ background: "#fff", padding: "64px 24px" }}>
        <div style={{ maxWidth: 620, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <p style={{ fontSize: 12, color: BRAND, textTransform: "uppercase", letterSpacing: "1.2px", fontWeight: 600, fontFamily: F, marginBottom: 10 }}>Cómo funciona</p>
            <h2 style={{ fontFamily: F, fontSize: "clamp(24px, 3.5vw, 32px)", fontWeight: 700, letterSpacing: "-0.8px", color: "#111", marginBottom: 8 }}>Tu trabajo de principio a fin</h2>
            <p style={{ fontSize: 15, color: "#666", lineHeight: 1.5 }}>Tú llevas al cliente desde el primer contacto hasta dejarlo andando. Nosotros te respaldamos</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[
              { n: 1, title: "Encuentras un restaurante interesado", desc: "Tu red de contactos. Cualquiera que tenga restaurante sirve" },
              { n: 2, title: "Le muestras una carta de ejemplo", desc: "Le abres quierocomer.cl/qr/hand-roll en su celular y le muestras cómo se ve. En 2 minutos entiende el producto" },
              { n: 3, title: "Cargas su carta y le dejas el local andando", desc: "Subes los platos con sus fotos y precios, configuras el QR de cada mesa y dejas todo listo para que reciba clientes. Te entrenamos para hacerlo en pocas horas" },
              { n: 4, title: "Cobras el primer mes por adelantado", desc: "Antes de que la carta entre en producción, el restaurante paga su primer mes. Cuando ese pago llega, te transferimos tu comisión completa" },
            ].map((step, i) => (
              <div key={step.n} style={{ display: "flex", gap: 16, paddingBottom: i < 3 ? 28 : 0, position: "relative" }}>
                {/* Line */}
                {i < 3 && <div style={{ position: "absolute", left: 19, top: 40, bottom: 0, width: 2, background: "#eeeae0" }} />}
                {/* Circle */}
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: BRAND, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F, fontSize: 16, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                  {step.n}
                </div>
                <div style={{ paddingTop: 2 }}>
                  <p style={{ fontFamily: F, fontSize: 16, fontWeight: 600, color: "#111", marginBottom: 4 }}>{step.title}</p>
                  <p style={{ fontSize: 14, color: "#666", lineHeight: 1.55, margin: 0 }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ POR QUÉ SE VENDE FÁCIL ══════ */}
      <section style={{ background: BG, padding: "64px 24px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <p style={{ fontSize: 12, color: BRAND, textTransform: "uppercase", letterSpacing: "1.2px", fontWeight: 600, fontFamily: F, marginBottom: 10 }}>Por qué se vende fácil</p>
            <h2 style={{ fontFamily: F, fontSize: "clamp(24px, 3.5vw, 32px)", fontWeight: 700, letterSpacing: "-0.8px", color: "#111", marginBottom: 8 }}>QuieroComer se vende solo</h2>
            <p style={{ fontSize: 15, color: "#666", lineHeight: 1.5 }}>No tienes que convencer a nadie. El producto hace el trabajo</p>
          </div>

          <div className="vnd-features" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[
              { emoji: "📈", title: "Sube el ticket por mesa", desc: "El Genio sugiere acompañamientos y postres. Para el dueño, eso es plata directa al bolsillo" },
              { emoji: "📂", title: "Sin contratos ni permanencia", desc: "El cliente cancela cuando quiera. Eso elimina el principal miedo al firmar" },
              { emoji: "🍽️", title: "Cartas en producción", desc: "Hand Roll, Horus Vegan, Juana la Brava y Vegan Mobile ya lo usan. Mostrarles ejemplos reales cierra ventas" },
              { emoji: "💼", title: "Producto que el dueño entiende", desc: "No vendes 'una app más'. Vendes una carta digital que sube ventas. Eso le hace sentido a cualquier dueño" },
            ].map(f => (
              <div key={f.title} style={{ background: "#fff", borderRadius: 14, padding: 22, border: "1px solid #eeeae0" }}>
                <span style={{ fontSize: 22, display: "block", marginBottom: 10 }}>{f.emoji}</span>
                <p style={{ fontFamily: F, fontSize: 15, fontWeight: 600, color: "#111", marginBottom: 6 }}>{f.title}</p>
                <p style={{ fontSize: 13, color: "#666", lineHeight: 1.55, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ FAQ ══════ */}
      <section style={{ background: "#fff", padding: "64px 24px" }}>
        <div style={{ maxWidth: 620, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <p style={{ fontSize: 12, color: BRAND, textTransform: "uppercase", letterSpacing: "1.2px", fontWeight: 600, fontFamily: F, marginBottom: 10 }}>Reglas claras</p>
            <h2 style={{ fontFamily: F, fontSize: "clamp(24px, 3.5vw, 32px)", fontWeight: 700, letterSpacing: "-0.8px", color: "#111" }}>Lo que necesitas saber</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <FaqItem q="¿Cuándo se considera 'cerrado' un cliente?" a="Cuando el cliente paga su primer mes por adelantado. Ese pago activa tu comisión." />
            <FaqItem q="¿Tengo que cargar yo la carta del restaurante?" a="Sí. Tú haces el onboarding completo: subes los platos con sus fotos y precios, configuras los QR de las mesas y dejas el local listo para recibir clientes. Te entrenamos para hacerlo bien." />
            <FaqItem q="¿Y si el cliente se va al mes siguiente?" a="Tu comisión ya está pagada. No te la quitamos." />
            <FaqItem q="¿Hay comisiones recurrentes?" a="No. Cobras una vez por cada cliente cerrado. Tu negocio está en cerrar más, no en mantener cuentas." />
            <FaqItem q="¿Necesito experiencia en ventas?" a="No. Si tienes una red de contactos en gastronomía o conoces dueños de restaurantes, ya tienes lo que se necesita." />
            <FaqItem q="¿Cómo me pagan?" a="Transferencia bancaria. Necesitas tener boleta de honorarios para emitir el documento por el monto recibido." />
            <FaqItem q="¿Hay un mínimo de ventas?" a="No. Vendes uno, cobras uno. Vendes diez, cobras diez. No te exigimos nada." />
          </div>
        </div>
      </section>

      {/* ══════ CIERRE ══════ */}
      <section style={{ background: "#1a1a1a", padding: "80px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <h2 style={{ fontFamily: F, fontSize: "clamp(24px, 3.5vw, 32px)", fontWeight: 700, letterSpacing: "-0.8px", color: "#fff", marginBottom: 10 }}>Eso es todo. Así de simple</h2>
          <p style={{ fontSize: 15, color: "#999", lineHeight: 1.5 }}>Si conoces dueños de restaurantes, ya tienes el negocio en la mano</p>
        </div>
      </section>

      {/* ══════ FOOTER ══════ */}
      <footer style={{ background: "#0a0a0a", color: "#fff", padding: "36px 24px 20px" }}>
        <div style={{ maxWidth: 600, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <Link href="/" style={{ textDecoration: "none", fontFamily: F, fontSize: "1rem", fontWeight: 800 }}>
            <span style={{ color: "#fff" }}>Quiero</span><span style={{ color: BRAND }}>Comer</span>
          </Link>
          <div style={{ display: "flex", gap: 20 }}>
            <Link href="/" style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>Inicio</Link>
            <Link href="/#planes" style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>Planes</Link>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>Términos</span>
          </div>
        </div>
        <div style={{ maxWidth: 600, margin: "16px auto 0", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 16, textAlign: "center" }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>© 2026 QuieroComer · Santiago, Chile</span>
        </div>
      </footer>

      {/* ══════ CSS ══════ */}
      <style>{`
        @media (max-width: 640px) {
          .vnd-plans { grid-template-columns: 1fr !important; }
          .vnd-examples { grid-template-columns: 1fr !important; }
          .vnd-features { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
