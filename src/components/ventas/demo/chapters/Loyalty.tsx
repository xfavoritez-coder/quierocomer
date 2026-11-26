"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { Gift, Check, MapPin } from "lucide-react";
import type { ChapterProps } from "../DemoShell";
import type { DemoData } from "../types";
import { PhoneFrame } from "../frames";
import { BrandText, EASE, Eyebrow, Headline, LocalLogo, QrPill, Reveal, Stage, demoPrize, lighten, onColor, rgba, useViewport } from "../ui";

const STAMPS = 5;

const COPY: Record<number, { t1: string; t2: string; sub: string }> = {
  1: { t1: "Cada visita,", t2: "un sello.", sub: "Se inscribe con un QR y su tarjeta queda en Apple Wallet o Google Wallet. Sin descargar nada. Va juntando sellos hasta ganar su premio." },
  2: { t1: "Pasa cerca.", t2: "Le avisamos.", sub: "Cuando está a pasos de tu local, le llega un aviso a su celular: le falta un sello para su premio. Y entra." },
  3: { t1: "Su cumpleaños.", t2: "Tu regalo.", sub: "Ese día recibe un saludo con un regalo tuyo. Automático, todos los años. Así se acuerda de ti." },
};

export default function Loyalty({ data, step, onQr }: ChapterProps) {
  const { narrow } = useViewport();
  const c = data.color;
  const accent = lighten(c, 0.35);
  // Las notificaciones del celular aparecen cuando el vendedor las envía (botón).
  const [shown, setShown] = useState({ near: false, bday: false });

  if (step === 0) {
    return (
      <Stage style={{ flexDirection: "column", textAlign: "center" }}>
        <Reveal step={step} at={0}><Eyebrow color={accent}>Fidelización</Eyebrow></Reveal>
        <Reveal step={step} at={0} delay={0.15}><Headline style={{ marginTop: 18, color: "#fff" }}>Que el cliente<br />que vino una vez,</Headline></Reveal>
        <Reveal step={step} at={0} delay={0.5}><Headline style={{ marginTop: 6 }}><BrandText color={accent}>vuelva.</BrandText></Headline></Reveal>
      </Stage>
    );
  }

  const k = Math.min(step, 3);
  const copy = COPY[k];
  return (
    <>
      <Stage style={{ gap: "clamp(28px, 6vw, 110px)", flexDirection: narrow ? "column" : "row" }}>
        <div style={{ flex: "1 1 0", maxWidth: 520, minWidth: 0 }}>
          <Reveal step={step} at={1}><Eyebrow color={accent}>Fidelización · {data.name}</Eyebrow></Reveal>
          <AnimatePresence mode="wait">
            <motion.div key={k} initial={{ opacity: 0, y: 16, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -12, filter: "blur(8px)" }} transition={{ duration: 0.65, ease: EASE }}>
              <Headline size="lg" style={{ marginTop: 14, color: "#fff" }}>{copy.t1}<br /><BrandText color={accent}>{copy.t2}</BrandText></Headline>
              <div style={{ fontSize: "clamp(16px, 1.4vw, 20px)", color: "rgba(255,255,255,.6)", marginTop: 20, lineHeight: 1.5, maxWidth: 470 }}>{copy.sub}</div>
            </motion.div>
          </AnimatePresence>
          {/* Los tres momentos, como índice */}
          <div style={{ display: "flex", gap: 8, marginTop: 30, flexWrap: "wrap" }}>
            {["Sellos", "Cerca del local", "Cumpleaños"].map((t, i) => (
              <motion.span key={t} initial={false} animate={{ background: i + 1 === k ? accent : "rgba(255,255,255,.08)", color: i + 1 === k ? onColor(accent) : "rgba(255,255,255,.55)" }}
                style={{ padding: "7px 14px", borderRadius: 99, fontSize: 13, fontWeight: 700 }}>{t}</motion.span>
            ))}
          </div>
          {k === 1 && data.slug && <QrPill label="Inscríbete tú en tu tarjeta" mobileLabel="Inscríbete tú en tu tarjeta" color={accent} onClick={onQr} dark style={{ marginTop: 22 }} />}
          {k >= 2 && <PushTest key={k} leadId={data.slug ? data.leadId : null} kind={k === 2 ? "near" : "birthday"} color={accent} onShow={() => setShown((x) => ({ ...x, [k === 2 ? "near" : "bday"]: true }))} />}
        </div>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <Reveal step={step} at={1} y={60} delay={0.2}>
            <PhoneFrame width={narrow ? 220 : 300} style={{ background: "linear-gradient(145deg, #3a3a3e, #111)" }}>
              <LockScreen data={data} k={k} shown={shown} />
            </PhoneFrame>
          </Reveal>
          <AnimatePresence>{k === 2 && !narrow && <NearbyMap color={accent} />}</AnimatePresence>
        </div>
      </Stage>
    </>
  );
}

