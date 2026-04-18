import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRestaurantBySlug } from "@/lib/qr/queries/getRestaurant";
import {
  getTimeOfDay,
  getWeatherCondition,
  applyScheduleRules,
} from "@/lib/qr/utils/detectConditions";
import CartaBasic from "@/components/qr/carta/CartaBasic";
import CartaRouter from "@/components/qr/carta/CartaRouter";
import DesktopWrapper from "@/components/qr/carta/DesktopWrapper";
import { prisma } from "@/lib/prisma";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: { name: true, description: true, logoUrl: true },
  });

  if (!restaurant) return {};

  const title = `${restaurant.name} | Carta QR Viva`;
  const description = `Mira la carta completa de ${restaurant.name}. Platos con fotos, recomendaciones del Genio y más.`;
  const image = restaurant.logoUrl || "https://quierocomer.cl/favicon.svg";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: image }],
      type: "website",
      url: `https://quierocomer.cl/qr/${slug}`,
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: [image],
    },
  };
}

export default async function CartaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ mesa?: string }>;
}) {
  const { slug } = await params;
  const { mesa: tableId } = await searchParams;

  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) return notFound();

  const timeOfDay = getTimeOfDay();
  const weather = await getWeatherCondition();

  const { dishes, categories } = applyScheduleRules(
    restaurant.dishes,
    restaurant.categories,
    restaurant.schedules,
    timeOfDay,
    weather
  );

  // Fetch active marketing promos server-side
  const activePromos = await prisma.promotion.findMany({
    where: { restaurantId: restaurant.id, status: "ACTIVE", OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }] },
    orderBy: { createdAt: "desc" },
  });
  const promoDishIds = activePromos.flatMap(p => p.dishIds);
  const promoDishes = promoDishIds.length ? await prisma.dish.findMany({
    where: { id: { in: promoDishIds } },
    select: { id: true, name: true, description: true, price: true, photos: true, ingredients: true },
  }) : [];
  const promoDishMap = Object.fromEntries(promoDishes.map(d => [d.id, d]));
  const marketingPromos = activePromos.map(p => ({
    id: p.id, name: p.name, description: p.description,
    discountPct: p.discountPct, promoPrice: p.promoPrice, originalPrice: p.originalPrice,
    validUntil: p.validUntil?.toISOString() || null,
    dishes: p.dishIds.map(id => promoDishMap[id]).filter(Boolean),
  }));

  const isPremium = restaurant.cartaTheme === "PREMIUM";
  const cartaProps = {
    restaurant,
    categories,
    dishes,
    promotions: restaurant.promotions,
    marketingPromos,
    ratingMap: restaurant.ratingMap,
    reviews: restaurant.reviews,
    tableId,
  };

  return (
    <DesktopWrapper restaurantName={restaurant.name} slug={slug}>
      {isPremium ? (
        <CartaRouter {...cartaProps} />
      ) : (
        <CartaBasic {...cartaProps} />
      )}
    </DesktopWrapper>
  );
}
