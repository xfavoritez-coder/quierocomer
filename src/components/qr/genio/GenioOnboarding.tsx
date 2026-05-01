"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { Dish, Category } from "@prisma/client";
import {
  X, UtensilsCrossed, Leaf, Sprout, Fish,
  Check, Ban, Wheat, Milk, Flame,
  Sparkles, ChevronLeft,
} from "lucide-react";
import { useLang } from "@/contexts/LangContext";
import { t } from "@/lib/qr/i18n";

interface GenioProps {
  restaurantId: string;
  dishes: Dish[];
  categories: Category[];
  onClose: () => void;
  onResult: (dish: Dish) => void;
  qrUser?: { name: string | null; email: string } | null;
  restaurantDietType?: string | null;
}

type DietType = "omnivore" | "vegetarian" | "vegan";

// ═══════════════════════════════════════════════════════
// DESIGN TOKENS
// ═══════════════════════════════════════════════════════
const G = {
  bg: "#0e0e0e",
  surface: "rgba(255,255,255,0.03)",
  surfaceHover: "rgba(255,255,255,0.06)",
  border: "rgba(255,255,255,0.10)",
  borderActive: "rgba(234,88,12,0.6)",

  // CTA
  ctaBg: "#F4A623",
  ctaText: "#0e0e0e",
  ctaShadow: "0 4px 14px rgba(244,166,35,0.35)",

  // Accents
  gold: "#fbbf24",
  goldLight: "#fde68a",
  goldText: "#fed7aa",
  orange: "#F4A623",

  // Selection states
  selectedBg: "rgba(234,88,12,0.10)",
  selectedBorder: "rgba(234,88,12,0.6)",

  // Semantic — veg
  vegBg: "rgba(34,197,94,0.15)",
  vegBorder: "rgba(34,197,94,0.6)",
  vegText: "#86efac",

  // Semantic — warn (dislikes)
  warnBg: "rgba(127,29,29,0.4)",
  warnBorder: "rgba(185,28,28,0.5)",
  warnText: "#fca5a5",

  // Text
  textPrimary: "#ffffff",
  textSecondary: "rgba(255,255,255,0.55)",
  textTertiary: "rgba(255,255,255,0.40)",
  textDisabled: "rgba(255,255,255,0.30)",

  // Dropdown
  dropdown: "#1a1a1a",
  dropdownBorder: "rgba(255,255,255,0.12)",
};

// CTA button style (reusable object, not a component — avoids prop drilling)
const CTA_STYLE: React.CSSProperties = {
  width: "100%", maxWidth: 320,
  background: G.ctaBg, color: G.ctaText,
  fontSize: "0.88rem", fontWeight: 700,
  padding: "14px 24px", borderRadius: 999, border: "none", cursor: "pointer",
  boxShadow: G.ctaShadow,
};

// ═══════════════════════════════════════════════════════
// AMBIENT COMPONENTS (deterministic — no hydration issues)
// ═══════════════════════════════════════════════════════
const SPARK_POSITIONS = [
  { top: "12%", left: "18%", delay: 0, size: 3, color: G.gold },
  { top: "28%", left: "78%", delay: 0.6, size: 2, color: "#f59e0b" },
  { top: "55%", left: "25%", delay: 1.2, size: 3, color: G.goldLight },
  { top: "72%", left: "70%", delay: 0.3, size: 2, color: G.gold },
  { top: "88%", left: "45%", delay: 1.8, size: 3, color: "#f59e0b" },
];

function AmbientHaze({ bottom }: { bottom?: boolean }) {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "50%",
        background: "radial-gradient(ellipse at 50% 30%, rgba(245,158,11,0.14) 0%, rgba(217,119,6,0.06) 30%, transparent 60%)",
      }} />
      {bottom && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: "50%",
          background: "radial-gradient(ellipse at 50% 70%, rgba(245,158,11,0.10) 0%, rgba(180,83,9,0.04) 40%, transparent 70%)",
        }} />
      )}
    </div>
  );
}

function AmbientSparks({ count = 5 }: { count?: number }) {
  return (
    <>
      {SPARK_POSITIONS.slice(0, count).map((s, i) => (
        <div key={i} style={{
          position: "absolute", top: s.top, left: s.left, width: s.size, height: s.size,
          borderRadius: "50%", background: s.color, boxShadow: `0 0 6px ${s.color}`,
          animation: `floatSpark ${2.5 + i * 0.2}s ease-in-out ${s.delay}s infinite`,
          pointerEvents: "none", zIndex: 1,
        }} />
      ))}
    </>
  );
}

const DIET_KEYS = {
  omnivore: "gCarnivore" as const,
  vegan: "gVegan" as const,
  vegetarian: "gVegetarian" as const,
};
const DIET_OPTIONS = [
  { icon: UtensilsCrossed, labelKey: "gCarnivore" as const, value: "omnivore" as DietType },
  { icon: Sprout, labelKey: "gVegan" as const, value: "vegan" as DietType },
  { icon: Leaf, labelKey: "gVegetarian" as const, value: "vegetarian" as DietType },
];

const RESTRICTION_ICON_MAP: Record<string, typeof Ban> = {
  lactosa: Milk, gluten: Wheat, mariscos: Fish,
};

type RestrictionOption = { icon: typeof Ban; label?: string; labelKey?: string; value: string };

import { getGuestId, getSessionId } from "@/lib/guestId";
import { getDbSessionId } from "@/lib/sessionTracker";

