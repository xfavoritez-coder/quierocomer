export type CarouselMode = "vegan" | "vegetarian" | "glutenfree" | "lactosefree" | "soyfree" | "vegan+gf" | "vegetarian+gf" | "smart" | null;

export function getCarouselMode(diet: string | null, restrictions: string[]): CarouselMode {
  const active = restrictions.filter(r => r !== "ninguna");
  const hasDiet = diet === "vegan" || diet === "vegetarian";
  const hasGluten = active.includes("gluten");
  const hasLactosa = active.includes("lactosa");
  const hasSoja = active.includes("soja");
  const otherRestrictions = active.filter(r => !["gluten", "lactosa", "soja"].includes(r));
  const totalThings = (hasDiet ? 1 : 0) + active.length;

  // Single selection → individual banner
  if (totalThings === 1) {
    if (diet === "vegan") return "vegan";
    if (diet === "vegetarian") return "vegetarian";
    if (hasGluten) return "glutenfree";
    if (hasLactosa) return "lactosefree";
    if (hasSoja) return "soyfree";
  }

  // Diet + only gluten → existing combo
  if (hasDiet && active.length === 1 && hasGluten) {
    return diet === "vegan" ? "vegan+gf" : "vegetarian+gf";
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
