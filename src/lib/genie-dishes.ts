import { prisma } from "@/lib/prisma";

// Dietary restriction → ingredient names to exclude
const RESTRICTION_MAP: Record<string, string[]> = {
  "vegetariano": ["pollo", "carne", "cerdo", "vacuno", "cordero", "pavo", "tocino", "jamón", "salchicha", "chorizo"],
  "vegano": ["pollo", "carne", "cerdo", "vacuno", "cordero", "pavo", "tocino", "jamón", "salchicha", "chorizo", "queso", "crema", "mantequilla", "leche", "yogurt", "huevo", "miel"],
  "sin gluten": ["pan", "pasta", "harina", "trigo", "cebada"],
  "sin mariscos": ["camarón", "langostino", "pulpo", "calamar", "mejillón", "ostra", "almeja", "cangrejo", "jaiba"],
  "sin cerdo": ["cerdo", "tocino", "jamón", "chorizo", "salchicha"],
  "sin lácteos": ["queso", "crema", "mantequilla", "leche", "yogurt"],
  "sin frutos secos": ["maní", "nuez", "almendra", "avellana", "pistacho", "castaña"],
};

export async function getInitialDishes(userId?: string, sessionId?: string, excludeIds: string[] = []) {
  // Get user profile if exists
  let profile: { avoidIngredients: string[]; dietaryRestrictions: string[]; fitnessMode: string | null; favoriteIngredients: string[] } | null = null;
  if (userId) {
    profile = await prisma.userTasteProfile.findUnique({
      where: { userId },
      select: { avoidIngredients: true, dietaryRestrictions: true, fitnessMode: true, favoriteIngredients: true },
    });
  }

  // Build excluded ingredients from restrictions + profile
  const excludeIngredients = new Set<string>(profile?.avoidIngredients ?? []);
  for (const restriction of profile?.dietaryRestrictions ?? []) {
    const mapped = RESTRICTION_MAP[restriction.toLowerCase()];
    if (mapped) mapped.forEach(i => excludeIngredients.add(i));
  }

  // Get previously disliked dish ids
  const dislikedIds: string[] = [];
  if (userId || sessionId) {
    const disliked = await prisma.dishRating.findMany({
      where: {
        score: "DISLIKED",
        ...(userId ? { userId } : { sessionId: sessionId ?? "" }),
      },
      select: { menuItemId: true },
    });
    dislikedIds.push(...disliked.map(d => d.menuItemId));
  }

  const allExcludeIds = [...excludeIds, ...dislikedIds];

  // Categories to exclude from initial selection (desserts, coffee, etc)
  const FOOD_ONLY_EXCLUDE = ["DESSERT", "ICE_CREAM", "COFFEE", "TEA", "SMOOTHIE", "JUICE", "DRINK", "BEER", "WINE", "COCKTAIL", "OTHER"];

  // Determine diet filter from user restrictions
  const userDietRestrictions = profile?.dietaryRestrictions ?? [];
  const isVegan = userDietRestrictions.includes("vegano");
  const isVegetarian = userDietRestrictions.includes("vegetariano");
  const isPescetarian = userDietRestrictions.includes("pescetariano");

  // Diet type filter: vegans see only VEGAN, vegetarians see VEGAN+VEGETARIAN, etc.
  type DT = "VEGAN" | "VEGETARIAN" | "PESCETARIAN" | "OMNIVORE";
  const allowedDietTypes: DT[] = isVegan ? ["VEGAN"]
    : isVegetarian ? ["VEGAN", "VEGETARIAN"]
    : isPescetarian ? ["VEGAN", "VEGETARIAN", "PESCETARIAN"]
    : ["VEGAN", "VEGETARIAN", "PESCETARIAN", "OMNIVORE"];

  // Fetch candidate dishes (food only, no desserts/drinks, diet compatible)
  const dishes = await prisma.menuItem.findMany({
    where: {
      isAvailable: true,
      imagenUrl: { not: null },
      categoria: { notIn: FOOD_ONLY_EXCLUDE },
      dietType: { in: allowedDietTypes },
      ...(allExcludeIds.length > 0 ? { id: { notIn: allExcludeIds } } : {}),
    },
    include: {
      ingredientTags: { include: { ingredient: true } },
      local: { select: { id: true, nombre: true, comuna: true, direccion: true, lat: true, lng: true, logoUrl: true, linkPedido: true } },
    },
    orderBy: [{ destacado: "desc" }, { totalLoved: "desc" }],
    take: 200,
  });

  // Filter out dishes containing excluded ingredients
  let filtered = dishes;
  if (excludeIngredients.size > 0) {
    filtered = dishes.filter(d => {
      const dishIngredients = [
        ...d.ingredients.map(i => i.toLowerCase()),
        ...d.ingredientTags.map(t => t.ingredient.name.toLowerCase()),
      ];
      return !dishIngredients.some(i => excludeIngredients.has(i));
    });
  }

  // Personalized scoring
  const favSet = new Set((profile?.favoriteIngredients ?? []).map(i => i.toLowerCase()));

  const scored = filtered.map(d => {
    let score = 0;
    const ings = [
      ...d.ingredients.map(i => i.toLowerCase()),
      ...d.ingredientTags.map(t => t.ingredient.name.toLowerCase()),
    ];

    // +3 per favorite ingredient match
    for (const ing of ings) {
      if (favSet.has(ing)) score += 3;
    }

    // +2 for high ratings, +1 for loved count
    if (d.avgRating && d.avgRating > 0.7) score += 2;
    if (d.totalLoved > 3) score += 1;

    // +1 for destacado
    if (d.destacado) score += 1;

    // Fitness mode boost (subtle, not dominant)
    if (profile?.fitnessMode === "CUTTING") {
      const hasProtein = d.ingredientTags.some(t => t.ingredient.category === "PROTEIN");
      const hasCarb = d.ingredientTags.some(t => t.ingredient.category === "CARB");
      if (hasProtein) score += 1;
      if (hasCarb) score -= 1;
    } else if (profile?.fitnessMode === "GAINING") {
      if (d.hungerLevel === "HEAVY") score += 1;
    }

    // Larger random factor for variety
    score += Math.random() * 4;

    return { ...d, _score: score };
  });

  scored.sort((a, b) => b._score - a._score);

  // Balance across locals: max 2 per local, round-robin
  const byLocal: Record<string, typeof scored> = {};
  for (const d of scored) {
    const lid = d.local.id;
    if (!byLocal[lid]) byLocal[lid] = [];
    byLocal[lid].push(d);
  }
  const balanced: typeof filtered = [];
  const localCounts: Record<string, number> = {};
  const localQueues = Object.values(byLocal);
  let idx = 0;
  while (balanced.length < 9 && localQueues.some(q => q.length > 0)) {
    for (const queue of localQueues) {
      if (balanced.length >= 9) break;
      if (queue.length > 0) {
        const dish = queue[0];
        const lid = dish.local.id;
        const count = localCounts[lid] ?? 0;
        if (count >= 3) { queue.shift(); continue; } // Max 3 per local
        balanced.push(queue.shift()!);
        localCounts[lid] = count + 1;
      }
    }
    idx++;
    if (idx > 20) break;
  }

  return balanced.slice(0, 9).map(d => ({
    id: d.id,
    nombre: d.nombre,
    categoria: d.categoria,
    descripcion: d.descripcion,
    precio: d.precio,
    imagenUrl: d.imagenUrl,
    dietType: d.dietType,
    hungerLevel: d.hungerLevel,
    avgRating: d.avgRating,
    totalLoved: d.totalLoved,
    ingredients: d.ingredientTags.map(t => t.ingredient.name),
    local: d.local,
  }));
}