/** Pantalla del celular del cliente: su tarjeta en el Wallet y los avisos que le llegan. */
function LockScreen({ data, k, shown }: { data: DemoData; k: number; shown: { near: boolean; bday: boolean } }) {
  const reduce = useReducedMotion();
  const c = data.color;
  const prize = demoPrize(data)?.name ?? "un premio";
  // Sellos: se llenan al aparecer (hasta 4 de 5 → "te falta 1").
  const [tick, setTick] = useState(0);
  const target = STAMPS - 1;
  const filling = !reduce && tick < target;
  useEffect(() => {
    if (!filling) return;
    const t = setInterval(() => setTick((n) => n + 1), 600);
    return () => clearInterval(t);
  }, [filling]);
  const filled = reduce ? target : Math.min(tick, target);
  const first = "Camila";

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", color: "#fff", background: `radial-gradient(120% 80% at 20% 0%, ${rgba(c, 0.85)} 0%, #1b1b1f 55%, #0a0a0b 100%)` }}>
      <div style={{ textAlign: "center", marginTop: "14%" }}>
        <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.8 }}>{k === 3 ? "sábado 14 de junio" : "jueves 12 de junio"}</div>
        <div style={{ fontSize: 58, fontWeight: 300, letterSpacing: "-.03em", lineHeight: 1.05 }}>{k === 2 ? "19:42" : k === 3 ? "10:05" : "13:20"}</div>
      </div>

      {/* Avisos */}
      <div style={{ position: "absolute", left: 10, right: 10, top: "40%", display: "grid", gap: 8 }}>
        <AnimatePresence>
          {k === 2 && shown.near && (
            <Notif key="near" icon={<MapPin size={16} />} color={c} title={data.name} time="ahora" delay={0.5}>
              Estás a pasos de {data.name} 👋 Te falta 1 sello para tu {prize}.
            </Notif>
          )}
          {k === 3 && shown.bday && (
            <Notif key="bday" icon={<Gift size={16} />} color={c} title={data.name} time="ahora" delay={0.5}>
              🎂 ¡Feliz cumpleaños, {first}! Hoy te regalamos {prize}. Te esperamos.
            </Notif>
          )}
        </AnimatePresence>
      </div>

      {/* Tarjeta en el Wallet */}
      <motion.div initial={false} animate={{ y: k === 1 ? "-62%" : 60, scale: k === 1 ? 1.04 : 0.9, opacity: k === 1 ? 1 : 0 }} transition={{ duration: 0.8, ease: EASE }}
        style={{ position: "absolute", left: 10, right: 10, bottom: 14, aspectRatio: "1.45", borderRadius: 16, padding: 12, boxSizing: "border-box", overflow: "hidden", color: onColor(c),
          background: `linear-gradient(135deg, ${lighten(c, 0.12)} 0%, ${c} 60%, ${rgba(c, 0.85)} 100%)`, boxShadow: `0 20px 40px -14px ${rgba(c, 0.8)}` }}>
        <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(115deg, transparent 35%, rgba(255,255,255,.2) 48%, transparent 60%)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
          <LocalLogo data={data} size={28} />
          <div style={{ minWidth: 0 }}><div style={{ fontWeight: 800, fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{data.name}</div><div style={{ fontSize: 9.5, opacity: 0.8 }}>{first} · Tarjeta de cliente</div></div>
        </div>
        <div style={{ position: "absolute", left: 12, right: 12, bottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.85, marginBottom: 6 }}>{filled} de {STAMPS} sellos · {STAMPS - filled === 1 ? "¡te falta 1!" : `faltan ${STAMPS - filled}`}</div>
          <div style={{ display: "flex", gap: 6 }}>
            {Array.from({ length: STAMPS }).map((_, i) => {
              const on = i < filled;
              const last = i === STAMPS - 1;
              return (
                <motion.div key={i} initial={false} animate={{ scale: on ? [1.4, 1] : 1 }} transition={{ duration: 0.45, ease: EASE }}
                  style={{ flex: 1, aspectRatio: "1", borderRadius: "50%", display: "grid", placeItems: "center", border: `1.5px solid ${on ? "transparent" : "rgba(255,255,255,.5)"}`, background: on ? "rgba(255,255,255,.95)" : "transparent", color: c }}>
                  {on ? <Check size={13} strokeWidth={3} /> : last ? <Gift size={12} color="rgba(255,255,255,.8)" /> : null}
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Notif({ icon, color, title, time, delay, children }: { icon: React.ReactNode; color: string; title: string; time: string; delay: number; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: -24, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.6, ease: EASE, delay }}
      style={{ display: "flex", gap: 9, padding: "10px 11px", borderRadius: 16, background: "rgba(245,245,247,.82)", backdropFilter: "blur(18px)", color: "#111", boxShadow: "0 10px 30px -10px rgba(0,0,0,.5)" }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: color, color: onColor(color) }}>{icon}</div>
      <div style={{ minWidth: 0, fontSize: 11, lineHeight: 1.35 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}><b style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</b><span style={{ color: "#888", flexShrink: 0 }}>{time}</span></div>
        <div style={{ color: "#333" }}>{children}</div>
      </div>
    </motion.div>
  );
}

/** Radar del local: el cliente entra al radio y le llega el aviso. */
function NearbyMap({ color }: { color: string }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8, ease: EASE }}
      style={{ position: "absolute", right: -215, top: "30%", width: 170, height: 170, pointerEvents: "none" }}>
      {[0, 1, 2].map((i) => (
        <motion.div key={i} initial={{ scale: 0.2, opacity: 0.6 }} animate={{ scale: 1, opacity: 0 }} transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: "easeOut" }}
          style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `2px solid ${color}` }} />
      ))}
      <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: 38, height: 38, borderRadius: 12, background: color, color: onColor(color), display: "grid", placeItems: "center", boxShadow: `0 10px 30px -6px ${color}` }}><MapPin size={20} /></div>
      <motion.div initial={{ x: -60, y: 70, opacity: 0 }} animate={{ x: 18, y: 18, opacity: 1 }} transition={{ duration: 1.6, ease: EASE, delay: 0.2 }}
        style={{ position: "absolute", left: "50%", top: "50%", width: 16, height: 16, borderRadius: 99, background: "#fff", boxShadow: "0 0 0 4px rgba(255,255,255,.25)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: -26, textAlign: "center", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.6)" }}>a 100 m de tu local</div>
    </motion.div>
  );
}

