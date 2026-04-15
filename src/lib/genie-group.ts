import { prisma } from "@/lib/prisma";

interface MemberProfile {
  selectedDishes: string[];
  ctxHunger?: string;
  ctxBudget?: number;
  avoidIngredients: string[];
  allowedDiet: string[];
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function getGroupRecommendation(groupId: string, userLat?: number, userLng?: number) {
  const group = await prisma.groupSession.findUnique({
    where: { id: groupId },
    include: { members: true },
  });
  if (!group) return null;

  // Build profiles for each member
  const profiles: (MemberProfile & { memberId: string })[] = [];

  for (const member of group.members) {
    // Get user taste profile if exists
    let avoidIngredients: string[] = [];
    if (member.userId) {
      const profile = await prisma.userTasteProfile.findUnique({
        where: { userId: member.userId },
        select: { avoidIngredients: true, dietaryRestrictions: true },
      });
      avoidIngredients = profile?.avoidIngredients ?? [];
    }

    // Get diet type from restrictions
    const dietRestrictions = profile?.dietaryRestrictions ?? [];
    const isVegan = dietRestrictions.includes("vegano");
    const isVegetarian = dietRestrictions.includes("vegetariano");
    const isPescetarian = dietRestrictions.includes("pescetariano");
    const allowedDiet = isVegan ? ["VEGAN"]
      : isVegetarian ? ["VEGAN", "VEGETARIAN"]
      : isPescetarian ? ["VEGAN", "VEGETARIAN", "PESCETARIAN"]
      : ["VEGAN", "VEGETARIAN", "PESCETARIAN", "OMNIVORE"];

    profiles.push({
      memberId: member.id,
      selectedDishes: member.selectedDishes,
      ctxHunger: member.ctxHunger ?? undefined,
      ctxBudget: member.ctxBudget ?? undefined,
      avoidIngredients,
      allowedDiet,
    });
  }

  // Merge all avoid ingredients
  const globalAvoid = new Set<string>();
  for (const p of profiles) {
    p.avoidIngredients.forEach(i => globalAvoid.add(i.toLowerCase()));
  }

  // Get all selected dish IDs across members
  const allSelectedIds = [...new Set(profiles.flatMap(p => p.selectedDishes))];

  // Get selected dishes with their ingredients and locals
  const selectedDishes = await prisma.menuItem.findMany({
    where: { id: { in: allSelectedIds } },
    include: {
      ingredientTags: { include: { ingredient: true } },
      local: { select: { id: true, nombre: true, slug: true, comuna: true, direccion: true, lat: true, lng: true, logoUrl: true, linkPedido: true } },
    },
  });

  // Group selected dishes by local
  const localDishes: Record<string, typeof selectedDishes> = {};
  for (const d of selectedDishes) {
    if (!localDishes[d.localId]) localDishes[d.localId] = [];
    localDishes[d.localId].push(d);
  }

  // Get ALL dishes from candidate locals (locals that have at least 1 selected dish)
  const candidateLocalIds = Object.keys(localDishes);
  const FOOD_EXCLUDE = ["DESSERT", "ICE_CREAM", "COFFEE", "TEA", "SMOOTHIE", "JUICE", "DRINK", "BEER", "WINE", "COCKTAIL", "OTHER"];

  const allDishesFromLocals = await prisma.menuItem.findMany({
    where: {
      localId: { in: candidateLocalIds },
      isAvailable: true,
      categoria: { notIn: FOOD_EXCLUDE },
    },
    include: {
      ingredientTags: { include: { ingredient: true } },
      local: { select: { id: true, nombre: true, slug: true, comuna: true, direccion: true, lat: true, lng: true, logoUrl: true, linkPedido: true } },
    },
  });

  // Score each local: how well does it satisfy ALL members?
  const localScores: { localId: string; local: any; score: number; dishesPerMember: Record<string, any> }[] = [];

  for (const localId of candidateLocalIds) {
    const localMenuDishes = allDishesFromLocals.filter(d => d.localId === localId);
    if (localMenuDishes.length < profiles.length) continue; // Not enough dishes for everyone

    let totalScore = 0;
    const dishesPerMember: Record<string, any> = {};
    const usedDishIds = new Set<string>();

    for (const member of profiles) {
      // Get this member's selected dish ingredients
      const memberSelected = selectedDishes.filter(d => member.selectedDishes.includes(d.id));
      const memberIngredients: Record<string, number> = {};
      for (const d of memberSelected) {
        for (const tag of d.ingredientTags) {
          memberIngredients[tag.ingredient.name] = (memberIngredients[tag.ingredient.name] ?? 0) + 1;
        }
      }
      const memberCategories: Record<string, number> = {};
      for (const d of memberSelected) {
        memberCategories[d.categoria] = (memberCategories[d.categoria] ?? 0) + 1;
      }

      // Score each dish in this local for this member
      let bestDish: any = null;
      let bestScore = -1;

      for (const dish of localMenuDishes) {
        if (usedDishIds.has(dish.id)) continue; // Don't assign same dish to two people

        // Diet type check — this member can only eat compatible dishes
        if (!member.allowedDiet.includes(dish.dietType ?? "OMNIVORE")) continue;

        // Check avoid ingredients
        const dishIngs = dish.ingredientTags.map(t => t.ingredient.name.toLowerCase());
        if (dishIngs.some(i => globalAvoid.has(i))) continue;

        // Budget check
        if (member.ctxBudget && dish.precio > member.ctxBudget) continue;

        let dishScore = 0;

        // Ingredient match
        for (const ing of dish.ingredientTags.map(t => t.ingredient.name)) {
          if (memberIngredients[ing]) dishScore += 5;
        }

        // Category match
        if (memberCategories[dish.categoria]) dishScore += 8;

        // Was directly selected by this member
        if (member.selectedDishes.includes(dish.id)) dishScore += 15;

        if (dishScore > bestScore) {
          bestScore = dishScore;
          bestDish = {
            id: dish.id,
            nombre: dish.nombre,
            categoria: dish.categoria,
            descripcion: dish.descripcion,
            precio: dish.precio,
            imagenUrl: dish.imagenUrl,
            score: dishScore,
          };
        }
      }

      if (bestDish) {
        usedDishIds.add(bestDish.id);
        dishesPerMember[member.memberId] = bestDish;
        totalScore += bestScore;
      } else {
        totalScore -= 20; // Penalty: no good dish found for this member
      }
    }

    const local = localMenuDishes[0]?.local;
    if (local) {
      let distanceKm: number | null = null;
      if (userLat && userLng && local.lat && local.lng) {
        distanceKm = haversineKm(userLat, userLng, local.lat, local.lng);
      }

      localScores.push({
        localId,
        local: { ...local, distanceKm, distanceLabel: distanceKm != null ? (distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`) : null },
        score: totalScore,
        dishesPerMember,
      });
    }
  }

  // Sort by score
  localScores.sort((a, b) => b.score - a.score);

  if (localScores.length === 0) return null;

  return {
    bestLocal: localScores[0],
    alternatives: localScores.slice(1, 3),
  };
}

export function generateGroupCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}
