"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

interface Props {
  restaurantSlug: string;
  /** Whether the onboarding has been completed (from DB) */
  onboardingDone?: boolean;
}

interface Step {
  icon: string;
  title: string;
  body: string | React.ReactNode;
  showOverlay: boolean;
  /** Overlay opacity override (default 0.55) */
  overlayOpacity?: number;
  /** Custom button label for this step */
  buttonLabel?: string;
}

const STEPS: Step[] = [
  {
    icon: "🧞",
    title: "¡Hola! Soy el Genio",
    body: "Te mostraré en 3 pasos tu nueva carta. ¿Listo?",
    showOverlay: true,
    overlayOpacity: 0.72,
  },
  {
    icon: "📸",
    title: "Así quedaría",
    body: "Algunas fotos podrían ser referenciales, luego podrás editar todo desde tu panel.",
    showOverlay: false,
    overlayOpacity: 0.35,
    buttonLabel: "Siguiente",
  },
  {
    icon: "🎨",
    title: "Vista Impact",
    body: "Puedes cambiar de vistas para que tus clientes disfruten de una mejor experiencia.",
    showOverlay: false,
  },
  {
    icon: "🌍",
    title: "Traduzco tu carta",
    body: "Escoge cualquier idioma: español, inglés, portugués o los que quieras.",
    showOverlay: false,
    buttonLabel: "Finalizar",
  },
  {
    icon: "🧞",
    title: "Tu carta está lista",
    body: "Te dejo para que navegues en ella. Si me necesitas, solo frota la lámpara.",
    showOverlay: true,
    buttonLabel: "Listo",
  },
];


