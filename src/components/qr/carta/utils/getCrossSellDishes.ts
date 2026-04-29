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

export function getCrossSellDishes(
  currentDish: Dish,
  allDishes: Dish[],
  categories: Category[],
  manualSuggestionIds?: string[],
): CrossSellDish[] {
  const MAX = 3;
  const results: CrossSellDish[] = [];
  const usedIds = new Set<string>([currentDish.id]);

  // Build category type map
  const catTypeMap = new Map<string, string>();
  const catNameMap = new Map<string, string>();
  for (const cat of categories) {
    catTypeMap.set(cat.id, (cat as any).dishType || "food");
    catNameMap.set(cat.id, cat.name.toLowerCase());
  }

  const currentType = catTypeMap.get(currentDish.categoryId) || "food";

  // Entry is either explicit type or detected by category name
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

  if (results.length >= MAX) return results;

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
    // Food/entry → suggest drinks, desserts, entries (if viewing main)
    const drinks = getByType("drink");
    const desserts = getByType("dessert");
    const entries = isEntry
      ? [] // don't suggest entries if already viewing entry
      : [...getByType("entry"), ...getByCatName(/entrada|appetizer|starter|antipast/i).filter(d => !getByType("entry").some(e => e.id === d.id))];

    // Mix: 1 drink, 1 entry (if main), 1 dessert
    const picks: { dish: Dish; reason: string }[] = [];
    if (!isEntry && entries.length > 0) {
      picks.push(...pickRandom(entries, 1).map((d) => ({ dish: d, reason: "Para empezar" })));
    }
    if (drinks.length > 0) {
      picks.push(...pickRandom(drinks, 1).map((d) => ({ dish: d, reason: "Para acompañar" })));
    }
    if (desserts.length > 0) {
      picks.push(...pickRandom(desserts, 1).map((d) => ({ dish: d, reason: "Para terminar" })));
    }
    // Fill remaining with more drinks
    if (picks.length < MAX - results.length && drinks.length > 1) {
      const extra = drinks.filter((d) => !picks.some((p) => p.dish.id === d.id));
      picks.push(...pickRandom(extra, MAX - results.length - picks.length).map((d) => ({ dish: d, reason: "Para acompañar" })));
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

  return results.slice(0, MAX);
}
