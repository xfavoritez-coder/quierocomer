"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Image from "next/image";
import type { Dish, Category } from "@prisma/client";
import PostGenioCapture from "../capture/PostGenioCapture";
import {
  X, UtensilsCrossed, Leaf, Sprout, Fish,
  Check, Ban, Wheat, Milk, Soup, Flame,
  Sparkles, ChevronLeft,
} from "lucide-react";

interface GenioProps {
  restaurantId: string;
  dishes: Dish[];
  categories: Category[];
  onClose: () => void;
  onResult: (dish: Dish) => void;
}

type DietType = "omnivore" | "vegetarian" | "vegan" | "pescetarian";
type HungerLevel = "light" | "normal" | "heavy";

const DIET_OPTIONS = [
  { icon: UtensilsCrossed, label: "Como de todo", value: "omnivore" as DietType },
  { icon: Leaf, label: "Vegetariano", value: "vegetarian" as DietType },
  { icon: Sprout, label: "Vegano", value: "vegan" as DietType },
  { icon: Fish, label: "Pescetariano", value: "pescetarian" as DietType },
];

const RESTRICTION_OPTIONS = [
  { icon: Check, label: "Ninguna", value: "ninguna" },
  { icon: Milk, label: "Sin lactosa", value: "lactosa" },
  { icon: Wheat, label: "Sin gluten", value: "gluten" },
  { icon: Ban, label: "Sin nueces", value: "frutos_secos" },
  { icon: Fish, label: "Sin mariscos", value: "mariscos" },
  { icon: Ban, label: "Sin cerdo", value: "cerdo" },
  { icon: Ban, label: "Sin alcohol", value: "alcohol" },
];

const HUNGER_OPTIONS = [
  { icon: Soup, label: "Poca", sub: "algo liviano", value: "light" as HungerLevel },
  { icon: UtensilsCrossed, label: "Normal", sub: "un plato está bien", value: "normal" as HungerLevel },
  { icon: Flame, label: "Mucha", sub: "entrada + plato o más", value: "heavy" as HungerLevel },
];

const FOOD_KEYWORDS = ["fondo", "principal", "pizza", "hamburguesa", "plato", "sushi", "roll", "gohan", "chirashi", "para compartir", "compartir", "street", "entrada", "aperitivo", "caliente", "clasica", "premium", "tabla"];
const SWEET_KEYWORDS = ["postre", "dulce", "kuchen", "torta", "helado"];
const DRINK_KEYWORDS = ["bebida", "trago", "cerveza", "jugo", "vino", "cocktail", "mocktail", "extra", "sour", "schop"];

function getSessionId() {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem("qr_session_id");
  if (!id) { id = crypto.randomUUID(); sessionStorage.setItem("qr_session_id", id); }
  return id;
}

function trackStat(restaurantId: string, eventType: string, dishId?: string) {
  fetch("/api/qr/stats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, restaurantId, dishId, sessionId: getSessionId() }),
  }).catch(() => {});
}