export default function DemoOnboarding({ restaurantSlug, onboardingDone }: Props) {
  const [step, setStep] = useState(-1);
  const [minimized, setMinimized] = useState(false);
  const [minimizing, setMinimizing] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [gone, setGone] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Drag state
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  // Initial position: centered, top 35% (more centered)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = Math.min(window.innerWidth, 340);
    setPos({ x: (window.innerWidth - w) / 2, y: window.innerHeight * 0.35 });
  }, []);

  // Signal onboarding active
  useEffect(() => {
    if (step >= 0 && !gone) {
      document.body.setAttribute("data-demo-onboarding", "true");
    } else {
      document.body.removeAttribute("data-demo-onboarding");
    }
    return () => { document.body.removeAttribute("data-demo-onboarding"); };
  }, [step, gone]);

  // Start immediately (or resume from saved step after lang navigation)
  useEffect(() => {
    if (onboardingDone) return;
    const savedStep = sessionStorage.getItem("qc_onboarding_step");
    if (savedStep) {
      sessionStorage.removeItem("qc_onboarding_step");
      const restored = parseInt(savedStep, 10);
      if (!STEPS[restored]?.showOverlay) setMinimized(true);
      setStep(restored);
    } else {
      setStep(0);
    }
  }, [restaurantSlug, onboardingDone]);

  // Cleanup timers
  useEffect(() => {
    return () => { timersRef.current.forEach(clearTimeout); };
  }, []);

  // Step enter actions
  useEffect(() => {
    if (step < 0 || step >= STEPS.length) return;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    // Auto-minimize on steps without overlay (so user sees the carta)
    if (!STEPS[step].showOverlay) {
      if (!minimized && !minimizing) {
        setMinimizing(true);
        setTimeout(() => { setMinimizing(false); setMinimized(true); }, 220);
      }
    }
    runStepEnter(step);
  }, [step]);

  const delay = (ms: number, fn: () => void) => {
    const t = setTimeout(fn, ms);
    timersRef.current.push(t);
  };

  const runStepEnter = (s: number) => {
    switch (s) {
      case 0:
        // Intro — nothing
        break;
      case 1:
        // Scroll down to show the first category and its dishes
        delay(300, () => {
          // Find the first category section (not the genio carousel)
          const firstCatSection = document.querySelector("[id^='impact-cat-']") || document.querySelector("[id^='lista-cat-']") || document.querySelector("[data-category-section]");
          if (firstCatSection) {
            const top = firstCatSection.getBoundingClientRect().top + window.scrollY - 120;
            window.scrollTo({ top, behavior: "smooth" });
          } else {
            window.scrollTo({ top: window.innerHeight * 0.8, behavior: "smooth" });
          }
        });
        break;
      case 2:
        // Change to Impact view
        window.dispatchEvent(new CustomEvent("demo-onboarding-change-view", { detail: { view: "impact" } }));
        delay(600, () => {
          const menu = document.querySelector("[data-section='menu']") || document.querySelector("[data-section='mood']");
          if (menu) menu.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        break;
      case 3:
        // Navigate to English — show loading overlay while page reloads
        if (!window.location.search.includes("lang=en")) {
          // Show translating overlay
          const overlay = document.createElement("div");
          overlay.id = "onboarding-translating";
          overlay.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.85);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;";
          overlay.innerHTML = `<span style="font-size:28px">🌍</span><span style="font-family:var(--font-dm,sans-serif);font-size:1rem;color:#fff;font-weight:600">Traduciendo carta...</span>`;
          document.body.appendChild(overlay);
          delay(400, () => {
            sessionStorage.setItem("qc_onboarding_step", "3");
            const url = new URL(window.location.href);
            url.searchParams.set("lang", "en");
            window.location.href = url.toString();
          });
        }
        break;
      case 4:
        // Last step — restore Spanish, highlight activate
        if (window.location.search.includes("lang=")) {
          const overlay = document.createElement("div");
          overlay.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.85);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;";
          overlay.innerHTML = `<span style="font-size:28px">🧞</span><span style="font-family:var(--font-dm,sans-serif);font-size:1rem;color:#fff;font-weight:600">Volviendo al español...</span>`;
          document.body.appendChild(overlay);
          sessionStorage.setItem("qc_onboarding_step", "4");
          const url = new URL(window.location.href);
          url.searchParams.delete("lang");
          delay(300, () => { window.location.href = url.toString(); });
          return;
        }
        window.dispatchEvent(new Event("demo-onboarding-highlight-activate"));
        setMinimized(false);
        break;
    }
  };

  const advance = useCallback(() => {
    setStep(s => {
      const next = s + 1;
      if (next >= STEPS.length) {
        triggerExit();
        return s;
      }
      if (STEPS[next].showOverlay) { setMinimized(false); setMinimizing(false); }
      else if (!minimized) {
        setMinimizing(true);
        setTimeout(() => { setMinimizing(false); setMinimized(true); }, 220);
      }
      return next;
    });
  }, []);

  const goBack = useCallback(() => {
    setStep(s => {
      if (s <= 0) return s;
      // If going back from translated step, restore Spanish
      if ((s === 3 || s === 4) && window.location.search.includes("lang=en")) {
        sessionStorage.setItem("qc_onboarding_step", String(s - 1));
        const url = new URL(window.location.href);
        url.searchParams.delete("lang");
        window.location.href = url.toString();
        return s;
      }
      const prev = s - 1;
      if (!STEPS[prev].showOverlay) setMinimized(true);
      else setMinimized(false);
      return prev;
    });
  }, []);

  const triggerExit = () => {
    markSeen();
    cleanup();
    setExiting(true);
    // Faster animation — genio swooshes into lamp position
    setTimeout(() => {
      setGone(true);
      window.dispatchEvent(new Event("demo-onboarding-show-fab"));
    }, 250);
  };

  const cleanup = () => {
    localStorage.removeItem("qr_diet");
    localStorage.removeItem("qr_restrictions");
    localStorage.removeItem("qc_theme_override");
    window.dispatchEvent(new Event("genio-updated"));
    window.dispatchEvent(new Event("demo-onboarding-restore-genio"));
    window.dispatchEvent(new Event("demo-onboarding-stop-highlight"));
    // If still in non-Spanish lang, navigate back
    if (window.location.search.includes("lang=") && !window.location.search.includes("lang=es")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("lang");
      window.history.replaceState({}, "", url.toString());
    }
  };

  const markSeen = () => {
    fetch("/api/demo-onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: restaurantSlug }),
    }).catch(() => {});
  };

  // ═══ Drag handlers ═══
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return; // Don't drag from buttons
    setDragging(true);
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const maxX = window.innerWidth - 60;
    const maxY = window.innerHeight - 60;
    setPos({
      x: Math.max(0, Math.min(maxX, e.clientX - dragOffset.current.x)),
      y: Math.max(0, Math.min(maxY, e.clientY - dragOffset.current.y)),
    });
  };

  const onPointerUp = () => { setDragging(false); };

  // ═══ Render ═══
  if (step < 0 || gone) return null;

  const current = STEPS[Math.min(step, STEPS.length - 1)];
  const isLast = step === STEPS.length - 1;

  // Exit animation target: bottom-right (where lamp will be)
  const exitTarget = typeof window !== "undefined"
    ? { x: window.innerWidth - 50, y: window.innerHeight - 90 }
    : { x: 300, y: 600 };

  // Toast always uses light style for contrast against dark carta
  const isLightStep = step >= 2;

  // ═══ Minimized state — FAB genio + toast above it ═══
  if (minimized && !exiting) {
    return (
      <div style={{ position: "fixed", right: 14, bottom: "calc(16px + env(safe-area-inset-bottom))", zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
        {/* Toast above FAB */}
        <div style={{
          background: isLightStep ? "rgba(255,255,255,0.97)" : "rgba(14,14,14,0.96)",
          border: isLightStep ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,178,45,0.15)",
          borderRadius: 16,
          padding: "18px 16px 16px",
          boxShadow: isLightStep ? "0 8px 28px rgba(0,0,0,0.12)" : "0 8px 28px rgba(0,0,0,0.5)",
          maxWidth: 300,
          width: 300,
          transition: "background 0.3s ease, border 0.3s ease, box-shadow 0.3s ease",
        }}>
          {/* Top row: title + expand */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <p style={{
              fontFamily: "var(--font-dm, sans-serif)",
              fontSize: "1rem", fontWeight: 700, color: isLightStep ? "#1a1a1a" : "#fff",
              margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {current.icon} {current.title}
            </p>
          </div>

          {/* Description */}
          <p style={{
            fontFamily: "var(--font-dm, sans-serif)",
            fontSize: "0.95rem", color: isLightStep ? "rgba(0,0,0,0.72)" : "rgba(255,255,255,0.45)",
            lineHeight: 1.45, margin: "6px 0 14px",
          }}>
            {current.body}
          </p>

          {/* Bottom: dots + nav */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 3 }}>
              {STEPS.map((_, i) => (
                <div key={i} style={{
                  width: i === step ? 10 : 4, height: 4, borderRadius: 2,
                  background: i === step ? (isLightStep ? "#c67b00" : "#ffb22d") : i < step ? (isLightStep ? "rgba(198,123,0,0.3)" : "rgba(255,178,45,0.3)") : (isLightStep ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)"),
                  transition: "all 0.2s ease",
                }} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              {step > 0 && (
                <button onClick={goBack} style={{
                  borderRadius: 999, padding: "6px 12px",
                  background: isLightStep ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.05)",
                  border: isLightStep ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.10)",
                  color: isLightStep ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.45)",
                  fontSize: "0.84rem", fontWeight: 600,
                  display: "flex", alignItems: "center", gap: 3, cursor: "pointer",
                  fontFamily: "var(--font-dm, sans-serif)",
                }}>← Atrás</button>
              )}
              <button onClick={advance} style={{
                borderRadius: 999, padding: "6px 12px",
                background: isLightStep ? "rgba(243,163,51,0.12)" : "rgba(255,178,45,0.12)",
                border: isLightStep ? "1px solid rgba(243,163,51,0.3)" : "1px solid rgba(255,178,45,0.2)",
                color: isLightStep ? "#c67b00" : "#ffb22d", fontSize: "0.84rem", fontWeight: 700,
                display: "flex", alignItems: "center", gap: 3, cursor: "pointer",
                fontFamily: "var(--font-dm, sans-serif)",
              }}>{current.buttonLabel || "Siguiente →"}</button>
            </div>
          </div>
        </div>

        {/* FAB genio — tap to expand full card */}
        <div
          onClick={() => setMinimized(false)}
          style={{
            width: 52, height: 52, borderRadius: "50%",
            background: "rgba(14,14,14,0.95)",
            border: "1px solid rgba(255,178,45,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            animation: "genioPulse 2s ease-in-out infinite",
          }}
        >
          <span style={{ fontSize: 22 }}>🧞</span>
        </div>

        <style>{`
          @keyframes genioPulse {
            0%, 100% { box-shadow: 0 4px 20px rgba(0,0,0,0.4); }
            50% { box-shadow: 0 4px 20px rgba(255,178,45,0.3); }
          }
        `}</style>
      </div>
    );
  }

  // ═══ Expanded state ═══
  return (
    <>
      {/* Overlay — only on steps with showOverlay */}
      {(current.showOverlay || current.overlayOpacity) && !exiting && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9990,
          background: `rgba(0,0,0,${current.overlayOpacity ?? 0.55})`,
          transition: "opacity 0.4s ease",
          pointerEvents: current.showOverlay ? "auto" : "none",
        }} />
      )}

      {/* Card */}
      <div
        ref={cardRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          position: "fixed",
          left: exiting ? exitTarget.x : minimizing ? (typeof window !== "undefined" ? window.innerWidth - 80 : 300) : pos.x,
          top: exiting ? exitTarget.y : minimizing ? (typeof window !== "undefined" ? window.innerHeight - 120 : 600) : pos.y,
          zIndex: 9999,
          width: Math.min(320, typeof window !== "undefined" ? window.innerWidth - 32 : 320),
          background: "rgba(14,14,14,0.97)",
          border: "1px solid rgba(255,178,45,0.15)",
          borderRadius: 18,
          padding: "14px 16px 12px",
          boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
          cursor: dragging ? "grabbing" : "grab",
          userSelect: "none",
          touchAction: "none",
          // Exit/minimize animations
          transform: exiting ? "scale(0.08) rotate(15deg)" : minimizing ? "scale(0.4)" : "scale(1)",
          opacity: exiting ? 0 : minimizing ? 0 : 1,
          transition: exiting ? "all 0.25s cubic-bezier(0.6,0,1,0.7)" : minimizing ? "all 0.3s cubic-bezier(0.4,0,1,1)" : (dragging ? "none" : "box-shadow 0.2s ease"),
        }}
      >
        {/* Header: genio icon + title + minimize */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 26, flexShrink: 0 }}>{current.icon}</span>
          <h3 style={{
            flex: 1,
            fontFamily: "var(--font-dm, sans-serif)",
            fontSize: "1.15rem",
            fontWeight: 800,
            color: "#fff",
            margin: 0,
          }}>
            {current.title}
          </h3>
        </div>

        {/* Body */}
        <p style={{
          fontFamily: "var(--font-dm, sans-serif)",
          fontSize: "1.05rem",
          color: "rgba(255,255,255,0.5)",
          lineHeight: 1.45,
          margin: "0 0 18px",
        }}>
          {current.body}
        </p>

        {/* Personalization badge */}
        {step === 3 && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            background: "rgba(255,178,45,0.08)", border: "1px solid rgba(255,178,45,0.2)",
            borderRadius: 999, padding: "4px 10px", marginBottom: 8,
          }}>
            <span style={{ fontSize: 12 }}>✨</span>
            <span style={{ fontSize: "0.82rem", color: "#ffb22d", fontWeight: 600 }}>Carta personalizada por dieta</span>
          </div>
        )}

        {/* Progress + Actions */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Dots */}
          <div style={{ display: "flex", gap: 4 }}>
            {STEPS.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === step ? 14 : 5,
                  height: 5,
                  borderRadius: 3,
                  background: i === step ? "#ffb22d" : i < step ? "rgba(255,178,45,0.3)" : "rgba(255,255,255,0.08)",
                  transition: "all 0.3s ease",
                }}
              />
            ))}
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 6 }}>
            {step > 0 && !isLast && (
              <button
                onClick={(e) => { e.stopPropagation(); goBack(); }}
                style={{
                  background: "none",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 999,
                  padding: "8px 14px",
                  color: "rgba(255,255,255,0.45)",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "var(--font-dm, sans-serif)",
                }}
              >
                ← Atrás
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); advance(); }}
              style={{
                background: isLast ? "linear-gradient(135deg, #ffc44f, #f3a333)" : "rgba(255,178,45,0.10)",
                border: isLast ? "none" : "1px solid rgba(255,178,45,0.22)",
                borderRadius: 999,
                padding: isLast ? "7px 14px" : "8px 16px",
                color: isLast ? "#1a0800" : "#ffb22d",
                fontSize: "0.88rem",
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "var(--font-dm, sans-serif)",
              }}
            >
              {current.buttonLabel || (isLast ? "Ok, gracias" : "Siguiente →")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
