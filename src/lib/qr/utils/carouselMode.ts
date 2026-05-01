export type CarouselMode = "vegan" | "vegetarian" | "glutenfree" | "lactosefree" | "soyfree" | "vegan+gf" | "vegetarian+gf" | "smart" | null;

export function getCarouselMode(diet: string | null, restrictions: string[], restaurantDietType?: string | null): CarouselMode {
  const active = restrictions.filter(r => r !== "ninguna");
  // If restaurant is already vegan/vegetarian, showing that diet banner is redundant
  const restDiet = (restaurantDietType || "").toUpperCase();
  const dietRedundant = (diet === "vegan" && restDiet === "VEGAN") || (diet === "vegetarian" && (restDiet === "VEGETARIAN" || restDiet === "VEGAN"));
  const effectiveDiet = dietRedundant ? null : diet;
  const hasDiet = effectiveDiet === "vegan" || effectiveDiet === "vegetarian";
  const hasGluten = active.includes("gluten");
  const hasLactosa = active.includes("lactosa");
  const hasSoja = active.includes("soja");
  const otherRestrictions = active.filter(r => !["gluten", "lactosa", "soja"].includes(r));
  const totalThings = (hasDiet ? 1 : 0) + active.length;

  // Single selection → individual banner
  if (totalThings === 1) {
    if (effectiveDiet === "vegan") return "vegan";
    if (effectiveDiet === "vegetarian") return "vegetarian";
    if (hasGluten) return "glutenfree";
    if (hasLactosa) return "lactosefree";
    if (hasSoja) return "soyfree";
  }

  // Diet + only gluten → existing combo
  if (hasDiet && active.length === 1 && hasGluten) {
    return effectiveDiet === "vegan" ? "vegan+gf" : "vegetarian+gf";
  }

  // Any other combination of 2+ → smart
  if (totalThings >= 2) return "smart";

  return null;
}

export function getCarouselScrollId(mode: CarouselMode): string {
  switch (mode) {
    case "vegan": case "vegan+gf": return "genio-vegan-carousel";
    case "vegetarian": case "vegetarian+gf": return "genio-vegetarian-carousel";
    case "glutenfree": return "genio-glutenfree-carousel";
    case "lactosefree": return "genio-lactosefree-carousel";
    case "soyfree": return "genio-soyfree-carousel";
    case "smart": return "genio-smart-carousel";
    default: return "";
  }
}

/** Quick check if any dishes match the carousel mode — avoids showing empty nav/pills */
export function hasMatchingDishes(dishes: any[], categories: any[], mode: CarouselMode, diet?: string | null, restrictions?: string[]): boolean {
  if (!mode) return false;
  const noDrinkIds = new Set(categories.filter((c: any) => c.dishType !== "drink").map((c: any) => c.id));
  const active = dishes.filter((d: any) => d.isActive && noDrinkIds.has(d.categoryId));

  const checkAllergenFree = (d: any, name: string): boolean => {
    if (name === "gluten" && d.isGlutenFree === true) return true;
    if (name === "lactosa" && d.isLactoseFree === true) return true;
    if (name === "soja" && d.isSoyFree === true) return true;
    const ings = d.dishIngredients || [];
    if (ings.length === 0) return false;
    return !ings.some((di: any) => di.ingredient?.allergens?.some((a: any) => a.name.toLowerCase() === name));
  };

  return active.some((d: any) => {
    // Diet check
    if (mode === "vegan" || mode === "vegan+gf") { if (d.dishDiet !== "VEGAN") return false; }
    if (mode === "vegetarian" || mode === "vegetarian+gf") { if (d.dishDiet !== "VEGAN" && d.dishDiet !== "VEGETARIAN") return false; }
    // Restriction checks based on mode
    if (mode === "vegan+gf" || mode === "vegetarian+gf" || mode === "glutenfree") { if (!checkAllergenFree(d, "gluten")) return false; }
    if (mode === "lactosefree") { if (!checkAllergenFree(d, "lactosa")) return false; }
    if (mode === "soyfree") { if (!checkAllergenFree(d, "soja")) return false; }
    if (mode === "smart" && restrictions) {
      if (diet === "vegan" && d.dishDiet !== "VEGAN") return false;
      if (diet === "vegetarian" && d.dishDiet !== "VEGAN" && d.dishDiet !== "VEGETARIAN") return false;
      for (const r of restrictions) {
        if (r === "_spicy" || r === "ninguna") continue;
        if (r === "_spicy" && d.isSpicy) return false;
        if (!checkAllergenFree(d, r)) return false;
      }
    }
    return true;
  });
}

export type DietMessageType = "no-results" | "redundant-vegan" | "redundant-vegetarian" | null;

/** Determine which fallback message to show when there's no carousel */
export function getDietMessage(diet: string | null, restrictions: string[], restaurantDietType?: string | null, dishes?: any[], categories?: any[]): DietMessageType {
  const active = restrictions.filter(r => r !== "ninguna");
  const hasPrefs = (diet && diet !== "omnivore") || active.length > 0;
  if (!hasPrefs) return null;

  const restDiet = (restaurantDietType || "").toUpperCase();

  // Check if diet is redundant AND there are no other restrictions that would show a carousel
  const dietRedundant = (diet === "vegan" && restDiet === "VEGAN") || (diet === "vegetarian" && (restDiet === "VEGETARIAN" || restDiet === "VEGAN"));

  // If there's a carousel mode, the carousel handles it — no message needed
  const mode = getCarouselMode(diet, restrictions, restaurantDietType);
  if (mode && dishes && categories && hasMatchingDishes(dishes, categories, mode, diet, active)) return null;

  // Redundant diet with no extra restrictions
  if (dietRedundant && active.length === 0) {
    return restDiet === "VEGAN" ? "redundant-vegan" : "redundant-vegetarian";
  }

  // Has preferences but no matching dishes
  if (hasPrefs) return "no-results";

  return null;
}

export function getCarouselNavName(mode: CarouselMode): string {
  switch (mode) {
    case "vegan": return "🌿 Vegano";
    case "vegan+gf": return "🌿 Vegano + GF";
    case "vegetarian": return "🥗 Vegetariano";
    case "vegetarian+gf": return "🥗 Vegetariano + GF";
    case "glutenfree": return "🌾 Sin gluten";
    case "lactosefree": return "🥛 Sin lactosa";
    case "soyfree": return "🫘 Sin soya";
    case "smart": return "🧞 Mi dieta";
    default: return "";
  }
}
