import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import ClientesClient from "./ClientesClient";

export const metadata: Metadata = {
  title: "Clientes | QuieroComer",
  description: "Restaurantes reales que ya usan QuieroComer para vender más.",
};

const REAL_SLUGS = ["hand-roll", "horusvegan", "juana-la-brava", "alleria-pizza", "nascosto-pizzeria"];

export default async function ClientesPage() {
  const [restaurants, totalDishes, totalCategories] = await Promise.all([
    prisma.restaurant.findMany({
      where: { slug: { in: REAL_SLUGS }, isActive: true },
      select: {
        name: true,
        slug: true,
        logoUrl: true,
        _count: { select: { dishes: { where: { isActive: true } }, categories: { where: { isActive: true } } } },
      },
    }),
    prisma.dish.count({ where: { isActive: true } }),
    prisma.category.count({ where: { isActive: true } }),
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

  return <ClientesClient clients={clients} totalDishes={totalDishes} totalCategories={totalCategories} />;
}
