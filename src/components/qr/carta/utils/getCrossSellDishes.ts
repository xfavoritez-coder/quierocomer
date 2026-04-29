import type { Dish, Category } from "@prisma/client";

/**
 * Get cross-sell suggestions for a dish.
 *
 * Priority:
 * 1. Manual suggestions (suggestedDishIds from DishSuggestion table)
 * 2. Fallback by category type:
 *    - food/entry → drinks + desserts
 *    - drink → food entries/mains
 *    - dessert → drinks (coffee, digestifs)
 *
 * Returns max 3 dishes, excluding the current dish.
 */

interface CrossSellDish {
  dish: Dish;
  reason: string;
}

interface CrossSellResult {
  title: string;
  items: CrossSellDish[];
}

export function getCrossSellDishes(
  currentDish: Dish,
  allDishes: Dish[],
  categories: Category[],
  manualSuggestionIds?: string[],
): CrossSellResult {
  const MAX = 3;
  const results: CrossSellDish[] = [];
  const usedIds = new Set<string>([currentDish.id]);

  // Build category type map — auto-detect entries by name if dishType is "food"
  const ENTRY_PATTERN = /entrada|compartir|appetizer|starter|antipast|aperitivo|piqueo|snack|para picar|tapas/i;
  const HOT_PATTERN = /café|cafe|coffee|té|tea|infusi|caliente/i;
  const catTypeMap = new Map<string, string>();
  const catNameMap = new Map<string, string>();
  for (const cat of categories) {
    let type = cat.dishType || "food";
    if (type === "food" && ENTRY_PATTERN.test(cat.name)) {
      type = "entry";
    }
    // Detect hot drinks (café/té) as separate from cold drinks
    if (type === "drink" && HOT_PATTERN.test(cat.name)) {
      type = "hot";
    }
    catTypeMap.set(cat.id, type);
    catNameMap.set(cat.id, cat.name.toLowerCase());
  }

  const currentType = catTypeMap.get(currentDish.categoryId) || "food";
  const isEntry = currentType === "entry";


  // Helper: get active dishes with photos, excluding used
  const available = allDishes.filter(
    (d) => d.isActive && !usedIds.has(d.id) && d.photos?.[0]
  );

  // 1. Manual suggestions
  if (manualSuggestionIds && manualSuggestionIds.length > 0) {
    for (const id of manualSuggestionIds) {
      if (results.length >= MAX) break;
      const dish = available.find((d) => d.id === id);
      if (dish && !usedIds.has(dish.id)) {
        results.push({ dish, reason: "Sugerido" });
        usedIds.add(dish.id);
      }
    }
  }

  if (results.length >= MAX) return { title: "Va bien con", items: results };

  // 2. Fallback by type
  const getByType = (type: string, excludeCatName?: RegExp) => {
    return available.filter((d) => {
      if (usedIds.has(d.id)) return false;
      const t = catTypeMap.get(d.categoryId) || "food";
      if (t !== type) return false;
      if (excludeCatName) {
        const name = catNameMap.get(d.categoryId) || "";
        if (excludeCatName.test(name)) return false;
      }
      return true;
    });
  };

  const getByCatName = (pattern: RegExp) => {
    return available.filter((d) => {
      if (usedIds.has(d.id)) return false;
      const name = catNameMap.get(d.categoryId) || "";
      return pattern.test(name);
    });
  };

  // Pick random items from array
  const pickRandom = (arr: Dish[], count: number): Dish[] => {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  };

  if (currentType === "food") {
    // Main dish → 1 drink + 2 entries, fill remaining with entries/desserts
    const drinks = getByType("drink");
    const entries = getByType("entry");
    const desserts = getByType("dessert");
    const picks: { dish: Dish; reason: string }[] = [];

    if (drinks.length > 0) {
      picks.push({ dish: pickRandom(drinks, 1)[0], reason: "Para acompañar" });
    }
    const entryPicks = pickRandom(entries.filter(e => !picks.some(p => p.dish.id === e.id)), 2);
    for (const d of entryPicks) {
      picks.push({ dish: d, reason: "Mientras esperas" });
    }
    // Fill remaining with more entries, then desserts, then drinks
    if (picks.length < 3) {
      const remaining = [
        ...entries.filter(d => !picks.some(p => p.dish.id === d.id)).map(d => ({ dish: d, reason: "Mientras esperas" })),
        ...desserts.filter(d => !picks.some(p => p.dish.id === d.id)).map(d => ({ dish: d, reason: "Para terminar" })),
        ...drinks.filter(d => !picks.some(p => p.dish.id === d.id)).map(d => ({ dish: d, reason: "Para acompañar" })),
      ];
      for (const p of pickRandom(remaining.map(r => r.dish), 3 - picks.length)) {
        const r = remaining.find(x => x.dish.id === p.id);
        if (r) picks.push(r);
      }
    }

    for (const p of picks) {
      if (results.length >= MAX) break;
      if (!usedIds.has(p.dish.id)) {
        results.push(p);
        usedIds.add(p.dish.id);
      }
    }
  } else if (currentType === "entry") {
    // Entry → suggest main dishes (fondos)
    const mains = getByType("food");
    const recommended = mains.filter(d => d.tags?.includes("RECOMMENDED"));
    const source = recommended.length >= MAX ? recommended : mains;
    const picks = pickRandom(source, MAX - results.length);
    for (const d of picks) {
      if (!usedIds.has(d.id)) {
        results.push({ dish: d, reason: "De fondo" });
        usedIds.add(d.id);
      }
    }
  } else if (currentType === "drink" || currentType === "hot") {
    // Drink → only desserts — "Deja espacio para..."
    const desserts = getByType("dessert");
    for (const d of pickRandom(desserts, MAX - results.length)) {
      if (!usedIds.has(d.id)) {
        results.push({ dish: d, reason: "Deja espacio" });
        usedIds.add(d.id);
      }
    }
  } else if (currentType === "dessert") {
    // Dessert → hot drinks (café/té) first, then any drink as fallback
    const hot = getByType("hot");
    const drinks = getByType("drink");

    for (const d of pickRandom(hot, MAX - results.length)) {
      if (!usedIds.has(d.id)) {
        results.push({ dish: d, reason: "Para acompañar" });
        usedIds.add(d.id);
      }
    }
    // Fallback to regular drinks if not enough hot drinks
    if (results.length < MAX) {
      for (const d of pickRandom(drinks.filter(dr => !usedIds.has(dr.id)), MAX - results.length)) {
        results.push({ dish: d, reason: "Para acompañar" });
        usedIds.add(d.id);
      }
    }
  }

  // Contextual title based on what we're actually showing
  let title = "Va bien con";
  if (manualSuggestionIds && manualSuggestionIds.length > 0 && results.some(r => manualSuggestionIds.includes(r.dish.id))) {
    title = "Va bien con";
  } else if (currentType === "entry") {
    title = "¿Qué sigue?";
  } else if (currentType === "food") {
    title = "Acompaña tu plato";
  } else if (currentType === "drink" || currentType === "hot") {
    title = "Deja espacio para...";
  } else if (currentType === "dessert") {
    title = "¿Un café con eso?";
  }

  return { title, items: results.slice(0, MAX) };
}
