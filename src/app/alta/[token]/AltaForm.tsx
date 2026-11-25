"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ExternalLink, Store, User, Monitor, UtensilsCrossed, Sparkles, ShieldCheck, AlertCircle } from "lucide-react";
import type { RegistrationForm } from "@/lib/ventas/registration";
import type { DemoPlanSection } from "@/components/ventas/demo/types";

const EASE = [0.22, 1, 0.36, 1] as const;
const clp = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");
const onColor = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (r * 299 + g * 587 + b * 114) / 1000 > 165 ? "#111" : "#fff";
};

const STEPS = [
  { id: "local", title: "Tu local", icon: Store },
  { id: "tu", title: "Tú", icon: User },
  { id: "sistema", title: "Tu sistema actual", icon: Monitor },
  { id: "carta", title: "Tu carta", icon: UtensilsCrossed },
  { id: "plan", title: "Tu plan", icon: Sparkles },
  { id: "confirmar", title: "Confirmar", icon: ShieldCheck },
] as const;

const SYSTEMS = ["Ninguno", "Toteat", "Fudo", "Justo", "Bsale", "Jumpseller", "Otro"];
const RUT_RE = /^\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = {
  token: string; initial: RegistrationForm; color: string; logoUrl: string | null; cartaUrl: string | null;
  dishCount: number; sellerName: string | null; sections: DemoPlanSection[]; expiresAt: string;
};

