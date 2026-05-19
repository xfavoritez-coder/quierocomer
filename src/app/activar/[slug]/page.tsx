import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ActivarClient from "./ActivarClient";

export default async function ActivarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const [restaurant, activeVenues] = await Promise.all([
    prisma.restaurant.findFirst({
      where: { slug, isDemo: true },
      select: {
        id: true, name: true, slug: true, logoUrl: true,
        categories: { take: 3, orderBy: { position: "asc" }, select: { name: true } },
        dishes: {
          take: 4,
          where: {
            photos: { isEmpty: false },
            category: { name: { notIn: ["Bebidas", "Bebestibles", "Tragos", "Drinks", "Jugos", "Aguas", "Cervezas", "Vinos", "Beverages"] } },
          },
          select: { name: true, price: true, photos: true, description: true },
        },
      },
    }),
    prisma.restaurant.findMany({
      where: { slug: { in: ["hand-roll", "horusvegan", "alleria-pizza", "nascosto-pizzeria"] }, logoUrl: { not: null } },
      select: { name: true, slug: true, logoUrl: true, plan: true },
    }),
  ]);

  if (!restaurant) return notFound();

  return (
    <ActivarClient
      restaurant={{ id: restaurant.id, name: restaurant.name, slug: restaurant.slug!, logoUrl: restaurant.logoUrl }}
      categories={restaurant.categories.map(c => c.name)}
      dishes={restaurant.dishes.map(d => ({ name: d.name, price: d.price, photo: d.photos[0] || null, description: d.description || "" }))}
      activeVenues={activeVenues}
    />
  );
}
