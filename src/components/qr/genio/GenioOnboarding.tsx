"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Image from "next/image";
import type { Dish, Category } from "@prisma/client";
import PostGenioCapture from "../capture/PostGenioCapture";
import DishDetail from "../carta/DishDetail";
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

const FOOD_KEYWORDS = ["fondo", "principal", "pizza", "hamburguesa", "plato", "sushi", "roll", "gohan", "chirashi", "para compartir", "compartir", "street", "entrada", "aperitivo", "caliente", "clasica", "premium", "tabla"];
const SWEET_KEYWORDS = ["postre", "dulce", "kuchen", "torta", "helado"];
const DRINK_KEYWORDS = ["bebida", "trago", "cerveza", "jugo", "vino", "cocktail", "mocktail", "extra", "sour", "schop", "café", "cafe", "coffee", "té", "te", "infusion", "agua"];

import { getGuestId, getSessionId } from "@/lib/guestId";
import { getDbSessionId } from "@/lib/sessionTracker";

function trackStat(restaurantId: string, eventType: string, dishId?: string, genioSessionId?: string) {
  fetch("/api/qr/stats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, restaurantId, dishId, genioSessionId, guestId: getGuestId(), sessionId: getSessionId(), dbSessionId: getDbSessionId() }),
  }).catch(() => {});
}

