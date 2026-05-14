"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Footer from "@/components/Footer";
import PlanesModal from "@/components/PlanesModal";

interface SampleDish {
  name: string;
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
  const [localName, setLocalName] = useState("");
  const [planesOpen, setPlanesOpen] = useState(false);

  useEffect(() => {
    if (!leadId) return;
    fetch(`/api/subircarta/${leadId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.preview) setPreview(data.preview);
        if (data.localName) setLocalName(data.localName);
      })
      .catch(() => {});
  }, [leadId]);

  const displayName = preview?.restaurantName || localName || "Tu restaurante";

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
          <div className="center-copy">
            <h1>Tu carta está en <span>preparación</span></h1>
            <p className="subcopy">En unos minutos recibirás un correo con la transformación de tu carta lista para ver y probar.</p>
          </div>

          {/* iPhone mockup with preview */}
          <div className="phone-wrap">
            <div className="phone">
              {/* Phone notch */}
              <div className="phone-notch" />

              {/* Phone screen */}
              <div className="phone-screen">
                {/* Mini header */}
                <div className="ph-header">
                  <div className="ph-logo" />
                  <span className="ph-name">{displayName}</span>
                </div>

                {/* Mini hero */}
                <div className="ph-hero">
                  {preview?.sampleDishes[0]?.imageUrl ? (
                    <img src={preview.sampleDishes[0].imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #1a1610, #2a2218)" }} />
                  )}
                  <div className="ph-hero-overlay">
                    <span className="ph-hero-title">{displayName}</span>
                  </div>
                </div>

                {/* Dish list preview */}
                <div className="ph-dishes">
                  {preview?.sampleDishes ? (
                    preview.sampleDishes.map((d, i) => (
                      <div key={i} className="ph-dish">
                        <div className="ph-dish-img">
                          {d.imageUrl ? (
                            <img src={d.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 6 }} />
                          ) : (
                            <div style={{ width: "100%", height: "100%", background: "#2a2218", borderRadius: 6 }} />
                          )}
                        </div>
                        <div className="ph-dish-info">
                          <span className="ph-dish-name">{d.name}</span>
                          <span className="ph-dish-price">${d.price.toLocaleString("es-CL")}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    // Skeleton
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="ph-dish">
                        <div className="ph-dish-img"><div style={{ width: "100%", height: "100%", background: "#2a2218", borderRadius: 6, animation: "pulse 1.5s infinite" }} /></div>
                        <div className="ph-dish-info">
                          <span style={{ width: 80, height: 8, background: "#2a2218", borderRadius: 4, display: "block", animation: "pulse 1.5s infinite" }} />
                          <span style={{ width: 40, height: 8, background: "#2a2218", borderRadius: 4, display: "block", marginTop: 4, animation: "pulse 1.5s infinite" }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Stats bar */}
                {preview && (
                  <div className="ph-stats">
                    <span>{preview.totalCategories} categorías</span>
                    <span>·</span>
                    <span>{preview.totalDishes} platos</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Badges */}
          <div className="badges">
            <div className="badge">
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M3 8l9-5 9 5v8l-9 5-9-5V8z" stroke="currentColor" strokeWidth="1.5"/><path d="M3 8l9 5 9-5M12 13v8" stroke="currentColor" strokeWidth="1.5"/></svg>
              Revisa tu correo en unos minutos
            </div>
            <div className="badge">
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke="currentColor" strokeWidth="1.5"/><path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              Si no lo ves, revisa spam o promociones
            </div>
            <div className="badge">
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Sin cuenta, sin compromiso
            </div>
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

/* iPhone mockup */
.phone-wrap { display: flex; justify-content: center; margin: 8px 0 24px; }
.phone { width: 220px; border-radius: 28px; border: 3px solid rgba(255,255,255,.12); background: #0e0c09; overflow: hidden; position: relative; box-shadow: 0 20px 50px rgba(0,0,0,.4); }
.phone-notch { width: 80px; height: 22px; background: #0e0c09; border-radius: 0 0 14px 14px; margin: 0 auto; position: relative; z-index: 2; }
.phone-screen { padding: 0; }
.ph-header { display: flex; align-items: center; gap: 6px; padding: 8px 12px; }
.ph-logo { width: 18px; height: 18px; border-radius: 50%; background: var(--amber); flex-shrink: 0; }
.ph-name { font-size: 10px; font-weight: 600; color: var(--cream); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ph-hero { height: 90px; position: relative; overflow: hidden; }
.ph-hero-overlay { position: absolute; inset: 0; background: linear-gradient(transparent 30%, rgba(0,0,0,.7)); display: flex; align-items: flex-end; padding: 8px 12px; }
.ph-hero-title { font-family: var(--font-display); font-size: 14px; font-weight: 600; color: white; text-shadow: 0 1px 4px rgba(0,0,0,.5); }
.ph-dishes { padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; }
.ph-dish { display: flex; align-items: center; gap: 8px; }
.ph-dish-img { width: 32px; height: 32px; border-radius: 6px; overflow: hidden; flex-shrink: 0; }
.ph-dish-info { display: flex; flex-direction: column; min-width: 0; }
.ph-dish-name { font-size: 9px; font-weight: 600; color: var(--cream); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ph-dish-price { font-size: 8px; color: var(--amber-2); font-weight: 600; }
.ph-stats { display: flex; justify-content: center; gap: 6px; padding: 8px 0 12px; font-size: 8px; color: var(--muted); font-weight: 600; }

/* Badges */
.badges { display: flex; flex-direction: column; gap: 8px; max-width: 400px; margin: 0 auto; }
.badge { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 12px; background: rgba(255,255,255,.03); border: 1px solid var(--line); font-size: 13px; color: var(--cream-2); text-align: left; }
.badge svg { color: var(--amber-2); flex-shrink: 0; }

@keyframes pulse { 0%, 100% { opacity: .4; } 50% { opacity: .15; } }
@media (min-width: 860px) { .page { padding-top: 80px; } .steps { width: 560px; margin: 0 auto 36px; } .shell { padding: 46px; } .phone { width: 260px; } .ph-hero { height: 110px; } }
@media (max-width: 390px) { h1 { font-size: 32px; } .phone { width: 190px; } }
`;
