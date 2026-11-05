import { revalidateTag, revalidatePath } from "next/cache";

/**
 * Invalidates the QR cache for a specific restaurant (by slug) or all restaurants.
 * Call this after any mutation that affects the menu (dishes, categories, promotions).
 */
export function revalidateQrCache(slug?: string) {
  revalidateTag("qr-restaurant", { expire: 0 } as any);
  // El menú del ecommerce (storefront) se cachea aparte pero cambia con las mismas
  // ediciones de carta → lo invalidamos aquí también (por slug, o global sin slug).
  revalidateTag("ecom-storefront", { expire: 0 } as any);
  if (slug) {
    revalidateTag(`qr-restaurant-${slug}`, { expire: 0 } as any);
    revalidateTag(`ecom-storefront-slug-${slug}`, { expire: 0 } as any);
    // Also revalidate the restaurant landing page (/[restaurantSlug]) which has its own
    // page-level cache (revalidate = 3600) and doesn't use unstable_cache tags.
    revalidatePath(`/${slug}`);
    revalidatePath(`/qr/${slug}`);
  }
}