function saveIngredients(dishIds: string[], source: "genio_liked" | "genio_result" | "feedback_like" | "feedback_dislike") {
  fetch("/api/qr/ingredients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ guestId: getGuestId(), dishIds, source }),
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

  // Persisted favorite ingredients from previous sessions
  const [favIngredients, setFavIngredients] = useState<Record<string, number>>({});
  const userName = qrUserProp?.name || null;
  useEffect(() => {
    fetch(`/api/qr/ingredients?guestId=${getGuestId()}`).then(r => r.json()).then(d => {
      if (d.favorites) setFavIngredients(d.favorites);
    }).catch(() => {});
  }, []);

  // Load restrictions/allergens dynamically from DB
  const [restrictionOptions, setRestrictionOptions] = useState<RestrictionOption[]>([
    { icon: Check, labelKey: "gNone" as const, value: "ninguna" },
  ]);
  useEffect(() => {
    fetch("/api/qr/restrictions").then(r => r.json()).then((items: { name: string; type: string }[]) => {
      const opts: RestrictionOption[] = [{ icon: Check, labelKey: "gNone" as const, value: "ninguna" }];
      for (const item of items) {
        opts.push({
          icon: RESTRICTION_ICON_MAP[item.name] || Ban,
          label: `Sin ${item.name}`,
          value: item.name,
        });
      }
      // Fixed option: spicy (uses dish.isSpicy, not ingredient chain)
      opts.push({ icon: Flame, labelKey: "gWithoutSpicy" as const, value: "_spicy" });
      setRestrictionOptions(opts);
    }).catch(() => {});
  }, []);

  // Wizard state — skip to step 3 if we have saved prefs
  const [dietType, setDietType] = useState<DietType | null>(savedDiet as DietType | null);
  const [restrictions, setRestrictions] = useState<string[]>(savedRestrictions ? JSON.parse(savedRestrictions) : []);
  const [dislikes, setDislikes] = useState<string[]>(savedDislikes ? JSON.parse(savedDislikes) : []);
  const [popularDislikes, setPopularDislikes] = useState<string[]>([]);
  const [dislikeSearch, setDislikeSearch] = useState("");
  const [dislikeResults, setDislikeResults] = useState<string[]>([]);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [previewDescExpanded, setPreviewDescExpanded] = useState(false);

  // Load popular dislikes
  useEffect(() => {
    fetch("/api/qr/dislikes").then(r => r.json()).then(d => {
      if (d.popular) setPopularDislikes(d.popular);
    }).catch(() => {});
  }, []);

  // Search dislikes with debounce
  useEffect(() => {
    if (!dislikeSearch || dislikeSearch.length < 2) { setDislikeResults([]); return; }
    const timer = setTimeout(() => {
      fetch(`/api/qr/dislikes?q=${encodeURIComponent(dislikeSearch)}`).then(r => r.json()).then(d => {
        if (d.results) setDislikeResults(d.results.filter((r: string) => !dislikes.includes(r)));
      }).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [dislikeSearch, dislikes]);
  // Sync all preferences to QRUser when Genio completes (step 5)
  useEffect(() => {
    if (step !== 5) return;
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

  const [photoFilter, setPhotoFilter] = useState<"platos" | "dulce" | "bebida">("platos");

  // Akinator grid: 9 dishes that evolve as you select
  const [gridDishes, setGridDishes] = useState<Dish[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [round, setRound] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [changingSlots, setChangingSlots] = useState<Set<string>>(new Set());

  // Dish preview inside Genio (without closing)
  const [previewDish, setPreviewDish] = useState<Dish | null>(null);

  // Result — top 3 recommendations
  const [results, setResults] = useState<Dish[]>([]);
  const [resultReasons, setResultReasons] = useState<Record<string, string[]>>({});
  const [lovedIds, setLovedIds] = useState<Set<string>>(new Set());
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set());
  const [genioFeedback, setGenioFeedback] = useState<"none" | "like" | "dislike">("none");
  const [showOverlay, setShowOverlay] = useState(false);

  const TOTAL_STEPS = 5;
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name.toLowerCase()])), [categories]);
  const catTypeMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) {
      if ((c as any).dishType) { m.set(c.id, (c as any).dishType); }
      else {
        const n = c.name.toLowerCase();
        if (DRINK_KEYWORDS.some(kw => n.includes(kw))) m.set(c.id, "drink");
        else if (SWEET_KEYWORDS.some(kw => n.includes(kw))) m.set(c.id, "dessert");
        else m.set(c.id, "food");
      }
    }
    return m;
  }, [categories]);

  // Get dish pool filtered by type
  const getDishPool = useCallback((filter: string) => {
    const targetType = filter === "dulce" ? "dessert" : filter === "bebida" ? "drink" : "food";
    const filtered = dishes.filter((d) => catTypeMap.get(d.categoryId) === targetType);
    return (filtered.length > 0 ? filtered : dishes).filter((d) => d.photos?.length > 0);
  }, [dishes, catTypeMap]);

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
    // Penalize dislikes (but don't filter out)
    const dishDesc = ((d.description || "") + " " + (d.ingredients || "") + " " + d.name).toLowerCase();
    dislikes.forEach((dl) => { if (dishDesc.includes(dl)) score -= 8; });
    score += Math.random() * 4;
    return score;
  }, [dishes, liked, dislikes]);

  // Initialize grid when entering step 4 or changing filter
  const initGrid = useCallback((filter: string) => {
    const pool = getDishPool(filter);
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const initial = shuffled.slice(0, 4);
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
    trackStat(restaurantId, "GENIO_START", undefined, genioSessionId);
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

  const STEP_NAMES = ["welcome", "diet", "restrictions", "dislikes", "grid", "results"];
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

  // Helper: get ingredient list for a dish
  const getDishIngr = useCallback((d: Dish) =>
    (d.ingredients || "").toLowerCase().split(/[,;]+/).map((s) => s.trim()).filter(Boolean)
  , []);

  // Helper: check if dish is food (not drink/sweet) based on category
  const isFoodCategory = useCallback((d: Dish) => {
    return catTypeMap.get(d.categoryId) === "food";
  }, [catTypeMap]);

  // Scoring algorithm — returns top 3, same food type as photoFilter, different categories
  const recommend = () => {
    const likedDishes = dishes.filter((d) => liked.has(d.id));
    const likedCats = new Set(likedDishes.map((d) => d.categoryId));
    const likedIngredients = new Set<string>();
    likedDishes.forEach((d) => getDishIngr(d).forEach((i) => likedIngredients.add(i)));

    // Filter candidates: same food type as what user was browsing
    const targetType = photoFilter === "dulce" ? "dessert" : photoFilter === "bebida" ? "drink" : "food";
    let candidates = dishes.filter((d) => {
      if (liked.has(d.id) || usedIds.has(d.id)) return false;
      return catTypeMap.get(d.categoryId) === targetType;
    });
    // Fallback: if too few candidates, expand pool but keep same food type
    if (candidates.length < 6) {
      candidates = dishes.filter((d) => {
        if (liked.has(d.id) || usedIds.has(d.id)) return false;
        return catTypeMap.get(d.categoryId) === targetType;
      });
      // Ultimate fallback if still too few
      if (candidates.length < 3) {
        candidates = dishes.filter((d) => !liked.has(d.id) && !usedIds.has(d.id));
      }
    }

    // Filter by restrictions using structured allergen/restriction data
    if (!restrictions.includes("ninguna") && restrictions.length > 0) {
      candidates = candidates.filter((d) => {
        const dishIngs = (d as any).dishIngredients || [];
        // Collect all allergen/restriction names linked to this dish's ingredients
        const dishFlags = new Set<string>();
        for (const di of dishIngs) {
          for (const a of (di.ingredient?.allergens || [])) {
            dishFlags.add(a.name);
          }
        }
        // If the dish has any flag that matches user's restrictions, exclude it
        for (const r of restrictions) {
          if (r === "ninguna") continue;
          if (r === "_spicy" && d.isSpicy) return false;
          if (dishFlags.has(r)) return false;
        }
        return true;
      });
    }

    // Score + track matching reasons
    const reasons: Record<string, string[]> = {};
    const scored = candidates.map((d) => {
      let score = 0;
      const why: string[] = [];
      const dishIngr = getDishIngr(d);

      if (likedCats.has(d.categoryId)) { score += 20; why.push("categoría similar"); }
      const matchedIngr: string[] = [];
      dishIngr.forEach((i) => { if (likedIngredients.has(i)) { score += 5; matchedIngr.push(i); } });
      // Normalize ingredient score: avoid dishes with many common ingredients dominating
      if (dishIngr.length > 0 && matchedIngr.length > 0) {
        const overlapRatio = matchedIngr.length / dishIngr.length;
        // Reward uniqueness: dishes that are mostly unique ingredients but still match get a bonus
        score += Math.round((1 - overlapRatio) * 8);
      }
      if (matchedIngr.length > 0) why.push(matchedIngr.slice(0, 3).join(", "));
      if (d.tags?.includes("RECOMMENDED")) { score += 10; why.push("recomendado del chef"); }
      if (d.photos?.length > 0) score += 2;
      // Boost from persisted favorites
      const favMatched: string[] = [];
      dishIngr.forEach((i) => { if (favIngredients[i]) { score += Math.min(favIngredients[i], 10); favMatched.push(i); } });
      if (favMatched.length > 0 && matchedIngr.length === 0) why.push("te gusta " + favMatched.slice(0, 2).join(" y "));
      // Penalize dislikes (ingredients + flavor tags)
      const dishDesc = ((d.description || "") + " " + (d.ingredients || "") + " " + d.name).toLowerCase();
      const dishFlavors = ((d as any).flavorTags || []) as string[];
      dislikes.forEach((dl) => {
        if (dishDesc.includes(dl)) score -= 8;
        // Also penalize if dislike matches a flavor tag (e.g. "dulce", "agridulce")
        if (dishFlavors.includes(dl)) score -= 6;
      });
      score += Math.random() * 5;

      reasons[d.id] = why;
      return { dish: d, score };
    });

    scored.sort((a, b) => b.score - a.score);

    // Pick top 3: prefer diversity but allow same category for 2nd/3rd pick
    const picks: Dish[] = [];
    const pickCats = new Set<string>();
    // Pass 1: pick best from each unique category
    for (const { dish } of scored) {
      if (picks.length >= 3) break;
      if (!pickCats.has(dish.categoryId)) {
        picks.push(dish);
        pickCats.add(dish.categoryId);
      }
    }
    // Pass 2: fill remaining from top scores regardless of category
    if (picks.length < 3) {
      for (const { dish } of scored) {
        if (picks.length >= 3) break;
        if (!picks.some((p) => p.id === dish.id)) picks.push(dish);
      }
    }

    if (picks.length > 0) {
      setResults(picks);
      setResultReasons(reasons);
      setLovedIds(new Set());
      setUsedIds((prev) => new Set([...prev, ...picks.map((p) => p.id)]));
      picks.forEach((p) => trackStat(restaurantId, "GENIO_COMPLETE", p.id, genioSessionId));
      const likedIds = [...liked];
      if (likedIds.length > 0) saveIngredients(likedIds, "genio_liked");
      saveIngredients(picks.map((p) => p.id), "genio_result");
    }
    setShowOverlay(false);
    trackStat(restaurantId, "GENIO_STEP_RESULTS", undefined, genioSessionId);
    setStep(5);
  };

  const surpriseMe = () => {
    const foodDishes = dishes.filter((d) => d.photos?.length > 0 && isFoodCategory(d));
    const pool = foodDishes.length >= 3 ? foodDishes : dishes.filter((d) => d.photos?.length > 0);
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const picks = shuffled.slice(0, 3);
    if (picks.length > 0) {
      setResults(picks);
      setResultReasons({});
      setLovedIds(new Set());
      picks.forEach((p) => trackStat(restaurantId, "GENIO_COMPLETE", p.id, genioSessionId));
    }
    trackStat(restaurantId, "GENIO_STEP_RESULTS", undefined, genioSessionId);
    setStep(5);
  };

  const retryRecommend = () => {
    // Penalize rejected dish ingredients
    results.forEach((r) => {
      trackStat(restaurantId, "GENIO_DISH_REJECTED", r.id, genioSessionId);
    });
    // Save rejected ingredients with negative weight
    fetch("/api/qr/ingredients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestId: getGuestId(), dishIds: results.map((r) => r.id), source: "rejected" }),
    }).catch(() => {});

    const candidates = dishes.filter((d) => !usedIds.has(d.id) && d.photos?.length > 0);
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const picks: Dish[] = [];
    const pickCats = new Set<string>();
    for (const d of shuffled) {
      if (picks.length >= 3) break;
      if (!pickCats.has(d.categoryId) || picks.length >= 2) {
        picks.push(d);
        pickCats.add(d.categoryId);
      }
    }
    if (picks.length > 0) {
      setResults(picks);
      setResultReasons({});
      setLovedIds(new Set());
      setUsedIds((prev) => new Set([...prev, ...picks.map((p) => p.id)]));
    }
  };

  // Swap alternative to main position
  const promoteResult = (dish: Dish) => {
    setResults((prev) => {
      const without = prev.filter((p) => p.id !== dish.id);
      return [dish, ...without];
    });
  };

  // Heart/love a dish — saves ingredients with high weight
  const loveDish = (dish: Dish) => {
    setLovedIds((prev) => {
      const n = new Set(prev);
      if (n.has(dish.id)) { n.delete(dish.id); } else { n.add(dish.id); saveIngredients([dish.id], "genio_result"); }
      return n;
    });
  };

  // Final pick: user chose this dish to view in carta
  const handleResult = (dish: Dish) => {
    trackStat(restaurantId, "GENIO_DISH_ACCEPTED", dish.id, genioSessionId);
    // Save with highest weight — this is what they actually want to eat
    fetch("/api/qr/ingredients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestId: getGuestId(), dishIds: [dish.id], source: "picked" }),
    }).catch(() => {});
    setVisible(false);
    setTimeout(() => onResult(dish), 200);
  };

  const mainResult = results[0] || null;
  const altResults = results.slice(1);

  // Random phrase index (stable per session)
  const [phraseIdx] = useState(() => Math.floor(Math.random() * 5));

  // Feedback messages
  const feedbackMsg = liked.size === 0 ? t(lang, "gFeedbackTap")
    : liked.size === 1 ? t(lang, "gFeedbackKeep")
    : liked.size === 2 ? t(lang, "gFeedbackWell")
    : liked.size === 3 ? t(lang, "gFeedbackAlmost")
    : null;

  const displayStep = Math.min(step, 4); // Clamp for slide animation
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
        {step > 0 && step <= 5 ? (
          <button onClick={() => setStep((s) => s - 1)} className="flex items-center justify-center" style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "none" }}>
            <ChevronLeft size={18} color="white" />
          </button>
        ) : (
          <div style={{ width: 34 }} />
        )}
        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.82rem", fontWeight: 500 }}>
          {step === 0 ? "" : step <= 4 ? t(lang, "gStepOf").replace("{step}", String(step)) : t(lang, "gResult")}
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
              <span style={{ fontSize: "2.8rem", marginBottom: 8 }}>🧞</span>
              <h1 className="font-[family-name:var(--font-playfair)] text-center" style={{ fontSize: "1.8rem", fontWeight: 900, color: "white" }}>
                {userName ? `${t(lang, "gHelloName")} ${userName}` : t(lang, "gWelcomeBack")}
              </h1>
              <p className="text-center" style={{ color: "rgba(255,255,255,0.6)", fontSize: "1rem", maxWidth: 280, lineHeight: 1.7 }}>
                {(() => {
                  const resLabels: Record<string, string> = Object.fromEntries(restrictionOptions.filter(r => r.value !== "ninguna").map(r => [r.value, r.value]));
                  const dietText = savedDiet ? t(lang, DIET_KEYS[savedDiet as DietType]) : "";
                  const resList: string[] = savedRestrictions ? JSON.parse(savedRestrictions) : [];
                  const filtered = resList.filter((r: string) => r !== "ninguna").map((r: string) => resLabels[r] || r);
                  const resText = filtered.length > 0
                    ? filtered.length === 1 ? filtered[0] : filtered.slice(0, -1).join(", ") + " y " + filtered[filtered.length - 1]
                    : "";
                  const dislikeList: string[] = savedDislikes ? JSON.parse(savedDislikes) : [];
                  const dislikeText = dislikeList.length > 0
                    ? dislikeList.length === 1 ? dislikeList[0] : dislikeList.slice(0, 3).join(", ") + (dislikeList.length > 3 ? "..." : "")
                    : "";
                  const hl = (s: string) => <span style={{ color: "#F4A623" }}>{s}</span>;
                  const dislikeNode = dislikeText ? <> {t(lang, dietText ? "gAlsoDislikes" : "gDislikes").split("{dislikes}")[0]}{hl(dislikeText)}{t(lang, dietText ? "gAlsoDislikes" : "gDislikes").split("{dislikes}")[1]}</> : null;
                  if (dietText && resText) return <>{t(lang, "gRememberDietAndRes").split("{diet}")[0]}{hl(dietText)}{t(lang, "gRememberDietAndRes").split("{diet}")[1].split("{res}")[0]}{hl(resText)}{t(lang, "gRememberDietAndRes").split("{diet}")[1].split("{res}")[1]}{dislikeNode}</>;
                  if (dietText) return <>{t(lang, "gRememberDiet").split("{diet}")[0]}{hl(dietText)}{t(lang, "gRememberDiet").split("{diet}")[1]}{dislikeNode}</>;
                  if (resText) return <>{t(lang, "gRememberRes").split("{res}")[0]}{hl(resText)}{t(lang, "gRememberRes").split("{res}")[1]}{dislikeNode}</>;
                  return t(lang, "gTellMeWhat");
                })()}
              </p>
              <div className="flex flex-col items-center" style={{ gap: 12, marginTop: 16 }}>
                <button onClick={() => { setSkipTransition(true); trackStat(restaurantId, "GENIO_STEP_GRID", undefined, genioSessionId); setStep(4); requestAnimationFrame(() => requestAnimationFrame(() => setSkipTransition(false))); initGrid(photoFilter); }} className="active:scale-95 transition-transform" style={{ background: "#F4A623", color: "#0e0e0e", fontSize: "0.95rem", fontWeight: 700, padding: "14px 32px", borderRadius: 50, border: "none" }}>
                  {t(lang, "gContinueBtn")}
                </button>
                <button onClick={() => { localStorage.removeItem("qr_diet"); localStorage.removeItem("qr_restrictions"); setDietType(null); setRestrictions([]); trackStat(restaurantId, "GENIO_STEP_DIET", undefined, genioSessionId); setStep(1); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: "0.85rem" }}>
                  {t(lang, "gChangePrefs")}
                </button>
              </div>
            </>
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
              <button onClick={surpriseMe} className="active:scale-95 transition-transform" style={{ marginTop: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.25)", color: "rgba(255,255,255,0.7)", fontSize: "0.9rem", fontWeight: 500, padding: "12px 28px", borderRadius: 50 }}>
                {t(lang, "gSurpriseMe")}
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
        <div style={{ minWidth: "100%", display: "flex", flexDirection: "column", padding: "100px 24px 120px", position: "relative" }}>
          <h2 className="font-[family-name:var(--font-playfair)] text-center" style={{ fontSize: "1.6rem", fontWeight: 900, color: "white", marginBottom: 8 }}>
            {t(lang, "gDislikesQuestion")}
          </h2>
          <p className="text-center" style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.88rem", marginBottom: 20, lineHeight: 1.5 }}>
            <span style={{ color: "#F4A623", textDecoration: "underline", textDecorationColor: "rgba(244,166,35,0.4)", textUnderlineOffset: "3px" }}>{t(lang, "gDislikesHint")}</span>
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

          {/* Search input */}
          <div style={{ position: "relative", marginBottom: 16 }}>
            <input
              value={dislikeSearch} onChange={e => setDislikeSearch(e.target.value)}
              placeholder={t(lang, "gSearchIngredient")}
              style={{ width: "100%", padding: "12px 16px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: "white", fontSize: "0.95rem", outline: "none", boxSizing: "border-box" as const, fontFamily: "inherit" }}
            />
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
          </div>

          {/* Flavor dislikes */}
          <p className="text-center" style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.75rem", marginBottom: 10 }}>{t(lang, "gFlavors")}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 16 }}>
            {[
              { value: "dulce", icon: "🍯" },
              { value: "agridulce", icon: "🍊" },
              { value: "ácido", icon: "🍋" },
              { value: "ahumado", icon: "🔥" },
            ].filter(f => !dislikes.includes(f.value)).map(f => (
              <button key={f.value} onClick={() => {
                setDislikes(prev => { const updated = [...prev, f.value]; localStorage.setItem("qr_dislikes", JSON.stringify(updated)); return updated; });
              }} className="transition-all duration-200" style={{ padding: "7px 16px", borderRadius: 50, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.6)", fontSize: "0.88rem", fontWeight: 500 }}>
                {f.icon} {f.value}
              </button>
            ))}
          </div>

          {/* Popular ingredient picks */}
          <p className="text-center" style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.75rem", marginBottom: 10 }}>{t(lang, "gCommonIngredients")}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {popularDislikes.filter(p => !dislikes.includes(p)).map(item => (
              <button key={item} onClick={() => {
                setDislikes(prev => { const updated = [...prev, item]; localStorage.setItem("qr_dislikes", JSON.stringify(updated)); return updated; });
              }} className="transition-all duration-200" style={{ padding: "7px 16px", borderRadius: 50, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.6)", fontSize: "0.88rem", fontWeight: 500 }}>
                {item}
              </button>
            ))}
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

        {/* STEP 4 — Akinator photo grid */}
        <div style={{ minWidth: "100%", display: "flex", flexDirection: "column", padding: "78px 8px 20px", position: "relative" }}>
          {/* Category filter pills */}
          <div className="flex" style={{ gap: 8, marginBottom: 16, justifyContent: "center" }}>
            {(["platos", "bebida", "dulce"] as const).map((f) => {
              const active = photoFilter === f;
              return (
                <button key={f} onClick={() => setPhotoFilter(f)}
                  style={{ padding: "6px 16px", borderRadius: 50, fontSize: "0.88rem", fontWeight: 500, border: active ? "none" : "1px solid rgba(255,255,255,0.2)", background: active ? "white" : "transparent", color: active ? "#0e0e0e" : "rgba(255,255,255,0.5)" }}>
                  {f === "platos" ? t(lang, "gDishFilter") : f === "dulce" ? t(lang, "gDessertFilter") : t(lang, "gDrinkFilter")}
                </button>
              );
            })}
          </div>

          {/* Selected counter + feedback */}
          <div className="flex items-center justify-center" style={{ marginBottom: 10, gap: 8, minHeight: 28 }}>
            {liked.size > 0 ? (
              <>
                <div style={{ background: "#F4A623", color: "#0e0e0e", width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.82rem", fontWeight: 700 }}>
                  {liked.size}
                </div>
                <span style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.88rem" }}>
                  {liked.size === 1 ? t(lang, "gSelected") : t(lang, "gSelectedPlural")}
                </span>
                {!showOverlay && liked.size < 4 && (
                  <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.86rem", marginLeft: 4 }}>
                    {liked.size === 1 ? `· ${t(lang, "gKeepSelecting")}` : liked.size === 2 ? `· ${t(lang, "gABitMore")}` : `· ${t(lang, "gAlmostThere")}`}
                  </span>
                )}
              </>
            ) : (
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "1.01rem", margin: 0 }}>{t(lang, "gSelectDishes")}</p>
            )}
          </div>

          {/* 3x3 Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {gridDishes.map((d) => {
              const sel = liked.has(d.id);
              const photo = d.photos?.[0];
              const isChanging = changingSlots.has(d.id);
              const isNew = !sel && animating && !isChanging;
              return (
                <div key={`slot-${d.id}`}
                  className="relative overflow-hidden"
                  style={{ aspectRatio: "5/6", borderRadius: 10, background: "#222" }}>
                  {isChanging ? (
                    <div className="absolute" style={{ inset: 0, borderRadius: 10, background: "#1a1a1a", overflow: "hidden" }}>
                      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)", backgroundSize: "200% 100%", animation: "shimmerSlide 1.2s ease-in-out infinite" }} />
                    </div>
                  ) : (
                <div onClick={() => { setPreviewDish(d); setPreviewDescExpanded(false); }}
                  className="relative overflow-hidden w-full h-full"
                  style={{
                    aspectRatio: "1", borderRadius: 10, padding: 0, background: "#222", cursor: "pointer",
                    animation: isNew ? "fadeScale 0.3s ease-out" : undefined,
                  }}>
                  <div className="absolute" style={{ inset: 0, background: "#333" }} />
                  {photo && <Image src={photo} alt={d.name} fill className="object-cover" sizes="33vw" style={{ position: "absolute", zIndex: 1 }} />}
                  <button onClick={(e) => { e.stopPropagation(); toggleLike(d.id); }} className="absolute flex items-center justify-center" style={{ top: 6, right: 6, width: 32, height: 32, borderRadius: "50%", background: sel ? "#F4A623" : "rgba(0,0,0,0.35)", border: sel ? "2px solid #F4A623" : "2px solid rgba(255,255,255,0.7)", boxShadow: "0 2px 6px rgba(0,0,0,0.3)", transition: "all 0.15s", zIndex: 4, cursor: "pointer" }}>
                    {sel && <Check size={16} color="white" strokeWidth={3} />}
                  </button>
                  <div className="absolute" style={{ bottom: 0, left: 0, right: 0, height: "45%", background: "linear-gradient(to top, rgba(0,0,0,0.75), transparent)", zIndex: 2 }} />
                  <span className="absolute" style={{ bottom: 4, left: 5, right: 5, color: "white", fontSize: "0.9rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", zIndex: 3 }}>
                    {d.name}
                  </span>
                  {sel && (
                    <div className="absolute" style={{ inset: 0, background: "rgba(244,166,35,0.15)", borderRadius: 10, zIndex: 2, pointerEvents: "none" }} />
                  )}
                </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Round indicator */}
          {round > 0 && (
            <p className="text-center" style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.95rem", marginTop: 10 }}>
              {t(lang, "gLearning")}
            </p>
          )}


          {/* 4+ overlay */}
          {showOverlay && liked.size >= 4 && (
            <div className="absolute flex flex-col items-center justify-center" style={{ inset: 0, background: "rgba(14,14,14,0.92)", zIndex: 30, padding: 32, gap: 12 }}>
              <span style={{ fontSize: "2.5rem", animation: "genioPulse 2s ease-in-out infinite" }}>🧞</span>
              <h3 className="font-[family-name:var(--font-playfair)] text-center" style={{ fontSize: "1.3rem", color: "white", fontWeight: 800, lineHeight: 1.3 }}>
                {dominantCategory
                  ? [
                      t(lang, "gOverlay1"),
                      t(lang, "gOverlay2"),
                      t(lang, "gOverlay3"),
                      t(lang, "gOverlay4"),
                      t(lang, "gOverlay5"),
                    ][phraseIdx]
                  : t(lang, "gOverlayFallback")}
              </h3>
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem" }}>
                {liked.size} {t(lang, "gSelectedPlural")}
              </span>
              <button onClick={recommend} className="active:scale-95 transition-transform"
                style={{ marginTop: 8, background: "#F4A623", color: "#0e0e0e", fontSize: "1rem", fontWeight: 700, padding: "15px 28px", borderRadius: 50, border: "none" }}>
                {t(lang, "gSeeSuggestions")}
              </button>
              <button onClick={() => { setShowOverlay(false); setOverlayDismissed(true); setDismissedAt(liked.size); }}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: "0.85rem", marginTop: 4 }}>
                {t(lang, "gKeepBrowsing")}
              </button>
            </div>
          )}
        </div>
      </div>


      {/* RESULT — overlays everything when step === 5 */}
      {step === 5 && mainResult && (
        <div className="absolute flex flex-col items-center genio-result-scroll" style={{ inset: 0, zIndex: 30, background: "#0e0e0e", padding: "44px 20px 20px", gap: 4, overflowY: "auto", overflowX: "hidden", scrollbarWidth: "none" as any }}>
          {/* Back + Close buttons */}
          <button onClick={() => setStep(4)} className="absolute flex items-center justify-center" style={{ top: 16, left: 20, width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "none", zIndex: 10 }}>
            <ChevronLeft size={18} color="white" />
          </button>
          <button onClick={close} className="absolute flex items-center justify-center" style={{ top: 16, right: 20, width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "none", zIndex: 10 }}>
            <X size={16} color="white" />
          </button>

          {/* Genio header */}
          <span style={{ fontSize: "2rem", marginBottom: 0 }}>🧞</span>
          <span style={{ color: "#F4A623", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            {t(lang, "gRecommends")}
          </span>

          {/* Main recommendation */}
          <div className="relative overflow-hidden" style={{ width: "100%", maxWidth: 320, aspectRatio: "4/5", borderRadius: 18, flexShrink: 0 }}>
            <button onClick={() => setPreviewDish(mainResult)} style={{ position: "absolute", inset: 0, border: "none", padding: 0, cursor: "pointer", background: "none" }}>
              {mainResult.photos?.[0] && <Image src={mainResult.photos[0]} alt={mainResult.name} fill className="object-cover" sizes="85vw" />}
              <div className="absolute" style={{ bottom: 0, left: 0, right: 0, padding: "60px 16px 16px", background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)" }}>
                <h2 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "1.5rem", fontWeight: 900, color: "white", lineHeight: 1.15, margin: "0 0 4px", textAlign: "left" }}>
                  {mainResult.name}
                </h2>
                {mainResult.description && (
                  <p className="line-clamp-2" style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.86rem", lineHeight: 1.4, margin: 0, textAlign: "left" }}>
                    {mainResult.description}
                  </p>
                )}
                <span style={{ color: "#F4A623", fontSize: "0.9rem", fontWeight: 700, marginTop: 6, display: "block", textAlign: "left" }}>
                  ${mainResult.price?.toLocaleString("es-CL")}
                </span>
              </div>
            </button>
            <div className="absolute" style={{ top: 12, left: 12, background: "#F4A623", color: "white", fontSize: "0.68rem", fontWeight: 700, padding: "4px 10px", borderRadius: 50, letterSpacing: "0.05em" }}>
              {t(lang, "gBestMatch")}
            </div>
          </div>

          {/* 2 alternatives — click swaps to main */}
          {altResults.length > 0 && (
            <>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", margin: "8px 0 4px" }}>
                {t(lang, "gAlsoLike")}
              </p>
              <div style={{ display: "flex", gap: 10, width: "100%", maxWidth: 320 }}>
                {altResults.map((alt) => (
                  <div key={alt.id} className="relative overflow-hidden" style={{ flex: 1, aspectRatio: "3/4", borderRadius: 14 }}>
                    <button onClick={() => setPreviewDish(alt)} style={{ position: "absolute", inset: 0, border: "none", padding: 0, cursor: "pointer", background: "none" }}>
                      {alt.photos?.[0] && <Image src={alt.photos[0]} alt={alt.name} fill className="object-cover" sizes="40vw" />}
                      <div className="absolute" style={{ bottom: 0, left: 0, right: 0, padding: "40px 10px 10px", background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)" }}>
                        <p className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "0.88rem", fontWeight: 700, color: "white", lineHeight: 1.15, margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                          {alt.name}
                        </p>
                        <span style={{ color: "#F4A623", fontSize: "0.78rem", fontWeight: 600 }}>
                          ${alt.price?.toLocaleString("es-CL")}
                        </span>
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Feedback */}
          {genioFeedback === "none" ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0 4px" }}>
              <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.82rem" }}>{t(lang, "gDidIGetIt")}</span>
              <button onClick={() => { setGenioFeedback("like"); trackStat(restaurantId, "GENIO_FEEDBACK_LIKE", mainResult.id, genioSessionId); saveIngredients([mainResult.id], "feedback_like"); }} className="active:scale-90 transition-transform" style={{ padding: "6px 16px", borderRadius: 50, border: "1px solid rgba(255,255,255,0.15)", background: "none", color: "white", fontSize: "0.82rem", cursor: "pointer" }}>{t(lang, "gYes")}</button>
              <button onClick={() => { setGenioFeedback("dislike"); trackStat(restaurantId, "GENIO_FEEDBACK_DISLIKE", mainResult.id, genioSessionId); saveIngredients([mainResult.id], "feedback_dislike"); }} className="active:scale-90 transition-transform" style={{ padding: "6px 16px", borderRadius: 50, border: "1px solid rgba(255,255,255,0.15)", background: "none", color: "white", fontSize: "0.82rem", cursor: "pointer" }}>{t(lang, "gNotSoMuch")}</button>
            </div>
          ) : (
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.82rem", margin: "16px 0 4px" }}>
              {genioFeedback === "like" ? t(lang, "gGreatThanks") : t(lang, "gThanksImprove")}
            </p>
          )}

          <div style={{ width: 40, height: 1, background: "rgba(255,255,255,0.08)", margin: "8px 0" }} />

          {/* Save preferences CTA (not logged in) */}
          <div style={{ width: "100%", maxWidth: 320 }}>
            <PostGenioCapture restaurantId={restaurantId} />
          </div>
        </div>
      )}

      <style>{`
        .genio-result-scroll::-webkit-scrollbar { display: none; }
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

      {/* Grid dish preview — lightweight modal with "Me gusta" */}
      {previewDish && step === 4 && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 200, padding: "20px" }}>
          <div onClick={() => setPreviewDish(null)} className="absolute inset-0" style={{ background: "rgba(0,0,0,0.7)" }} />
          <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 400, background: "#111", borderRadius: 24, maxHeight: "85dvh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Photo — fixed */}
            {previewDish.photos?.[0] && (
              <div style={{ position: "relative", width: "100%", aspectRatio: "4/3", flexShrink: 0 }}>
                <Image src={previewDish.photos[0]} alt={previewDish.name} fill className="object-cover" sizes="400px" />
                <button onClick={() => setPreviewDish(null)} style={{ position: "absolute", top: 12, right: 12, width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.4)", border: "none", color: "white", fontSize: "0.9rem", cursor: "pointer", zIndex: 2 }}>✕</button>
              </div>
            )}
            {/* Info — scrollable */}
            <div style={{ padding: "16px 20px 24px", overflowY: "auto", flex: 1 }}>
              {(() => { const cat = categories.find(c => c.id === previewDish.categoryId); return cat ? <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.72rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>{cat.name}</span> : null; })()}
              <h3 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "1.3rem", fontWeight: 700, color: "white", margin: "0 0 2px" }}>{previewDish.name}</h3>
              <div style={{ marginBottom: 10 }}>
                <span style={{ color: "#F4A623", fontSize: "0.95rem", fontWeight: 400 }}>${previewDish.price?.toLocaleString("es-CL")}</span>
                {previewDish.discountPrice && <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.82rem", textDecoration: "line-through", marginLeft: 6 }}>${previewDish.price?.toLocaleString("es-CL")}</span>}
              </div>
              {previewDish.description && (
                <>
                  <p style={{ fontSize: "0.92rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.5, margin: "0 0 4px", display: previewDescExpanded ? "block" : "-webkit-box", WebkitLineClamp: previewDescExpanded ? undefined : 3, WebkitBoxOrient: "vertical" as any, overflow: previewDescExpanded ? "visible" : "hidden" }}>{previewDish.description}</p>
                  {previewDish.description.length > 100 && (
                    <button onClick={() => setPreviewDescExpanded(!previewDescExpanded)} style={{ display: "block", background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: "0.82rem", padding: 0, marginBottom: 8, marginRight: "auto", cursor: "pointer" }}>
                      {previewDescExpanded ? "ver menos" : "ver más"}
                    </button>
                  )}
                </>
              )}
              {/* Action buttons */}
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button onClick={() => { toggleLike(previewDish.id); setPreviewDish(null); }} className="active:scale-95 transition-transform"
                  style={{ flex: 1, padding: "14px", borderRadius: 50, border: "none", fontSize: "0.95rem", fontWeight: 700, cursor: "pointer",
                    background: liked.has(previewDish.id) ? "rgba(255,255,255,0.1)" : "#F4A623",
                    color: liked.has(previewDish.id) ? "rgba(255,255,255,0.5)" : "white",
                  }}>
                  {liked.has(previewDish.id) ? t(lang, "gRemoveSelection") : t(lang, "gLikeBtn")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dish preview overlay — opens on top of Genio for results */}
      {previewDish && step !== 4 && (
        <DishDetail
          dish={previewDish}
          allDishes={results}
          categories={categories}
          restaurantId={restaurantId}
          reviews={[]}
          ratingMap={{}}
          onClose={() => setPreviewDish(null)}
          onChangeDish={(d) => setPreviewDish(d)}
        />
      )}
    </div>
  );
}
