import { revalidateTag } from "next/cache";

/**
 * Invalidates the QR cache for a specific restaurant (by slug) or all restaurants.
 * Call this after any mutation that affects the menu (dishes, categories, promotions).
 */
export function revalidateQrCache(slug?: string) {
  revalidateTag("qr-restaurant", "max");
  if (slug) revalidateTag(`qr-restaurant-${slug}`, "max");
}
