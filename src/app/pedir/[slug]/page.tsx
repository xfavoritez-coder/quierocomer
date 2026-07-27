import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRestaurantBySlug } from "@/lib/qr/queries/getRestaurant";
import { prisma } from "@/lib/prisma";
import { getCachedTopDishIds } from "@/lib/qr/utils/getTopDishIds";
import OrderMenuPage from "@/components/order/OrderMenuPage";
import { OrderCartProvider } from "@/components/order/OrderCartContext";
import MenuPausedPage from "@/components/qr/MenuPausedPage";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug, "es");
  if (!restaurant) return {};
  return {
    title: `Pedir en ${restaurant.name} | QuieroComer`,
    description: `Arma tu pedido de ${restaurant.name} y envíalo directo por WhatsApp. Sin apps, sin comisiones.`,
    openGraph: {
      title: `🛍️ Pide en ${restaurant.name}`,
      description: `Elige tus platos y envía tu pedido por WhatsApp. Rápido, sin apps.`,
      images: restaurant.logoUrl
        ? [{ url: restaurant.logoUrl, width: 400, height: 400, alt: restaurant.name }]
        : [],
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `🛍️ Pide en ${restaurant.name}`,
      description: `Elige tus platos y envía tu pedido por WhatsApp. Rápido, sin apps.`,
      images: restaurant.logoUrl ? [restaurant.logoUrl] : [],
    },
  };
}

export default async function PedirPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const [restaurant, config] = await Promise.all([
    getRestaurantBySlug(slug, "es"),
    prisma.restaurant.findUnique({
      where: { slug },
      select: {
        id: true, slug: true, name: true, logoUrl: true, plan: true,
        orderingEnabled: true, orderingPhone: true, orderingDelivery: true,
        orderingMinAmount: true, orderingWaitTime: true, orderingNote: true, orderingPaymentMethods: true,
        orderingBannerUrl: true,
        whatsapp: true, address: true, phone: true,
        defaultView: true, cartaColorMode: true, cartaAccentColor: true,
        billingExempt: true, isDemo: true,
        subscriptionStatus: true, currentPeriodEnd: true, trialEndsAt: true,
      },
    }),
  ]);

  if (!restaurant || !config) return notFound();

  // Only PREMIUM (or TRIALING) can use ordering (excepción: el-menu-de-la-esquina con plan GOLD)
  const ORDERING_EXCEPTIONS = ["el-menu-de-la-esquina"];
  const isOnTrial = config.subscriptionStatus === "TRIALING";
  if (config.plan !== "PREMIUM" && !isOnTrial && !ORDERING_EXCEPTIONS.includes(slug)) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "var(--font-body, sans-serif)", background: "#fafafa" }}>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          {config.logoUrl && <img src={config.logoUrl} alt={config.name} style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", marginBottom: 16 }} />}
          <h1 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 8px" }}>{config.name}</h1>
          <p style={{ fontSize: "0.85rem", color: "#666", lineHeight: 1.6 }}>Los pedidos online no están disponibles en este restaurante por el momento.</p>
        </div>
      </div>
    );
  }

  // Verificar si el plan está vigente
  const chileDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(d);
  const todayChile = chileDate(new Date());
  const periodEnd = config.currentPeriodEnd ? new Date(config.currentPeriodEnd) : null;
  const trialEnd = config.trialEndsAt ? new Date(config.trialEndsAt) : null;
  const isMenuLive =
    config.billingExempt ||
    config.isDemo ||
    (config.subscriptionStatus === "ACTIVE" && periodEnd && chileDate(periodEnd) >= todayChile) ||
    (config.subscriptionStatus === "TRIALING" && trialEnd && chileDate(trialEnd) >= todayChile) ||
    (config.subscriptionStatus === "CANCELED" && periodEnd && chileDate(periodEnd) >= todayChile);
  const isPaused = !isMenuLive;

  // Ordering is disabled (only block if not paused — paused shows overlay over menu)
  if (!config.orderingEnabled && !isPaused) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "var(--font-body, sans-serif)", background: "#fafafa" }}>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          {config.logoUrl && <img src={config.logoUrl} alt={config.name} style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", marginBottom: 16 }} />}
          <h1 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 8px" }}>{config.name}</h1>
          <p style={{ fontSize: "0.85rem", color: "#666", lineHeight: 1.6 }}>Los pedidos online no están disponibles en este momento. Visítanos o contáctanos directamente.</p>
        </div>
      </div>
    );
  }

  const topDishes = await getCachedTopDishIds(config.id).catch(() => ({ dishIds: [] as string[] }));

  // Filtrar categorías por horario (igual que carta QR)
  const chileNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
  const currentDay = chileNow.getDay();
  const currentTime = `${String(chileNow.getHours()).padStart(2, "0")}:${String(chileNow.getMinutes()).padStart(2, "0")}`;
  const filteredCats = (restaurant as any).categories.filter((cat: any) => {
    if (!cat.scheduleDays || cat.scheduleDays.length === 0) return true;
    if (!cat.scheduleDays.includes(currentDay)) return false;
    if (cat.scheduleStart && currentTime < cat.scheduleStart) return false;
    if (cat.scheduleEnd && currentTime > cat.scheduleEnd) return false;
    return true;
  });
  const visibleCatIds = new Set(filteredCats.map((c: any) => c.id));
  const scheduledRestaurant = {
    ...(restaurant as any),
    categories: filteredCats,
    dishes: (restaurant as any).dishes.filter((d: any) => visibleCatIds.has(d.categoryId)),
  };

  const orderingConfig = {
    phone: config.orderingPhone || config.whatsapp || config.phone || "",
    delivery: config.orderingDelivery as "PICKUP" | "DELIVERY" | "BOTH",
    minAmount: config.orderingMinAmount ?? null,
    waitTime: config.orderingWaitTime ?? null,
    note: config.orderingNote ?? null,
    address: config.address ?? null,
    paymentMethods: ((config as any).orderingPaymentMethods || "efectivo,transferencia,tarjeta").split(",").filter(Boolean) as string[],
    orderingBannerUrl: (config as any).orderingBannerUrl || null,
    cartaView: (config as any).defaultView || "lista",
    cartaColorMode: (config as any).cartaColorMode || "LIGHT",
    cartaAccentColor: (config as any).cartaAccentColor || null,
  };

  return (
    <OrderCartProvider>
      {isPaused && <MenuPausedPage restaurantName={config.name} logoUrl={config.logoUrl} />}
      <OrderMenuPage
        restaurant={scheduledRestaurant as any}
        orderingConfig={orderingConfig}
        popularDishIds={topDishes.dishIds}
      />
    </OrderCartProvider>
  );
}
