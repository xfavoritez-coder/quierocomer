"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Footer from "@/components/Footer";
import PlanesModal from "@/components/PlanesModal";

interface SampleDish {
  name: string;
  description?: string;
  price: number;
  imageUrl: string | null;
  category: string;
}

interface Preview {
  restaurantName: string;
  logoUrl: string | null;
  totalDishes: number;
  totalCategories: number;
  sampleDishes: SampleDish[];
}

export default function ConfirmacionClient() {
  const searchParams = useSearchParams();
  const leadId = searchParams.get("id");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [cartaReady, setCartaReady] = useState(false);
  const [modalDismissed, setModalDismissed] = useState(false);
  const [cartaSlug, setCartaSlug] = useState<string | null>(null);
  const [heroIdx, setHeroIdx] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const [localName, setLocalName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [planesOpen, setPlanesOpen] = useState(false);

  // Trigger full processing when confirmation loads
  useEffect(() => {
    if (!leadId) return;
    fetch("/api/subircarta/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId }),
    }).catch(() => {});
  }, [leadId]);

  useEffect(() => {
    if (!leadId) return;
    let polling: ReturnType<typeof setInterval> | null = null;

    const fetchLead = () => {
      fetch(`/api/subircarta/${leadId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.localName) setLocalName(data.localName);
          if (data.email) setLeadEmail(data.email);
          if (data.preview?.sampleDishes?.length > 0 && !imagesLoaded) {
            const imgs = data.preview.sampleDishes.map((d: any) => d.imageUrl).filter(Boolean);
            if (imgs.length > 0) {
              Promise.all(imgs.map((src: string) => new Promise<void>((resolve) => {
                const img = new Image();
                img.onload = () => resolve();
                img.onerror = () => resolve();
                img.src = src;
              }))).then(() => {
                setPreview(data.preview);
                setImagesLoaded(true);
              });
            } else {
              setPreview(data.preview);
              setImagesLoaded(true);
            }
          }
          if (data.cartaStatus === "READY" || data.cartaStatus === "DELIVERED") {
            setCartaReady(true);
            if (data.generatedSlug) setCartaSlug(data.generatedSlug);
            if (polling) { clearInterval(polling); polling = null; }
          }
        })
        .catch(() => {});
    };

    fetchLead();
    // Poll every 3s until preview appears
    polling = setInterval(fetchLead, 3000);
    // Stop polling after 2 minutes max and show timeout message
    const maxTimeout = setTimeout(() => {
      if (polling) clearInterval(polling);
      if (!cartaReady) setTimedOut(true);
    }, 30000);

    return () => {
      if (polling) clearInterval(polling);
      clearTimeout(maxTimeout);
    };
  }, [leadId]);

  // Auto-dismiss modal 3s after carta is ready
  useEffect(() => {
    if (!cartaReady) return;
    const t = setTimeout(() => setModalDismissed(true), 1500);
    return () => clearTimeout(t);
  }, [cartaReady]);

  // Rotate hero image between preview dishes
  useEffect(() => {
    if (!modalDismissed) return;
    if (!preview?.sampleDishes?.length) return;
    const imgs = preview.sampleDishes.filter(d => d.imageUrl);
    if (imgs.length < 2) return;
    const interval = setInterval(() => setHeroIdx(i => (i + 1) % imgs.length), 4000);
    return () => clearInterval(interval);
  }, [preview, modalDismissed]);

  const rawName = preview?.restaurantName || localName || "Tu restaurante";
  const displayName = rawName.split("|")[0].split("-")[0].split("·")[0].split("—")[0].split("Pide")[0].split("Order")[0].trim();
  const hasPreviewDishes = preview?.sampleDishes && preview.sampleDishes.length > 0;

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

        {/* Steps — all done */}
        <section className="steps" aria-label="Progreso">
          <div className="step done"><div className="step-number">&#10003;</div><span>Subir carta</span></div>
          <div className="step-line" />
          <div className="step done"><div className="step-number">&#10003;</div><span>Transformación</span></div>
          <div className="step-line" />
          <div className="step active"><div className="step-number">3</div><span>Carta viva</span></div>
        </section>

        <section className="shell centered-shell">
          <div className="center-copy" key={modalDismissed ? "sent" : "prep"} style={{ animation: modalDismissed ? "phoneFadeIn 0.6s ease-out" : "none" }}>
            {modalDismissed ? (
              <>
                <h1><span style={{ fontSize: "0.6em" }}>✉️</span> Revisa tu <span>correo</span></h1>
                <p className="subcopy">Te enviamos las indicaciones{leadEmail ? ` a ${leadEmail}` : ""}.</p>
              </>
            ) : (
              <>
                <h1>{cartaReady
                  ? <><svg viewBox="0 0 24 24" fill="none" width="36" height="36" style={{ display: "inline", verticalAlign: "middle", marginRight: 8 }}><circle cx="12" cy="12" r="11" stroke="var(--amber-2)" strokeWidth="1.5"/><path d="M7.5 12.5l3 3 6-6.5" stroke="var(--amber-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>Tu experiencia está <span>lista</span></>
                  : timedOut ? <>Nos tomará un poco <span>más</span></>
                  : <>Tu carta ya está en <span>preparación</span></>
                }</h1>
                <p className="subcopy">{cartaReady ? "Creamos algo único para ti y tu restaurante." : timedOut ? "Tu carta necesita atención especial. Te avisaremos por correo cuando esté lista." : "En unos minutos recibirás un correo con tu carta lista."}</p>
              </>
            )}
          </div>

          {/* iPhone mockup with preview — or fallback message */}
          {hasPreviewDishes ? (
          <>
          <div className="phone-wrap phone-fadein">
            <div
              className={`phone phone-generating${cartaReady ? " phone-ready" : ""}`}
              style={{ position: "relative", cursor: cartaSlug ? "pointer" : "default" }}
              onClick={() => { if (cartaSlug) window.open(`/qr/${cartaSlug}`, "_blank"); }}
            >
              {/* Overlay message */}
              {!modalDismissed && (
              <div style={{ position: "absolute", inset: 0, zIndex: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 25, pointerEvents: "none", opacity: cartaReady ? 0 : 1, transition: "opacity 0.6s ease 1s" }} onTransitionEnd={() => { if (cartaReady) setModalDismissed(true); }}>
                <div style={{ background: "rgba(10,8,6,0.82)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", padding: "12px 18px", borderRadius: 16, textAlign: "center", maxWidth: "85%", border: "1px solid rgba(232,163,61,0.15)", boxShadow: "0 0 40px 10px rgba(0,0,0,0.5)", transition: "border-color 0.5s" }}>
                  {cartaReady ? (
                    <>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(232,163,61,0.15)", display: "grid", placeItems: "center", margin: "0 auto 4px" }}>
                        <svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M20 6L9 17l-5-5" stroke="var(--amber-2, #E8A33D)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                      <p style={{ fontSize: 15, fontWeight: 700, color: "var(--amber-2, #E8A33D)", margin: "0 0 3px", letterSpacing: "0.01em" }}>Lista</p>
                      <p style={{ fontSize: 11, color: "var(--cream, #F2E5CF)", margin: 0, opacity: 0.7 }}>Revisa tu correo</p>
                    </>
                  ) : (
                    <>
                      <img src="/genio-lamp.png" alt="" style={{ width: 36, height: 36, objectFit: "contain", display: "block", margin: "0 auto 1px", animation: "lampFloat 2.5s ease-in-out infinite" }} />
                      <p style={{ fontSize: 15, fontWeight: 700, color: "var(--cream, #F2E5CF)", margin: "0 0 3px", letterSpacing: "0.01em" }}>Casi lista</p>
                    </>
                  )}
                </div>
              </div>
              )}
              {/* Phone notch */}
              <div className="phone-notch" />

              {/* Phone screen — replicates dark mode carta lista exactly */}
              <div className="phone-screen">
                {/* Nav bar with logo */}
                <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 10px", background: "#0a0a0a", textAlign: "left" }}>
                  {preview?.logoUrl ? (
                    <img src={preview.logoUrl} alt="" style={{ width: 16, height: 16, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#F4A623", fontSize: 7, fontWeight: 700, color: "#0e0e0e", display: "grid", placeItems: "center", flexShrink: 0 }}>{displayName.charAt(0)}</div>
                  )}
                  <span style={{ fontSize: 10, fontWeight: 500, color: "rgba(255,255,255,0.9)", textAlign: "left" }}>{displayName}</span>
                  <div style={{ marginLeft: "auto", width: 14, height: 14, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
                    <svg viewBox="0 0 100 100" width="14" height="14"><defs><clipPath id="phflag"><circle cx="50" cy="50" r="50"/></clipPath></defs><g clipPath="url(#phflag)"><rect y="0" width="100" height="25" fill="#c60b1e"/><rect y="25" width="100" height="50" fill="#ffc400"/><rect y="75" width="100" height="25" fill="#c60b1e"/></g></svg>
                  </div>
                </div>

                {/* Hero — full photo, dish name centered, Ver button, dots */}
                <div className="ph-hero">
                  {(() => {
                    const imgs = preview?.sampleDishes?.filter(d => d.imageUrl) || [];
                    const heroImg = imgs[heroIdx % imgs.length]?.imageUrl;
                    return heroImg ? (
                      <img key={heroIdx} src={heroImg} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.08)", animation: "heroFade 0.4s ease" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #1a1610, #2a2218)" }} />
                    );
                  })()}
                  {/* Dark overlay */}
                  <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.2)" }} />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 0%, transparent 35%, rgba(0,0,0,0.6) 100%)" }} />
                  {/* Centered dish name + Ver button */}
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 2, padding: "0 10px" }}>
                    <span style={{ fontSize: 16, fontWeight: 900, color: "white", textAlign: "center", lineHeight: 1.1, textShadow: "0 1px 6px rgba(0,0,0,0.5)", fontFamily: "var(--font-display)" }}>{(() => { const imgs = preview?.sampleDishes?.filter(d => d.imageUrl) || []; return imgs[heroIdx % imgs.length]?.name || displayName; })()}</span>
                    <div style={{ marginTop: 5, padding: "3px 14px", borderRadius: 50, border: "1.5px solid rgba(255,255,255,0.5)", fontSize: 8, fontWeight: 500, color: "white" }}>Ver</div>
                    {/* Dots */}
                    <div style={{ display: "flex", gap: 3, marginTop: 6 }}>
                      <div style={{ width: 10, height: 3, borderRadius: 2, background: "#F4A623" }} />
                      <div style={{ width: 3, height: 3, borderRadius: 2, background: "rgba(244,166,35,0.35)" }} />
                      <div style={{ width: 3, height: 3, borderRadius: 2, background: "rgba(244,166,35,0.35)" }} />
                    </div>
                  </div>
                </div>

                {/* Dish cards */}
                <div className="ph-dishes">
                  {preview?.sampleDishes ? (
                    preview.sampleDishes.slice(0, 4).map((d, i) => (
                      <div key={i} className="ph-dish">
                        <div className="ph-dish-img">
                          {d.imageUrl ? (
                            <img src={d.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 5 }} />
                          ) : (
                            <div style={{ width: "100%", height: "100%", background: "#1a1a1a", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#555" }}>🍽</div>
                          )}
                        </div>
                        <div className="ph-dish-info">
                          <span className="ph-dish-name">{i === 2 && <span style={{ fontSize: 8, marginRight: 3 }}>⭐</span>}{d.name}</span>
                          {d.description && <span className="ph-dish-desc">{d.description.length > 35 ? d.description.slice(0, 35) + "…" : d.description}</span>}
                          <span className="ph-dish-price">${d.price.toLocaleString("es-CL")}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="ph-dish">
                        <div className="ph-dish-img"><div style={{ width: "100%", height: "100%", background: "#1a1a1a", borderRadius: 5, animation: "pulse 1.5s infinite" }} /></div>
                        <div className="ph-dish-info">
                          <span style={{ width: 70, height: 7, background: "#1a1a1a", borderRadius: 3, display: "block", animation: "pulse 1.5s infinite" }} />
                          <span style={{ width: 35, height: 7, background: "#1a1a1a", borderRadius: 3, display: "block", marginTop: 3, animation: "pulse 1.5s infinite" }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>

              </div>
            </div>
          </div>
          </>
          ) : (
          <div style={{ margin: "24px auto", maxWidth: 380, textAlign: "center", padding: "32px 20px", borderRadius: 20, background: "rgba(255,255,255,0.03)", border: "1px solid var(--line)" }}>
            <div style={{ fontSize: 40, marginBottom: 12, animation: "geniePulse 2s ease-in-out infinite" }}>🧞‍♂️ ✨</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--cream)", marginBottom: 8 }}>Preparando tu preview...</p>
            <div style={{ width: 40, height: 3, borderRadius: 2, background: "var(--amber)", margin: "12px auto 0", animation: "previewLoader 1.5s ease-in-out infinite" }} />
          </div>
          )}

          {/* Badge */}
          <div className="badges">
            <div className="badge">
              <div className="badge-icon">
                {modalDismissed ? (
                  <svg viewBox="0 0 24 24" fill="none" width="18" height="18"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" width="18" height="18"><rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="1.5"/><path d="M2 8l10 6 10-6" stroke="currentColor" strokeWidth="1.5"/></svg>
                )}
              </div>
              <div>
                <div className="badge-title">{modalDismissed ? "Tu carta está lista" : "Revisa tu correo"}</div>
                <div className="badge-sub">{modalDismissed ? "Si no la encuentras en tu correo, revisa la carpeta spam o promociones." : "Si no lo encuentras en unos minutos, revisa spam o promociones."}</div>
              </div>
            </div>
            {leadEmail && !editingEmail && (
              <div style={{ textAlign: "center", fontSize: 13, color: "var(--cream-2)", marginTop: 8 }}>
                Te lo enviamos a <strong style={{ color: "var(--cream)" }}>{leadEmail}</strong>
                {" · "}
                <button
                  onClick={() => { setEmailDraft(leadEmail); setEditingEmail(true); }}
                  style={{ background: "none", border: "none", color: "var(--amber-2)", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: 0, textDecoration: "underline" }}
                >
                  Corregir
                </button>
              </div>
            )}
            {editingEmail && (
              <div style={{ marginTop: 10, display: "flex", gap: 8, maxWidth: 360, margin: "10px auto 0", alignItems: "center" }}>
                <input
                  type="email"
                  autoFocus
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setSavingEmail(true);
                      fetch(`/api/subircarta/${leadId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ localName: localName || "Local", ownerName: "Dueño", email: emailDraft.trim() }),
                      }).then(() => { setLeadEmail(emailDraft.trim()); setEditingEmail(false); }).catch(() => {}).finally(() => setSavingEmail(false));
                    }
                    if (e.key === "Escape") setEditingEmail(false);
                  }}
                  style={{ flex: 1, height: 40, borderRadius: 10, border: "1px solid var(--line)", background: "rgba(0,0,0,.32)", color: "var(--cream)", padding: "0 12px", fontSize: 14, outline: "none" }}
                />
                <button
                  disabled={savingEmail}
                  onClick={() => {
                    setSavingEmail(true);
                    fetch(`/api/subircarta/${leadId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ localName: localName || "Local", ownerName: "Dueño", email: emailDraft.trim() }),
                    }).then(() => { setLeadEmail(emailDraft.trim()); setEditingEmail(false); }).catch(() => {}).finally(() => setSavingEmail(false));
                  }}
                  style={{ height: 40, padding: "0 16px", borderRadius: 10, border: "none", background: "var(--amber)", color: "#0e0e0e", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  {savingEmail ? "..." : "Guardar"}
                </button>
                <button
                  onClick={() => setEditingEmail(false)}
                  style={{ height: 40, padding: "0 12px", borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", fontSize: 13, cursor: "pointer" }}
                >
                  Cancelar
                </button>
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
h1 { font-family: var(--font-display); font-size: clamp(34px, 9vw, 52px); line-height: .94; font-weight: 500; letter-spacing: -.035em; margin-bottom: 14px; }
h1 span { color: var(--amber-2); font-style: italic; }
.subcopy { color: var(--cream-2); font-size: 15px; line-height: 1.45; margin: 0 auto 24px; max-width: 420px; }

/* iPhone mockup — replicates dark mode carta lista */
.phone-wrap { display: flex; justify-content: center; margin: 8px 0 24px; }
.phone-fadein { animation: phoneFadeIn 0.8s ease-out; }
@keyframes phoneFadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
@keyframes lampFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
@keyframes heroFade { from { opacity: 0; } to { opacity: 1; } }

.phone { width: 210px; border-radius: 28px; border: 3px solid rgba(255,255,255,.12); background: #0e0e0e; overflow: hidden; position: relative; box-shadow: 0 20px 50px rgba(0,0,0,.4); }
.phone-generating .phone-screen { filter: blur(0.8px); transition: filter 1.5s ease; }
.phone-generating .phone-notch { filter: blur(0.3px); transition: filter 1.5s ease; }
.phone-ready .phone-screen { filter: blur(0); }
.phone-ready .phone-notch { filter: blur(0); }
.phone-generating::before { content: ''; position: absolute; inset: 0; z-index: 9; border-radius: 25px; background: rgba(0,0,0,0.45); pointer-events: none; transition: background 1.5s ease; }
.phone-ready::before { background: rgba(0,0,0,0.1); }
.phone-notch { width: 80px; height: 12px; background: #000; border-radius: 0 0 10px 10px; margin: 0 auto; position: relative; z-index: 2; }
.phone-screen { background: #0e0e0e; }
.ph-hero { height: 130px; position: relative; overflow: hidden; }
.ph-dishes { padding: 0 10px; padding-top: 12px; display: flex; flex-direction: column; }
.ph-dish { display: flex; align-items: center; gap: 7px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,.06); }
.ph-dish:last-child { border-bottom: none; }
.ph-dish-img { width: 46px; height: 46px; border-radius: 6px; overflow: hidden; flex-shrink: 0; background: #1a1a1a; }
.ph-dish-info { display: flex; flex-direction: column; min-width: 0; gap: 2px; flex: 1; text-align: left; }
.ph-dish-name { font-size: 10px; font-weight: 700; color: #f0f0f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left; }
.ph-dish-desc { font-size: 8px; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left; line-height: 1.3; }
.ph-dish-price { font-size: 9px; color: #F4A623; font-weight: 400; }
.ph-stats { display: flex; justify-content: center; gap: 5px; padding: 8px 0 12px; font-size: 8.5px; color: #888; font-weight: 600; }

/* Badges */
.badges { display: flex; flex-direction: column; gap: 10px; max-width: 420px; margin: 36px auto 0; }
.badge { display: flex; align-items: flex-start; gap: 14px; padding: 16px 20px; border-radius: 16px; background: rgba(255,255,255,.03); border: 1px solid var(--line); text-align: left; }
.badge-icon { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; flex-shrink: 0; color: var(--amber-2); background: rgba(232,163,61,0.12); }
.badge-icon svg { color: var(--amber-2) !important; }
.badge-title { font-size: 15px; font-weight: 600; color: var(--cream); line-height: 1.2; }
.badge-sub { font-size: 14px; color: var(--muted); margin-top: 3px; line-height: 1.4; }

@keyframes pulse { 0%, 100% { opacity: .4; } 50% { opacity: .15; } }
@keyframes geniePulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
@keyframes previewLoader { 0% { width: 30px; opacity: 0.4; } 50% { width: 60px; opacity: 1; } 100% { width: 30px; opacity: 0.4; } }
@media (min-width: 860px) { .page { padding-top: 80px; } .steps { width: 560px; margin: 0 auto 36px; } .shell { padding: 46px; } .phone { width: 260px; } .ph-hero { height: 110px; } }
@media (max-width: 390px) { h1 { font-size: 32px; } .phone { width: 190px; } }
`;