/** Botón del vendedor: muestra la notificación en el celular de la pantalla y, si el dueño se
 *  inscribió y agregó la tarjeta a su Wallet, se la envía también a su celular. */
function PushTest({ leadId, kind, color, onShow }: { leadId: string | null; kind: "near" | "birthday"; color: string; onShow: () => void }) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const send = async () => {
    onShow();
    if (!leadId) { setState("done"); return; }
    setState("sending"); setMsg(null);
    try {
      const r = await fetch(`/api/ventas/leads/${leadId}/loyalty-push`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind }) });
      const d = await r.json().catch(() => ({}));
      setMsg(r.ok ? { ok: true, text: "También llegó a tu celular 📱" } : { ok: false, text: d.error || "No se pudo enviar a tu celular" });
    } catch { setMsg({ ok: false, text: "Error de conexión" }); }
    setState("done");
  };
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE, delay: 0.8 }} onClick={(e) => e.stopPropagation()} style={{ marginTop: 22 }}>
      <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={send} disabled={state === "sending"}
        style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "11px 18px 11px 12px", borderRadius: 99, border: "none", cursor: "pointer", font: "inherit", fontWeight: 700, fontSize: 15, background: "#fff", color: "#111", boxShadow: "0 16px 40px -14px rgba(0,0,0,.5)", opacity: state === "sending" ? 0.7 : 1 }}>
        <span style={{ width: 30, height: 30, borderRadius: 99, display: "grid", placeItems: "center", background: color, color: onColor(color) }}><Send size={15} /></span>
        {state === "sending" ? "Enviando…" : state === "done" ? "Enviar de nuevo" : kind === "near" ? "Enviar aviso de cercanía" : "Enviar saludo de cumpleaños"}
      </motion.button>
      {msg && <div style={{ marginTop: 10, fontSize: 14, fontWeight: 600, color: msg.ok ? color : "rgba(255,255,255,.55)", maxWidth: 440 }}>{msg.text}</div>}
    </motion.div>
  );
}
