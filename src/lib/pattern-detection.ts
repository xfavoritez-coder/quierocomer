/**
 * Pattern Detection Engine
 * Analyzes user dish selections to detect taste patterns.
 * Used by the Genio to decide when it has enough signal to recommend.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Dish = any;

const CAT_LABEL_ES: Record<string, string> = {
  SUSHI: "el sushi",
  MAIN_COURSE: "los platos de fondo",
  SALAD: "las ensaladas",
  SOUP: "las sopas",
  BREAKFAST: "el desayuno",
  BRUNCH: "el brunch",
  PASTA: "la pasta",
  PIZZA: "la pizza",
  BURGER: "las hamburguesas",
  SANDWICH: "los sándwiches",
  SEAFOOD: "los mariscos",
  DESSERT: "los postres",
  ICE_CREAM: "los helados",
  VEGETARIAN: "lo vegetariano",
  VEGAN: "lo vegano",
  COFFEE: "el café",
  JUICE: "los jugos",
  DRINK: "las bebidas",
  STARTER: "las entradas",
  WOK: "el wok",
  COMBO: "los combos",
  SHARING: "para compartir",
};

export interface PatternResult {
  confidence: number;
  phase: "learning" | "noticing" | "confident" | "ready";
  dominantCategory: { key: string; label: string; ratio: number; count: number } | null;
  sharedIngredients: { name: string; count: number }[];
  localConvergence: { id: string; name: string; count: number } | null;
  message: string | null;
  // For negative signals
  ignoredCategories: string[];
  ignoredIngredients: string[];
}

interface DetectionInput {
  selectedDishes: Dish[];
  previewedButNotSelected: Dish[];  // Opened modal but didn't select
  reselectedIds: Set<string>;       // Dishes shown again that user selected
}

export function detectPattern(input: DetectionInput): PatternResult {
  const { selectedDishes, previewedButNotSelected, reselectedIds } = input;

  const empty: PatternResult = {
    confidence: 0,
    phase: "learning",
    dominantCategory: null,
    sharedIngredients: [],
    localConvergence: null,
    message: null,
    ignoredCategories: [],
    ignoredIngredients: [],
  };

  if (selectedDishes.length < 2) return empty;

  // ── Category analysis ──
  const catCounts: Record<string, number> = {};
  for (const d of selectedDishes) {
    catCounts[d.categoria] = (catCounts[d.categoria] ?? 0) + 1;
  }
  const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
  const [topCatKey, topCatCount] = sortedCats[0];
  const catRatio = topCatCount / selectedDishes.length;

  // ── Ingredient analysis ──
  const ingCounts: Record<string, number> = {};
  for (const d of selectedDishes) {
    const ings: string[] = d.ingredients ?? [];
    // Deduplicate per dish (same ingredient shouldn't count twice for one dish)
    const unique = new Set(ings.map((i: string) => i.toLowerCase()));
    for (const ing of unique) {
      ingCounts[ing] = (ingCounts[ing] ?? 0) + 1;
    }
  }
  const sharedIngs = Object.entries(ingCounts)
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  // ── Local analysis ──
  const localCounts: Record<string, { id: string; name: string; count: number }> = {};
  for (const d of selectedDishes) {
    if (d.local?.nombre) {
      const lid = d.local.id ?? d.local.nombre;
      if (!localCounts[lid]) localCounts[lid] = { id: lid, name: d.local.nombre, count: 0 };
      localCounts[lid].count++;
    }
  }
  const topLocal = Object.values(localCounts).sort((a, b) => b.count - a.count)[0] ?? null;

  // ── Compute confidence ──
  let confidence = 0;

  // Category signal
  if (catRatio >= 0.7) confidence += 50;
  else if (catRatio >= 0.5) confidence += 30;

  // Ingredient signal: +15 per shared ingredient, max +40
  confidence += Math.min(sharedIngs.length * 15, 40);

  // Local convergence
  if (topLocal && topLocal.count >= 2) confidence += 15;

  // Volume bonus (more data = more certainty)
  if (selectedDishes.length >= 4) confidence += 10;
  if (selectedDishes.length >= 6) confidence += 5;

  // Re-selection bonus: if user selected a dish shown again, strong signal
  if (reselectedIds.size > 0) confidence += 30;

  // Preview-but-not-select: mild negative signal for those specific dishes
  // but the ACT of previewing without selecting means they're considering, not useless

  // Cap at 100
  confidence = Math.min(confidence, 100);

  // ── Determine phase ──
  const phase: PatternResult["phase"] =
    confidence >= 70 ? "ready" :
    confidence >= 50 ? "confident" :
    confidence >= 30 ? "noticing" :
    "learning";

  // ── Build dominant category ──
  const dominantCategory = topCatCount >= 2 ? {
    key: topCatKey,
    label: CAT_LABEL_ES[topCatKey] ?? topCatKey.toLowerCase(),
    ratio: catRatio,
    count: topCatCount,
  } : null;

  // ── Build local convergence ──
  const localConvergence = topLocal && topLocal.count >= 2 ? topLocal : null;

  // ── Generate message ──
  let message: string | null = null;
  if (phase === "ready" || phase === "confident") {
    // Pick the strongest signal for the message
    if (dominantCategory && catRatio >= 0.7) {
      message = `Parece que te llama ${dominantCategory.label}`;
    } else if (sharedIngs.length >= 2) {
      const top2 = sharedIngs.slice(0, 2).map(i => i.name);
      message = `Noto que te gusta ${top2.join(" y ")}`;
    } else if (dominantCategory && catRatio >= 0.5) {
      message = `Veo que te interesa ${dominantCategory.label}`;
    } else if (localConvergence) {
      message = `Te atrae la carta de ${localConvergence.name}`;
    } else if (sharedIngs.length >= 1) {
      message = `Noto que te gusta ${sharedIngs[0].name}`;
    } else {
      message = "Ya vi un patrón en lo que elegiste";
    }
  } else if (phase === "noticing") {
    message = "El Genio está aprendiendo tus gustos...";
  }

  // ── Negative signals from ignored dishes ──
  // Categories that appear in non-selected, non-previewed dishes = not interested
  const selectedCatSet = new Set(selectedDishes.map(d => d.categoria));
  const previewedCatSet = new Set(previewedButNotSelected.map(d => d.categoria));
  const ignoredCatCounts: Record<string, number> = {};
  // We don't have all ignored dishes here — that's tracked in the parent
  // But we can infer from previewed-but-not-selected
  const ignoredCategories: string[] = [];
  const ignoredIngredients: string[] = [];

  // Categories that appeared in previewed-but-not-selected and never in selected
  for (const d of previewedButNotSelected) {
    if (!selectedCatSet.has(d.categoria)) {
      ignoredCatCounts[d.categoria] = (ignoredCatCounts[d.categoria] ?? 0) + 1;
    }
  }
  for (const [cat, count] of Object.entries(ignoredCatCounts)) {
    if (count >= 2) ignoredCategories.push(cat); // Looked at 2+ and never selected
  }

  return {
    confidence,
    phase,
    dominantCategory,
    sharedIngredients: sharedIngs,
    localConvergence,
    message,
    ignoredCategories,
    ignoredIngredients,
  };
}
