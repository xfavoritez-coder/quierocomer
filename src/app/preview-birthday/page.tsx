"use client";

import { useState } from "react";
import { X, Calendar } from "lucide-react";

/**
 * Pagina de preview del flujo del modal de cumpleanos. Muestra los 4 estados
 * por separado para que el dueno pueda revisar como se ve cada paso sin tener
 * que esperar 1+ min entre visitas para reproducirlo en la carta real.
 *
 * Estados:
 *   1. FORM       — modal con email + fecha de nacimiento (cuenta nueva)
 *   2. TOAST      — toast de exito al guardar el cumple
 *   3. NAME       — step "Una cosita mas" para capturar el nombre
 *   4. TOAST_NAME — toast final personalizado al guardar el nombre
 *
 * Datos mockeados: el flujo no llama al backend, es 100% visual.
 */

const SECTION_TITLES: Record<string, string> = {
  form: "1. Modal inicial — pide email + cumple",
  toast: "2. Toast después de guardar el cumple",
  name: '3. Step "Una cosita más" — captura nombre',
  toastName: "4. Toast final personalizado al guardar el nombre",
};

function ModalForm() {
  const [email, setEmail] = useState("juan@ejemplo.cl");
  const [birthDateText, setBirthDateText] = useState("15/04/1990");
  return (
    <div style={{ background: "white", borderRadius: 20, padding: "32px 24px 28px", maxWidth: 360, width: "100%", boxShadow: "0 25px 60px rgba(0,0,0,0.2)", position: "relative" }}>
      <button style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer" }}>
        <X size={18} color="#ccc" />
      </button>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <span style={{ fontSize: "2.8rem", display: "block", marginBottom: 10 }}>🎂</span>
        <h3 style={{ fontFamily: "var(--font-playfair)", fontSize: "1.45rem", fontWeight: 800, color: "#0e0e0e", lineHeight: 1.2, margin: "0 0 6px" }}>
          Cuéntanos tu cumple
        </h3>
        <p style={{ fontSize: "0.92rem", color: "#666", margin: 0, lineHeight: 1.45 }}>
          Te avisaremos cuando se acerque tu día con un regalo
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label style={{ display: "block", fontSize: "0.78rem", color: "#888", marginBottom: 4 }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="tu@correo.cl"
            style={{ width: "100%", background: "#f9f9f7", border: "1px solid #eee", borderRadius: 10, padding: "12px 16px", color: "#0e0e0e", fontSize: "0.92rem", outline: "none", boxSizing: "border-box" }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.78rem", color: "#888", marginBottom: 4 }}>Fecha de nacimiento</label>
          <div style={{ position: "relative" }}>
            <input
              type="text"
              inputMode="numeric"
              placeholder="DD/MM/AAAA"
              value={birthDateText}
              onChange={e => setBirthDateText(e.target.value)}
              maxLength={10}
              style={{ width: "100%", background: "#f9f9f7", border: "1px solid #eee", borderRadius: 10, padding: "12px 44px 12px 16px", color: "#0e0e0e", fontSize: "0.92rem", outline: "none", boxSizing: "border-box", letterSpacing: "0.02em" }}
            />
            <button
              type="button"
              aria-label="Abrir calendario"
              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", padding: 6, display: "flex", alignItems: "center", justifyContent: "center", color: "#888" }}
            >
              <Calendar size={18} />
            </button>
          </div>
        </div>
        <button style={{ width: "100%", marginTop: 4, background: "#F4A623", color: "white", borderRadius: 50, padding: "13px 20px", fontSize: "0.95rem", fontWeight: 700, border: "none", cursor: "pointer", boxShadow: "0 4px 14px rgba(244,166,35,0.3)" }}>
          Guardar mi cumple 🎉
        </button>
        <p style={{ textAlign: "center", fontSize: "0.75rem", color: "#aaa", marginTop: 12 }}>
          🔒 Solo para enviarte tu regalo. No spam.
        </p>
      </div>
    </div>
  );
}

function ModalNameStep() {
  const [name, setName] = useState("Juan");
  return (
    <div style={{ background: "white", borderRadius: 20, padding: "32px 24px 28px", maxWidth: 360, width: "100%", boxShadow: "0 25px 60px rgba(0,0,0,0.2)", position: "relative" }}>
      <button style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer" }}>
        <X size={18} color="#ccc" />
      </button>
      <div style={{ textAlign: "center" }}>
        <span style={{ fontSize: "2.6rem", display: "block", marginBottom: 8 }}>🎉</span>
        <h3 style={{ fontFamily: "var(--font-playfair)", fontSize: "1.35rem", fontWeight: 800, color: "#0e0e0e", lineHeight: 1.2, margin: "0 0 4px" }}>
          ¡Listo!
        </h3>
        <p style={{ fontSize: "0.88rem", color: "#888", margin: "0 0 22px", lineHeight: 1.45 }}>
          Te avisaremos cuando se acerque tu día.
        </p>
        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, #eee, transparent)", margin: "0 0 20px" }} />
        <p style={{ fontSize: "0.7rem", color: "#F4A623", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 6 }}>
          Una cosita más
        </p>
        <p style={{ fontSize: "0.88rem", color: "#666", margin: "0 0 14px", lineHeight: 1.45 }}>
          ¿Cómo te llamas? Para saludarte personalmente.
        </p>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Tu nombre"
          style={{ width: "100%", background: "#f9f9f7", border: "1px solid #eee", borderRadius: 10, padding: "12px 16px", color: "#0e0e0e", fontSize: "0.95rem", outline: "none", boxSizing: "border-box", textAlign: "center", marginBottom: 14 }}
        />
        <button style={{ width: "100%", background: "#F4A623", color: "white", borderRadius: 50, padding: "13px 20px", fontSize: "0.95rem", fontWeight: 700, border: "none", cursor: "pointer", boxShadow: "0 4px 14px rgba(244,166,35,0.3)", marginBottom: 8 }}>
          Continuar
        </button>
        <button style={{ background: "none", border: "none", color: "#aaa", fontSize: "0.85rem", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}>
          Saltar
        </button>
      </div>
    </div>
  );
}

function Toast({ title, sub }: { title: string; sub: string }) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #FFF8E5 0%, #FDE6BD 100%)",
        border: "1px solid rgba(244,166,35,0.4)",
        borderRadius: 22,
        padding: "26px 24px 24px",
        width: "min(340px, 100%)",
        boxShadow: "0 14px 38px rgba(244,166,35,0.25), 0 4px 14px rgba(0,0,0,0.08)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 10,
      }}
    >
      <span style={{ fontSize: "2.6rem", lineHeight: 1, display: "block" }}>🎂</span>
      <div style={{ width: "100%" }}>
        <p style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#7B3F00", lineHeight: 1.3 }}>{title}</p>
        <p style={{ margin: "6px 0 0", fontSize: "0.86rem", color: "#9A5510", lineHeight: 1.45 }}>{sub}</p>
      </div>
    </div>
  );
}

