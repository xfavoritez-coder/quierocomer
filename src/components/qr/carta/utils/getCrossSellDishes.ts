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
  const catTypeMap = new Map<string, string>();
  const catNameMap = new Map<string, string>();
  for (const cat of categories) {
    let type = (cat as any).dishType || "food";
    // Auto-detect entries from category name when not explicitly set
    if (type === "food" && ENTRY_PATTERN.test(cat.name)) {
      type = "entry";
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

  if (currentType === "food" || currentType === "entry") {
    const drinks = getByType("drink");
    const entries = isEntry ? [] : getByType("entry");
    const desserts = getByType("dessert");

    // Always mix: 1 drink + 1 entry or dessert + 1 more
    const picks: { dish: Dish; reason: string }[] = [];

    // Slot 1: a drink
    if (drinks.length > 0) {
      const d = pickRandom(drinks, 1)[0];
      picks.push({ dish: d, reason: "Para acompañar" });
    }

    // Slot 2: an entry (if viewing main) or a dessert
    if (!isEntry && entries.length > 0) {
      const d = pickRandom(entries.filter(e => !picks.some(p => p.dish.id === e.id)), 1);
      if (d.length > 0) picks.push({ dish: d[0], reason: "Mientras esperas" });
    }
    if (picks.length < 2 && desserts.length > 0) {
      const d = pickRandom(desserts.filter(e => !picks.some(p => p.dish.id === e.id)), 1);
      if (d.length > 0) picks.push({ dish: d[0], reason: "Para terminar" });
    }

    // Slot 3: fill with whatever is left (drink, entry, dessert)
    if (picks.length < 3) {
      const remaining = [...drinks, ...entries, ...desserts].filter(d => !picks.some(p => p.dish.id === d.id));
      const extra = pickRandom(remaining, 3 - picks.length);
      for (const d of extra) {
        const t = catTypeMap.get(d.categoryId) || "food";
        const reason = t === "drink" ? "Para acompañar" : t === "entry" ? "Mientras esperas" : t === "dessert" ? "Para terminar" : "Te puede gustar";
        picks.push({ dish: d, reason });
      }
    }

    for (const p of picks) {
      if (results.length >= MAX) break;
      if (!usedIds.has(p.dish.id)) {
        results.push(p);
        usedIds.add(p.dish.id);
      }
    }
  } else if (currentType === "drink") {
    // Drink → suggest popular food
    const food = getByType("food");
    const recommended = food.filter((d) => d.tags?.includes("RECOMMENDED"));
    const source = recommended.length > 0 ? recommended : food;
    const picks = pickRandom(source, MAX - results.length);
    for (const d of picks) {
      if (!usedIds.has(d.id)) {
        results.push({ dish: d, reason: "Va bien con esto" });
        usedIds.add(d.id);
      }
    }
  } else if (currentType === "dessert") {
    // Dessert → suggest drinks (coffee, tea, digestifs)
    const drinks = getByType("drink");
    const picks = pickRandom(drinks, MAX - results.length);
    for (const d of picks) {
      if (!usedIds.has(d.id)) {
        results.push({ dish: d, reason: "Para acompañar" });
        usedIds.add(d.id);
      }
    }
    // If not enough drinks, suggest other desserts
    if (results.length < MAX) {
      const otherDesserts = getByType("dessert").filter((d) => !usedIds.has(d.id));
      const extra = pickRandom(otherDesserts, MAX - results.length);
      for (const d of extra) {
        results.push({ dish: d, reason: "También te puede gustar" });
        usedIds.add(d.id);
      }
    }
  }

  // Contextual title based on what we're actually showing
  let title = "Va bien con";
  if (manualSuggestionIds && manualSuggestionIds.length > 0 && results.some(r => manualSuggestionIds.includes(r.dish.id))) {
    title = "Va bien con";
  } else if (currentType === "food" || currentType === "entry") {
    if (isEntry) {
      title = "¿Qué sigue?";
    } else {
      title = "Acompaña tu plato";
    }
  } else if (currentType === "drink") {
    title = "Para picar";
  } else if (currentType === "dessert") {
    title = "Para cerrar";
  }

  return { title, items: results.slice(0, MAX) };
}
