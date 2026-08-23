import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Lang } from "@/lib/qr/i18n";

async function _getRestaurantBySlug(slug: string, lang: Lang) {
  const needTranslations = lang !== "es";

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    include: {
      categories: {
        where: { isActive: true },
        orderBy: { position: "asc" },
        ...(needTranslations && {
          include: { translations: { where: { lang } } },
        }),
      },
      dishes: {
        // ecommerceOnly: platos "solo online" no se muestran en la carta QR.
        where: { isActive: true, deletedAt: null, ecommerceOnly: false },
        orderBy: { position: "asc" },
        include: {
          modifierTemplates: {
            include: {
              groups: {
                orderBy: { position: "asc" },
                include: {
                  options: {
                    where: { isHidden: false },
                    orderBy: { position: "asc" },
                    ...(needTranslations && { include: { translations: { where: { lang } } } }),
                  },
                  ...(needTranslations && { translations: { where: { lang } } }),
                },
              },
            },
          },
          dishIngredients: {
            include: {
              ingredient: {
                include: { allergens: { select: { id: true, name: true, type: true } } },
              },
            },
          },
          suggestedWith: {
            select: { suggestedDishId: true },
          },
          ...(needTranslations && {
            translations: { where: { lang } },
          }),
        },
      },
      promotions: {
        where: {
          isActive: true,
          OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
        },
      },
      schedules: {
        where: { isActive: true },
      },
      happyHours: {
        where: { isActive: true },
      },
      menuGroups: {
        where: { isActive: true },
        orderBy: { position: "asc" },
        include: { categories: { select: { id: true } } },
      },
    },
  });

  if (!restaurant) return null;

  // Overlay translations: replace description/name with translated versions
  // Components receive the same shape — no changes needed downstream
  if (needTranslations) {
    for (const cat of restaurant.categories as any[]) {
      const tr = cat.translations?.[0];
      if (tr?.name) cat.name = tr.name;
    }
    for (const dish of restaurant.dishes as any[]) {
      const tr = dish.translations?.[0];
      dish._hasTranslation = !!(tr?.name);
      if (tr?.name) dish.name = tr.name;
      if (tr?.description) dish.description = tr.description;
      // Overlay modifier translations
      for (const template of (dish.modifierTemplates || [])) {
        for (const group of (template.groups || [])) {
          const gtr = group.translations?.[0];
          if (gtr?.name) group.name = gtr.name;
          for (const opt of (group.options || [])) {
            const otr = opt.translations?.[0];
            if (otr?.name) opt.name = otr.name;
            if (otr?.description) opt.description = otr.description;
          }
        }
      }
    }
  }

  return { ...restaurant, ratingMap: {} as Record<string, { avg: number; count: number }> };
}

// Cache per slug+lang — 5 minutes TTL (tag-based invalidation garantiza actualización inmediata en cambios del panel)
// Tags allow targeted invalidation from the panel when the menu changes
export function getRestaurantBySlug(slug: string, lang: Lang = "es") {
  return unstable_cache(
    async () => {
      const result = await _getRestaurantBySlug(slug, lang)
      // Throw instead of returning null — prevents caching "not found" results
      // so inactive/reactivated restaurants aren't stuck in null cache
      if (!result) throw new Error(`Restaurant not found: ${slug}`)
      return result
    },
    ["qr-restaurant", slug, lang],
    {
      tags: ["qr-restaurant", `qr-restaurant-${slug}`],
      revalidate: 300,
    }
  )().catch(() => null)
}

export type RestaurantData = NonNullable<
  Awaited<ReturnType<typeof _getRestaurantBySlug>>
>;
