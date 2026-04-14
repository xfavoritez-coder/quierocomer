"use client";
import { useEffect, useRef, useState } from "react";
import { useTimeTheme, getThemeByPeriod, applyThemeVars, THEMES } from "@/hooks/useTimeTheme";
import type { TimePeriod } from "@/hooks/useTimeTheme";
import { ThemeContext } from "@/contexts/ThemeContext";

const PERIOD_ORDER: TimePeriod[] = ["dia", "noche"];

const DEV_LABELS: Record<TimePeriod, string> = {
  dia:   "Día",
  noche: "Noche",
};

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const hookTheme    = useTimeTheme();
  const [forcedPeriod, setForcedPeriod] = useState<TimePeriod | null>(null);
  const activeTheme  = forcedPeriod ? getThemeByPeriod(forcedPeriod) : hookTheme;

  const [devVisible, setDevVisible] = useState(false);
  useEffect(() => {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      setDevVisible(true);
    }
  }, []);

  // Apply CSS vars silently when theme changes — no overlay/animation
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
    }
    applyThemeVars(activeTheme);
  }, [activeTheme]);

  function handleDevSelect(period: TimePeriod) {
    if (period === (forcedPeriod ?? hookTheme.period)) return;
    setForcedPeriod(period);
  }

  return (
    <ThemeContext.Provider value={activeTheme}>
      {children}

      {devVisible && (
        <DevPanel activePeriod={activeTheme.period} onSelect={handleDevSelect} />
      )}
    </ThemeContext.Provider>
  );
}

// ─── Dev Panel ───────────────────────────────────────────────────────────────

function DevPanel({
  activePeriod,
  onSelect,
}: {
  activePeriod: TimePeriod;
  onSelect: (p: TimePeriod) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{
      position: "fixed", bottom: "24px", right: "24px", zIndex: 10000,
      display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px",
    }}>
      {open && (
        <div style={{
          display: "flex", flexDirection: "column", gap: "4px",
          background: "rgba(5,3,8,0.97)",
          border: "1px solid rgba(232,168,76,0.25)",
          borderRadius: "16px", padding: "12px",
          backdropFilter: "blur(12px)",
          animation: "devPanelIn 200ms ease both",
          minWidth: "168px",
        }}>
          <p style={{
            fontFamily: "var(--font-cinzel)", fontSize: "0.68rem",
            letterSpacing: "0.25em", textTransform: "uppercase",
            color: "rgba(232,168,76,0.5)", textAlign: "center",
            padding: "0 4px 8px",
            borderBottom: "1px solid rgba(232,168,76,0.12)",
            marginBottom: "4px",
          }}>
            Simular período
          </p>
          {PERIOD_ORDER.map((period) => {
            const t        = THEMES[period];
            const isActive = period === activePeriod;
            return (
              <button
                key={period}
                onClick={() => { onSelect(period); setOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "10px 14px", borderRadius: "10px",
                  border: isActive ? `1px solid ${t.accent}80` : "1px solid rgba(255,255,255,0.06)",
                  background: isActive ? `${t.accent}18` : "transparent",
                  cursor: isActive ? "default" : "pointer",
                  width: "100%",
                }}
              >
                <span style={{ fontSize: "1.1rem" }}>{t.icon}</span>
                <span style={{
                  fontFamily: "var(--font-cinzel)", fontSize: "0.78rem",
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  color: isActive ? t.accent : "rgba(255,255,255,0.6)",
                  fontWeight: isActive ? 700 : 400,
                }}>
                  {DEV_LABELS[period]}
                </span>
                {isActive && (
                  <span style={{
                    marginLeft: "auto", width: "6px", height: "6px", flexShrink: 0,
                    borderRadius: "50%", background: t.accent,
                    boxShadow: `0 0 6px ${t.accent}`,
                  }} />
                )}
              </button>
            );
          })}
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        title="Panel de desarrollo — simular hora del día"
        style={{
          width: "44px", height: "44px", borderRadius: "50%",
          border: "1px solid rgba(232,168,76,0.3)",
          background: "rgba(5,3,8,0.9)",
          color: "rgba(232,168,76,0.7)",
          fontSize: "1.2rem", cursor: "pointer",
          backdropFilter: "blur(12px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {open ? "✕" : "🕐"}
      </button>

      <style>{`
        @keyframes devPanelIn {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
