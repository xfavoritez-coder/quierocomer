import type { CompiledProfile } from "./compileProfile";
import { scoreDish, type ScoringContext, type ScoringDish } from "./dishScoring";

export interface PersonalizationEntry {
  score: number;
  autoRecommended: boolean;
  reason: string | null;
  isExploration: boolean;
}

export type PersonalizationMap = Map<string, PersonalizationEntry>;

export interface PersonalizedResult {
  map: PersonalizationMap;
  hasPersonalization: boolean;
}

export function getPersonalizedDishes(
  dishes: ScoringDish[],
  categories: { id: string; name: string }[],
  profile: CompiledProfile | null,
  context: ScoringContext
): PersonalizedResult {
  if (!profile) {
    return { map: new Map(), hasPersonalization: false };
  }

  const map: PersonalizationMap = new Map();

  // Score all dishes
  for (const dish of dishes) {
    const { score, reason } = scoreDish(dish, profile, context);
    map.set(dish.id, {
      score,
      autoRecommended: false,
      reason,
      isExploration: false,
    });
  }

  // Group by category and mark autoRecommended
  for (const cat of categories) {
    const catDishes = dishes.filter((d) => d.categoryId === cat.id);
    if (catDishes.length === 0) continue;

    // Sort by score descending
    const sorted = catDishes
      .map((d) => ({ dish: d, entry: map.get(d.id)! }))
      .sort((a, b) => b.entry.score - a.entry.score);

    const top = sorted[0];
    const second = sorted[1];

    // Skip if top dish already has manual RECOMMENDED
    if (top.dish.tags?.includes("RECOMMENDED")) continue;

    // Must have score >= 70
    if (top.entry.score < 70) continue;

    // Must have >= 5 point lead over second (or be the only dish)
    if (second && top.entry.score - second.entry.score < 5) continue;

    top.entry.autoRecommended = true;
  }

  // Exploration feature disabled for now
  // TODO: re-enable when we have better UX for "Descubre"

  return { map, hasPersonalization: true };
}
