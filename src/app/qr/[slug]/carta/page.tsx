import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import CartaImprimible from "./CartaImprimible";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await prisma.restaurant.findUnique({ where: { slug }, select: { name: true } });
  return { title: r ? `Carta ${r.name} — Imprimir` : "Carta imprimible" };
}

export default async function CartaImprimiblePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { slug } = await params;
  const { template } = await searchParams;

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    include: {
      categories: {
        where: { isActive: true },
        orderBy: { position: "asc" },
      },
      dishes: {
        where: { isActive: true, deletedAt: null },
        orderBy: { position: "asc" },
      },
    },
  });

  if (!restaurant) return notFound();

  const promos = await prisma.promotion.findMany({
    where: { restaurantId: restaurant.id, status: "ACTIVE" },
  });

  const accent = restaurant.cartaAccentColor || "#1a1a1a";
  const dishesByCategory = new Map<string, any[]>();
  for (const d of restaurant.dishes) {
    const key = d.categoryId || "__uncategorized";
    if (!dishesByCategory.has(key)) dishesByCategory.set(key, []);
    dishesByCategory.get(key)!.push({
      id: d.id, name: d.name, description: d.description, price: d.price,
      discountPrice: d.discountPrice, photos: d.photos, categoryId: d.categoryId,
      tags: d.tags as string[], dishDiet: d.dishDiet, isSpicy: d.isSpicy,
    });
  }

  const sections = restaurant.categories
    .filter(c => dishesByCategory.has(c.id))
    .map(c => ({ id: c.id, name: c.name, dishes: dishesByCategory.get(c.id)! }));

  const uncategorized = dishesByCategory.get("__uncategorized");
  if (uncategorized?.length) sections.push({ id: "__uncategorized", name: "Otros", dishes: uncategorized });

  const qrUrl = `https://quierocomer.com/qr/${slug}`;
  const promotions = promos.map(p => ({
    id: p.id, name: p.name, description: p.description,
    promoPrice: p.promoPrice, originalPrice: p.originalPrice,
  }));

  return (
    <CartaImprimible
      restaurant={{
        name: restaurant.name,
        slug: restaurant.slug,
        logoUrl: restaurant.logoUrl,
        accent,
        phone: restaurant.phone,
        address: restaurant.address,
        instagram: restaurant.instagram,
        website: restaurant.website,
        whatsapp: restaurant.whatsapp,
      }}
      sections={sections}
      promotions={promotions}
      qrUrl={qrUrl}
      initialTemplate={(template as any) || "magazine"}
    />
  );
}
