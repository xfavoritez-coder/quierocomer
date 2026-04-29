import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";
import { headers } from "next/headers";
import { getRestaurantBySlug } from "@/lib/qr/queries/getRestaurant";
import {
  getTimeOfDay,
  getWeatherCondition,
  applyScheduleRules,
} from "@/lib/qr/utils/detectConditions";
import { isValidLang, parseLangHeader } from "@/lib/qr/i18n";
import type { Lang } from "@/lib/qr/i18n";
import CartaBasic from "@/components/qr/carta/CartaBasic";
import CartaRouter from "@/components/qr/carta/CartaRouter";
import DesktopWrapper from "@/components/qr/carta/DesktopWrapper";
import { prisma } from "@/lib/prisma";
import { getPopularDishes } from "@/lib/qr/utils/getPopularDishes";

// Deduplicate: both generateMetadata and page use the same query
// Metadata always uses Spanish (restaurant name doesn't change)
const getCachedRestaurant = cache((slug: string, lang: Lang) => getRestaurantBySlug(slug, lang));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const restaurant = await getCachedRestaurant(slug, "es");

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
  searchParams: Promise<{ mesa?: string; t?: string; vista?: string; lang?: string }>;
}) {
  const { slug } = await params;
  const { mesa: tableId, t: qrToken, vista: urlView, lang: urlLang } = await searchParams;
  const isQrScan = !!(tableId || qrToken);

  // Resolve language: URL param > Accept-Language header > fallback (es)
  let lang: Lang = "es";
  if (isValidLang(urlLang)) {
    lang = urlLang;
  } else {
    const headerList = await headers();
    lang = parseLangHeader(headerList.get("accept-language"));
  }

  // Run restaurant fetch (with translations) and weather check in parallel
  const [restaurant, weather] = await Promise.all([
    getCachedRestaurant(slug, lang),
    getWeatherCondition(),
  ]);
  if (!restaurant) return notFound();

  const timeOfDay = getTimeOfDay();

  const { dishes, categories } = applyScheduleRules(
    restaurant.dishes,
    restaurant.categories,
    restaurant.schedules,
    timeOfDay,
    weather
  );

  // Fetch popular dishes, marketing promos, and announcements in parallel
  const [popularDishes, activePromos, rawAnnouncements] = await Promise.all([
    getPopularDishes(restaurant.id).catch(() => ({ global: [], byCategory: [] })),
    prisma.promotion.findMany({
    where: { restaurantId: restaurant.id, status: "ACTIVE", OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }] },
    orderBy: { createdAt: "desc" },
  }),
    prisma.announcement.findMany({
      where: { restaurantId: restaurant.id, isActive: true },
      orderBy: { position: "asc" },
      select: { id: true, text: true, linkUrl: true, daysOfWeek: true, startDate: true, endDate: true },
    }),
  ]);
  // Filter promos by day of week (0=sun, 1=mon, ..., 6=sat)
  const todayDow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" })).getDay();
  const filteredPromos = activePromos.filter(p => !p.daysOfWeek?.length || p.daysOfWeek.includes(todayDow));
  const promoDishIds = filteredPromos.flatMap(p => p.dishIds);
  const promoDishes = promoDishIds.length ? await prisma.dish.findMany({
    where: { id: { in: promoDishIds } },
    select: { id: true, name: true, description: true, price: true, photos: true, ingredients: true },
  }) : [];
  const promoDishMap = Object.fromEntries(promoDishes.map(d => [d.id, d]));
  const marketingPromos = filteredPromos.map(p => ({
    id: p.id, name: p.name, description: p.description,
    promoType: p.promoType, imageUrl: p.imageUrl,
    discountPct: p.discountPct, promoPrice: p.promoPrice, originalPrice: p.originalPrice,
    validUntil: p.validUntil?.toISOString() || null,
    dishes: p.dishIds.map(id => promoDishMap[id]).filter(Boolean),
  }));

  // Filter announcements by day of week and date range
  const now = new Date();
  const activeAnnouncements = rawAnnouncements.filter(a => {
    if (a.daysOfWeek.length > 0 && !a.daysOfWeek.includes(todayDow)) return false;
    if (a.startDate && now < new Date(a.startDate)) return false;
    if (a.endDate && now > new Date(new Date(a.endDate).getTime() + 86400000)) return false;
    return true;
  }).map(a => ({ id: a.id, text: a.text, linkUrl: a.linkUrl }));

  // Resolve initial view server-side: URL param > restaurant default > fallback
  const validViews = ["premium", "lista", "viaje"];
  const serverView = validViews.includes(urlView || "") ? urlView! : ((restaurant as any).defaultView || "premium");

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
    isQrScan,
    initialView: serverView,
    lang,
    happyHours: (restaurant as any).happyHours || [],
    timeOfDay,
    weather,
    popularDishIds: [...(popularDishes.global || []), ...(popularDishes.byCategory || [])].map(p => p.dishId),
    announcements: activeAnnouncements,
  };

  return (
    <DesktopWrapper
      restaurantName={restaurant.name}
      slug={slug}
      restaurant={restaurant as any}
      categories={categories as any}
      dishes={dishes as any}
      popularDishIds={new Set(cartaProps.popularDishIds || [])}
      tableId={tableId}
      isQrScan={isQrScan}
      lang={lang}
      marketingPromos={marketingPromos}
    >
      {isPremium ? (
        <CartaRouter {...cartaProps} />
      ) : (
        <CartaBasic {...cartaProps} />
      )}
    </DesktopWrapper>
  );
}
