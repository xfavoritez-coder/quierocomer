"use client";

import { useState, useEffect, useRef } from "react";
import { useCartaView, type CartaView } from "./hooks/useCartaView";
import { showViewTransition } from "./hooks/useViewTransition";

interface Props {
  restaurantId: string;
  restaurantSlug: string;
  defaultView?: string | null;
}

const VIEWS: { value: CartaView; name: string; icon: string; color: string }[] = [
  { value: "lista", name: "Lista", icon: "☰", color: "#3b82f6" },
  { value: "impact", name: "Impact", icon: "◆", color: "#a855f7" },
];

const ACCENT_COLORS = [
  { value: null, label: "Default", swatch: "#E8A33D" },
  { value: "#ef4444", label: "Rojo", swatch: "#ef4444" },
  { value: "#22c55e", label: "Verde", swatch: "#22c55e" },
  { value: "#3b82f6", label: "Azul", swatch: "#3b82f6" },
  { value: "#a855f7", label: "Morado", swatch: "#a855f7" },
  { value: "#ec4899", label: "Rosa", swatch: "#ec4899" },
];

function applyTheme(mode: "dark" | "light") {
  localStorage.setItem("qc_theme_override", mode);
  const el = document.querySelector(".carta-dark, .carta-light");
  if (el) {
    el.classList.remove("carta-dark", "carta-light");
    el.classList.add(mode === "dark" ? "carta-dark" : "carta-light");
  }
}

function applyAccent(color: string | null) {
  const el = document.querySelector(".carta-dark, .carta-light") as HTMLElement;
  const banner = document.querySelector("[data-demo-banner]") as HTMLElement;
  if (!el) return;
  if (!color) {
    el.classList.remove("carta-custom-accent");
    el.style.removeProperty("--carta-accent");
    el.style.removeProperty("--carta-detail-price");
    if (banner) {
      banner.style.removeProperty("--demo-btn-bg");
      banner.style.removeProperty("--demo-btn-color");
      banner.style.removeProperty("--demo-btn-shadow");
      banner.style.removeProperty("--demo-ribbon-bg");
      banner.style.removeProperty("--demo-ribbon-border");
    }
    return;
  }
  el.classList.add("carta-custom-accent");
  el.style.setProperty("--carta-accent", color);
  el.style.setProperty("--carta-detail-price", color);
  if (banner) {
    banner.style.setProperty("--demo-btn-bg", color);
    banner.style.setProperty("--demo-btn-color", "#0a0a0a");
    banner.style.setProperty("--demo-btn-shadow", `0 8px 20px ${color}35`);
    banner.style.setProperty("--demo-ribbon-bg", color);
    banner.style.setProperty("--demo-ribbon-border", `1px solid ${color}`);
  }
}

