"use client";

import { useState, useEffect } from "react";

interface Props {
  restaurantName: string;
  restaurantSlug: string;
  restaurantLogo?: string | null;
  /** "carta" shows "Ver mi panel", "panel" shows "Ver mi carta" */
  context: "carta" | "panel";
  onActivate?: () => void;
}

/**
 * Slim banner for demo restaurants. Always visible at the top.
 * Shows in both carta and panel views when restaurant.isDemo is true.
 */
const TOTAL_ONBOARDING_STEPS = 5;

export default function DemoBanner({ restaurantName, restaurantSlug, restaurantLogo, context, onActivate }: Props) {
  const [showTip, setShowTip] = useState(false);
  const [highlight, setHighlight] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [onboardingActive, setOnboardingActive] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [lockedTooltip, setLockedTooltip] = useState<"panel" | "activar" | null>(null);

  // Show restaurant name when scrolled past hero
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Track onboarding active state via body attribute
  useEffect(() => {
    const check = () => setOnboardingActive(document.body.hasAttribute("data-demo-onboarding"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, { attributes: true, attributeFilter: ["data-demo-onboarding"] });
    return () => obs.disconnect();
  }, []);

  // Listen for onboarding step changes
  useEffect(() => {
    const onStep = (e: Event) => setOnboardingStep((e as CustomEvent).detail?.step ?? 0);
    window.addEventListener("demo-onboarding-step", onStep);
    return () => window.removeEventListener("demo-onboarding-step", onStep);
  }, []);

  // Listen for onboarding highlight
  useEffect(() => {
    const on = () => setHighlight(true);
    const off = () => setHighlight(false);
    window.addEventListener("demo-onboarding-highlight-activate", on);
    window.addEventListener("demo-onboarding-stop-highlight", off);
    return () => {
      window.removeEventListener("demo-onboarding-highlight-activate", on);
      window.removeEventListener("demo-onboarding-stop-highlight", off);
    };
  }, []);

  // Close locked tooltip on outside tap or after timeout
  useEffect(() => {
    if (!lockedTooltip) return;
    const close = () => setLockedTooltip(null);
    const autoClose = setTimeout(close, 3000);
    const t = setTimeout(() => window.addEventListener("pointerdown", close, { once: true }), 10);
    return () => { clearTimeout(t); clearTimeout(autoClose); window.removeEventListener("pointerdown", close); };
  }, [lockedTooltip]);

  // Close tooltips when onboarding step changes
  useEffect(() => { setLockedTooltip(null); }, [onboardingStep]);

  const stepsLeft = Math.max(0, TOTAL_ONBOARDING_STEPS - 1 - onboardingStep);
  const lockedMsg = `Completa el tour — ${stepsLeft === 1 ? "queda 1 paso" : `quedan ${stepsLeft} pasos`}`;

  const handleLockedClick = (btn: "panel" | "activar") => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLockedTooltip(prev => prev === btn ? null : btn);
  };

  return (
    <div
      data-demo-banner
      className="font-[family-name:var(--font-dm)]"
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 60,
        transform: "translate3d(0,0,0)", WebkitTransform: "translate3d(0,0,0)",
        padding: "18px 14px 18px",
        background: "rgba(7,7,7,.88)",
        backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
        boxShadow: "0 12px 30px rgba(0,0,0,.35)",
        overflow: "visible",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        {/* Left — DEMO badge + info tooltip */}
        <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 10 }}>
          <div
            onClick={() => setShowTip(s => !s)}
            style={{
              flex: "0 0 auto", height: 38, padding: "0 14px", borderRadius: 999,
              background: "rgba(255,178,45,.12)", border: "1px solid rgba(255,178,45,.2)",
              color: "#ffb22d", fontSize: 12, fontWeight: 950, letterSpacing: ".8px",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 5, position: "relative",
            }}
          >
            CARTA DEMO
            <span style={{ width: 14, height: 14, borderRadius: "50%", background: "rgba(255,178,45,.25)", display: "inline-grid", placeItems: "center", fontFamily: "Georgia, serif", fontSize: 9, fontWeight: 700, color: "#ffb22d" }}>i</span>
            {showTip && (
              <>
                <div onClick={(e) => { e.stopPropagation(); setShowTip(false); }} style={{ position: "fixed", inset: 0, zIndex: 69 }} />
                <div style={{
                  position: "absolute", top: "calc(100% + 8px)", left: 0,
                  background: "#1a1a1a", border: "1px solid rgba(255,178,45,0.3)", borderRadius: 10,
                  padding: "10px 14px", width: 220, zIndex: 70,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                }}>
                  <div style={{
                    position: "absolute", top: -5, left: 16,
                    width: 10, height: 10, background: "#1a1a1a", borderTop: "1px solid rgba(255,178,45,0.3)", borderLeft: "1px solid rgba(255,178,45,0.3)",
                    transform: "rotate(45deg)",
                  }} />
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", margin: 0, lineHeight: 1.5, fontWeight: 400, letterSpacing: 0 }}>
                    Esta es una vista previa de cómo se verá tu carta digital. Actívala para que tus clientes puedan verla.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>


        {/* Right — Actions */}
        <div style={{ flex: "0 0 auto", display: "flex", gap: 7 }}>
          {context === "carta" ? (
            <div style={{ position: "relative" }}>
              <a
                href={onboardingActive ? undefined : `/api/panel/demo-auth?slug=${restaurantSlug}`}
                onClick={onboardingActive ? handleLockedClick("panel") : undefined}
                className={onboardingActive ? undefined : "demo-nav-btn"}
                style={{
                  borderRadius: 999,
                  height: 38, padding: "0 14px", fontSize: 14, fontWeight: 900,
                  background: onboardingActive ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.1)",
                  border: onboardingActive ? "1px solid rgba(255,255,255,.06)" : "1px solid rgba(255,255,255,.2)",
                  color: onboardingActive ? "rgba(255,255,255,.2)" : "rgba(255,255,255,.75)",
                  display: "flex", alignItems: "center", gap: 5, textDecoration: "none", whiteSpace: "nowrap",
                  cursor: onboardingActive ? "default" : "pointer",
                  opacity: onboardingActive ? 0.5 : 1,
                  transition: "all 0.15s ease",
                }}
              ><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: onboardingActive ? 0.4 : 1 }}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>Ver mi panel</a>
              {lockedTooltip === "panel" && (
                <div style={{
                  position: "absolute", top: "calc(100% + 8px)", right: 0,
                  background: "#1a1a1a", border: "1px solid rgba(255,178,45,0.25)", borderRadius: 10,
                  padding: "10px 14px", width: 220, zIndex: 70,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                  animation: "tooltipFadeIn 0.15s ease-out",
                }}>
                  <div style={{
                    position: "absolute", top: -5, right: 20,
                    width: 10, height: 10, background: "#1a1a1a", borderTop: "1px solid rgba(255,178,45,0.25)", borderLeft: "1px solid rgba(255,178,45,0.25)",
                    transform: "rotate(45deg)",
                  }} />
                  <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.8)", margin: 0, lineHeight: 1.5, fontWeight: 500, letterSpacing: 0 }}>
                    🧞 {lockedMsg}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <a
              href={`/qr/${restaurantSlug}`}
              className="demo-nav-btn"
              style={{
                border: "1px solid rgba(255,255,255,.2)", borderRadius: 999,
                height: 38, padding: "0 14px", fontSize: 14, fontWeight: 900,
                background: "rgba(255,255,255,.1)", color: "rgba(255,255,255,.75)",
                display: "flex", alignItems: "center", textDecoration: "none", whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
            >Ver mi carta</a>
          )}
          <div style={{ position: "relative" }}>
            <a
              href={onboardingActive ? undefined : `/activar/${restaurantSlug}`}
              onClick={onboardingActive ? handleLockedClick("activar") : undefined}
              className="demo-activar-btn"
              style={{
                border: 0, borderRadius: 999, height: 38, padding: "0 18px",
                fontSize: 14, fontWeight: 900,
                background: "linear-gradient(135deg, #c084fc, #a855f7)",
                color: "#fff",
                display: "flex", alignItems: "center", textDecoration: "none", whiteSpace: "nowrap",
                boxShadow: highlight
                  ? "0 0 0 3px rgba(168,85,247,0.4), 0 10px 24px rgba(168,85,247,.35)"
                  : "0 10px 24px rgba(168,85,247,.22)",
                animation: highlight ? "activatePulse 1.5s ease-in-out infinite" : undefined,
                transition: "box-shadow 0.3s ease, transform 0.1s ease, background 0.3s ease, color 0.3s ease",
                cursor: onboardingActive ? "default" : "pointer",
              }}
            >Activar →</a>
            {lockedTooltip === "activar" && (
              <div style={{
                position: "absolute", top: "calc(100% + 8px)", right: 0,
                background: "#1a1a1a", border: "1px solid rgba(255,178,45,0.25)", borderRadius: 10,
                padding: "10px 14px", width: 220, zIndex: 70,
                boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                animation: "tooltipFadeIn 0.15s ease-out",
              }}>
                <div style={{
                  position: "absolute", top: -5, right: 20,
                  width: 10, height: 10, background: "#1a1a1a", borderTop: "1px solid rgba(255,178,45,0.25)", borderLeft: "1px solid rgba(255,178,45,0.25)",
                  transform: "rotate(45deg)",
                }} />
                <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.8)", margin: 0, lineHeight: 1.5, fontWeight: 500, letterSpacing: 0 }}>
                  🧞 {lockedMsg}
                </p>
              </div>
            )}
          </div>
          {highlight && (
            <style>{`
              @keyframes activatePulse {
                0%, 100% { transform: scale(1); box-shadow: 0 0 0 3px rgba(168,85,247,0.4), 0 10px 24px rgba(168,85,247,.35); }
                50% { transform: scale(1.08); box-shadow: 0 0 0 6px rgba(168,85,247,0.2), 0 14px 30px rgba(168,85,247,.45); }
              }
              .demo-activar-btn:active { transform: scale(0.93) !important; }
            `}</style>
          )}
          <style>{`
            @keyframes tooltipFadeIn {
              from { opacity: 0; transform: translateY(-4px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .demo-nav-btn:active {
              background: rgba(232,163,61,.15) !important;
              border-color: rgba(232,163,61,.3) !important;
              color: #E8A33D !important;
            }
          `}</style>
        </div>
      </div>

      {/* Premium ribbon below */}
      <div style={{
        position: "absolute",
        bottom: 0, left: 0, right: 0,
        transform: "translateY(100%)",
        padding: "9px 14px",
        background: "linear-gradient(135deg, #c084fc, #a855f7)",
        textAlign: "center",
      }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>
          {context === "panel" ? "Así se verá tu panel" : "Actívala y muéstrasela al mundo"}
        </span>
        <span style={{ position: "absolute", right: 44, top: -5, width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderBottom: "6px solid #a855f7" }} />
      </div>
    </div>
  );
}
