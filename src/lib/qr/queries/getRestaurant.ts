import { prisma } from "@/lib/prisma";
import type { Lang } from "@/lib/qr/i18n";

export async function getRestaurantBySlug(slug: string, lang: Lang = "es") {
  const needTranslations = lang !== "es";

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug, isActive: true },
    include: {
      categories: {
        where: { isActive: true },
        orderBy: { position: "asc" },
        ...(needTranslations && {
          include: { translations: { where: { lang } } },
        }),
      },
      dishes: {
        where: { isActive: true, deletedAt: null },
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
      reviews: {
        where: { isVerified: true },
        select: {
          id: true,
          dishId: true,
          rating: true,
          customerId: true,
          createdAt: true,
        },
      },
    },
  });

  if (!restaurant) return null;

  // Compute average rating per dish
  const ratingMap: Record<string, { avg: number; count: number }> = {};
  for (const review of restaurant.reviews) {
    if (!ratingMap[review.dishId]) {
      ratingMap[review.dishId] = { avg: 0, count: 0 };
    }
    ratingMap[review.dishId].count++;
    ratingMap[review.dishId].avg += review.rating;
  }
  for (const dishId of Object.keys(ratingMap)) {
    ratingMap[dishId].avg = ratingMap[dishId].avg / ratingMap[dishId].count;
  }

  // Overlay translations: replace description/name with translated versions
  // Components receive the same shape — no changes needed downstream
  if (needTranslations) {
    for (const cat of restaurant.categories as any[]) {
      const tr = cat.translations?.[0];
      if (tr?.name) cat.name = tr.name;
    }
    for (const dish of restaurant.dishes as any[]) {
      const tr = dish.translations?.[0];
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

  return { ...restaurant, ratingMap };
}

export type RestaurantData = NonNullable<
  Awaited<ReturnType<typeof getRestaurantBySlug>>
>;
