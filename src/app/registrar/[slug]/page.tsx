import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import RegistrarClient from "./RegistrarClient";

export default async function RegistrarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const restaurant = await prisma.restaurant.findFirst({
    where: { slug, isDemo: true },
    select: { id: true, name: true, slug: true },
  });

  if (!restaurant) return notFound();

  // Traer venues activas con platos para el showcase del iPhone
  const showcaseVenues = await prisma.restaurant.findMany({
    where: {
      slug: { in: ["hand-roll", "horusvegan", "alleria-pizza", "nascosto-pizzeria"] },
      isDemo: false,
      logoUrl: { not: null },
    },
    select: {
      name: true, slug: true, logoUrl: true,
      categories: { take: 3, orderBy: { position: "asc" }, select: { name: true } },
      dishes: {
        take: 3,
        where: { photos: { isEmpty: false }, isActive: true, deletedAt: null },
        orderBy: { position: "asc" },
        select: { name: true, price: true, photos: true, description: true },
      },
    },
  });

  return (
    <RegistrarClient
      restaurant={{ id: restaurant.id, name: restaurant.name, slug: restaurant.slug! }}
      showcaseVenues={showcaseVenues.map(v => ({
        name: v.name,
        slug: v.slug!,
        logoUrl: v.logoUrl,
        categories: v.categories.map(c => c.name),
        dishes: v.dishes.map(d => ({ name: d.name, price: d.price, photo: d.photos[0] || null, description: d.description || "" })),
      }))}
    />
  );
}
