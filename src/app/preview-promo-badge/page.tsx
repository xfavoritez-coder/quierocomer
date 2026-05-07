"use client";

import { useState } from "react";
import Image from "next/image";

/**
 * Preview de variantes del badge del card de ofertas (PromoCarousel).
 * Estado actual: "OFERTA" naranja claro o "HOY" rojo, ambos sin background.
 * El usuario quiere algo mas llamativo tipo pill con dia de la semana incluido.
 */

const DAY_NAMES = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
const DAY_SHORT = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];

function buildDayLabel(daysOfWeek: number[] | undefined, todayDow: number): string {
  if (!daysOfWeek || daysOfWeek.length === 0) return "OFERTA";
  if (daysOfWeek.length === 1) {
    const d = daysOfWeek[0];
    if (d === todayDow) return `SOLO HOY ${DAY_NAMES[d]}`;
    return `SOLO ${DAY_NAMES[d]}S`;
  }
  if (daysOfWeek.length <= 3) {
    return `SOLO ${daysOfWeek.map(d => DAY_SHORT[d]).join(" · ")}`;
  }
  return "DÍAS SELECTOS";
}

function CardBase({ children, badge }: { children: React.ReactNode; badge: React.ReactNode }) {
  return (
    <div style={{
      width: 290,
      background: "linear-gradient(135deg, #FFF7E8 0%, #FFEDD0 100%)",
      border: "1px solid rgba(244,166,35,0.25)",
      borderRadius: 16,
      display: "flex",
      alignItems: "stretch",
      gap: 0,
      padding: 0,
      boxShadow: "0 2px 12px rgba(244,166,35,0.08)",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{ position: "relative", width: 95, minHeight: 90, overflow: "hidden", flexShrink: 0, background: "linear-gradient(135deg, #e8d4b0, #d4b896)" }} />
      <div style={{ flex: 1, minWidth: 0, padding: "10px 12px" }}>
        {badge}
        <p style={{ fontSize: "14px", fontWeight: 700, color: "#0e0e0e", margin: 0 }}>Promo 30 piezas</p>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 5 }}>
          <span style={{ fontSize: "15px", fontWeight: 700, color: "#F4A623" }}>$12.990</span>
          <span style={{ fontSize: "13px", color: "#999", textDecoration: "line-through" }}>$15.990</span>
        </div>
      </div>
      {children}
    </div>
  );
}

/* ════════ ACTUAL — texto sin pill ════════ */
function ActualNoDays() {
  return (
    <CardBase badge={
      <span style={{ display: "inline-block", fontSize: "13px", fontWeight: 700, color: "#F4A623", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 3 }}>
        OFERTA
      </span>
    }>{null}</CardBase>
  );
}
function ActualWithDay() {
  return (
    <CardBase badge={
      <span style={{ display: "inline-block", fontSize: "13px", fontWeight: 700, color: "#C23B1E", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 3 }}>
        HOY
      </span>
    }>{null}</CardBase>
  );
}

/* ════════ A — Pill sólida naranja con dia completo ════════ */
function VariantA({ daysOfWeek, todayDow }: { daysOfWeek?: number[]; todayDow: number }) {
  const label = buildDayLabel(daysOfWeek, todayDow);
  return (
    <CardBase badge={
      <span style={{
        display: "inline-block",
        fontSize: "9.5px",
        fontWeight: 800,
        color: "white",
        background: "#F4A623",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        padding: "3px 8px",
        borderRadius: 999,
        marginBottom: 5,
      }}>
        {label}
      </span>
    }>{null}</CardBase>
  );
}

/* ════════ B — Pill outline + dot rojo pulsante para HOY ════════ */
function VariantB({ daysOfWeek, todayDow }: { daysOfWeek?: number[]; todayDow: number }) {
  const isToday = daysOfWeek?.length === 1 && daysOfWeek[0] === todayDow;
  const label = buildDayLabel(daysOfWeek, todayDow);
  return (
    <CardBase badge={
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: "9.5px",
        fontWeight: 700,
        color: isToday ? "#C23B1E" : "#F4A623",
        background: "white",
        border: `1px solid ${isToday ? "rgba(194,59,30,0.35)" : "rgba(244,166,35,0.4)"}`,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        padding: "3px 9px 3px 7px",
        borderRadius: 999,
        marginBottom: 5,
      }}>
        {isToday && (
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", animation: "pulseDot 1.4s ease-in-out infinite" }} />
        )}
        {label}
      </span>
    }>{null}</CardBase>
  );
}

/* ════════ C — Cinta diagonal estilo "ribbon" en la esquina ════════ */
function VariantC({ daysOfWeek, todayDow }: { daysOfWeek?: number[]; todayDow: number }) {
  const label = buildDayLabel(daysOfWeek, todayDow);
  return (
    <div style={{ position: "relative" }}>
      <CardBase badge={null}>
        <div style={{
          position: "absolute",
          top: 8,
          left: 0,
          background: "#F4A623",
          color: "white",
          fontSize: "9.5px",
          fontWeight: 800,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          padding: "3px 10px 3px 14px",
          borderRadius: "0 999px 999px 0",
          boxShadow: "2px 2px 4px rgba(244,166,35,0.25)",
          zIndex: 5,
        }}>
          {label}
        </div>
      </CardBase>
    </div>
  );
}

