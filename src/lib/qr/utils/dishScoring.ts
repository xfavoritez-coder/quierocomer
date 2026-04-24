import type { CompiledProfile } from "./compileProfile";

// Dish shape as it comes from getRestaurantBySlug (with includes)
export interface ScoringDish {
  id: string;
  categoryId: string;
  name: string;
  dishDiet: string;
  isSpicy: boolean;
  isHighMargin: boolean;
  isFeaturedAuto: boolean;
  flavorTags: string[];
  tags: string[];
  createdAt: string | Date;
  dishIngredients: {
    ingredient: {
      name: string;
      category: string;
      allergens: { name: string; type: string }[];
    };
  }[];
}

export interface ScoringContext {
  timeOfDay: string; // MORNING | LUNCH | AFTERNOON | DINNER | LATE
  weather: string; // CLEAR | COLD | HOT | RAIN
  categoryNames: Record<string, string>; // categoryId → name (lowercase)
}

export interface DishScore {
  score: number;
  reason: string | null;
}

// Restriction keywords mapped to allergen/ingredient patterns
const RESTRICTION_MAP: Record<string, string[]> = {
  "sin gluten": ["gluten", "trigo", "wheat"],
  "sin lactosa": ["lactosa", "lácteo", "leche", "dairy", "queso", "crema"],
  "sin mariscos": ["mariscos", "shellfish", "camarón", "langosta"],
  "sin frutos secos": ["frutos secos", "nuez", "almendra", "maní", "nuts"],
  "sin huevo": ["huevo", "egg"],
  "sin cerdo": ["cerdo", "pork", "tocino", "jamón", "bacon"],
  "sin soja": ["soja", "soy"],
};

// Categories that match time of day (by keyword in name)
const TIME_CATEGORY_KEYWORDS: Record<string, string[]> = {
  MORNING: ["desayuno", "brunch", "breakfast"],
  LUNCH: ["almuerzo", "lunch", "entrada", "plato fuerte"],
  AFTERNOON: ["postre", "dulce", "café", "merienda", "snack"],
  DINNER: ["cena", "dinner", "postre", "cocktail", "trago"],
  LATE: ["trago", "cocktail", "bar", "nocturno"],
};

