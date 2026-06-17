import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import ClientesClient from "./ClientesClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Clientes | QuieroComer",
  description: "Restaurantes reales que ya usan QuieroComer para vender más.",
};

const REAL_SLUGS = ["hand-roll", "horusvegan", "juana-la-brava", "alleria-pizza", "el-menu-de-la-esquina"];

export default async function ClientesPage() {
  const [restaurants, totalDishes, totalCategories, totalSessions, totalDishViews] = await Promise.all([
    prisma.restaurant.findMany({
      where: { slug: { in: REAL_SLUGS }, isActive: true },
      select: {
        name: true,
        slug: true,
        logoUrl: true,
        _count: { select: { dishes: { where: { isActive: true } }, categories: { where: { isActive: true } } } },
      },
    }),
    prisma.dish.count({ where: { isActive: true, restaurant: { slug: { in: REAL_SLUGS } } } }),
    prisma.category.count({ where: { isActive: true, restaurant: { slug: { in: REAL_SLUGS } } } }),
    prisma.session.count({ where: { restaurant: { slug: { in: REAL_SLUGS } } } }),
    prisma.statEvent.count({ where: { eventType: "DISH_VIEW", restaurant: { slug: { in: REAL_SLUGS } } } }),
  ]);

  const clients = REAL_SLUGS.map((slug) => {
    const r = restaurants.find((x) => x.slug === slug);
    return r ? {
      name: r.name,
      slug: r.slug,
      logoUrl: r.logoUrl,
      dishes: r._count.dishes,
      categories: r._count.categories,
    } : null;
  }).filter(Boolean) as { name: string; slug: string; logoUrl: string | null; dishes: number; categories: number }[];

  return <ClientesClient clients={clients} totalDishes={totalDishes} totalCategories={totalCategories} totalSessions={totalSessions} totalDishViews={totalDishViews} />;
}
