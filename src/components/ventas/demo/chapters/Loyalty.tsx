"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Gift, Users, CalendarHeart, Check } from "lucide-react";
import type { ChapterProps } from "../DemoShell";
import { BrandText, CountUp, EASE, Eyebrow, Headline, LocalLogo, Reveal, Stage, TryItHint, avgTicket, clp, demoPrize, lighten, onColor, rgba, useViewport } from "../ui";

const STAMPS = 5;
const RETURNING = 50; // clientes que vuelven 1 vez más al mes

export default function Loyalty({ data, step }: ChapterProps) {
  const { narrow } = useViewport();
  const reduce = useReducedMotion();
  const c = data.color;
  const accent = lighten(c, 0.35);
  const prize = demoPrize(data);
  const [ticket, setTicket] = useState(() => avgTicket(data)); // editable en la calculadora

  // Sellos que se van llenando.
  // Se llenan una sola vez al aparecer la tarjeta (no se reinician en los pasos siguientes).
  const [tick, setTick] = useState(0);
  const showCard = step >= 1;
  const filling = showCard && !reduce && tick < STAMPS;
  useEffect(() => {
    if (!filling) return;
    const t = setInterval(() => setTick((n) => n + 1), 650);
    return () => clearInterval(t);
  }, [filling]);
  const filled = !showCard ? 0 : reduce ? STAMPS : Math.min(tick, STAMPS);

  if (step === 0) {
    return (
      <Stage style={{ flexDirection: "column", textAlign: "center" }}>
        <Reveal step={step} at={0}><Eyebrow color={accent}>Fidelización</Eyebrow></Reveal>
        <Reveal step={step} at={0} delay={0.15}><Headline style={{ marginTop: 18, color: "#fff" }}>Que el cliente<br />que vino una vez,</Headline></Reveal>
        <Reveal step={step} at={0} delay={0.5}><Headline style={{ marginTop: 6 }}><BrandText color={accent}>vuelva.</BrandText></Headline></Reveal>
      </Stage>
    );
  }

  const card = (
    <motion.div initial={reduce ? false : { rotateX: 18, rotateY: -14, opacity: 0, y: 50 }} animate={{ rotateX: 0, rotateY: 0, opacity: 1, y: 0 }} transition={{ duration: 1.3, ease: EASE }}
      style={{ width: narrow ? 300 : 420, aspectRatio: "1.586", borderRadius: 26, padding: narrow ? 20 : 28, boxSizing: "border-box", position: "relative", overflow: "hidden", color: onColor(c),
        background: `linear-gradient(135deg, ${lighten(c, 0.12)} 0%, ${c} 55%, ${rgba(c, 0.85)} 100%)`, boxShadow: `0 40px 100px -24px ${rgba(c, 0.8)}, inset 0 1px 0 rgba(255,255,255,.3)` }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(115deg, transparent 35%, rgba(255,255,255,.22) 48%, transparent 60%)" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
        <LocalLogo data={data} size={narrow ? 38 : 48} />
        <div><div style={{ fontWeight: 800, fontSize: narrow ? 16 : 19, letterSpacing: "-.02em" }}>{data.name}</div><div style={{ fontSize: 12, opacity: 0.75 }}>Tarjeta de cliente</div></div>
      </div>
      <div style={{ position: "absolute", left: narrow ? 20 : 28, right: narrow ? 20 : 28, bottom: narrow ? 20 : 26 }}>
        <div style={{ display: "flex", gap: narrow ? 8 : 12, justifyContent: "space-between" }}>
          {Array.from({ length: STAMPS }).map((_, i) => {
            const on = i < filled;
            const last = i === STAMPS - 1;
            return (
              <motion.div key={i} initial={false} animate={{ scale: on ? [1.35, 1] : 1 }} transition={{ duration: 0.45, ease: EASE }}
                style={{ flex: 1, aspectRatio: "1", borderRadius: "50%", display: "grid", placeItems: "center", border: `2px solid ${on ? "transparent" : "rgba(255,255,255,.45)"}`, background: on ? (last ? "#fff" : "rgba(255,255,255,.92)") : "transparent", color: c }}>
                {on && (last ? <Gift size={narrow ? 16 : 22} /> : <Check size={narrow ? 15 : 20} strokeWidth={3} />)}
              </motion.div>
            );
          })}
        </div>
        <motion.div initial={false} animate={{ opacity: filled >= STAMPS ? 1 : 0, y: filled >= STAMPS ? 0 : 8 }} transition={{ duration: 0.6 }} style={{ marginTop: 12, fontWeight: 750, fontSize: narrow ? 13 : 15 }}>
          🎁 ¡{prize?.name ?? "Tu próximo pedido"} gratis!
        </motion.div>
      </div>
    </motion.div>
  );

  return (
    <>
    <TryItHint show={step === 1 && !!data.slug && !narrow} color={accent} text="Inscríbete en tu propia tarjeta" />
    <Stage style={{ gap: "clamp(28px, 6vw, 100px)", flexDirection: narrow ? "column" : "row" }}>
      <div style={{ flex: "1 1 0", maxWidth: 560, minWidth: 0 }}>
        <Reveal step={step} at={1}><Eyebrow color={accent}>Fidelización · {data.name}</Eyebrow></Reveal>
        <Reveal step={step} at={1} delay={0.1}><Headline size="lg" style={{ marginTop: 14, color: "#fff" }}>Su tarjeta.<br /><BrandText color={accent}>Sin descargar nada.</BrandText></Headline></Reveal>

        {step === 2 && (
          <div style={{ marginTop: 30, display: "grid", gap: 18 }}>
            {[
              { icon: Gift, t: "Premios con tus platos", s: `Ej: a la ${STAMPS}ª visita, ${prize?.name ?? "un plato"} gratis.` },
              { icon: Users, t: "Una base de clientes propia", s: "Nombre, correo, cumpleaños y frecuencia. Tuya, no de una app." },
              { icon: CalendarHeart, t: "Campañas automáticas", s: "Saludo de cumpleaños y aviso a quienes no vuelven hace 30 días." },
            ].map((f, i) => (
              <Reveal key={f.t} step={step} at={2} delay={0.15 + i * 0.18} y={14}>
                <div style={{ display: "flex", gap: 14 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 14, flexShrink: 0, display: "grid", placeItems: "center", background: rgba(c, 0.25), color: accent }}><f.icon size={20} /></div>
                  <div><div style={{ fontSize: 20, fontWeight: 700, color: "#fff", letterSpacing: "-.02em" }}>{f.t}</div><div style={{ fontSize: 16, color: "rgba(255,255,255,.55)", marginTop: 2 }}>{f.s}</div></div>
                </div>
              </Reveal>
            ))}
          </div>
        )}

        {step === 3 && (
          <Reveal step={step} at={3} delay={0.1} style={{ marginTop: 30 }}>
            <div style={{ fontSize: "clamp(17px, 1.6vw, 21px)", color: "rgba(255,255,255,.7)", lineHeight: 1.5 }}>
              Si <b style={{ color: "#fff" }}>{RETURNING} clientes</b> vuelven <b style={{ color: "#fff" }}>1 vez más al mes</b><br />con un ticket de{" "}
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, verticalAlign: "middle" }}>
                <TicketBtn onClick={() => setTicket((t) => Math.max(1000, t - 1000))}>−</TicketBtn>
                <b style={{ color: "#fff", fontFamily: "var(--demo-mono)" }}>{clp(ticket)}</b>
                <TicketBtn onClick={() => setTicket((t) => t + 1000)}>+</TicketBtn>
              </span>
            </div>
            <div style={{ marginTop: 14, fontSize: "clamp(48px, 6vw, 92px)", fontWeight: 750, letterSpacing: "-.045em", lineHeight: 1, color: accent }}>
              +<CountUp value={RETURNING * ticket} run={step === 3} />
            </div>
            <div style={{ fontSize: 17, color: "rgba(255,255,255,.55)", marginTop: 6 }}>
              extra al mes · <CountUp value={RETURNING * ticket * 12} run={step === 3} duration={2.2} style={{ color: "rgba(255,255,255,.8)" }} /> al año
            </div>
          </Reveal>
        )}
      </div>
      <div style={{ perspective: 1200, flexShrink: 0 }}>{card}</div>
    </Stage>
    </>
  );
}

function TicketBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} style={{ width: 30, height: 30, borderRadius: 99, border: "1px solid rgba(255,255,255,.25)", background: "rgba(255,255,255,.08)", color: "#fff", fontSize: 18, fontWeight: 700, cursor: "pointer", lineHeight: 1 }}>
      {children}
    </button>
  );
}
