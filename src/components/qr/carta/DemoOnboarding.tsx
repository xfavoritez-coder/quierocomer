"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Props {
  restaurantSlug: string;
}

interface Step {
  icon: string;
  title: string;
  body: string;
  showOverlay: boolean;
}

const STEPS: Step[] = [
  {
    icon: "🧞",
    title: "¡Hola! Soy el Genio",
    body: "Te voy a mostrar en 4 pasos tu nueva carta.",
    showOverlay: true,
  },
  {
    icon: "📸",
    title: "Una preview",
    body: "Algunas fotos son referenciales, las pusimos para que puedas ver cómo se verá tu carta. Luego las editas desde tu panel.",
    showOverlay: true,
  },
  {
    icon: "🎨",
    title: "Vista Impact",
    body: "Puedes cambiar de vistas para que tus clientes disfruten de una mejor experiencia.",
    showOverlay: false,
  },
  {
    icon: "🧠",
    title: "Aprendo de cada cliente",
    body: "Le agrupo los platos de su tipo de dieta para que decida mejor y más rápido.",
    showOverlay: false,
  },
  {
    icon: "🌍",
    title: "Traduzco tu carta a varios idiomas",
    body: "La carta se traduce automáticamente al idioma de la persona. Así la ven extranjeros y turistas.",
    showOverlay: false,
  },
  {
    icon: "👋",
    title: "¡Nos vemos!",
    body: "Cuando me necesites, solo frota la lámpara. Si estás listo, presiona 'Activar' arriba.",
    showOverlay: true,
  },
];

const STORAGE_KEY = "qc_onboarding_seen";

