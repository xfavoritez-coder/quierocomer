"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { normalizePhone } from "@/lib/normalizePhone";
import Footer from "@/components/Footer";
import PlanesModal from "@/components/PlanesModal";

const PROGRESS_STEPS = [
  { label: "Detectando platos y categorías", duration: 5000 },
  { label: "Ordenando la información de tu carta", duration: 6500 },
  { label: "Diseñando la nueva propuesta", duration: 7500 },
];

/** Non-linear easing — slows down around 40% and 75% to feel like real processing */
function easeProgress(linear: number): number {
  if (linear < 0.35) return linear * 1.1;
  if (linear < 0.45) return 0.385 + (linear - 0.35) * 0.35;  // slow zone ~40%
  if (linear < 0.7) return 0.42 + (linear - 0.45) * 1.12;
  if (linear < 0.8) return 0.7 + (linear - 0.7) * 0.5;       // slow zone ~75%
  return 0.75 + (linear - 0.8) * 1.25;
}

export default function Paso2Client() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const leadId = searchParams.get("id");

  const [cartaUrl, setCartaUrl] = useState<string | null>(null);
  const [cartaFileUrl, setCartaFileUrl] = useState<string | null>(null);
  const [cartaType, setCartaType] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(0);
  const [animDone, setAnimDone] = useState(false);

  const [localName, setLocalName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phoneWarning, setPhoneWarning] = useState("");
  const [planesOpen, setPlanesOpen] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Fetch lead data + start async processing immediately (while animation plays)
  useEffect(() => {
    if (!leadId) return;

    // Fire processing NOW — runs during the 19s animation + form fill time
    fetch("/api/subircarta/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId }),
    }).catch(() => {});

    fetch(`/api/subircarta/${leadId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.email) {
          router.replace(`/subircarta/confirmacion?id=${leadId}`);
          return;
        }
        if (data.cartaUrl) setCartaUrl(data.cartaUrl);
        if (data.cartaFileUrl) setCartaFileUrl(data.cartaFileUrl);
        if (data.cartaType) setCartaType(data.cartaType);
      })
      .catch(() => {});
  }, [leadId, router]);

  // Progress animation — skip if already seen for this lead
  useEffect(() => {
    const storageKey = `subircarta_anim_${leadId}`;
    if (sessionStorage.getItem(storageKey)) {
      setProgress(100);
      setCompletedSteps(PROGRESS_STEPS.length);
      setAnimDone(true);
      return;
    }

    let cancelled = false;
    const totalDuration = PROGRESS_STEPS.reduce((s, st) => s + st.duration, 0);
    const startTime = Date.now();

    const tick = () => {
      if (cancelled) return;
      const elapsed = Date.now() - startTime;
      const linear = Math.min(elapsed / totalDuration, 1);
      const eased = easeProgress(linear);
      setProgress(Math.min(Math.round(eased * 100), 100));

      let done = 0;
      let acc = 0;
      for (const step of PROGRESS_STEPS) {
        acc += step.duration;
        if (elapsed >= acc + 800) done++;
      }
      setCompletedSteps(done);

      if (linear < 1) {
        requestAnimationFrame(tick);
      } else {
        setTimeout(() => {
          if (!cancelled) {
            setCompletedSteps(PROGRESS_STEPS.length);
            sessionStorage.setItem(storageKey, "1");
            setTimeout(() => { if (!cancelled) setAnimDone(true); }, 600);
          }
        }, 900);
      }
    };

    requestAnimationFrame(tick);
    return () => { cancelled = true; };
  }, []);

  // When animation done, scroll to form and focus
  useEffect(() => {
    if (!animDone) return;
    const t = setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => firstInputRef.current?.focus(), 400);
    }, 300);
    return () => clearTimeout(t);
  }, [animDone]);

  const handleSubmit = async () => {
    if (loading) return;
    if (!localName.trim() || !ownerName.trim() || !email.trim()) {
      setError("Completa los campos obligatorios.");
      return;
    }

    setLoading(true);
    setError("");
    setPhoneWarning("");

    const rawWa = whatsapp.trim();
    const normalizedWa = rawWa ? normalizePhone(rawWa) : null;
    if (rawWa && !normalizedWa) {
      setPhoneWarning("No pudimos validar este número. Se guardará sin WhatsApp.");
    }

    try {
      const res = await fetch(`/api/subircarta/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          localName: localName.trim(),
          ownerName: ownerName.trim(),
          email: email.trim(),
          whatsapp: rawWa || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al guardar.");
        return;
      }

      router.push(`/subircarta/confirmacion?id=${leadId}`);
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (!leadId) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: STYLES }} />
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
          <p>No se encontró la referencia. <a href="/subircarta" style={{ color: "var(--amber-2)" }}>Volver al paso 1</a></p>
        </div>
      </>
    );
  }

  const displayUrl = cartaUrl
    ? (() => { try { return new URL(cartaUrl).hostname; } catch { return cartaUrl; } })()
    : null;

  const displayFileName = cartaFileUrl
    ? decodeURIComponent(cartaFileUrl.split("/").pop() || "archivo")
    : null;

  const pillLabel = cartaType === "LINK" ? displayUrl : displayFileName;
  const pillMeta = cartaType === "LINK" ? "Link recibido · listo para analizar"
    : cartaType === "PHOTO" ? "Foto recibida · lista para analizar"
    : "Archivo recibido · listo para analizar";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      <div className="grain" />

      <main className="page">
        <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, padding: "20px clamp(22px,4vw,64px)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(9,8,6,.72)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
          <a href="/landing" style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, color: "var(--cream)", display: "flex", alignItems: "center", gap: 10, letterSpacing: ".02em", textDecoration: "none" }}>
            <img src="/landing/logo.png" alt="" style={{ height: 20, width: "auto", marginRight: -8 }} />
            QuieroComer
          </a>
          <a href="mailto:hola@quierocomer.cl" style={{ color: "var(--cream-2)", fontSize: 13, textDecoration: "none", letterSpacing: ".04em" }}>Ayuda</a>
        </nav>

        {/* Steps — step 1 done, step 2 active */}
        <section className="steps" aria-label="Progreso">
          <div className="step done"><div className="step-number">&#10003;</div><span>Subir carta</span></div>
          <div className="step-line" />
          <div className="step active"><div className="step-number">2</div><span>Transformación</span></div>
          <div className="step-line" />
          <div className="step"><div className="step-number">3</div><span>Carta viva</span></div>
        </section>

        <section className="shell centered-shell">
          <div className="center-copy">
            <h1>Estamos <span>transformando</span> tu carta</h1>
            <p className="subcopy">Estamos leyendo tu carta y preparando una nueva versión.</p>
          </div>

          <div className="centered-form">
            {/* File pill */}
            {pillLabel && (
              <div className="file-pill">
                <div className="file-ico">
                  {cartaType === "LINK" ? (
                    <svg viewBox="0 0 24 24" fill="none" width="18" height="18"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  ) : cartaType === "PHOTO" ? (
                    <svg viewBox="0 0 24 24" fill="none" width="18" height="18"><path d="M6 8h3l2-3h2l2 3h3v12H6V8z" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="14" r="3.5" stroke="currentColor" strokeWidth="1.8"/></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" width="18" height="18"><path d="M8 2h8l4 4v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.8"/><path d="M16 2v4h4M10 10h4M10 14h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                  )}
                </div>
                <div>
                  <div className="file-name">{pillLabel}</div>
                  <div className="file-meta">{pillMeta}</div>
                </div>
              </div>
            )}

            {/* Progress */}
            <div className="progress-area">
              <div className="progress-head">
                <strong>Preparando demo</strong>
                <span>{progress}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="checks">
                {PROGRESS_STEPS.map((step, i) => (
                  <div key={i} className={`check${i < completedSteps ? "" : " pending"}`}>
                    {i < completedSteps ? (
                      <svg viewBox="0 0 20 20" width="15" height="15" fill="none"><circle cx="10" cy="10" r="10" fill="#43d17b"/><path d="M6 10.5l2.5 2.5L14 8" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    ) : (
                      <svg viewBox="0 0 20 20" width="15" height="15" fill="none"><circle cx="10" cy="10" r="9" stroke="var(--amber)" strokeWidth="2"/><path d="M10 6v4l2 2" stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    )}
                    {step.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Form — hidden until animation completes, then slides up */}
            {animDone && (
            <div className="form-section form-reveal">
              <div className="form-title">
                <h2>¿Dónde te la enviamos?</h2>
                <p className="form-sub">Déjanos tus datos para enviar tu carta viva lista.</p>
              </div>

              <form ref={formRef} onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
                <div className="field-row">
                  <input ref={firstInputRef} type="text" placeholder="Nombre del local" value={localName} onChange={(e) => { setLocalName(e.target.value); setError(""); }} />
                </div>
                <div className="field-row">
                  <input type="text" placeholder="Tu nombre" value={ownerName} onChange={(e) => { setOwnerName(e.target.value); setError(""); }} />
                </div>
                <div className="field-row">
                  <input type="tel" placeholder="WhatsApp (opcional)" value={whatsapp} onChange={(e) => { setWhatsapp(e.target.value); setError(""); setPhoneWarning(""); }} />
                  {phoneWarning && (
                    <div style={{ color: "var(--amber-2)", fontSize: 12, marginTop: 4, textAlign: "left", paddingLeft: 4 }}>
                      {phoneWarning}
                    </div>
                  )}
                </div>
                <div className="field-row">
                  <input type="email" placeholder="Correo electrónico" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} />
                </div>

                {error && (
                  <div style={{ color: "#e85d5d", fontSize: 14, textAlign: "center", marginBottom: 8 }}>
                    {error}
                  </div>
                )}

                <button type="submit" className="cta" disabled={loading} style={{ opacity: loading ? 0.6 : 1 }}>
                  {loading ? "Enviando..." : "Recibir mi nueva carta"} <span>→</span>
                </button>
              </form>

              <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 12, marginTop: 10 }}>Solo usaremos tus datos para enviarte la propuesta.</p>

            </div>
            )}
          </div>
        </section>
      </main>

      <Footer onPlanesClick={() => setPlanesOpen(true)} />
      {planesOpen && <PlanesModal onClose={() => setPlanesOpen(false)} />}
    </>
  );
}

