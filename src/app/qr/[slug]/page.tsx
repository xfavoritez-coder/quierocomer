import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";
import { headers } from "next/headers";
import { unstable_cache } from "next/cache";
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
import DemoBanner from "@/components/qr/carta/DemoBanner";
import DemoOnboarding from "@/components/qr/carta/DemoOnboarding";
import DemoFirstViewModal from "@/components/qr/carta/DemoFirstViewModal";
import DemoViewToast from "@/components/qr/carta/DemoViewToast";
import DemoBirthdayBanner from "@/components/qr/carta/DemoBirthdayBanner";
import ShowcaseMobileOnly from "@/components/qr/carta/ShowcaseMobileOnly";
import MultiMenuLanding from "@/components/qr/carta/MultiMenuLanding";
import { prisma } from "@/lib/prisma";
import { getTopDishIds } from "@/lib/qr/utils/getTopDishIds";

// Deduplicate: both generateMetadata and page use the same query
// Metadata always uses Spanish (restaurant name doesn't change)
const getCachedRestaurant = cache((slug: string, lang: Lang) => getRestaurantBySlug(slug, lang));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const restaurant = await getCachedRestaurant(slug, "es");

  if (!restaurant) return {};

  const title = `${restaurant.name} | Carta online`;
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
  searchParams: Promise<{ mesa?: string; vista?: string; lang?: string; showcase?: string; embed?: string; menu?: string }>;
}) {
  const { slug } = await params;
  const { mesa: tableId, vista: urlView, lang: urlLang, showcase, embed, menu: menuSlug } = await searchParams;
  const isShowcase = showcase === "1";
  const isEmbed = embed === "mobile";
  const isQrScan = !!tableId;

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

  const scheduled = applyScheduleRules(
    restaurant.dishes,
    restaurant.categories,
    restaurant.schedules,
    timeOfDay,
    weather
  );

  // Multi-menu: check if we should show landing or filter by menu group
  const menuGroups = (restaurant as any).menuGroups || [];
  const isMultiMenu = (restaurant as any).multiMenuEnabled && menuGroups.length >= 2;
  const showMultiMenuLanding = isMultiMenu && !menuSlug;

  // Filter categories by schedule (days + time range)
  const chileNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
  const currentDay = chileNow.getDay(); // 0=dom, 1=lun, ...
  const currentTime = `${String(chileNow.getHours()).padStart(2, "0")}:${String(chileNow.getMinutes()).padStart(2, "0")}`;

  const filteredCategories = scheduled.categories.filter((cat: any) => {
    // No schedule = always visible
    if (!cat.scheduleDays || cat.scheduleDays.length === 0) return true;
    // Check day
    if (!cat.scheduleDays.includes(currentDay)) return false;
    // Check time range if set
    if (cat.scheduleStart && currentTime < cat.scheduleStart) return false;
    if (cat.scheduleEnd && currentTime > cat.scheduleEnd) return false;
    return true;
  });

  const visibleCatIds = new Set(filteredCategories.map((c: any) => c.id));

  // Filter categories/dishes by selected menu group
  let { dishes, categories } = { dishes: scheduled.dishes.filter((d: any) => visibleCatIds.has(d.categoryId)), categories: filteredCategories };
  let activeMenuGroup: { slug: string; name: string } | null = null;

  if (isMultiMenu && menuSlug) {
    const group = menuGroups.find((g: any) => g.slug === menuSlug);
    if (group) {
      activeMenuGroup = { slug: group.slug, name: group.name };
      const groupCatIds = new Set(group.categories.map((c: any) => c.id));
      // Categories not assigned to ANY group appear in all menus
      const allAssignedCatIds = new Set(menuGroups.flatMap((g: any) => g.categories.map((c: any) => c.id)));
      categories = scheduled.categories.filter(
        (c: any) => groupCatIds.has(c.id) || !allAssignedCatIds.has(c.id),
      );
      const filteredCatIds = new Set(categories.map((c: any) => c.id));
      dishes = scheduled.dishes.filter((d: any) => filteredCatIds.has(d.categoryId));
    }
    // If menuSlug is invalid, show full carta (graceful fallback)
  }

  // Fetch popular dishes, marketing promos, and announcements in parallel
  // Promos + announcements cached 2 min — reduces DB hits under high concurrency
  const getPromos = unstable_cache(
    (rid: string) => prisma.promotion.findMany({
      where: {
        restaurantId: rid,
        status: "ACTIVE",
        OR: [{ validFrom: null }, { validFrom: { lte: new Date() } }],
        AND: [{ OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }] }],
      },
      orderBy: { createdAt: "desc" },
    }),
    ["qr-promos", restaurant.id],
    { tags: [`qr-restaurant-${restaurant.slug}`], revalidate: 300 }
  );
  const getAnnouncements = unstable_cache(
    (rid: string) => prisma.announcement.findMany({
      where: { restaurantId: rid, isActive: true },
      orderBy: { position: "asc" },
      select: { id: true, text: true, linkUrl: true, daysOfWeek: true, startDate: true, endDate: true },
    }),
    ["qr-announcements", restaurant.id],
    { tags: [`qr-restaurant-${restaurant.slug}`], revalidate: 300 }
  );
  const [topDishesResult, activePromos, rawAnnouncements] = await Promise.all([
    getTopDishIds(restaurant.id).catch(() => ({ dishIds: new Set<string>(), source: "none" as const, totalSalesToday: 0 })),
    getPromos(restaurant.id),
    getAnnouncements(restaurant.id),
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
    validUntil: p.validUntil ? new Date(p.validUntil).toISOString() : null,
    daysOfWeek: p.daysOfWeek || [],
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
  const validViews = ["premium", "lista", "impact", "feed"];
  const serverView = validViews.includes(urlView || "") ? urlView! : ((restaurant as any).defaultView || "premium");

  // Plan-based feature gating (done server-side so bypassing devtools doesn't help)
  const plan = ((restaurant as any).plan || "FREE").toUpperCase();
  const canShowPromos = plan === "SILVER" || plan === "GOLD" || plan === "PREMIUM";
  const canShowAnnouncements = plan === "GOLD" || plan === "PREMIUM";
  const hasDesignFeatures = plan === "SILVER" || plan === "GOLD" || plan === "PREMIUM";

  const isPremium = restaurant.cartaTheme === "PREMIUM";
  const cartaProps = {
    restaurant,
    categories,
    dishes,
    promotions: restaurant.promotions,
    marketingPromos: canShowPromos ? marketingPromos : [],
    ratingMap: restaurant.ratingMap,
    reviews: restaurant.reviews,
    tableId,
    isQrScan,
    initialView: serverView,
    lang,
    happyHours: (restaurant as any).happyHours || [],
    timeOfDay,
    weather,
    popularDishIds: Array.from(topDishesResult.dishIds),
    announcements: canShowAnnouncements ? activeAnnouncements : [],
  };

  // Fetch lead data for DemoBanner inline form (only if demo)
  const leadData = (restaurant as any).isDemo ? await prisma.lead.findFirst({
    where: { generatedSlug: slug },
    select: { ownerName: true, email: true, whatsapp: true },
    orderBy: { createdAt: "desc" },
  }) : null;
  const colorMode = hasDesignFeatures ? ((restaurant as any).cartaColorMode || "LIGHT") : "LIGHT";
  const themeClass = colorMode === "DARK" ? "carta-dark" : "carta-light";
  const accentColor = hasDesignFeatures ? ((restaurant as any).cartaAccentColor || null) : null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: restaurant.name,
    url: `https://quierocomer.cl/qr/${slug}`,
    hasMenu: `https://quierocomer.cl/qr/${slug}`,
    ...((restaurant as any).address ? {
      address: {
        '@type': 'PostalAddress',
        streetAddress: (restaurant as any).address,
      },
    } : {}),
    ...((restaurant as any).phone ? { telephone: (restaurant as any).phone } : {}),
    ...(restaurant.logoUrl ? { image: restaurant.logoUrl } : {}),
    ...((restaurant as any).googleRating ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: (restaurant as any).googleRating,
        reviewCount: (restaurant as any).googleRatingCount ?? 1,
      },
    } : {}),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    <div className={`${themeClass}${accentColor ? " carta-custom-accent" : ""}`}>
      <script dangerouslySetInnerHTML={{ __html: `
        try {
          if (location.search.includes("embed=mobile")) {
            document.documentElement.style.scrollbarWidth = "none";
            var s = document.createElement("style");
            s.textContent = "::-webkit-scrollbar{display:none!important}html{scrollbar-width:none!important}";
            document.head.appendChild(s);
          }
          var o = localStorage.getItem("qc_theme_override");
          if (o && ${hasDesignFeatures ? "true" : "false"}) {
            var el = document.currentScript.parentElement;
            el.classList.remove("carta-dark", "carta-light");
            el.classList.add(o === "dark" ? "carta-dark" : "carta-light");
          }
        } catch(e) {}
      `}} />
      {accentColor && (
        <style dangerouslySetInnerHTML={{ __html: `
          .carta-dark, .carta-light {
            --carta-accent: ${accentColor};
            --carta-detail-price: ${accentColor};
            --carta-promo-border: ${accentColor}40;
            --carta-promo-shadow: 0 2px 12px ${accentColor}15;
            --carta-surface-rec: ${accentColor}14;
          }
          .carta-light.carta-custom-accent {
            --carta-promo-bg: linear-gradient(135deg, ${accentColor}0D 0%, ${accentColor}08 100%);
          }
          .carta-dark.carta-custom-accent {
            --carta-promo-bg: linear-gradient(135deg, ${accentColor}0F 0%, ${accentColor}08 100%);
          }
        `}} />
      )}
      {!(restaurant as any).isDemo && !isShowcase && (
        <>
          {topDishesResult.totalSalesToday === 0 && (restaurant as any).owner && (
            <DemoFirstViewModal restaurantSlug={slug} restaurantName={restaurant.name} />
          )}
        </>
      )}
      {(restaurant as any).isDemo && !isShowcase && (
        <>
          <DemoBanner restaurantName={restaurant.name} restaurantSlug={slug} restaurantLogo={restaurant.logoUrl} restaurantId={restaurant.id} context="carta" leadName={leadData?.ownerName || undefined} leadEmail={leadData?.email || undefined} leadWhatsapp={leadData?.whatsapp || undefined} plan={(restaurant as any).plan} defaultView={(restaurant as any).defaultView} enabledLangs={(restaurant as any).enabledLangs} />
          <div style={{ height: 0 }} />
          <DemoFirstViewModal restaurantSlug={slug} restaurantName={restaurant.name} />
          <DemoViewToast restaurantId={restaurant.id} restaurantSlug={slug} defaultView={(restaurant as any).defaultView} />
        </>
      )}
      {isShowcase && !isEmbed && (
        <ShowcaseMobileOnly restaurantSlug={slug} restaurantName={restaurant.name} />
      )}
      {showMultiMenuLanding ? (
        <MultiMenuLanding
          menuGroups={menuGroups}
          restaurantName={restaurant.name}
          logoUrl={restaurant.logoUrl}
          accentColor={accentColor}
          dishes={dishes as any}
          categories={categories as any}
        />
      ) : (
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
          menuGroups={isMultiMenu ? menuGroups : undefined}
          activeMenuSlug={activeMenuGroup?.slug}
        >
          {isPremium ? (
            <CartaRouter {...cartaProps} menuGroups={isMultiMenu ? menuGroups : undefined} activeMenuSlug={activeMenuGroup?.slug} />
          ) : (
            <CartaBasic {...cartaProps} />
          )}
        </DesktopWrapper>
      )}
    </div>
    </>
  );
}
