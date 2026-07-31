import type { Dish, Category } from "@prisma/client";

export function isGeniePick(dish: Dish): boolean {
  return dish.tags?.includes("RECOMMENDED") ?? false;
}

export function getDishPhoto(dish: Dish, size: "thumb" | "card" | "detail" | "hero" = "card"): string | null {
  const url = dish.photos?.[0] ?? null;
  if (!url) return null;

  // Unsplash: Imgix params
  if (url.includes("images.unsplash.com")) {
    const rawUrl = url.split("?")[0];
    const params: Record<string, string> = {
      thumb: "w=320&q=75&fm=webp&fit=crop&crop=entropy&auto=compress",
      card:  "w=500&q=80&fm=webp&fit=crop&crop=entropy&auto=compress",
      detail:"w=900&q=85&fm=webp&fit=crop&crop=entropy&auto=compress",
      hero:  "w=1200&q=85&fm=webp&fit=crop&crop=entropy&auto=compress",
    };
    return `${rawUrl}?${params[size] || params.card}`;
  }

  // Supabase Storage: use image transformation endpoint (resize)
  if (url.includes(".supabase.co/storage/v1/object/public/")) {
    const baseUrl = url.split("?")[0];
    const ext = baseUrl.split(".").pop()?.toLowerCase();
    if (ext === "svg" || ext === "gif") return url;
    const widths: Record<string, number> = { thumb: 320, card: 500, detail: 900, hero: 1200 };
    const qualities: Record<string, number> = { thumb: 75, card: 80, detail: 85, hero: 85 };
    const renderUrl = baseUrl.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
    return `${renderUrl}?width=${widths[size] || 500}&quality=${qualities[size] || 80}`;
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