export default function AltaForm({ token, initial, color, logoUrl, cartaUrl, dishCount, sellerName, sections }: Props) {
  const [f, setF] = useState<RegistrationForm>(initial);
  const [step, setStep] = useState(Math.min(initial.step ?? 0, STEPS.length - 1));
  const [dir, setDir] = useState(1);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ panelUrl: string | null; slug: string } | null>(null);
  const fg = onColor(color);
  const plans = sections.flatMap((s) => s.plans);
  // El plan recomendado va primero (su sección arriba y él al inicio).
  const ordered = [...sections]
    .sort((a, b) => Number(b.plans.some((p) => p.recommended)) - Number(a.plans.some((p) => p.recommended)))
    .map((s) => ({ ...s, plans: [...s.plans].sort((a, b) => Number(b.recommended) - Number(a.recommended)) }));
  const plan = plans.find((p) => p.id === f.planId) ?? null;

  // ── Autoguardado (se puede cerrar y volver a abrir el enlace) ──
  const dirty = useRef(false);
  const fRef = useRef(f);
  useEffect(() => {
    fRef.current = { ...f, step };
    if (!dirty.current) return;
    const t = setTimeout(async () => {
      setSaved("saving");
      const r = await fetch(`/api/alta/${encodeURIComponent(token)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fRef.current) }).catch(() => null);
      setSaved(r?.ok ? "saved" : "idle");
    }, 700);
    return () => clearTimeout(t);
  }, [f, step, token]);

  const set = <K extends keyof RegistrationForm>(k: K, v: RegistrationForm[K]) => { dirty.current = true; setError(null); setF((x) => ({ ...x, [k]: v })); };

  const stepError = (i: number): string | null => {
    if (i === 0 && !f.localName?.trim()) return "Escribe el nombre del local";
    if (i === 1) {
      if (!f.ownerName?.trim()) return "Escribe tu nombre";
      if (!f.email || !EMAIL_RE.test(f.email)) return "Revisa tu correo";
      if (!f.ownerPhone || f.ownerPhone.replace(/\D/g, "").length < 8) return "Revisa tu teléfono o WhatsApp";
      if (f.rut && !RUT_RE.test(f.rut.replace(/\s/g, ""))) return "Revisa el RUT (ej: 76.123.456-7)";
    }
    if (i === 4 && !f.planId) return "Elige un plan";
    return null;
  };

  const go = (to: number) => {
    if (to > step) { const e = stepError(step); if (e) { setError(e); return; } }
    dirty.current = true; setError(null); setDir(to > step ? 1 : -1); setStep(to);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    for (let i = 0; i < STEPS.length - 1; i++) { const e = stepError(i); if (e) { setDir(-1); setStep(i); setError(e); return; } }
    if (!f.acceptTerms) { setError("Debes aceptar los términos"); return; }
    setBusy(true); setError(null);
    try {
      const r = await fetch(`/api/alta/${encodeURIComponent(token)}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "No pudimos completar el registro"); return; }
      setDone({ panelUrl: d.panelUrl ?? null, slug: d.slug });
    } catch { setError("Error de conexión. Intenta de nuevo."); } finally { setBusy(false); }
  };

  if (done) return <Success color={color} fg={fg} name={f.localName || ""} ownerName={f.ownerName || ""} email={f.email || ""} panelUrl={done.panelUrl} logoUrl={logoUrl} />;

  const S = STEPS[step];
  return (
    <div style={page}>
      <div style={{ width: "100%", maxWidth: 520, margin: "0 auto", padding: "22px 18px 120px", boxSizing: "border-box" }}>
        {/* Encabezado */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Logo url={logoUrl} name={f.localName || "?"} color={color} fg={fg} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, color: "#8a8a8e", fontWeight: 600 }}>Registro en QuieroComer</div>
            <div style={{ fontSize: 17, fontWeight: 750, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.localName || "Tu local"}</div>
          </div>
          <div style={{ fontSize: 12, color: "#8a8a8e", minWidth: 70, textAlign: "right" }}>{saved === "saving" ? "Guardando…" : saved === "saved" ? "✓ Guardado" : ""}</div>
        </div>

        {/* Progreso */}
        <div style={{ display: "flex", gap: 5, margin: "20px 0 26px" }}>
          {STEPS.map((s, i) => (
            <button key={s.id} aria-label={s.title} onClick={() => i < step && go(i)} style={{ flex: 1, height: 5, borderRadius: 5, border: "none", padding: 0, cursor: i < step ? "pointer" : "default", background: i <= step ? color : "rgba(0,0,0,.09)", transition: "background .4s" }} />
          ))}
        </div>

        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div key={step} custom={dir} initial={{ opacity: 0, x: dir * 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -40 }} transition={{ duration: 0.4, ease: EASE }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, color, fontWeight: 700, fontSize: 13, letterSpacing: ".06em", textTransform: "uppercase" }}>
              <S.icon size={16} /> Paso {step + 1} de {STEPS.length}
            </div>
            <h1 style={{ fontSize: 32, lineHeight: 1.1, letterSpacing: "-.03em", fontWeight: 800, margin: "8px 0 6px" }}>{S.title}</h1>

            {step === 0 && (
              <Fields hint="Revisa que esté todo bien. Lo puedes cambiar después desde tu panel.">
                <Field label="Nombre del local" value={f.localName} onChange={(v) => set("localName", v)} autoComplete="organization" />
                <Field label="Dirección" value={f.address} onChange={(v) => set("address", v)} autoComplete="street-address" />
                <Field label="Comuna" value={f.commune} onChange={(v) => set("commune", v)} />
                <Field label="Teléfono del local" value={f.localPhone} onChange={(v) => set("localPhone", v)} type="tel" optional />
              </Fields>
            )}
            {step === 1 && (
              <Fields hint="Con este correo entras a tu panel.">
                <Field label="Tu nombre" value={f.ownerName} onChange={(v) => set("ownerName", v)} autoComplete="name" />
                <Field label="Correo" value={f.email} onChange={(v) => set("email", v.trim())} type="email" autoComplete="email" />
                <Field label="WhatsApp" value={f.ownerPhone} onChange={(v) => set("ownerPhone", v)} type="tel" autoComplete="tel" placeholder="9 1234 5678" />
                <Field label="RUT de la empresa" value={f.rut} onChange={(v) => set("rut", v)} placeholder="76.123.456-7" optional />
                <Field label="Razón social" value={f.businessName} onChange={(v) => set("businessName", v)} optional />
              </Fields>
            )}
            {step === 2 && (
              <Fields hint="Así sabemos si hay que traer tus datos (carta, clientes) desde otro sistema.">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {[...new Set([...(f.currentSystem && !SYSTEMS.includes(f.currentSystem) ? [f.currentSystem] : []), ...SYSTEMS])].map((s) => (
                    <Chip key={s} on={f.currentSystem === s} color={color} fg={fg} onClick={() => set("currentSystem", s)}>{s}</Chip>
                  ))}
                </div>
                {f.currentSystem && f.currentSystem !== "Ninguno" && (
                  <Field label="Link de tu carta o tienda actual" value={f.currentSystemLink} onChange={(v) => set("currentSystemLink", v)} type="url" optional placeholder="https://…" />
                )}
              </Fields>
            )}
            {step === 3 && (
              <Fields hint={dishCount ? "Ya cargamos tu carta. Revísala y cuéntanos si algo hay que corregir." : "Tu carta la cargamos nosotros. Déjanos un link o una nota y te contactamos."}>
                {dishCount > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 18, borderRadius: 20, background: "#fff", boxShadow: card }}>
                    <div style={{ width: 52, height: 52, borderRadius: 16, background: color, color: fg, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 20 }}>{dishCount}</div>
                    <div style={{ flex: 1 }}><div style={{ fontWeight: 750 }}>{dishCount === 1 ? "1 plato cargado" : `${dishCount} platos cargados`}</div><div style={{ fontSize: 14, color: "#8a8a8e" }}>Con fotos y precios</div></div>
                    {cartaUrl && <a href={cartaUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 14, color, textDecoration: "none" }}>Ver <ExternalLink size={15} /></a>}
                  </div>
                )}
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={lbl}>{dishCount ? "¿Algo que corregir?" : "Link o nota sobre tu carta"} <span style={{ color: "#aaa", fontWeight: 500 }}>(opcional)</span></span>
                  <textarea value={f.cartaNote ?? ""} onChange={(e) => set("cartaNote", e.target.value)} rows={4} placeholder={dishCount ? "Ej: el Furai Roll ahora cuesta $8.990" : "Ej: instagram.com/milocal o “les mando fotos por WhatsApp”"} style={{ ...inp, resize: "vertical", minHeight: 110 }} />
                </label>
              </Fields>
            )}
            {step === 4 && (
              <Fields hint={plans.some((p) => p.recommended) ? "Te recomendamos el plan que cubre lo que más te gustó de la demo." : "Elige el plan con el que quieres partir."}>
                {ordered.map((sec) => (
                  <div key={sec.id} style={{ display: "grid", gap: 10 }}>
                    {sections.length > 1 && <div style={{ ...lbl, marginTop: 6 }}>{sec.title}</div>}
                    {sec.plans.map((p) => {
                      const on = f.planId === p.id;
                      return (
                        <button key={p.id} onClick={() => set("planId", p.id)} style={{ textAlign: "left", font: "inherit", color: "#111", cursor: "pointer", border: "none", padding: "16px 18px", borderRadius: 20, background: "#fff", position: "relative", boxShadow: on ? `0 0 0 2px ${color}, 0 18px 40px -20px ${color}` : card, transition: "box-shadow .25s" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 24, height: 24, borderRadius: 99, flexShrink: 0, display: "grid", placeItems: "center", background: on ? color : "transparent", boxShadow: on ? "none" : "inset 0 0 0 2px rgba(0,0,0,.15)", color: fg }}>{on && <Check size={15} strokeWidth={3} />}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span style={{ fontWeight: 750, fontSize: 17 }}>{p.name}</span>
                                {p.recommended && <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 99, background: color, color: fg }}>Recomendado</span>}
                              </div>
                              {p.includes.length > 0 && <div style={{ fontSize: 13, color: "#8a8a8e", marginTop: 2 }}>Incluye {p.includes.join(" · ")}</div>}
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              {p.regularPrice && <div style={{ fontSize: 12, color: "#aaa", textDecoration: "line-through" }}>{clp(p.regularPrice)}</div>}
                              <div style={{ fontWeight: 800, fontSize: 18 }}>{p.priceFrom ? "desde " : ""}{clp(p.price)}</div>
                              <div style={{ fontSize: 12, color: "#8a8a8e" }}>/ mes</div>
                            </div>
                          </div>
                          <AnimatePresence initial={false}>
                            {on && p.features.length > 0 && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }} style={{ overflow: "hidden" }}>
                                <div style={{ display: "grid", gap: 6, paddingTop: 12, paddingLeft: 36 }}>
                                  {p.features.slice(0, 6).map((x) => <div key={x} style={{ display: "flex", gap: 8, fontSize: 14, color: "#444" }}><Check size={15} color={color} strokeWidth={2.6} style={{ flexShrink: 0, marginTop: 2 }} />{x}</div>)}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </button>
                      );
                    })}
                  </div>
                ))}
                {!plans.length && <div style={{ color: "#8a8a8e" }}>Tu vendedor te confirmará el plan.</div>}
                <div style={{ fontSize: 13, color: "#8a8a8e" }}>No pagas nada ahora. Te contactamos para activar el plan y el cobro.</div>
              </Fields>
            )}
            {step === 5 && (
              <Fields hint="Revisa y confirma. Te enviamos un correo para entrar a tu panel.">
                <div style={{ borderRadius: 20, background: "#fff", boxShadow: card, overflow: "hidden" }}>
                  <Row label="Local" value={[f.localName, f.commune].filter(Boolean).join(" · ")} onEdit={() => go(0)} />
                  <Row label="Dueño" value={[f.ownerName, f.email].filter(Boolean).join(" · ")} onEdit={() => go(1)} />
                  <Row label="Sistema actual" value={f.currentSystem || "—"} onEdit={() => go(2)} />
                  <Row label="Carta" value={dishCount ? `${dishCount} platos${f.cartaNote ? " · con nota" : ""}` : f.cartaNote ? "Con nota" : "La cargamos nosotros"} onEdit={() => go(3)} />
                  <Row label="Plan" value={plan ? `${plan.name} · ${clp(plan.price)}/mes` : "—"} onEdit={() => go(4)} last />
                </div>
                <label style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer", fontSize: 15, lineHeight: 1.45 }}>
                  <input type="checkbox" checked={!!f.acceptTerms} onChange={(e) => set("acceptTerms", e.target.checked)} style={{ width: 22, height: 22, accentColor: color, flexShrink: 0, marginTop: 1 }} />
                  <span>Acepto los términos y condiciones del servicio de QuieroComer.</span>
                </label>
              </Fields>
            )}
          </motion.div>
        </AnimatePresence>

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 16, padding: "12px 14px", borderRadius: 14, background: "#fef2f2", color: "#b91c1c", fontSize: 14, fontWeight: 600 }}>
              <AlertCircle size={17} /> {error}
            </motion.div>
          )}
        </AnimatePresence>

        {sellerName && step === 0 && <div style={{ marginTop: 22, fontSize: 13, color: "#8a8a8e", textAlign: "center" }}>Te acompaña {sellerName} · QuieroComer</div>}
      </div>

      {/* Botones fijos abajo (pulgar) */}
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, padding: "12px 18px calc(12px + env(safe-area-inset-bottom))", background: "rgba(251,250,247,.86)", backdropFilter: "blur(18px)", borderTop: "1px solid rgba(0,0,0,.06)" }}>
        <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", gap: 10 }}>
          {step > 0 && <button onClick={() => go(step - 1)} aria-label="Atrás" style={{ ...btn, background: "#ececec", color: "#111", flex: "0 0 56px", padding: 0 }}><ArrowLeft size={20} /></button>}
          {step < STEPS.length - 1 ? (
            <button onClick={() => go(step + 1)} style={{ ...btn, background: color, color: fg, flex: 1 }}>Continuar <ArrowRight size={19} /></button>
          ) : (
            <button onClick={submit} disabled={busy} style={{ ...btn, background: f.acceptTerms ? color : "#cfcfcf", color: f.acceptTerms ? fg : "#fff", flex: 1, opacity: busy ? 0.7 : 1 }}>{busy ? "Registrando…" : <>Confirmar registro <Check size={19} /></>}</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Pantalla final ──
function Success({ color, fg, name, ownerName, email, panelUrl, logoUrl }: { color: string; fg: string; name: string; ownerName: string; email: string; panelUrl: string | null; logoUrl: string | null }) {
  return (
    <div style={{ ...page, display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
      <div style={{ maxWidth: 440 }}>
        <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.7, ease: EASE }} style={{ display: "inline-block", position: "relative" }}>
          <Logo url={logoUrl} name={name} color={color} fg={fg} size={96} />
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5, type: "spring", stiffness: 300, damping: 16 }} style={{ position: "absolute", right: -10, bottom: -10, width: 40, height: 40, borderRadius: 99, background: "#16a34a", color: "#fff", display: "grid", placeItems: "center", boxShadow: "0 0 0 4px #FBFAF7" }}><Check size={22} strokeWidth={3} /></motion.div>
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.6, ease: EASE }} style={{ fontSize: 34, lineHeight: 1.1, letterSpacing: "-.03em", fontWeight: 800, margin: "30px 0 10px" }}>
          ¡Bienvenido, {ownerName.split(" ")[0] || "a QuieroComer"}!
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.6 }} style={{ fontSize: 17, color: "#666", lineHeight: 1.5, margin: 0 }}>
          <b style={{ color: "#111" }}>{name}</b> ya está en QuieroComer. Te enviamos un correo a <b style={{ color: "#111" }}>{email}</b> para entrar a tu panel. En los próximos días te contactamos para dejar todo funcionando.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.6, ease: EASE }} style={{ marginTop: 30 }}>
          {panelUrl ? (
            <a href={panelUrl} style={{ ...btn, background: color, color: fg, textDecoration: "none", padding: "17px 34px" }}>Entrar a mi panel <ArrowRight size={19} /></a>
          ) : (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, color }}><CheckCircle2 size={19} /> Revisa tu correo para entrar</div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

