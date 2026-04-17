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

  const isPremium = restaurant.cartaTheme === "PREMIUM";
  const cartaProps = {
    restaurant,
    categories,
    dishes,
    promotions: restaurant.promotions,
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