export default function DemoViewToast({ restaurantId, restaurantSlug, defaultView }: Props) {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(true);
  const { view, setView } = useCartaView(defaultView);
  const [selected, setSelected] = useState<number | null>(() => {
    const idx = VIEWS.findIndex(v => v.value === (defaultView || view || "lista"));
    return idx >= 0 ? idx : null;
  });
  const [isDark, setIsDark] = useState(true);
  const [accentIdx, setAccentIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // Wait for DemoFirstViewModal to close, then show FAB
  useEffect(() => {
    const key = `qc_view_toast_${restaurantSlug}`;
    if (localStorage.getItem(key)) { setReady(true); return; }

    const modalKey = `qc_first_view_${restaurantSlug}`;
    if (localStorage.getItem(modalKey)) {
      setTimeout(() => { setReady(true); setOpen(true); localStorage.setItem(key, "1"); }, 600);
      return;
    }
    const interval = setInterval(() => {
      if (localStorage.getItem(modalKey)) {
        clearInterval(interval);
        setTimeout(() => { setReady(true); setOpen(true); localStorage.setItem(key, "1"); }, 500);
      }
    }, 300);
    setTimeout(() => { clearInterval(interval); setReady(true); setOpen(true); localStorage.setItem(key, "1"); }, 5000);
  }, [restaurantSlug]);

  // Detect initial theme
  useEffect(() => {
    const el = document.querySelector(".carta-dark, .carta-light");
    if (el) setIsDark(el.classList.contains("carta-dark"));
  }, [ready]);

  // Close on outside tap
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = (i: number) => {
    setSelected(i);
    const v = VIEWS[i];
    if (v.value !== view) {
      showViewTransition(v.name, v.value);
      setView(v.value);
      import("./utils/cartaAnalytics").then(({ trackCartaViewSelected }) => {
        trackCartaViewSelected(restaurantId, v.value, view);
      }).catch(() => {});
    }
  };

  const toggleTheme = () => {
    const next = isDark ? "light" : "dark";
    setIsDark(!isDark);
    applyTheme(next);
  };

  const handleAccent = (i: number) => {
    setAccentIdx(i);
    applyAccent(ACCENT_COLORS[i].value);
  };

  if (!ready) return null;

  const accentColor = ACCENT_COLORS[accentIdx].swatch;

  // Collapsed FAB
  if (!open) return (
    <button onClick={() => setOpen(true)} style={{
      position: "fixed", bottom: 20, right: 16, zIndex: 90,
      width: 62, height: 62, borderRadius: "50%",
      background: "rgba(18,18,18,.95)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
      border: `1.5px solid ${accentColor}40`,
      boxShadow: `0 4px 20px rgba(0,0,0,.4), 0 0 12px ${accentColor}15`,
      cursor: "pointer", display: "grid", placeItems: "center", fontSize: 20,
      animation: "demoFabIn .3s ease",
    }}>
      <style>{`
        @keyframes demoFabIn { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes demoPanelIn { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
      🎨
    </button>
  );

  // Expanded panel
  return (
    <div ref={ref} style={{
      position: "fixed", bottom: 20, right: 16, zIndex: 90,
      background: "rgba(18,18,18,.96)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
      borderRadius: 20, padding: "14px 16px", width: 200,
      border: "1px solid #2a2a2a",
      boxShadow: "0 8px 30px rgba(0,0,0,.5)",
      animation: "demoPanelIn .25s ease",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <style>{`
        @keyframes demoPanelIn { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#888", letterSpacing: ".02em" }}>Cambia el diseño</span>
        <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "#aaa", fontSize: 16, cursor: "pointer", padding: "2px 4px", lineHeight: 1 }}>✕</button>
      </div>

      {/* Views */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 }}>
        {VIEWS.map((v, i) => {
          const isActive = selected === i;
          return (
            <button key={v.value} onClick={() => handleSelect(i)} style={{
              padding: "8px 12px", borderRadius: 10, cursor: "pointer",
              background: isActive ? `${v.color}20` : "#1a1a1a",
              border: `1px solid ${isActive ? `${v.color}40` : "#2a2a2a"}`,
              color: isActive ? v.color : "#999",
              fontSize: 12, fontWeight: 600, textAlign: "left",
              display: "flex", alignItems: "center", gap: 8,
              transition: "all .15s",
            }}>
              <span style={{ fontSize: 16 }}>{v.icon}</span> Vista {v.name}
            </button>
          );
        })}
      </div>

      {/* Dark/Light toggle */}
      <button onClick={toggleTheme} style={{
        width: "100%", padding: "8px 0", borderRadius: 10, cursor: "pointer",
        background: "#1a1a1a", border: "1px solid #2a2a2a",
        fontSize: 12, fontWeight: 600, color: "#bbb",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        marginBottom: 12, transition: "all .15s",
      }}>
        {isDark ? "🌙" : "☀️"} {isDark ? "Dark" : "Light"}
      </button>

      {/* Accent colors */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
        {ACCENT_COLORS.map((c, i) => (
          <button key={i} onClick={() => handleAccent(i)} style={{
            width: 22, height: 22, borderRadius: "50%",
            background: c.swatch,
            border: accentIdx === i ? "2px solid #fff" : "2px solid transparent",
            boxShadow: accentIdx === i ? `0 0 8px ${c.swatch}50` : "none",
            cursor: "pointer", padding: 0,
            transition: "all .15s",
          }} />
        ))}
      </div>
    </div>
  );
}
