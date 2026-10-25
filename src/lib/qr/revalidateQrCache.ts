import { revalidateTag, revalidatePath } from "next/cache";

/**
 * Invalidates the QR cache for a specific restaurant (by slug) or all restaurants.
 * Call this after any mutation that affects the menu (dishes, categories, promotions).
 */
export function revalidateQrCache(slug?: string) {
  revalidateTag("qr-restaurant", "max");
  if (slug) {
    revalidateTag(`qr-restaurant-${slug}`, "max");
    // Also revalidate the restaurant landing page (/[restaurantSlug]) which has its own
    // page-level cache (revalidate = 3600) and doesn't use unstable_cache tags.
    revalidatePath(`/${slug}`);
    revalidatePath(`/qr/${slug}`);
  }
}
