import type { Dish, Category } from "@prisma/client";

export function isGeniePick(dish: Dish): boolean {
  return dish.tags?.includes("RECOMMENDED") ?? false;
}

export function getDishPhoto(dish: Dish, size: "thumb" | "card" | "detail" | "hero" = "card"): string | null {
  const url = dish.photos?.[0] ?? null;
  if (!url) return null;
  // Unsplash URLs: apply Imgix params for the right size
  if (url.includes("images.unsplash.com")) {
    const rawUrl = url.split("?")[0];
    const params: Record<string, string> = {
      thumb: "w=400&q=80&fm=webp&fit=crop&crop=entropy&auto=compress",
      card:  "w=600&q=80&fm=webp&fit=crop&crop=entropy&auto=compress",
      detail:"w=1080&q=85&fm=webp&fit=crop&crop=entropy&auto=compress",
      hero:  "w=1200&q=85&fm=webp&fit=crop&crop=entropy&auto=compress",
    };
    return `${rawUrl}?${params[size] || params.card}`;
  }
  return url;
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