/* Same design system as paso 1 (/subircarta) */
const STYLES = `
:root {
  --black: #090806;--black-2: #120f0b;--card: rgba(18, 14, 10, .76);--card-2: rgba(255, 255, 255, .045);
  --line: rgba(242, 229, 207, .14);--line-strong: rgba(232, 163, 61, .44);
  --amber: #E8A33D;--amber-2: #E8A33D;--amber-3: #B8801A;
  --cream: #F2E5CF;--cream-2: #CDBB9D;--muted: #887B68;
  --font-display: 'Cormorant Garamond', serif;--font-body: 'Inter', sans-serif;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body { min-height: 100vh!important; background: linear-gradient(180deg, rgba(9,8,6,.72), rgba(9,8,6,.96)), url('/landing/fondo.png') center/cover no-repeat!important; background-size: cover!important; background-attachment: fixed!important; color: var(--cream)!important; font-family: var(--font-body)!important; line-height: 1.55!important; -webkit-font-smoothing: antialiased; overflow-x: hidden!important; }
.grain { position: fixed; inset: 0; pointer-events: none; z-index: 30; opacity: .13; mix-blend-mode: overlay; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.6'/%3E%3C/svg%3E"); }
a { color: inherit; text-decoration: none; }
.page { width: min(100% - 28px, 1120px); margin: 0 auto; padding: 80px 0 34px; position: relative; z-index: 2; }
.steps { display: flex; align-items: center; justify-content: center; gap: 0; margin: 24px auto 34px; max-width: 480px; }
.step { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 13px; }
.step-line { width: 28px; height: 1px; background: rgba(232,163,61,.15); margin: 0 6px; }
.step-number { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 600; border: 1px solid rgba(232,163,61,.2); background: transparent; color: var(--muted); }
.step.active { color: var(--amber-2); }
.step.active .step-number { color: var(--amber-2); border-color: var(--amber); background: rgba(232,163,61,.1); }
.step.done .step-number { background: var(--amber); color: #0e0e0e; border-color: var(--amber); font-size: 11px; }
.step.done { color: var(--cream-2); }
.shell { border: 1px solid var(--line); background: linear-gradient(180deg, rgba(14,11,8,.86), rgba(14,11,8,.62)); border-radius: 28px; padding: 24px; box-shadow: 0 28px 90px rgba(0,0,0,.38); backdrop-filter: blur(14px); position: relative; overflow: hidden; }
.centered-shell { max-width: 760px; margin: 0 auto; text-align: center; }
.shell::before { content: ''; position: absolute; width: 360px; height: 360px; right: -140px; top: 140px; border-radius: 50%; background: radial-gradient(circle, rgba(232,163,61,.16), transparent 70%); filter: blur(8px); pointer-events: none; }
h1 { font-family: var(--font-display); font-size: clamp(38px, 10vw, 60px); line-height: .94; font-weight: 500; letter-spacing: -.035em; margin-bottom: 14px; }
h1 span { color: var(--amber-2); font-style: italic; }
.subcopy { color: var(--cream-2); font-size: 15px; line-height: 1.45; margin: 0 auto 22px; max-width: 420px; }
.centered-form { max-width: 620px; margin: 0 auto; }
.file-pill { border: 1px solid var(--line); background: rgba(255,255,255,.04); border-radius: 18px; padding: 12px 14px; display: flex; align-items: center; gap: 12px; margin-bottom: 18px; text-align: left; }
.file-ico { width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; color: var(--amber-2); border: 1px solid rgba(232,163,61,.3); background: rgba(232,163,61,.08); flex: 0 0 auto; }
.file-name { font-size: 14px; font-weight: 600; color: var(--cream); margin-bottom: 1px; }
.file-meta { font-size: 12px; color: var(--muted); }
.progress-area { margin-bottom: 20px; }
.progress-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 14px; color: var(--cream); font-weight: 600; }
.progress-head span { color: var(--amber-2); }
.progress-track { height: 7px; background: rgba(255,255,255,.08); border-radius: 999px; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, var(--amber), var(--amber-2)); border-radius: 999px; transition: width 0.3s ease; }
.checks { display: grid; gap: 7px; margin-top: 12px; color: var(--cream-2); font-size: 13px; }
.check { display: flex; align-items: center; gap: 8px; }
.form-section { margin-top: 8px; border-top: 1px solid var(--line); padding-top: 20px; }
.form-reveal { animation: formSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both; }
@keyframes formSlideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
.form-title { text-align: center; margin-bottom: 14px; }
.form-title h2 { font-family: var(--font-display); font-size: clamp(26px, 7vw, 34px); line-height: 1; letter-spacing: -.03em; font-weight: 500; margin-bottom: 6px; color: var(--cream); }
.form-sub { color: var(--muted); font-size: 13px; line-height: 1.4; margin-bottom: 20px; }
.field-row { margin-bottom: 8px; }
input { width: 100%; height: 56px; border-radius: 16px; border: 1px solid var(--line); background: rgba(0,0,0,.32); color: var(--cream); padding: 0 16px; font: inherit; outline: none; font-size: 15px; }
input::placeholder { color: rgba(180,165,140,.55) !important; }
input:focus { border-color: var(--amber); box-shadow: 0 0 0 3px rgba(232,163,61,.1); }
.trust { display: flex; justify-content: center; align-items: center; gap: 6px; color: var(--cream-2); font-size: 13px; margin: 22px 0 18px; }
.trust svg { flex-shrink: 0; color: var(--amber-2); width: 16px; height: 16px; }
.below-cta { margin: 10px auto 0; max-width: 520px; }
.cta { width: 100%; min-height: 62px; border: 0; border-radius: 18px; background: var(--amber); color: #160e06; font-size: 17px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 18px 58px rgba(232,163,61,.24); cursor: pointer; transition: transform .2s ease, box-shadow .2s ease, opacity .3s ease; margin-top: 14px; }
.cta:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 24px 72px rgba(232,163,61,.32); }
@media (min-width: 860px) { .page { padding-top: 80px; } .steps { width: 560px; margin: 0 auto 36px; } .shell { padding: 46px; } }
@media (max-width: 390px) { h1 { font-size: 36px; } }
`;