export default function GenioOnboarding({ restaurantId, dishes, categories, onClose, onResult }: GenioProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  // Load saved preferences from localStorage
  const savedDiet = typeof window !== "undefined" ? localStorage.getItem("qr_diet") : null;
  const savedRestrictions = typeof window !== "undefined" ? localStorage.getItem("qr_restrictions") : null;
  const hasSaved = !!(savedDiet && savedRestrictions);

  // Wizard state — skip to step 3 if we have saved prefs
  const [dietType, setDietType] = useState<DietType | null>(savedDiet as DietType | null);
  const [restrictions, setRestrictions] = useState<string[]>(savedRestrictions ? JSON.parse(savedRestrictions) : []);
  const [hunger, setHunger] = useState<HungerLevel | null>(null);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [photoFilter, setPhotoFilter] = useState<"platos" | "dulce" | "bebida">("platos");

  // Akinator grid: 9 dishes that evolve as you select
  const [gridDishes, setGridDishes] = useState<Dish[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [round, setRound] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [changingSlots, setChangingSlots] = useState<Set<string>>(new Set());

  // Result
  const [result, setResult] = useState<Dish | null>(null);
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set());
  const [showOverlay, setShowOverlay] = useState(false);

  const TOTAL_STEPS = 5;
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name.toLowerCase()])), [categories]);

  // Get dish pool filtered by type
  const getDishPool = useCallback((filter: string) => {
    const kws = filter === "dulce" ? SWEET_KEYWORDS : filter === "bebida" ? DRINK_KEYWORDS : FOOD_KEYWORDS;
    const filtered = dishes.filter((d) => {
      const cn = catMap.get(d.categoryId) || "";
      return kws.some((kw) => cn.includes(kw));
    });
    return (filtered.length > 0 ? filtered : dishes).filter((d) => d.photos?.length > 0);
  }, [dishes, catMap]);

  // Score a dish by affinity to liked dishes
  const scoreDish = useCallback((d: Dish) => {
    let score = 0;
    const likedDishes = dishes.filter((x) => liked.has(x.id));
    const likedCats = new Set(likedDishes.map((x) => x.categoryId));
    const likedIngr = new Set<string>();
    likedDishes.forEach((x) => {
      (x.ingredients || "").toLowerCase().split(/[,;]+/).map((s) => s.trim()).filter(Boolean).forEach((i) => likedIngr.add(i));
    });

    if (likedCats.has(d.categoryId)) score += 10;
    (d.ingredients || "").toLowerCase().split(/[,;]+/).forEach((i) => { if (likedIngr.has(i.trim())) score += 3; });
    if (d.tags?.includes("RECOMMENDED")) score += 5;
    score += Math.random() * 4;
    return score;
  }, [dishes, liked]);

  // Initialize grid when entering step 4 or changing filter
  const initGrid = useCallback((filter: string) => {
    const pool = getDishPool(filter);
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const initial = shuffled.slice(0, 9);
    setGridDishes(initial);
    setSeenIds(new Set(initial.map((d) => d.id)));
    setRound(0);
  }, [getDishPool]);

  useEffect(() => {
    if (step === 4 && gridDishes.length === 0) initGrid(photoFilter);
  }, [step, gridDishes.length, initGrid, photoFilter]);

  // Akinator: replace non-selected dishes with similar ones
  const evolveGrid = useCallback(() => {
    const pool = getDishPool(photoFilter);
    const available = pool.filter((d) => !seenIds.has(d.id) && !liked.has(d.id));

    if (available.length === 0) return; // No more dishes to show

    // Score available dishes by affinity
    const scored = available.map((d) => ({ dish: d, score: scoreDish(d) }));
    scored.sort((a, b) => b.score - a.score);

    // Replace non-selected dishes in the grid
    const newGrid = gridDishes.map((d) => {
      if (liked.has(d.id)) return d; // Keep selected ones
      const replacement = scored.shift();
      return replacement ? replacement.dish : d;
    });

    const newSeen = new Set(seenIds);
    newGrid.forEach((d) => newSeen.add(d.id));

    // Show skeleton on slots that will change
    const changingIds = new Set(gridDishes.filter((d) => !liked.has(d.id)).map((d) => d.id));
    setChangingSlots(changingIds);
    setAnimating(true);

    setTimeout(() => {
      setGridDishes(newGrid);
      setSeenIds(newSeen);
      setRound((r) => r + 1);
      setTimeout(() => {
        setChangingSlots(new Set());
        setAnimating(false);
      }, 300);
    }, 400);
  }, [getDishPool, photoFilter, seenIds, liked, gridDishes, scoreDish]);

  // Dominant category detection
  const dominantCategory = useMemo(() => {
    if (liked.size < 3) return null;
    const catCounts: Record<string, number> = {};
    liked.forEach((id) => {
      const dish = dishes.find((d) => d.id === id);
      if (dish) {
        const cn = catMap.get(dish.categoryId) || "otro";
        catCounts[cn] = (catCounts[cn] || 0) + 1;
      }
    });
    const sorted = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || null;
  }, [liked, dishes, catMap]);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    document.body.style.overflow = "hidden";
    trackStat(restaurantId, "GENIO_START");
    return () => { document.body.style.overflow = ""; };
  }, [restaurantId]);

  // Show overlay when the Genio has enough confidence
  const [overlayDismissed, setOverlayDismissed] = useState(false);
  const [dismissedAt, setDismissedAt] = useState(0);
  useEffect(() => {
    if (liked.size >= 4 && !overlayDismissed) {
      setShowOverlay(true);
    } else if (overlayDismissed && liked.size > dismissedAt) {
      // Check category concentration of ALL selections
      const likedDishes = dishes.filter((d) => liked.has(d.id));
      const catCounts: Record<string, number> = {};
      likedDishes.forEach((d) => {
        catCounts[d.categoryId] = (catCounts[d.categoryId] || 0) + 1;
      });
      const topCount = Math.max(...Object.values(catCounts), 0);
      const concentration = likedDishes.length > 0 ? topCount / likedDishes.length : 0;

      // High confidence (>60% same category) → show after 2 more
      // Low confidence (scattered) → show after 4 more
      const threshold = concentration >= 0.6 ? 2 : 4;
      if (liked.size >= dismissedAt + threshold) {
        setShowOverlay(true);
        setOverlayDismissed(false);
      }
    }
  }, [liked.size, overlayDismissed, dismissedAt, dishes, liked]);

  // Reset grid when filter changes
  useEffect(() => {
    if (step === 4) initGrid(photoFilter);
  }, [photoFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 200);
  }, [onClose]);

  const next = () => setStep((s) => s + 1);

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

  const toggleLike = (id: string) => {
    const wasLiked = liked.has(id);
    setLiked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
    // If selecting (not deselecting), evolve after a short delay
    if (!wasLiked) {
      setTimeout(evolveGrid, 600);
    }
  };

  // Scoring algorithm (inspired by genie-recommendations.ts)
  const recommend = () => {
    // 1. Build ingredient/category profile from liked dishes
    const likedDishes = dishes.filter((d) => liked.has(d.id));
    const likedCats = new Set(likedDishes.map((d) => d.categoryId));
    const likedIngredients = new Set<string>();
    likedDishes.forEach((d) => {
      (d.ingredients || "").toLowerCase().split(/[,;]+/).map((s) => s.trim()).filter(Boolean).forEach((i) => likedIngredients.add(i));
    });

    // 2. Score all candidates
    let candidates = dishes.filter((d) => !liked.has(d.id) && !usedIds.has(d.id));

    // Filter by restrictions
    if (!restrictions.includes("ninguna") && restrictions.length > 0) {
      candidates = candidates.filter((d) => {
        const info = `${d.allergens || ""} ${d.ingredients || ""}`.toLowerCase();
        if (restrictions.includes("gluten") && info.includes("gluten")) return false;
        if (restrictions.includes("lactosa") && (info.includes("lácteo") || info.includes("queso") || info.includes("crema"))) return false;
        if (restrictions.includes("mariscos") && (info.includes("marisco") || info.includes("camarón"))) return false;
        if (restrictions.includes("cerdo") && (info.includes("cerdo") || info.includes("tocino") || info.includes("jamón"))) return false;
        if (restrictions.includes("frutos_secos") && (info.includes("almendra") || info.includes("nuez") || info.includes("maní"))) return false;
        return true;
      });
    }

    // Score each candidate
    const scored = candidates.map((d) => {
      let score = 0;
      const cn = catMap.get(d.categoryId) || "";

      // Category match (+20 if same category as any liked dish)
      if (likedCats.has(d.categoryId)) score += 20;

      // Ingredient overlap (+5 per shared ingredient)
      const dishIngr = (d.ingredients || "").toLowerCase().split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
      dishIngr.forEach((i) => { if (likedIngredients.has(i)) score += 5; });

      // RECOMMENDED boost (+10)
      if (d.tags?.includes("RECOMMENDED")) score += 10;

      // Hunger alignment
      if (hunger === "light") {
        if (cn.includes("entrada") || cn.includes("aperitivo")) score += 8;
      } else if (hunger === "heavy") {
        score += Math.min(d.price / 5000, 5); // Higher price = more substantial
      } else {
        if (cn.includes("fondo") || cn.includes("pizza") || cn.includes("hamburguesa") || cn.includes("sushi")) score += 8;
      }

      // Has photo bonus
      if (d.photos?.length > 0) score += 2;

      // Small random factor
      score += Math.random() * 3;

      return { dish: d, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const pick = scored[0]?.dish;

    if (pick) {
      setResult(pick);
      setUsedIds((prev) => new Set([...prev, pick.id]));
      trackStat(restaurantId, "GENIO_COMPLETE", pick.id);
    }
    setShowOverlay(false);
    setStep(5); // Go to result (virtual step beyond slides)
  };

  const surpriseMe = () => {
    const withPhotos = dishes.filter((d) => d.photos?.length > 0);
    const pick = withPhotos[Math.floor(Math.random() * withPhotos.length)] || dishes[0];
    if (pick) {
      setResult(pick);
      trackStat(restaurantId, "GENIO_COMPLETE", pick.id);
    }
    setStep(5);
  };

  const retryRecommend = () => {
    const candidates = dishes.filter((d) => !usedIds.has(d.id) && d.photos?.length > 0);
    const pick = candidates[Math.floor(Math.random() * candidates.length)] || dishes[0];
    if (pick) {
      setResult(pick);
      setUsedIds((prev) => new Set([...prev, pick.id]));
    }
  };

  const handleResult = (dish: Dish) => {
    setVisible(false);
    setTimeout(() => onResult(dish), 200);
  };

  // Random phrase index (stable per session)
  const [phraseIdx] = useState(() => Math.floor(Math.random() * 5));

  // Feedback messages
  const feedbackMsg = liked.size === 0 ? "Toca los platos que te llaman 👆"
    : liked.size === 1 ? "Sigue seleccionando..."
    : liked.size === 2 ? "Vas bien, un poco más..."
    : liked.size === 3 ? "Ya casi lo tengo... 🤔"
    : null;

  const displayStep = Math.min(step, 4); // Clamp for slide animation
  const [skipTransition, setSkipTransition] = useState(false);

  return (
    <div
      className="font-[family-name:var(--font-dm)]"
      style={{
        position: "fixed", inset: 0, zIndex: 110, background: "#0e0e0e",
        opacity: visible ? 1 : 0, transition: "opacity 0.2s ease-out", overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {step > 0 && step <= 4 ? (
          <button onClick={() => setStep((s) => s - 1)} className="flex items-center justify-center" style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "none" }}>
            <ChevronLeft size={18} color="white" />
          </button>
        ) : (
          <div style={{ width: 34 }} />
        )}
        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.82rem", fontWeight: 500 }}>
          {step === 0 ? "" : step <= 4 ? `Paso ${step} de 4` : "✨ Resultado"}
        </span>
        <button onClick={close} className="flex items-center justify-center" style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "none" }}>
          <X size={16} color="white" />
        </button>
      </div>

      {/* Progress bar */}
      {step >= 1 && step <= 4 && (
        <div style={{ position: "absolute", top: 62, left: 20, right: 20, zIndex: 20, display: "flex", gap: 4 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? "#F4A623" : "rgba(255,255,255,0.15)", transition: "background 0.3s" }} />
          ))}
        </div>
      )}

      {/* Steps container */}
      <div style={{ position: "absolute", inset: 0, display: "flex", transform: `translateX(${-displayStep * 100}%)`, transition: skipTransition ? "none" : "transform 0.3s ease-out" }}>

        {/* STEP 0 — Welcome or Welcome Back */}
        <div style={{ minWidth: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px", gap: 16 }}>
          {hasSaved ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: "2.4rem" }}>🧞</span>
                <Sparkles size={36} color="#F4A623" />
              </div>
              <h1 className="font-[family-name:var(--font-playfair)] text-center" style={{ fontSize: "1.8rem", fontWeight: 900, color: "white" }}>
                Bienvenido de nuevo
              </h1>
              <p className="text-center" style={{ color: "rgba(255,255,255,0.6)", fontSize: "1rem", maxWidth: 280, lineHeight: 1.7 }}>
                {(() => {
                  const dietLabels: Record<string, string> = { omnivore: "comes de todo", vegetarian: "eres vegetariano", vegan: "eres vegano", pescetarian: "eres pescetariano" };
                  const dietText = savedDiet ? dietLabels[savedDiet] || "" : "";
                  const resList: string[] = savedRestrictions ? JSON.parse(savedRestrictions) : [];
                  const filtered = resList.filter((r: string) => r !== "ninguna");
                  const resText = filtered.length > 0
                    ? filtered.length === 1 ? filtered[0] : filtered.slice(0, -1).join(", ") + " y " + filtered[filtered.length - 1]
                    : "";
                  if (dietText && resText) return <>Recuerdo que <span style={{ color: "#F4A623" }}>{dietText}</span> y que evitas <span style={{ color: "#F4A623" }}>{resText}</span>.</>;
                  if (dietText) return <>Recuerdo que <span style={{ color: "#F4A623" }}>{dietText}</span>.</>;
                  if (resText) return <>Recuerdo que evitas <span style={{ color: "#F4A623" }}>{resText}</span>.</>;
                  return "Dime qué se te antoja.";
                })()}
              </p>
              <div className="flex flex-col items-center" style={{ gap: 12, marginTop: 16 }}>
                <button onClick={() => { setSkipTransition(true); setStep(3); requestAnimationFrame(() => requestAnimationFrame(() => setSkipTransition(false))); }} className="active:scale-95 transition-transform" style={{ background: "#F4A623", color: "#0e0e0e", fontSize: "0.95rem", fontWeight: 700, padding: "14px 32px", borderRadius: 50, border: "none" }}>
                  Continuar →
                </button>
                <button onClick={() => { localStorage.removeItem("qr_diet"); localStorage.removeItem("qr_restrictions"); setDietType(null); setRestrictions([]); setStep(1); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: "0.85rem" }}>
                  Cambiar preferencias
                </button>
              </div>
            </>
          ) : (
            <>
              <span style={{ fontSize: "3rem", animation: "genioPulse 2s ease-in-out infinite" }}>🧞</span>
              <h1 className="font-[family-name:var(--font-playfair)] text-center" style={{ fontSize: "2rem", fontWeight: 900, color: "white" }}>
                Hola, soy el Genio
              </h1>
              <p className="text-center" style={{ color: "rgba(255,255,255,0.6)", fontSize: "1rem", maxWidth: 280, lineHeight: 1.5 }}>
                Dime qué se te antoja y te recomiendo el plato perfecto
              </p>
              <button onClick={() => setStep(1)} className="active:scale-95 transition-transform" style={{ marginTop: 8, background: "#F4A623", color: "#0e0e0e", fontSize: "1rem", fontWeight: 700, padding: "14px 32px", borderRadius: 50, border: "none" }}>
                Empezar →
              </button>
              <button onClick={surpriseMe} className="active:scale-95 transition-transform" style={{ marginTop: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.25)", color: "rgba(255,255,255,0.7)", fontSize: "0.9rem", fontWeight: 500, padding: "12px 28px", borderRadius: 50 }}>
                🎲 Sorpréndeme
              </button>
            </>
          )}
        </div>

        {/* STEP 1 — Diet type */}
        <div style={{ minWidth: "100%", display: "flex", flexDirection: "column", padding: "100px 24px 40px" }}>
          <h2 className="font-[family-name:var(--font-playfair)] text-center" style={{ fontSize: "1.6rem", fontWeight: 900, color: "white", marginBottom: 28 }}>
            ¿Qué tipo de alimentación tienes?
          </h2>
          <div className="flex flex-col" style={{ gap: 12 }}>
            {DIET_OPTIONS.map((opt) => {
              const sel = dietType === opt.value;
              const Icon = opt.icon;
              return (
                <button key={opt.value} onClick={() => { setDietType(opt.value); localStorage.setItem("qr_diet", opt.value); setTimeout(next, 400); }}
                  className="flex items-center gap-4 transition-all duration-200"
                  style={{ padding: "16px 20px", borderRadius: 14, border: `1px solid ${sel ? "#F4A623" : "rgba(255,255,255,0.12)"}`, background: sel ? "rgba(244,166,35,0.08)" : "rgba(255,255,255,0.05)" }}>
                  <Icon size={20} color="#F4A623" />
                  <span style={{ color: "white", fontSize: "1.1rem", fontWeight: 600 }}>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 2 — Restrictions */}
        <div style={{ minWidth: "100%", display: "flex", flexDirection: "column", padding: "100px 24px 120px", position: "relative" }}>
          <h2 className="font-[family-name:var(--font-playfair)] text-center" style={{ fontSize: "1.6rem", fontWeight: 900, color: "white", marginBottom: 28 }}>
            ¿Tienes alguna restricción?
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {RESTRICTION_OPTIONS.map((r) => {
              const sel = restrictions.includes(r.value);
              const Icon = r.icon;
              return (
                <button key={r.value} onClick={() => toggleRestriction(r.value)}
                  className="flex items-center gap-3 transition-all duration-200"
                  style={{ padding: "12px 16px", borderRadius: 50, border: `1px solid ${sel ? "#F4A623" : "rgba(255,255,255,0.15)"}`, background: sel ? "rgba(244,166,35,0.1)" : "transparent", color: sel ? "#F4A623" : "rgba(255,255,255,0.7)", fontSize: "1.05rem", fontWeight: 500 }}>
                  <Icon size={16} />
                  {r.label}
                </button>
              );
            })}
          </div>
          {restrictions.length > 0 && !restrictions.includes("ninguna") && (
            <button
              onClick={() => { localStorage.setItem("qr_restrictions", JSON.stringify(restrictions)); next(); }}
              className="active:scale-95 transition-transform"
              style={{ marginTop: 24, alignSelf: "center", background: "#F4A623", color: "#0e0e0e", fontSize: "0.95rem", fontWeight: 700, padding: "14px 32px", borderRadius: 50, border: "none" }}
            >
              Continuar →
            </button>
          )}
        </div>

        {/* STEP 3 — Hunger */}
        <div style={{ minWidth: "100%", display: "flex", flexDirection: "column", padding: "100px 24px 40px" }}>
          <h2 className="font-[family-name:var(--font-playfair)] text-center" style={{ fontSize: "1.6rem", fontWeight: 900, color: "white", marginBottom: 28 }}>
            ¿Cuánta hambre tienes?
          </h2>
          <div className="flex flex-col" style={{ gap: 12 }}>
            {HUNGER_OPTIONS.map((h) => {
              const sel = hunger === h.value;
              const Icon = h.icon;
              return (
                <button key={h.value} onClick={() => { setHunger(h.value); setTimeout(next, 400); }}
                  className="flex items-center gap-4 transition-all duration-200"
                  style={{ padding: "18px 20px", borderRadius: 14, border: `1px solid ${sel ? "#F4A623" : "rgba(255,255,255,0.12)"}`, background: sel ? "rgba(244,166,35,0.08)" : "rgba(255,255,255,0.05)" }}>
                  <Icon size={22} color="#F4A623" style={{ flexShrink: 0 }} />
                  <div style={{ textAlign: "left" }}>
                    <span style={{ color: "white", fontSize: "1.15rem", fontWeight: 700, display: "block", lineHeight: 1.3 }}>{h.label}</span>
                    <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.95rem", display: "block", marginTop: 2 }}>{h.sub}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 4 — Akinator photo grid */}
        <div style={{ minWidth: "100%", display: "flex", flexDirection: "column", padding: "78px 16px 20px", position: "relative" }}>
          {/* Category filter pills */}
          <div className="flex" style={{ gap: 8, marginBottom: 10, justifyContent: "center" }}>
            {(["platos", "bebida", "dulce"] as const).map((f) => {
              const active = photoFilter === f;
              return (
                <button key={f} onClick={() => setPhotoFilter(f)}
                  style={{ padding: "6px 16px", borderRadius: 50, fontSize: "0.82rem", fontWeight: 500, border: active ? "none" : "1px solid rgba(255,255,255,0.2)", background: active ? "white" : "transparent", color: active ? "#0e0e0e" : "rgba(255,255,255,0.5)" }}>
                  {f === "platos" ? "Platos" : f === "dulce" ? "Postre" : "Bebestible"}
                </button>
              );
            })}
          </div>

          {/* Selected counter */}
          {liked.size > 0 && (
            <div className="flex items-center justify-center" style={{ marginBottom: 8, gap: 6 }}>
              <div style={{ background: "#F4A623", color: "#0e0e0e", width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", fontWeight: 700 }}>
                {liked.size}
              </div>
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" }}>
                {liked.size === 1 ? "plato seleccionado" : "platos seleccionados"}
              </span>
            </div>
          )}

          {/* 3x3 Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {gridDishes.map((d) => {
              const sel = liked.has(d.id);
              const photo = d.photos?.[0];
              const isChanging = changingSlots.has(d.id);
              const isNew = !sel && animating && !isChanging;
              return (
                <div key={`slot-${d.id}`}
                  className="relative overflow-hidden"
                  style={{ aspectRatio: "1", borderRadius: 10, background: "#222" }}>
                  {isChanging ? (
                    <div className="absolute" style={{ inset: 0, borderRadius: 10, background: "#1a1a1a", overflow: "hidden" }}>
                      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)", backgroundSize: "200% 100%", animation: "shimmerSlide 1.2s ease-in-out infinite" }} />
                    </div>
                  ) : (
                <button onClick={() => toggleLike(d.id)}
                  className="relative overflow-hidden w-full h-full"
                  style={{
                    aspectRatio: "1", borderRadius: 10, padding: 0, background: "#222", border: "none",
                    animation: isNew ? "fadeScale 0.3s ease-out" : undefined,
                  }}>
                  <div className="absolute" style={{ inset: 0, background: "#333" }} />
                  {photo && <Image src={photo} alt={d.name} fill className="object-cover" sizes="33vw" style={{ position: "absolute", zIndex: 1 }} />}
                  <div className="absolute flex items-center justify-center" style={{ top: 6, right: 6, width: 26, height: 26, borderRadius: "50%", background: sel ? "#F4A623" : "rgba(255,255,255,0.2)", border: sel ? "none" : "2px solid rgba(255,255,255,0.5)", transition: "all 0.15s", zIndex: 3 }}>
                    {sel && <Check size={14} color="#0e0e0e" strokeWidth={3} />}
                  </div>
                  <div className="absolute" style={{ bottom: 0, left: 0, right: 0, height: "45%", background: "linear-gradient(to top, rgba(0,0,0,0.75), transparent)", zIndex: 2 }} />
                  <span className="absolute" style={{ bottom: 4, left: 5, right: 5, color: "white", fontSize: "0.8rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", zIndex: 3 }}>
                    {d.name}
                  </span>
                  {sel && (
                    <div className="absolute" style={{ inset: 0, background: "rgba(244,166,35,0.15)", borderRadius: 10, zIndex: 2 }} />
                  )}
                </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Round indicator */}
          {round > 0 && (
            <p className="text-center" style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.95rem", marginTop: 10 }}>
              🧞 El Genio está aprendiendo...
            </p>
          )}

          {/* Feedback / action */}
          {!showOverlay && (
            <div className="text-center" style={{ marginTop: 8 }}>
              {liked.size === 0 && (
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.82rem" }}>Toca los platos que te llaman 👆</p>
              )}
              {liked.size === 1 && (
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.82rem" }}>Sigue seleccionando...</p>
              )}
              {liked.size === 2 && (
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.82rem" }}>Vas bien, un poco más...</p>
              )}
              {liked.size === 3 && (
                <p style={{ color: "white", fontSize: "0.82rem" }}>Ya casi lo tengo... 🤔</p>
              )}
            </div>
          )}

          {/* 4+ overlay */}
          {showOverlay && liked.size >= 4 && (
            <div className="absolute flex flex-col items-center justify-center" style={{ inset: 0, background: "rgba(14,14,14,0.92)", zIndex: 30, padding: 32, gap: 12 }}>
              <Sparkles size={32} color="#F4A623" style={{ animation: "genioPulse 2s ease-in-out infinite" }} />
              <h3 className="font-[family-name:var(--font-playfair)] text-center" style={{ fontSize: "1.3rem", color: "white", fontWeight: 800, lineHeight: 1.3 }}>
                {dominantCategory
                  ? [
                      `Parece que estás antojado de ${dominantCategory}`,
                      `Se nota que te gusta el ${dominantCategory}`,
                      `Estás con ganas de ${dominantCategory}`,
                      `El ${dominantCategory} te llama la atención`,
                      `Veo que te tienta el ${dominantCategory}`,
                    ][phraseIdx]
                  : "Tienes buen gusto"}
              </h3>
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem" }}>
                {liked.size} platos seleccionados
              </span>
              <button onClick={recommend} className="active:scale-95 transition-transform"
                style={{ marginTop: 8, background: "#F4A623", color: "#0e0e0e", fontSize: "1rem", fontWeight: 700, padding: "15px 28px", borderRadius: 50, border: "none" }}>
                Ver sugerencia del Genio →
              </button>
              <button onClick={() => { setShowOverlay(false); setOverlayDismissed(true); setDismissedAt(liked.size); }}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: "0.85rem", marginTop: 4 }}>
                Quiero seguir viendo platos
              </button>
            </div>
          )}
        </div>
      </div>


      {/* RESULT — overlays everything when step === 5 */}
      {step === 5 && result && (
        <div className="absolute flex flex-col items-center justify-center" style={{ inset: 0, zIndex: 30, background: "#0e0e0e", padding: "60px 20px 40px", gap: 16 }}>
          {/* Back + Close buttons */}
          <button onClick={() => setStep(4)} className="absolute flex items-center justify-center" style={{ top: 16, left: 20, width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "none", zIndex: 10 }}>
            <ChevronLeft size={18} color="white" />
          </button>
          <button onClick={close} className="absolute flex items-center justify-center" style={{ top: 16, right: 20, width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "none", zIndex: 10 }}>
            <X size={16} color="white" />
          </button>
          {/* Genio icon */}
          <span style={{ fontSize: "3rem", marginBottom: 4 }}>🧞</span>
          <span style={{ color: "#F4A623", fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            El Genio recomienda
          </span>
          <div className="relative overflow-hidden" style={{ width: "calc(100% - 40px)", maxWidth: 320, aspectRatio: "4/3", borderRadius: 16 }}>
            {result.photos?.[0] && <Image src={result.photos[0]} alt={result.name} fill className="object-cover" sizes="80vw" />}
          </div>
          <h2 className="font-[family-name:var(--font-playfair)] text-center" style={{ fontSize: "1.6rem", fontWeight: 900, color: "white", lineHeight: 1.2 }}>
            {result.name}
          </h2>
          <span style={{ color: "#F4A623", fontSize: "1.3rem", fontWeight: 800 }}>
            ${(result.discountPrice || result.price).toLocaleString("es-CL")}
          </span>
          {result.description && (
            <p className="text-center line-clamp-2" style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.88rem", lineHeight: 1.5, maxWidth: 300 }}>
              {result.description}
            </p>
          )}
          <button onClick={() => handleResult(result)} className="active:scale-95 transition-transform"
            style={{ marginTop: 8, background: "#F4A623", color: "#0e0e0e", fontSize: "1rem", fontWeight: 700, padding: "14px 28px", borderRadius: 50, border: "none" }}>
            Ver en la carta ↓
          </button>
          <button onClick={retryRecommend} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: "0.85rem" }}>
            Recomendar otro
          </button>
          <PostGenioCapture restaurantId={restaurantId} />
        </div>
      )}

      <style>{`
        @keyframes genioPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        @keyframes shimmerSlide {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes fadeInBtn {
          from { opacity: 0; transform: translateX(-50%) translateY(10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes fadeScale {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
