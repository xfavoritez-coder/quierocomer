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
