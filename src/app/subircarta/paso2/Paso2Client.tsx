"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const PROGRESS_STEPS = [
  { label: "Detectando platos y categorías", duration: 2000 },
  { label: "Ordenando la información", duration: 2000 },
  { label: "Diseñando la primera propuesta", duration: 2500 },
];

export default function Paso2Client() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const leadId = searchParams.get("id");

  const [cartaUrl, setCartaUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(0);
  const [animDone, setAnimDone] = useState(false);

  const [localName, setLocalName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const formRef = useRef<HTMLFormElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Fetch lead data
  useEffect(() => {
    if (!leadId) return;
    fetch(`/api/subircarta/${leadId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.cartaUrl) setCartaUrl(data.cartaUrl);
      })
      .catch(() => {});
  }, [leadId]);

  // Progress animation
  useEffect(() => {
    let cancelled = false;
    const totalDuration = PROGRESS_STEPS.reduce((s, st) => s + st.duration, 0);
    const startTime = Date.now();

    const tick = () => {
      if (cancelled) return;
      const elapsed = Date.now() - startTime;
      const pct = Math.min((elapsed / totalDuration) * 100, 100);
      setProgress(Math.round(pct));

      let done = 0;
      let acc = 0;
      for (const step of PROGRESS_STEPS) {
        acc += step.duration;
        if (elapsed >= acc) done++;
      }
      setCompletedSteps(done);

      if (pct < 100) {
        requestAnimationFrame(tick);
      } else {
        setAnimDone(true);
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

    try {
      const res = await fetch(`/api/subircarta/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          localName: localName.trim(),
          ownerName: ownerName.trim(),
          email: email.trim(),
          whatsapp: whatsapp.trim() || null,
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
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)", color: "var(--text)" }}>
        <p>No se encontró la referencia. <a href="/subircarta" style={{ color: "var(--gold)" }}>Volver al paso 1</a></p>
      </div>
    );
  }

  const displayUrl = cartaUrl
    ? (() => { try { return new URL(cartaUrl).hostname; } catch { return cartaUrl; } })()
    : null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      <div className="page">
        <div className="content">
          {/* Topbar */}
          <header className="topbar">
            <a href="/landing" className="brand" style={{ textDecoration: "none", color: "inherit" }}>
              <img src="/landing/logo.png" alt="" style={{ height: 20, width: "auto" }} />
              QuieroComer
            </a>
            <a href="mailto:hola@quierocomer.cl" className="help">Ayuda</a>
          </header>

          {/* Steps */}
          <nav className="steps">
            <div className="step done"><span className="bubble">&#10003;</span><span>Subir carta</span></div>
            <div className="step active"><span className="bubble">2</span><span>Transformación</span></div>
            <div className="step"><span className="bubble">3</span><span>Carta viva</span></div>
          </nav>

          {/* Main card */}
          <section className="main-card">
            <h1>Tu carta ya está <em>cambiando.</em></h1>
            <p className="subcopy">Estamos leyendo tu carta y preparando una versión más clara, atractiva y fácil de vender.</p>

            {/* File pill — show link URL */}
            {displayUrl && (
              <div className="file-pill">
                <div className="file-ico">
                  <svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                </div>
                <div>
                  <div className="file-name">{displayUrl}</div>
                  <div className="file-meta">Link recibido · listo para analizar</div>
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
                      <svg viewBox="0 0 20 20" width="16" height="16" fill="none"><circle cx="10" cy="10" r="10" fill="#43d17b"/><path d="M6 10.5l2.5 2.5L14 8" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    ) : (
                      <svg viewBox="0 0 20 20" width="16" height="16" fill="none"><circle cx="10" cy="10" r="9" stroke="#f0a71f" strokeWidth="2"/><path d="M10 6v4l2 2" stroke="#f0a71f" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    )}
                    {step.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Form section */}
            <div className="form-section" style={{ opacity: animDone ? 1 : 0.35, transition: "opacity 0.6s ease", pointerEvents: animDone ? "auto" : "none" }}>
              <div className="form-title">
                <h2>¿Dónde te la enviamos?</h2>
                <p>Déjanos tus datos y recibirás la propuesta en unos minutos.</p>
              </div>

              <form ref={formRef} onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
                <div className="field-row">
                  <input
                    ref={firstInputRef}
                    className="fc"
                    type="text"
                    placeholder="Nombre del local"
                    value={localName}
                    onChange={(e) => { setLocalName(e.target.value); setError(""); }}
                  />
                </div>
                <div className="field-row">
                  <input
                    className="fc"
                    type="text"
                    placeholder="Tu nombre"
                    value={ownerName}
                    onChange={(e) => { setOwnerName(e.target.value); setError(""); }}
                  />
                </div>
                <div className="field-row">
                  <input
                    className="fc"
                    type="tel"
                    placeholder="WhatsApp (opcional)"
                    value={whatsapp}
                    onChange={(e) => { setWhatsapp(e.target.value); setError(""); }}
                  />
                </div>
                <div className="field-row" style={{ marginBottom: 14 }}>
                  <input
                    className="fc"
                    type="email"
                    placeholder="Correo electrónico"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  />
                </div>

                {error && (
                  <div style={{ color: "#e85d5d", fontSize: 14, textAlign: "center", marginBottom: 8 }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn-main"
                  disabled={loading}
                  style={{ opacity: loading ? 0.6 : 1 }}
                >
                  {loading ? "Enviando..." : "Recibir mi nueva carta →"}
                </button>
              </form>

              <div className="trust">Sin cuenta, sin spam. Solo usaremos tus datos para enviarte esta propuesta.</div>
            </div>
          </section>

          {/* Footer */}
          <footer>
            © 2026 QuieroComer® · Santiago, Chile
            <div className="footer-links">
              <a href="/landing">Inicio</a>
              <a href="mailto:hola@quierocomer.cl">Contacto</a>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}

const STYLES = `
:root {
  --bg: #090704;
  --panel: rgba(17, 13, 8, .88);
  --panel-soft: rgba(255, 255, 255, .045);
  --border: rgba(255, 220, 150, .18);
  --border-strong: rgba(255, 184, 54, .36);
  --gold: #f0a71f;
  --gold-2: #ffc04a;
  --text: #f8eedf;
  --muted: #b8a58d;
  --muted-2: #806f5d;
  --green: #43d17b;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { min-height: 100vh!important; background: var(--bg)!important; color: var(--text)!important; font-family: Georgia, 'Times New Roman', serif!important; }
.page { width: 100%; max-width: 562px; min-height: 100vh; margin: 0 auto; position: relative; overflow: hidden; background: linear-gradient(rgba(8,6,3,.70), rgba(8,6,3,.72)), url('https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=900&auto=format&fit=crop') center top / cover no-repeat; }
.page::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(180deg, rgba(0,0,0,.02) 0%, rgba(0,0,0,.1) 58%, #050403 100%); }
.content { position: relative; z-index: 1; min-height: 100vh; display: flex; flex-direction: column; }
.topbar { height: 89px; padding: 0 31px; display: flex; align-items: center; justify-content: space-between; background: rgba(8, 6, 3, .76); backdrop-filter: blur(8px); }
.brand { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 22px; letter-spacing: -.04em; }
.help { color: #c8b89f; text-decoration: none; font-size: 16px; font-weight: 600; font-family: system-ui, -apple-system, sans-serif; }
.steps { display: grid; grid-template-columns: 1fr 1fr 1fr; align-items: center; gap: 0; padding: 40px 32px 0; color: rgba(248,238,223,.52); font-family: system-ui, -apple-system, sans-serif; }
.step { display: flex; align-items: center; gap: 10px; position: relative; white-space: nowrap; font-size: 16px; }
.step:not(:last-child)::after { content: ''; position: absolute; left: 72px; right: -12px; top: 50%; height: 1px; background: rgba(240,167,31,.24); }
.bubble { width: 35px; height: 35px; border-radius: 50%; display: grid; place-items: center; border: 1px solid rgba(240,167,31,.5); color: var(--gold-2); font-size: 14px; font-weight: 700; flex: 0 0 auto; background: rgba(17,13,8,.65); }
.step.active { color: var(--gold-2); }
.step.done { color: rgba(248,238,223,.76); }
.step.done .bubble { background: var(--gold); color: #120b04; border-color: var(--gold); }
.main-card { margin: 42px 18px 0; border-radius: 34px; border: 1px solid var(--border); background: linear-gradient(145deg, rgba(18,14,9,.92), rgba(16,12,8,.80)); box-shadow: 0 20px 60px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.04); padding: 30px 30px 31px; }
h1 { margin: 0 0 18px; text-align: center; color: #fff3e1; font-size: 47px; line-height: .98; letter-spacing: -.055em; font-weight: 500; }
h1 em { display: block; color: var(--gold); font-style: italic; }
.subcopy { text-align: center; color: var(--muted); font-family: system-ui, -apple-system, sans-serif; font-size: 15px; line-height: 1.45; margin: 0 auto 21px; max-width: 390px; }
.file-pill { border: 1px solid rgba(255, 220, 150, .17); background: rgba(255,255,255,.045); border-radius: 20px; padding: 13px 14px; display: flex; align-items: center; gap: 12px; margin-bottom: 20px; font-family: system-ui, -apple-system, sans-serif; }
.file-ico { width: 42px; height: 42px; border-radius: 14px; display: grid; place-items: center; color: var(--gold); border: 1px solid rgba(240,167,31,.4); background: rgba(240,167,31,.08); font-size: 20px; flex: 0 0 auto; }
.file-name { font-size: 15px; font-weight: 700; color: #fff0da; margin-bottom: 2px; }
.file-meta { font-size: 13px; color: var(--muted); }
.progress-area { margin-bottom: 22px; font-family: system-ui, -apple-system, sans-serif; }
.progress-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; color: #f7ead7; font-weight: 700; }
.progress-head span { color: var(--gold); }
.progress-track { height: 9px; background: rgba(255,255,255,.09); border-radius: 999px; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, var(--gold), var(--gold-2)); border-radius: 999px; transition: width 0.3s ease; }
.checks { display: grid; gap: 9px; margin-top: 14px; color: #d8c7af; font-size: 14px; }
.check { display: flex; align-items: center; gap: 9px; }
.form-section { margin-top: 6px; }
.form-title { text-align: center; margin: 20px 0 14px; }
.form-title h2 { margin: 0 0 7px; color: #fff3e1; font-size: 32px; line-height: 1; letter-spacing: -.05em; font-weight: 500; }
.form-title p { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.4; font-family: system-ui, -apple-system, sans-serif; }
.field-row { margin-bottom: 8px; }
.fc { width: 100%; height: 57px; border-radius: 18px; border: 1px solid rgba(255, 220, 150, .19); background: rgba(255,255,255,.055); color: #fff3e1; font-size: 16px; font-family: system-ui, -apple-system, sans-serif; padding: 0 17px; outline: none; }
.fc::placeholder { color: rgba(216,199,175,.62); }
.fc:focus { color: #fff3e1; background: rgba(255,255,255,.075); border-color: rgba(240,167,31,.72); box-shadow: 0 0 0 3px rgba(240,167,31,.13); }
.btn-main { width: 100%; height: 78px; border-radius: 20px; border: 0; margin-top: 10px; color: #130c05; font-weight: 900; font-size: 21px; letter-spacing: .02em; background: linear-gradient(135deg, #f8b43d, #f0a321); box-shadow: 0 16px 36px rgba(240, 167, 31, .26); font-family: system-ui, -apple-system, sans-serif; cursor: pointer; transition: transform .2s ease, box-shadow .2s ease; }
.btn-main:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 20px 44px rgba(240, 167, 31, .32); }
.trust { margin-top: 13px; text-align: center; color: var(--muted-2); font-size: 13px; line-height: 1.35; font-family: system-ui, -apple-system, sans-serif; }
footer { margin-top: auto; padding: 58px 20px 46px; text-align: center; color: rgba(184,165,141,.68); font-size: 16px; position: relative; z-index: 1; }
.footer-links { display: flex; justify-content: center; gap: 32px; margin-top: 18px; font-family: system-ui, -apple-system, sans-serif; font-size: 15px; }
.footer-links a { color: rgba(184,165,141,.88); text-decoration: none; }
@media (max-width: 380px) { .topbar { padding: 0 22px; } .brand { font-size: 20px; } .steps { padding-left: 22px; padding-right: 22px; } .step { font-size: 14px; gap: 7px; } .bubble { width: 31px; height: 31px; } .main-card { padding: 27px 22px; } h1 { font-size: 41px; } .form-title h2 { font-size: 29px; } }
`;
