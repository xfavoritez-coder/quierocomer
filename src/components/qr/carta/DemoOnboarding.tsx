"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { trackFunnelEventBySlug, beaconFunnelEvent } from "@/lib/funnelTracker";

interface Props {
  restaurantSlug: string;
  /** Whether the onboarding has been completed (from DB) */
  onboardingDone?: boolean;
  /** Whether all photos are referential (uploaded via PDF/photo, not scraped from link) */
  allPhotosReferential?: boolean;
  /** Whether some (but not all) dishes have Unsplash referential photos */
  hasReferentialPhotos?: boolean;
  /** Showcase mode: show onboarding on real restaurants with skip button, no DB writes */
  showcaseMode?: boolean;
  /** Restaurant name for showcase title */
  restaurantName?: string;
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
  /** Overlay style: default is solid, "vignette" uses radial gradient */
  overlayStyle?: "vignette";
}

const STEPS: Step[] = [
  {
    icon: "🧞",
    title: "¡Hola! Soy el Genio",
    body: "Te mostraré tu nueva carta en 4 pasos. ¿Listo?",
    showOverlay: true,
    overlayOpacity: 0.72,
    buttonLabel: "Sí, vamos",
  },
  {
    icon: "📸",
    title: "Así quedaría tu carta",
    body: "", // set dynamically based on allPhotosReferential
    showOverlay: false,
    buttonLabel: "Siguiente",
  },
  {
    icon: "✨",
    title: "¿Sin fotos? No hay problema",
    body: "Tienes 3 distintas vistas, esta se llama \"Esencial\", ideal para comenzar sin fotos pero con los poderes de una carta QR inteligente.",
    showOverlay: false,
    buttonLabel: "Siguiente",
  },
  {
    icon: "🎨",
    title: "Y esta vista se llama Impact",
    body: "Para destacar tus platos con fotos y un diseño visual que invita a pedir más.",
    showOverlay: false,
    buttonLabel: "Último paso",
  },
  {
    icon: "🌍",
    title: "Traduzco tu carta",
    body: "Tradujimos los primeros platos para que lo veas. Al activar, se traduce tu carta completa.",
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


export default function DemoOnboarding({ restaurantSlug, onboardingDone, allPhotosReferential, hasReferentialPhotos, showcaseMode, restaurantName }: Props) {
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
  const onboardingVisible = step >= 0 && !gone;
  useEffect(() => {
    if (onboardingVisible) {
      document.body.setAttribute("data-demo-onboarding", "true");
    } else {
      document.body.removeAttribute("data-demo-onboarding");
    }
    return () => { document.body.removeAttribute("data-demo-onboarding"); };
  }, [onboardingVisible]);

  // Start immediately (or resume from saved step after lang navigation)
  useEffect(() => {
    if (onboardingDone) return;
    if (showcaseMode && localStorage.getItem("qc_showcase_done")) return;
    const savedStep = sessionStorage.getItem("qc_onboarding_step");
    if (savedStep) {
      sessionStorage.removeItem("qc_onboarding_step");
      const restored = parseInt(savedStep, 10);
      if (!STEPS[restored]?.showOverlay) setMinimized(true);
      setStep(restored);
    } else {
      setStep(0);
      if (!showcaseMode) trackFunnelEventBySlug(restaurantSlug, "onboard_start");
    }
  }, [restaurantSlug, onboardingDone, showcaseMode]);

  // Cleanup timers
  useEffect(() => {
    return () => { timersRef.current.forEach(clearTimeout); };
  }, []);

  // Abandonment tracking — beacon on page close during onboarding
  // Skip if sessionStorage has qc_onboarding_step (= intentional reload for lang switch)
  useEffect(() => {
    if (showcaseMode || gone) return;
    const stepNames = ["intro", "fotos", "esencial", "impact", "idioma", "listo"];
    const handleVisibility = () => {
      if (document.visibilityState !== "hidden") return;
      if (sessionStorage.getItem("qc_onboarding_step")) return; // intentional reload, not abandonment
      if (step >= 0 && step < STEPS.length) {
        beaconFunnelEvent(restaurantSlug, "abandoned_onboarding", { atStep: step, stepName: stepNames[step] || `step_${step}` });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [step, gone, showcaseMode, restaurantSlug]);

  // Step enter actions
  useEffect(() => {
    if (step < 0 || step >= STEPS.length) return;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    // Broadcast current step to DemoBanner
    window.dispatchEvent(new CustomEvent("demo-onboarding-step", { detail: { step } }));
    // Auto-minimize on steps without overlay (so user sees the carta)
    if (!STEPS[step].showOverlay) {
      if (!minimized && !minimizing) {
        setMinimizing(true);
        setTimeout(() => { setMinimizing(false); setMinimized(true); }, 180);
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
      case 0: {
        // Intro — ensure dark mode
        localStorage.setItem("qc_theme_override", "dark");
        const initContainer = document.querySelector(".carta-dark, .carta-light");
        if (initContainer) { initContainer.classList.remove("carta-light"); initContainer.classList.add("carta-dark"); }
        break;
      }
      case 1:
        // In showcase mode, switch to lista view (no flash, it's the first view change)
        if (showcaseMode) {
          window.dispatchEvent(new CustomEvent("demo-onboarding-change-view", { detail: { view: "lista", noFlash: true } }));
        }
        // Scroll so the category nav sits at the top of the viewport
        delay(300, () => {
          const firstCat = document.querySelector("[id^='impact-cat-']") || document.querySelector("[id^='lista-cat-']") || document.querySelector("[id^='cat-']") || document.querySelector("[id^='esencial-cat-']");
          if (firstCat) {
            const top = firstCat.getBoundingClientRect().top + window.scrollY - 48;
            window.scrollTo({ top, behavior: "smooth" });
          } else {
            const catNav = document.querySelector("[data-category-nav]");
            if (catNav) {
              let el: HTMLElement | null = catNav as HTMLElement;
              let offset = 0;
              while (el) { offset += el.offsetTop; el = el.offsetParent as HTMLElement | null; }
              window.scrollTo({ top: offset, behavior: "smooth" });
            } else {
              window.scrollTo({ top: window.innerHeight * 0.8, behavior: "smooth" });
            }
          }
        });
        break;
      case 2: {
        // Change to Esencial view (light mode) — flash black (dark→light transition)
        localStorage.setItem("qc_theme_override", "light");
        const containerToLight = document.querySelector(".carta-dark, .carta-light");
        if (containerToLight) { containerToLight.classList.remove("carta-dark"); containerToLight.classList.add("carta-light"); }
        document.body.setAttribute("data-onboarding-flash", "black");
        window.dispatchEvent(new CustomEvent("demo-onboarding-change-view", { detail: { view: "esencial" } }));
        delay(400, () => { window.scrollTo({ top: 0, behavior: "smooth" }); document.body.removeAttribute("data-onboarding-flash"); });
        break;
      }
      case 3: {
        // Change to Impact view (dark mode) — flash white (light→dark transition)
        localStorage.setItem("qc_theme_override", "dark");
        const containerToDark = document.querySelector(".carta-dark, .carta-light");
        if (containerToDark) { containerToDark.classList.remove("carta-light"); containerToDark.classList.add("carta-dark"); }
        document.body.setAttribute("data-onboarding-flash", "white");
        window.dispatchEvent(new CustomEvent("demo-onboarding-change-view", { detail: { view: "impact" } }));
        delay(600, () => {
          const menu = document.querySelector("[data-section='menu']") || document.querySelector("[data-section='mood']");
          if (menu) menu.scrollIntoView({ behavior: "smooth", block: "start" });
          document.body.removeAttribute("data-onboarding-flash");
        });
        break;
      }
      case 4:
        // Navigate to English — show loading overlay while page reloads
        if (!window.location.search.includes("lang=en")) {
          const overlay = document.createElement("div");
          overlay.id = "onboarding-translating";
          overlay.style.cssText = "position:fixed;inset:0;z-index:9980;background:rgba(0,0,0,0.82);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;";
          overlay.innerHTML = '<span style="font-family:var(--font-dm,sans-serif);font-size:0.95rem;font-weight:600;color:rgba(255,255,255,0.35);letter-spacing:0.02em">Traduciendo carta…</span>';
          document.body.appendChild(overlay);
          delay(400, () => {
            sessionStorage.setItem("qc_onboarding_step", "4");
            const url = new URL(window.location.href);
            url.searchParams.set("lang", "en");
            window.location.href = url.toString();
          });
        }
        break;
      case 5:
        // Last step — restore Spanish, highlight activate
        if (window.location.search.includes("lang=")) {
          sessionStorage.setItem("qc_onboarding_step", "5");
          const url = new URL(window.location.href);
          url.searchParams.delete("lang");
          window.location.href = url.toString();
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
      if (!showcaseMode) {
        const stepNames = ["start", "fotos", "esencial", "impact", "idioma", "done"];
        trackFunnelEventBySlug(restaurantSlug, `onboard_step_${next}`, { stepName: stepNames[next] || `step_${next}` });
      }
      if (STEPS[next].showOverlay) { setMinimized(false); setMinimizing(false); }
      else if (!minimized) {
        setMinimizing(true);
        setTimeout(() => { setMinimizing(false); setMinimized(true); }, 180);
      }
      return next;
    });
  }, [showcaseMode, restaurantSlug]);

  const goBack = useCallback(() => {
    setStep(s => {
      if (s <= 0) return s;
      // If going back from translated step, restore Spanish
      if ((s === 4 || s === 5) && window.location.search.includes("lang=en")) {
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
    if (!showcaseMode) {
      markSeen();
      trackFunnelEventBySlug(restaurantSlug, "onboard_done");
    }
    if (showcaseMode) localStorage.setItem("qc_showcase_done", "1");
    cleanup();
    setExiting(true);
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
    if (showcaseMode) window.dispatchEvent(new Event("demo-onboarding-restore-view"));
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

  // Reduce top padding when ribbon is hidden during onboarding
  const globalOnboardingStyle = <style>{`
    body[data-demo-onboarding] .min-h-screen { padding-top: 0px !important; }
    body[data-demo-onboarding] [data-demo-banner] { display: none !important; }
  `}</style>;

  const baseStep = STEPS[Math.min(step, STEPS.length - 1)];
  // Showcase overrides: adapt copy for visitors from quierocomer.cl
  const current = showcaseMode ? {
    ...baseStep,
    ...(step === 0 && { title: `Recorre la carta de ${restaurantName || "un restaurante"}`, body: "Te muestro cómo es una carta QuieroComer.", buttonLabel: "Ver" }),
    ...(step === 1 && { title: "Así se ve una carta real" }),
    ...(step === 2 && { title: "¿Sin fotos? No hay problema", body: "Tienes 3 distintas vistas, esta se llama \"Esencial\", ideal para comenzar sin fotos pero con los poderes de una carta QR inteligente." }),
    ...(step === 3 && { title: "Y esta vista se llama Impact", body: "Para destacar tus platos con fotos y un diseño visual que invita a pedir más." }),
    ...(step === 4 && { title: "Traducimos la carta", body: "A varios idiomas. Por ejemplo, ahora está en inglés.", buttonLabel: "Finalizar" }),
    ...(step === 5 && { title: "Así es una carta QuieroComer", body: "Te dejo para que navegues por ella. Si me necesitas nuevamente, solo frota la lámpara.", buttonLabel: "Listo" }),
  } : baseStep;
  const stepBody = step === 1
    ? (showcaseMode
      ? "Todas sus secciones y categorías. Esta vista se llama \"Lista\"."
      : allPhotosReferential
        ? "Pusimos fotos referenciales en los primeros platos para que veas cómo se vería. Al activar, podrás subir tus propias fotos."
        : hasReferentialPhotos
          ? "Pusimos algunas fotos referenciales para que veas cómo se vería. Al activar, podrás subir las tuyas."
          : "Si algo no se guardó como está en tu carta actual, no te preocupes, esto es una muestra. Luego podrás editar desde tu panel.")
    : current.body;
  const isLast = step === STEPS.length - 1;

  // Exit animation target: bottom-right (where lamp will be)
  const exitTarget = typeof window !== "undefined"
    ? { x: window.innerWidth - 50, y: window.innerHeight - 90 }
    : { x: 300, y: 600 };

  // Toast always uses light style for contrast against dark carta
  const isLightStep = step >= 2;

  // ═══ Minimized state — FAB genio + toast above it ═══
  if (minimized) {
    return (
      <>
      {globalOnboardingStyle}
      {/* Vignette overlay in minimized state */}
      {current.overlayStyle === "vignette" && current.overlayOpacity && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9990,
          background: "radial-gradient(ellipse at center, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.45) 60%, rgba(0,0,0,0.65) 100%)",
          pointerEvents: "none",
        }} />
      )}
      <div style={{
        position: "fixed", right: 14, bottom: "calc(16px + env(safe-area-inset-bottom))", zIndex: 9999,
        display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10,
        opacity: exiting ? 0 : 1,
        transition: exiting ? "opacity 0.35s ease" : "none",
      }}>
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
            fontSize: "1rem", color: isLightStep ? "rgba(0,0,0,0.72)" : "rgba(255,255,255,0.45)",
            lineHeight: 1.45, margin: "6px 0 14px",
          }} dangerouslySetInnerHTML={{ __html: stepBody as string }} />

          {/* Bottom: step counter + dots + nav */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: isLightStep ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.35)", fontFamily: "system-ui, sans-serif" }}>{step >= 1 && step <= 4 ? `${step} de 4` : ""}</span>
              <div style={{ display: "flex", gap: 3 }}>
              {STEPS.map((_, i) => (
                <div key={i} style={{
                  width: i === step ? 10 : 4, height: 4, borderRadius: 2,
                  background: i === step ? (isLightStep ? "#c67b00" : "#ffb22d") : i < step ? (isLightStep ? "rgba(198,123,0,0.3)" : "rgba(255,178,45,0.3)") : (isLightStep ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)"),
                  transition: "all 0.2s ease",
                }} />
              ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              {showcaseMode && (
                <button onClick={triggerExit} style={{
                  borderRadius: 999, padding: "6px 12px",
                  background: "transparent",
                  border: isLightStep ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)",
                  color: isLightStep ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.35)",
                  fontSize: "0.78rem", fontWeight: 500, cursor: "pointer",
                  fontFamily: "var(--font-dm, sans-serif)",
                }}>Saltar</button>
              )}
              {step > 0 && (
                <button onClick={goBack} style={{
                  borderRadius: 999, padding: "6px 12px",
                  background: isLightStep ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.05)",
                  border: isLightStep ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.10)",
                  color: isLightStep ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.45)",
                  fontSize: "0.84rem", fontWeight: 600,
                  display: "flex", alignItems: "center", gap: 3, cursor: "pointer",
                  fontFamily: "var(--font-dm, sans-serif)",
                }}>Atrás</button>
              )}
              <button onClick={advance} style={{
                borderRadius: 999, padding: "6px 12px",
                background: isLightStep ? "rgba(243,163,51,0.12)" : "rgba(255,178,45,0.12)",
                border: isLightStep ? "1px solid rgba(243,163,51,0.3)" : "1px solid rgba(255,178,45,0.2)",
                color: isLightStep ? "#c67b00" : "#ffb22d", fontSize: "0.84rem", fontWeight: 700,
                display: "flex", alignItems: "center", gap: 3, cursor: "pointer",
                fontFamily: "var(--font-dm, sans-serif)",
              }}>{current.buttonLabel || "Siguiente"}</button>
            </div>
          </div>
        </div>

        {/* FAB genio — tap to bounce during onboarding */}
        <div
          onClick={(e) => {
            const el = e.currentTarget;
            el.style.animation = "none";
            void el.offsetWidth;
            el.style.animation = "genioBounce 0.4s ease, genioPulse 2s ease-in-out infinite 0.4s";
          }}
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
          @keyframes genioBounce {
            0% { transform: scale(1); }
            40% { transform: scale(1.35); }
            100% { transform: scale(1); }
          }
        `}</style>
      </div>
      </>
    );
  }

  // ═══ Expanded state ═══
  return (
    <>
      {globalOnboardingStyle}
      {/* Overlay — only on steps with showOverlay */}
      {(current.showOverlay || current.overlayOpacity) && !exiting && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9990,
          background: current.overlayStyle === "vignette"
            ? "radial-gradient(ellipse at center, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.45) 60%, rgba(0,0,0,0.65) 100%)"
            : `rgba(0,0,0,${current.overlayOpacity ?? 0.55})`,
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
          transition: exiting ? "all 0.25s cubic-bezier(0.6,0,1,0.7)" : minimizing ? "all 0.22s cubic-bezier(0.4,0,1,1)" : (dragging ? "none" : "box-shadow 0.2s ease"),
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
          fontSize: "1.1rem",
          color: "rgba(255,255,255,0.5)",
          lineHeight: 1.45,
          margin: "0 0 18px",
        }} dangerouslySetInnerHTML={{ __html: stepBody as string }} />

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
          {/* Step counter + Dots */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.35)", fontFamily: "system-ui, sans-serif" }}>{step >= 1 && step <= 4 ? `${step} de 4` : ""}</span>
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
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 6 }}>
            {showcaseMode && (
              <button
                onClick={(e) => { e.stopPropagation(); triggerExit(); }}
                style={{
                  background: "none",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 999,
                  padding: "8px 14px",
                  color: "rgba(255,255,255,0.35)",
                  fontSize: "0.82rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "var(--font-dm, sans-serif)",
                }}
              >
                Saltar
              </button>
            )}
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
                Atrás
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
              {current.buttonLabel || (isLast ? "Ok, gracias" : "Siguiente")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
