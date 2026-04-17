import type {
  Dish,
  Category,
  RestaurantScheduleRule,
  TimeOfDay,
} from "@prisma/client";

export function getTimeOfDay(): TimeOfDay {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Santiago" })
  );
  const hour = now.getHours();

  if (hour >= 6 && hour < 11) return "MORNING";
  if (hour >= 11 && hour < 15) return "LUNCH";
  if (hour >= 15 && hour < 19) return "AFTERNOON";
  if (hour >= 19 && hour < 23) return "DINNER";
  return "LATE";
}

export async function getWeatherCondition(): Promise<string> {
  // TODO: connect to weather API
  return "CLEAR";
}

export function applyScheduleRules(
  dishes: Dish[],
  categories: Category[],
  rules: RestaurantScheduleRule[],
  timeOfDay: TimeOfDay,
  weather: string
) {
  // Find matching rules for current conditions
  const matchingRules = rules.filter((r) => {
    if (r.ruleType === "TIME_OF_DAY" && r.condition === timeOfDay) return true;
    if (r.ruleType === "WEATHER" && r.condition === weather) return true;
    return false;
  });

  if (matchingRules.length === 0) return { dishes, categories };

  const boostedCategoryIds = new Set<string>();
  const boostedDishIds = new Set<string>();

  for (const rule of matchingRules) {
    if (rule.categoryId) boostedCategoryIds.add(rule.categoryId);
    if (rule.dishId) boostedDishIds.add(rule.dishId);
  }

  // Reorder categories: boosted ones first, rest keep original order
  const sortedCategories = [
    ...categories.filter((c) => boostedCategoryIds.has(c.id)),
    ...categories.filter((c) => !boostedCategoryIds.has(c.id)),
  ];

  // Reorder dishes: boosted ones first within each category
  const sortedDishes = [
    ...dishes.filter((d) => boostedDishIds.has(d.id)),
    ...dishes.filter((d) => !boostedDishIds.has(d.id)),
  ];

  return { dishes: sortedDishes, categories: sortedCategories };
}
