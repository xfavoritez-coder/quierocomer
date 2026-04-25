"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
}

type DietType = "omnivore" | "vegetarian" | "vegan";

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

// Icon map for known restriction/allergen names
const RESTRICTION_ICON_MAP: Record<string, typeof Ban> = {
  lactosa: Milk, gluten: Wheat, mariscos: Fish,
};

type RestrictionOption = { icon: typeof Ban; label?: string; labelKey?: string; value: string };

// Dislikes: loaded dynamically from DB


import { getGuestId, getSessionId } from "@/lib/guestId";
import { getDbSessionId } from "@/lib/sessionTracker";

function trackStat(restaurantId: string, eventType: string, dishId?: string, genioSessionId?: string) {
  fetch("/api/qr/stats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, restaurantId, dishId, genioSessionId, guestId: getGuestId(), sessionId: getSessionId(), dbSessionId: getDbSessionId() }),
  }).catch(() => {});
}


export default function GenioOnboarding({ restaurantId, dishes, categories, onClose, onResult, qrUser: qrUserProp }: GenioProps) {
  const lang = useLang();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const genioSessionId = useRef(crypto.randomUUID()).current;

  // Load saved preferences from localStorage
  const savedDiet = typeof window !== "undefined" ? localStorage.getItem("qr_diet") : null;
  const savedRestrictions = typeof window !== "undefined" ? localStorage.getItem("qr_restrictions") : null;
  const savedDislikes = typeof window !== "undefined" ? localStorage.getItem("qr_dislikes") : null;
  const hasSaved = !!(savedDiet && savedRestrictions);

  const userName = qrUserProp?.name || null;

  // Load restrictions/allergens dynamically from DB
  const [restrictionOptions, setRestrictionOptions] = useState<RestrictionOption[]>([
    { icon: Check, labelKey: "gNone" as const, value: "ninguna" },
  ]);
  useEffect(() => {
    fetch("/api/qr/restrictions").then(r => r.json()).then((items: { name: string; type: string }[]) => {
      const opts: RestrictionOption[] = [
        { icon: Check, labelKey: "gNone" as const, value: "ninguna" },
        // Spicy first — most common preference, uses dish.isSpicy flag
        { icon: Flame, labelKey: "gWithoutSpicy" as const, value: "_spicy" },
      ];
      for (const item of items) {
        opts.push({
          icon: RESTRICTION_ICON_MAP[item.name] || Ban,
          label: `Sin ${item.name}`,
          value: item.name,
        });
      }
      setRestrictionOptions(opts);
    }).catch(() => {});
  }, []);

  // Wizard state — skip to step 3 if we have saved prefs
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

  // Search dislikes with debounce
  useEffect(() => {
    if (!dislikeSearch || dislikeSearch.length < 2) { setDislikeResults([]); return; }
    const timer = setTimeout(() => {
      fetch(`/api/qr/dislikes?q=${encodeURIComponent(dislikeSearch)}`).then(r => r.json()).then(d => {
        if (d.results) setDislikeResults(d.results.filter((r: string) => !dislikes.includes(r)));
        // Track search
        trackStat(restaurantId, "GENIO_STEP_DISLIKES", undefined, genioSessionId);
        fetch("/api/qr/stats", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventType: "SEARCH_PERFORMED", restaurantId, guestId: getGuestId(), query: dislikeSearch, resultsCount: d.results?.length || 0, metadata: JSON.stringify({ context: "dislike_search" }) }),
        }).catch(() => {});
      }).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [dislikeSearch, dislikes]);
  // Sync all preferences to QRUser when Genio completes (step 4 — done screen)
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
    trackStat(restaurantId, "GENIO_START", undefined, genioSessionId);
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

  const toggleRestriction = (r: string) => {
    if (r === "ninguna") {
      setRestrictions(["ninguna"]);
      localStorage.setItem("qr_restrictions", JSON.stringify(["ninguna"]));
      setTimeout(next, 400);
      return;
    }
    setRestrictions((prev) => {
      const without = prev.filter((x) => x !== "ninguna");
      return without.includes(r) ? without.filter((x) => x !== r) : [...without, r];
    });
  };


  // Lock body scroll to prevent Chrome iOS address bar gap
  useEffect(() => {
    const scrollY = window.scrollY;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    document.body.style.top = `-${scrollY}px`;
    return () => {
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

  return (
    <div
      className="font-[family-name:var(--font-dm)]"
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 110, background: "#0e0e0e",
        opacity: visible ? 1 : 0, transition: "opacity 0.2s ease-out", overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {step > 0 && step < 4 ? (
          <button onClick={() => setStep((s) => s - 1)} className="flex items-center justify-center" style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "none" }}>
            <ChevronLeft size={18} color="white" />
          </button>
        ) : (
          <div style={{ width: 34 }} />
        )}
        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.82rem", fontWeight: 500 }}>
          {step >= 1 && step <= 3 ? t(lang, "gStepOf").replace("{step}", String(step)) : ""}
        </span>
        <button onClick={close} className="flex items-center justify-center" style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "none" }}>
          <X size={16} color="white" />
        </button>
      </div>

      {/* Progress bar */}
      {step >= 1 && step <= 3 && (
        <div style={{ position: "absolute", top: 62, left: 20, right: 20, zIndex: 20, display: "flex", gap: 4 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? "#F4A623" : "rgba(255,255,255,0.15)", transition: "background 0.3s" }} />
          ))}
        </div>
      )}

      {/* Steps container */}
      <div style={{ position: "absolute", inset: 0, display: "flex", transform: `translateX(${-displayStep * 100}%)`, transition: skipTransition ? "none" : "transform 0.3s ease-out" }}>

        {/* STEP 0 — Welcome or Welcome Back */}
        <div style={{ minWidth: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 20px", gap: 16 }}>
          {hasSaved ? (
            <div style={{ width: "100%", background: "#0e0e0e", borderRadius: 32, overflowY: "auto", maxHeight: "calc(100dvh - 80px)", padding: "32px 24px 40px" }}>
              {/* Header */}
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                <span style={{ fontSize: "2rem", display: "block", marginBottom: 8 }}>🧞</span>
                <span style={{ fontFamily: "Georgia, serif", fontSize: "19px", fontWeight: 700, color: "white" }}>
                  {userName ? `${userName}, tu perfil` : "Tu perfil"}
                </span>
              </div>

              {/* Diet section */}
              <div style={{ marginBottom: 28, textAlign: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 10 }}>DIETA</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                  {DIET_OPTIONS.map((opt) => {
                    const sel = dietType === opt.value;
                    return (
                      <button key={opt.value} onClick={() => {
                        setDietType(opt.value); localStorage.setItem("qr_diet", opt.value);
                        if (document.cookie.includes("qr_user_id")) { fetch("/api/qr/user/update", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dietType: opt.value }) }).catch(() => {}); }
                      }} style={{ padding: "9px 16px", borderRadius: 50, border: `1px solid ${sel ? (opt.value === "vegan" ? "rgba(22,163,74,0.4)" : opt.value === "vegetarian" ? "rgba(74,222,128,0.4)" : "rgba(244,166,35,0.4)") : "rgba(255,255,255,0.1)"}`, background: sel ? (opt.value === "vegan" ? "rgba(22,163,74,0.12)" : opt.value === "vegetarian" ? "rgba(74,222,128,0.12)" : "rgba(244,166,35,0.12)") : "rgba(255,255,255,0.06)", color: sel ? (opt.value === "vegan" ? "#16a34a" : opt.value === "vegetarian" ? "#4ade80" : "#F4A623") : "rgba(255,255,255,0.45)", fontSize: "14px", fontWeight: sel ? 600 : 400, cursor: "pointer" }}>
                        {t(lang, opt.labelKey)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Restrictions section */}
              <div style={{ marginBottom: 28, textAlign: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 10 }}>RESTRICCIONES</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                  {restrictions.filter(r => r !== "ninguna").map(r => {
                    const opt = restrictionOptions.find(o => o.value === r);
                    return (
                      <button key={r} onClick={() => {
                        const updated = restrictions.filter(x => x !== r);
                        setRestrictions(updated); localStorage.setItem("qr_restrictions", JSON.stringify(updated));
                        if (document.cookie.includes("qr_user_id")) { fetch("/api/qr/user/update", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restrictions: updated.filter(x => x !== "ninguna") }) }).catch(() => {}); }
                      }} style={{ padding: "8px 14px", borderRadius: 50, border: "1px solid rgba(244,166,35,0.3)", background: "rgba(244,166,35,0.1)", color: "#F4A623", fontSize: "14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                        {r === "_spicy" ? t(lang, "gWithoutSpicy") : opt?.labelKey ? t(lang, opt.labelKey as any) : opt?.label || `Sin ${r}`}
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#F4A623" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
                      </button>
                    );
                  })}
                  <button onClick={() => setShowAddRestriction(prev => !prev)} style={{ padding: "8px 14px", borderRadius: 50, border: "1px dashed rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)", fontSize: "14px", cursor: "pointer" }}>
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
                      return true;
                    }).map(r => (
                      <button key={r.value} onClick={() => {
                        const updated = [...restrictions.filter(x => x !== "ninguna"), r.value];
                        setRestrictions(updated); localStorage.setItem("qr_restrictions", JSON.stringify(updated));
                        if (document.cookie.includes("qr_user_id")) { fetch("/api/qr/user/update", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restrictions: updated.filter(x => x !== "ninguna") }) }).catch(() => {}); }
                        setShowAddRestriction(false);
                      }} style={{ padding: "8px 14px", borderRadius: 50, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)", fontSize: "14px", cursor: "pointer" }}>
                        {r.labelKey ? t(lang, r.labelKey as any) : r.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Dislikes section */}
              <div style={{ marginBottom: 28, textAlign: "center" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 10 }}>
                  <span onClick={() => setShowDislikeInfo(v => !v)} style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)", fontSize: "10px", fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>i</span>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>MOSTRAR MENOS CON</span>
                </div>
                {showDislikeInfo && (
                  <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", textAlign: "center", marginTop: -4, marginBottom: 10 }}>{t(lang, "gDislikesHint")}</p>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginBottom: 8 }}>
                  {dislikes.filter(d => !["dulce", "agridulce", "ácido", "ahumado"].includes(d)).map(d => (
                    <button key={d} onClick={() => {
                      const updated = dislikes.filter(x => x !== d);
                      setDislikes(updated); localStorage.setItem("qr_dislikes", JSON.stringify(updated));
                      if (document.cookie.includes("qr_user_id")) { fetch("/api/qr/user/update", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dislikes: updated }) }).catch(() => {}); }
                    }} style={{ padding: "8px 14px", borderRadius: 50, border: "1px solid rgba(232,100,50,0.3)", background: "rgba(232,100,50,0.1)", color: "#e86432", fontSize: "14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                      {d}
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#e86432" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
                    </button>
                  ))}
                  <button onClick={() => setShowAddDislike(prev => !prev)} style={{ padding: "8px 14px", borderRadius: 50, border: "1px dashed rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)", fontSize: "14px", cursor: "pointer" }}>
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
                      style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "white", fontSize: "14px", outline: "none", boxSizing: "border-box" as const, fontFamily: "inherit" }}
                    />
                    {dislikeResults.length > 0 ? (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, overflow: "hidden", maxHeight: 140, overflowY: "auto", zIndex: 10 }}>
                        {dislikeResults.map(r => (
                          <button key={r} onClick={() => {
                            const updated = [...dislikes, r]; setDislikes(updated); localStorage.setItem("qr_dislikes", JSON.stringify(updated));
                            if (document.cookie.includes("qr_user_id")) { fetch("/api/qr/user/update", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dislikes: updated }) }).catch(() => {}); }
                            setDislikeSearch(""); setDislikeResults([]); setShowAddDislike(false);
                          }} style={{ display: "block", width: "100%", padding: "10px 14px", background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.06)", textAlign: "left", color: "rgba(255,255,255,0.7)", fontSize: "14px", cursor: "pointer" }}>
                            {r}
                          </button>
                        ))}
                      </div>
                    ) : profileDislikeFocused && !dislikeSearch && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, overflow: "hidden", zIndex: 10 }}>
                        <p style={{ padding: "8px 14px 4px", margin: 0, fontSize: "0.68rem", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Más comunes</p>
                        {popularDislikes.filter(p => !dislikes.includes(p)).slice(0, 4).map(item => (
                          <button key={item} onClick={() => {
                            const updated = [...dislikes, item]; setDislikes(updated); localStorage.setItem("qr_dislikes", JSON.stringify(updated));
                            if (document.cookie.includes("qr_user_id")) { fetch("/api/qr/user/update", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dislikes: updated }) }).catch(() => {}); }
                            setProfileDislikeFocused(false);
                          }} style={{ display: "block", width: "100%", padding: "10px 14px", background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.06)", textAlign: "left", color: "rgba(255,255,255,0.7)", fontSize: "14px", cursor: "pointer" }}>
                            {lang === "en" ? (dislikeI18n[item.toLowerCase()]?.en || item) : lang === "pt" ? (dislikeI18n[item.toLowerCase()]?.pt || item) : item}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Save button */}
              <button onClick={() => {
                localStorage.setItem("qr_diet", dietType || ""); localStorage.setItem("qr_restrictions", JSON.stringify(restrictions)); localStorage.setItem("qr_dislikes", JSON.stringify(dislikes));
                if (document.cookie.includes("qr_user_id")) { fetch("/api/qr/user/update", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dietType, restrictions: restrictions.filter(x => x !== "ninguna"), dislikes }) }).catch(() => {}); }
                trackStat(restaurantId, "GENIO_COMPLETE", undefined, genioSessionId);
                setVisible(false); setTimeout(onClose, 200);
              }} className="active:scale-95 transition-transform" style={{ background: "#F4A623", color: "#0e0e0e", border: "none", borderRadius: 50, padding: "15px 40px", fontSize: "14px", fontWeight: 700, cursor: "pointer", marginBottom: 14, display: "block", margin: "0 auto 14px" }}>
                Guardar cambios
              </button>

              {/* Delete preferences */}
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)} style={{ width: "100%", background: "transparent", border: "none", color: "rgba(255,255,255,0.2)", fontSize: "13px", cursor: "pointer", fontFamily: "inherit", padding: "8px 0" }}>
                  Borrar mis preferencias
                </button>
              ) : (
                <div style={{ textAlign: "center", padding: "12px 0" }}>
                  <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", margin: "0 0 10px" }}>¿Seguro? Esto borrará todo tu perfil.</p>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                    <button onClick={() => {
                      localStorage.removeItem("qr_diet"); localStorage.removeItem("qr_restrictions"); localStorage.removeItem("qr_dislikes");
                      setDietType(null); setRestrictions([]); setDislikes([]);
                      if (document.cookie.includes("qr_user_id")) { fetch("/api/qr/user/update", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dietType: null, restrictions: [], dislikes: [] }) }).catch(() => {}); }
                      close();
                    }} style={{ padding: "8px 16px", borderRadius: 50, border: "none", background: "rgba(239,68,68,0.12)", color: "#ef4444", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                      Sí, borrar
                    </button>
                    <button onClick={() => setConfirmDelete(false)} style={{ padding: "8px 16px", borderRadius: 50, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.4)", fontSize: "12px", cursor: "pointer" }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <span style={{ fontSize: "3rem", animation: "genioPulse 2s ease-in-out infinite" }}>🧞</span>
              <h1 className="font-[family-name:var(--font-playfair)] text-center" style={{ fontSize: "2rem", fontWeight: 900, color: "white" }}>
                {t(lang, "gHelloGenius")}
              </h1>
              <p className="text-center" style={{ color: "rgba(255,255,255,0.6)", fontSize: "1rem", maxWidth: 280, lineHeight: 1.5 }}>
                {t(lang, "gTellMeRecommend")}
              </p>
              <button onClick={() => { trackStat(restaurantId, "GENIO_STEP_DIET", undefined, genioSessionId); setStep(1); }} className="active:scale-95 transition-transform" style={{ marginTop: 8, background: "#F4A623", color: "#0e0e0e", fontSize: "1rem", fontWeight: 700, padding: "14px 32px", borderRadius: 50, border: "none" }}>
                {t(lang, "gStartBtn")}
              </button>
            </>
          )}
        </div>

        {/* STEP 1 — Diet type */}
        <div style={{ minWidth: "100%", display: "flex", flexDirection: "column", padding: "100px 24px 40px" }}>
          <h2 className="font-[family-name:var(--font-playfair)] text-center" style={{ fontSize: "1.6rem", fontWeight: 900, color: "white", marginBottom: 28 }}>
            {t(lang, "gDietQuestion")}
          </h2>
          <div className="flex flex-col" style={{ gap: 12 }}>
            {DIET_OPTIONS.map((opt) => {
              const sel = dietType === opt.value;
              const Icon = opt.icon;
              return (
                <button key={opt.value} onClick={() => {
                  setDietType(opt.value); localStorage.setItem("qr_diet", opt.value);
                  if (document.cookie.includes("qr_user_id")) { fetch("/api/qr/user/update", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dietType: opt.value }) }).catch(() => {}); }
                  setTimeout(next, 400);
                }}
                  className="flex items-center gap-4 transition-all duration-200"
                  style={{ padding: "16px 20px", borderRadius: 14, border: `1px solid ${sel ? "#F4A623" : "rgba(255,255,255,0.12)"}`, background: sel ? "rgba(244,166,35,0.08)" : "rgba(255,255,255,0.05)" }}>
                  <Icon size={20} color="#F4A623" />
                  <span style={{ color: "white", fontSize: "1.1rem", fontWeight: 600 }}>{t(lang, opt.labelKey)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 2 — Restrictions */}
        <div style={{ minWidth: "100%", display: "flex", flexDirection: "column", padding: "100px 24px 120px", position: "relative" }}>
          <h2 className="font-[family-name:var(--font-playfair)] text-center" style={{ fontSize: "1.6rem", fontWeight: 900, color: "white", marginBottom: 28 }}>
            {t(lang, "gResQuestion")}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {restrictionOptions.filter(r => {
              if (r.value === "ninguna" || r.value === "_spicy") return true;
              // Hide animal-product restrictions for vegans/vegetarians
              const animalRestrictions = ["mariscos", "cerdo", "pescado"];
              const dairyEggRestrictions = ["lactosa", "huevo"];
              if (dietType === "vegan") return !animalRestrictions.includes(r.value) && !dairyEggRestrictions.includes(r.value);
              if (dietType === "vegetarian") return !animalRestrictions.includes(r.value);
              return true;
            }).map((r) => {
              const sel = restrictions.includes(r.value);
              const Icon = r.icon;
              return (
                <button key={r.value} onClick={() => toggleRestriction(r.value)}
                  className="flex items-center gap-3 transition-all duration-200"
                  style={{ padding: "12px 16px", borderRadius: 50, border: `1px solid ${sel ? "#F4A623" : "rgba(255,255,255,0.15)"}`, background: sel ? "rgba(244,166,35,0.1)" : "transparent", color: sel ? "#F4A623" : "rgba(255,255,255,0.7)", fontSize: "1.05rem", fontWeight: 500 }}>
                  <Icon size={16} />
                  {r.labelKey ? t(lang, r.labelKey as any) : r.label}
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
              style={{ marginTop: 24, alignSelf: "center", background: "#F4A623", color: "#0e0e0e", fontSize: "0.95rem", fontWeight: 700, padding: "14px 32px", borderRadius: 50, border: "none" }}
            >
              {t(lang, "gContinueBtn")}
            </button>
          )}
        </div>

        {/* STEP 3 — Dislikes */}
        <div style={{ minWidth: "100%", display: "flex", flexDirection: "column", padding: "100px 32px 120px", position: "relative" }}>
          <h2 className="font-[family-name:var(--font-playfair)] text-center" style={{ fontSize: "1.5rem", fontWeight: 900, color: "white", marginBottom: 8 }}>
            {t(lang, "gDislikesQuestion")}
          </h2>
          <p className="text-center" style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.85rem", marginBottom: 20, lineHeight: 1.5 }}>
            {t(lang, "gDislikesHint")}
          </p>

          {/* Selected dislikes */}
          {dislikes.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 16 }}>
              {dislikes.map(d => (
                <button key={d} onClick={() => {
                  setDislikes(prev => { const updated = prev.filter(x => x !== d); localStorage.setItem("qr_dislikes", JSON.stringify(updated)); return updated; });
                }} className="transition-all duration-200" style={{ padding: "7px 16px", borderRadius: 50, border: "1px solid #F4A623", background: "rgba(244,166,35,0.1)", color: "#F4A623", fontSize: "0.92rem", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                  {d} <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>✕</span>
                </button>
              ))}
            </div>
          )}

          {/* Search input with popular suggestions */}
          <div style={{ position: "relative", marginBottom: 16 }}>
            <input
              value={dislikeSearch} onChange={e => setDislikeSearch(e.target.value)}
              onFocus={() => setDislikeInputFocused(true)}
              onBlur={() => setTimeout(() => setDislikeInputFocused(false), 200)}
              placeholder={t(lang, "gSearchIngredient")}
              className="genio-input"
              style={{ width: "100%", padding: "12px 16px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: "white", fontSize: "0.95rem", outline: "none", boxSizing: "border-box" as const, fontFamily: "inherit" }}
            />
            {/* Search results */}
            {dislikeResults.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, overflow: "hidden", zIndex: 10, maxHeight: 180, overflowY: "auto" }}>
                {dislikeResults.map(r => (
                  <button key={r} onClick={() => {
                    setDislikes(prev => { const updated = [...prev, r]; localStorage.setItem("qr_dislikes", JSON.stringify(updated)); return updated; });
                    setDislikeSearch(""); setDislikeResults([]);
                  }} style={{ display: "block", width: "100%", padding: "11px 16px", background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.08)", textAlign: "left", color: "rgba(255,255,255,0.8)", fontSize: "0.92rem", cursor: "pointer" }}>
                    {r}
                  </button>
                ))}
              </div>
            )}
            {/* Popular suggestions when focused and no search */}
            {dislikeInputFocused && !dislikeSearch && dislikeResults.length === 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, overflow: "hidden", zIndex: 10 }}>
                <p style={{ padding: "8px 16px 4px", margin: 0, fontSize: "0.68rem", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Más comunes</p>
                {popularDislikes.filter(p => !dislikes.includes(p)).slice(0, 4).map(item => (
                  <button key={item} onClick={() => {
                    setDislikes(prev => { const updated = [...prev, item]; localStorage.setItem("qr_dislikes", JSON.stringify(updated)); return updated; });
                  }} style={{ display: "block", width: "100%", padding: "10px 16px", background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.06)", textAlign: "left", color: "rgba(255,255,255,0.7)", fontSize: "0.92rem", cursor: "pointer" }}>
                    {lang === "en" ? (dislikeI18n[item.toLowerCase()]?.en || item) : lang === "pt" ? (dislikeI18n[item.toLowerCase()]?.pt || item) : item}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => {
              localStorage.setItem("qr_dislikes", JSON.stringify(dislikes));
              // Sync dislikes to DB if logged in
              if (document.cookie.includes("qr_user_id")) {
                fetch("/api/qr/user/update", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dislikes }) }).catch(() => {});
              }
              next();
            }}
            className="active:scale-95 transition-transform"
            style={{ marginTop: 24, alignSelf: "center", background: "#F4A623", color: "#0e0e0e", fontSize: "0.95rem", fontWeight: 700, padding: "14px 32px", borderRadius: 50, border: "none" }}
          >
            {dislikes.length === 0 ? t(lang, "gNothingDisliked") : t(lang, "gContinueBtn")}
          </button>
        </div>

        {/* STEP 4 — Done: carta personalizada */}
        <div style={{ minWidth: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 28px 44px" }}>
          {/* Genio + Sparkles icon */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
            <span style={{ fontSize: "2.2rem" }}>🧞</span>
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
              <path d="M26 4L28.5 16.5L41 14L31 26L41 38L28.5 35.5L26 48L23.5 35.5L11 38L21 26L11 14L23.5 16.5L26 4Z" fill="#F4A623" fillOpacity="1" />
              <path d="M8 8L9.5 13.5L15 12L11 16L15 20L9.5 18.5L8 24L6.5 18.5L1 20L5 16L1 12L6.5 13.5L8 8Z" fill="#F4A623" fillOpacity="0.9" />
              <path d="M42 32L43 35.5L46.5 35L44 37L46.5 39L43 38.5L42 42L41 38.5L37.5 39L40 37L37.5 35L41 35.5L42 32Z" fill="#F4A623" fillOpacity="0.6" />
            </svg>
          </div>

          {/* Title */}
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: "26px", fontWeight: 700, color: "white", lineHeight: 1.15, letterSpacing: "-0.5px", textAlign: "center", marginBottom: 10 }}>
            Tu carta está personalizada
          </h1>

          {/* Subtitle */}
          <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.4)", lineHeight: 1.65, textAlign: "center", marginBottom: 32 }}>
            Ordenamos los platos según tus gustos
          </p>

          {/* Tip card */}
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", textAlign: "left", padding: "16px 18px", borderRadius: 16, background: "rgba(244,166,35,0.08)", border: "1px solid rgba(244,166,35,0.2)", marginBottom: 28, width: "100%", maxWidth: 320 }}>
            <span style={{ fontSize: "20px", flexShrink: 0, marginTop: 1 }}>👍</span>
            <div>
              <p style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 600, color: "rgba(255,255,255,0.85)", lineHeight: 1.3 }}>
                Toca el pulgar en los platos que te gusten
              </p>
              <p style={{ margin: 0, fontSize: "14px", color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>
                El Genio aprende y afina tu carta cada vez mejor para ti.
              </p>
            </div>
          </div>

          {/* Birthday — optional */}
          <div style={{ width: "100%", maxWidth: 320, marginBottom: 20, textAlign: "left" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "14px", color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>
              <span>🎂</span> ¿Cuándo es tu cumpleaños?
            </label>
            <input
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              className="genio-input"
              style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "white", fontSize: "15px", outline: "none", boxSizing: "border-box" }}
            />
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.25)" }}>Te tendremos un regalo especial 🎁</p>
          </div>

          {/* Button */}
          <button
            onClick={() => {
              trackStat(restaurantId, "GENIO_COMPLETE", undefined, genioSessionId);
              // Save birthday if provided
              if (birthday && document.cookie.includes("qr_user_id")) {
                fetch("/api/qr/user/update", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ birthDate: birthday }),
                }).catch(() => {});
              }
              setVisible(false);
              setTimeout(onClose, 200);
            }}
            className="active:scale-95 transition-transform"
            style={{ width: "100%", maxWidth: 320, background: "#F4A623", color: "#0e0e0e", fontSize: "15px", fontWeight: 700, padding: "16px", borderRadius: 50, border: "none", cursor: "pointer" }}
          >
            Ver mi carta
          </button>
        </div>
      </div>


      <style>{`
        .genio-input::placeholder { color: rgba(255,255,255,0.28) !important; }
        @keyframes genioPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
