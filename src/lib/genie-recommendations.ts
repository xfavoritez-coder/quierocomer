import { prisma } from "@/lib/prisma";

interface GenieContext {
  selectedDishIds: string[];
  ctxCompany?: string;
  ctxHunger?: string;
  ctxBudget?: number;
  ctxOccasion?: string;
  userLat?: number;
  userLng?: number;
  weatherTemp?: number;
  weatherCondition?: string;
}

// Cold weather → boost warm/hearty dishes
const COLD_BOOST_CATS = ["SOUP", "WOK", "MAIN_COURSE"];
const COLD_BOOST_INGS = ["caldo", "crema de", "ramen", "fideos", "guiso"];
// Hot weather → boost fresh/light dishes
const HOT_BOOST_CATS = ["SALAD", "SUSHI"];
const HOT_BOOST_INGS = ["ceviche", "pepino", "palta", "ensalada", "fresco"];

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

const HUNGER_MAP: Record<string, string[]> = {
  LIGHT: ["LIGHT"],
  MEDIUM: ["LIGHT", "MEDIUM"],
  HEAVY: ["MEDIUM", "HEAVY"],
};

export async function getRecommendations(ctx: GenieContext, userId?: string, sessionId?: string) {
  // 1. Get selected dishes and their ingredients
  const selectedDishes = await prisma.menuItem.findMany({
    where: { id: { in: ctx.selectedDishIds } },
    include: { ingredientTags: { include: { ingredient: true } } },
  });

  // Build session profile: ingredients + categories of selected dishes
  const ingredientCounts: Record<string, number> = {};
  const ingredientCategories: Record<string, string> = {};
  const selectedCategoryCounts: Record<string, number> = {};
  const selectedLocalIds = new Set<string>();

  for (const dish of selectedDishes) {
    // Track dish categories as fallback when no ingredients
    selectedCategoryCounts[dish.categoria] = (selectedCategoryCounts[dish.categoria] ?? 0) + 1;
    selectedLocalIds.add(dish.localId);
    for (const tag of dish.ingredientTags) {
      const name = tag.ingredient.name;
      ingredientCounts[name] = (ingredientCounts[name] ?? 0) + 1;
      ingredientCategories[name] = tag.ingredient.category;
    }
  }
  const hasIngredientData = Object.keys(ingredientCounts).length > 0;

  // Get user profile
  let profile: { avoidIngredients: string[]; dietaryRestrictions: string[]; fitnessMode: string | null; favoriteIngredients: string[] } | null = null;
  if (userId) {
    profile = await prisma.userTasteProfile.findUnique({
      where: { userId },
      select: { avoidIngredients: true, dietaryRestrictions: true, fitnessMode: true, favoriteIngredients: true },
    });
  }
  // Build avoid set from profile + dietary restrictions
  const RESTRICTION_INGREDIENTS: Record<string, string[]> = {
    "vegetariano": ["pollo", "carne", "cerdo", "vacuno", "cordero", "tocino", "jamón", "pepperoni", "lomo", "mechada", "beef"],
    "vegano": ["pollo", "carne", "cerdo", "vacuno", "cordero", "tocino", "jamón", "pepperoni", "lomo", "mechada", "beef", "queso", "queso crema", "crema", "mozzarella", "cheddar", "parmesano", "mantequilla", "huevo", "salmón", "camarón", "ebi"],
    "sin mariscos": ["camarón", "ebi", "pulpo", "calamar", "jaiba"],
    "sin cerdo": ["cerdo", "tocino", "jamón", "pepperoni"],
    "sin lácteos": ["queso", "queso crema", "crema", "mozzarella", "cheddar", "parmesano", "mantequilla", "ricota"],
  };
  const avoidSet = new Set(profile?.avoidIngredients?.map(i => i.toLowerCase()) ?? []);
  for (const restriction of profile?.dietaryRestrictions ?? []) {
    const mapped = RESTRICTION_INGREDIENTS[restriction.toLowerCase()];
    if (mapped) mapped.forEach(i => avoidSet.add(i));
  }

  // Get previously loved ingredient names
  const lovedIngredients = new Set<string>();
  if (userId || sessionId) {
    const loved = await prisma.dishRating.findMany({
      where: { score: "LOVED", ...(userId ? { userId } : { sessionId: sessionId ?? "" }) },
      select: { menuItem: { select: { ingredientTags: { select: { ingredient: { select: { name: true } } } } } } },
    });
    for (const r of loved) {
      for (const t of r.menuItem.ingredientTags) lovedIngredients.add(t.ingredient.name);
    }
  }

  // Determine hunger filter
  const hungerKey = ctx.ctxHunger?.toUpperCase() ?? "MEDIUM";
  const allowedHunger = HUNGER_MAP[hungerKey] ?? ["LIGHT", "MEDIUM", "HEAVY"];

  // Exclude non-food categories from recommendations
  const FOOD_ONLY_EXCLUDE = ["DESSERT", "ICE_CREAM", "COFFEE", "TEA", "SMOOTHIE", "JUICE", "DRINK", "BEER", "WINE", "COCKTAIL", "OTHER"];

  // Diet filter for recommendations
  const userDiet = profile?.dietaryRestrictions ?? [];
  const isVegan = userDiet.includes("vegano");
  const isVegetarian = userDiet.includes("vegetariano");
  const isPescetarian = userDiet.includes("pescetariano");
  type DT = "VEGAN" | "VEGETARIAN" | "PESCETARIAN" | "OMNIVORE";
  const allowedDietTypes: DT[] = isVegan ? ["VEGAN"]
    : isVegetarian ? ["VEGAN", "VEGETARIAN"]
    : isPescetarian ? ["VEGAN", "VEGETARIAN", "PESCETARIAN"]
    : ["VEGAN", "VEGETARIAN", "PESCETARIAN", "OMNIVORE"];

  // 2. Fetch candidates
  const candidates = await prisma.menuItem.findMany({
    where: {
      isAvailable: true,
      imagenUrl: { not: null },
      id: { notIn: ctx.selectedDishIds },
      categoria: { notIn: FOOD_ONLY_EXCLUDE },
      dietType: { in: allowedDietTypes },
      local: { menuItems: { some: { isAvailable: true } } },
    },
    include: {
      ingredientTags: { include: { ingredient: true } },
      local: { select: { id: true, nombre: true, slug: true, comuna: true, direccion: true, lat: true, lng: true, logoUrl: true, linkPedido: true } },
      _count: { select: { ratings: true } },
    },
    take: 200,
  });

  // 3. Score each candidate
  const scored = candidates
    .filter(c => {
      // Filter out dishes with avoid ingredients
      const ings = c.ingredientTags.map(t => t.ingredient.name.toLowerCase());
      if (ings.some(i => avoidSet.has(i))) return false;
      // Budget filter
      if (ctx.ctxBudget && c.precio > ctx.ctxBudget) return false;
      return true;
    })
    .map(c => {
      let score = 0;
      const ings = c.ingredientTags.map(t => t.ingredient.name);
      const ingCats = c.ingredientTags.map(t => t.ingredient.category);

      // Shared ingredients with session profile — strongest signal
      let sharedCount = 0;
      for (const ing of ings) {
        if (ingredientCounts[ing]) { score += 5; sharedCount++; }
      }
      // Bonus for high overlap ratio
      if (ings.length > 0 && sharedCount > 0) {
        const overlapRatio = sharedCount / ings.length;
        score += Math.round(overlapRatio * 10); // up to +10 for 100% overlap
      }

      // Category match — DOMINANT signal: if user picked brunch, recommend brunch
      if (selectedCategoryCounts[c.categoria]) {
        score += 20;
        // Extra boost proportional to how many times user picked this category
        score += (selectedCategoryCounts[c.categoria] - 1) * 5;
      }

      // Same local boost
      if (selectedLocalIds.has(c.localId)) score += 3;

      // Favorite ingredients from user profile
      const favSet = new Set((profile?.favoriteIngredients ?? []).map(i => i.toLowerCase()));
      for (const ing of ings) {
        if (favSet.has(ing.toLowerCase())) score += 3;
      }

      // Hunger level match
      if (c.hungerLevel && allowedHunger.includes(c.hungerLevel)) score += 2;

      // Loved history bonus
      for (const ing of ings) {
        if (lovedIngredients.has(ing)) score += 1;
      }

      // Fitness mode
      if (profile?.fitnessMode === "CUTTING") {
        const proteinCount = ingCats.filter(c => c === "PROTEIN").length;
        const carbCount = ingCats.filter(c => c === "CARB").length;
        if (proteinCount > carbCount) score += 2;
        if (carbCount > proteinCount) score -= 2;
      } else if (profile?.fitnessMode === "GAINING") {
        if (c.hungerLevel === "HEAVY") score += 2;
      }

      // Weather-based scoring
      if (ctx.weatherTemp != null) {
        const isCold = ctx.weatherTemp < 15;
        const isHot = ctx.weatherTemp > 25;
        if (isCold) {
          if (COLD_BOOST_CATS.includes(c.categoria)) score += 3;
          if (ings.some(i => COLD_BOOST_INGS.some(k => i.toLowerCase().includes(k)))) score += 2;
        }
        if (isHot) {
          if (HOT_BOOST_CATS.includes(c.categoria)) score += 3;
          if (ings.some(i => HOT_BOOST_INGS.some(k => i.toLowerCase().includes(k)))) score += 2;
        }
      }
      if (ctx.weatherCondition === "rain" || ctx.weatherCondition === "drizzle") {
        if (COLD_BOOST_CATS.includes(c.categoria)) score += 2; // Rainy = comfort food
      }

      // Distance
      let distanceKm: number | null = null;
      if (ctx.userLat && ctx.userLng && c.local.lat && c.local.lng) {
        distanceKm = haversineKm(ctx.userLat, ctx.userLng, c.local.lat, c.local.lng);
      }

      // Tags
      const tags: string[] = [];
      if (c.totalLoved > 5) tags.push("Mas pedido");
      if (ings.some(i => ingredientCounts[i])) tags.push("Coincide con tus gustos");
      if (c.hungerLevel === "LIGHT") tags.push("Liviano");
      if (c.hungerLevel === "HEAVY") tags.push("Abundante");
      if (distanceKm !== null && distanceKm < 2) tags.push("Cerca tuyo");

      return {
        id: c.id,
        nombre: c.nombre,
        categoria: c.categoria,
        descripcion: c.descripcion,
        precio: c.precio,
        imagenUrl: c.imagenUrl,
        hungerLevel: c.hungerLevel,
        avgRating: c.avgRating,
        totalRatings: c._count.ratings,
        role: null as string | null,
        totalLoved: c.totalLoved,
        ingredients: ings,
        local: c.local,
        distanceKm,
        distanceLabel: distanceKm !== null ? formatDistance(distanceKm) : null,
        tags,
        score,
      };
    })
    .sort((a, b) => b.score - a.score);

  // ── Build results: selected dishes are the BASE, Genio complements ──

  // Fetch full local data for selected dishes
  const selectedWithLocal = await prisma.menuItem.findMany({
    where: { id: { in: ctx.selectedDishIds } },
    include: {
      ingredientTags: { include: { ingredient: true } },
      local: { select: { id: true, nombre: true, slug: true, comuna: true, direccion: true, lat: true, lng: true, logoUrl: true, linkPedido: true } },
      _count: { select: { ratings: true } },
    },
  });

  // Selected dishes = the base of the recommendation
  const base = selectedWithLocal.map(d => {
    let distanceKm: number | null = null;
    if (ctx.userLat && ctx.userLng && d.local?.lat && d.local?.lng) {
      distanceKm = haversineKm(ctx.userLat, ctx.userLng, d.local.lat, d.local.lng);
    }
    const formatted = {
      id: d.id, nombre: d.nombre, categoria: d.categoria, descripcion: d.descripcion,
      precio: d.precio, imagenUrl: d.imagenUrl, hungerLevel: d.hungerLevel,
      avgRating: d.avgRating, totalRatings: d._count.ratings, totalLoved: d.totalLoved,
      ingredients: d.ingredientTags.map(t => t.ingredient.name),
      local: d.local, distanceKm,
      distanceLabel: distanceKm !== null ? formatDistance(distanceKm) : null,
      tags: [] as string[], score: 100, role: null as string | null,
    };
    // Tags for selected dishes
    if (d.totalLoved > 5) formatted.tags.push("Mas pedido");
    formatted.tags.push("Lo que elegiste");
    return formatted;
  });

  // How many complements based on hunger
  // LIGHT: 0 complements (just what you picked)
  // MEDIUM: 1 complement
  // HEAVY: 2 complements
  const complementCount = ctx.ctxHunger?.toUpperCase() === "LIGHT" ? 0
    : ctx.ctxHunger?.toUpperCase() === "HEAVY" ? 2
    : 1;

  const complements: typeof base = [];
  if (complementCount > 0 && scored.length > 0) {
    // Prefer complements from the same local as the first selected dish
    const preferredLocal = selectedWithLocal[0]?.local?.id;
    const sameLocal = preferredLocal ? scored.filter(s => s.local.id === preferredLocal) : scored;
    const pool = sameLocal.length > 0 ? sameLocal : scored;

    for (const c of pool) {
      if (complements.length >= complementCount) break;
      // Don't duplicate selected dishes
      if (ctx.selectedDishIds.includes(c.id)) continue;
      c.role = complements.length === 0 ? "El Genio sugiere" : "Complemento";
      complements.push(c);
    }
  }

  // First the user's picks, then complements
  const results = [...base, ...complements];

  // Label roles
  if (base.length === 1) {
    base[0].role = "Tu elección";
  } else {
    base.forEach((b, i) => { b.role = i === 0 ? "Tu elección principal" : "También elegiste"; });
  }

  return results;
}
