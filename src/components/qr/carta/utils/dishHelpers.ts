import type { Dish, Category } from "@prisma/client";

export function isGeniePick(dish: Dish): boolean {
  return dish.tags?.includes("RECOMMENDED") ?? false;
}

export function getDishPhoto(dish: Dish): string | null {
  return dish.photos?.[0] ?? null;
}

export interface DishesByCategory {
  category: Category;
  dishes: Dish[];
}

/**
 * Groups dishes by category respecting Category.position order.
 * Within each category, dishes are sorted by position.
 */
export function groupDishesByCategory(
  dishes: Dish[],
  categories: Category[],
): DishesByCategory[] {
  const sortedCategories = [...categories].sort((a, b) => a.position - b.position);
  return sortedCategories
    .filter((c) => c.isActive)
    .map((category) => ({
      category,
      dishes: dishes
        .filter((d) => d.categoryId === category.id)
        .sort((a, b) => a.position - b.position),
    }))
    .filter((group) => group.dishes.length > 0);
}