// Flavor/ingredient signals for weather
const WARM_DISH_SIGNALS = ["sopa", "guiso", "caldo", "caliente", "estofado"];
const COLD_DISH_SIGNALS = ["helado", "frío", "ensalada", "ceviche", "smoothie"];

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function scoreDish(
  dish: ScoringDish,
  profile: CompiledProfile,
  context: ScoringContext
): DishScore {
  let score = 50;
  let topReason: { text: string; weight: number } | null = null;

  const dishIngNames = dish.dishIngredients.map((di) => norm(di.ingredient.name));
  const dishAllergenNames = dish.dishIngredients.flatMap((di) =>
    di.ingredient.allergens.map((a) => norm(a.name))
  );
  const allDishTerms = [...dishIngNames, ...dishAllergenNames];

  // ── RESTRICTIONS (-50 if hit, +5 if clean) ──
  let hasRestrictionHit = false;
  for (const restriction of profile.restrictions) {
    const normRestriction = norm(restriction);
    if (normRestriction === "_spicy") {
      if (dish.isSpicy) { hasRestrictionHit = true; score -= 50; break; }
      continue;
    }
    const patterns = RESTRICTION_MAP[normRestriction] || [normRestriction];
    const hit = patterns.some((p) => allDishTerms.some((t) => t.includes(p)));
    if (hit) {
      hasRestrictionHit = true;
      score -= 50;
      break;
    }
  }
  // Boost clean dishes when user has restrictions (safe choice)
  if (!hasRestrictionHit && profile.restrictions.length > 0) {
    score += 5;
  }

  // ── DISLIKED INGREDIENTS (-15 each if hit, +5 if clean) ──
  let dislikeHits = 0;
  for (const dislike of profile.dislikedIngredients) {
    const normDislike = norm(dislike);
    if (dishIngNames.some((n) => n.includes(normDislike))) {
      score -= 15;
      dislikeHits++;
      if (dislikeHits >= 2) break;
    }
  }
  // Boost clean dishes when user has dislikes
  if (dislikeHits === 0 && profile.dislikedIngredients.length > 0) {
    score += 5;
  }

  // ── DIET MISMATCH (-10) ──
  if (
    profile.dietType === "vegetarian" &&
    dish.dishDiet === "OMNIVORE"
  ) {
    score -= 10;
  } else if (
    profile.dietType === "vegan" &&
    dish.dishDiet !== "VEGAN"
  ) {
    score -= 10;
  }

  // ── LIKED INGREDIENTS (proportional to affinity, max 4 matches, cap +30 total) ──
  const daysSince = profile.lastSessionDate
    ? (Date.now() - new Date(profile.lastSessionDate).getTime()) / (1000 * 60 * 60 * 24)
    : 0;
  const decayFactor = 1 / (1 + daysSince / 30);

  // Collect all matching ingredients with their weighted scores
  const ingredientMatches: { name: string; points: number }[] = [];
  for (const ingName of dishIngNames) {
    for (const [liked, rawScore] of Object.entries(profile.likedIngredients)) {
      if (norm(liked) === ingName) {
        const decayed = (rawScore as number) * decayFactor;
        if (decayed > 1) {
          // Linear scale: score 1→2pts, 10→5.5pts, 20→9pts, 29→12pts (cap)
          const points = Math.min(12, 2 + decayed * 0.35);
          ingredientMatches.push({ name: liked, points });
        }
        break;
      }
    }
  }
  // Sort by points desc, take top 4, cap total at +30
  ingredientMatches.sort((a, b) => b.points - a.points);
  let likedTotal = 0;
  for (let i = 0; i < Math.min(4, ingredientMatches.length); i++) {
    likedTotal += ingredientMatches[i].points;
  }
  score += Math.min(30, Math.round(likedTotal));
  if (ingredientMatches.length > 0) {
    topReason = { text: `Tiene ${ingredientMatches[0].name} que te gusta`, weight: likedTotal };
  }

  // ── VIEW HISTORY (+10 or +5) ──
  const viewed = profile.viewHistory.find((v) => v.dishId === dish.id);
  if (viewed) {
    if (viewed.dwellMs > 5000) {
      score += 10;
    } else {
      score += 5;
    }
  }

  // ── BUSINESS VALUE (capped at +15 combined) ──
  let bizBoost = 0;
  if (dish.tags?.includes("RECOMMENDED")) bizBoost += 10;
  if (dish.isHighMargin) bizBoost += 8;
  if (dish.isFeaturedAuto) bizBoost += 7;
  score += Math.min(bizBoost, 15);

  // ── NEW DISH (+5 if < 7 days old) ──
  const createdAt = new Date(dish.createdAt);
  const daysSinceCreated = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const isNew = daysSinceCreated < 7;
  if (isNew) {
    score += 5;
    if (score > 65 && (!topReason || topReason.weight < 10)) {
      topReason = { text: "Nuevo y afín a tus gustos", weight: 10 };
    }
  }

  // ── CONTEXTUAL: TIME OF DAY (+8) ──
  const catName = norm(context.categoryNames[dish.categoryId] || "");
  const timeKeywords = TIME_CATEGORY_KEYWORDS[context.timeOfDay] || [];
  if (timeKeywords.some((kw) => catName.includes(kw))) {
    score += 8;
    if (!topReason || topReason.weight < 8) {
      topReason = { text: "Popular a esta hora", weight: 8 };
    }
  }

  // ── CONTEXTUAL: WEATHER (+5) ──
  const dishNameNorm = norm(dish.name);
  const dishFlavorNorm = dish.flavorTags.map(norm);
  const allTerms = [dishNameNorm, ...dishIngNames, ...dishFlavorNorm];

  if (context.weather === "COLD" || context.weather === "RAIN") {
    if (WARM_DISH_SIGNALS.some((s) => allTerms.some((t) => t.includes(s)))) {
      score += 5;
    }
  } else if (context.weather === "HOT") {
    if (COLD_DISH_SIGNALS.some((s) => allTerms.some((t) => t.includes(s)))) {
      score += 5;
    }
  }

  // Clamp 0-100
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    reason: topReason?.text || null,
  };
}
