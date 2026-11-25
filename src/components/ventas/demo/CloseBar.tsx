"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Check, Clock, X, PenLine, Copy, MessageCircle, Mail } from "lucide-react";
import { EASE } from "./ui";

type Result = "accepted" | "thinking" | "lost" | "register_now";
const LOST = [
  { id: "precio", label: "Precio" },
  { id: "ya_tiene_sistema", label: "Ya tiene sistema" },
  { id: "no_es_el_momento", label: "No es el momento" },
  { id: "otro", label: "Otro" },
];
const inDays = (n: number) => new Date(Date.now() + n * 86400000).toLocaleDateString("en-CA", { timeZone: "America/Santiago" });

/** Barra fija de cierre (solo el vendedor). Cada acción cambia el estado del lead y registra eventos. */
export default function CloseBar({ leadId, color, open, onClose, initialEmail, initialWhatsapp, planId, localName }: {
  leadId: string; color: string; open: boolean; onClose: () => void;
  initialEmail: string; initialWhatsapp: string; planId: string | null; localName: string;
}) {
  const [mode, setMode] = useState<Result | null>(null);
  const [email, setEmail] = useState(initialEmail);
  const [whatsapp, setWhatsapp] = useState(initialWhatsapp);
  const [followUp, setFollowUp] = useState(inDays(3));
  const [lostReason, setLostReason] = useState("");
  const [lostDetail, setLostDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ title: string; sub?: string; registerUrl?: string; whatsappUrl?: string | null } | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async (result: Result) => {
    setBusy(true); setError(null);
    try {
      const r = await fetch(`/api/ventas/leads/${leadId}/close`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result, email, whatsapp, followUpAt: followUp ? `${followUp}T12:00:00-03:00` : "", lostReason, lostDetail, planId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "No se pudo guardar"); return; }
      if (result === "register_now") {
        if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
        window.location.href = d.registerUrl;
        return;
      }
      if (result === "accepted") setDone({ title: "Enlace de registro enviado", sub: `Correo enviado a ${email}. Envíaselo también por WhatsApp.`, registerUrl: d.registerUrl, whatsappUrl: d.whatsappUrl });
      if (result === "thinking") setDone({ title: "Seguimiento agendado", sub: `Te recordamos el ${new Date(`${followUp}T12:00:00-03:00`).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}.` });
      if (result === "lost") setDone({ title: "Marcado como perdido", sub: "Te recordaremos reintentar en 90 días." });
    } catch { setError("Error de conexión"); } finally { setBusy(false); }
  };

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 12, border: "1px solid #e5e5e5", font: "inherit", fontSize: 15, outline: "none", color: "#111", background: "#fff" };
  const btn = (bg: string, fg = "#fff"): React.CSSProperties => ({ border: "none", cursor: busy ? "default" : "pointer", font: "inherit", fontWeight: 750, fontSize: 15, padding: "13px 16px", borderRadius: 14, whiteSpace: "nowrap", background: bg, color: fg, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: busy ? 0.6 : 1 });

  return (
    <AnimatePresence>
      {open && (
        <motion.div key="closebar" onClick={stop} onKeyDown={stop} initial={{ y: 120, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 120, opacity: 0 }} transition={{ duration: 0.5, ease: EASE }}
          style={{ position: "absolute", left: 0, right: 0, bottom: 24, margin: "0 auto", zIndex: 40, width: "min(760px, calc(100vw - 24px))" }}>
          <AnimatePresence mode="wait">
            {!mode && !done ? (
              <motion.div key="bar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: 10, borderRadius: 22, background: "rgba(17,17,19,.94)", backdropFilter: "blur(20px)", boxShadow: "0 30px 80px -20px rgba(0,0,0,.6)" }}>
                <span style={{ color: "rgba(255,255,255,.6)", fontSize: 13, fontWeight: 700, padding: "0 8px" }}>Cierre</span>
                <button style={{ ...btn(color), flex: 1 }} onClick={() => setMode("accepted")}><Check size={18} /> Aceptó</button>
                <button style={{ ...btn("rgba(255,255,255,.1)"), flex: 1 }} onClick={() => setMode("thinking")}><Clock size={17} /> Lo quiere pensar</button>
                <button style={{ ...btn("rgba(255,255,255,.1)"), flex: 1 }} onClick={() => setMode("lost")}><X size={17} /> No aceptó</button>
                <button style={{ ...btn("#fff", "#111"), flex: 1 }} onClick={() => setMode("register_now")}><PenLine size={17} /> Registrar ahora</button>
                <button aria-label="Ocultar" onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,.5)", cursor: "pointer", padding: 6 }}><X size={18} /></button>
              </motion.div>
            ) : (
              <motion.div key={done ? "done" : mode} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, ease: EASE }}
                style={{ padding: "22px 24px", borderRadius: 26, background: "#fff", color: "#111", boxShadow: "0 40px 100px -24px rgba(0,0,0,.55)" }}>
                {done ? (
                  <div style={{ display: "grid", gap: 12 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <div style={{ width: 42, height: 42, borderRadius: 14, background: "#16a34a", color: "#fff", display: "grid", placeItems: "center" }}><Check size={22} /></div>
                      <div><div style={{ fontSize: 19, fontWeight: 800 }}>{done.title}</div>{done.sub && <div style={{ color: "#666", fontSize: 14 }}>{done.sub}</div>}</div>
                    </div>
                    {done.registerUrl && (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {done.whatsappUrl && <a href={done.whatsappUrl} target="_blank" rel="noreferrer" style={{ ...btn("#25D366"), textDecoration: "none" }}><MessageCircle size={17} /> Enviar por WhatsApp</a>}
                        <button style={btn("#f2f2f2", "#111")} onClick={() => { navigator.clipboard?.writeText(done.registerUrl!); setCopied(true); setTimeout(() => setCopied(false), 1500); }}><Copy size={16} /> {copied ? "¡Copiado!" : "Copiar enlace"}</button>
                      </div>
                    )}
                    <div><button style={btn("#111")} onClick={() => { setDone(null); setMode(null); onClose(); }}>Listo</button></div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-.02em" }}>
                      {mode === "accepted" ? "¡Aceptó! Enviar registro" : mode === "thinking" ? "Lo quiere pensar" : mode === "lost" ? "No aceptó" : `Registrar ${localName} ahora`}
                    </div>
                    {mode === "accepted" && (
                      <>
                        <div style={{ color: "#666", fontSize: 14 }}>Le llega un enlace por correo (y lo envías por WhatsApp) para confirmar sus datos. Vence en 14 días.</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <input style={input} type="email" placeholder="Correo del dueño" value={email} onChange={(e) => setEmail(e.target.value)} />
                          <input style={input} inputMode="tel" placeholder="WhatsApp (9 1234 5678)" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
                        </div>
                      </>
                    )}
                    {mode === "thinking" && (
                      <>
                        <div style={{ color: "#666", fontSize: 14 }}>Agenda cuándo volver a contactarlo. El link para ver la demo de nuevo llega en la próxima etapa.</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {[1, 3, 7].map((n) => <button key={n} style={{ ...btn(followUp === inDays(n) ? color : "#f2f2f2", followUp === inDays(n) ? "#fff" : "#111"), padding: "9px 14px", fontSize: 14 }} onClick={() => setFollowUp(inDays(n))}>{n === 1 ? "Mañana" : `En ${n} días`}</button>)}
                          <input style={{ ...input, width: "auto", padding: "8px 12px" }} type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <input style={input} type="email" placeholder="Correo (opcional)" value={email} onChange={(e) => setEmail(e.target.value)} />
                          <input style={input} inputMode="tel" placeholder="WhatsApp (opcional)" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
                        </div>
                      </>
                    )}
                    {mode === "lost" && (
                      <>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {LOST.map((l) => <button key={l.id} style={{ ...btn(lostReason === l.id ? "#111" : "#f2f2f2", lostReason === l.id ? "#fff" : "#111"), padding: "9px 14px", fontSize: 14 }} onClick={() => setLostReason(l.id)}>{l.label}</button>)}
                        </div>
                        <input style={input} placeholder={lostReason === "otro" ? "¿Cuál fue el motivo?" : "Detalle (opcional)"} value={lostDetail} onChange={(e) => setLostDetail(e.target.value)} />
                      </>
                    )}
                    {mode === "register_now" && <div style={{ color: "#666", fontSize: 14 }}>Se abre el formulario de registro en este equipo, con todo lo de la demo ya completado, para que el dueño lo confirme ahora.</div>}
                    {error && <div style={{ color: "#dc2626", fontSize: 14 }}>{error}</div>}
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button style={btn("#f2f2f2", "#111")} onClick={() => { setMode(null); setError(null); }}>Volver</button>
                      <button style={btn(mode === "lost" ? "#111" : color)} disabled={busy || (mode === "lost" && !lostReason)} onClick={() => submit(mode!)}>
                        {busy ? "Guardando…" : mode === "accepted" ? <><Mail size={17} /> Enviar registro</> : mode === "thinking" ? "Agendar seguimiento" : mode === "lost" ? "Guardar motivo" : "Abrir registro"}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