function Slot({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ fontFamily: "var(--font-playfair)", fontSize: "0.88rem", fontWeight: 600, color: "#F4A623", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
        {label}
      </p>
      <div style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", borderRadius: 18, padding: "32px 20px", display: "flex", justifyContent: "center", alignItems: "center", minHeight: 380 }}>
        {children}
      </div>
    </div>
  );
}

export default function PreviewBirthdayPage() {
  return (
    <div style={{ minHeight: "100dvh", background: "#fafaf7", padding: "32px 16px 48px", fontFamily: "var(--font-dm), system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <header style={{ marginBottom: 32, textAlign: "center" }}>
          <h1 style={{ fontFamily: "var(--font-playfair)", fontSize: "1.8rem", fontWeight: 800, color: "#0e0e0e", margin: "0 0 8px" }}>
            Preview del flujo de cumpleaños
          </h1>
          <p style={{ fontSize: "0.92rem", color: "#666", margin: 0 }}>
            Simulación de los 4 estados que ve un cliente al guardar su cumple. Datos mockeados.
          </p>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
          <Slot label={SECTION_TITLES.form}>
            <ModalForm />
          </Slot>

          <Slot label={SECTION_TITLES.toast}>
            <Toast title="¡Listo!" sub="Te avisaremos cuando se acerque tu cumpleaños 🎉" />
          </Slot>

          <Slot label={SECTION_TITLES.name}>
            <ModalNameStep />
          </Slot>

          <Slot label={SECTION_TITLES.toastName}>
            <Toast title="¡Listo, Juan!" sub="Te avisaremos cuando se acerque tu cumpleaños 🎉" />
          </Slot>
        </div>

        <footer style={{ marginTop: 48, textAlign: "center", fontSize: "0.78rem", color: "#999" }}>
          Para ver el flow real en vivo: usa <code style={{ background: "#f0f0e8", padding: "2px 6px", borderRadius: 4 }}>?debug_bday=1</code> en la carta de un local.
        </footer>
      </div>
    </div>
  );
}