function trackStat(restaurantId: string, eventType: string, dishId?: string, genioSessionId?: string) {
  fetch("/api/qr/stats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, restaurantId, dishId, genioSessionId, guestId: getGuestId(), sessionId: getSessionId(), dbSessionId: getDbSessionId() }),
  }).catch(() => {});
}

// ═══════════════════════════════════════════════════════
// HELPERS — diet color by type
// ═══════════════════════════════════════════════════════
function getDietColors(value: DietType, sel: boolean) {
  if (!sel) return { bg: G.surface, border: `0.5px solid ${G.border}`, color: G.textSecondary };
  if (value === "vegan" || value === "vegetarian") return { bg: G.vegBg, border: `1px solid ${G.vegBorder}`, color: G.vegText };
  return { bg: G.selectedBg, border: `1px solid ${G.selectedBorder}`, color: G.goldText };
}


export default function GenioOnboarding({ restaurantId, dishes, categories, onClose, onResult, qrUser: qrUserProp, restaurantDietType }: GenioProps) {
  const lang = useLang();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const genioSessionId = useRef(crypto.randomUUID()).current;

  // Load saved preferences from localStorage
  const savedDiet = typeof window !== "undefined" ? localStorage.getItem("qr_diet") : null;
  const savedRestrictions = typeof window !== "undefined" ? localStorage.getItem("qr_restrictions") : null;
  const savedDislikes = typeof window !== "undefined" ? localStorage.getItem("qr_dislikes") : null;
  const hasSaved = !!(savedDiet && savedRestrictions);

  const userName = qrUserProp?.name?.split(" ")[0] || null;

  // Load restrictions/allergens dynamically from DB
  const [restrictionOptions, setRestrictionOptions] = useState<RestrictionOption[]>([
    { icon: Check, labelKey: "gNone" as const, value: "ninguna" },
  ]);
  useEffect(() => {
    fetch("/api/qr/restrictions").then(r => r.json()).then((items: { name: string; type: string }[]) => {
      const opts: RestrictionOption[] = [
        { icon: Check, labelKey: "gNone" as const, value: "ninguna" },
        { icon: Flame, labelKey: "gWithoutSpicy" as const, value: "_spicy" },
      ];
      const nutNames = ["maní", "nueces", "almendras"];
      let hasNuts = false;
      for (const item of items) {
        // Skip alcohol
        if (item.name === "alcohol") continue;
        // Unify nuts into "frutos secos"
        if (nutNames.includes(item.name)) {
          if (!hasNuts) {
            hasNuts = true;
            opts.push({ icon: Ban, label: "Sin frutos secos", value: "frutos secos" });
          }
          continue;
        }
        opts.push({
          icon: RESTRICTION_ICON_MAP[item.name] || Ban,
          label: `Sin ${item.name}`,
          value: item.name,
        });
      }
      setRestrictionOptions(opts);
    }).catch(() => {});
  }, []);

  // Wizard state — save initial values to detect changes in profile mode
  const initialDiet = useRef(savedDiet);
  const initialRestrictions = useRef(savedRestrictions);
  const initialDislikes = useRef(savedDislikes);
  const [dietType, setDietType] = useState<DietType | null>(savedDiet as DietType | null);
  const [restrictions, setRestrictions] = useState<string[]>(savedRestrictions ? JSON.parse(savedRestrictions) : []);
  const [dislikes, setDislikes] = useState<string[]>(savedDislikes ? JSON.parse(savedDislikes) : []);
  const [popularDislikes, setPopularDislikes] = useState<string[]>([]);
  const [dislikeI18n, setDislikeI18n] = useState<Record<string, { en?: string; pt?: string }>>({});
  const [dislikeSearch, setDislikeSearch] = useState("");
  const [dislikeResults, setDislikeResults] = useState<string[]>([]);
  const [showAddRestriction, setShowAddRestriction] = useState(false);
  const [showAddDislike, setShowAddDislike] = useState(false);
  const [birthday, setBirthday] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showDislikeInfo, setShowDislikeInfo] = useState(false);
  const [dislikeInputFocused, setDislikeInputFocused] = useState(false);
  const [profileDislikeFocused, setProfileDislikeFocused] = useState(false);

  // Load popular dislikes
  useEffect(() => {
    fetch("/api/qr/dislikes").then(r => r.json()).then(d => {
      if (d.popular) setPopularDislikes(d.popular);
      if (d.i18nMap) setDislikeI18n(d.i18nMap);
    }).catch(() => {});
  }, []);

  const [dislikeNoResults, setDislikeNoResults] = useState(false);

  // Search dislikes with debounce
  useEffect(() => {
    if (!dislikeSearch || dislikeSearch.length < 2) { setDislikeResults([]); setDislikeNoResults(false); return; }
    setDislikeNoResults(false);
    const timer = setTimeout(() => {
      fetch(`/api/qr/dislikes?q=${encodeURIComponent(dislikeSearch)}`).then(r => r.json()).then(d => {
        const filtered = (d.results || []).filter((r: string) => !dislikes.includes(r));
        setDislikeResults(filtered);
        setDislikeNoResults(filtered.length === 0);
        trackStat(restaurantId, "GENIO_STEP_DISLIKES", undefined, genioSessionId);
        fetch("/api/qr/stats", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventType: "SEARCH_PERFORMED", restaurantId, guestId: getGuestId(), query: dislikeSearch, resultsCount: d.results?.length || 0, metadata: { context: "dislike_search" } }),
        }).catch(() => {});
      }).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [dislikeSearch, dislikes]);

  // Sync preferences to QRUser on step 4
  useEffect(() => {
    if (step !== 4) return;
    if (!document.cookie.includes("qr_user_id")) return;
    const diet = localStorage.getItem("qr_diet");
    const restrictions = localStorage.getItem("qr_restrictions");
    const dislikesStr = localStorage.getItem("qr_dislikes");
    if (!diet && !restrictions && !dislikesStr) return;
    const body: Record<string, unknown> = {};
    if (diet) body.dietType = diet;
    if (restrictions) try { body.restrictions = JSON.parse(restrictions).filter((r: string) => r !== "ninguna"); } catch {}
    if (dislikesStr) try { body.dislikes = JSON.parse(dislikesStr); } catch {}
    fetch("/api/qr/user/update", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
  }, [step]);

  const TOTAL_STEPS = 4;

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    document.body.style.overflow = "hidden";
    // GENIO_START only fires when user advances to step 1 (new) or modifies profile (returning)
    // — not on mount, to avoid false "abandoned" stats from users who just peek
    return () => { document.body.style.overflow = ""; };
  }, [restaurantId]);

  const close = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 200);
  }, [onClose]);

  const STEP_NAMES = ["welcome", "diet", "restrictions", "dislikes", "done"];
  const next = () => setStep((s) => {
    const nextStep = s + 1;
    trackStat(restaurantId, `GENIO_STEP_${STEP_NAMES[nextStep]?.toUpperCase() || nextStep}`, undefined, genioSessionId);
    return nextStep;
  });

  const NUT_GROUP = ["maní", "nueces", "almendras"];
  const toggleRestriction = (r: string) => {
    if (r === "ninguna") {
      setRestrictions(["ninguna"]);
      localStorage.setItem("qr_restrictions", JSON.stringify(["ninguna"]));
      setTimeout(next, 400);
      return;
    }
    // "frutos secos" expands to individual nut allergens
    const values = r === "frutos secos" ? NUT_GROUP : [r];
    setRestrictions((prev) => {
      const without = prev.filter((x) => x !== "ninguna");
      const hasAll = values.every(v => without.includes(v));
      if (hasAll) return without.filter(x => !values.includes(x));
      return [...without.filter(x => !values.includes(x)), ...values];
    });
  };

  // Lock body scroll + measure real viewport for Chrome iOS
  const [viewportH, setViewportH] = useState(() => typeof window !== "undefined" ? window.innerHeight : 0);
  useEffect(() => {
    const scrollY = window.scrollY;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    document.body.style.top = `-${scrollY}px`;

    setViewportH(window.innerHeight);
    const onResize = () => setViewportH(window.innerHeight);
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      const top = document.body.style.top;
      document.body.style.top = "";
      window.scrollTo(0, parseInt(top || "0") * -1);
    };
  }, []);

  const displayStep = step;
  const [skipTransition, setSkipTransition] = useState(false);

  // ═══════════════════════════════════════════════════════
  // SHARED INPUT STYLE
  // ═══════════════════════════════════════════════════════
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: 12,
    border: `0.5px solid ${G.border}`, background: G.surface,
    color: G.textPrimary, fontSize: "0.88rem", outline: "none",
    boxSizing: "border-box", fontFamily: "inherit",
  };

  return (
    <div
      className="font-[family-name:var(--font-dm)]"
      style={{
        position: "fixed", top: 0, left: 0, width: "100%", height: viewportH || "100dvh",
        zIndex: 110, background: G.bg,
        opacity: visible ? 1 : 0, transition: "opacity 0.2s ease-out", overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {step > 0 && step < 4 ? (
          <button onClick={() => setStep((s) => s - 1)} className="flex items-center justify-center" style={{ width: 34, height: 34, borderRadius: "50%", background: G.surfaceHover, border: "none" }}>
            <ChevronLeft size={18} color="white" />
          </button>
        ) : (
          <div style={{ width: 34 }} />
        )}
        <span style={{ color: G.textTertiary, fontSize: "0.82rem", fontWeight: 500 }}>
          {step >= 1 && step <= 3 ? t(lang, "gStepOf").replace("{step}", String(step)) : ""}
        </span>
        <button onClick={close} className="flex items-center justify-center" style={{ width: 34, height: 34, borderRadius: "50%", background: G.surfaceHover, border: "none" }}>
          <X size={16} color="white" />
        </button>
      </div>

      {/* Progress bar */}
      {step >= 1 && step <= 3 && (
        <div style={{ position: "absolute", top: 62, left: 20, right: 20, zIndex: 20, display: "flex", gap: 4 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? G.gold : "rgba(255,255,255,0.08)", transition: "background 0.3s" }} />
          ))}
        </div>
      )}

      {/* Steps container */}
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex", transform: `translateX(${-displayStep * 100}%)`, transition: skipTransition ? "none" : "transform 0.3s ease-out" }}>

        {/* ═══ STEP 0 — Welcome or Profile ═══ */}
        <div style={{ minWidth: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 20px", gap: 16, position: "relative" }}>
          {hasSaved ? (
            <>
              <AmbientHaze />
              <div style={{ position: "relative", zIndex: 2, width: "100%", overflowY: "auto", maxHeight: viewportH ? viewportH - 80 : "calc(100dvh - 80px)", padding: "32px 24px 40px" }}>
                {/* Header */}
                <div style={{ textAlign: "center", marginBottom: 28 }}>
                  <span style={{ fontSize: "2rem", display: "block", marginBottom: 8, filter: "drop-shadow(0 0 10px rgba(245,158,11,0.5))" }}>🧞</span>
                  <span className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "19px", fontWeight: 700, color: G.orange }}>
                    {userName ? `${userName}, tu perfil` : "Tu perfil"}
                  </span>
                  <p style={{ fontSize: "15px", color: G.textSecondary, margin: "8px 0 0", lineHeight: 1.4 }}>
                    ✨ La carta ya está ordenada según tus gustos
                  </p>
                </div>

                {/* Diet section */}
                <div style={{ marginBottom: 28, textAlign: "center" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: G.textDisabled, letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 10 }}>DIETA</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                    {DIET_OPTIONS.map((opt) => {
                      const sel = dietType === opt.value;
                      const dc = getDietColors(opt.value, sel);
                      return (
                        <button key={opt.value} onClick={() => {
                          setDietType(opt.value); localStorage.setItem("qr_diet", opt.value);
                          if (document.cookie.includes("qr_user_id")) { fetch("/api/qr/user/update", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dietType: opt.value }) }).catch(() => {}); }
                        }} style={{ padding: "9px 16px", borderRadius: 50, border: dc.border, background: dc.bg, color: dc.color, fontSize: "14px", fontWeight: sel ? 600 : 400, cursor: "pointer" }}>
                          {t(lang, opt.labelKey)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Restrictions section */}
                <div style={{ marginBottom: 28, textAlign: "center" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: G.textDisabled, letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 10 }}>RESTRICCIONES</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                    {restrictions.filter(r => r !== "ninguna").map(r => {
                      const opt = restrictionOptions.find(o => o.value === r);
                      return (
                        <button key={r} onClick={() => {
                          const updated = restrictions.filter(x => x !== r);
                          setRestrictions(updated); localStorage.setItem("qr_restrictions", JSON.stringify(updated));
                          if (document.cookie.includes("qr_user_id")) { fetch("/api/qr/user/update", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restrictions: updated.filter(x => x !== "ninguna") }) }).catch(() => {}); }
                        }} style={{ padding: "8px 14px", borderRadius: 50, border: `1px solid ${G.selectedBorder}`, background: G.selectedBg, color: G.goldText, fontSize: "14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                          {r === "_spicy" ? t(lang, "gWithoutSpicy") : opt?.labelKey ? t(lang, opt.labelKey as any) : opt?.label || `Sin ${r}`}
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={G.goldText} strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
                        </button>
                      );
                    })}
                    <button onClick={() => setShowAddRestriction(prev => !prev)} style={{ padding: "8px 14px", borderRadius: 50, border: `1px dashed ${G.border}`, background: G.surface, color: G.textDisabled, fontSize: "14px", cursor: "pointer" }}>
                      + Agregar
                    </button>
                  </div>
                  {showAddRestriction && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 8 }}>
                      {restrictionOptions.filter(r => r.value !== "ninguna" && !restrictions.includes(r.value)).filter(r => {
                        const animalRestrictions = ["mariscos", "cerdo", "pescado"];
                        const dairyEggRestrictions = ["lactosa", "huevo"];
                        if (dietType === "vegan") return !animalRestrictions.includes(r.value) && !dairyEggRestrictions.includes(r.value);
                        if (dietType === "vegetarian") return !animalRestrictions.includes(r.value);
                        const restDiet = restaurantDietType?.toUpperCase();
                        if (restDiet === "VEGAN" || restDiet === "VEGETARIAN") return !["mariscos", "cerdo"].includes(r.value);
                        return true;
                      }).map(r => (
                        <button key={r.value} onClick={() => {
                          const updated = [...restrictions.filter(x => x !== "ninguna"), r.value];
                          setRestrictions(updated); localStorage.setItem("qr_restrictions", JSON.stringify(updated));
                          if (document.cookie.includes("qr_user_id")) { fetch("/api/qr/user/update", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restrictions: updated.filter(x => x !== "ninguna") }) }).catch(() => {}); }
                          setShowAddRestriction(false);
                        }} style={{ padding: "8px 14px", borderRadius: 50, border: `0.5px solid ${G.border}`, background: G.surface, color: G.textSecondary, fontSize: "14px", cursor: "pointer" }}>
                          {r.labelKey ? t(lang, r.labelKey as any) : r.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Dislikes section */}
                <div style={{ marginBottom: 28, textAlign: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 10 }}>
                    <span onClick={() => setShowDislikeInfo(v => !v)} style={{ width: 16, height: 16, borderRadius: "50%", background: G.surfaceHover, color: G.textTertiary, fontSize: "10px", fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>i</span>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: G.textDisabled, letterSpacing: "0.1em", textTransform: "uppercase" }}>MOSTRAR MENOS CON</span>
                  </div>
                  {showDislikeInfo && (
                    <p style={{ fontSize: "12px", color: G.textTertiary, textAlign: "center", marginTop: -4, marginBottom: 10 }}>{t(lang, "gDislikesHint")}</p>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginBottom: 8 }}>
                    {dislikes.filter(d => !["dulce", "agridulce", "ácido", "ahumado"].includes(d)).map(d => (
                      <button key={d} onClick={() => {
                        const updated = dislikes.filter(x => x !== d);
                        setDislikes(updated); localStorage.setItem("qr_dislikes", JSON.stringify(updated));
                        if (document.cookie.includes("qr_user_id")) { fetch("/api/qr/user/update", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dislikes: updated }) }).catch(() => {}); }
                      }} style={{ padding: "8px 14px", borderRadius: 50, border: `1px solid ${G.warnBorder}`, background: G.warnBg, color: G.warnText, fontSize: "14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                        {d}
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={G.warnText} strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
                      </button>
                    ))}
                    <button onClick={() => setShowAddDislike(prev => !prev)} style={{ padding: "8px 14px", borderRadius: 50, border: `1px dashed ${G.border}`, background: G.surface, color: G.textDisabled, fontSize: "14px", cursor: "pointer" }}>
                      + Agregar
                    </button>
                  </div>
                  {showAddDislike && (
                    <div style={{ position: "relative", maxWidth: 240, margin: "0 auto" }}>
                      <input
                        value={dislikeSearch} onChange={e => setDislikeSearch(e.target.value)}
                        placeholder="Buscar ingrediente..."
                        autoFocus
                        className="genio-input"
                        onFocus={() => setProfileDislikeFocused(true)}
                        onBlur={() => setTimeout(() => setProfileDislikeFocused(false), 200)}
                        style={inputStyle}
                      />
                      {dislikeResults.length > 0 ? (
                        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: G.dropdown, border: `1px solid ${G.dropdownBorder}`, borderRadius: 10, overflow: "hidden", maxHeight: 140, overflowY: "auto", zIndex: 10 }}>
                          {dislikeResults.map(r => (
                            <button key={r} onClick={() => {
                              const updated = [...dislikes, r]; setDislikes(updated); localStorage.setItem("qr_dislikes", JSON.stringify(updated));
                              if (document.cookie.includes("qr_user_id")) { fetch("/api/qr/user/update", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dislikes: updated }) }).catch(() => {}); }
                              setDislikeSearch(""); setDislikeResults([]); setShowAddDislike(false);
                            }} style={{ display: "block", width: "100%", padding: "10px 14px", background: "none", border: "none", borderBottom: `1px solid ${G.border}`, textAlign: "left", color: G.textSecondary, fontSize: "14px", cursor: "pointer" }}>
                              {r}
                            </button>
                          ))}
                        </div>
                      ) : profileDislikeFocused && !dislikeSearch ? (
                        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: G.dropdown, border: `1px solid ${G.dropdownBorder}`, borderRadius: 10, overflow: "hidden", zIndex: 10 }}>
                          <p style={{ padding: "8px 14px 4px", margin: 0, fontSize: "9.5px", color: "#fb923c", textTransform: "uppercase", letterSpacing: "0.08em" }}>Más comunes</p>
                          {popularDislikes.filter(p => !dislikes.includes(p)).slice(0, 4).map(item => (
                            <button key={item} onClick={() => {
                              const updated = [...dislikes, item]; setDislikes(updated); localStorage.setItem("qr_dislikes", JSON.stringify(updated));
                              if (document.cookie.includes("qr_user_id")) { fetch("/api/qr/user/update", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dislikes: updated }) }).catch(() => {}); }
                              setProfileDislikeFocused(false);
                            }} style={{ display: "block", width: "100%", padding: "10px 14px", background: "none", border: "none", borderBottom: `1px solid ${G.border}`, textAlign: "left", color: G.textSecondary, fontSize: "14px", cursor: "pointer" }}>
                              {lang === "en" ? (dislikeI18n[item.toLowerCase()]?.en || item) : lang === "pt" ? (dislikeI18n[item.toLowerCase()]?.pt || item) : item}
                            </button>
                          ))}
                        </div>
                      ) : profileDislikeFocused && dislikeSearch.length >= 2 && dislikeResults.length === 0 ? (
                        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: G.dropdown, border: "0.5px solid rgba(234,88,12,0.15)", borderRadius: 10, overflow: "hidden", zIndex: 10, padding: "11px 14px" }}>
                          <span style={{ color: G.textTertiary, fontSize: "0.82rem" }}>No encontramos &quot;{dislikeSearch.trim()}&quot;</span>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* Save button */}
                <button onClick={() => {
                  localStorage.setItem("qr_diet", dietType || ""); localStorage.setItem("qr_restrictions", JSON.stringify(restrictions)); localStorage.setItem("qr_dislikes", JSON.stringify(dislikes));
                  if (document.cookie.includes("qr_user_id")) { fetch("/api/qr/user/update", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dietType, restrictions: restrictions.filter(x => x !== "ninguna"), dislikes }) }).catch(() => {}); }
                  const changed = dietType !== initialDiet.current || JSON.stringify(restrictions) !== initialRestrictions.current || JSON.stringify(dislikes) !== initialDislikes.current;
                  if (changed) { trackStat(restaurantId, "GENIO_PROFILE_SAVED", undefined, genioSessionId); }
                  window.dispatchEvent(new Event("genio-updated"));
                  setVisible(false); setTimeout(onClose, 200);
                }} className="active:scale-95 transition-transform" style={{ ...CTA_STYLE, display: "block", margin: "0 auto 14px", maxWidth: 280 }}>
                  Guardar cambios
                </button>

                {/* Delete preferences */}
                {!confirmDelete ? (
                  <button onClick={() => setConfirmDelete(true)} style={{ width: "100%", background: "transparent", border: "none", color: G.textTertiary, fontSize: "11px", cursor: "pointer", fontFamily: "inherit", padding: "8px 0", textDecoration: "underline", textUnderlineOffset: 3 }}>
                    Borrar mis preferencias
                  </button>
                ) : (
                  <div style={{ textAlign: "center", padding: "12px 0" }}>
                    <p style={{ fontSize: "12px", color: G.textSecondary, margin: "0 0 10px" }}>¿Seguro? Esto borrará todo tu perfil.</p>
                    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                      <button onClick={async () => {
                        localStorage.removeItem("qr_diet"); localStorage.removeItem("qr_restrictions"); localStorage.removeItem("qr_dislikes");
                        setDietType(null); setRestrictions([]); setDislikes([]);
                        // Wait for DB clear before closing, so profile fetch doesn't restore them
                        await Promise.all([
                          document.cookie.includes("qr_user_id") ? fetch("/api/qr/user/update", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dietType: null, restrictions: [], dislikes: [] }) }).catch(() => {}) : Promise.resolve(),
                          fetch("/api/qr/profile/clear", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ guestId: getGuestId() }) }).catch(() => {}),
                        ]);
                        close();
                      }} style={{ padding: "8px 16px", borderRadius: 50, border: "none", background: "rgba(239,68,68,0.12)", color: "#ef4444", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                        Sí, borrar
                      </button>
                      <button onClick={() => setConfirmDelete(false)} style={{ padding: "8px 16px", borderRadius: 50, border: `1px solid ${G.border}`, background: "transparent", color: G.textTertiary, fontSize: "12px", cursor: "pointer" }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <AmbientHaze bottom />
              <AmbientSparks count={5} />
              <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                {/* Genio with glow */}
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", inset: -42, borderRadius: "50%", background: "radial-gradient(circle, rgba(245,158,11,0.45) 0%, rgba(217,119,6,0.15) 40%, transparent 70%)", animation: "genioPulse 2.8s ease-in-out infinite" }} />
                  <span style={{ fontSize: "3rem", position: "relative", filter: "drop-shadow(0 0 14px rgba(245,158,11,0.7))" }}>🧞</span>
                </div>
                <p className="text-center" style={{ color: G.orange, fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, margin: 0 }}>
                  {t(lang, "gHelloGenius")}
                </p>
                <h1 className="font-[family-name:var(--font-playfair)] text-center" style={{ fontSize: "2rem", fontWeight: 900, color: "white", margin: 0, lineHeight: 1.2, maxWidth: 280 }}>
                  {(() => { const text = t(lang, "gTellMeRecommend"); const words = text.split(" "); const last2 = words.slice(-2).join(" "); const rest = words.slice(0, -2).join(" "); return <>{rest} <em style={{ color: G.orange, fontStyle: "italic" }}>{last2}</em></>; })()}
                </h1>
                <p className="text-center" style={{ color: G.textSecondary, fontSize: "0.95rem", maxWidth: 300, lineHeight: 1.5, margin: 0 }}>
                  {t(lang, "gTellMeSub" as any)}
                </p>
                <button onClick={() => { trackStat(restaurantId, "GENIO_START", undefined, genioSessionId); trackStat(restaurantId, "GENIO_STEP_DIET", undefined, genioSessionId); setStep(1); }} className="active:scale-95 transition-transform" style={{ ...CTA_STYLE, marginTop: 8, maxWidth: 280 }}>
                  {t(lang, "gStartBtn")} →
                </button>
              </div>
            </>
          )}
        </div>

        {/* ═══ STEP 1 — Diet type ═══ */}
        <div style={{ minWidth: "100%", display: "flex", flexDirection: "column", padding: "100px 36px 40px", position: "relative" }}>
          <AmbientHaze />
          <AmbientSparks count={3} />
          <h2 className="font-[family-name:var(--font-playfair)] text-center" style={{ fontSize: "1.6rem", fontWeight: 900, color: "white", marginBottom: 28, position: "relative", zIndex: 2 }}>
            {t(lang, "gDietQuestion")}
          </h2>
          <div className="flex flex-col items-center" style={{ gap: 12, position: "relative", zIndex: 2, width: "100%", maxWidth: 320, alignSelf: "center" }}>
            {DIET_OPTIONS.map((opt) => {
              const sel = dietType === opt.value;
              const dc = getDietColors(opt.value, sel);
              const Icon = opt.icon;
              return (
                <button key={opt.value} onClick={() => {
                  setDietType(opt.value); localStorage.setItem("qr_diet", opt.value);
                  if (document.cookie.includes("qr_user_id")) { fetch("/api/qr/user/update", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dietType: opt.value }) }).catch(() => {}); }
                  setTimeout(next, 400);
                }}
                  className="flex items-center transition-all duration-200"
                  style={{ padding: "16px 20px", borderRadius: 14, border: dc.border, background: dc.bg, gap: 14, width: "100%" }}>
                  <span style={{ width: 22, height: 22, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: sel ? G.goldLight : G.gold, filter: sel ? "drop-shadow(0 0 4px rgba(234,88,12,0.7))" : "none" }}>
                    <Icon size={18} />
                  </span>
                  <span style={{ flex: 1, color: "white", fontSize: "1.1rem", fontWeight: 600, lineHeight: 1.3, textAlign: "left" }}>{t(lang, opt.labelKey)}</span>
                  {sel && <Check size={16} color={G.gold} style={{ flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══ STEP 2 — Restrictions ═══ */}
        <div style={{ minWidth: "100%", display: "flex", flexDirection: "column", padding: "100px 36px 120px", position: "relative" }}>
          <AmbientHaze />
          <AmbientSparks count={3} />
          <h2 className="font-[family-name:var(--font-playfair)] text-center" style={{ fontSize: "1.6rem", fontWeight: 900, color: "white", marginBottom: 28, position: "relative", zIndex: 2 }}>
            {t(lang, "gResQuestion")}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, position: "relative", zIndex: 2 }}>
            {restrictionOptions.filter(r => {
              if (r.value === "ninguna" || r.value === "_spicy") return true;
              const animalRestrictions = ["mariscos", "cerdo", "pescado"];
              const dairyEggRestrictions = ["lactosa", "huevo"];
              if (dietType === "vegan") return !animalRestrictions.includes(r.value) && !dairyEggRestrictions.includes(r.value);
              if (dietType === "vegetarian") return !animalRestrictions.includes(r.value);
              const restDiet = restaurantDietType?.toUpperCase();
              if (restDiet === "VEGAN" || restDiet === "VEGETARIAN") return !["mariscos", "cerdo"].includes(r.value);
              return true;
            }).map((r) => {
              const sel = r.value === "frutos secos" ? NUT_GROUP.some(n => restrictions.includes(n)) : restrictions.includes(r.value);
              const Icon = r.icon;
              return (
                <button key={r.value} onClick={() => toggleRestriction(r.value)}
                  className="flex items-center transition-all duration-200"
                  style={{ padding: "11px 12px", borderRadius: 12, border: sel ? `1px solid ${G.selectedBorder}` : `0.5px solid ${G.border}`, background: sel ? G.selectedBg : G.surface, gap: 8 }}>
                  <span style={{ width: 16, height: 16, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: sel ? G.goldLight : G.gold, filter: sel ? "drop-shadow(0 0 4px rgba(234,88,12,0.7))" : "none" }}>
                    <Icon size={13} />
                  </span>
                  <span style={{ flex: 1, color: sel ? G.goldText : G.textSecondary, fontSize: "1.06rem", fontWeight: 500, lineHeight: 1.3, textAlign: "left" }}>
                    {r.labelKey ? t(lang, r.labelKey as any) : r.label}
                  </span>
                  {sel && r.value !== "ninguna" && <Check size={12} color={G.gold} style={{ flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
          {restrictions.length > 0 && !restrictions.includes("ninguna") && (
            <button
              onClick={() => {
                localStorage.setItem("qr_restrictions", JSON.stringify(restrictions));
                if (document.cookie.includes("qr_user_id")) { fetch("/api/qr/user/update", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restrictions: restrictions.filter((r: string) => r !== "ninguna") }) }).catch(() => {}); }
                next();
              }}
              className="active:scale-95 transition-transform"
              style={{ ...CTA_STYLE, marginTop: 24, alignSelf: "center", position: "relative", zIndex: 2 }}
            >
              {t(lang, "gContinueBtn")}
            </button>
          )}
        </div>

        {/* ═══ STEP 3 — Dislikes ═══ */}
        <div style={{ minWidth: "100%", display: "flex", flexDirection: "column", alignItems: "center", padding: "100px 36px 120px", position: "relative" }}>
          <AmbientHaze bottom />
          <AmbientSparks count={5} />

          <h2 className="font-[family-name:var(--font-playfair)] text-center" style={{ fontSize: "1.5rem", fontWeight: 900, color: "white", marginBottom: 8, position: "relative", zIndex: 2 }}>
            {t(lang, "gDislikesQuestion")}
          </h2>
          <p className="text-center" style={{ color: G.textTertiary, fontSize: "0.85rem", marginBottom: 20, lineHeight: 1.5, position: "relative", zIndex: 2 }}>
            {t(lang, "gDislikesHint")}
          </p>

          {/* Popular dislikes — unified render, toggle in place */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 16, position: "relative", zIndex: 2 }}>
            {popularDislikes.filter(p => !["dulce", "agridulce", "ácido", "ahumado"].includes(p)).slice(0, 4).map(item => {
              const sel = dislikes.includes(item);
              const label = lang === "en" ? (dislikeI18n[item.toLowerCase()]?.en || item) : lang === "pt" ? (dislikeI18n[item.toLowerCase()]?.pt || item) : item;
              return (
                <button key={item} onClick={() => {
                  setDislikes(prev => {
                    const updated = sel ? prev.filter(x => x !== item) : [...prev, item];
                    localStorage.setItem("qr_dislikes", JSON.stringify(updated));
                    return updated;
                  });
                }} className="transition-all duration-200" style={sel
                  ? { padding: "8px 16px", borderRadius: 50, border: `1px solid ${G.selectedBorder}`, background: G.selectedBg, color: G.goldText, fontSize: "0.88rem", fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }
                  : { padding: "8px 16px", borderRadius: 50, border: `0.5px solid ${G.border}`, background: G.surface, color: G.textSecondary, fontSize: "0.88rem", fontWeight: 500, cursor: "pointer" }
                }>
                  {label}{sel && <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>✕</span>}
                </button>
              );
            })}
          </div>

          {/* Extra dislikes added via search (not in popular list) */}
          {dislikes.filter(d => !popularDislikes.includes(d)).length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 16, position: "relative", zIndex: 2 }}>
              {dislikes.filter(d => !popularDislikes.includes(d)).map(d => (
                <button key={d} onClick={() => {
                  setDislikes(prev => { const updated = prev.filter(x => x !== d); localStorage.setItem("qr_dislikes", JSON.stringify(updated)); return updated; });
                }} className="transition-all duration-200" style={{ padding: "8px 16px", borderRadius: 50, border: `1px solid ${G.selectedBorder}`, background: G.selectedBg, color: G.goldText, fontSize: "0.88rem", fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  {d} <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>✕</span>
                </button>
              ))}
            </div>
          )}

          {/* Search input for more */}
          <div style={{ position: "relative", marginBottom: 16, width: "100%", zIndex: 2 }}>
            <input
              value={dislikeSearch} onChange={e => setDislikeSearch(e.target.value)}
              onFocus={() => setDislikeInputFocused(true)}
              onBlur={() => setTimeout(() => { setDislikeInputFocused(false); setDislikeResults([]); setDislikeNoResults(false); }, 200)}
              placeholder={t(lang, "gSearchIngredient")}
              className="genio-input"
              style={inputStyle}
            />
            {dislikeResults.length > 0 && (
              <div style={{ position: "absolute", bottom: "100%", left: 0, right: 0, marginBottom: 4, background: G.dropdown, border: `0.5px solid rgba(234,88,12,0.15)`, borderRadius: 12, overflow: "hidden", zIndex: 10, maxHeight: 180, overflowY: "auto" }}>
                {dislikeResults.map(r => (
                  <button key={r} onClick={() => {
                    setDislikes(prev => { const updated = [...prev, r]; localStorage.setItem("qr_dislikes", JSON.stringify(updated)); return updated; });
                    setDislikeSearch(""); setDislikeResults([]); setDislikeNoResults(false);
                  }} style={{ display: "block", width: "100%", padding: "11px 16px", background: "none", border: "none", borderBottom: `1px solid ${G.border}`, textAlign: "left", color: G.textSecondary, fontSize: "0.88rem", cursor: "pointer" }}>
                    {r}
                  </button>
                ))}
              </div>
            )}
            {dislikeNoResults && dislikeSearch.length >= 2 && (
              <div style={{ position: "absolute", bottom: "100%", left: 0, right: 0, marginBottom: 4, background: G.dropdown, border: `0.5px solid rgba(234,88,12,0.15)`, borderRadius: 12, overflow: "hidden", zIndex: 10, padding: "11px 16px" }}>
                <span style={{ color: G.textTertiary, fontSize: "0.82rem" }}>No encontramos &quot;{dislikeSearch.trim()}&quot;</span>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              localStorage.setItem("qr_dislikes", JSON.stringify(dislikes));
              if (document.cookie.includes("qr_user_id")) {
                fetch("/api/qr/user/update", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dislikes }) }).catch(() => {});
              }
              next();
            }}
            className="active:scale-95 transition-transform"
            style={{ ...CTA_STYLE, marginTop: 24, position: "relative", zIndex: 2 }}
          >
            {t(lang, "gContinueBtn")}
          </button>
          <button
            onClick={() => {
              setDislikes([]);
              localStorage.setItem("qr_dislikes", JSON.stringify([]));
              if (document.cookie.includes("qr_user_id")) {
                fetch("/api/qr/user/update", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dislikes: [] }) }).catch(() => {});
              }
              // TODO: track skip event
              next();
            }}
            style={{ marginTop: 12, background: "none", border: "none", color: G.textTertiary, fontSize: "0.95rem", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", textUnderlineOffset: 3, position: "relative", zIndex: 2 }}
          >
            {t(lang, "gSkipStep")}
          </button>
        </div>

        {/* ═══ STEP 4 — Done ═══ */}
        <div style={{ minWidth: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 36px 44px", position: "relative" }}>
          <AmbientHaze bottom />
          <AmbientSparks count={5} />

          {/* Genio + sparkle */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, position: "relative", zIndex: 2 }}>
            <span style={{ fontSize: 36, filter: "drop-shadow(0 0 10px rgba(245,158,11,0.6))" }}>🧞</span>
            <span style={{ fontSize: 26, color: G.gold, filter: "drop-shadow(0 0 12px rgba(245,158,11,0.8))", animation: "sparkRotate 4s linear infinite" }}>✦</span>
          </div>

          {/* Title */}
          <h1 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "26px", fontWeight: 700, color: "white", lineHeight: 1.15, letterSpacing: "-0.5px", textAlign: "center", marginBottom: 10, position: "relative", zIndex: 2 }}>
            Tu carta está personalizada
          </h1>

          {/* Subtitle */}
          <p style={{ fontSize: "16px", color: G.textTertiary, lineHeight: 1.65, textAlign: "center", marginBottom: 32, position: "relative", zIndex: 2 }}>
            Ordenamos los platos según tus gustos
          </p>

          {/* Tip card */}
          {/* Button */}
          <button
            onClick={() => {
              trackStat(restaurantId, "GENIO_COMPLETE", undefined, genioSessionId);
              window.dispatchEvent(new Event("genio-updated"));
              setVisible(false);
              setTimeout(onClose, 200);
            }}
            className="active:scale-95 transition-transform"
            style={{ ...CTA_STYLE, position: "relative", zIndex: 2 }}
          >
            Ver mi carta
          </button>
        </div>
      </div>

      <style>{`
        .genio-input::placeholder { color: rgba(255,255,255,0.28) !important; }
        .genio-input:focus { border-color: rgba(234,88,12,0.5) !important; box-shadow: 0 0 12px rgba(234,88,12,0.15); }
        @keyframes genioPulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 1; }
        }
        @keyframes floatSpark {
          0%, 100% { opacity: 0.3; transform: translateY(0) scale(0.8); }
          50% { opacity: 1; transform: translateY(-6px) scale(1.3); }
        }
        @keyframes sparkRotate {
          0%, 100% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.15); }
        }
      `}</style>
    </div>
  );
}