export default function DemoOnboarding({ restaurantSlug }: Props) {
  const [step, setStep] = useState(-1);
  const [minimized, setMinimized] = useState(false);
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
    const seen = localStorage.getItem(STORAGE_KEY);
    if (seen?.includes(restaurantSlug)) return;
    const savedStep = sessionStorage.getItem("qc_onboarding_step");
    if (savedStep) {
      sessionStorage.removeItem("qc_onboarding_step");
      setStep(parseInt(savedStep, 10));
    } else {
      setStep(0);
    }
  }, [restaurantSlug]);

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
      setMinimized(true);
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
        // Scroll down to show the dish cards
        delay(300, () => {
          const firstCategory = document.querySelector("[data-category-section]") || document.querySelector("[data-section='menu']");
          if (firstCategory) firstCategory.scrollIntoView({ behavior: "smooth", block: "start" });
          else window.scrollTo({ top: window.innerHeight * 0.6, behavior: "smooth" });
        });
        break;
      case 2:
        // Change to Impact view with a smooth feel
        window.dispatchEvent(new CustomEvent("demo-onboarding-change-view", { detail: { view: "impact" } }));
        delay(600, () => {
          const menu = document.querySelector("[data-section='menu']") || document.querySelector("[data-section='mood']");
          if (menu) menu.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        break;
      case 3:
        // Simulate vegetarian genio
        localStorage.setItem("qr_diet", "vegetarian");
        localStorage.setItem("qr_restrictions", JSON.stringify(["ninguna"]));
        window.dispatchEvent(new CustomEvent("demo-onboarding-simulate-genio", { detail: { diet: "VEGETARIAN" } }));
        window.dispatchEvent(new Event("genio-updated"));
        delay(600, () => {
          const carousel = document.getElementById("genio-vegetarian-carousel") || document.getElementById("genio-vegan-carousel") || document.getElementById("genio-diet-message");
          if (carousel) carousel.scrollIntoView({ behavior: "smooth", block: "center" });
          else window.scrollTo({ top: 0, behavior: "smooth" });
        });
        break;
      case 4:
        // Restore genio, change language for real via URL navigation
        window.dispatchEvent(new Event("demo-onboarding-restore-genio"));
        localStorage.removeItem("qr_diet");
        localStorage.removeItem("qr_restrictions");
        window.dispatchEvent(new Event("genio-updated"));
        // Only navigate if not already in English
        if (!window.location.search.includes("lang=en")) {
          delay(300, () => {
            sessionStorage.setItem("qc_onboarding_step", "4");
            const url = new URL(window.location.href);
            url.searchParams.set("lang", "en");
            window.location.href = url.toString();
          });
        }
        break;
      case 5:
        // Last step — restore Spanish via replaceState (no reload), highlight activate
        if (window.location.search.includes("lang=")) {
          const url = new URL(window.location.href);
          url.searchParams.delete("lang");
          window.history.replaceState({}, "", url.toString());
        }
        window.dispatchEvent(new Event("demo-onboarding-highlight-activate"));
        // Expand for the farewell
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
      return next;
    });
  }, []);

  const goBack = useCallback(() => {
    setStep(s => {
      if (s <= 0) return s;
      if (s === 3) {
        localStorage.removeItem("qr_diet");
        localStorage.removeItem("qr_restrictions");
        window.dispatchEvent(new Event("genio-updated"));
        window.dispatchEvent(new Event("demo-onboarding-restore-genio"));
      }
      // If going back from lang step (in English), navigate to Spanish
      if ((s === 4 || s === 5) && window.location.search.includes("lang=en")) {
        sessionStorage.setItem("qc_onboarding_step", String(s - 1));
        const url = new URL(window.location.href);
        url.searchParams.delete("lang");
        window.location.href = url.toString();
        return s;
      }
      return s - 1;
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
    }, 450);
  };

  const cleanup = () => {
    localStorage.removeItem("qr_diet");
    localStorage.removeItem("qr_restrictions");
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
    const seen = localStorage.getItem(STORAGE_KEY) || "";
    localStorage.setItem(STORAGE_KEY, seen ? `${seen},${restaurantSlug}` : restaurantSlug);
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
    ? { x: window.innerWidth - 50, y: window.innerHeight - 60 }
    : { x: 300, y: 600 };

  // ═══ Minimized state — FAB genio + toast above it ═══
  if (minimized && !exiting) {
    return (
      <div style={{ position: "fixed", right: 14, bottom: "calc(16px + env(safe-area-inset-bottom))", zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
        {/* Toast above FAB */}
        <div style={{
          background: "rgba(14,14,14,0.96)",
          border: "1px solid rgba(255,178,45,0.15)",
          borderRadius: 14,
          padding: "10px 12px",
          boxShadow: "0 8px 28px rgba(0,0,0,0.5)",
          maxWidth: 260,
          width: 260,
        }}>
          {/* Top row: title + expand */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <p style={{
              fontFamily: "var(--font-dm, sans-serif)",
              fontSize: "0.82rem", fontWeight: 700, color: "#fff",
              margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {current.icon} {current.title}
            </p>
            <button onClick={() => setMinimized(false)} style={{
              width: 22, height: 22, borderRadius: 6,
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.45)", fontSize: 10,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0, marginLeft: 6,
            }}>⤢</button>
          </div>

          {/* Description */}
          <p style={{
            fontFamily: "var(--font-dm, sans-serif)",
            fontSize: "0.78rem", color: "rgba(255,255,255,0.45)",
            lineHeight: 1.45, margin: "0 0 8px",
          }}>
            {current.body}
          </p>

          {/* Bottom: dots + nav */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 3 }}>
              {STEPS.map((_, i) => (
                <div key={i} style={{
                  width: i === step ? 10 : 4, height: 4, borderRadius: 2,
                  background: i === step ? "#ffb22d" : i < step ? "rgba(255,178,45,0.3)" : "rgba(255,255,255,0.08)",
                  transition: "all 0.2s ease",
                }} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {step > 0 && (
                <button onClick={goBack} style={{
                  width: 26, height: 26, borderRadius: "50%",
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.4)", fontSize: 11,
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                }}>←</button>
              )}
              <button onClick={advance} style={{
                width: 26, height: 26, borderRadius: "50%",
                background: "rgba(255,178,45,0.12)", border: "1px solid rgba(255,178,45,0.2)",
                color: "#ffb22d", fontSize: 11,
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}>→</button>
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
      {/* Overlay — only on intro and last step */}
      {current.showOverlay && !exiting && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9990,
          background: "rgba(0,0,0,0.55)",
          transition: "opacity 0.3s ease",
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
          left: exiting ? exitTarget.x : pos.x,
          top: exiting ? exitTarget.y : pos.y,
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
          // Exit animation — swoosh into lamp
          transform: exiting ? "scale(0.08) rotate(15deg)" : "scale(1)",
          opacity: exiting ? 0 : 1,
          transition: exiting ? "all 0.4s cubic-bezier(0.6,0,1,0.7)" : (dragging ? "none" : "box-shadow 0.2s ease"),
        }}
      >
        {/* Header: genio icon + title + minimize */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>{current.icon}</span>
          <h3 style={{
            flex: 1,
            fontFamily: "var(--font-dm, sans-serif)",
            fontSize: "0.85rem",
            fontWeight: 800,
            color: "#fff",
            margin: 0,
          }}>
            {current.title}
          </h3>
          {!isLast && (
            <button
              onClick={(e) => { e.stopPropagation(); setMinimized(true); }}
              style={{
                width: 24, height: 24, borderRadius: 6,
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.4)", fontSize: 14, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", flexShrink: 0,
              }}
            >
              —
            </button>
          )}
        </div>

        {/* Body */}
        <p style={{
          fontFamily: "var(--font-dm, sans-serif)",
          fontSize: "0.78rem",
          color: "rgba(255,255,255,0.5)",
          lineHeight: 1.45,
          margin: "0 0 10px",
        }}>
          {current.body}
        </p>

        {/* Vegetarian badge */}
        {step === 3 && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)",
            borderRadius: 999, padding: "3px 9px", marginBottom: 8,
          }}>
            <span style={{ fontSize: 11 }}>🥬</span>
            <span style={{ fontSize: "0.68rem", color: "#4ade80", fontWeight: 600 }}>Platos vegetarianos primero</span>
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
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 999,
                  padding: "6px 12px",
                  color: "rgba(255,255,255,0.35)",
                  fontSize: "0.72rem",
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
                background: isLast ? "linear-gradient(135deg, #ffc44f, #f3a333)" : "rgba(255,178,45,0.08)",
                border: isLast ? "none" : "1px solid rgba(255,178,45,0.18)",
                borderRadius: 999,
                padding: "6px 14px",
                color: isLast ? "#100b03" : "#ffb22d",
                fontSize: "0.72rem",
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "var(--font-dm, sans-serif)",
              }}
            >
              {isLast ? "¡Nos vemos! 👋" : "Siguiente →"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