/* ════════ D — Pill bicolor: "SOLO HOY" + día separado ════════ */
function VariantD({ daysOfWeek, todayDow }: { daysOfWeek?: number[]; todayDow: number }) {
  const isToday = daysOfWeek?.length === 1 && daysOfWeek[0] === todayDow;
  if (!daysOfWeek?.length) {
    return (
      <CardBase badge={
        <span style={{ display: "inline-block", fontSize: "10px", fontWeight: 800, color: "white", background: "#F4A623", letterSpacing: "0.12em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 999, marginBottom: 5 }}>
          OFERTA
        </span>
      }>{null}</CardBase>
    );
  }
  const dayName = isToday ? `HOY ${DAY_NAMES[daysOfWeek[0]]}` : daysOfWeek.map(d => DAY_NAMES[d]).join(" · ");
  return (
    <CardBase badge={
      <span style={{ display: "inline-flex", alignItems: "center", overflow: "hidden", borderRadius: 999, marginBottom: 5, fontSize: "9.5px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>
        <span style={{ background: "#0e0e0e", color: "white", padding: "3px 8px" }}>SOLO</span>
        <span style={{ background: "#F4A623", color: "white", padding: "3px 9px" }}>{dayName}</span>
      </span>
    }>{null}</CardBase>
  );
}

/* ════════ E — Pill con flame icon ════════ */
function VariantE({ daysOfWeek, todayDow }: { daysOfWeek?: number[]; todayDow: number }) {
  const isToday = daysOfWeek?.length === 1 && daysOfWeek[0] === todayDow;
  const label = buildDayLabel(daysOfWeek, todayDow);
  return (
    <CardBase badge={
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: "9.5px",
        fontWeight: 800,
        color: "white",
        background: isToday ? "linear-gradient(90deg, #ef4444 0%, #F4A623 100%)" : "#F4A623",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        padding: "3px 9px",
        borderRadius: 999,
        marginBottom: 5,
        boxShadow: isToday ? "0 2px 8px rgba(239,68,68,0.25)" : "0 1px 4px rgba(244,166,35,0.25)",
      }}>
        {isToday && <span style={{ fontSize: "11px", marginLeft: -1 }}>🔥</span>}
        {label}
      </span>
    }>{null}</CardBase>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ fontFamily: "var(--font-playfair)", fontSize: "0.88rem", fontWeight: 600, color: "#F4A623", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>{title}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>{children}</div>
    </div>
  );
}

export default function PreviewPromoBadgePage() {
  const todayDow = new Date().getDay();
  const [day, setDay] = useState(todayDow);

  return (
    <div style={{ minHeight: "100dvh", background: "#fafaf7", padding: "32px 16px 60px", fontFamily: "var(--font-dm), system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 32 }}>
        <header>
          <h1 style={{ fontFamily: "var(--font-playfair)", fontSize: "1.7rem", fontWeight: 800, color: "#0e0e0e", margin: "0 0 6px" }}>Badge del card de ofertas — propuestas</h1>
          <p style={{ fontSize: "0.9rem", color: "#666", margin: 0, lineHeight: 1.5 }}>
            Hoy es <strong>{DAY_NAMES[todayDow]}</strong>. Cambia el día simulado para ver cómo se ve cuando coincide con hoy o no.
          </p>
          <div style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
            {DAY_NAMES.map((d, i) => (
              <button
                key={i}
                onClick={() => setDay(i)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "1px solid rgba(0,0,0,0.1)",
                  background: day === i ? "#0e0e0e" : "white",
                  color: day === i ? "white" : "#666",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {d}{i === todayDow && " (hoy)"}
              </button>
            ))}
          </div>
        </header>

        <Section title="Estado actual (referencia)">
          <ActualNoDays />
          <ActualWithDay />
        </Section>

        <Section title="A — Pill sólida naranja, día completo">
          <VariantA todayDow={todayDow} />
          <VariantA todayDow={todayDow} daysOfWeek={[day]} />
          <VariantA todayDow={todayDow} daysOfWeek={[2, 4]} />
        </Section>

        <Section title="B — Pill outline + dot rojo pulsante cuando es HOY">
          <VariantB todayDow={todayDow} />
          <VariantB todayDow={todayDow} daysOfWeek={[day]} />
          <VariantB todayDow={todayDow} daysOfWeek={[2, 4]} />
        </Section>

        <Section title="C — Cinta tipo ribbon en la esquina">
          <VariantC todayDow={todayDow} />
          <VariantC todayDow={todayDow} daysOfWeek={[day]} />
          <VariantC todayDow={todayDow} daysOfWeek={[2, 4]} />
        </Section>

        <Section title='D — Pill bicolor "SOLO" + día'>
          <VariantD todayDow={todayDow} />
          <VariantD todayDow={todayDow} daysOfWeek={[day]} />
          <VariantD todayDow={todayDow} daysOfWeek={[2, 4]} />
        </Section>

        <Section title="E — Pill con gradiente + 🔥 cuando es hoy">
          <VariantE todayDow={todayDow} />
          <VariantE todayDow={todayDow} daysOfWeek={[day]} />
          <VariantE todayDow={todayDow} daysOfWeek={[2, 4]} />
        </Section>

        <footer style={{ marginTop: 12, padding: "16px 18px", background: "#fff", borderRadius: 12, border: "1px solid #eee", fontSize: "0.82rem", color: "#666", lineHeight: 1.6 }}>
          <p style={{ margin: 0 }}>Cuando me digas cuál te gusta (A, B, C, D o E) lo aplico al componente real <code style={{ background: "#f0f0e8", padding: "1px 5px", borderRadius: 4 }}>PromoCarousel.tsx</code>. Si querés mezcla de varias, también funciona.</p>
        </footer>

        <style>{`
          @keyframes pulseDot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.55; transform: scale(0.85); } }
        `}</style>
      </div>
    </div>
  );
}
