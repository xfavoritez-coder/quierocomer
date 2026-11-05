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
        // appOnly: platos exclusivos de la app no se muestran en la carta QR ni en Pedidos online.
        where: { isActive: true, deletedAt: null, ecommerceOnly: false, appOnly: false },
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
      // promotions loaded separately below to avoid TS issues with new fields
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

  // ── Cargar promos activas del restaurante (query separada para tipos nuevos) ──
  const now = new Date();
  const todayDow = new Date(now.toLocaleString("en-US", { timeZone: "America/Santiago" })).getDay();
  const activePromos = await (prisma as any).promotion.findMany({
    where: {
      restaurantId: restaurant.id,
      status: "ACTIVE",
      dishId: { not: null },
      OR: [{ validUntil: null }, { validUntil: { gt: now } }],
    },
    select: { id: true, dishId: true, promoName: true, promoPrice: true, originalPrice: true, daysOfWeek: true, validFrom: true },
  }).then((promos: any[]) => promos.filter(p => {
    if (p.validFrom && new Date(p.validFrom) > now) return false;
    if (p.daysOfWeek && p.daysOfWeek.length > 0 && !p.daysOfWeek.includes(todayDow)) return false;
    return true;
  }));

  // ── Filtrar platos por daysOfWeek y aplicar overrides de promo ──
  const r = restaurant as any;
  const filteredDishes = (r.dishes as any[]).filter((d: any) => {
    if (!d.daysOfWeek || d.daysOfWeek.length === 0) return true;
    return d.daysOfWeek.includes(todayDow);
  });

  for (const dish of filteredDishes) {
    const promo = activePromos.find((p: any) => p.dishId === dish.id);
    if (promo) {
      if (promo.promoName) dish.name = promo.promoName;
      if (promo.promoPrice != null) dish.discountPrice = promo.promoPrice;
      if (promo.originalPrice != null) dish.price = promo.originalPrice;
      dish._promoId = promo.id;
    }
  }

  // Overlay translations
  if (needTranslations) {
    for (const cat of r.categories as any[]) {
      const tr = cat.translations?.[0];
      if (tr?.name) cat.name = tr.name;
    }
    for (const dish of filteredDishes) {
      const tr = dish.translations?.[0];
      dish._hasTranslation = !!(tr?.name);
      if (tr?.name && !dish._promoId) dish.name = tr.name;
      if (tr?.description) dish.description = tr.description;
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

  return { ...r, dishes: filteredDishes, ratingMap: {} as Record<string, { avg: number; count: number }> };
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
      revalidate: 600,
    }
  )().catch(() => null)
}

export type RestaurantData = NonNullable<
  Awaited<ReturnType<typeof _getRestaurantBySlug>>
>;