/** Página simple: enlace inválido, vencido o ya usado (también la usa page.tsx). */
export function AltaMessage({ title, text, ok }: { title: string; text: string; ok?: boolean }) {
  return (
    <div style={{ ...page, display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
      <div style={{ maxWidth: 400 }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, margin: "0 auto 20px", display: "grid", placeItems: "center", background: ok ? "#16a34a" : "#111", color: "#fff" }}>{ok ? <Check size={30} /> : <AlertCircle size={30} />}</div>
        <h1 style={{ fontSize: 28, letterSpacing: "-.03em", fontWeight: 800, margin: "0 0 8px" }}>{title}</h1>
        <p style={{ fontSize: 16, color: "#666", lineHeight: 1.5, margin: 0 }}>{text}</p>
      </div>
    </div>
  );
}

// ── Piezas ──
const page: React.CSSProperties = { minHeight: "100dvh", background: "#FBFAF7", color: "#111", fontFamily: "'Inter', ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" };
const card = "0 0 0 1px rgba(0,0,0,.06), 0 10px 30px -20px rgba(0,0,0,.25)";
const lbl: React.CSSProperties = { fontSize: 14, fontWeight: 650, color: "#444" };
const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "15px 16px", borderRadius: 16, border: "none", boxShadow: "inset 0 0 0 1px rgba(0,0,0,.12)", background: "#fff", font: "inherit", fontSize: 17, color: "#111", outline: "none" };
const btn: React.CSSProperties = { border: "none", cursor: "pointer", font: "inherit", fontWeight: 750, fontSize: 17, height: 56, borderRadius: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 };

