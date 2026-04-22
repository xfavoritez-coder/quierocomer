import { prisma } from "@/lib/prisma";

export async function getRestaurantBySlug(slug: string) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug, isActive: true },
    include: {
      categories: {
        where: { isActive: true },
        orderBy: { position: "asc" },
      },
      dishes: {
        where: { isActive: true, deletedAt: null },
        orderBy: { position: "asc" },
        include: {
          modifierTemplates: {
            include: {
              groups: {
                orderBy: { position: "asc" },
                include: { options: { orderBy: { position: "asc" } } },
              },
            },
          },
          dishIngredients: {
            include: {
              ingredient: {
                include: { allergens: { select: { id: true, name: true } } },
              },
            },
          },
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

  return { ...restaurant, ratingMap };
}

export type RestaurantData = NonNullable<
  Awaited<ReturnType<typeof getRestaurantBySlug>>
>;