function Fields({ hint, children }: { hint: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <p style={{ margin: "0 0 6px", fontSize: 16, color: "#777", lineHeight: 1.45 }}>{hint}</p>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", optional, placeholder, autoComplete }: { label: string; value: string | undefined; onChange: (v: string) => void; type?: string; optional?: boolean; placeholder?: string; autoComplete?: string }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={lbl}>{label}{optional && <span style={{ color: "#aaa", fontWeight: 500 }}> (opcional)</span>}</span>
      <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} type={type} inputMode={type === "tel" ? "tel" : type === "email" ? "email" : undefined} placeholder={placeholder} autoComplete={autoComplete} style={inp}
        onFocus={(e) => { e.currentTarget.style.boxShadow = "inset 0 0 0 2px #111"; }} onBlur={(e) => { e.currentTarget.style.boxShadow = inp.boxShadow as string; }} />
    </label>
  );
}

function Chip({ on, color, fg, onClick, children }: { on: boolean; color: string; fg: string; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} style={{ border: "none", cursor: "pointer", font: "inherit", fontWeight: 650, fontSize: 16, padding: "12px 18px", borderRadius: 99, background: on ? color : "#fff", color: on ? fg : "#111", boxShadow: on ? "none" : card }}>{children}</button>;
}

function Row({ label, value, onEdit, last }: { label: string; value: string; onEdit: () => void; last?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: last ? "none" : "1px solid rgba(0,0,0,.06)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "#8a8a8e", fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
      </div>
      <button onClick={onEdit} style={{ border: "none", background: "none", color: "#8a8a8e", font: "inherit", fontSize: 14, fontWeight: 650, cursor: "pointer" }}>Editar</button>
    </div>
  );
}

function Logo({ url, name, color, fg, size = 46 }: { url: string | null; name: string; color: string; fg: string; size?: number }) {
  if (url) return <img src={url} alt="" style={{ width: size, height: size, borderRadius: size * 0.28, objectFit: "cover", background: "#fff", boxShadow: card, flexShrink: 0 }} />;
  return <div style={{ width: size, height: size, borderRadius: size * 0.28, background: color, color: fg, display: "grid", placeItems: "center", fontWeight: 800, fontSize: size * 0.42, flexShrink: 0 }}>{name.trim().charAt(0).toUpperCase()}</div>;
}
